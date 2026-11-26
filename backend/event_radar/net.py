"""Red del radar de eventos: cliente HTTP, política SSRF, rate limit y robots.txt.

Contrato (plan.md, sección 4):

- `Fetcher.request(url, *, kind, method="GET", data=None, headers=None,
  timeout=20, deadline=None) -> Response`.
- `Fetcher.robots_allowed(url) -> bool` (caché de 24 h; lanza
  `RobotsUnavailable`), `Fetcher.begin_pass()` / `end_pass()`.
- `UrlPolicy.validate(url, kind)` (lanza `PolicyError`).
- `canonical_source_url(kind, value) -> str` (A11; lanza `ValueError`).
- Excepciones: `FetchTimeout`, `FetchError`, `TooLarge`, `PolicyError`,
  `RobotsDisallowed`, `RobotsUnavailable`, `SourceDeadline`,
  `DuplicateRequest`.

Reglas que implementa:

- R29: timeout explícito por request (20 s por defecto) medido como tiempo
  total real: un watchdog (`threading.Timer`) cierra el socket al vencer el
  plazo, así corta también la conexión, el handshake TLS, la línea de
  estado, los headers y las líneas de chunk aunque el servidor gotee bytes;
  una respuesta cortada por el watchdog nunca se devuelve como éxito.
  Riesgo residual: la resolución DNS (de `UrlPolicy` y de la conexión) queda
  acotada por el resolver del sistema, no por este plazo. Cuerpo comprimido y descomprimido con tope de 5 MB (`TooLarge`,
  también contra bombas gzip) y tope por fuente con `deadline`: instante
  absoluto en el reloj `monotonic` del fetcher; vencido, `SourceDeadline`.
- R30: 3 s como mínimo entre dos requests al mismo dominio en todo el
  proceso (`DomainRateLimiter`, también para robots.txt y redirects);
  dedupe por pasada con clave `(método, URL, sha256(cuerpo))`;
  `Accept-Encoding: gzip`; redirects seguidos a mano (hasta 4) y validados
  con la misma política: nunca a `http://` ni a hosts no públicos.
- R31: `User-Agent` propio; cliente propio sobre `http.client`, sin
  reutilizar los helpers HTTP del backend.
- Hosts: `canonical_host` es la única forma canónica (minúsculas, sin punto
  final, IDNA a ASCII, sin `:443`), usada por `UrlPolicy`, el rate limit, la
  caché de robots, el dedupe y `canonical_source_url`. Toda URL con
  espacios o caracteres de control se rechaza (`PolicyError`).
- R40 / R10: `UrlPolicy` exige `https`, sin credenciales, host permitido
  por tipo y, para `page_hash`, que el host no sea `localhost` ni una IP
  literal en ninguna forma (decimal, octal, hex, abreviada como `127.1`,
  dígitos fullwidth: se detecta sin consultar al SO) y que resuelva solo a IPs públicas (rechaza privada, loopback,
  link-local, reservada, multicast, no especificada y `100.64.0.0/10`,
  que Python 3.10 no marca como privada).
  Riesgo residual aceptado (plan.md, D-3): DNS rebinding entre la
  validación y la conexión.
- D2 / A3: robots.txt cacheado 24 h por dominio; 404 permite todo, 401/403
  prohíben, error de red o 5xx lanza `RobotsUnavailable` (no se cachea).

Solo stdlib y compatible con Python 3.10.
"""

from __future__ import annotations

import hashlib
import http.client
import ipaddress
import json
import re
import socket
import ssl
import threading
import time
import urllib.robotparser
import zlib
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, Optional, Tuple
from urllib.parse import quote, urljoin, urlsplit, urlunsplit

USER_AGENT = "HomelabRadarEventos/1.0 (uso personal; radar de eventos)"
ROBOTS_AGENT = "HomelabRadarEventos"

DEFAULT_TIMEOUT = 20.0
MAX_BODY_BYTES = 5 * 1024 * 1024
MIN_DOMAIN_INTERVAL = 3.0
MAX_REDIRECTS = 4
ROBOTS_TTL = 24 * 3600.0
DEDUPE_MAX_ITEM = 1 * 1024 * 1024
DEDUPE_MAX_TOTAL = 8 * 1024 * 1024
_READ_CHUNK = 64 * 1024

