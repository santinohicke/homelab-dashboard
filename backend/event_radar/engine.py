"""Motor del radar de eventos: pasada, lock, hilo daemon y resumen (B8).

Requisitos: R26 (orquestación de bajas), R28, R29, R32, R33, R34, R35, R38,
R45, A3 y A12. Contrato (plan.md, sección 4):

    configure(db_path, alert_fn, log=None) -> RadarContext
    default_context() -> RadarContext | None
    run_pass(ctx, trigger) -> dict        # {"running": True} si ya hay una
    try_start_manual(ctx) -> bool         # True: arrancó en un hilo; False: 409
    status(ctx) -> dict                   # R45
    start_daemon(ctx=None) -> threading.Thread

Reglas:
- Un solo lock del módulo (`_pass_lock`, `threading.Lock`): una pasada
  manual y una automática nunca se superponen. `try_start_manual` toma el
  lock en el hilo que llama (sin carrera entre consultar y arrancar) y el
  hilo de la pasada lo libera en `finally`.
- Orden de fuentes: MVD primero y Fase 2 después (R34). Cada fuente corre
  dentro de su propio `try/except` y deja exactamente una línea
  `[radar-eventos] #<id> <kind> "<name>": ...` (R32). Una falla de una fuente
  (también de Fase 2) nunca frena a las siguientes ni a los push.
- Red sin transacción abierta: por fuente, primero robots + handler +
  `normalize.apply` en memoria, después una transacción corta (upsert, hash
  de página, salud) y `commit`. Si una escritura falla: `rollback` (nunca
  `commit`) y la fuente queda `error`.
- Tope de 15 min por fuente (R29): `deadline = monotonic() + 900` que se
  pasa al handler; lo ya procesado se guarda aunque la fuente termine en
  `timeout`.
- robots.txt (A3): el engine lo consulta para la URL de cada fuente antes del
  handler. Si prohíbe, la fuente queda `error` con `last_error='robots.txt'`
  y se desactiva (`enabled=0`, `disabled_reason='robots.txt'`).
- `net.DuplicateRequest` (o una `page_hash` sin observación por URL ya
  pedida) es "sin datos": ni `ok` ni `zero`; no toca la salud ni marca bajas.
- Al final: `store.mark_missing` (grupos de `store.source_group`),
  `store.update_candidates`, `alerts.run_pushes` (siembra si `seeded_at` es
  nulo), `last_pass_*` con el JSON de A12, línea de fin, `end_pass()` y
  `gc.collect()` (R35).

Solo stdlib, compatible con Python 3.10.
"""

import gc
import inspect
import json
import random
import re
import threading
import time
import traceback
from typing import Any, Callable, Dict, List, Optional, Set

from . import alerts, net, normalize, schema, sources_fase2, sources_mvd, store, timeutil
from .context import RadarContext, connect
from .model import Event, SourceResult

LOG_PREFIX = "[radar-eventos]"
SOURCE_DEADLINE_S = 15 * 60          # R29: tope total por fuente y pasada
FIRST_PASS_MIN_S = 300               # R28: primera pasada entre 5 y 10 min
FIRST_PASS_MAX_S = 600
PASS_INTERVAL_S = 6 * 3600           # R28: una pasada cada 6 h
THREAD_NAME = "event-radar"
MANUAL_THREAD_NAME = "event-radar-manual"

TRIGGER_AUTO = "auto"
TRIGGER_MANUAL = "manual"

ROBOTS_REASON = "robots.txt"

STATUS_KEYS = ("ok", "zero", "error", "timeout")

_pass_lock = threading.Lock()
_default_ctx: Optional[RadarContext] = None
_robots_kwargs_cache: Dict[type, bool] = {}

_TYPED_ERROR_RE = re.compile(r"^[A-Za-z_][\w.]*: ")


# --------------------------------------------------------------------------
# Contexto
# --------------------------------------------------------------------------


def _print_log(line: str) -> None:
    print(line, flush=True)


def configure(db_path: str, alert_fn: Callable[..., bool],
              log: Optional[Callable[[str], None]] = None) -> RadarContext:
    """Arma el `RadarContext` de producción y lo deja como contexto por
    defecto. No arranca hilos ni hace red (R52)."""
    global _default_ctx
    log_fn = log or _print_log
    fetcher = net.Fetcher(monotonic=time.monotonic, sleep=time.sleep, log=log_fn)
    ctx = RadarContext(
        db_path=db_path,
        alert_fn=alert_fn,
        fetcher=fetcher,
        now=timeutil.now_ar,
        monotonic=time.monotonic,
        sleep=time.sleep,
        log=log_fn,
        rng=random.Random(),
    )
    _default_ctx = ctx
    return ctx


