"""Normalización de eventos: categorías, exclusión online, filtro AMBA,
`dedupe_key` y URL canónica (R20-R23, R27, D1, D3, D4, A4, A6, A7, A14).

Contrato (plan.md, sección 4):

    apply(raw: RawEvent, source: sqlite3.Row, now: datetime)
        -> tuple[Event | None, str | None]      # (evento, motivo de descarte)

Los motivos de descarte son textos cortos en español que el engine cuenta y
resume en la línea de la fuente (plan.md, D-7 "Descartes"): ver `REASONS`.

Toda comparación de texto es sin tildes, sin distinguir mayúsculas y por
palabra completa: el texto se parte en palabras (todo lo que no es letra o
dígito separa) y una palabra clave de varias palabras tiene que aparecer
como secuencia contigua.
"""

import math
import unicodedata
from dataclasses import fields
from datetime import datetime
from typing import Any, Iterable, List, Optional, Tuple
from urllib.parse import urlsplit

from . import timeutil
from .model import Event, RawEvent

# --------------------------------------------------------------------------
# Constantes
# --------------------------------------------------------------------------

CATEGORIES = ("hackatones", "charlas_cfps", "meetups", "afters", "voluntariados", "otros")

# R20 + D3 (sin "meetup de charlas", A7), en orden de prioridad.
CATEGORY_KEYWORDS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("hackatones", ("hackathon", "hackatón", "hackaton", "buildathon", "game jam", "ctf")),
    ("charlas_cfps", ("cfp", "call for papers", "call for speakers", "call for proposals",
                      "charla", "charlas", "talk", "talks",
                      "conferencia", "conference", "summit", "congreso", "workshop",
                      "taller", "lightning")),
    ("meetups", ("meetup", "meet up", "meetups")),
    ("afters", ("after", "afterwork", "after office", "happy hour", "birras", "asado")),
    ("voluntariados", ("voluntario", "voluntaria", "voluntarios", "voluntariado",
                       "volunteer", "volunteers")),
)

# Relevancia tech (verificación en vivo, 26/11): el discover de Luma con
# keywords genéricas ("meetup", "after", "universidad") trae eventos de
# turismo, música o yoga. En `luma_discover` un evento entra si la keyword de
# la fuente es tech o si su título, descripción o calendario nombran algo tech.
TECH_WORDS = (
    "ai", "ia", "inteligencia artificial", "artificial intelligence", "genai", "agente",
    "agentes", "agent", "agents", "agentic", "llm", "llms", "gpt", "chatgpt", "openai",
    "claude", "anthropic", "gemini", "grok", "codex", "cursor", "lovable", "copilot",
    "prompt", "prompts", "machine learning", "ml", "deep learning", "data", "datos",
    "big data", "analytics", "python", "javascript", "typescript", "react", "java",
    "golang", "rust", "dev", "devs", "developer", "developers", "desarrollador",
    "desarrolladores", "desarrolladoras", "software", "programacion", "programadores",
    "codigo", "code", "coding", "cloud", "aws", "azure", "gcp", "devops", "kubernetes",
    "docker", "linux", "open source", "github", "api", "apis", "tech", "techie",
    "tecnologia", "tecnologias", "tecnologica", "tecnologico", "startup", "startups",
    "founder", "founders", "product", "producto", "ux", "ui", "web3", "blockchain",
    "crypto", "cripto", "bitcoin", "ethereum", "solana", "defi", "stablecoin",
    "stablecoins", "fintech", "insurtech", "proptech", "edtech", "healthtech",
    "ciberseguridad", "cybersecurity", "infosec", "owasp", "hacking", "hacker",
    "hackers", "hack", "hackathon", "hackaton", "buildathon", "game jam", "ctf",
    "gamedev", "videojuegos", "robot", "robots", "robotica", "robotics", "iot",
    "drones", "saas", "no code", "nocode", "low code", "automation", "automatizacion",
    "demo day", "demo night", "pitch", "vc", "vcs", "venture", "ingenieria",
    "engineering", "engineer", "engineers", "informatica", "computacion", "quantum",
    "hardware", "maker", "makers", "salesforce", "sap", "crm", "builders",
    "mvp", "gtm", "sistemas",
)

# R21
ONLINE_WORDS = ("online", "virtual", "remoto", "zoom", "streaming")
NEXA_ALLOWED_EVENT_TYPES = ("presencial", "hibrido")   # comparado sin tildes