# R10: tipos válidos y host permitido por tipo (None = cualquier host público).
KIND_HOSTS: Dict[str, Optional[str]] = {
    "luma_discover": "api.lu.ma",
    "luma_calendar": "api.lu.ma",
    "nexa_mcp": "nexa.builders",
    "argentinahackathons_rss": "argentinahackathons.com",
    "meetup": "www.meetup.com",
    "condor_nest": "condor-nest.lat",
    "devevents_cfps": "developers.events",
    "page_hash": None,
}
KINDS = tuple(KIND_HOSTS)

# A11: URLs canónicas de los tipos con valor y de los singletons.
LUMA_DISCOVER_URL = ("https://api.lu.ma/discover/get-paginated-events"
                     "?discover_place_api_id=discplace-wX2J5xGwAJpznew"
                     "&pagination_limit=50&query=")
LUMA_CALENDAR_URL = ("https://api.lu.ma/calendar/get-items?calendar_api_id=%s"
                     "&period=future&pagination_limit=50")
MEETUP_ICAL_URL = "https://www.meetup.com/%s/events/ical/"
SINGLETON_URLS: Dict[str, str] = {
    "nexa_mcp": "https://nexa.builders/api/mcp",
    "argentinahackathons_rss": "https://argentinahackathons.com/rss.xml",
    "condor_nest": "https://condor-nest.lat/sitemap.xml",
    "devevents_cfps": "https://developers.events/all-cfps.json",
}
_CAL_ID_RE = re.compile(r"cal-[A-Za-z0-9]{8,24}")
_MEETUP_RE = re.compile(r"[A-Za-z0-9_-]{2,80}")

_CGNAT = ipaddress.ip_network("100.64.0.0/10")
_HOST_CHARS_RE = re.compile(r"[a-z0-9._-]+")
# WHATWG URL: un host cuyo último label es un número (decimal o 0x...) se
# interpreta como IPv4 (127.1, 2130706433, 0x7f.1, 0177.0.0.1...).
_NUMERIC_LABEL_RE = re.compile(r"[0-9]+|0x[0-9a-f]*")
_DEFAULT_PORTS = {"https": 443, "http": 80}


# --------------------------------------------------------------------------
# Excepciones
# --------------------------------------------------------------------------

class NetError(Exception):
    """Base de las excepciones de red del radar."""


class FetchError(NetError):
    """El request falló (red, TLS, HTTP malformado, redirects): fuente `error`."""


class FetchTimeout(NetError, TimeoutError):
    """El request superó su timeout: fuente `timeout`."""


class SourceDeadline(FetchTimeout):
    """Se venció el tope total de la fuente (R29, 15 min)."""


class TooLarge(FetchError):
    """Cuerpo (comprimido o descomprimido) de más de 5 MB: fuente `error`."""


class PolicyError(FetchError, ValueError):
    """URL rechazada por la política SSRF (R40), también tras un redirect."""


class RobotsDisallowed(NetError):
    """robots.txt prohíbe el path para el User-Agent del radar (D2, A3)."""


class RobotsUnavailable(FetchError):
    """robots.txt no disponible (red o 5xx): fuente `error` en esa pasada."""


class DuplicateRequest(NetError):
    """La misma `(método, URL, cuerpo)` ya se pidió en la pasada y su
    respuesta no quedó en caché: el llamador la trata como ya procesada."""


# --------------------------------------------------------------------------
# Respuesta
# --------------------------------------------------------------------------

class Headers(dict):
    """dict con claves en minúscula y búsqueda sin distinguir mayúsculas."""

    def __init__(self, items: Iterable[Tuple[str, str]] = ()):
        super().__init__()
        for key, value in items:
            key = str(key).lower()
            if key in self:  # headers repetidos se unen como en HTTP
                value = "%s, %s" % (dict.__getitem__(self, key), value)
            dict.__setitem__(self, key, value)

    def __getitem__(self, key):
        return super().__getitem__(str(key).lower())

    def __contains__(self, key):
        return super().__contains__(str(key).lower())

    def get(self, key, default=None):
        return super().get(str(key).lower(), default)


@dataclass
class Response:
    status: int
    headers: Headers
    body: bytes            # ya descomprimido si vino con gzip
    final_url: str


