"""Hora AR, parseo de fechas ISO/ICS/RFC 2822, solo fecha y cierres (R11, A10).

Reglas (plan.md, D-7 "Hora AR"):
- `AR` (offset fijo -03:00) es la zona canónica de todo lo guardado y mostrado:
  Argentina no tiene horario de verano desde 2009.
- Los instantes con offset (`Z`, `+00:00`) se convierten a hora AR.
- `zoneinfo` se usa solo para interpretar un `TZID`/`timezone` que no sea
  argentino y que acompañe una hora sin offset. Si la base de zonas no está,
  se usa -03:00 y se loguea una vez por zona (caso borde de la spec).
- Si la fuente solo da fecha, el inicio es esa fecha local a las 00:00 -03:00,
  sin correrla de día (`has_time=False`).

Compatible con Python 3.10: el parseo ISO es propio (regex), así no depende de
que `datetime.fromisoformat` acepte `Z` o fracciones de 3 dígitos.
"""

import re
from datetime import date, datetime, timedelta, timezone, tzinfo
from email.utils import parsedate_tz
from typing import Callable, Dict, Optional, Tuple, Union

AR = timezone(timedelta(hours=-3))
AR_TZ_NAME = "America/Argentina/Buenos_Aires"

# Todas las zonas argentinas son -03:00 sin horario de verano: no hace falta
# zoneinfo para ellas.
_AR_ZONE_RE = re.compile(r"^(america/argentina/[a-z_]+|america/buenos_aires|america/cordoba"
                         r"|america/catamarca|america/jujuy|america/mendoza|america/rosario"
                         r"|argentina/.*|art|gmt-3|utc-3|utc-03:00|-03:00|-0300)$")

_ISO_RE = re.compile(
    r"^\s*(\d{4})-(\d{2})-(\d{2})"
    r"(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?"
    r"\s*(Z|z|[+-]\d{2}(?::?\d{2})?)?\s*$"
)
_ICS_RE = re.compile(r"^\s*(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?\s*$", re.I)

Moment = Union[str, datetime]


def _default_log(line: str) -> None:
    print(line, flush=True)


_log: Callable[[str], None] = _default_log
_zone_cache: Dict[str, tzinfo] = {}
_warned_zones = set()


def set_log(fn: Optional[Callable[[str], None]]) -> None:
    """Reemplaza la función de log del módulo (None vuelve a `print`)."""
    global _log
    _log = fn if fn is not None else _default_log


def clear_zone_cache() -> None:
    """Olvida las zonas cargadas y los avisos ya logueados (para tests)."""
    _zone_cache.clear()
    _warned_zones.clear()


def _is_ar_zone(name: str) -> bool:
    return bool(_AR_ZONE_RE.match(name.strip().lower()))


def get_zone(name: Optional[str]) -> tzinfo:
    """`tzinfo` para un nombre IANA; AR si es argentino, vacío o no disponible."""
    if not name or _is_ar_zone(name):
        return AR
    name = name.strip().strip('"')
    if name in _zone_cache:
        return _zone_cache[name]
    try:
        import zoneinfo  # stdlib 3.9+; puede faltar la base tzdata
        zone = zoneinfo.ZoneInfo(name)
    except Exception as exc:  # ImportError, ZoneInfoNotFoundError, ValueError
        if name not in _warned_zones:
            _warned_zones.add(name)
            _log("[radar-eventos] zona horaria %r no disponible (%s: %s); uso -03:00"
                 % (name, type(exc).__name__, exc))
        zone = AR
    _zone_cache[name] = zone
    return zone


def now_ar() -> datetime:
    return datetime.now(AR)


