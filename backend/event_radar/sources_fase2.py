"""Fuentes de Fase 2 del radar de eventos (R17, R18, R19, A5, A13).

- `condor_nest`: sitemap de condor-nest.lat, páginas `/o/<slug>` (HTML SSR).
- `devevents_cfps`: `all-cfps.json` de developers.events.
- `page_hash`: SHA-256 del texto visible normalizado de una página.

Contrato (plan.md, sección 4): `HANDLERS[kind](ctx, fila, deadline) ->
SourceResult`, donde `fila` es la fila de `event_sources` (sqlite3.Row o
dict) y `deadline` un instante absoluto del reloj `ctx.monotonic` (o None).
Las funciones puras de parseo (`parse_condor_sitemap`, `parse_condor_page`,
`parse_devevents`, `page_visible_text`, `page_hash`) no tocan red ni base.

Errores: los de toda la fuente (JSON o XML inválido, HTTP distinto de 200 en
el sitemap o en el JSON) se lanzan y el engine los loguea en la línea de la
fuente. Los de una página suelta de Condor no cortan la fuente: se resumen
en `SourceResult.error` (nunca se tragan en silencio). `net.SourceDeadline`
corta la fuente con `status="timeout"` y devuelve lo ya procesado (R29).
`net.DuplicateRequest` se trata como "sin datos".

A5: el handler de Condor lee y persiste él mismo la lista `condor_skip`
(`store.condor_skip_get` / `store.condor_skip_add`) en una transacción corta
propia, también si la fuente se corta por el tope. El engine no necesita
volver a guardarla (si lo hace, `condor_skip_add` no duplica).

Solo stdlib, compatible con Python 3.10.
"""

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlsplit
from xml.etree import ElementTree

from . import context, net, normalize, store, timeutil
from .model import PageObservation, RawEvent, SourceResult

# --------------------------------------------------------------------------
# Constantes
# --------------------------------------------------------------------------

CONDOR_KIND = "condor_nest"
DEVEVENTS_KIND = "devevents_cfps"
PAGE_KIND = "page_hash"

CONDOR_PROVIDER = "condor"
DEVEVENTS_PROVIDER = "devevents"

CONDOR_HOST = "condor-nest.lat"
CONDOR_PAGE_URL = "https://condor-nest.lat/o/%s"
_CONDOR_PATH_RE = re.compile(r"^/o/([A-Za-z0-9][A-Za-z0-9._~-]*)/?$")

# R19: elementos cuyo contenido no es texto visible.
SKIP_TAGS = ("script", "style", "noscript")

# Motivos por los que una página de Condor no produce evento.
CONDOR_FINISHED = "finalizado"
CONDOR_OUTSIDE = "fuera del AMBA"
CONDOR_NOT_IN_PERSON = "no presencial"
CONDOR_UNKNOWN_PLACE = "lugar no reconocido"
CONDOR_NO_DATE = "sin fecha"
# Motivos que dejan el slug en `condor_skip` (A5): la página ya no puede
# volver a pasar el filtro (terminó, o no es presencial en el AMBA).
CONDOR_SKIP_REASONS = (CONDOR_FINISHED, CONDOR_OUTSIDE, CONDOR_NOT_IN_PERSON)

MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}
_EN_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}

_MONTH_ALT = "|".join(sorted(MONTHS, key=len, reverse=True))
_DATE_RE = re.compile(r"\b(\d{1,2})\s+de\s+(%s)\b(?:\s+(?:de|del)\s+(\d{4}))?" % _MONTH_ALT,
                      re.IGNORECASE)
_TIME_RE = re.compile(r"\b(\d{1,2}):(\d{2})\b")
_MODALITY_RE = re.compile(
    r"\b(Presencial|Virtual|Online|H[ií]brid[oa])\s*·\s*([^\n·]+)", re.IGNORECASE)
_FINISHED_RE = re.compile(r"\bFinalizad[oa]\b", re.IGNORECASE)
_CLOSED_RE = re.compile(r"\bInscripci[oó]n(?:es)?\s+Cerrada[s]?\b", re.IGNORECASE)
_OPEN_RE = re.compile(r"\bInscripci[oó]n(?:es)?\s+Abierta[s]?\b", re.IGNORECASE)
_STATUS_WORDS_RE = re.compile(
    r"Finalizad[oa]|Inscripci[oó]n(?:es)?\s+(?:Cerrada|Abierta)s?", re.IGNORECASE)