# R22
OBELISCO = (-34.6037, -58.3816)
AMBA_RADIUS_KM = 40.0
EARTH_RADIUS_KM = 6371.0088

# A6: marcas explícitas de CABA (ganan siempre).
CABA_MARKERS = ("ciudad autónoma de buenos aires", "caba", "capital federal", "c.a.b.a.")

# A6: los 48 barrios oficiales de CABA.
CABA_BARRIOS = (
    "Agronomía", "Almagro", "Balvanera", "Barracas", "Belgrano", "Boedo", "Caballito",
    "Chacarita", "Coghlan", "Colegiales", "Constitución", "Flores", "Floresta", "La Boca",
    "La Paternal", "Liniers", "Mataderos", "Monte Castro", "Montserrat", "Nueva Pompeya",
    "Núñez", "Palermo", "Parque Avellaneda", "Parque Chacabuco", "Parque Chas",
    "Parque Patricios", "Puerto Madero", "Recoleta", "Retiro", "Saavedra", "San Cristóbal",
    "San Nicolás", "San Telmo", "Vélez Sarsfield", "Versalles", "Villa Crespo",
    "Villa del Parque", "Villa Devoto", "Villa General Mitre", "Villa Lugano", "Villa Luro",
    "Villa Ortúzar", "Villa Pueyrredón", "Villa Real", "Villa Riachuelo", "Villa Santa Rita",
    "Villa Soldati", "Villa Urquiza",
)

# A6: los 24 partidos del conurbano.
CONURBANO_PARTIDOS = (
    "Almirante Brown", "Avellaneda", "Berazategui", "Esteban Echeverría", "Ezeiza",
    "Florencio Varela", "General San Martín", "Hurlingham", "Ituzaingó", "José C. Paz",
    "La Matanza", "Lanús", "Lomas de Zamora", "Malvinas Argentinas", "Merlo", "Moreno",
    "Morón", "Quilmes", "San Fernando", "San Isidro", "San Miguel", "Tigre",
    "Tres de Febrero", "Vicente López",
)

# A6: localidades sueltas que también cuentan como AMBA.
AMBA_LOCALIDADES = ("Olivos", "Martínez", "Florida", "Munro", "Ramos Mejía", "San Justo",
                    "Banfield", "Adrogué", "Bernal", "Pilar", "Escobar")

# R22 (2): lugares fuera del AMBA que excluyen. Los de la spec ("por ejemplo
# Rosario, La Plata, Córdoba, Mendoza, Salta, Ciudad de México") más capitales
# y ciudades frecuentes en las fuentes. Muchos coinciden con calles porteñas
# (Av. Córdoba, Santa Fe, Corrientes): en texto libre solo cuentan fuera de
# segmentos que parecen una dirección (ver `_looks_like_address`).
OUTSIDE_PLACES = (
    "Rosario", "La Plata", "Córdoba", "Mendoza", "Salta", "Ciudad de México", "CDMX",
    "México", "Mexico City", "Santa Fe", "Tucumán", "Mar del Plata", "Bahía Blanca",
    "Neuquén", "Bariloche", "San Carlos de Bariloche", "Jujuy", "San Juan", "San Luis",
    "Paraná", "Corrientes", "Posadas", "Resistencia", "Formosa", "Santiago del Estero",
    "Catamarca", "La Rioja", "Río Cuarto", "Rafaela", "Tandil", "Ushuaia", "Río Gallegos",
    "Comodoro Rivadavia", "Trelew", "Rawson", "Viedma", "Santa Rosa", "San Rafael",
    "Montevideo", "Uruguay", "Santiago de Chile", "Chile", "Brasil", "Brazil", "São Paulo",
    "Rio de Janeiro", "Caracas", "Venezuela", "Bogotá", "Medellín", "Colombia", "Lima",
    "Perú", "Quito", "Asunción", "Paraguay", "La Paz", "Bolivia", "Madrid", "Barcelona",
    "España", "Spain", "San Francisco", "New York", "Miami", "United States", "USA",
)

_ADDRESS_PREFIXES = ("av", "avenida", "calle", "pje", "pasaje", "bv", "bvd", "boulevard",
                     "diag", "diagonal")

