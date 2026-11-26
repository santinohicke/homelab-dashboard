"""Salud de fuentes, rachas y los 4 push del radar de eventos (R6, R36-R39, A9).

Contrato (plan.md, sección 4):

- `update_health(conn, source, result, now)`: guarda el estado de la fuente en
  `event_source_health` y mantiene la racha (`down` o `zero`) de R39. No hace
  commit: corre dentro de la transacción corta que abre el engine por fuente.
- `run_pushes(ctx, conn, *, seeding, now)`: arma y manda, como mucho, una
  llamada a `ctx.alert_fn` (firma de `dispatch_ha_alert`, A9) por
  `alert_type` y marca como notificado solo lo que salió (el retorno `True`).
  Devuelve `{"new", "closing", "page_changed", "source_health"} -> bool`
  (`True` solo si ese push salió).

Reglas:
- `alert_type`: `event_radar_new`, `event_radar_closing`,
  `event_radar_page_changed` (severidad `info`) y `event_radar_source_health`
  (severidad `warning`).
- Texto en español, sin emojis: título con el total y una línea por ítem
  `dd/mm HH:MM · título · lugar` (sin hora si `has_time=0`), hasta 10 líneas y
  después `y N más`. En el push de cierres la fecha de la línea es la del
  cierre (con hora si el cierre es explícito o el evento tiene hora); en el de
  páginas, la del cambio, con el nombre de la fuente y su URL; en el de salud,
  el inicio de la racha, con el nombre de la fuente y el problema.
- Nuevos: eventos visibles con `notified_new_at` nulo. Los que cierran a 7 días
  o menos (A10: `0 <= closing_in_days <= 7`, con el cierre todavía en el
  futuro) van primero con `[urgente]` y quedan con `notified_new_urgent=1` y
  `notified_closing_at`, así no salen en un push de cierre.
- Cierres: eventos visibles, sin `missing_since`, ya notificados como nuevos,
  con `notified_closing_at` nulo y el cierre en la ventana de 7 días.
- Descartados e inscriptos (`user_status` no nulo) no salen ni como nuevos
  ni como cierres.
- Siembra (R38): un único push de resumen (total por categoría y cuántos cierran
  en 7 días o menos); si sale, marca todo y setea `seeded_at`. Si se descarta,
  nada queda marcado y `seeded_at` sigue nulo (la pasada siguiente vuelve a ser
  siembra). Con 0 eventos pendientes no se manda nada y `seeded_at` sigue nulo.
  En siembra no hay push de cierres ni de páginas.
- Salud (R39): `down` con `error`/`timeout`; `zero` con 0 ítems crudos; un
  resultado con ítems corta la racha. En `page_hash` cualquier código HTTP es
  una observación válida (corta la racha) y solo cuentan los errores de red o
  timeout. `down` alerta a las 24 h; `zero` a las 72 h y solo en las
  agregadoras (`nexa_mcp`, `argentinahackathons_rss`, `condor_nest`,
  `devevents_cfps`) y en `luma_discover` evaluada como grupo (todas las
  keywords activas en racha `zero`, desde la última que entró). `luma_calendar`
  y `meetup` nunca alertan por 0. Una vez por racha (`streak_alerted_at`).
  Fuentes desactivadas o borradas no alertan.
"""

import sqlite3
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from . import timeutil
from .model import SourceResult

ALERT_NEW = "event_radar_new"
ALERT_CLOSING = "event_radar_closing"
ALERT_PAGE_CHANGED = "event_radar_page_changed"
ALERT_SOURCE_HEALTH = "event_radar_source_health"

SEVERITY = {
    ALERT_NEW: "info",
    ALERT_CLOSING: "info",
    ALERT_PAGE_CHANGED: "info",
    ALERT_SOURCE_HEALTH: "warning",
}

MAX_LINES = 10
CLOSING_WINDOW_DAYS = 7
DOWN_ALERT_AFTER = timedelta(hours=24)
ZERO_ALERT_AFTER = timedelta(hours=72)

# Agregadoras que alertan por 0 resultados de forma individual.
ZERO_ALERT_KINDS = ("nexa_mcp", "argentinahackathons_rss", "condor_nest", "devevents_cfps")
# Grupo que alerta por 0 resultados sumando todas sus fuentes.
ZERO_GROUP_KIND = "luma_discover"

CFP_PROVIDER = "devevents"
CFP_KEY_PREFIX = "cfp|"

CATEGORY_LABELS = (
    ("hackatones", "Hackatones"),
    ("charlas_cfps", "Charlas y CFPs"),
    ("meetups", "Meetups"),
    ("afters", "Afters"),
    ("voluntariados", "Voluntariados"),
    ("otros", "Otros"),
)