def default_context() -> Optional[RadarContext]:
    """El contexto de `configure` (None si el radar no se configuró)."""
    return _default_ctx


def is_running() -> bool:
    return _pass_lock.locked()


# --------------------------------------------------------------------------
# Lock y disparadores
# --------------------------------------------------------------------------


def run_pass(ctx: RadarContext, trigger: str = TRIGGER_AUTO) -> dict:
    """Corre una pasada completa si el lock está libre (R28).

    Devuelve el resumen de A12, o `{"running": True}` si ya había una pasada
    en curso (la automática se saltea y se loguea).
    """
    if not _pass_lock.acquire(blocking=False):
        if trigger == TRIGGER_AUTO:
            ctx.log("%s pasada automática salteada: hay otra en curso" % LOG_PREFIX)
        else:
            ctx.log("%s pasada %s rechazada: hay otra en curso" % (LOG_PREFIX, trigger))
        return {"running": True}
    try:
        return _run_pass_locked(ctx, trigger)
    finally:
        _pass_lock.release()


def try_start_manual(ctx: RadarContext) -> bool:
    """R45: arranca una pasada manual en un hilo daemon y vuelve enseguida.

    True si arrancó (202); False si ya hay una en curso (409).
    """
    if not _pass_lock.acquire(blocking=False):
        return False

    def worker() -> None:
        try:
            _run_pass_locked(ctx, TRIGGER_MANUAL)
        except Exception as exc:   # _run_pass_locked ya protege; esto es la última red
            ctx.log("%s pasada manual: error %s: %s\n%s"
                    % (LOG_PREFIX, type(exc).__name__, exc, traceback.format_exc()))
        finally:
            _pass_lock.release()

    try:
        thread = threading.Thread(target=worker, name=MANUAL_THREAD_NAME, daemon=True)
        thread.start()
    except Exception as exc:
        _pass_lock.release()
        ctx.log("%s pasada manual: no se pudo arrancar el hilo: %s: %s"
                % (LOG_PREFIX, type(exc).__name__, exc))
        raise
    return True


def status(ctx: RadarContext) -> dict:
    """R45: `{running, last_pass_started_at, last_pass_finished_at,
    last_pass_summary}` (el resumen ya decodificado, o None)."""
    conn = connect(ctx)
    try:
        started = store.get_state(conn, "last_pass_started_at")
        finished = store.get_state(conn, "last_pass_finished_at")
        raw = store.get_state(conn, "last_pass_summary")
    finally:
        conn.close()
    summary = None
    if raw:
        try:
            summary = json.loads(raw)
        except ValueError as exc:
            ctx.log("%s last_pass_summary inválido en la base: %s" % (LOG_PREFIX, exc))
    return {
        "running": _pass_lock.locked(),
        "last_pass_started_at": started,
        "last_pass_finished_at": finished,
        "last_pass_summary": summary,
    }


# --------------------------------------------------------------------------
# Hilo daemon (R28)
# --------------------------------------------------------------------------


def _daemon_loop(ctx: RadarContext, stop_event: Optional[threading.Event] = None,
                 max_passes: Optional[int] = None) -> None:
    """Primera pasada entre 300 y 600 s tras el arranque y después una cada
    6 h medidas desde el inicio de la anterior. Nunca muere por una
    excepción de una pasada. `stop_event` y `max_passes` son para tests."""
    passes = 0
    try:
        first = ctx.rng.uniform(FIRST_PASS_MIN_S, FIRST_PASS_MAX_S)
        ctx.log("%s listo; primera pasada en %d s" % (LOG_PREFIX, int(round(first))))
        ctx.sleep(first)
    except Exception as exc:
        ctx.log("%s hilo daemon: error antes de la primera pasada: %s: %s\n%s"
                % (LOG_PREFIX, type(exc).__name__, exc, traceback.format_exc()))
    while stop_event is None or not stop_event.is_set():
        started = ctx.monotonic()
        try:
            run_pass(ctx, TRIGGER_AUTO)
        except Exception as exc:
            ctx.log("%s hilo daemon: error en la pasada: %s: %s\n%s"
                    % (LOG_PREFIX, type(exc).__name__, exc, traceback.format_exc()))
        passes += 1
        if max_passes is not None and passes >= max_passes:
            return
        if stop_event is not None and stop_event.is_set():
            return
        try:
            ctx.sleep(max(0.0, started + PASS_INTERVAL_S - ctx.monotonic()))
        except Exception as exc:
            ctx.log("%s hilo daemon: error al esperar la próxima pasada: %s: %s"
                    % (LOG_PREFIX, type(exc).__name__, exc))
            time.sleep(60)   # evita un loop caliente si el sleep inyectado falla


