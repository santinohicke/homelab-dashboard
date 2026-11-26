"""Fuentes MVD del radar de eventos: parsers y fetchers (R12-R16).

Contrato (plan.md, sección 4):

    HANDLERS: dict[str, Callable[[RadarContext, sqlite3.Row, float], SourceResult]]

`deadline` es un instante absoluto del reloj `ctx.monotonic` (tope de 15 min
por fuente, R29); se pasa tal cual a cada `ctx.fetcher.request`.

Funciones puras de parseo (para los tests con fixtures de `exploracion.md`):
`parse_luma_entries`, `parse_nexa_events`, `parse_ahack_rss`,
`parse_meetup_ics` y `parse_meetup_rss_venues`. Devuelven `RawEvent` crudos:
los filtros (online, AMBA, ya terminado) y la categoría son de
`normalize.apply`, que corre el engine.

Errores (R29, R32):
- Timeout o tope de la fuente (`FetchTimeout`, `SourceDeadline`): la fuente
  queda `timeout` con lo que ya se procesó (páginas anteriores).
- Error de red, HTTP distinto de 200, cuerpo de más de 5 MB o payload que no
  parsea: la fuente queda `error` con `"<Tipo>: <mensaje>"` y lo ya procesado.
- `DuplicateRequest` en el primer request no se captura: significa "sin
  datos" para el engine (ni `ok` ni `zero`). En la paginación de Luma corta
  la paginación y se conserva lo ya leído.
- La robots.txt de la URL de la fuente la consulta el engine antes de llamar
  al handler; aquí solo se consulta para el RSS complementario de Meetup.
Toda excepción capturada se loguea en una línea `[radar-eventos] <kind> ...`
(sin `#`, para no contar como línea de fuente de R32).
"""

import calendar as _calendar
import html
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import date
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote

from . import timeutil
from .model import RawEvent, SourceResult
from .net import DuplicateRequest, FetchError, FetchTimeout, SourceDeadline
from .schema import (AHACK_RSS_URL, NEXA_MCP_URL, seed_source_url, source_value)

LogFn = Callable[[str], None]

DEFAULT_TIMEOUT = 20.0          # R29
LUMA_MAX_PAGES = 3              # R12
LUMA_CURSOR_PARAM = "pagination_cursor"
LUMA_PUBLIC_BASE = "https://luma.com/"
NEXA_PUBLIC_BASE = "https://nexa.builders/eventos/"
NEXA_SEARCH_QUERY = "Buenos Aires"
NEXA_PROTOCOL_VERSION = "2025-03-26"
NEXA_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}
MEETUP_BASE = "https://www.meetup.com/"

_MEETUP_ICAL_RE = re.compile(r"meetup\.com/([A-Za-z0-9_-]+)/events/ical", re.I)
_MEETUP_EVENT_ID_RE = re.compile(r"/events/(\d+)")
_DIGITS_RE = re.compile(r"(\d+)")
_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_AHACK_DATE_RE = re.compile(r"^\s*(\d{1,2})\s+([^\W\d_]+)\.?\s+(\d{4})\s*$", re.U)
_ICS_ESCAPE_RE = re.compile(r"\\([\\,;nN])")

# Meses en castellano (y en inglés, por las dudas) sin tildes y en minúsculas.
_MONTHS = {
    "ene": 1, "enero": 1, "jan": 1, "january": 1,
    "feb": 2, "febrero": 2, "february": 2,
    "mar": 3, "marzo": 3, "march": 3,
    "abr": 4, "abril": 4, "apr": 4, "april": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "junio": 6, "june": 6,
    "jul": 7, "julio": 7, "july": 7,
    "ago": 8, "agosto": 8, "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "set": 9, "septiembre": 9, "setiembre": 9, "september": 9,
    "oct": 10, "octubre": 10, "october": 10,
    "nov": 11, "noviembre": 11, "november": 11,
    "dic": 12, "diciembre": 12, "dec": 12, "december": 12,
}


def _default_log(line: str) -> None:
    print(line, flush=True)


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------


def _get(obj: Any, key: str) -> Any:
    """Valor de una fila (`sqlite3.Row` o dict) o None si no está."""
    if obj is None or not hasattr(obj, "keys"):
        return None
    return obj[key] if key in obj.keys() else None


def _text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _fold(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch)).lower()