KIND_LABELS = {
    "luma_discover": "Luma discover",
    "luma_calendar": "calendario Luma",
    "nexa_mcp": "NEXA",
    "argentinahackathons_rss": "Argentina Hackathons",
    "meetup": "Meetup",
    "condor_nest": "Condor Nest",
    "devevents_cfps": "developers.events",
    "page_hash": "página monitoreada",
}

_NO_PLACE = "lugar sin confirmar"


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------

def _iso(now: datetime) -> str:
    return timeutil.format_local(now)


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    """Lee `key` de un `sqlite3.Row` o de un dict sin fallar si falta."""
    if row is None:
        return default
    if isinstance(row, sqlite3.Row):
        return row[key] if key in row.keys() else default
    if isinstance(row, dict):
        return row.get(key, default)
    return getattr(row, key, default)


def _plural(n: int, singular: str, plural: str) -> str:
    return "%d %s" % (n, singular if n == 1 else plural)


def _ddmm(moment: str, with_time: bool) -> str:
    dt = timeutil.parse_local(moment)
    if with_time:
        return dt.strftime("%d/%m %H:%M")
    return dt.strftime("%d/%m")


def format_line(moment: str, with_time: bool, title: str, place: Optional[str]) -> str:
    """`dd/mm HH:MM · título · lugar` (sin hora si `with_time` es falso)."""
    title = " ".join((title or "").split()) or "(sin título)"
    place = " ".join((place or "").split()) or _NO_PLACE
    return "%s · %s · %s" % (_ddmm(moment, with_time), title, place)


def build_message(lines: Sequence[str], max_lines: int = MAX_LINES) -> str:
    """Hasta `max_lines` líneas y después `y N más`."""
    shown = list(lines[:max_lines])
    rest = len(lines) - len(shown)
    if rest > 0:
        shown.append("y %d más" % rest)
    return "\n".join(shown)


def _event_place(row: Any) -> str:
    if _row_get(row, "location_unconfirmed"):
        return _NO_PLACE
    parts: List[str] = []
    for key in ("venue", "city"):
        value = " ".join((_row_get(row, key) or "").split())
        if value and value.lower() not in [p.lower() for p in parts]:
            parts.append(value)
    return ", ".join(parts) if parts else _NO_PLACE


def _is_cfp(row: Any) -> bool:
    return (str(_row_get(row, "dedupe_key") or "").startswith(CFP_KEY_PREFIX)
            or _row_get(row, "best_provider") == CFP_PROVIDER)


def _closing_has_time(row: Any) -> bool:
    return bool(_row_get(row, "closing_explicit")) or bool(_row_get(row, "has_time"))


def closing_open(row: Any, now: datetime) -> bool:
    """El cierre todavía no pasó (con hora: instante; sin hora: hasta el fin del día)."""
    closing = _row_get(row, "closing_local")
    if not closing:
        return False
    if _closing_has_time(row):
        return timeutil.parse_local(closing) > timeutil.to_ar(now)
    return timeutil.closing_in_days(closing, now) >= 0


def closes_soon(row: Any, now: datetime) -> bool:
    """A10: `0 <= closing_in_days <= 7` y el cierre todavía en el futuro."""
    closing = _row_get(row, "closing_local")
    if not closing:
        return False
    days = timeutil.closing_in_days(closing, now)
    return 0 <= days <= CLOSING_WINDOW_DAYS and closing_open(row, now)


def is_visible(row: Any, now: datetime) -> bool:
    """R27: misma regla que el dashboard (store.is_visible), para que un evento
    visible en la API también pueda salir en un push."""
    from . import store  # import tardío: store no depende de alerts
    return store.is_visible(row, now)


def _get_state(conn: sqlite3.Connection, key: str) -> Optional[str]:
    row = conn.execute("SELECT value FROM event_radar_state WHERE key = ?", (key,)).fetchone()
    return None if row is None else row[0]