def start_daemon(ctx: Optional[RadarContext] = None, *,
                 stop_event: Optional[threading.Event] = None,
                 max_passes: Optional[int] = None) -> threading.Thread:
    """Arranca el hilo daemon `event-radar` (R28) con `ctx` o el de
    `configure`."""
    ctx = ctx if ctx is not None else _default_ctx
    if ctx is None:
        raise RuntimeError("radar de eventos sin configurar: llamá a engine.configure()")
    thread = threading.Thread(target=_daemon_loop, args=(ctx, stop_event, max_passes),
                              name=THREAD_NAME, daemon=True)
    thread.start()
    return thread


# --------------------------------------------------------------------------
# Pasada
# --------------------------------------------------------------------------


class _PassAcc:
    """Acumulador de una pasada."""

    def __init__(self) -> None:
        self.counts: Dict[str, int] = {k: 0 for k in STATUS_KEYS}
        self.outcomes: Dict[int, str] = {}
        self.seen_by_group: Dict[str, Set[int]] = {}
        self.new_ids: Set[int] = set()
        self.updated_ids: Set[int] = set()
        self.discover_events: List[Event] = []
        self.no_data = 0


def _handler_for(kind: str) -> Optional[Callable[..., SourceResult]]:
    handler = sources_mvd.HANDLERS.get(kind)
    if handler is None:
        handler = sources_fase2.HANDLERS.get(kind)
    return handler


def _kind_order(kind: str) -> int:
    if kind in schema.MVD_KINDS:
        return 0
    if kind in schema.FASE2_KINDS:
        return 1
    return 2


def _load_sources(conn) -> list:
    rows = conn.execute("SELECT * FROM event_sources WHERE enabled = 1 ORDER BY id").fetchall()
    return sorted(rows, key=lambda r: (_kind_order(r["kind"] or ""), r["id"]))


def _label(row: Any) -> str:
    return '%s #%d %s "%s"' % (LOG_PREFIX, row["id"], row["kind"], row["name"])


def _fmt_s(seconds: float) -> str:
    return ("%.1f" % max(0.0, seconds)).rstrip("0").rstrip(".") or "0"


def _robots_allowed(fetcher: Any, url: str, kind: str, deadline: float) -> bool:
    """`fetcher.robots_allowed` con `kind` y `deadline` si los acepta (el
    `net.Fetcher` real sí; un doble puede aceptar solo la URL)."""
    cls = type(fetcher)
    accepts = _robots_kwargs_cache.get(cls)
    if accepts is None:
        try:
            params = inspect.signature(fetcher.robots_allowed).parameters
            accepts = "kind" in params and "deadline" in params
        except (TypeError, ValueError) as exc:
            print("%s robots_allowed sin firma inspeccionable (%s); uso solo la URL"
                  % (LOG_PREFIX, exc), flush=True)
            accepts = False
        _robots_kwargs_cache[cls] = accepts
    if accepts:
        return fetcher.robots_allowed(url, kind=kind, deadline=deadline)
    return fetcher.robots_allowed(url)


def _source_exists(conn, source_id: int) -> bool:
    return conn.execute("SELECT 1 FROM event_sources WHERE id = ?",
                        (source_id,)).fetchone() is not None


def _source_timeout(row: Any) -> float:
    try:
        return float(sources_fase2.source_timeout(row))
    except Exception as exc:
        print("%s timeout de la fuente #%s ilegible (%s); uso %s s"
              % (LOG_PREFIX, row["id"], exc, sources_mvd.DEFAULT_TIMEOUT), flush=True)
        return float(sources_mvd.DEFAULT_TIMEOUT)


