"""Persistencia del radar de eventos (B6): upsert, dedupe y fusión, cambios,
bajas, visibilidad, candidatos, hashes de página y estado global.

Requisitos: R13, R19, R23-R27, R41, R44, D1, A2, A4, A5, A10, A12 y el
addendum de inscripciones (descartar / "Me inscribí", `user_status`).

Reglas de uso (contrato de plan.md, sección 4):
- Ninguna función de este módulo hace `commit`: el llamador (engine/routes)
  abre la conexión con `context.connect` (timeout=60) y confirma la
  transacción. Así el upsert de una fuente y su salud quedan en una sola
  transacción corta.
- Las fechas que se guardan son ISO en hora AR (`YYYY-MM-DDTHH:MM:SS-03:00`).
- Nunca se levanta `IntegrityError` por colisión de `dedupe_key` (A2): si dos
  eventos terminan con la misma clave, se fusionan en el de menor `id`.

Dedupe (R23, D1, A4), en este orden:
1. `(provider, origin_id)` en `event_links`;
2. URL canónica del evento (solo entre eventos que no son CFP);
3. `dedupe_key` (los CFP llevan prefijo `cfp|` y solo chocan entre sí).

Grupos para bajas (R26): `source_group(kind, source_id)` da `"luma_discover"`
para todas las keywords del discover y `str(source_id)` para el resto. El
engine arma `seen_by_group` con esas claves.
"""

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from . import normalize, timeutil
from .model import Event, PageObservation

CATEGORIES = normalize.CATEGORIES
DISCOVER_KIND = "luma_discover"
DISCOVER_GROUP = "luma_discover"
CFP_KEY_PREFIX = "cfp|"

CONDOR_SKIP_KEY = "condor_skip"
CONDOR_SKIP_MAX = 500
# Acumulación de calendarios vistos en un solo evento del discover (R44): no
# son candidatos todavía, así que no van a `event_calendar_candidates`.
CANDIDATE_PENDING_KEY = "candidate_pending"
CANDIDATE_PENDING_MAX = 500

PROVIDER_RANK = {"luma": 0, "nexa": 1}
OK_OUTCOMES = ("ok", "zero")

PAGE_BASELINE = "baseline"
PAGE_CHANGED = "changed"
PAGE_UNCHANGED = "unchanged"
PAGE_ERROR = "error"

# Estado del usuario sobre un evento (addendum inscripciones). El upsert nunca
# lo toca: una pasada que vuelve a traer el evento actualiza la misma fila y
# el evento sigue fuera de su solapa.
USER_DISMISSED = "dismissed"
USER_REGISTERED = "registered"
USER_STATUSES = (USER_DISMISSED, USER_REGISTERED)

# Campos que define el proveedor de mayor prioridad (R24).
_BEST_FIELDS = ("title", "description", "category", "start_local", "end_local", "has_time",
                "venue", "city", "lat", "lon", "location_unconfirmed", "primary_url",
                "best_provider", "require_approval", "sold_out")


@dataclass
class UpsertStats:
    new_ids: List[int] = field(default_factory=list)       # eventos creados en esta llamada
    updated_ids: List[int] = field(default_factory=list)   # cambió algún campo o se sumó un link
    seen_ids: Set[int] = field(default_factory=set)        # todos los eventos tocados


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------


def _iso(now: datetime) -> str:
    return timeutil.format_local(now)


def provider_rank(provider: Optional[str]) -> int:
    return PROVIDER_RANK.get(provider or "", 2)


def source_group(kind: Optional[str], source_id: int) -> str:
    """Clave de grupo para bajas (R26): todas las `luma_discover` son una."""
    return DISCOVER_GROUP if kind == DISCOVER_KIND else str(source_id)


def _is_cfp_key(key: Optional[str]) -> bool:
    return bool(key) and key.startswith(CFP_KEY_PREFIX)


def _opt_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    return 1 if value else 0


def _opt_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    return bool(value)


def _event_values(ev: Event) -> Dict[str, Any]:
    """Columnas de `events` que salen de un `Event` normalizado."""
    return {
        "dedupe_key": ev.dedupe_key,
        "title": ev.title,
        "description": ev.description,
        "category": ev.category,
        "start_local": ev.start_local,
        "end_local": ev.end_local,
        "has_time": 1 if ev.has_time else 0,
        "closing_local": ev.closing_local or ev.start_local,
        "closing_explicit": 1 if (ev.closing_explicit and ev.closing_local) else 0,
        "venue": ev.venue or ev.location_text,
        "city": ev.city or ev.region,
        "lat": ev.lat,
        "lon": ev.lon,
        "location_unconfirmed": 1 if ev.location_unconfirmed else 0,
        "primary_url": ev.url,
        "best_provider": ev.provider,
        "require_approval": _opt_int(ev.require_approval),
        "sold_out": _opt_int(ev.sold_out),
    }