# --------------------------------------------------------------------------
# Política SSRF
# --------------------------------------------------------------------------

def _has_bad_chars(text: str) -> bool:
    """True si hay espacios o caracteres de control (urlsplit los borraría)."""
    return any(ch.isspace() or ord(ch) < 32 or ord(ch) == 127 for ch in text)


def canonical_host(host: str) -> str:
    """Forma canónica única de un host (R30, R40, A3, A11). Lanza `PolicyError`.

    Minúsculas, sin punto final, IDNA a ASCII (así `ⓛⓞⓒⓐⓛⓗⓞⓢⓣ` es
    `localhost` y los dígitos fullwidth son ASCII) y solo `[a-z0-9._-]`. Un
    literal IPv6 (con o sin corchetes) queda en su forma comprimida, sin zona.
    """
    if not isinstance(host, str) or not host:
        raise PolicyError("host vacío")
    if _has_bad_chars(host):
        raise PolicyError("host con espacios o caracteres de control: %r" % (host,))
    h = host
    if h.startswith("[") and h.endswith("]"):
        h = h[1:-1]
    if ":" in h:
        try:
            return str(ipaddress.ip_address(h.split("%", 1)[0]))
        except ValueError as exc:
            raise PolicyError("literal IPv6 inválido: %r" % (host,)) from exc
    h = h.rstrip(".")
    if not h:
        raise PolicyError("host vacío: %r" % (host,))
    try:
        h = h.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise PolicyError("host inválido (IDNA) %r: %s" % (host, exc)) from exc
    h = h.lower().rstrip(".")
    if not h or not _HOST_CHARS_RE.fullmatch(h):
        raise PolicyError("host con caracteres no permitidos: %r" % (host,))
    return h


def _is_ip_literal(host: str) -> bool:
    """True si el host canónico es una IP en cualquier forma (sin usar DNS)."""
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        pass
    if _NUMERIC_LABEL_RE.fullmatch(host.rsplit(".", 1)[-1]):
        return True
    try:
        socket.inet_aton(host)
        return True
    except (OSError, ValueError):
        return False


@dataclass(frozen=True)
class _Url:
    scheme: str
    host: str             # canónico
    port: Optional[int]   # None si es el puerto por defecto del esquema
    netloc: str           # host canónico (con corchetes si es IPv6) + puerto no default
    path: str
    query: str

    def key(self) -> str:
        """URL normalizada para dedupe (sin fragmento, path vacío = /)."""
        return urlunsplit((self.scheme, self.netloc, self.path or "/", self.query, ""))

    def origin(self) -> str:
        return "%s://%s" % (self.scheme, self.netloc)


def _split_url(url: Any) -> _Url:
    """Parsea y normaliza una URL. Lanza `PolicyError` si es inválida."""
    if not isinstance(url, str) or not url:
        raise PolicyError("URL vacía")
    if _has_bad_chars(url):
        raise PolicyError("URL con espacios o caracteres de control: %r" % (url,))
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise PolicyError("URL inválida %r: %s" % (url, exc)) from exc
    if parts.username is not None or parts.password is not None or "@" in parts.netloc:
        raise PolicyError("URL con credenciales: %r" % (url,))
    if not parts.hostname:
        raise PolicyError("URL sin host: %r" % (url,))
    scheme = parts.scheme.lower()
    host = canonical_host(parts.hostname)
    if port is not None and port == _DEFAULT_PORTS.get(scheme):
        port = None
    hostport = "[%s]" % host if ":" in host else host
    netloc = hostport if port is None else "%s:%d" % (hostport, port)
    return _Url(scheme, host, port, netloc, parts.path, parts.query)


def _ip_is_blocked(ip: "ipaddress._BaseAddress") -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    if isinstance(ip, ipaddress.IPv4Address) and ip in _CGNAT:
        return True
    return (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
            or ip.is_multicast or ip.is_unspecified
            or bool(getattr(ip, "is_site_local", False)))