def _error_text(err: Optional[str]) -> str:
    err = (err or "sin detalle").strip()
    if _TYPED_ERROR_RE.match(err):
        return err
    return "Error: %s" % err


def _discards_text(discards: Dict[str, int]) -> str:
    total = sum(discards.values())
    if not total:
        return ""
    parts = ", ".join("%d %s" % (n, reason) for reason, n in
                      sorted(discards.items(), key=lambda kv: (-kv[1], kv[0])))
    return " (%d descartado%s: %s)" % (total, "" if total == 1 else "s", parts)


def _disable_for_robots(ctx: RadarContext, conn, row: Any, url: str, now) -> None:
    """A3: fuente `error` con `last_error='robots.txt'` y desactivada."""
    result = SourceResult(status="error", raw_count=0, events=[], error=ROBOTS_REASON)
    try:
        conn.execute(
            "UPDATE event_sources SET enabled = 0, disabled_reason = ?, updated_at = ? "
            "WHERE id = ?", (ROBOTS_REASON, timeutil.format_local(now), row["id"]))
        if _source_exists(conn, row["id"]):
            alerts.update_health(conn, row, result, now)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        ctx.log("%s robots.txt: no se pudo desactivar la fuente %s: %s: %s"
                % (LOG_PREFIX, row["id"], type(exc).__name__, exc))
        raise


def _run_source(ctx: RadarContext, conn, row: Any, acc: _PassAcc) -> None:
    """Corre una fuente y deja exactamente una línea `#` en el log (R32)."""
    sid = int(row["id"])
    kind = row["kind"] or ""
    label = _label(row)
    t0 = ctx.monotonic()
    deadline = t0 + SOURCE_DEADLINE_S
    deadline_hit = False
    result: Optional[SourceResult] = None

    # 1) Red y parseo, sin transacción abierta.
    try:
        handler = _handler_for(kind)
        if handler is None:
            raise ValueError("tipo de fuente desconocido: %r" % kind)
        url = row["url"]
        if not _robots_allowed(ctx.fetcher, url, kind, deadline):
            raise net.RobotsDisallowed("robots.txt prohíbe %s" % url)
        result = handler(ctx, row, deadline)
        if not isinstance(result, SourceResult):
            raise TypeError("el handler de %s devolvió %s" % (kind, type(result).__name__))
    except net.RobotsDisallowed as exc:
        now = ctx.now()
        try:
            _disable_for_robots(ctx, conn, row, row["url"], now)
        except Exception as wexc:
            acc.counts["error"] += 1
            ctx.log("%s: error %s: %s (robots.txt prohíbe; no se pudo desactivar)"
                    % (label, type(wexc).__name__, wexc))
            return
        acc.counts["error"] += 1
        acc.outcomes[sid] = "error"
        ctx.log("%s: error robots.txt: %s; fuente desactivada" % (label, exc))
        return
    except net.DuplicateRequest as exc:
        acc.no_data += 1
        ctx.log("%s: sin datos (URL ya pedida en esta pasada: %s)" % (label, exc))
        return
    except net.SourceDeadline as exc:   # antes que FetchTimeout: hereda de él
        deadline_hit = True
        result = SourceResult(status="timeout", raw_count=0, events=[],
                              error="%s: %s" % (type(exc).__name__, exc))
    except net.FetchTimeout as exc:
        result = SourceResult(status="timeout", raw_count=0, events=[],
                              error="%s: %s" % (type(exc).__name__, exc))
    except Exception as exc:
        result = SourceResult(status="error", raw_count=0, events=[],
                              error="%s: %s" % (type(exc).__name__, exc))

    if kind == sources_fase2.PAGE_KIND and result.page is None \
            and result.status not in ("error", "timeout"):
        # page_hash sin observación (URL ya pedida en la pasada): sin datos.
        acc.no_data += 1
        ctx.log("%s: sin datos (%s)" % (label, result.error or "sin observación"))
        return

    result.duration_s = max(float(result.duration_s or 0.0), ctx.monotonic() - t0)
    if result.status == "timeout" and (ctx.monotonic() >= deadline
                                       or "SourceDeadline" in (result.error or "")):
        deadline_hit = True

    # 2) Normalización en memoria.
    now = ctx.now()
    events: List[Event] = []
    discards: Dict[str, int] = {}
    for raw in result.events or []:
        try:
            ev, reason = normalize.apply(raw, row, now)
        except Exception as exc:
            reason = "error al normalizar"
            ev = None
            ctx.log("%s %s \"%s\": evento %r descartado: %s: %s"
                    % (LOG_PREFIX, kind, row["name"], getattr(raw, "origin_id", None),
                       type(exc).__name__, exc))
        if ev is None:
            discards[reason or "sin motivo"] = discards.get(reason or "sin motivo", 0) + 1
        else:
            events.append(ev)

    # 3) Transacción corta de escritura.
    page_outcome = None
    stats = store.UpsertStats()
    try:
        if kind == sources_fase2.PAGE_KIND and result.page is not None:
            page_outcome = store.record_page_observation(conn, sid, result.page, now)
        if events:
            stats = store.upsert_events(conn, sid, events, now)
        if _source_exists(conn, sid):
            alerts.update_health(conn, row, result, now)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        acc.counts["error"] += 1
        acc.outcomes[sid] = "error"
        ctx.log("%s: error %s: %s (no se guardó nada de la fuente)"
                % (label, type(exc).__name__, exc))
        return

    status_ = result.status if result.status in STATUS_KEYS else "error"
    if kind == sources_fase2.PAGE_KIND and page_outcome in (
            store.PAGE_BASELINE, store.PAGE_CHANGED, store.PAGE_UNCHANGED):
        status_ = "ok"   # cualquier código HTTP es una observación válida (R39)
    acc.counts[status_] += 1
    acc.outcomes[sid] = status_
    group = store.source_group(kind, sid)
    acc.seen_by_group.setdefault(group, set()).update(stats.seen_ids)
    acc.new_ids.update(stats.new_ids)
    acc.updated_ids.update(stats.updated_ids)
    if kind == store.DISCOVER_KIND:
        acc.discover_events.extend(events)

    # 4) Una línea de log por fuente (R32).
    ctx.log(label + ": " + _source_line(result, status_, page_outcome, len(events),
                                        discards, row, deadline_hit))