def _row_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {k: row[k] for k in row.keys()}


def _get_event(conn, event_id: int) -> Optional[Dict[str, Any]]:
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    return _row_dict(row) if row is not None else None


def _source_exists(conn, source_id: Optional[int]) -> bool:
    if source_id is None:
        return False
    row = conn.execute("SELECT 1 FROM event_sources WHERE id = ?", (source_id,)).fetchone()
    return row is not None


# --------------------------------------------------------------------------
# Estado global (event_radar_state)
# --------------------------------------------------------------------------


def get_state(conn, key: str, default: Optional[str] = None) -> Optional[str]:
    row = conn.execute("SELECT value FROM event_radar_state WHERE key = ?", (key,)).fetchone()
    if row is None or row[0] is None:
        return default
    return row[0]


def set_state(conn, key: str, value: Any) -> None:
    """Guarda `value` (str tal cual; None borra el valor; el resto como JSON)."""
    if value is not None and not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    conn.execute("INSERT OR REPLACE INTO event_radar_state (key, value) VALUES (?, ?)",
                 (key, value))


def _get_json_state(conn, key: str, default: Any) -> Any:
    raw = get_state(conn, key)
    if not raw:
        return default
    try:
        value = json.loads(raw)
    except ValueError as exc:
        print("[radar-eventos] estado %s con JSON inválido, se reinicia: %s" % (key, exc),
              flush=True)
        return default
    return value if isinstance(value, type(default)) else default


def condor_skip_get(conn) -> List[str]:
    """A5: slugs de Condor Nest que no se vuelven a bajar."""
    return [str(s) for s in _get_json_state(conn, CONDOR_SKIP_KEY, [])]


def condor_skip_add(conn, slugs: Iterable[str]) -> None:
    """A5: agrega slugs al final (sin repetir) y conserva los últimos 500 (FIFO)."""
    current = condor_skip_get(conn)
    known = set(current)
    for slug in slugs:
        slug = str(slug)
        if slug and slug not in known:
            current.append(slug)
            known.add(slug)
    if len(current) > CONDOR_SKIP_MAX:
        current = current[-CONDOR_SKIP_MAX:]
    set_state(conn, CONDOR_SKIP_KEY, json.dumps(current, ensure_ascii=False))


# --------------------------------------------------------------------------
# Upsert, dedupe y fusión (R13, R23, R24, R25, D1, A2, A4)
# --------------------------------------------------------------------------


class _UrlIndex:
    """URL canónica -> id de evento, solo para eventos que no son CFP (A4)."""

    def __init__(self, conn):
        self.map: Dict[str, int] = {}
        rows = conn.execute(
            """SELECT e.id AS id, e.primary_url AS url, e.dedupe_key AS k FROM events e
               UNION ALL
               SELECT l.event_id, l.url, e.dedupe_key FROM event_links l
               JOIN events e ON e.id = l.event_id"""
        ).fetchall()
        for row in rows:
            if not _is_cfp_key(row["k"]):
                self.add(row["url"], row["id"])

    def add(self, url: Optional[str], event_id: int) -> None:
        canon = normalize.canonical_url(url)
        if canon:
            prev = self.map.get(canon)
            if prev is None or event_id < prev:
                self.map[canon] = event_id

    def get(self, url: Optional[str]) -> Optional[int]:
        canon = normalize.canonical_url(url)
        return self.map.get(canon) if canon else None

    def remap(self, old_id: int, new_id: int) -> None:
        for canon, eid in list(self.map.items()):
            if eid == old_id:
                self.map[canon] = new_id


def _find_by_origin(conn, ev: Event) -> Optional[int]:
    row = conn.execute("SELECT event_id FROM event_links WHERE provider = ? AND origin_id = ?",
                       (ev.provider, ev.origin_id)).fetchone()
    return row[0] if row is not None else None