def _float(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and re.fullmatch(r"\s*-?\d+(\.\d+)?\s*", value):
        return float(value)
    return None


def _bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    return bool(value)


def _join(parts: Iterable[Optional[str]]) -> Optional[str]:
    out: List[str] = []
    for part in parts:
        text = _text(part)
        if text and text not in out:
            out.append(text)
    return ", ".join(out) or None


def _iso(value: Any, tz_name: Optional[str], log: LogFn, what: str) -> Tuple[str, bool]:
    """`timeutil.parse_iso_local`; si no parsea, `("", False)` (normalize lo
    descarta como datos incompletos) y una línea de log."""
    if value is None or value == "":
        return "", False
    try:
        return timeutil.parse_iso_local(str(value), tz_name)
    except ValueError as exc:
        log("[radar-eventos] %s: fecha inválida %r (%s)" % (what, value, exc))
        return "", False


def _decode(body: bytes) -> str:
    return body.decode("utf-8-sig", errors="replace")


def _load_json(body: bytes, what: str) -> Any:
    try:
        return json.loads(_decode(body))
    except ValueError as exc:
        raise ValueError("%s: JSON inválido (%s)" % (what, exc)) from exc


def _parse_xml(body: Any, what: str) -> ET.Element:
    data = body.encode("utf-8") if isinstance(body, str) else bytes(body)
    if b"<!ENTITY" in data.upper():
        raise ValueError("%s: XML con entidades declaradas, rechazado" % what)
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError("%s: XML inválido (%s)" % (what, exc)) from exc


def _child(item: ET.Element, name: str) -> Optional[str]:
    return _text(item.findtext(name))


def source_timeout(row: Any, log: LogFn = _default_log) -> float:
    """R29: `config.timeout` de la fuente si existe; si no, 20 s."""
    config = _get(row, "config")
    if isinstance(config, str):
        try:
            config = json.loads(config or "{}")
        except ValueError as exc:
            log("[radar-eventos] %s %r: config JSON inválido (%s); timeout %.0f s"
                % (_get(row, "kind"), _get(row, "name"), exc, DEFAULT_TIMEOUT))
            config = {}
    if isinstance(config, dict):
        value = _float(config.get("timeout"))
        if value is not None and value > 0:
            return value
    return DEFAULT_TIMEOUT


# --------------------------------------------------------------------------
# Luma (R12, R13)
# --------------------------------------------------------------------------


def _luma_entries(payload: Any) -> List[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        entries = payload.get("entries")
        if entries is None:
            return []
        if isinstance(entries, list):
            return entries
    raise ValueError("Luma: respuesta sin lista 'entries'")


def luma_page_meta(payload: Any) -> Tuple[bool, Optional[str]]:
    """`(has_more, next_cursor)` de una página de Luma."""
    if not isinstance(payload, dict):
        return False, None
    cursor = payload.get("next_cursor")
    cursor = cursor if isinstance(cursor, str) and cursor else None
    return bool(payload.get("has_more")), cursor


def luma_public_url(slug: Any) -> str:
    text = _text(slug) or ""
    if not text:
        return ""
    if text.lower().startswith(("http://", "https://")):
        return text
    return LUMA_PUBLIC_BASE + text.lstrip("/")


def _luma_raw(entry: Any, log: LogFn) -> Optional[RawEvent]:
    if not isinstance(entry, dict):
        return None
    ev = entry.get("event") if isinstance(entry.get("event"), dict) else entry
    api_id = _text(ev.get("api_id"))
    if not api_id:
        return None
    tz_name = _text(ev.get("timezone"))
    start, has_time = _iso(ev.get("start_at"), tz_name, log, "luma %s start_at" % api_id)
    end = _iso(ev.get("end_at"), tz_name, log, "luma %s end_at" % api_id)[0] or None

    geo = ev.get("geo_address_info")
    geo = geo if isinstance(geo, dict) else {}
    lat = lon = None
    if geo.get("mode") != "obfuscated":   # R13: obfuscated, sin coordenadas
        for coord in (geo.get("place_coordinate"), geo.get("coordinate"), ev.get("coordinate")):
            if isinstance(coord, dict):
                lat, lon = _float(coord.get("latitude")), _float(coord.get("longitude"))
                if lat is not None and lon is not None:
                    break
                lat = lon = None
    country_code = (_text(geo.get("country_code")) or "").upper()
    if lat is None and country_code and country_code != "AR":
        # Calendarios globales (p. ej. The AI Collective): un evento
        # obfuscated de otro país usa la coordenada aproximada para que R22
        # lo excluya por distancia. Los de Argentina siguen sin coordenadas (R13).
        for coord in (geo.get("coordinate"), ev.get("coordinate")):
            if isinstance(coord, dict):
                lat, lon = _float(coord.get("latitude")), _float(coord.get("longitude"))
                if lat is not None and lon is not None:
                    break
                lat = lon = None
    address = _text(geo.get("address"))
    sublocality = _text(geo.get("sublocality"))
    city = _text(geo.get("city"))
    region = _text(geo.get("region"))

    cal = entry.get("calendar") if isinstance(entry.get("calendar"), dict) else ev.get("calendar")
    calendar = None
    if isinstance(cal, dict):
        calendar = {"api_id": _text(cal.get("api_id")), "name": _text(cal.get("name")),
                    "slug": _text(cal.get("slug"))}
    ticket = entry.get("ticket_info") if isinstance(entry.get("ticket_info"), dict) \
        else ev.get("ticket_info")
    ticket = ticket if isinstance(ticket, dict) else {}

    return RawEvent(
        provider="luma",
        origin_id=api_id,
        title=_text(ev.get("name")) or "",
        description=None,
        start_local=start,
        end_local=end,
        has_time=has_time,
        closing_local=None,          # Luma no informa cierre: cierre = inicio (normalize)
        closing_explicit=False,
        venue=address,
        city=city,
        region=region,
        location_text=_join((address, sublocality, city, region)),
        lat=lat,
        lon=lon,
        url=luma_public_url(ev.get("url")),
        require_approval=_bool(ticket.get("require_approval")),
        sold_out=_bool(ticket.get("is_sold_out")),
        event_type=None,
        calendar=calendar,
    )


def parse_luma_entries(payload: Any, log: LogFn = _default_log) -> List[RawEvent]:
    """`entries[]` de `discover/get-paginated-events` o `calendar/get-items`
    (cada entrada `{event, calendar, ticket_info}`) a `RawEvent` de Luma."""
    out: List[RawEvent] = []
    for entry in _luma_entries(payload):
        raw = _luma_raw(entry, log)
        if raw is not None:
            out.append(raw)
    return out


def luma_page_url(base: str, cursor: Optional[str]) -> str:
    if not cursor:
        return base
    sep = "&" if "?" in base else "?"
    return "%s%s%s=%s" % (base, sep, LUMA_CURSOR_PARAM, quote(cursor, safe=""))


# --------------------------------------------------------------------------
# NEXA (R14)
# --------------------------------------------------------------------------


def nexa_rpc(rpc_id: int, method: str, params: dict) -> dict:
    return {"jsonrpc": "2.0", "id": rpc_id, "method": method, "params": params}


def nexa_requests() -> List[dict]:
    """Los 3 cuerpos JSON-RPC de una pasada: `initialize`, `list_events` y
    `search_events("Buenos Aires")`. Cuerpos distintos: no se deduplican."""
    return [
        nexa_rpc(1, "initialize", {
            "protocolVersion": NEXA_PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": {"name": "HomelabRadarEventos", "version": "1.0"},
        }),
        nexa_rpc(2, "tools/call", {"name": "list_events", "arguments": {}}),
        nexa_rpc(3, "tools/call", {"name": "search_events",
                                   "arguments": {"query": NEXA_SEARCH_QUERY}}),
    ]


def _sse_messages(text: str) -> List[Any]:
    messages: List[Any] = []
    data: List[str] = []
    for line in text.splitlines() + [""]:
        if line.startswith("data:"):
            data.append(line[5:].lstrip())
        elif not line.strip() and data:
            messages.append(json.loads("\n".join(data)))
            data = []
    return messages


def nexa_decode(body: bytes, content_type: Optional[str] = None) -> dict:
    """Respuesta JSON-RPC desde `application/json` (lo observado) o desde
    `text/event-stream` (último mensaje con `result` o `error`)."""
    text = _decode(body)
    try:
        if "event-stream" in (content_type or "").lower():
            candidates = [m for m in _sse_messages(text)
                          if isinstance(m, dict) and ("result" in m or "error" in m)]
            if not candidates:
                raise ValueError("NEXA: stream sin respuesta JSON-RPC")
            message = candidates[-1]
        else:
            message = json.loads(text)
    except ValueError as exc:
        raise ValueError("NEXA: respuesta inválida (%s)" % exc) from exc
    if not isinstance(message, dict):
        raise ValueError("NEXA: respuesta JSON-RPC no es un objeto")
    if message.get("error") is not None:
        raise ValueError("NEXA: error JSON-RPC %s" % json.dumps(message["error"],
                                                                 ensure_ascii=False)[:200])
    if "result" not in message:
        raise ValueError("NEXA: respuesta JSON-RPC sin 'result'")
    return message


def _is_nexa_event(obj: Any) -> bool:
    return isinstance(obj, dict) and "id" in obj and "title" in obj and "date_start" in obj


def _collect_nexa(obj: Any, out: List[dict], depth: int = 0) -> None:
    if depth > 8:
        return
    if _is_nexa_event(obj):
        out.append(obj)
        return
    if isinstance(obj, dict):
        for value in obj.values():
            _collect_nexa(value, out, depth + 1)
    elif isinstance(obj, list):
        for value in obj:
            _collect_nexa(value, out, depth + 1)


def nexa_result_events(message: Any, log: LogFn = _default_log) -> List[dict]:
    """Eventos (dicts crudos) del `result` de un `tools/call`.

    MCP devuelve `result.content[].text` con JSON y, a veces,
    `result.structuredContent`. Se buscan objetos con `id`, `title` y
    `date_start` en cualquiera de las dos formas (o en el `result` directo).
    """
    result = message.get("result") if isinstance(message, dict) else message
    if isinstance(result, dict) and result.get("isError"):
        raise ValueError("NEXA: la herramienta devolvió isError")
    found: List[dict] = []
    if isinstance(result, dict) and isinstance(result.get("content"), list):
        for part in result["content"]:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                try:
                    _collect_nexa(json.loads(part["text"]), found)
                except ValueError as exc:   # texto libre (no JSON): no trae eventos
                    log("[radar-eventos] nexa_mcp: contenido de texto no JSON ignorado (%s)"
                        % exc)
    if not found and isinstance(result, dict) and "structuredContent" in result:
        _collect_nexa(result["structuredContent"], found)
    if not found:
        _collect_nexa(result, found)
    return found


def nexa_public_url(ev: dict) -> str:
    external = _text(ev.get("external_url"))
    if external:
        return external
    slug = _text(ev.get("slug"))
    return NEXA_PUBLIC_BASE + slug if slug else ""


def _nexa_raw(ev: dict, log: LogFn) -> RawEvent:
    origin_id = str(ev.get("id"))
    tz_name = _text(ev.get("timezone"))
    start, has_time = _iso(ev.get("date_start"), tz_name, log, "nexa %s date_start" % origin_id)
    end = _iso(ev.get("date_end"), tz_name, log, "nexa %s date_end" % origin_id)[0] or None
    return RawEvent(
        provider="nexa",
        origin_id=origin_id,
        title=_text(ev.get("title")) or "",
        description=None,
        start_local=start,
        end_local=end,
        has_time=has_time,
        closing_local=None,
        closing_explicit=False,
        venue=None,
        city=None,                       # nunca community.city (R14)
        region=None,
        location_text=_text(ev.get("location")),
        lat=None,                        # community.latitude es de la comunidad
        lon=None,
        url=nexa_public_url(ev),
        require_approval=None,
        sold_out=None,
        event_type=_text(ev.get("event_type")),
        calendar=None,
    )


def nexa_union(*event_lists: Iterable[dict]) -> List[dict]:
    """Une listas de eventos crudos por `id` (gana la primera aparición)."""
    seen: Dict[str, dict] = {}
    for events in event_lists:
        for ev in events:
            key = str(ev.get("id"))
            if key not in seen:
                seen[key] = ev
    return list(seen.values())


def parse_nexa_events(events: Iterable[dict], log: LogFn = _default_log) -> List[RawEvent]:
    """Eventos crudos de NEXA (ya unidos por `id`) a `RawEvent`; solo
    `status="published"`."""
    out: List[RawEvent] = []
    for ev in events:
        if not isinstance(ev, dict) or ev.get("status") != "published":
            continue
        out.append(_nexa_raw(ev, log))
    return out


# --------------------------------------------------------------------------
# argentinahackathons.com (R15)
# --------------------------------------------------------------------------


def parse_ahack_description(text: Optional[str]) -> Tuple[Optional[date], Optional[str]]:
    """`"<d> <mes> <aaaa> | <ciudad> | Organizado por <x> | Precio: <y>"` a
    `(fecha, ciudad)`; None en lo que no se pueda leer."""
    if not text:
        return None, None
    parts = [p.strip() for p in text.split("|")]
    when: Optional[date] = None
    m = _AHACK_DATE_RE.match(parts[0]) if parts else None
    if m:
        month = _MONTHS.get(_fold(m.group(2)))
        year, day = int(m.group(3)), int(m.group(1))
        if month and 1 <= year <= 9999 and 1 <= day <= _calendar.monthrange(year, month)[1]:
            when = date(year, month, day)
    city = None
    if len(parts) > 1 and parts[1]:
        head = _fold(parts[1])
        if not head.startswith(("organizado", "precio")):
            city = parts[1]
    return when, city


def parse_ahack_rss(body: Any, log: LogFn = _default_log) -> List[RawEvent]:
    """`item` del RSS de argentinahackathons.com a `RawEvent` (solo fecha).

    La fecha sale de `description`; si no se puede leer, de la parte fecha de
    `pubDate` tal cual, sin convertir de zona (R15).
    """
    root = _parse_xml(body, "argentinahackathons RSS")
    out: List[RawEvent] = []
    for item in root.iter("item"):
        link = _child(item, "link")
        guid = _child(item, "guid") or link
        if not guid:
            continue
        description = _child(item, "description")
        when, city = parse_ahack_description(description)
        if when is not None:
            start = timeutil.date_local(when)
        else:
            pub = _child(item, "pubDate")
            try:
                start = timeutil.date_from_rfc2822(pub or "")
            except ValueError as exc:
                log("[radar-eventos] argentinahackathons %s: sin fecha en description ni "
                    "pubDate (%s)" % (guid, exc))
                start = ""
        out.append(RawEvent(
            provider="argentinahackathons",
            origin_id=guid,
            title=_child(item, "title") or "",
            description=description,
            start_local=start,
            end_local=None,
            has_time=False,
            closing_local=None,
            closing_explicit=False,
            venue=None,
            city=city,
            region=None,
            location_text=None,
            lat=None,
            lon=None,
            url=link or "",
            require_approval=None,
            sold_out=None,
            event_type=None,
            calendar=None,
        ))
    return out


def ahack_raw_count(body: Any) -> int:
    return sum(1 for _ in _parse_xml(body, "argentinahackathons RSS").iter("item"))


# --------------------------------------------------------------------------
# Meetup (R16)
# --------------------------------------------------------------------------


def _ics_unfold(text: str) -> List[str]:
    lines: List[str] = []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if line[:1] in (" ", "\t") and lines:
            lines[-1] += line[1:]
        else:
            lines.append(line)
    return lines


def _ics_split(line: str) -> Optional[Tuple[str, str]]:
    in_quotes = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_quotes = not in_quotes
        elif ch == ":" and not in_quotes:
            return line[:i], line[i + 1:]
    return None


def _ics_unescape(value: str) -> str:
    def repl(m: "re.Match") -> str:
        ch = m.group(1)
        return "\n" if ch in "nN" else ch
    return _ICS_ESCAPE_RE.sub(repl, value)


def ics_events(text: str) -> List[Dict[str, Tuple[str, str]]]:
    """Bloques VEVENT como `{NOMBRE: (línea completa, valor)}` (primera aparición)."""
    events: List[Dict[str, Tuple[str, str]]] = []
    current: Optional[Dict[str, Tuple[str, str]]] = None
    depth = 0
    for line in _ics_unfold(text):
        stripped = line.strip()
        upper = stripped.upper()
        if upper == "BEGIN:VEVENT":
            current, depth = {}, 0
            continue
        if current is None:
            continue
        if upper == "END:VEVENT" and depth == 0:
            events.append(current)
            current = None
            continue
        if upper.startswith("BEGIN:"):
            depth += 1      # VALARM y otros subcomponentes: se ignoran
            continue
        if upper.startswith("END:"):
            depth = max(0, depth - 1)
            continue
        if depth:
            continue
        split = _ics_split(stripped)
        if not split:
            continue
        name = split[0].split(";", 1)[0].strip().upper()
        if name and name not in current:
            current[name] = (stripped, split[1])
    return events


def meetup_event_id(uid: Optional[str], url: Optional[str]) -> Optional[str]:
    """Número de evento de Meetup desde `URL` (`/events/<id>`) o el `UID`
    (`event_317441686@meetup.com`)."""
    if url:
        m = _MEETUP_EVENT_ID_RE.search(url)
        if m:
            return m.group(1)
    if uid:
        m = _DIGITS_RE.search(uid)
        if m:
            return m.group(1)
    return None


def meetup_public_url(urlname: str, event_id: Optional[str]) -> str:
    if not urlname or not event_id:
        return ""
    return "%s%s/events/%s/" % (MEETUP_BASE, urlname, event_id)


def _ics_dt(prop: Optional[Tuple[str, str]], log: LogFn, what: str) -> Tuple[str, bool]:
    if not prop:
        return "", False
    try:
        return timeutil.parse_ics_line(prop[0])
    except ValueError as exc:
        log("[radar-eventos] %s: fecha iCal inválida %r (%s)" % (what, prop[0], exc))
        return "", False


def parse_meetup_ics(text: Any, urlname: str, log: LogFn = _default_log) -> List[RawEvent]:
    """VEVENT del iCal de un grupo de Meetup a `RawEvent`.

    Fecha, hora y título salen del iCal (`DTSTART`/`DTEND` con `TZID`); nunca
    del `pubDate` del RSS (R16). `UID` es el id de origen.
    """
    if isinstance(text, (bytes, bytearray)):
        text = _decode(bytes(text))
    out: List[RawEvent] = []
    for props in ics_events(text or ""):
        uid = _text(_ics_unescape(props["UID"][1])) if "UID" in props else None
        if not uid:
            continue
        url_prop = _text(props["URL"][1]) if "URL" in props else None
        event_id = meetup_event_id(uid, url_prop)
        start, has_time = _ics_dt(props.get("DTSTART"), log, "meetup %s DTSTART" % uid)
        end = _ics_dt(props.get("DTEND"), log, "meetup %s DTEND" % uid)[0] or None
        location = _text(_ics_unescape(props["LOCATION"][1])) if "LOCATION" in props else None
        description = _text(_ics_unescape(props["DESCRIPTION"][1])) \
            if "DESCRIPTION" in props else None
        out.append(RawEvent(
            provider="meetup",
            origin_id=uid,
            title=_text(_ics_unescape(props["SUMMARY"][1])) if "SUMMARY" in props else "",
            description=description,
            start_local=start,
            end_local=end,
            has_time=has_time,
            closing_local=None,
            closing_explicit=False,
            venue=None,
            city=None,
            region=None,
            location_text=location,
            lat=None,
            lon=None,
            url=meetup_public_url(urlname, event_id) or (url_prop or ""),
            require_approval=None,
            sold_out=None,
            event_type=None,
            calendar=None,
        ))
    return out


def meetup_venue_from_description(text: Optional[str]) -> Optional[Dict[str, str]]:
    """Lugar desde la `description` del RSS de Meetup: las primeras líneas en
    negrita (`**Basta Callejón**`, `**Av. Juan B Justo 2441, CABA**`).

    Devuelve `{"venue", "location_text"}` o None. Solo se leen esas líneas:
    el resto de la descripción no cuenta como lugar (R21).
    """
    if not text:
        return None
    text = html.unescape(text)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    parts: List[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("**"):
            bold = [b.strip() for b in _BOLD_RE.findall(line) if b.strip()]
            if bold:
                parts.extend(bold)
                continue
        break
    if not parts:
        return None
    return {"venue": parts[0], "location_text": ", ".join(parts)}


def parse_meetup_rss_venues(body: Any) -> Dict[str, Dict[str, str]]:
    """RSS de eventos de un grupo de Meetup: `{número de evento: lugar}`,
    emparejado por el número del `link`. Las fechas del RSS no se usan."""
    root = _parse_xml(body, "Meetup RSS")
    venues: Dict[str, Dict[str, str]] = {}
    for item in root.iter("item"):
        link = _child(item, "link") or _child(item, "guid")
        m = _MEETUP_EVENT_ID_RE.search(link or "")
        if not m:
            continue
        venue = meetup_venue_from_description(item.findtext("description"))
        if venue:
            venues.setdefault(m.group(1), venue)
    return venues


def apply_meetup_venues(events: List[RawEvent], venues: Dict[str, Dict[str, str]]) -> int:
    """Completa el lugar de los eventos del iCal sin `LOCATION`. Devuelve
    cuántos completó."""
    filled = 0
    for raw in events:
        if raw.location_text or raw.venue:
            continue
        event_id = meetup_event_id(raw.origin_id, raw.url)
        venue = venues.get(event_id or "")
        if venue:
            raw.venue = venue["venue"]
            raw.location_text = venue["location_text"]
            filled += 1
    return filled


def meetup_urlname(row: Any) -> str:
    """`urlname` del grupo: `config.urlname` o la URL del iCal (A11)."""
    url = _get(row, "url") or ""
    value = source_value("meetup", url, _get(row, "config"))
    if value and value != url:
        return value
    m = _MEETUP_ICAL_RE.search(url)
    return m.group(1) if m else ""


def meetup_rss_url(urlname: str) -> str:
    return "%s%s/events/rss/" % (MEETUP_BASE, urlname)


# --------------------------------------------------------------------------
# Fetchers
# --------------------------------------------------------------------------


class _Run:
    """Acumulador de una corrida de fuente (eventos parciales y crudos)."""

    def __init__(self, ctx: Any, row: Any, deadline: Optional[float]):
        self.ctx = ctx
        self.row = row
        self.kind = _get(row, "kind") or ""
        self.name = _get(row, "name") or ""
        self.deadline = deadline
        self.timeout = source_timeout(row, ctx.log)
        self.events: List[RawEvent] = []
        self.raw_count = 0
        self.started = ctx.monotonic()

    def log(self, line: str) -> None:
        self.ctx.log(line)

    def label(self) -> str:
        return '%s "%s"' % (self.kind, self.name)

    def request(self, url: str, **kwargs: Any) -> Any:
        resp = self.ctx.fetcher.request(url, kind=self.kind, timeout=self.timeout,
                                        deadline=self.deadline, **kwargs)
        if resp.status != 200:
            raise FetchError("HTTP %d en %s" % (resp.status, url))
        return resp

    def result(self, status: str, error: Optional[str] = None) -> SourceResult:
        if status == "ok" and not self.raw_count:
            status = "zero"
        return SourceResult(status=status, raw_count=self.raw_count, events=self.events,
                            error=error, duration_s=max(0.0, self.ctx.monotonic() - self.started))


def _execute(ctx: Any, row: Any, deadline: Optional[float],
             body: Callable[[_Run], None]) -> SourceResult:
    run = _Run(ctx, row, deadline)
    try:
        body(run)
    except FetchTimeout as exc:   # incluye SourceDeadline (R29: se guarda lo procesado)
        error = "%s: %s" % (type(exc).__name__, exc)
        run.log("[radar-eventos] %s: sin respuesta (%s); %d eventos parciales"
                % (run.label(), error, len(run.events)))
        return run.result("timeout", error)
    except (FetchError, ValueError) as exc:   # red, HTTP, > 5 MB, payload inválido
        error = "%s: %s" % (type(exc).__name__, exc)
        run.log("[radar-eventos] %s: error (%s); %d eventos parciales"
                % (run.label(), error, len(run.events)))
        return run.result("error", error)
    return run.result("ok")


def _luma_pages(run: _Run, base: str) -> None:
    """Hasta 3 páginas (R12): sigue `next_cursor` mientras `has_more`."""
    url = base
    seen = set()
    for page in range(LUMA_MAX_PAGES):
        try:
            resp = run.request(url)
        except DuplicateRequest as exc:
            if page == 0:
                run.log("[radar-eventos] %s: sin datos, ya pedida en la pasada (%s)"
                        % (run.label(), exc))
                raise   # "sin datos" para el engine: ni ok ni zero
            run.log("[radar-eventos] %s: página %d ya pedida en la pasada (%s); "
                    "corto la paginación" % (run.label(), page + 1, exc))
            return
        payload = _load_json(resp.body, "Luma")
        run.raw_count += len(_luma_entries(payload))
        run.events.extend(parse_luma_entries(payload, run.log))
        has_more, cursor = luma_page_meta(payload)
        if not has_more or not cursor or cursor in seen:
            return
        seen.add(cursor)
        url = luma_page_url(base, cursor)


def fetch_luma_discover(ctx: Any, row: Any, deadline: Optional[float]) -> SourceResult:
    def body(run: _Run) -> None:
        base = _get(row, "url") or seed_source_url(
            "luma_discover", source_value("luma_discover", "", _get(row, "config")))
        _luma_pages(run, base)
    return _execute(ctx, row, deadline, body)


def fetch_luma_calendar(ctx: Any, row: Any, deadline: Optional[float]) -> SourceResult:
    def body(run: _Run) -> None:
        base = _get(row, "url") or seed_source_url(
            "luma_calendar", source_value("luma_calendar", "", _get(row, "config")))
        _luma_pages(run, base)
    return _execute(ctx, row, deadline, body)


def fetch_nexa(ctx: Any, row: Any, deadline: Optional[float]) -> SourceResult:
    """3 POST JSON-RPC a la misma URL con cuerpos distintos (no se deduplican
    entre sí, plan.md contradicción 2): `initialize`, `list_events` y
    `search_events`; une por `id`."""
    def body(run: _Run) -> None:
        url = _get(row, "url") or NEXA_MCP_URL
        init, list_call, search_call = nexa_requests()
        resp = run.request(url, method="POST", data=init, headers=dict(NEXA_HEADERS))
        nexa_decode(resp.body, resp.headers.get("content-type"))
        lists = []
        for call in (list_call, search_call):
            resp = run.request(url, method="POST", data=call, headers=dict(NEXA_HEADERS))
            message = nexa_decode(resp.body, resp.headers.get("content-type"))
            lists.append(nexa_result_events(message, run.log))
        union = nexa_union(*lists)
        run.raw_count = len(union)
        run.events.extend(parse_nexa_events(union, run.log))
    return _execute(ctx, row, deadline, body)


def fetch_ahack_rss(ctx: Any, row: Any, deadline: Optional[float]) -> SourceResult:
    def body(run: _Run) -> None:
        resp = run.request(_get(row, "url") or AHACK_RSS_URL)
        run.raw_count = ahack_raw_count(resp.body)
        run.events.extend(parse_ahack_rss(resp.body, run.log))
    return _execute(ctx, row, deadline, body)


def fetch_meetup(ctx: Any, row: Any, deadline: Optional[float]) -> SourceResult:
    """iCal del grupo (fecha, hora, título); RSS solo para completar el lugar
    de eventos sin `LOCATION`, emparejando por número de evento (R16)."""
    def body(run: _Run) -> None:
        urlname = meetup_urlname(row)
        if not urlname:
            raise ValueError("Meetup: no se pudo leer el urlname de %r" % (_get(row, "url"),))
        resp = run.request(_get(row, "url") or seed_source_url("meetup", urlname))
        text = _decode(resp.body)
        run.raw_count = len(ics_events(text))
        events = parse_meetup_ics(text, urlname, run.log)
        run.events.extend(events)
        if any(not (e.location_text or e.venue) for e in events):
            venues = _meetup_rss_venues(run, urlname)
            if venues:
                apply_meetup_venues(events, venues)
    return _execute(ctx, row, deadline, body)


def _meetup_rss_venues(run: _Run, urlname: str) -> Dict[str, Dict[str, str]]:
    """RSS complementario: si falla (incluso por timeout propio), los eventos
    quedan sin lugar y no es error de la fuente. Solo el tope de 15 min de la
    fuente (`SourceDeadline`, R29) la corta."""
    rss_url = meetup_rss_url(urlname)
    try:
        if not run.ctx.fetcher.robots_allowed(rss_url):
            run.log("[radar-eventos] %s: robots.txt prohíbe %s; sigo sin lugar del RSS"
                    % (run.label(), rss_url))
            return {}
        resp = run.request(rss_url)
        return parse_meetup_rss_venues(resp.body)
    except SourceDeadline:
        run.log("[radar-eventos] %s: tope de la fuente vencido en el RSS %s"
                % (run.label(), rss_url))
        raise
    except (FetchError, FetchTimeout, DuplicateRequest, ValueError) as exc:
        run.log("[radar-eventos] %s: RSS no disponible (%s: %s); sigo sin lugar del RSS"
                % (run.label(), type(exc).__name__, exc))
        return {}


HANDLERS: Dict[str, Callable[[Any, Any, Optional[float]], SourceResult]] = {
    "luma_discover": fetch_luma_discover,
    "luma_calendar": fetch_luma_calendar,
    "nexa_mcp": fetch_nexa,
    "argentinahackathons_rss": fetch_ahack_rss,
    "meetup": fetch_meetup,
}