_CLOSING_HINT_RE = re.compile(
    r"\b(inscripci[oó]n(?:es)?|cierre|cierra[n]?|postulaci[oó]n(?:es)?|"
    r"aplicaciones|registro)\b", re.IGNORECASE)
_ORGANIZER_RE = re.compile(r"^\s*por\s+([^\n]+)", re.IGNORECASE | re.MULTILINE)
_UNTIL_RE = re.compile(r"^\s*(\d{1,2})-([A-Za-z]+)-(\d{4})\s*$")


# --------------------------------------------------------------------------
# Utilidades comunes
# --------------------------------------------------------------------------


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    try:
        value = row[key]
    except (KeyError, IndexError, TypeError):
        return default
    return default if value is None else value


def source_config(row: Any) -> dict:
    """`config` de la fuente como dict (en la base es JSON en texto)."""
    raw = _row_get(row, "config", {})
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(raw or "{}")
    except ValueError as exc:
        raise ValueError("config de la fuente no es JSON válido: %s" % exc) from exc
    return value if isinstance(value, dict) else {}


def source_timeout(row: Any) -> float:
    """R29: `config.timeout` si existe; si no, 20 s."""
    value = source_config(row).get("timeout")
    try:
        timeout = float(value)
    except (TypeError, ValueError):
        return float(net.DEFAULT_TIMEOUT)
    return timeout if timeout > 0 else float(net.DEFAULT_TIMEOUT)


def _content_type(response: Any) -> str:
    headers = getattr(response, "headers", None) or {}
    value = headers.get("content-type") if hasattr(headers, "get") else None
    return (value or "").strip().lower()


def decode_body(body: bytes, content_type: str = "") -> str:
    """Cuerpo en texto: charset del `Content-Type` o UTF-8 (sin romper)."""
    charset = "utf-8"
    m = re.search(r"charset\s*=\s*\"?([A-Za-z0-9._-]+)", content_type or "")
    if m:
        charset = m.group(1)
    try:
        return body.decode(charset, errors="replace")
    except LookupError:
        return body.decode("utf-8", errors="replace")


def _require_200(response: Any, url: str) -> None:
    if response.status != 200:
        raise net.FetchError("HTTP %d en %s" % (response.status, url))


def _deadline_passed(ctx: Any, deadline: Optional[float]) -> bool:
    return deadline is not None and ctx.monotonic() >= deadline


# --------------------------------------------------------------------------
# Texto visible (R19, base de Condor)
# --------------------------------------------------------------------------