class UrlPolicy:
    """Validador SSRF de URLs salientes (R10, R40).

    `resolver` tiene la firma de `socket.getaddrinfo`; por defecto se busca
    `socket.getaddrinfo` en cada llamada (así los tests pueden mockearlo).
    """

    def __init__(self, resolver: Optional[Callable[..., Any]] = None):
        self._resolver = resolver

    def _resolve(self, host: str):
        resolver = self._resolver or socket.getaddrinfo
        return resolver(host, 443, 0, socket.SOCK_STREAM)

    def validate(self, url: str, kind: str) -> None:
        if kind not in KIND_HOSTS:
            raise PolicyError("tipo de fuente inválido: %r" % (kind,))
        u = _split_url(url)
        if u.scheme != "https":
            raise PolicyError("solo se permite https: %r" % (url,))
        if u.port is not None:
            raise PolicyError("puerto no permitido %s en %r" % (u.port, url))
        allowed = KIND_HOSTS[kind]
        if allowed is not None:
            if u.host != allowed:
                raise PolicyError("host %r no permitido para %s (solo %s)" % (u.host, kind, allowed))
            return
        self._validate_public_host(u.host)

    def _validate_public_host(self, host: str) -> None:
        if host == "localhost" or host.endswith(".localhost"):
            raise PolicyError("host local no permitido: %r" % (host,))
        if _is_ip_literal(host):
            raise PolicyError("IP literal no permitida: %r" % (host,))
        try:
            infos = self._resolve(host)
        except (OSError, UnicodeError) as exc:
            raise PolicyError("el host %r no resuelve: %s" % (host, exc)) from exc
        addresses = []
        for info in infos or ():
            try:
                addresses.append(ipaddress.ip_address(str(info[4][0]).split("%", 1)[0]))
            except (ValueError, IndexError, TypeError) as exc:
                raise PolicyError("dirección inválida para %r: %r" % (host, info)) from exc
        if not addresses:
            raise PolicyError("el host %r no resuelve a ninguna IP" % (host,))
        for ip in addresses:
            if _ip_is_blocked(ip):
                raise PolicyError("el host %r resuelve a una IP no pública (%s)" % (host, ip))


DEFAULT_POLICY = UrlPolicy()


def canonical_source_url(kind: str, value: Any, *, policy: Optional[UrlPolicy] = None) -> str:
    """URL canónica de una fuente (A11). Lanza `ValueError` si no valida (R40).

    `PolicyError` es subclase de `ValueError`. `policy` permite inyectar un
    resolver DNS en los tests. En `page_hash` el host queda canónico
    (`canonical_host`) y sin `:443` ni fragmento.
    """
    if kind not in KIND_HOSTS:
        raise ValueError("tipo de fuente inválido: %r" % (kind,))
    policy = policy or DEFAULT_POLICY
    if kind in SINGLETON_URLS:
        return SINGLETON_URLS[kind]  # los singletons ignoran `value`
    if not isinstance(value, str):
        raise ValueError("el valor de %s tiene que ser texto" % kind)
    value = value.strip()
    if kind == "luma_discover":
        if not 1 <= len(value) <= 60:
            raise ValueError("la keyword tiene que tener de 1 a 60 caracteres")
        url = LUMA_DISCOVER_URL + quote(value, safe="")
    elif kind == "luma_calendar":
        if not _CAL_ID_RE.fullmatch(value):
            raise ValueError("cal-id inválido: %r" % (value,))
        url = LUMA_CALENDAR_URL % value
    elif kind == "meetup":
        if not _MEETUP_RE.fullmatch(value):
            raise ValueError("urlname de Meetup inválido: %r" % (value,))
        url = MEETUP_ICAL_URL % value
    else:  # page_hash
        if not value.lower().startswith("https://"):
            raise ValueError("la URL tiene que empezar con https://")
        u = _split_url(value)
        url = urlunsplit(("https", u.netloc, u.path, u.query, ""))
    policy.validate(url, kind)
    return url


# --------------------------------------------------------------------------
# Rate limit por dominio
# --------------------------------------------------------------------------