def _source_line(result: SourceResult, status_: str, page_outcome: Optional[str],
                 saved: int, discards: Dict[str, int], row: Any, deadline_hit: bool) -> str:
    if page_outcome is not None and result.page is not None \
            and result.page.http_status is not None:
        code = result.page.http_status
        if page_outcome == store.PAGE_BASELINE:
            return "línea base HTTP %d" % code
        if page_outcome == store.PAGE_CHANGED:
            return "cambió HTTP %d" % code
        if page_outcome == store.PAGE_UNCHANGED:
            return "sin cambios HTTP %d" % code
    if status_ == "timeout":
        limit = SOURCE_DEADLINE_S if deadline_hit else _source_timeout(row)
        line = "sin respuesta (timeout %s s)" % _fmt_s(limit)
        if saved:
            line += " (%d evento%s parcial%s guardado%s)" % (
                saved, "" if saved == 1 else "s", "" if saved == 1 else "es",
                "" if saved == 1 else "s")
        return line
    if status_ == "error":
        line = "error %s" % _error_text(result.error)
        if saved:
            line += " (%d evento%s parcial%s guardado%s)" % (
                saved, "" if saved == 1 else "s", "" if saved == 1 else "es",
                "" if saved == 1 else "s")
        return line
    if status_ == "zero" or not result.raw_count:
        return "0 resultados"
    line = "ok %d eventos (%d en AMBA) en %s s" % (result.raw_count, saved,
                                                   _fmt_s(result.duration_s))
    line += _discards_text(discards)
    if result.error:
        line += " (aviso: %s)" % result.error
    return line


def _final_step(ctx: RadarContext, conn, name: str, fn: Callable[[], Any], default: Any) -> Any:
    """Paso final protegido: si falla, rollback y log; la pasada sigue."""
    try:
        value = fn()
        conn.commit()
        return value
    except Exception as exc:
        try:
            conn.rollback()
        except Exception as rexc:
            ctx.log("%s %s: rollback falló: %s: %s"
                    % (LOG_PREFIX, name, type(rexc).__name__, rexc))
        ctx.log("%s %s: error %s: %s" % (LOG_PREFIX, name, type(exc).__name__, exc))
        return default