class _VisibleTextParser(HTMLParser):
    """Junta el texto visible: sin `<script>`, `<style>`, `<noscript>`,
    comentarios ni atributos (`<meta>` no tiene texto: sus atributos, como el
    `traceparent`, nunca entran). Entidades decodificadas
    (`convert_charrefs=True`). Guarda además el texto del primer `<h1>` y del
    `<title>`."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.chunks: List[str] = []
        self._skip_depth = 0
        self._in_h1 = 0
        self._in_title = 0
        self.h1: List[str] = []
        self.title: List[str] = []
        self._h1_done = False

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in SKIP_TAGS:
            self._skip_depth += 1
        elif tag == "h1" and not self._h1_done:
            self._in_h1 += 1
        elif tag == "title":
            self._in_title += 1

    def handle_startendtag(self, tag, attrs):
        pass  # <meta/>, <br/>, <img/>: sin texto

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in SKIP_TAGS:
            if self._skip_depth > 0:
                self._skip_depth -= 1
        elif tag == "h1" and self._in_h1 > 0:
            self._in_h1 -= 1
            if self._in_h1 == 0:
                self._h1_done = True
        elif tag == "title" and self._in_title > 0:
            self._in_title -= 1

    def handle_data(self, data):
        if self._skip_depth > 0:
            return
        text = " ".join(data.split())
        if not text:
            return
        self.chunks.append(text)
        if self._in_h1 and not self._h1_done:
            self.h1.append(text)
        if self._in_title:
            self.title.append(text)

    # Comentarios, declaraciones e instrucciones de proceso no son visibles.
    def handle_comment(self, data):
        pass

    def handle_decl(self, decl):
        pass

    def handle_pi(self, data):
        pass

    def unknown_decl(self, data):
        pass


def _parse_html(html: str) -> _VisibleTextParser:
    parser = _VisibleTextParser()
    parser.feed(html or "")
    parser.close()
    return parser


def visible_chunks(html: str) -> List[str]:
    """Trozos de texto visible en orden, cada uno con espacios colapsados."""
    return _parse_html(html).chunks


def page_visible_text(html: str) -> str:
    """R19: texto visible normalizado de un HTML (espacios colapsados)."""
    return " ".join(" ".join(visible_chunks(html)).split())


def collapse_text(text: str) -> str:
    """R19 para `text/plain`: el texto con espacios colapsados."""
    return " ".join((text or "").split())


def _is_html(content_type: str) -> bool:
    return (not content_type or "html" in content_type or "xml" in content_type)


def _is_plain_text(content_type: str) -> bool:
    return content_type.startswith("text/") and not _is_html(content_type)


def page_hash(body: Any, content_type: str = "text/html") -> str:
    """R19: SHA-256 (hex) del contenido normalizado.

    HTML (o sin `Content-Type`): texto visible. Otro `text/*` (`text/plain`,
    `text/markdown`): texto con espacios colapsados. Cualquier otro tipo
    (PDF, imagen): los bytes tal cual.
    """
    ctype = (content_type or "").strip().lower()
    if isinstance(body, str):
        text: Optional[str] = body
        raw = body.encode("utf-8")
    else:
        raw = bytes(body or b"")
        text = None
    if _is_plain_text(ctype):
        normalized = collapse_text(text if text is not None else decode_body(raw, ctype))
    elif _is_html(ctype):
        normalized = page_visible_text(text if text is not None else decode_body(raw, ctype))
    else:
        return hashlib.sha256(raw).hexdigest()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# Condor Nest (R17, A5)
# --------------------------------------------------------------------------


def condor_slug(url: str) -> Optional[str]:
    """Slug de una URL `https://condor-nest.lat/o/<slug>`; None si no es una."""
    try:
        parts = urlsplit((url or "").strip())
    except ValueError:
        return None
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or host not in (CONDOR_HOST, "www." + CONDOR_HOST):
        return None
    m = _CONDOR_PATH_RE.match(parts.path or "")
    return m.group(1) if m else None


def parse_condor_sitemap(xml_text: Any) -> List[str]:
    """Slugs `/o/<slug>` del sitemap, en orden y sin repetir.

    Lanza `ValueError` si el XML está mal formado.
    """
    if isinstance(xml_text, (bytes, bytearray)):
        data = bytes(xml_text)
    else:
        data = (xml_text or "").encode("utf-8")
    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError as exc:
        raise ValueError("sitemap XML mal formado: %s" % exc) from exc
    slugs: List[str] = []
    seen = set()
    for elem in root.iter():
        tag = elem.tag.rsplit("}", 1)[-1] if isinstance(elem.tag, str) else ""
        if tag != "loc":
            continue
        slug = condor_slug(elem.text or "")
        if slug and slug not in seen:
            seen.add(slug)
            slugs.append(slug)
    return slugs


def nearest_year(day: int, month: int, now: datetime) -> date:
    """R17: fecha sin año -> el año que la deja más cerca de la pasada
    (diciembre visto en enero es del año anterior, enero visto en diciembre
    del siguiente). Lanza ValueError si el día no existe en ningún candidato."""
    today = timeutil.to_ar(now).date()
    best: Optional[date] = None
    for year in (today.year - 1, today.year, today.year + 1):
        try:
            candidate = date(year, month, day)
        except ValueError:
            continue
        if best is None or abs((candidate - today).days) < abs((best - today).days):
            best = candidate
    if best is None:
        raise ValueError("fecha inexistente: %d/%d" % (day, month))
    return best


def _date_from_match(m: "re.Match", now: datetime) -> date:
    day, month = int(m.group(1)), MONTHS[m.group(2).lower()]
    if m.group(3):
        return date(int(m.group(3)), month, day)
    return nearest_year(day, month, now)


def _at(d: date, hour: int, minute: int) -> str:
    return timeutil.format_local(datetime(d.year, d.month, d.day, hour, minute,
                                          tzinfo=timeutil.AR))


def _valid_time(hour: int, minute: int) -> bool:
    return 0 <= hour <= 23 and 0 <= minute <= 59


def _sentences(lines: List[str]) -> List[str]:
    """Oraciones del texto visible: cada trozo, cortado en `. ` (las horas
    usan `:` y no se cortan)."""
    out: List[str] = []
    for line in lines:
        for part in re.split(r"(?<=[.!?])\s+", line):
            if part.strip():
                out.append(part.strip())
    return out


@dataclass
class CondorPage:
    """Lo que se lee de una página `/o/<slug>` de Condor Nest."""

    slug: str
    url: str
    title: str
    status: str                       # finalizado | cerrada | abierta
    event_kind: Optional[str]         # "Hackathon", ...
    modality: Optional[str]           # "Presencial", "Virtual", ...
    city: Optional[str]
    organizer: Optional[str]
    start_local: Optional[str]
    end_local: Optional[str]
    has_time: bool
    closing_local: Optional[str]
    closing_explicit: bool
    reject_reason: Optional[str]      # None si produce evento
    raw: Optional[RawEvent]

    @property
    def skip(self) -> bool:
        """A5: el slug se guarda en `condor_skip` y no se vuelve a bajar."""
        return self.reject_reason in CONDOR_SKIP_REASONS


def _condor_dates(sentences: List[str], now: datetime):
    """(inicio, fin, has_time, cierre) desde las oraciones del texto visible.

    La oración con una fecha y una palabra de inscripción/cierre da el cierre
    (con su hora si figura; si no, 23:59). La primera otra oración con fecha
    da el evento: `de HH:MM a HH:MM` (fin al día siguiente si la hora de fin
    es menor) o solo fecha (`has_time=False`). La página da la hora en hora
    de Argentina, así que no se convierte.
    """
    start = end = closing = None
    has_time = False
    for sentence in sentences:
        m = _DATE_RE.search(sentence)
        if not m:
            continue
        try:
            d = _date_from_match(m, now)
        except ValueError:
            continue
        times = [(int(h), int(mi)) for h, mi in _TIME_RE.findall(sentence[m.end():])]
        times = [t for t in times if _valid_time(*t)]
        if _CLOSING_HINT_RE.search(sentence[:m.start()]):
            if closing is None:
                hour, minute = times[0] if times else (23, 59)
                closing = _at(d, hour, minute)
            continue
        if start is not None:
            continue
        if times:
            start = _at(d, *times[0])
            has_time = True
            if len(times) > 1:
                end_day = d
                if times[1] < times[0]:
                    end_day = d + timedelta(days=1)
                end = _at(end_day, *times[1])
        else:
            start = timeutil.date_local(d)
    return start, end, has_time, closing


def _place_verdict(city: Optional[str], location_text: Optional[str]) -> str:
    probe = RawEvent(
        provider=CONDOR_PROVIDER, origin_id="", title="", description=None,
        start_local="", end_local=None, has_time=False, closing_local=None,
        closing_explicit=False, venue=None, city=city, region=None,
        location_text=location_text, lat=None, lon=None, url="",
        require_approval=None, sold_out=None, event_type=None, calendar=None)
    return normalize.location_verdict(probe)


_SIMILAR_RE = re.compile(r"^\s*oportunidades\s+similares\b", re.IGNORECASE)


def _main_block(chunks: List[str]) -> List[str]:
    """Corta el texto en "Oportunidades similares": debajo hay tarjetas de
    OTROS eventos con sus propios cierres ("Cierra el martes 1 de diciembre a
    las 04:59...") que no deben tomarse como cierre de esta página (verificado
    sobre HTML real de condor-nest.lat el 26/11/2026)."""
    for i, chunk in enumerate(chunks):
        if _SIMILAR_RE.search(chunk):
            return chunks[:i]
    return chunks


def parse_condor_page(html: str, slug: str, now: datetime) -> CondorPage:
    """R17: estado, tipo, modalidad y ciudad, organizador, fechas y cierre.

    Solo produce `raw` (RawEvent, proveedor `condor`, id de origen = slug)
    si es presencial en una ciudad del AMBA, no está finalizado ni terminado
    y tiene fecha. `reject_reason` dice por qué no.
    """
    parsed = _parse_html(html)
    lines = _main_block(parsed.chunks)
    text = "\n".join(lines)
    url = CONDOR_PAGE_URL % slug

    title = " ".join(" ".join(parsed.h1).split())
    if not title:
        title = " ".join(" ".join(parsed.title).split())
        title = re.split(r"\s+[|·–-]\s+Condor", title, maxsplit=1)[0].strip()
    title = title or slug

    if _FINISHED_RE.search(text):
        status = "finalizado"
    elif _CLOSED_RE.search(text):
        status = "cerrada"
    else:
        status = "abierta"

    modality = city = event_kind = None
    mod = _MODALITY_RE.search(text)
    if mod:
        modality = mod.group(1).strip().capitalize()
        city = " ".join(mod.group(2).split()) or None
        header = _STATUS_WORDS_RE.sub("\n", text[:mod.start()])
        header_lines = [ln.strip() for ln in header.split("\n") if ln.strip()]
        if header_lines and len(header_lines[-1]) <= 40:
            event_kind = header_lines[-1]

    organizer = None
    org = _ORGANIZER_RE.search(text)
    if org:
        organizer = " ".join(org.group(1).split()).strip(" ·") or None

    start, end, has_time, closing = _condor_dates(_sentences(lines), now)

    location_text = "%s · %s" % (modality, city) if modality and city else None
    reason: Optional[str] = None
    if status == "finalizado":
        reason = CONDOR_FINISHED
    elif modality is None or normalize.fold(modality) != "presencial":
        reason = CONDOR_NOT_IN_PERSON if modality else CONDOR_UNKNOWN_PLACE
    else:
        verdict = _place_verdict(city, location_text)
        if verdict == "outside":
            reason = CONDOR_OUTSIDE
        elif verdict != "inside":
            reason = CONDOR_UNKNOWN_PLACE
    if reason is None:
        if start is None:
            reason = CONDOR_NO_DATE
        elif timeutil.is_finished(start, end, has_time, now):
            reason = CONDOR_FINISHED   # ya pasó aunque la página no lo diga

    raw = None
    if reason is None:
        description = " · ".join(p for p in (
            event_kind, location_text, ("Organiza: %s" % organizer) if organizer else None)
            if p) or None
        raw = RawEvent(
            provider=CONDOR_PROVIDER, origin_id=slug, title=title, description=description,
            start_local=start, end_local=end, has_time=has_time,
            closing_local=closing, closing_explicit=closing is not None,
            venue=None, city=city, region=None, location_text=location_text,
            lat=None, lon=None, url=url, require_approval=None, sold_out=None,
            event_type=event_kind, calendar=None)

    return CondorPage(
        slug=slug, url=url, title=title, status=status, event_kind=event_kind,
        modality=modality, city=city, organizer=organizer, start_local=start,
        end_local=end, has_time=has_time, closing_local=closing,
        closing_explicit=closing is not None, reject_reason=reason, raw=raw)


def _save_condor_skip(ctx: Any, slugs: List[str]) -> None:
    if not slugs:
        return
    conn = context.connect(ctx)
    try:
        store.condor_skip_add(conn, slugs)
        conn.commit()
    finally:
        conn.close()


def _load_condor_skip(ctx: Any) -> set:
    conn = context.connect(ctx)
    try:
        return set(store.condor_skip_get(conn))
    finally:
        conn.close()


def _error_summary(errors: List[str], total: int) -> Optional[str]:
    if not errors:
        return None
    shown = "; ".join(errors[:3])
    more = " (y %d más)" % (len(errors) - 3) if len(errors) > 3 else ""
    return "%d de %d páginas con error: %s%s" % (len(errors), total, shown, more)


def fetch_condor_nest(ctx: Any, row: Any, deadline: Optional[float]) -> SourceResult:
    """R17 y A5: sitemap, páginas no salteadas una a la vez, y skip persistido."""
    started = ctx.monotonic()
    timeout = source_timeout(row)
    sitemap_url = _row_get(row, "url")
    try:
        resp = ctx.fetcher.request(sitemap_url, kind=CONDOR_KIND, timeout=timeout,
                                   deadline=deadline)
    except net.DuplicateRequest:
        return SourceResult(status="zero", raw_count=0, events=[],
                            duration_s=ctx.monotonic() - started)
    _require_200(resp, sitemap_url)
    slugs = parse_condor_sitemap(resp.body)
    del resp

    skip = _load_condor_skip(ctx)
    pending = [s for s in slugs if s not in skip]
    events: List[RawEvent] = []
    new_skip: List[str] = []
    errors: List[str] = []
    status = "ok" if slugs else "zero"
    error: Optional[str] = None
    try:
        for slug in pending:
            if _deadline_passed(ctx, deadline):
                raise net.SourceDeadline("tope de la fuente vencido")
            page_url = CONDOR_PAGE_URL % slug
            if not ctx.fetcher.robots_allowed(page_url):
                raise net.RobotsDisallowed("robots.txt")
            try:
                page = ctx.fetcher.request(page_url, kind=CONDOR_KIND, timeout=timeout,
                                           deadline=deadline)
            except net.SourceDeadline:
                raise
            except net.DuplicateRequest:
                continue   # sin datos: ya se pidió en esta pasada
            except (net.FetchError, net.FetchTimeout) as exc:
                errors.append("%s %s: %s" % (slug, type(exc).__name__, exc))
                continue
            if page.status != 200:
                errors.append("%s HTTP %d" % (slug, page.status))
                continue
            try:
                info = parse_condor_page(decode_body(page.body, _content_type(page)), slug,
                                         ctx.now())
            except ValueError as exc:
                errors.append("%s %s: %s" % (slug, type(exc).__name__, exc))
                continue
            if info.raw is not None:
                events.append(info.raw)
            elif info.skip:
                new_skip.append(slug)
    except net.SourceDeadline as exc:
        status, error = "timeout", "tope de la fuente: %s" % exc
    finally:
        _save_condor_skip(ctx, new_skip)

    if status != "timeout" and errors:
        if len(errors) == len(pending):   # ninguna página se pudo leer
            status = "error"
        error = _error_summary(errors, len(pending))
    elif status == "timeout" and errors:
        error = "%s; %s" % (error, _error_summary(errors, len(pending)))
    return SourceResult(status=status, raw_count=len(slugs), events=events, error=error,
                        duration_s=ctx.monotonic() - started)


# --------------------------------------------------------------------------
# developers.events (R18)
# --------------------------------------------------------------------------


def _until_date(item: dict) -> Optional[date]:
    """Fecha calendario del cierre: `untilDate` (ms, medianoche UTC) o `until`
    (`05-April-2024`), sin correrla de día."""
    until_ms = item.get("untilDate")
    if isinstance(until_ms, (int, float)) and not isinstance(until_ms, bool):
        return timeutil.local_date(timeutil.date_from_epoch_ms(until_ms))
    m = _UNTIL_RE.match(str(item.get("until") or ""))
    if m:
        month = _EN_MONTHS.get(m.group(2).lower())
        if month:
            return date(int(m.group(3)), month, int(m.group(1)))
    return None


def _conf_date(conf: dict, index: int) -> Optional[str]:
    dates = conf.get("date")
    if not isinstance(dates, list) or not dates:
        return None
    value = dates[index]
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return timeutil.date_from_epoch_ms(value)
    return None


def devevents_in_amba(location: Optional[str]) -> bool:
    """R18: `conf.location` menciona una ciudad del AMBA (reglas de R22)."""
    if not location:
        return False
    return _place_verdict(None, location) == "inside"


def parse_devevents(data: Any, now: datetime) -> Tuple[List[RawEvent], int]:
    """R18: `(eventos, ítems crudos)`. Solo los ítems con `conf.location` en
    el AMBA y cierre (`until`/`untilDate` a las 23:59 -03:00) no vencido.

    `data` es el JSON ya decodificado (lista) o el texto/bytes del cuerpo.
    Lanza `ValueError` si no es JSON o no es una lista.
    """
    if isinstance(data, (bytes, bytearray)):
        data = data.decode("utf-8", errors="replace")
    if isinstance(data, str):
        data = json.loads(data)
    if not isinstance(data, list):
        raise ValueError("all-cfps.json: se esperaba una lista, vino %s" % type(data).__name__)
    now_ar = timeutil.to_ar(now)
    events: List[RawEvent] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        conf = item.get("conf") if isinstance(item.get("conf"), dict) else {}
        link = str(item.get("link") or "").strip()
        name = str(conf.get("name") or "").strip()
        location = conf.get("location") if isinstance(conf.get("location"), str) else None
        if not link or not name or not devevents_in_amba(location):
            continue
        until = _until_date(item)
        if until is None:
            continue
        closing = _at(until, 23, 59)
        if timeutil.parse_local(closing) < now_ar:
            continue
        start = _conf_date(conf, 0)
        if start is None:
            continue
        end = _conf_date(conf, -1)
        events.append(RawEvent(
            provider=DEVEVENTS_PROVIDER, origin_id=link, title=name, description=None,
            start_local=start, end_local=end if end != start else None, has_time=False,
            closing_local=closing, closing_explicit=True, venue=None, city=None,
            region=None, location_text=location, lat=None, lon=None, url=link,
            require_approval=None, sold_out=None, event_type=None, calendar=None))
    return events, len(data)


def fetch_devevents_cfps(ctx: Any, row: Any, deadline: Optional[float]) -> SourceResult:
    """R18: baja `all-cfps.json` (timeout de `config.timeout`, 60 s sembrado)."""
    started = ctx.monotonic()
    url = _row_get(row, "url")
    try:
        resp = ctx.fetcher.request(url, kind=DEVEVENTS_KIND, timeout=source_timeout(row),
                                   deadline=deadline)
    except net.DuplicateRequest:
        return SourceResult(status="zero", raw_count=0, events=[],
                            duration_s=ctx.monotonic() - started)
    _require_200(resp, url)
    body = resp.body
    del resp
    events, raw_count = parse_devevents(body, ctx.now())
    del body
    return SourceResult(status="ok" if raw_count else "zero", raw_count=raw_count,
                        events=events, duration_s=ctx.monotonic() - started)


# --------------------------------------------------------------------------
# Páginas monitoreadas (R19)
# --------------------------------------------------------------------------


def observe_page(response: Any) -> PageObservation:
    """R19: observación de una respuesta (cualquier código HTTP es válido)."""
    return PageObservation(http_status=int(response.status),
                           hash=page_hash(response.body, _content_type(response)),
                           error=None)


def fetch_page_hash(ctx: Any, row: Any, deadline: Optional[float]) -> SourceResult:
    """R19: baja la URL y devuelve la observación en `SourceResult.page`.

    Un error de red o timeout devuelve una observación sin código ni hash
    (`store.record_page_observation` no pisa nada con ella).
    """
    started = ctx.monotonic()
    url = _row_get(row, "url")
    try:
        resp = ctx.fetcher.request(url, kind=PAGE_KIND, timeout=source_timeout(row),
                                   deadline=deadline)
    except net.DuplicateRequest:
        return SourceResult(status="zero", raw_count=0, events=[],
                            error="URL ya pedida en esta pasada (sin datos)",
                            duration_s=ctx.monotonic() - started)
    except net.FetchTimeout as exc:   # incluye SourceDeadline
        msg = "%s: %s" % (type(exc).__name__, exc)
        return SourceResult(status="timeout", raw_count=0, events=[], error=msg,
                            page=PageObservation(None, None, msg),
                            duration_s=ctx.monotonic() - started)
    except net.FetchError as exc:
        msg = "%s: %s" % (type(exc).__name__, exc)
        return SourceResult(status="error", raw_count=0, events=[], error=msg,
                            page=PageObservation(None, None, msg),
                            duration_s=ctx.monotonic() - started)
    obs = observe_page(resp)
    return SourceResult(status="ok", raw_count=1, events=[], page=obs,
                        duration_s=ctx.monotonic() - started)


# --------------------------------------------------------------------------
# Registro
# --------------------------------------------------------------------------

HANDLERS: Dict[str, Callable[[Any, Any, Optional[float]], SourceResult]] = {
    CONDOR_KIND: fetch_condor_nest,
    DEVEVENTS_KIND: fetch_devevents_cfps,
    PAGE_KIND: fetch_page_hash,
}