def _find_by_url(conn, ev: Event, index: _UrlIndex) -> Optional[int]:
    if ev.is_cfp or _is_cfp_key(ev.dedupe_key):
        return None
    for url in (ev.canonical_url, ev.url):
        event_id = index.get(url)
        if event_id is not None:
            row = conn.execute("SELECT dedupe_key FROM events WHERE id = ?",
                               (event_id,)).fetchone()
            if row is not None and not _is_cfp_key(row[0]):
                return event_id
    return None


def _find_by_key(conn, key: str) -> Optional[int]:
    row = conn.execute("SELECT id FROM events WHERE dedupe_key = ?", (key,)).fetchone()
    return row[0] if row is not None else None


def _insert_event(conn, ev: Event, ts: str) -> int:
    vals = _event_values(ev)
    vals.update(first_seen_at=ts, last_seen_at=ts, updated_at=ts)
    cols = list(vals)
    cur = conn.execute(
        "INSERT INTO events (%s) VALUES (%s)" % (", ".join(cols), ", ".join("?" * len(cols))),
        [vals[c] for c in cols],
    )
    return int(cur.lastrowid)


def _upsert_link(conn, event_id: int, source_id: Optional[int], ev: Event, ts: str) -> bool:
    """Crea o refresca el link `(provider, origin_id)`. True si lo creó."""
    row = conn.execute("SELECT id FROM event_links WHERE provider = ? AND origin_id = ?",
                       (ev.provider, ev.origin_id)).fetchone()
    if row is not None:
        # Conserva el primer source_id vivo (discover y calendario comparten el
        # link, R13); si la fuente original se borró, toma la actual.
        conn.execute(
            """UPDATE event_links SET event_id = ?, url = ?, last_seen_at = ?,
                      source_id = COALESCE(source_id, ?)
               WHERE id = ?""",
            (event_id, ev.url, ts, source_id, row[0]),
        )
        return False
    conn.execute(
        """INSERT OR IGNORE INTO event_links
           (event_id, source_id, provider, origin_id, url, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (event_id, source_id, ev.provider, ev.origin_id, ev.url, ts, ts),
    )
    return True


def _merged_values(current: Dict[str, Any], ev: Event) -> Dict[str, Any]:
    """Valores nuevos de un evento existente al verlo en `ev` (R24, R25)."""
    new = _event_values(ev)
    out = {k: current[k] for k in _BEST_FIELDS}
    out["dedupe_key"] = current["dedupe_key"]
    out["closing_local"] = current["closing_local"]
    out["closing_explicit"] = current["closing_explicit"]

    best = current["best_provider"]
    takes_over = provider_rank(ev.provider) < provider_rank(best)
    same_best = ev.provider == best
    if takes_over or same_best:
        for k in _BEST_FIELDS:
            out[k] = new[k]
        out["dedupe_key"] = new["dedupe_key"]
        # El cierre del mejor proveedor manda, salvo que sea inferido y ya haya
        # uno explícito de otro proveedor (R24).
        if new["closing_explicit"] or not current["closing_explicit"]:
            out["closing_local"] = new["closing_local"]
            out["closing_explicit"] = new["closing_explicit"]
    elif new["closing_explicit"] and not current["closing_explicit"]:
        out["closing_local"] = new["closing_local"]
        out["closing_explicit"] = 1
    return out


def _combine_rows(winner: Dict[str, Any], loser: Dict[str, Any]) -> Dict[str, Any]:
    """Datos finales al fusionar dos eventos por colisión de clave (A2)."""
    if provider_rank(loser["best_provider"]) < provider_rank(winner["best_provider"]):
        best, rest = loser, winner
    else:
        best, rest = winner, loser
    data = {k: best[k] for k in _BEST_FIELDS}
    # Cierre: el del mejor proveedor, salvo que sea inferido y el otro explícito.
    src = best if (best["closing_explicit"] or not rest["closing_explicit"]) else rest
    data["closing_local"] = src["closing_local"]
    data["closing_explicit"] = src["closing_explicit"]
    # Se conservan los notified_* no nulos del más viejo (winner) y, si falta
    # alguno, el del otro: así nada se renotifica.
    data["notified_new_at"] = winner["notified_new_at"] or loser["notified_new_at"]
    data["notified_closing_at"] = winner["notified_closing_at"] or loser["notified_closing_at"]
    data["notified_new_urgent"] = max(winner["notified_new_urgent"] or 0,
                                      loser["notified_new_urgent"] or 0)
    data["first_seen_at"] = min(winner["first_seen_at"], loser["first_seen_at"])
    # El estado del usuario (descartado / inscripto) sobrevive a la fusión.
    status_src = winner if winner.get("user_status") else loser
    data["user_status"] = status_src.get("user_status")
    data["user_status_at"] = status_src.get("user_status_at")
    return data


def _apply_update(conn, event_id: int, current: Dict[str, Any], vals: Dict[str, Any],
                  ts: str, stats: UpsertStats, index: _UrlIndex) -> Tuple[int, bool]:
    """Escribe `vals` en el evento. Resuelve la colisión de `dedupe_key` (A2).

    Devuelve `(id final, hubo cambios)`.
    """
    other = None
    if vals["dedupe_key"] != current["dedupe_key"]:
        other_id = _find_by_key(conn, vals["dedupe_key"])
        if other_id is not None and other_id != event_id:
            other = _get_event(conn, other_id)

    if other is None:
        changed_cols = [k for k, v in vals.items() if current.get(k) != v]
        sets = {k: vals[k] for k in changed_cols}
        sets.update(last_seen_at=ts, missing_since=None)
        if changed_cols:
            sets["updated_at"] = ts
        conn.execute("UPDATE events SET %s WHERE id = ?" % ", ".join("%s = ?" % k for k in sets),
                     list(sets.values()) + [event_id])
        return event_id, bool(changed_cols)

    # A2: fusión en el de menor id; se mueven los links y se borra el sobrante.
    updated_current = dict(current)
    updated_current.update(vals)
    if other["id"] < event_id:
        winner, loser = other, updated_current
    else:
        winner, loser = updated_current, other
    data = _combine_rows(winner, loser)
    data["dedupe_key"] = vals["dedupe_key"]
    data.update(last_seen_at=ts, updated_at=ts, missing_since=None)
    win_id, lose_id = winner["id"], loser["id"]
    conn.execute("UPDATE event_links SET event_id = ? WHERE event_id = ?", (win_id, lose_id))
    conn.execute("DELETE FROM events WHERE id = ?", (lose_id,))
    conn.execute("UPDATE events SET %s WHERE id = ?" % ", ".join("%s = ?" % k for k in data),
                 list(data.values()) + [win_id])
    index.remap(lose_id, win_id)
    _replace_id(stats, lose_id, win_id)
    return win_id, True


def _replace_id(stats: UpsertStats, old: int, new: int) -> None:
    if old in stats.seen_ids:
        stats.seen_ids.discard(old)
        stats.seen_ids.add(new)
    was_new = old in stats.new_ids
    stats.new_ids = [i for i in stats.new_ids if i != old]
    stats.updated_ids = [i for i in stats.updated_ids if i != old]
    if was_new and new not in stats.new_ids and new not in stats.updated_ids:
        stats.updated_ids.append(new)


def upsert_events(conn, source_id: Optional[int], events: List[Event],
                  now: datetime) -> UpsertStats:
    """Guarda los eventos normalizados de una fuente (R23-R25, D1, A2, A4).

    - Evento nuevo: fila en `events` con `notified_*` nulos (queda pendiente
      del push de nuevos) y su link.
    - Evento existente: se agrega o refresca el link, se limpia
      `missing_since` (reaparición, R26) y, si el proveedor tiene prioridad
      mayor o igual al `best_provider`, se actualizan sus campos (R24, R25)
      sin tocar `notified_new_at` ni `notified_closing_at`.
    - Si la fuente ya no existe (borrada en medio de la pasada), los links
      se guardan con `source_id` nulo.
    No hace commit. Si lanza una excepción, la transacción queda abierta con
    escrituras parciales: el llamador DEBE hacer `conn.rollback()` antes de
    seguir (y nunca `commit()`), para no persistir filas a medias ni retener
    el lock de escritura.
    """
    ts = _iso(now)
    stats = UpsertStats()
    if source_id is not None and not _source_exists(conn, source_id):
        source_id = None
    index = _UrlIndex(conn)

    for ev in events:
        event_id = _find_by_origin(conn, ev)
        if event_id is None:
            event_id = _find_by_url(conn, ev, index)
        if event_id is None:
            event_id = _find_by_key(conn, ev.dedupe_key)

        if event_id is None:
            event_id = _insert_event(conn, ev, ts)
            _upsert_link(conn, event_id, source_id, ev, ts)
            if not ev.is_cfp:
                index.add(ev.url, event_id)
            stats.new_ids.append(event_id)
            stats.seen_ids.add(event_id)
            continue

        current = _get_event(conn, event_id)
        vals = _merged_values(current, ev)
        event_id, changed = _apply_update(conn, event_id, current, vals, ts, stats, index)
        link_created = _upsert_link(conn, event_id, source_id, ev, ts)
        if not _is_cfp_key(vals["dedupe_key"]):
            index.add(ev.url, event_id)
        stats.seen_ids.add(event_id)
        if (changed or link_created) and event_id not in stats.new_ids \
                and event_id not in stats.updated_ids:
            stats.updated_ids.append(event_id)
    return stats


# --------------------------------------------------------------------------
# Bajas (R26)
# --------------------------------------------------------------------------


def mark_missing(conn, outcomes: Dict[int, str], seen_by_group: Dict[str, Set[int]],
                 now: datetime) -> int:
    """Marca `missing_since` en los eventos futuros que nadie trajo (R26).

    - `outcomes`: `source_id -> estado` (`ok`, `zero`, `error`, `timeout`) de
      las fuentes que corrieron en esta pasada.
    - `seen_by_group`: `source_group(kind, id) -> {event_id}` vistos en la
      pasada (las `luma_discover` son un solo grupo: la unión de sus keywords).

    Un evento se marca solo si tiene al menos un link con `source_id` no nulo
    y cada una de esas fuentes existe, está activa, corrió en la pasada con
    `ok`/`zero` y su grupo no lo vio. Para las `luma_discover`, además, todas
    las keywords que corrieron tienen que haber terminado `ok`/`zero`.
    Nunca borra filas. Devuelve cuántos eventos marcó. No hace commit.
    """
    outcomes = {int(k): v for k, v in outcomes.items()}
    seen: Dict[str, Set[int]] = {str(k): set(v) for k, v in seen_by_group.items()}
    # Un link compartido (R13: discover + calendario) guarda un solo source_id;
    # si cualquier grupo vio el evento en esta pasada, no es baja.
    all_seen: Set[int] = set().union(*seen.values()) if seen else set()
    sources = {row["id"]: row for row in
               conn.execute("SELECT id, kind, enabled FROM event_sources").fetchall()}
    discover_ran = [sid for sid in outcomes
                    if sid in sources and sources[sid]["kind"] == DISCOVER_KIND]
    discover_ok = bool(discover_ran) and all(outcomes[s] in OK_OUTCOMES for s in discover_ran)

    links: Dict[int, Set[int]] = {}
    for row in conn.execute(
            """SELECT l.event_id, l.source_id FROM event_links l
               JOIN events e ON e.id = l.event_id
               WHERE e.missing_since IS NULL AND l.source_id IS NOT NULL"""):
        links.setdefault(row[0], set()).add(row[1])

    ts = _iso(now)
    marked = 0
    for event_id, source_ids in links.items():
        if event_id in all_seen:
            continue
        ok = True
        for sid in source_ids:
            src = sources.get(sid)
            if src is None or not src["enabled"] or outcomes.get(sid) not in OK_OUTCOMES:
                ok = False
                break
            if src["kind"] == DISCOVER_KIND and not discover_ok:
                ok = False
                break
            if event_id in seen.get(source_group(src["kind"], sid), set()):
                ok = False
                break
        if not ok:
            continue
        ev = conn.execute("SELECT start_local, end_local, has_time FROM events WHERE id = ?",
                          (event_id,)).fetchone()
        if ev is None:
            continue
        try:
            finished = timeutil.is_finished(ev["start_local"], ev["end_local"],
                                            bool(ev["has_time"]), now)
        except ValueError as exc:
            print("[radar-eventos] evento %s con fecha inválida en bajas: %s" % (event_id, exc),
                  flush=True)
            continue
        if finished:
            continue
        conn.execute("UPDATE events SET missing_since = ? WHERE id = ? AND missing_since IS NULL",
                     (ts, event_id))
        marked += 1
    return marked


# --------------------------------------------------------------------------
# Candidatos de auto-descubrimiento (R44)
# --------------------------------------------------------------------------


def _followed_calendars(conn) -> Set[str]:
    from . import schema  # import diferido: solo para leer el valor de la fuente
    out: Set[str] = set()
    for row in conn.execute(
            "SELECT url, config FROM event_sources WHERE kind = 'luma_calendar'"):
        out.add(schema.source_value("luma_calendar", row["url"], row["config"]))
        url = row["url"] or ""
        marker = "calendar_api_id="
        if marker in url:
            out.add(url.split(marker, 1)[1].split("&", 1)[0])
    return out


def update_candidates(conn, discover_events: List[Event], now: datetime) -> None:
    """Acumula calendarios citados por eventos del discover que pasaron el
    filtro AMBA (R44). Con 2 o más eventos distintos (por `api_id`, acumulado
    entre pasadas) y si no se sigue como `luma_calendar`, queda en
    `event_calendar_candidates` con `status='proposed'`. Un candidato
    `accepted` o `dismissed` conserva su estado. Mientras tiene un solo
    evento se acumula en `event_radar_state.candidate_pending`. No hace commit.
    """
    ts = _iso(now)
    followed = _followed_calendars(conn)
    pending: Dict[str, Any] = _get_json_state(conn, CANDIDATE_PENDING_KEY, {})
    pending_changed = False

    for ev in discover_events:
        cal = ev.calendar if isinstance(ev.calendar, dict) else None
        cal_id = str(cal.get("api_id") or "").strip() if cal else ""
        if not cal_id or not ev.origin_id or cal_id in followed:
            continue
        name, slug = cal.get("name"), cal.get("slug")
        row = conn.execute("SELECT * FROM event_calendar_candidates WHERE cal_api_id = ?",
                           (cal_id,)).fetchone()
        if row is not None:
            try:
                ids = list(json.loads(row["event_ids"] or "[]"))
            except ValueError as exc:
                print("[radar-eventos] candidato %s con event_ids inválido: %s" % (cal_id, exc),
                      flush=True)
                ids = []
            if ev.origin_id not in ids:
                ids.append(ev.origin_id)
            conn.execute(
                """UPDATE event_calendar_candidates
                   SET name = COALESCE(?, name), slug = COALESCE(?, slug), event_ids = ?,
                       seen_count = ?, last_seen_at = ?
                   WHERE cal_api_id = ?""",
                (name, slug, json.dumps(ids, ensure_ascii=False), len(ids), ts, cal_id),
            )
            continue

        entry = pending.get(cal_id) if isinstance(pending.get(cal_id), dict) else None
        if entry is None:
            entry = {"name": name, "slug": slug, "event_ids": [], "first_seen_at": ts}
        ids = [str(i) for i in entry.get("event_ids") or []]
        if ev.origin_id not in ids:
            ids.append(ev.origin_id)
        entry.update(event_ids=ids, name=name or entry.get("name"),
                     slug=slug or entry.get("slug"))
        if len(ids) >= 2:
            conn.execute(
                """INSERT OR IGNORE INTO event_calendar_candidates
                   (cal_api_id, name, slug, event_ids, seen_count, first_seen_at,
                    last_seen_at, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed')""",
                (cal_id, entry.get("name"), entry.get("slug"),
                 json.dumps(ids, ensure_ascii=False), len(ids),
                 entry.get("first_seen_at") or ts, ts),
            )
            pending.pop(cal_id, None)
        else:
            pending.pop(cal_id, None)  # reinsertado al final: FIFO por última vista
            pending[cal_id] = entry
        pending_changed = True

    if pending_changed:
        while len(pending) > CANDIDATE_PENDING_MAX:
            pending.pop(next(iter(pending)))
        set_state(conn, CANDIDATE_PENDING_KEY, json.dumps(pending, ensure_ascii=False))


# --------------------------------------------------------------------------
# Páginas monitoreadas (R19)
# --------------------------------------------------------------------------


def record_page_observation(conn, source_id: int, obs: PageObservation, now: datetime) -> str:
    """Guarda una observación de `page_hash` (R19).

    - Error de red/timeout (`obs.error` o sin código HTTP): no es cambio y no
      pisa nada; devuelve `error`.
    - Primera observación: fija la línea base; devuelve `baseline`.
    - Hash o código HTTP distinto del anterior: `changed` (mueve el actual a
      `previous_*`, setea `last_changed_at` y deja `change_notified_at` nulo).
    - Igual: `unchanged` (solo actualiza `last_checked_at`).
    No hace commit.
    """
    if obs is None or obs.error or obs.http_status is None:
        return PAGE_ERROR
    if not _source_exists(conn, source_id):
        # Fuente borrada en medio de la pasada: no se crea una fila huérfana.
        return PAGE_ERROR
    ts = _iso(now)
    row = conn.execute("SELECT * FROM event_page_hashes WHERE source_id = ?",
                       (source_id,)).fetchone()
    if row is None or (row["last_hash"] is None and row["last_http_status"] is None):
        conn.execute(
            """INSERT OR REPLACE INTO event_page_hashes
               (source_id, last_hash, previous_hash, last_http_status, previous_http_status,
                last_checked_at, last_changed_at, change_notified_at)
               VALUES (?, ?, NULL, ?, NULL, ?, NULL, NULL)""",
            (source_id, obs.hash, obs.http_status, ts),
        )
        return PAGE_BASELINE
    if row["last_hash"] != obs.hash or row["last_http_status"] != obs.http_status:
        conn.execute(
            """UPDATE event_page_hashes
               SET previous_hash = last_hash, previous_http_status = last_http_status,
                   last_hash = ?, last_http_status = ?, last_checked_at = ?,
                   last_changed_at = ?, change_notified_at = NULL
               WHERE source_id = ?""",
            (obs.hash, obs.http_status, ts, ts, source_id),
        )
        return PAGE_CHANGED
    conn.execute("UPDATE event_page_hashes SET last_checked_at = ? WHERE source_id = ?",
                 (ts, source_id))
    return PAGE_UNCHANGED


# --------------------------------------------------------------------------
# Listado y visibilidad (R27, R41, A10)
# --------------------------------------------------------------------------


def is_visible(row: Any, now: datetime) -> bool:
    """R27: oculta lo terminado y los CFP con cierre pasado."""
    if timeutil.is_finished(row["start_local"], row["end_local"], bool(row["has_time"]), now):
        return False
    if _is_cfp_key(row["dedupe_key"]) and not _closing_open(row, now):
        return False
    return True


def _closing_open(row: Any, now: datetime) -> bool:
    """El cierre todavía no pasó: con hora, por instante; sin hora, hasta el fin del día.

    Única regla de visibilidad, compartida con alerts.py (alerts.is_visible delega acá).
    """
    closing = row["closing_local"]
    if not closing:
        return False
    if bool(row["closing_explicit"]) or bool(row["has_time"]):
        return timeutil.parse_local(closing) > timeutil.to_ar(now)
    return timeutil.closing_in_days(closing, now) >= 0


def _last_pass(conn) -> Dict[str, Any]:
    summary_raw = get_state(conn, "last_pass_summary")
    summary = None
    if summary_raw:
        try:
            summary = json.loads(summary_raw)
        except ValueError as exc:
            print("[radar-eventos] last_pass_summary con JSON inválido: %s" % exc, flush=True)
    return {"started_at": get_state(conn, "last_pass_started_at"),
            "finished_at": get_state(conn, "last_pass_finished_at"),
            "summary": summary}


def _event_urls(conn) -> Dict[int, List[str]]:
    urls: Dict[int, List[str]] = {}
    for link in conn.execute("SELECT event_id, url FROM event_links ORDER BY id ASC"):
        urls.setdefault(link[0], [])
        if link[1] not in urls[link[0]]:
            urls[link[0]].append(link[1])
    return urls


def _event_dict(row: Any, urls: Dict[int, List[str]], closing_days: Optional[int]) -> dict:
    event_urls = list(urls.get(row["id"], []))
    if row["primary_url"] in event_urls:
        event_urls.remove(row["primary_url"])
    event_urls.insert(0, row["primary_url"])
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "start_local": row["start_local"],
        "end_local": row["end_local"],
        "has_time": bool(row["has_time"]),
        "closing_local": row["closing_local"],
        "closing_explicit": bool(row["closing_explicit"]),
        "closing_in_days": closing_days,
        "venue": row["venue"],
        "city": row["city"],
        "location_unconfirmed": bool(row["location_unconfirmed"]),
        "primary_url": row["primary_url"],
        "urls": event_urls,
        "best_provider": row["best_provider"],
        "require_approval": _opt_bool(row["require_approval"]),
        "sold_out": _opt_bool(row["sold_out"]),
        "missing_since": row["missing_since"],
        "first_seen_at": row["first_seen_at"],
        "user_status": row["user_status"],
        "user_status_at": row["user_status_at"],
    }