def to_ar(dt: datetime) -> datetime:
    """Convierte a hora AR; un datetime naive se interpreta como hora AR."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=AR)
    return dt.astimezone(AR)


def format_local(dt: datetime) -> str:
    """`YYYY-MM-DDTHH:MM:SS-03:00` (sin microsegundos)."""
    return to_ar(dt).replace(microsecond=0).isoformat()


def date_local(d: date) -> str:
    """Fecha calendario a las 00:00 -03:00, sin corrimiento de día."""
    return format_local(datetime(d.year, d.month, d.day, tzinfo=AR))


def _offset(text: str) -> tzinfo:
    if text in ("Z", "z"):
        return timezone.utc
    sign = -1 if text[0] == "-" else 1
    digits = text[1:].replace(":", "")
    hours = int(digits[:2])
    minutes = int(digits[2:4]) if len(digits) >= 4 else 0
    return timezone(sign * timedelta(hours=hours, minutes=minutes))


def parse_iso_local(value: str, tz_name: Optional[str] = None) -> Tuple[str, bool]:
    """Parsea ISO 8601 y devuelve `(hora AR ISO, has_time)`.

    - Con offset (`Z`, `+00:00`, `-0300`): se convierte a hora AR.
    - Sin offset: se interpreta en `tz_name` (AR si falta o no está la zona).
    - Solo fecha (`2026-12-03`): 00:00 -03:00 y `has_time=False`.
    Lanza ValueError si no es una fecha ISO válida.
    """
    if not isinstance(value, str):
        raise ValueError("fecha ISO no es texto: %r" % (value,))
    m = _ISO_RE.match(value)
    if not m:
        raise ValueError("fecha ISO inválida: %r" % (value,))
    y, mo, d, hh, mi, ss, frac, off = m.groups()
    if hh is None:
        if off is not None:
            raise ValueError("fecha ISO inválida (offset sin hora): %r" % (value,))
        return date_local(date(int(y), int(mo), int(d))), False
    micro = int((frac or "0")[:6].ljust(6, "0"))
    tz = _offset(off) if off else get_zone(tz_name)
    dt = datetime(int(y), int(mo), int(d), int(hh), int(mi), int(ss or 0), micro, tzinfo=tz)
    return format_local(dt), True


def parse_ics_value(value: str, tzid: Optional[str] = None,
                    value_type: Optional[str] = None) -> Tuple[str, bool]:
    """Parsea un valor DATE/DATE-TIME de iCalendar y devuelve `(hora AR ISO, has_time)`.

    `20261127T180000Z` es UTC; `20261203T190000` con `tzid` usa esa zona (AR si
    falta); `20261203` o `value_type='DATE'` es solo fecha.
    """
    m = _ICS_RE.match(value or "")
    if not m:
        raise ValueError("fecha iCal inválida: %r" % (value,))
    y, mo, d, hh, mi, ss, z = m.groups()
    if hh is None or (value_type or "").upper() == "DATE":
        return date_local(date(int(y), int(mo), int(d))), False
    tz = timezone.utc if z else get_zone(tzid)
    dt = datetime(int(y), int(mo), int(d), int(hh), int(mi), int(ss or 0), tzinfo=tz)
    return format_local(dt), True


def parse_ics_line(line: str) -> Tuple[str, bool]:
    """Parsea una propiedad completa, p. ej. `DTSTART;TZID=America/...:20261203T190000`."""
    if ":" not in (line or ""):
        raise ValueError("propiedad iCal sin valor: %r" % (line,))
    head, value = _split_ics_property(line)
    params: Dict[str, str] = {}
    for part in head.split(";")[1:]:
        if "=" in part:
            k, v = part.split("=", 1)
            params[k.strip().upper()] = v.strip().strip('"')
    return parse_ics_value(value.strip(), params.get("TZID"), params.get("VALUE"))


def _split_ics_property(line: str) -> Tuple[str, str]:
    """Separa `NOMBRE;PARAMS` de `VALOR` respetando comillas en los parámetros."""
    in_quotes = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_quotes = not in_quotes
        elif ch == ":" and not in_quotes:
            return line[:i], line[i + 1:]
    raise ValueError("propiedad iCal sin valor: %r" % (line,))


def date_from_rfc2822(value: str) -> str:
    """Fecha calendario de un `pubDate` RFC 2822 a las 00:00 -03:00, sin
    convertir de zona (`Sat, 28 Nov 2026 00:00:00 GMT` da el 28, no el 27)."""
    parts = parsedate_tz(value or "")
    if not parts:
        raise ValueError("fecha RFC 2822 inválida: %r" % (value,))
    return date_local(date(parts[0], parts[1], parts[2]))


def date_from_epoch_ms(ms: Union[int, float]) -> str:
    """Fecha calendario UTC de un epoch en ms (medianoche UTC, como `untilDate`
    de developers.events) a las 00:00 -03:00, sin correrla de día."""
    d = datetime.fromtimestamp(float(ms) / 1000.0, tz=timezone.utc).date()
    return date_local(d)


def parse_local(value: Moment) -> datetime:
    """Datetime aware en hora AR desde un `start_local` guardado (o un datetime)."""
    if isinstance(value, datetime):
        return to_ar(value)
    m = _ISO_RE.match(value or "")
    if not m:
        raise ValueError("fecha local inválida: %r" % (value,))
    y, mo, d, hh, mi, ss, frac, off = m.groups()
    micro = int((frac or "0")[:6].ljust(6, "0"))
    tz = _offset(off) if off else AR
    dt = datetime(int(y), int(mo), int(d), int(hh or 0), int(mi or 0), int(ss or 0), micro,
                  tzinfo=tz)
    return dt.astimezone(AR)


def normalize_local(value: str) -> str:
    """Reformatea un ISO local a `YYYY-MM-DDTHH:MM:SS-03:00` (ValueError si no parsea)."""
    return format_local(parse_local(value))


def local_date(value: Moment) -> date:
    """Fecha calendario de Argentina de un instante."""
    return parse_local(value).date()


def closing_in_days(closing_local: Moment, now: datetime) -> int:
    """A10: días calendario AR entre el cierre y hoy (hoy 0, mañana 1, ayer -1)."""
    return (local_date(closing_local) - to_ar(now).date()).days


def is_finished(start_local: Moment, end_local: Optional[Moment], has_time: bool,
                now: datetime) -> bool:
    """R27: el evento ya terminó.

    Con hora: el fin (o el inicio si no hay fin) es anterior a ahora.
    Sin hora (`has_time=False`): cuando terminó ese día en hora AR.
    """
    ref = end_local if end_local else start_local
    if has_time:
        return parse_local(ref) < to_ar(now)
    return local_date(ref) < to_ar(now).date()
