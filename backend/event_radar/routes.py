"""Rutas REST `/api/v1/events*` del radar de eventos (B9).

Requisitos: R27, R40-R45, A8, A12, A16 y el addendum de inscripciones
(dismiss/undismiss/register/unregister y el listado de descartados). Contrato (plan.md, sección 4):

    handle(method, path, query, body, ctx=None) -> (status, payload)

- `query` es el dict de `urllib.parse.parse_qs` (valores lista) o un dict
  plano; `body` son los bytes crudos del cuerpo (o None).
- `ctx` por defecto es `engine.default_context()`; sin contexto responde 503.
- Toda respuesta 4xx/5xx es `{"error": "<mensaje en español>"}` (A16).
- Cada request abre y cierra su propia conexión (`context.connect`,
  `timeout=60`; R33) y hace commit solo en las escrituras.
- Una excepción inesperada se loguea con traceback por `ctx.log` y responde
  500: nunca se traga en silencio.

Solo stdlib, compatible con Python 3.10.
"""

import json
import sqlite3
import traceback
from typing import Any, Dict, Optional, Tuple

from . import engine, net, schema, store, timeutil
from .context import RadarContext, connect

PREFIX = "/api/v1/events"
LOG_PREFIX = "[radar-eventos]"
NAME_MAX = 80
ROBOTS_TIMEOUT_S = 20.0

# Tipos cuyas altas manuales se consideran locales (como en la siembra, R9).
LOCAL_KINDS = ("luma_discover", "luma_calendar", "meetup")
# Categoría fija por tipo (igual que la siembra, R9 d).
FIXED_CATEGORY = {"argentinahackathons_rss": "hackatones", "devevents_cfps": "charlas_cfps"}

_HEALTH_FIELDS = ("last_status", "last_count", "last_error", "last_run_at", "last_ok_at",
                  "last_duration_s", "streak_kind", "streak_started_at", "streak_alerted_at")

Result = Tuple[int, dict]


class _HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------


def _q(query: Optional[dict], key: str) -> Optional[str]:
    value = (query or {}).get(key)
    if isinstance(value, (list, tuple)):
        value = value[0] if value else None
    return value if value is None else str(value)


def _json_body(body: Optional[bytes]) -> dict:
    if not body:
        raise _HttpError(400, "el cuerpo tiene que ser un objeto JSON")
    try:
        data = json.loads(body.decode("utf-8") if isinstance(body, bytes) else body)
    except (ValueError, UnicodeDecodeError) as exc:
        raise _HttpError(400, "el cuerpo no es JSON válido: %s" % exc)
    if not isinstance(data, dict):
        raise _HttpError(400, "el cuerpo tiene que ser un objeto JSON")
    return data


def _valid_name(value: Any) -> str:
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= NAME_MAX:
        raise _HttpError(400, "el nombre tiene que tener de 1 a %d caracteres" % NAME_MAX)
    return value.strip()