def _is_finished(row: Any, now: datetime) -> bool:
    return timeutil.is_finished(row["start_local"], row["end_local"], bool(row["has_time"]), now)


def list_events(conn, category: Optional[str], include_past: bool, now: datetime) -> dict:
    """R41: `{"events": [...], "counts": {...}, "registered": [...], "last_pass": {...}}`.

    Orden por `start_local` ascendente. `counts` cuenta solo los visibles de
    cada categoría (las 6, con 0 si no hay) más `inscripciones`. `category`
    fuera de la lista lanza ValueError (la ruta responde 400).

    Addendum inscripciones: los eventos descartados o inscriptos no salen en
    `events` ni en los contadores de categoría. `registered` lista las
    inscripciones a eventos que no terminaron (de todas las categorías, sin
    importar el filtro), por fecha; `counts.inscripciones` es su largo.
    """
    if category is not None and category not in CATEGORIES:
        raise ValueError("categoría inválida: %r" % (category,))
    rows = conn.execute("SELECT * FROM events ORDER BY start_local ASC, id ASC").fetchall()
    urls = _event_urls(conn)

    counts = {c: 0 for c in CATEGORIES}
    out = []
    registered = []
    for row in rows:
        try:
            visible = is_visible(row, now)
            finished = _is_finished(row, now)
            closing_days = timeutil.closing_in_days(row["closing_local"], now)
        except ValueError as exc:
            print("[radar-eventos] evento %s con fecha inválida en listado: %s"
                  % (row["id"], exc), flush=True)
            continue
        status = row["user_status"]
        if status == USER_REGISTERED:
            if not finished:
                registered.append(_event_dict(row, urls, closing_days))
            continue
        if status is not None:
            continue  # descartado: fuera del dashboard
        if visible and row["category"] in counts:
            counts[row["category"]] += 1
        if category is not None and row["category"] != category:
            continue
        if not visible and not include_past:
            continue
        out.append(_event_dict(row, urls, closing_days))
    counts["inscripciones"] = len(registered)
    return {"events": out, "counts": counts, "registered": registered,
            "last_pass": _last_pass(conn)}