def _set_state(conn: sqlite3.Connection, key: str, value: Optional[str]) -> None:
    conn.execute(
        "INSERT INTO event_radar_state (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )


def is_seeding(conn: sqlite3.Connection) -> bool:
    """La siembra está pendiente mientras `seeded_at` sea nulo (R38)."""
    return not _get_state(conn, "seeded_at")


# --------------------------------------------------------------------------
# Salud y rachas (R6, R39)
# --------------------------------------------------------------------------

def _classify(kind: str, result: SourceResult) -> str:
    """`down`, `zero` u `ok` según R39."""
    page = result.page
    if kind == "page_hash":
        if page is not None and page.http_status is not None and not page.error:
            return "ok"   # cualquier código HTTP es una observación válida
        return "down"     # sin código HTTP: error de red o timeout
    if result.status in ("error", "timeout"):
        return "down"
    if result.status == "zero" or int(result.raw_count or 0) == 0:
        return "zero"
    return "ok"


def update_health(conn: sqlite3.Connection, source: Any, result: SourceResult,
                  now: datetime) -> None:
    """Guarda el estado de la fuente y su racha. No hace commit."""
    source_id = int(_row_get(source, "id"))
    kind = str(_row_get(source, "kind") or "")
    ts = _iso(now)
    verdict = _classify(kind, result)

    status = result.status
    if kind == "page_hash" and verdict == "ok" and status in ("error", "timeout", "zero"):
        status = "ok"   # un 404 sostenido no es una fuente caída
    last_error = result.error if verdict == "down" else None
    if verdict == "down" and not last_error and result.page is not None:
        last_error = result.page.error

    prev = conn.execute(
        "SELECT streak_kind, streak_started_at, streak_alerted_at, last_ok_at "
        "FROM event_source_health WHERE source_id = ?", (source_id,)).fetchone()
    prev_kind = prev["streak_kind"] if prev is not None else None
    prev_started = prev["streak_started_at"] if prev is not None else None
    prev_alerted = prev["streak_alerted_at"] if prev is not None else None
    last_ok_at = prev["last_ok_at"] if prev is not None else None

    if verdict == "ok":
        streak_kind = streak_started = streak_alerted = None
    elif verdict == prev_kind and prev_started:
        streak_kind, streak_started, streak_alerted = prev_kind, prev_started, prev_alerted
    else:
        streak_kind, streak_started, streak_alerted = verdict, ts, None
    if verdict != "down":
        last_ok_at = ts

    conn.execute(
        """INSERT INTO event_source_health (
               source_id, last_run_at, last_status, last_count, last_error, last_ok_at,
               last_duration_s, streak_kind, streak_started_at, streak_alerted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(source_id) DO UPDATE SET
               last_run_at = excluded.last_run_at,
               last_status = excluded.last_status,
               last_count = excluded.last_count,
               last_error = excluded.last_error,
               last_ok_at = excluded.last_ok_at,
               last_duration_s = excluded.last_duration_s,
               streak_kind = excluded.streak_kind,
               streak_started_at = excluded.streak_started_at,
               streak_alerted_at = excluded.streak_alerted_at""",
        (source_id, ts, status, int(result.raw_count or 0), last_error, last_ok_at,
         float(result.duration_s or 0.0), streak_kind, streak_started, streak_alerted),
    )


def _health_items(conn: sqlite3.Connection, now: datetime) -> Tuple[List[str], List[int]]:
    """Líneas del push de salud y los `source_id` a marcar si sale."""
    now_ar = timeutil.to_ar(now)
    rows = conn.execute(
        """SELECT s.id, s.kind, s.name, h.streak_kind, h.streak_started_at,
                  h.streak_alerted_at, h.last_error, h.last_status
           FROM event_sources s JOIN event_source_health h ON h.source_id = s.id
           WHERE s.enabled = 1 AND h.streak_kind IS NOT NULL
             AND h.streak_started_at IS NOT NULL
           ORDER BY h.streak_started_at, s.id""").fetchall()

    items: List[Tuple[str, str]] = []   # (inicio de racha, línea)
    to_mark: List[int] = []
    for r in rows:
        if r["kind"] == ZERO_GROUP_KIND and r["streak_kind"] == "zero":
            continue   # se evalúa como grupo
        if r["streak_alerted_at"]:
            continue
        started = timeutil.parse_local(r["streak_started_at"])
        age = now_ar - started
        if r["streak_kind"] == "down" and age >= DOWN_ALERT_AFTER:
            detail = "caída: %s" % (r["last_error"] or r["last_status"] or "error")
        elif (r["streak_kind"] == "zero" and r["kind"] in ZERO_ALERT_KINDS
              and age >= ZERO_ALERT_AFTER):
            detail = "0 resultados"
        else:
            continue
        name = "%s (%s)" % (r["name"], KIND_LABELS.get(r["kind"], r["kind"]))
        items.append((r["streak_started_at"],
                      format_line(r["streak_started_at"], True, name, detail)))
        to_mark.append(int(r["id"]))

    group = conn.execute(
        """SELECT s.id, h.streak_kind, h.streak_started_at, h.streak_alerted_at
           FROM event_sources s LEFT JOIN event_source_health h ON h.source_id = s.id
           WHERE s.enabled = 1 AND s.kind = ?""", (ZERO_GROUP_KIND,)).fetchall()
    if group and all(g["streak_kind"] == "zero" and g["streak_started_at"] for g in group):
        starts = [timeutil.parse_local(g["streak_started_at"]) for g in group]
        group_start = max(starts)
        alerted = [timeutil.parse_local(g["streak_alerted_at"]) for g in group
                   if g["streak_alerted_at"]]
        already = any(a >= group_start for a in alerted)
        if not already and now_ar - group_start >= ZERO_ALERT_AFTER:
            start_iso = timeutil.format_local(group_start)
            name = "%s (%s)" % (KIND_LABELS[ZERO_GROUP_KIND],
                                _plural(len(group), "keyword", "keywords"))
            items.append((start_iso, format_line(start_iso, True, name, "0 resultados")))
            to_mark.extend(int(g["id"]) for g in group)

    items.sort(key=lambda it: timeutil.parse_local(it[0]))
    return [line for _, line in items], to_mark


# --------------------------------------------------------------------------
# Push
# --------------------------------------------------------------------------

def _send(ctx: Any, alert_type: str, title: str, message: str, count: int) -> bool:
    """Llama a `ctx.alert_fn`; `True` solo si el push salió (A9)."""
    try:
        sent = ctx.alert_fn(title, message, alert_type=alert_type,
                            severity=SEVERITY[alert_type], metric_val=float(count))
    except Exception as exc:  # el push falló: los ítems quedan pendientes (R39)
        ctx.log("[radar-eventos] push %s: error %s: %s; queda pendiente"
                % (alert_type, type(exc).__name__, exc))
        return False
    if not sent:
        ctx.log("[radar-eventos] push %s descartado (cooldown); %s pendiente"
                % (alert_type, _plural(count, "ítem queda", "ítems quedan")))
        return False
    ctx.log("[radar-eventos] push %s enviado (%s)"
            % (alert_type, _plural(count, "ítem", "ítems")))
    return True


def _pending_events(conn: sqlite3.Connection, now: datetime) -> List[sqlite3.Row]:
    rows = conn.execute(
        "SELECT * FROM events WHERE notified_new_at IS NULL AND user_status IS NULL "
        "ORDER BY start_local, id"
    ).fetchall()
    return [r for r in rows if is_visible(r, now)]


def _push_seed(ctx: Any, conn: sqlite3.Connection, now: datetime) -> bool:
    pending = conn.execute(
        "SELECT * FROM events WHERE notified_new_at IS NULL ORDER BY start_local, id"
    ).fetchall()
    visible = [r for r in pending if is_visible(r, now)]
    if not visible:
        ctx.log("[radar-eventos] siembra: sin eventos todavía; se reintenta en la próxima pasada")
        return False
    soon = [r for r in visible if closes_soon(r, now)]
    counts: Dict[str, int] = {}
    for r in visible:
        counts[r["category"]] = counts.get(r["category"], 0) + 1

    total = len(visible)
    title = "Radar Eventos: siembra inicial con %s" % _plural(total, "evento", "eventos")
    lines = ["%s en total, por categoría:" % _plural(total, "evento", "eventos")]
    for cat, label in CATEGORY_LABELS:
        lines.append("%s: %d" % (label, counts.get(cat, 0)))
    lines.append("Cierran en 7 días o menos: %d" % len(soon))
    if not _send(ctx, ALERT_NEW, title, "\n".join(lines), total):
        return False

    ts = _iso(now)
    soon_ids = {int(r["id"]) for r in soon}
    for r in pending:
        conn.execute("UPDATE events SET notified_new_at = ? WHERE id = ? "
                     "AND notified_new_at IS NULL", (ts, r["id"]))
    for event_id in soon_ids:
        conn.execute("UPDATE events SET notified_closing_at = ? WHERE id = ? "
                     "AND notified_closing_at IS NULL", (ts, event_id))
    _set_state(conn, "seeded_at", ts)
    conn.commit()
    return True


def _push_new(ctx: Any, conn: sqlite3.Connection, now: datetime) -> bool:
    pending = _pending_events(conn, now)
    if not pending:
        return False
    urgent = [r for r in pending if closes_soon(r, now)]
    urgent_ids = {int(r["id"]) for r in urgent}
    normal = [r for r in pending if int(r["id"]) not in urgent_ids]

    lines = ["[urgente] " + format_line(r["start_local"], bool(r["has_time"]), r["title"],
                                        _event_place(r)) for r in urgent]
    lines += [format_line(r["start_local"], bool(r["has_time"]), r["title"], _event_place(r))
              for r in normal]
    total = len(pending)
    title = "Radar Eventos: %s" % _plural(total, "evento nuevo", "eventos nuevos")
    if not _send(ctx, ALERT_NEW, title, build_message(lines), total):
        return False

    ts = _iso(now)
    for r in pending:
        if int(r["id"]) in urgent_ids:
            conn.execute(
                "UPDATE events SET notified_new_at = ?, notified_new_urgent = 1, "
                "notified_closing_at = COALESCE(notified_closing_at, ?) WHERE id = ?",
                (ts, ts, r["id"]))
        else:
            conn.execute("UPDATE events SET notified_new_at = ? WHERE id = ?", (ts, r["id"]))
    conn.commit()
    return True


def _push_closing(ctx: Any, conn: sqlite3.Connection, now: datetime) -> bool:
    rows = conn.execute(
        """SELECT * FROM events
           WHERE notified_new_at IS NOT NULL AND notified_closing_at IS NULL
             AND missing_since IS NULL AND user_status IS NULL
           ORDER BY closing_local, id""").fetchall()
    items = [r for r in rows if is_visible(r, now) and closes_soon(r, now)]
    if not items:
        return False
    lines = [format_line(r["closing_local"], _closing_has_time(r), r["title"], _event_place(r))
             for r in items]
    total = len(items)
    title = "Radar Eventos: %s" % _plural(total, "cierre en 7 días o menos",
                                          "cierres en 7 días o menos")
    if not _send(ctx, ALERT_CLOSING, title, build_message(lines), total):
        return False
    ts = _iso(now)
    for r in items:
        conn.execute("UPDATE events SET notified_closing_at = ? WHERE id = ?", (ts, r["id"]))
    conn.commit()
    return True


def _push_pages(ctx: Any, conn: sqlite3.Connection, now: datetime) -> bool:
    rows = conn.execute(
        """SELECT s.id, s.name, s.url, p.last_changed_at, p.last_http_status
           FROM event_page_hashes p JOIN event_sources s ON s.id = p.source_id
           WHERE s.enabled = 1 AND p.last_changed_at IS NOT NULL
             AND (p.change_notified_at IS NULL OR p.change_notified_at < p.last_changed_at)
           ORDER BY p.last_changed_at, s.id""").fetchall()
    if not rows:
        return False
    lines = []
    for r in rows:
        place = r["url"]
        if r["last_http_status"] is not None:
            place = "%s (HTTP %d)" % (place, int(r["last_http_status"]))
        lines.append(format_line(r["last_changed_at"], True, r["name"], place))
    total = len(rows)
    title = "Radar Eventos: %s" % _plural(total, "página cambió", "páginas cambiaron")
    if not _send(ctx, ALERT_PAGE_CHANGED, title, build_message(lines), total):
        return False
    ts = _iso(now)
    for r in rows:
        conn.execute("UPDATE event_page_hashes SET change_notified_at = ? WHERE source_id = ?",
                     (ts, r["id"]))
    conn.commit()
    return True


def _push_health(ctx: Any, conn: sqlite3.Connection, now: datetime) -> bool:
    lines, to_mark = _health_items(conn, now)
    if not lines:
        return False
    total = len(lines)
    title = "Radar Eventos: %s" % _plural(total, "fuente con problemas",
                                          "fuentes con problemas")
    if not _send(ctx, ALERT_SOURCE_HEALTH, title, build_message(lines), total):
        return False
    ts = _iso(now)
    for source_id in to_mark:
        conn.execute("UPDATE event_source_health SET streak_alerted_at = ? WHERE source_id = ?",
                     (ts, source_id))
    conn.commit()
    return True


def run_pushes(ctx: Any, conn: sqlite3.Connection, *, seeding: bool,
               now: datetime) -> Dict[str, bool]:
    """Manda los push de la pasada; `True` en cada clave solo si ese push salió."""
    conn.commit()   # ninguna transacción abierta mientras se llama a alert_fn
    result = {"new": False, "closing": False, "page_changed": False, "source_health": False}
    steps: List[Tuple[str, Callable[[Any, sqlite3.Connection, datetime], bool]]]
    if seeding:
        steps = [("new", _push_seed)]
    else:
        steps = [("new", _push_new), ("closing", _push_closing), ("page_changed", _push_pages)]
    steps.append(("source_health", _push_health))
    for key, step in steps:
        try:
            result[key] = step(ctx, conn, now)
        except Exception as exc:  # un push roto no frena a los demás
            conn.rollback()
            ctx.log("[radar-eventos] push %s: error %s: %s" % (key, type(exc).__name__, exc))
            result[key] = False
    return result