# Motivos de descarte (los cuenta el engine para la línea de log).
REASON_INCOMPLETE = "datos incompletos"
REASON_ONLINE = "online"
REASON_EVENT_TYPE = "tipo de evento"
REASON_OUTSIDE = "fuera del AMBA"
REASON_NO_LOCATION = "sin lugar"
REASON_FINISHED = "ya terminado"
REASON_NOT_TECH = "no tech"
REASONS = (REASON_INCOMPLETE, REASON_ONLINE, REASON_EVENT_TYPE, REASON_OUTSIDE,
           REASON_NO_LOCATION, REASON_FINISHED, REASON_NOT_TECH)

CFP_PROVIDER = "devevents"
CFP_KIND = "devevents_cfps"

# --------------------------------------------------------------------------
# Texto
# --------------------------------------------------------------------------


def fold(text: Optional[str]) -> str:
    """Minúsculas y sin tildes (NFKD sin marcas combinantes)."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def _split_camel(text: str) -> str:
    """Separa CamelCase ("#AdminBirras" -> "#Admin Birras") para buscar por palabra."""
    out: List[str] = []
    prev = ""
    for ch in text:
        if prev and prev.islower() and ch.isupper():
            out.append(" ")
        out.append(ch)
        prev = ch
    return "".join(out)


def words(text: Optional[str], split_camel: bool = False) -> List[str]:
    """Palabras normalizadas: sin tildes, minúsculas, todo lo que no es letra o
    dígito separa (A14)."""
    if not text:
        return []
    if split_camel:
        text = _split_camel(text)
    folded = fold(text)
    cleaned = "".join(ch if (ch.isalpha() or ch.isdigit()) else " " for ch in folded)
    return cleaned.split()


def _phrase(text: str) -> str:
    return " ".join(words(text))


def _haystack(parts: Iterable[Optional[str]], split_camel: bool = False) -> str:
    tokens: List[str] = []
    for part in parts:
        tokens.extend(words(part, split_camel=split_camel))
        tokens.append("|")  # nunca une palabras de campos distintos
    return " " + " ".join(tokens) + " "


def _contains(haystack: str, keyword: str) -> bool:
    needle = _phrase(keyword)
    return bool(needle) and (" " + needle + " ") in haystack


def _any(haystack: str, keywords: Iterable[str]) -> bool:
    return any(_contains(haystack, kw) for kw in keywords)


def normalize_title(title: Optional[str]) -> str:
    """Título para `dedupe_key` (R23, A14): minúsculas, sin tildes, sin emojis
    ni puntuación, espacios colapsados. "Hack&Chill" -> "hack chill"."""
    return " ".join(words(title))


def dedupe_key(title: Optional[str], start_local: str, is_cfp: bool = False) -> str:
    """R23: `<título normalizado>|YYYY-MM-DD`, con prefijo `cfp|` para CFPs."""
    key = "%s|%s" % (normalize_title(title), timeutil.local_date(start_local).isoformat())
    return "cfp|" + key if is_cfp else key


# --------------------------------------------------------------------------
# URL canónica (D1)
# --------------------------------------------------------------------------

_LUMA_HOSTS = ("lu.ma", "luma.com")


def canonical_url(url: Optional[str]) -> str:
    """D1: minúsculas, `https`, sin `www.`, sin query, fragmento ni barra final;
    `lu.ma/x` y `luma.com/x` dan lo mismo (`https://luma.com/x`). Vacío si no
    es una URL http(s) con host."""
    if not url:
        return ""
    text = url.strip().lower()
    if "://" not in text and not text.startswith("//"):
        text = "https://" + text
    try:
        parts = urlsplit(text)
        host = parts.hostname or ""
        port = parts.port
    except ValueError:
        return ""
    if parts.scheme not in ("http", "https") or not host:
        return ""
    if host.startswith("www."):
        host = host[4:]
    if host in _LUMA_HOSTS:
        host = "luma.com"
    netloc = host if port in (None, 80, 443) else "%s:%d" % (host, port)
    path = parts.path.rstrip("/")
    return "https://%s%s" % (netloc, path)


def public_url(raw: RawEvent) -> str:
    """URL pública del evento. Luma informa solo el slug (`"url": "bvtxrlii"`):
    se completa como `https://luma.com/<slug>`."""
    url = (raw.url or "").strip()
    if raw.provider == "luma" and url and "/" not in url and "." not in url:
        return "https://luma.com/" + url
    return url


# --------------------------------------------------------------------------
# Fuente (sqlite3.Row o dict)
# --------------------------------------------------------------------------


def _src(source: Any, key: str) -> Any:
    if source is None:
        return None
    try:
        return source[key]
    except (KeyError, IndexError, TypeError):
        return None


# --------------------------------------------------------------------------
# Reglas
# --------------------------------------------------------------------------


def categorize(raw: RawEvent, source: Any) -> str:
    """R20/D3/D4/A7: `fixed_category` de la fuente; si no, palabras clave en
    título y descripción por prioridad; si no, `default_category` de la
    fuente (D4, `meetups` en Meetup); si no, `otros`."""
    fixed = _src(source, "fixed_category")
    if fixed in CATEGORIES:
        return fixed
    hay = _haystack((raw.title, raw.description), split_camel=True)
    for category, keywords in CATEGORY_KEYWORDS:
        if _any(hay, keywords):
            return category
    default = _src(source, "default_category")
    if default in CATEGORIES:
        return default
    return "otros"


def is_online(raw: RawEvent) -> bool:
    """R21: "online", "virtual", "remoto", "zoom" o "streaming" en el título o
    en el lugar. La descripción no cuenta."""
    hay = _haystack((raw.title, raw.venue, raw.city, raw.region, raw.location_text),
                    split_camel=True)
    return _any(hay, ONLINE_WORDS)


def tech_relevant(raw: RawEvent, source: Any) -> bool:
    """Relevancia tech: solo filtra `luma_discover`. Pasa si la keyword de la
    fuente (su nombre) es tech o si título, descripción o calendario lo son."""
    if _src(source, "kind") != "luma_discover":
        return True
    if _any(_haystack((_src(source, "name"),), split_camel=True), TECH_WORDS):
        return True
    cal = raw.calendar.get("name") if isinstance(raw.calendar, dict) else None
    return _any(_haystack((raw.title, raw.description, cal), split_camel=True), TECH_WORDS)


def nexa_type_excluded(raw: RawEvent) -> bool:
    """R21: en NEXA solo entran `presencial` e `híbrido`/`hibrido`; cualquier
    otro valor (virtual, desconocido o ausente) se excluye."""
    if raw.provider != "nexa":
        return False
    return fold((raw.event_type or "").strip()) not in NEXA_ALLOWED_EVENT_TYPES


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia haversine en km."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


_AMBA_PLACES = CABA_BARRIOS + CONURBANO_PARTIDOS + AMBA_LOCALIDADES


def _looks_like_address(segment: str) -> bool:
    tokens = words(segment)
    if not tokens:
        return False
    return tokens[0] in _ADDRESS_PREFIXES or any(ch.isdigit() for ch in segment)


def _segments(text: Optional[str]) -> List[str]:
    if not text:
        return []
    out: List[str] = []
    for chunk in text.replace("\n", ",").replace(";", ",").replace("|", ",").split(","):
        if chunk.strip():
            out.append(chunk.strip())
    return out


def _is_buenos_aires_city(text: Optional[str]) -> bool:
    """"Buenos Aires" como ciudad: el texto (o un segmento) es exactamente
    "Buenos Aires", con "Argentina"/"AR" opcional al final ("Buenos Aires
    (Argentina)" de developers.events), y no se habla de la provincia (A6)."""
    if not text:
        return False
    if "provincia" in words(text):
        return False
    for seg in _segments(text):
        tokens = words(seg)
        while len(tokens) > 2 and tokens[-1] in ("argentina", "ar"):
            tokens.pop()
        if tokens == ["buenos", "aires"]:
            return True
    return False


def location_verdict(raw: RawEvent) -> str:
    """R22/A6 sin coordenadas: `inside`, `outside` o `unknown` (sin dato).

    1. Una marca explícita de CABA en cualquier campo gana.
    2. Campos estructurados (`city`, `region`): un lugar de fuera del AMBA
       gana a un barrio o partido (p. ej. "San Miguel" + "Tucumán"); después,
       barrio, partido, localidad o `city` = "Buenos Aires".
    3. Texto libre (`location_text`, `venue`), partido en segmentos por coma.
       Los segmentos que parecen dirección ("Av. Córdoba 1234") no cuentan
       como lugar de fuera, porque las calles porteñas se llaman como
       provincias y países. Orden: barrio/partido/localidad en un segmento
       que no es dirección; lugar de fuera; barrio/partido/localidad en
       cualquier segmento; "Buenos Aires" como ciudad (no la provincia).
    """
    structured = _haystack((raw.city, raw.region))
    free_parts = [raw.location_text, raw.venue]
    free = _haystack(free_parts)

    if _any(structured, CABA_MARKERS) or _any(free, CABA_MARKERS):
        return "inside"

    if _any(structured, OUTSIDE_PLACES):
        return "outside"
    if _any(structured, _AMBA_PLACES) or _is_buenos_aires_city(raw.city):
        return "inside"

    places = _haystack([seg for part in free_parts for seg in _segments(part)
                        if not _looks_like_address(seg)])
    if _any(places, _AMBA_PLACES):
        return "inside"
    if _any(places, OUTSIDE_PLACES):
        return "outside"
    if _any(free, _AMBA_PLACES):
        return "inside"
    if any(_is_buenos_aires_city(part) for part in free_parts):
        return "inside"
    return "unknown"


def amba_filter(raw: RawEvent, source: Any) -> Tuple[bool, bool, Optional[str]]:
    """R22: `(entra, location_unconfirmed, motivo)`.

    (1) Con coordenadas: entra a 40 km o menos del Obelisco. (2) Sin
    coordenadas: según `location_verdict`. (3) Sin dato (o texto no
    reconocido): entra solo si la fuente tiene `is_local=1`, sin confirmar.
    """
    if raw.lat is not None and raw.lon is not None:
        try:
            lat, lon = float(raw.lat), float(raw.lon)
        except (TypeError, ValueError):
            lat = lon = None
        if lat is not None and lon is not None:
            if distance_km(lat, lon, OBELISCO[0], OBELISCO[1]) <= AMBA_RADIUS_KM:
                return True, False, None
            return False, False, REASON_OUTSIDE
    verdict = location_verdict(raw)
    if verdict == "inside":
        return True, False, None
    if verdict == "outside":
        return False, False, REASON_OUTSIDE
    if _src(source, "is_local") in (1, True, "1"):
        return True, True, None
    return False, False, REASON_NO_LOCATION


def is_cfp(raw: RawEvent, source: Any) -> bool:
    return raw.provider == CFP_PROVIDER or _src(source, "kind") == CFP_KIND


# --------------------------------------------------------------------------
# Punto de entrada
# --------------------------------------------------------------------------


def apply(raw: RawEvent, source: Any, now: datetime) -> Tuple[Optional[Event], Optional[str]]:
    """Normaliza un `RawEvent` de `source` (fila de `event_sources`).

    Devuelve `(Event, None)` si se guarda o `(None, motivo)` si se descarta:
    datos incompletos (sin título o con fechas que no parsean), online o tipo
    NEXA no presencial (R21), fuera del AMBA o sin lugar con `is_local=0`
    (R22) o ya terminado en su primera aparición (R27).
    """
    title = (raw.title or "").strip()
    url = public_url(raw)
    if not title or not raw.start_local or not url:
        return None, REASON_INCOMPLETE
    try:
        start_local = timeutil.normalize_local(raw.start_local)
        end_local = timeutil.normalize_local(raw.end_local) if raw.end_local else None
        if raw.closing_local:
            closing_local = timeutil.normalize_local(raw.closing_local)
            closing_explicit = bool(raw.closing_explicit)
        else:
            closing_local, closing_explicit = start_local, False
    except ValueError:
        return None, REASON_INCOMPLETE

    if is_online(raw):
        return None, REASON_ONLINE
    if nexa_type_excluded(raw):
        return None, REASON_EVENT_TYPE
    if not tech_relevant(raw, source):
        return None, REASON_NOT_TECH
    inside, unconfirmed, reason = amba_filter(raw, source)
    if not inside:
        return None, reason
    if timeutil.is_finished(start_local, end_local, bool(raw.has_time), now):
        return None, REASON_FINISHED

    cfp = is_cfp(raw, source)
    values = {f.name: getattr(raw, f.name) for f in fields(RawEvent)}
    values.update(
        title=title,
        url=url,
        start_local=start_local,
        end_local=end_local,
        has_time=bool(raw.has_time),
        closing_local=closing_local,
        closing_explicit=closing_explicit,
        category=categorize(raw, source),
        location_unconfirmed=unconfirmed,
        dedupe_key=dedupe_key(title, start_local, cfp),
        canonical_url=canonical_url(url),
        is_cfp=cfp,
    )
    return Event(**values), None