class DomainRateLimiter:
    """Separa por al menos `interval` segundos los requests a un mismo host.

    Reserva el turno bajo el lock y duerme fuera de él, así varios hilos se
    encolan sin superponerse. Usa el reloj inyectado (`monotonic`/`sleep`).
    """

    def __init__(self, interval: float = MIN_DOMAIN_INTERVAL,
                 monotonic: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], None] = time.sleep):
        self.interval = float(interval)
        self._monotonic = monotonic
        self._sleep = sleep
        self._next: Dict[str, float] = {}
        self._lock = threading.Lock()

    def wait(self, host: str, deadline: Optional[float] = None) -> None:
        try:
            host = canonical_host(host)
        except PolicyError:
            host = (host or "").lower()
        with self._lock:
            now = self._monotonic()
            slot = max(now, self._next.get(host, now))
            if deadline is not None and slot >= deadline:
                raise SourceDeadline("tope de la fuente vencido esperando turno para %s" % host)
            self._next[host] = slot + self.interval
        wait = slot - now
        if wait > 0:
            self._sleep(wait)


# --------------------------------------------------------------------------
# Fetcher
# --------------------------------------------------------------------------

def _encode_body(data: Any, headers: Dict[str, str]) -> Optional[bytes]:
    if data is None:
        return None
    if isinstance(data, (dict, list)):
        if not any(k.lower() == "content-type" for k in headers):
            headers["Content-Type"] = "application/json"
        return json.dumps(data, ensure_ascii=False).encode("utf-8")
    if isinstance(data, str):
        return data.encode("utf-8")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    raise TypeError("cuerpo no soportado: %s" % type(data).__name__)


class _Watchdog:
    """Plazo total real de un request (R29).

    Un `threading.Timer` de `limit` segundos (reloj real) hace `shutdown` del
    socket asociado: cualquier `recv` bloqueado, aunque el servidor gotee un
    byte por vez en la línea de estado, los headers, el handshake TLS o una
    línea de chunk, vuelve con error o EOF. Quien lee revisa `expired` y
    convierte eso en `FetchTimeout`/`SourceDeadline`.
    """

    def __init__(self, limit: float):
        self._end = time.monotonic() + limit
        self._lock = threading.Lock()
        self._sock: Optional[socket.socket] = None
        self._fired = threading.Event()
        self._timer = threading.Timer(max(limit, 0.0), self._fire)
        self._timer.daemon = True

    def start(self) -> None:
        self._timer.start()

    def cancel(self) -> None:
        self._timer.cancel()

    @property
    def expired(self) -> bool:
        return self._fired.is_set()

    @property
    def sock(self) -> Optional[socket.socket]:
        with self._lock:
            return self._sock

    def remaining(self) -> float:
        return self._end - time.monotonic()

    def attach(self, sock: socket.socket) -> None:
        with self._lock:
            self._sock = sock
            fired = self._fired.is_set()
        if fired:
            self._kill(sock)

    def _fire(self) -> None:
        with self._lock:
            self._fired.set()
            sock = self._sock
        if sock is not None:
            self._kill(sock)

    @staticmethod
    def _kill(sock: socket.socket) -> None:
        try:  # shutdown del fd (también si es SSLSocket) sin tocar el estado TLS
            socket.socket.shutdown(sock, socket.SHUT_RDWR)
        except (OSError, ValueError):
            pass  # ya cerrado o desconectado: no hay nada que cortar