def _valid_id(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise _HttpError(400, "id inválido")
    try:
        return int(value)
    except ValueError:
        raise _HttpError(400, "id inválido: %r" % (value,))


def _last_pass(conn) -> dict:
    raw = store.get_state(conn, "last_pass_summary")
    summary = None
    if raw:
        try:
            summary = json.loads(raw)
        except ValueError as exc:
            print("%s last_pass_summary inválido en la base: %s" % (LOG_PREFIX, exc), flush=True)
    return {"started_at": store.get_state(conn, "last_pass_started_at"),
            "finished_at": store.get_state(conn, "last_pass_finished_at"),
            "summary": summary}


def _source_dict(row: sqlite3.Row) -> dict:
    """Forma de A16 para una fuente (fila con LEFT JOIN de salud y hash)."""
    health = None
    if row["h_source_id"] is not None:
        health = {f: row[f] for f in _HEALTH_FIELDS}
    is_page = row["kind"] == "page_hash"
    return {
        "id": row["id"],
        "kind": row["kind"],
        "name": row["name"],
        "value": schema.source_value(row["kind"], row["url"], row["config"]),
        "url": row["url"],
        "enabled": bool(row["enabled"]),
        "is_local": bool(row["is_local"]),
        "default_category": row["default_category"],
        "fixed_category": row["fixed_category"],
        "origin": row["origin"],
        "disabled_reason": row["disabled_reason"],
        "health": health,
        "last_http_status": row["last_http_status"] if is_page else None,
        "last_changed_at": row["last_changed_at"] if is_page else None,
    }


_SOURCES_SQL = (
    "SELECT s.*, h.source_id AS h_source_id, h.last_status, h.last_count, h.last_error, "
    "h.last_run_at, h.last_ok_at, h.last_duration_s, h.streak_kind, h.streak_started_at, "
    "h.streak_alerted_at, p.last_http_status, p.last_changed_at "
    "FROM event_sources s "
    "LEFT JOIN event_source_health h ON h.source_id = s.id "
    "LEFT JOIN event_page_hashes p ON p.source_id = s.id")


def _get_source(conn, source_id: int) -> Optional[dict]:
    row = conn.execute(_SOURCES_SQL + " WHERE s.id = ?", (source_id,)).fetchone()
    return _source_dict(row) if row is not None else None


def _source_config(kind: str, value: Any) -> dict:
    if kind == "luma_discover":
        return {"keyword": value.strip()}
    if kind == "luma_calendar":
        return {"cal_id": value.strip()}
    if kind == "meetup":
        return {"urlname": value.strip()}
    if kind == "devevents_cfps":
        return {"timeout": 60}
    return {}


def _insert_source(conn, *, kind: str, name: str, url: str, config: dict, is_local: int,
                   origin: str, default_category: Optional[str], now) -> int:
    ts = timeutil.format_local(now)
    try:
        cur = conn.execute(
            """INSERT INTO event_sources
               (kind, name, url, config, fixed_category, default_category, is_local,
                enabled, disabled_reason, origin, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?)""",
            (kind, name, url, json.dumps(config, ensure_ascii=False, sort_keys=True),
             FIXED_CATEGORY.get(kind), default_category, is_local, origin, ts, ts))
    except sqlite3.IntegrityError:
        raise _HttpError(409, "ya existe una fuente %s con esa URL" % kind)
    return int(cur.lastrowid)


def _policy(ctx: RadarContext) -> Optional[net.UrlPolicy]:
    policy = getattr(ctx.fetcher, "policy", None)
    return policy if isinstance(policy, net.UrlPolicy) else None


# --------------------------------------------------------------------------
# Handlers
# --------------------------------------------------------------------------


def _list_events(ctx: RadarContext, conn, query: dict) -> Result:
    category = _q(query, "category")
    if category is not None and category not in store.CATEGORIES:
        raise _HttpError(400, "categoría inválida: %s (válidas: %s)"
                         % (category, ", ".join(store.CATEGORIES)))
    include_past = (_q(query, "include_past") or "0").strip().lower() in ("1", "true")
    return 200, store.list_events(conn, category, include_past, ctx.now())


def _event_id(data: dict) -> int:
    if data.get("id") is None:
        raise _HttpError(400, "falta id")
    return _valid_id(data.get("id"))


def _set_user_status(ctx: RadarContext, conn, data: dict, status: Optional[str],
                     only_if: Optional[str] = None) -> Result:
    event_id = _event_id(data)
    event = store.set_user_status(conn, event_id, status, ctx.now(), only_if=only_if)
    if event is None:
        raise _HttpError(404, "no existe el evento %d" % event_id)
    conn.commit()
    return 200, {"event": event}


def _dismiss_event(ctx: RadarContext, conn, data: dict) -> Result:
    return _set_user_status(ctx, conn, data, store.USER_DISMISSED)


def _undismiss_event(ctx: RadarContext, conn, data: dict) -> Result:
    return _set_user_status(ctx, conn, data, None, only_if=store.USER_DISMISSED)


def _register_event(ctx: RadarContext, conn, data: dict) -> Result:
    return _set_user_status(ctx, conn, data, store.USER_REGISTERED)


def _unregister_event(ctx: RadarContext, conn, data: dict) -> Result:
    return _set_user_status(ctx, conn, data, None, only_if=store.USER_REGISTERED)


def _list_dismissed(ctx: RadarContext, conn, query: dict) -> Result:
    return 200, store.list_dismissed(conn, ctx.now())


def _list_sources(ctx: RadarContext, conn, query: dict) -> Result:
    rows = conn.execute(_SOURCES_SQL + " ORDER BY s.id").fetchall()
    return 200, {"sources": [_source_dict(r) for r in rows]}


def _create_source(ctx: RadarContext, conn, data: dict) -> Result:
    kind = data.get("kind")
    if kind not in schema.VALID_KINDS:
        raise _HttpError(400, "tipo de fuente inválido: %r" % (kind,))
    name = _valid_name(data.get("name"))
    default_category = data.get("default_category")
    if default_category is None:
        default_category = "meetups" if kind == "meetup" else None
    elif default_category not in store.CATEGORIES:
        raise _HttpError(400, "categoría por defecto inválida: %r" % (default_category,))
    value = data.get("value")
    try:
        url = net.canonical_source_url(kind, value, policy=_policy(ctx))
    except ValueError as exc:
        raise _HttpError(400, "valor inválido para %s: %s" % (kind, exc))
    if kind == "page_hash":
        try:
            allowed = engine._robots_allowed(ctx.fetcher, url, kind,
                                             ctx.monotonic() + ROBOTS_TIMEOUT_S)
        except Exception as exc:
            ctx.log("%s alta de página: robots.txt no disponible para %s: %s: %s"
                    % (LOG_PREFIX, url, type(exc).__name__, exc))
            raise _HttpError(502, "no se pudo consultar robots.txt de %s" % url)
        if not allowed:
            raise _HttpError(400, "robots.txt prohíbe monitorear %s" % url)
    sid = _insert_source(conn, kind=kind, name=name, url=url,
                         config=_source_config(kind, value if isinstance(value, str) else ""),
                         is_local=1 if kind in LOCAL_KINDS else 0, origin="manual",
                         default_category=default_category, now=ctx.now())
    conn.commit()
    return 201, {"source": _get_source(conn, sid)}


def _update_source(ctx: RadarContext, conn, data: dict) -> Result:
    sid = _valid_id(data.get("id"))
    sets, params = [], []
    if "name" in data:
        sets.append("name = ?")
        params.append(_valid_name(data.get("name")))
    if "enabled" in data:
        enabled = data.get("enabled")
        if enabled not in (True, False, 0, 1):
            raise _HttpError(400, "enabled tiene que ser true o false")
        sets.append("enabled = ?")
        params.append(1 if enabled else 0)
        if enabled:
            sets.append("disabled_reason = NULL")
    if not sets:
        raise _HttpError(400, "no hay campos para modificar (enabled o name)")
    if conn.execute("SELECT 1 FROM event_sources WHERE id = ?", (sid,)).fetchone() is None:
        raise _HttpError(404, "no existe la fuente %d" % sid)
    sets.append("updated_at = ?")
    params.append(timeutil.format_local(ctx.now()))
    conn.execute("UPDATE event_sources SET %s WHERE id = ?" % ", ".join(sets), params + [sid])
    conn.commit()
    return 200, {"source": _get_source(conn, sid)}


def _delete_source(ctx: RadarContext, conn, data: dict) -> Result:
    sid = _valid_id(data.get("id"))
    if conn.execute("SELECT 1 FROM event_sources WHERE id = ?", (sid,)).fetchone() is None:
        raise _HttpError(404, "no existe la fuente %d" % sid)
    conn.execute("UPDATE event_links SET source_id = NULL WHERE source_id = ?", (sid,))
    conn.execute("DELETE FROM event_source_health WHERE source_id = ?", (sid,))
    conn.execute("DELETE FROM event_page_hashes WHERE source_id = ?", (sid,))
    conn.execute("DELETE FROM event_sources WHERE id = ?", (sid,))
    conn.commit()
    return 200, {"deleted": sid}


def _health(ctx: RadarContext, conn, query: dict) -> Result:
    rows = conn.execute(
        "SELECT s.id, s.name, s.kind, h.last_status, h.streak_kind, h.streak_started_at, "
        "h.streak_alerted_at FROM event_sources s "
        "LEFT JOIN event_source_health h ON h.source_id = s.id "
        "WHERE s.enabled = 1 ORDER BY s.id").fetchall()
    counts = {"ok": 0, "zero": 0, "error": 0}
    alerting = []
    for r in rows:
        st = r["last_status"]
        if st == "ok":
            counts["ok"] += 1
        elif st == "zero":
            counts["zero"] += 1
        elif st in ("error", "timeout"):
            counts["error"] += 1
        if r["streak_kind"] and r["streak_alerted_at"]:
            alerting.append({"id": r["id"], "name": r["name"], "kind": r["kind"],
                             "streak_kind": r["streak_kind"],
                             "streak_started_at": r["streak_started_at"]})
    return 200, {"last_pass": _last_pass(conn), "sources_total": len(rows),
                 "sources_ok": counts["ok"], "sources_zero": counts["zero"],
                 "sources_error": counts["error"], "alerting": alerting}


def _sample_titles(conn, ids_json: Optional[str], limit: int = 3) -> list:
    try:
        ids = [str(i) for i in json.loads(ids_json or "[]")]
    except (ValueError, TypeError) as exc:
        print("%s candidato con event_ids inválido: %s" % (LOG_PREFIX, exc), flush=True)
        return []
    titles = []
    for origin_id in ids:
        row = conn.execute(
            "SELECT e.title FROM event_links l JOIN events e ON e.id = l.event_id "
            "WHERE l.provider = 'luma' AND l.origin_id = ?", (origin_id,)).fetchone()
        if row is not None and row["title"] not in titles:
            titles.append(row["title"])
        if len(titles) >= limit:
            break
    return titles


def _list_candidates(ctx: RadarContext, conn, query: dict) -> Result:
    rows = conn.execute(
        "SELECT rowid AS rid, * FROM event_calendar_candidates WHERE status = 'proposed' "
        "ORDER BY seen_count DESC, rowid ASC").fetchall()
    return 200, {"candidates": [
        {"id": r["rid"], "calendar_api_id": r["cal_api_id"], "name": r["name"],
         "slug": r["slug"], "seen_count": r["seen_count"],
         "sample_titles": _sample_titles(conn, r["event_ids"])} for r in rows]}


def _get_candidate(conn, data: dict) -> sqlite3.Row:
    cal_id = data.get("cal_api_id")
    if not isinstance(cal_id, str) or not cal_id.strip():
        raise _HttpError(400, "falta cal_api_id")
    row = conn.execute("SELECT * FROM event_calendar_candidates WHERE cal_api_id = ?",
                       (cal_id.strip(),)).fetchone()
    if row is None:
        raise _HttpError(404, "no existe el candidato %s" % cal_id.strip())
    return row


def _accept_candidate(ctx: RadarContext, conn, data: dict) -> Result:
    cand = _get_candidate(conn, data)
    if cand["status"] != "proposed":
        raise _HttpError(409, "el candidato ya está %s" % cand["status"])
    cal_id = cand["cal_api_id"]
    try:
        url = net.canonical_source_url("luma_calendar", cal_id, policy=_policy(ctx))
    except ValueError as exc:
        raise _HttpError(400, "cal-id inválido: %s" % exc)
    name = (cand["name"] or cand["slug"] or cal_id).strip()[:NAME_MAX] or cal_id
    config = {"cal_id": cal_id}
    if cand["slug"]:
        config["slug"] = cand["slug"]
    sid = _insert_source(conn, kind="luma_calendar", name=name, url=url, config=config,
                         is_local=1, origin="autodiscovery", default_category=None,
                         now=ctx.now())
    conn.execute("UPDATE event_calendar_candidates SET status = 'accepted' WHERE cal_api_id = ?",
                 (cal_id,))
    conn.commit()
    return 201, {"source": _get_source(conn, sid), "cal_api_id": cal_id, "status": "accepted"}


def _dismiss_candidate(ctx: RadarContext, conn, data: dict) -> Result:
    cand = _get_candidate(conn, data)
    conn.execute("UPDATE event_calendar_candidates SET status = 'dismissed' WHERE cal_api_id = ?",
                 (cand["cal_api_id"],))
    conn.commit()
    return 200, {"cal_api_id": cand["cal_api_id"], "status": "dismissed"}


_GET = {
    PREFIX: _list_events,
    PREFIX + "/sources": _list_sources,
    PREFIX + "/health": _health,
    PREFIX + "/candidates": _list_candidates,
    PREFIX + "/dismissed": _list_dismissed,
}
_POST = {
    PREFIX + "/sources": _create_source,
    PREFIX + "/sources/update": _update_source,
    PREFIX + "/sources/delete": _delete_source,
    PREFIX + "/candidates/accept": _accept_candidate,
    PREFIX + "/candidates/dismiss": _dismiss_candidate,
    PREFIX + "/dismiss": _dismiss_event,
    PREFIX + "/undismiss": _undismiss_event,
    PREFIX + "/register": _register_event,
    PREFIX + "/unregister": _unregister_event,
}
_RUN = PREFIX + "/run"
_RUN_STATUS = PREFIX + "/run/status"


# --------------------------------------------------------------------------
# Entrada
# --------------------------------------------------------------------------


def _route(ctx: RadarContext, method: str, path: str, query: dict,
           body: Optional[bytes]) -> Result:
    if method == "GET" and path == _RUN_STATUS:
        return 200, engine.status(ctx)
    if method == "POST" and path == _RUN:
        if engine.try_start_manual(ctx):
            return 202, {"started": True}
        return 409, {"running": True, "error": "ya hay una pasada en curso"}
    table = _GET if method == "GET" else _POST if method == "POST" else None
    if table is None or path not in table:
        known = path in _GET or path in _POST or path in (_RUN, _RUN_STATUS)
        if known:
            raise _HttpError(405, "método %s no permitido en %s" % (method, path))
        raise _HttpError(404, "ruta no encontrada: %s" % path)
    data = _json_body(body) if method == "POST" else query
    conn = connect(ctx)
    try:
        return table[path](ctx, conn, data)
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def handle(method: str, path: str, query: Optional[dict], body: Optional[bytes],
           ctx: Optional[RadarContext] = None) -> Result:
    """Atiende una ruta `/api/v1/events*` y devuelve `(status, payload)`."""
    ctx = ctx if ctx is not None else engine.default_context()
    if ctx is None:
        return 503, {"error": "radar de eventos sin configurar"}
    method = (method or "").upper()
    path = (path or "").rstrip("/") or "/"
    try:
        return _route(ctx, method, path, query or {}, body)
    except _HttpError as exc:
        return exc.status, {"error": exc.message}
    except Exception as exc:
        ctx.log("%s %s %s: error %s: %s\n%s" % (LOG_PREFIX, method, path, type(exc).__name__,
                                                exc, traceback.format_exc()))
        return 500, {"error": "error interno del radar de eventos: %s" % type(exc).__name__}