def get_event(conn, event_id: int, now: datetime) -> Optional[dict]:
    """Un evento con la forma del listado, o None si no existe."""
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if row is None:
        return None
    try:
        closing_days = timeutil.closing_in_days(row["closing_local"], now)
    except ValueError as exc:
        print("[radar-eventos] evento %s con cierre inválido: %s" % (event_id, exc), flush=True)
        closing_days = None
    return _event_dict(row, _event_urls(conn), closing_days)


def set_user_status(conn, event_id: int, status: Optional[str], now: datetime, *,
                    only_if: Optional[str] = None) -> Optional[dict]:
    """Fija el estado del usuario sobre un evento (addendum inscripciones).

    - `status`: `dismissed`, `registered` o None (vuelve a su solapa).
    - `only_if`: si se da, solo cambia cuando el estado actual es ese (así
      "Ya no voy" no restaura un descartado y viceversa); si no coincide, no
      hace nada y devuelve el evento tal cual.
    - Al descartar o inscribir, `notified_new_at` queda fijado si era nulo:
      el evento no vuelve a contar como nuevo en un push.
    Devuelve el evento (forma del listado) o None si no existe. No hace commit.
    """
    if status is not None and status not in USER_STATUSES:
        raise ValueError("estado de usuario inválido: %r" % (status,))
    row = conn.execute("SELECT user_status FROM events WHERE id = ?", (event_id,)).fetchone()
    if row is None:
        return None
    if only_if is None or row["user_status"] == only_if:
        ts = _iso(now) if status is not None else None
        conn.execute("UPDATE events SET user_status = ?, user_status_at = ? WHERE id = ?",
                     (status, ts, event_id))
        if status is not None:
            conn.execute("UPDATE events SET notified_new_at = ? "
                         "WHERE id = ? AND notified_new_at IS NULL", (ts, event_id))
    return get_event(conn, event_id, now)


def list_dismissed(conn, now: datetime) -> dict:
    """Descartados de eventos que no terminaron, el más reciente primero."""
    rows = conn.execute(
        "SELECT * FROM events WHERE user_status = ? ORDER BY user_status_at DESC, id DESC",
        (USER_DISMISSED,)).fetchall()
    urls = _event_urls(conn)
    out = []
    for row in rows:
        try:
            if _is_finished(row, now):
                continue
            closing_days = timeutil.closing_in_days(row["closing_local"], now)
        except ValueError as exc:
            print("[radar-eventos] descartado %s con fecha inválida: %s" % (row["id"], exc),
                  flush=True)
            continue
        out.append(_event_dict(row, urls, closing_days))
    return {"events": out}