class Fetcher:
    """Cliente HTTP del radar (R29-R31, R40, D2, A3).

    `monotonic` y `sleep` se inyectan (en producción, los de `RadarContext`);
    `deadline` en `request` es un instante absoluto de ese `monotonic`.
    Devuelve `Response` para cualquier código HTTP final (incluido 404);
    los 3xx se siguen a mano.
    """

    def __init__(self, *, policy: Optional[UrlPolicy] = None,
                 monotonic: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], None] = time.sleep,
                 log: Optional[Callable[[str], None]] = None,
                 min_interval: float = MIN_DOMAIN_INTERVAL,
                 max_body: int = MAX_BODY_BYTES,
                 ssl_context: Optional[ssl.SSLContext] = None):
        self.policy = policy or DEFAULT_POLICY
        self._monotonic = monotonic
        self._log = log or (lambda line: print(line, flush=True))
        self.max_body = int(max_body)
        self.limiter = DomainRateLimiter(min_interval, monotonic, sleep)
        self._ssl_context = ssl_context
        self._ssl_lock = threading.Lock()
        self._pass_lock = threading.Lock()
        self._in_pass = False
        self._seen: set = set()
        self._cache: Dict[tuple, Response] = {}
        self._cache_bytes = 0
        self._robots_lock = threading.Lock()
        self._robots: Dict[str, Tuple[Any, float]] = {}

    # --- pasada -------------------------------------------------------
    def begin_pass(self) -> None:
        with self._pass_lock:
            self._in_pass = True
            self._seen = set()
            self._cache = {}
            self._cache_bytes = 0

    def end_pass(self) -> None:
        with self._pass_lock:
            self._in_pass = False
            self._seen = set()
            self._cache = {}
            self._cache_bytes = 0

    # --- request ------------------------------------------------------
    def request(self, url: str, *, kind: str, method: str = "GET", data: Any = None,
                headers: Optional[Dict[str, str]] = None, timeout: Optional[float] = DEFAULT_TIMEOUT,
                deadline: Optional[float] = None) -> Response:
        method = method.upper()
        req_headers = dict(headers or {})
        body = _encode_body(data, req_headers)
        norm = _split_url(url)  # rechaza espacios y control antes que nada
        self.policy.validate(url, kind)

        key = (method, norm.key(), hashlib.sha256(body or b"").hexdigest())
        with self._pass_lock:
            if self._in_pass:
                if key in self._seen:
                    cached = self._cache.get(key)
                    if cached is None:
                        raise DuplicateRequest("ya pedido en esta pasada: %s %s" % (method, url))
                    return cached
                self._seen.add(key)

        response = self._fetch(url, kind=kind, method=method, body=body,
                               headers=req_headers, timeout=timeout, deadline=deadline)

        with self._pass_lock:
            if self._in_pass and key in self._seen:
                size = len(response.body)
                if size <= DEDUPE_MAX_ITEM and self._cache_bytes + size <= DEDUPE_MAX_TOTAL:
                    self._cache[key] = response
                    self._cache_bytes += size
        return response

    def _fetch(self, url: str, *, kind: str, method: str, body: Optional[bytes],
               headers: Dict[str, str], timeout: Optional[float],
               deadline: Optional[float]) -> Response:
        current, cur_method, cur_body = url, method, body
        for hop in range(MAX_REDIRECTS + 1):
            if hop:
                self.policy.validate(current, kind)
            status, resp_headers, payload = self._one(current, cur_method, cur_body, headers,
                                                      timeout, deadline)
            if status in (301, 302, 303, 307, 308):
                location = resp_headers.get("location")
                if not location:
                    raise FetchError("redirect %d sin Location en %s" % (status, current))
                current = urljoin(current, location.strip())
                if status == 303 or (status in (301, 302) and cur_method == "POST"):
                    cur_method, cur_body = "GET", None
                continue
            return Response(status=status, headers=resp_headers, body=payload, final_url=current)
        raise FetchError("demasiados redirects (más de %d) desde %s" % (MAX_REDIRECTS, url))

    def _limits(self, timeout: Optional[float], deadline: Optional[float]) -> Tuple[float, bool]:
        """Devuelve (segundos disponibles, si el límite es el deadline)."""
        limit = float(timeout) if timeout is not None else DEFAULT_TIMEOUT
        by_deadline = False
        if deadline is not None:
            remaining = deadline - self._monotonic()
            if remaining <= 0:
                raise SourceDeadline("tope de la fuente vencido")
            if remaining < limit:
                limit, by_deadline = remaining, True
        return limit, by_deadline

    def _get_ssl_context(self) -> ssl.SSLContext:
        """Contexto TLS único por fetcher (no recarga el bundle de CAs por request)."""
        with self._ssl_lock:
            if self._ssl_context is None:
                self._ssl_context = ssl.create_default_context()
            return self._ssl_context

    def _connect(self, conn: http.client.HTTPConnection, u: _Url, port: int, limit: float,
                 watchdog: "_Watchdog") -> None:
        """Abre el socket a mano para que el watchdog lo vea desde el primer
        byte (también durante el handshake TLS) y lo deja en `conn.sock`."""
        raw = self._connect_any(u.host, port, watchdog)
        sock = raw
        if u.scheme == "https":
            try:
                sock = self._get_ssl_context().wrap_socket(
                    raw, server_hostname=u.host, do_handshake_on_connect=False)
            except BaseException:
                raw.close()
                raise
            watchdog.attach(sock)
            try:
                sock.do_handshake()
            except BaseException:
                sock.close()
                raise
        conn.sock = sock

    @staticmethod
    def _connect_any(host: str, port: int, watchdog: "_Watchdog") -> socket.socket:
        """Como `socket.create_connection`, pero cada intento usa el plazo que
        queda (no el plazo entero por IP) y el watchdog ve el socket antes del
        `connect`. Con un host de varias IPs inalcanzables el corte sigue siendo
        el plazo total (R29). La resolución DNS queda fuera del plazo (riesgo
        residual documentado arriba)."""
        last_err: Optional[BaseException] = None
        for family, stype, proto, _canon, addr in socket.getaddrinfo(
                host, port, 0, socket.SOCK_STREAM):
            remaining = watchdog.remaining()
            if watchdog.expired or remaining <= 0:
                break
            sock = socket.socket(family, stype, proto)
            watchdog.attach(sock)
            try:
                sock.settimeout(remaining)
                sock.connect(addr)
                return sock
            except OSError as exc:
                last_err = exc
                sock.close()
        if watchdog.expired or watchdog.remaining() <= 0:
            raise socket.timeout("connect: plazo total agotado")
        if last_err is not None:
            raise last_err
        raise OSError("sin direcciones para %s" % host)

    def _one(self, url: str, method: str, body: Optional[bytes], headers: Dict[str, str],
             timeout: Optional[float], deadline: Optional[float]):
        u = _split_url(url)
        port = u.port or _DEFAULT_PORTS.get(u.scheme)
        if port is None:
            raise PolicyError("esquema no soportado %r en %s" % (u.scheme, url))
        self.limiter.wait(u.host, deadline)
        limit, by_deadline = self._limits(timeout, deadline)

        def timed_out(where: str) -> NetError:
            if by_deadline:
                return SourceDeadline("tope de la fuente vencido (%s) en %s" % (where, url))
            return FetchTimeout("sin respuesta en %.1f s (%s) de %s" % (limit, where, url))

        path = u.path or "/"
        if u.query:
            path += "?" + u.query
        send = {k: v for k, v in headers.items()
                if k.lower() not in ("user-agent", "accept-encoding", "host", "content-length",
                                     "connection")}
        send["User-Agent"] = USER_AGENT
        send["Accept-Encoding"] = "gzip"
        send.setdefault("Accept", "*/*")
        send["Connection"] = "close"
        if body is not None:
            send["Content-Length"] = str(len(body))

        if u.scheme == "https":
            conn = http.client.HTTPSConnection(u.host, port, timeout=limit,
                                               context=self._get_ssl_context())
        else:  # solo alcanzable con una política de tests que permita http local
            conn = http.client.HTTPConnection(u.host, port, timeout=limit)
        watchdog = _Watchdog(limit)
        resp = None
        watchdog.start()
        try:
            try:
                self._connect(conn, u, port, limit, watchdog)
                conn.request(method, path, body=body, headers=send)
                resp = conn.getresponse()
                status = resp.status
                resp_headers = Headers(resp.getheaders())
                length = resp_headers.get("content-length")
                if length and length.strip().isdigit() and int(length) > self.max_body:
                    raise TooLarge("cuerpo de %s bytes (tope %d) en %s" % (length, self.max_body, url))
                chunks, total = [], 0
                while True:
                    remaining = watchdog.remaining()
                    if watchdog.expired or remaining <= 0:
                        raise timed_out("lectura")
                    sock = watchdog.sock  # conn.sock queda en None si la respuesta cierra
                    if sock is not None:
                        try:
                            sock.settimeout(remaining)
                        except OSError:
                            pass  # ya cerrado por el watchdog: el read de abajo falla
                    chunk = resp.read1(_READ_CHUNK) if hasattr(resp, "read1") else resp.read(_READ_CHUNK)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > self.max_body:
                        raise TooLarge("cuerpo de más de %d bytes en %s" % (self.max_body, url))
                    chunks.append(chunk)
                raw = b"".join(chunks)
                watchdog.cancel()
                if watchdog.expired:  # lo cortado por el watchdog nunca es éxito
                    raise timed_out("respuesta")
            except NetError:
                raise
            except socket.timeout as exc:
                raise timed_out("socket") from exc
            except (OSError, http.client.HTTPException, ValueError) as exc:
                if watchdog.expired:
                    raise timed_out(type(exc).__name__) from exc
                if isinstance(exc, ssl.SSLError):
                    raise FetchError("TLS: %s en %s" % (exc, url)) from exc
                raise FetchError("%s: %s en %s" % (type(exc).__name__, exc, url)) from exc
        finally:
            watchdog.cancel()
            if resp is not None:
                resp.close()
            conn.close()

        encoding = (resp_headers.get("content-encoding") or "identity").strip().lower()
        if encoding == "gzip" and raw:
            payload = self._gunzip(raw, url)
        elif encoding in ("identity", "", "gzip"):
            payload = raw
        else:
            raise FetchError("Content-Encoding no soportado %r en %s" % (encoding, url))
        return status, resp_headers, payload

    def _gunzip(self, raw: bytes, url: str) -> bytes:
        dec = zlib.decompressobj(16 + zlib.MAX_WBITS)
        try:
            out = dec.decompress(raw, self.max_body + 1)
        except zlib.error as exc:
            raise FetchError("gzip inválido en %s: %s" % (url, exc)) from exc
        if len(out) > self.max_body or dec.unconsumed_tail:
            raise TooLarge("cuerpo descomprimido de más de %d bytes en %s" % (self.max_body, url))
        if not dec.eof:
            raise FetchError("gzip truncado en %s" % url)
        return out

    # --- robots.txt ---------------------------------------------------
    def robots_allowed(self, url: str, *, kind: str = "page_hash",
                       timeout: Optional[float] = DEFAULT_TIMEOUT,
                       deadline: Optional[float] = None) -> bool:
        """True si robots.txt del dominio permite `url` al User-Agent del radar.

        Caché en memoria de 24 h por esquema+host. 404 (y otros 4xx) permite
        todo; 401/403 prohíbe; error de red, timeout o 5xx lanza
        `RobotsUnavailable` y no se cachea. `kind` elige la política con la
        que se valida la URL del robots.txt (misma que la fuente).
        """
        try:
            origin = _split_url(url).origin()
        except PolicyError as exc:
            self._log("[radar-eventos] robots.txt no disponible para %r: %s" % (url, exc))
            raise RobotsUnavailable("URL inválida para robots.txt %r: %s" % (url, exc)) from exc
        now = self._monotonic()
        with self._robots_lock:
            entry = self._robots.get(origin)
        if entry is None or entry[1] <= now:
            parser = self._load_robots(origin, kind, timeout, deadline)
            with self._robots_lock:
                self._robots[origin] = (parser, self._monotonic() + ROBOTS_TTL)
        else:
            parser = entry[0]
        if parser is True or parser is False:
            return parser
        return bool(parser.can_fetch(ROBOTS_AGENT, url))

    def require_robots(self, url: str, **kwargs) -> None:
        """Como `robots_allowed`, pero lanza `RobotsDisallowed` si prohíbe."""
        if not self.robots_allowed(url, **kwargs):
            raise RobotsDisallowed("robots.txt prohíbe %s" % url)

    def _load_robots(self, origin: str, kind: str, timeout: Optional[float],
                     deadline: Optional[float]):
        robots_url = origin + "/robots.txt"
        try:
            self.policy.validate(robots_url, kind)
            resp = self._fetch(robots_url, kind=kind, method="GET", body=None, headers={},
                               timeout=timeout, deadline=deadline)
        except SourceDeadline:
            raise
        except (FetchError, FetchTimeout) as exc:
            self._log("[radar-eventos] robots.txt no disponible en %s: %s" % (origin, exc))
            raise RobotsUnavailable("robots.txt no disponible en %s: %s" % (origin, exc)) from exc
        if resp.status in (401, 403):
            return False
        if 400 <= resp.status < 500:
            return True
        if resp.status >= 500 or resp.status < 200 or resp.status >= 300:
            self._log("[radar-eventos] robots.txt no disponible en %s: HTTP %d" % (origin, resp.status))
            raise RobotsUnavailable("robots.txt no disponible en %s: HTTP %d" % (origin, resp.status))
        parser = urllib.robotparser.RobotFileParser(robots_url)
        parser.parse(resp.body.decode("utf-8", "replace").splitlines())
        return parser