def _run_pass_locked(ctx: RadarContext, trigger: str) -> dict:
    """Cuerpo de la pasada; el llamador ya tiene el lock."""
    t0 = ctx.monotonic()
    started_iso = timeutil.format_local(ctx.now())
    acc = _PassAcc()
    pushes = {"new": False, "closing": False, "page_changed": False, "source_health": False}
    missing = 0
    conn = None
    aborted: Optional[str] = None
    try:
        ctx.fetcher.begin_pass()
        conn = connect(ctx)
        store.set_state(conn, "last_pass_started_at", started_iso)
        conn.commit()
        sources = _load_sources(conn)
        ctx.log("%s pasada iniciada %s (%s, %d fuentes)"
                % (LOG_PREFIX, started_iso, trigger, len(sources)))

        for row in sources:
            try:
                _run_source(ctx, conn, row, acc)
            except Exception as exc:   # última red: _run_source ya protege cada paso
                try:
                    conn.rollback()
                except Exception as rexc:
                    ctx.log("%s rollback falló tras la fuente #%s: %s: %s"
                            % (LOG_PREFIX, row["id"], type(rexc).__name__, rexc))
                acc.counts["error"] += 1
                acc.outcomes[int(row["id"])] = "error"
                ctx.log("%s: error %s: %s" % (_label(row), type(exc).__name__, exc))

        now = ctx.now()
        missing = _final_step(ctx, conn, "bajas",
                              lambda: store.mark_missing(conn, acc.outcomes,
                                                         acc.seen_by_group, now), 0)
        _final_step(ctx, conn, "candidatos",
                    lambda: store.update_candidates(conn, acc.discover_events, now), None)
        seeding = _final_step(ctx, conn, "siembra", lambda: alerts.is_seeding(conn), False)
        pushes = _final_step(ctx, conn, "push",
                             lambda: alerts.run_pushes(ctx, conn, seeding=seeding,
                                                       now=ctx.now()), pushes)
    except Exception as exc:
        aborted = "%s: %s" % (type(exc).__name__, exc)
        ctx.log("%s pasada abortada: %s\n%s" % (LOG_PREFIX, aborted, traceback.format_exc()))
        if conn is not None:
            try:
                conn.rollback()
            except Exception as rexc:
                ctx.log("%s rollback falló: %s: %s" % (LOG_PREFIX, type(rexc).__name__, rexc))

    finished_iso = timeutil.format_local(ctx.now())
    duration = max(0.0, ctx.monotonic() - t0)
    summary = {
        "started_at": started_iso,
        "finished_at": finished_iso,
        "duration_s": round(duration, 1),
        "sources": dict(acc.counts),
        "events": {
            "new": len(acc.new_ids),
            "updated": len(acc.updated_ids - acc.new_ids),
            "missing": int(missing or 0),
        },
        "pushes": {k: bool(pushes.get(k)) for k in
                   ("new", "closing", "page_changed", "source_health")},
    }
    try:
        if conn is not None:
            store.set_state(conn, "last_pass_finished_at", finished_iso)
            store.set_state(conn, "last_pass_summary", json.dumps(summary, ensure_ascii=False))
            conn.commit()
    except Exception as exc:
        try:
            conn.rollback()
        except Exception as rexc:
            ctx.log("%s rollback falló: %s: %s" % (LOG_PREFIX, type(rexc).__name__, rexc))
        ctx.log("%s no se pudo guardar el resumen: %s: %s"
                % (LOG_PREFIX, type(exc).__name__, exc))

    c = acc.counts
    ctx.log("%s pasada terminada %s en %s s: ok=%d zero=%d error=%d timeout=%d nuevos=%d "
            "actualizados=%d bajas=%d%s"
            % (LOG_PREFIX, finished_iso, _fmt_s(duration), c["ok"], c["zero"], c["error"],
               c["timeout"], summary["events"]["new"], summary["events"]["updated"],
               summary["events"]["missing"], " (abortada: %s)" % aborted if aborted else ""))

    try:
        ctx.fetcher.end_pass()
    except Exception as exc:
        ctx.log("%s end_pass falló: %s: %s" % (LOG_PREFIX, type(exc).__name__, exc))
    if conn is not None:
        try:
            conn.close()
        except Exception as exc:
            ctx.log("%s cierre de la conexión falló: %s: %s"
                    % (LOG_PREFIX, type(exc).__name__, exc))
    del acc
    gc.collect()   # R35
    return summary
