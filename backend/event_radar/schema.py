"""Esquema SQLite del radar de eventos y siembra única de fuentes (B2).

Requisitos: R2-R10, D4, A1, A3, A11 y la errata de conteos de
`aprobaciones.md` (33 keywords, 40 calendarios con 13 `is_local=0`, 29 grupos
de Meetup, 4 singletons y 25 páginas).

- `ensure_schema(db_path_o_ctx)` crea las 7 tablas `event_*` con
  `CREATE TABLE IF NOT EXISTS` y sus índices, en una sola transacción. Es
  idempotente y nunca toca tablas que no empiecen con `event_` (el Radar IT
  y el resto del backend quedan intactos).
- La siembra corre una sola vez: si `event_radar_state.sources_seeded_at` es
  nulo inserta `EVENT_RADAR_SEED` con `INSERT OR IGNORE` y fija la marca en
  la misma transacción. Una fila sembrada que el usuario borra no vuelve.
  No hace red (A3): todo entra con `enabled=1`.

El catálogo sale literal de `docs/sdd/changes/radar-eventos/investigacion-v3.md`
(secciones 2.1, 2.2, 5, 17.1 y 17.2) y los endpoints singleton de
`exploracion.md`. Los nombres son la columna "Comunidad / organizador" u
"Organizador / evento" sin el resaltado markdown ni los comentarios entre
paréntesis (personas, "host", descripción).
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, List, Optional, Tuple, Union
from urllib.parse import quote, urlsplit, urlunsplit

from . import context as _context

AR = timezone(timedelta(hours=-3))

# --------------------------------------------------------------------------
# Tipos de fuente (R10)
# --------------------------------------------------------------------------

VALID_KINDS = (
    "luma_discover",
    "luma_calendar",
    "nexa_mcp",
    "argentinahackathons_rss",
    "meetup",
    "condor_nest",
    "devevents_cfps",
    "page_hash",
)
MVD_KINDS = ("luma_discover", "luma_calendar", "nexa_mcp", "argentinahackathons_rss", "meetup")
FASE2_KINDS = ("condor_nest", "devevents_cfps", "page_hash")

# Host permitido por tipo. `page_hash` acepta cualquier host público (R40):
# lo valida `net.UrlPolicy`, por eso aquí queda en None.
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

CATEGORIES = ("hackatones", "charlas_cfps", "meetups", "afters", "voluntariados", "otros")  # R20

# --------------------------------------------------------------------------
# URLs de fuente (A11)
# --------------------------------------------------------------------------

LUMA_DISCOVER_PLACE = "discplace-wX2J5xGwAJpznew"
LUMA_DISCOVER_BASE = (
    "https://api.lu.ma/discover/get-paginated-events"
    "?discover_place_api_id=" + LUMA_DISCOVER_PLACE + "&pagination_limit=50&query="
)
LUMA_CALENDAR_TEMPLATE = (
    "https://api.lu.ma/calendar/get-items?calendar_api_id={}&period=future&pagination_limit=50"
)
MEETUP_TEMPLATE = "https://www.meetup.com/{}/events/ical/"

# Endpoints singleton (exploracion.md; R9 d).
NEXA_MCP_URL = "https://nexa.builders/api/mcp"
AHACK_RSS_URL = "https://argentinahackathons.com/rss.xml"
CONDOR_SITEMAP_URL = "https://condor-nest.lat/sitemap.xml"
DEVEVENTS_CFPS_URL = "https://developers.events/all-cfps.json"


def normalize_page_url(value: str) -> str:
    """URL de `page_hash` según A11: host en minúsculas y sin fragmento."""
    parts = urlsplit(value.strip())
    scheme = parts.scheme.lower()
    netloc = parts.netloc.lower()
    return urlunsplit((scheme, netloc, parts.path, parts.query, ""))


def seed_source_url(kind: str, value: str) -> str:
    """URL canónica de una fuente sembrada (A11). No valida SSRF (eso es net.py)."""
    if kind == "luma_discover":
        return LUMA_DISCOVER_BASE + quote(value, safe="")
    if kind == "luma_calendar":
        return LUMA_CALENDAR_TEMPLATE.format(value)
    if kind == "meetup":
        return MEETUP_TEMPLATE.format(value)
    if kind == "page_hash":
        return normalize_page_url(value)
    singletons = {
        "nexa_mcp": NEXA_MCP_URL,
        "argentinahackathons_rss": AHACK_RSS_URL,
        "condor_nest": CONDOR_SITEMAP_URL,
        "devevents_cfps": DEVEVENTS_CFPS_URL,
    }
    if kind in singletons:
        return singletons[kind]
    raise ValueError("tipo de fuente desconocido: %r" % (kind,))


# --------------------------------------------------------------------------
# Catálogo literal (investigacion-v3.md)
# --------------------------------------------------------------------------

# Sección 2.1: keywords del discover de Buenos Aires (33).
LUMA_KEYWORDS = (
    "hackathon", "hackatón", "buildathon", "AI", "IA", "agentes",
    "inteligencia artificial", "meetup", "builders", "devs", "python", "data",
    "startup", "founders", "workshop", "demo day", "after", "coworking",
    "comunidad", "cursor", "claude", "codex", "openai", "grok", "web3",
    "ethereum", "solana", "stablecoins", "fintech", "seguridad", "CTF",
    "estudiantes", "universidad",
)

# Secciones 2.2 (22) y 17.1 (18): (nombre, cal-id, slug o None, is_local).
# is_local=0: lugar fuera del AMBA o alcance multiciudad (R9 b, D5): 14.
# The AI Collective pasó a 0 tras la primera pasada real: es el calendario global.
LUMA_CALENDARS: Tuple[Tuple[str, str, Optional[str], int], ...] = (
    # 2.2
    ("SpaceXSI for Buenos Aires", "cal-qZ9c7FxciPsFdc4", "spacexai-buenos-aires", 1),
    ("SpaceXSI for Rosario", "cal-yCEmSt4mqKs8QfQ", None, 0),
    ("Codex Meetups 🇦🇷", "cal-cyEjSs8kNGXZwdX", "CodexAr", 1),
    ("Hack & Chill", "cal-UCCTOI5jo3Cyu52", "hackandchill", 1),
    ("Crecimiento", "cal-aJICddsQgBXyl0P", "crecimiento", 0),
    ("Nexa", "cal-Up5cGEUDcNp2BBE", None, 0),
    ("OWASP Buenos Aires", "cal-3aySbWLE3PcAYf2", None, 1),
    ("The AI Collective (BA)", "cal-E74MDlDKBaeAwXK", "genai-collective", 0),
    ("NERDCONF", "cal-jOV1LTbC0ejF7KH", None, 1),
    ("Team1 LatAm", "cal-bXAHrIXj6hC0zs7", None, 0),
    ("StarMaker LATAM", "cal-sArcmTZMOAAnykD", None, 0),
    ("Y-Hat (Exactas UBA)", "cal-uYQ0UYPJjzd4esa", None, 1),
    ("DevConverge LATAM–EUROPE", "cal-YTmXkpyoeFHEcpv", None, 0),
    ("Dev3pack Global Hackathon", "cal-XZRvFeXpXY0ipZX", None, 0),
    ("Argentina Space", "cal-HZLHDQqXKKHvtPt", None, 0),
    ("SpaceComputer", "cal-oLkTZUWdXfUH9Tt", None, 1),
    ("LLMNative BA", "cal-hCR1VtTtRF3HDR1", None, 1),
    ("Asado Builders", "cal-JHbGP1myckbbCVS", None, 1),
    ("X Builder House", "cal-rqLPztP80qSs39q", None, 1),
    ("Omarchy BA", "cal-XX1VEFRXbVSw4zS", None, 1),
    ("Zenda Events", "cal-m3JLMCqCsLAAcis", None, 1),
    ("SquadS Growth", "cal-DumNF9clf7VLgDG", None, 1),
    # 17.1 ("Popular events in Buenos Aires" es el discover: queda en LUMA_KEYWORDS)
    ("ClawCon", "cal-e5mvjF86anukzOt", "clawcon", 0),
    ("Neurona Argenta", "cal-72jOqzFRVsc5bNw", "neurona-arg", 1),
    ("Build Buddies", "cal-OXC2m6nWcefznCb", "build-buddies", 1),
    ("Dev3pack Club", "cal-qLaQEvhHeOpgqud", "dev3pack", 1),
    ("Lazo Community", "cal-AEOlBvKfoDZGAmG", "LazoCommunity", 1),
    ("Community Hackers", "cal-k8Htqind6uPlTYX", "Community-Hackers", 1),
    ("PostHog", "cal-qJCKF7ct5XX3pwB", "posthog", 0),
    ("Argentina at Silicon Valley", "cal-HvCvjCJb7tLdxwr", "argentinaatsiliconvalley", 0),
    ("Cubo Itaú", "cal-mnH7sZGfdB9nGhw", "cuboitau", 1),
    ("MetaMask / Builder Nights BA", "cal-audYA24RHlUsV9T", None, 1),
    ("21MeetUp", "cal-q9qecgHVPiPvf0q", None, 1),
    ("IT ROCK", "cal-syJGTRCU7DzAsjC", None, 1),
    ("HACKATHON GLITCH", "cal-4ruGDq6CzVvUU6r", None, 1),
    ("Startups Festival BA", "cal-NIsEiLaZ61l36zn", None, 1),
    ("Bitcoin Builders BA", "cal-oq2dropmWy1tpZX", None, 1),
    ("Laboratoria", "cal-AItFW9LkweDgn2i", None, 0),
    ("Charlas de producto", "cal-ZFiKRDsNP9AwSIA", None, 1),
    ("Anthropic & KASZEK AI Innovation Session", "cal-jnDQpfZaXwuUTjj", None, 0),
)

# Sección 5: grupos verificados de Meetup (29), en el orden del documento.
MEETUP_GROUPS = (
    "pydata-buenos-aires", "argentina-data-science-meetup", "dataenginear",
    "rbuenosaires", "rladies-buenos-aires", "aws-data-ai",
    "aws-user-group-buenos-aires", "aws-sbg-at-national-university-of-avellaneda",
    "aws-girls-argentina", "google-cloud-buenos-aires",
    "kubernetes-community-group-argentina", "docker-buenos-aires", "sysarmy",
    "wazuh-meetup-argentina", "AppSecBA", "BAFrontend", "rubyba",
    "flutter-buenos-aires", "PostgreSQL-Argentina", "NET-Baires",
    "ProductTank-Buenos-Aires", "Startup-Grind-Buenos-Aires",
    "buenos-aires-ai-agent-development", "ai-engineering-buenos-aires",
    "the-ai-whisperers-club", "buenos-aires-tech-connections",
    "women-who-code-buenos-aires", "Ethereum-Buenos-Aires", "Bitcoin-Argentina",
)

# Sección 17.2 con web propia (21) más las 4 de R9 (e): (nombre, URL).
PAGE_HASH_PAGES: Tuple[Tuple[str, str], ...] = (
    ("Push to Prod", "https://push-to-prod.devfolio.co/"),
    ("Digital House, eventos", "https://www.digitalhouse.com/ar/eventos"),
    ("Kaszek", "https://www.kaszek.com/"),
    ("BA In Game / Game Jam BA", "https://buenosaires.gob.ar/desarrollo-economico/ba-game"),
    ("Jams de Argentina en itch.io", "https://itch.io/jam/unity-ba-game-jam-2026"),
    ("Startup Grind Buenos Aires", "https://www.startupgrind.com/buenos-aires/"),
    ("Release Before Ready", "https://releasebeforeready.com"),
    ("laburen.com", "https://laburen.com"),
    ("Platanus Hack", "https://hack.platan.us"),
    ("Mad Builders / The Techie Club", "https://mad.builders"),
    ("Mad Builders / The Techie Club", "https://thetechieclub.com"),
    ("IT ROCK", "https://itrock.com.ar"),
    ("ONG Bitcoin Argentina", "https://bitcoinargentina.org"),
    ("Reclutando Latinoamérica", "https://reclutandolatam.com"),
    ("Argentina Fintech Forum", "https://www.iproup.com/argentina-fintech-forum"),
    ("Tecweek", "https://www.tecweek.com.ar"),
    ("Campus Party", "https://www.campus-party.org/"),
    ("Palermo AI Innovation Summit / IA Forum", "https://www.palermo.edu/congreso-ai/"),
    ("H4CK3D", "https://palermo.edu/h4ck3d"),
    ("ECI: Escuela de Ciencias Informáticas", "https://eci.dc.uba.ar/"),
    ("South American NLP School", "https://south-american-nlp-school.dc.uba.ar/"),
    # R9 (e): fuera de la tabla 17.2
    ("Nerdearla", "https://nerdearla.com/llms.txt"),
    ("Nerdearla (CFP en Sessionize)", "https://sessionize.com/n27ar"),
    ("Codex Meetings BA", "https://codex.ar"),
    ("Ship BA", "https://shipba.dev"),
)


def _seed_row(kind: str, name: str, value: str, config: dict, *, is_local: int,
              fixed_category: Optional[str] = None,
              default_category: Optional[str] = None) -> dict:
    return {
        "kind": kind,
        "name": name,
        "url": seed_source_url(kind, value),
        "config": config,
        "fixed_category": fixed_category,
        "default_category": default_category,
        "is_local": is_local,
    }


def _build_seed() -> Tuple[dict, ...]:
    rows: List[dict] = []
    for kw in LUMA_KEYWORDS:
        rows.append(_seed_row("luma_discover", kw, kw, {"keyword": kw}, is_local=1))
    for name, cal_id, slug, is_local in LUMA_CALENDARS:
        cfg = {"cal_id": cal_id}
        if slug:
            cfg["slug"] = slug
        rows.append(_seed_row("luma_calendar", name, cal_id, cfg, is_local=is_local))
    for urlname in MEETUP_GROUPS:
        rows.append(_seed_row("meetup", urlname, urlname, {"urlname": urlname},
                              is_local=1, default_category="meetups"))
    rows.append(_seed_row("nexa_mcp", "NEXA", NEXA_MCP_URL, {}, is_local=0))
    rows.append(_seed_row("argentinahackathons_rss", "argentinahackathons.com",
                          AHACK_RSS_URL, {}, is_local=0, fixed_category="hackatones"))
    rows.append(_seed_row("condor_nest", "Condor Nest", CONDOR_SITEMAP_URL, {}, is_local=0))
    rows.append(_seed_row("devevents_cfps", "developers.events (CFPs)", DEVEVENTS_CFPS_URL,
                          {"timeout": 60}, is_local=0, fixed_category="charlas_cfps"))
    for name, url in PAGE_HASH_PAGES:
        rows.append(_seed_row("page_hash", name, url, {}, is_local=0))
    return tuple(rows)


EVENT_RADAR_SEED: Tuple[dict, ...] = _build_seed()


def source_value(kind: str, url: str, config: Union[str, dict, None]) -> str:
    """El "valor" que el usuario dio de alta (keyword, cal-id, urlname o URL).

    Lo usan la API y el dashboard (A16, campo `value`).
    """
    if isinstance(config, str):
        try:
            config = json.loads(config or "{}")
        except ValueError as exc:
            print("[radar-eventos] config JSON inválido en fuente %s: %s" % (kind, exc),
                  file=sys.stderr)
            config = {}
    config = config if isinstance(config, dict) else {}
    key = {"luma_discover": "keyword", "luma_calendar": "cal_id", "meetup": "urlname"}.get(kind)
    if key and config.get(key):
        return str(config[key])
    return url


# --------------------------------------------------------------------------
# DDL (R3-R8, D4, A3)
# --------------------------------------------------------------------------

TABLES = (
    "event_sources",
    "events",
    "event_links",
    "event_source_health",
    "event_radar_state",
    "event_page_hashes",
    "event_calendar_candidates",
)

_DDL = (
    """CREATE TABLE IF NOT EXISTS event_sources (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        fixed_category TEXT,
        default_category TEXT,
        is_local INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        disabled_reason TEXT,
        origin TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_event_sources_kind_url
        ON event_sources(kind, url)""",
    """CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        dedupe_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        start_local TEXT NOT NULL,
        end_local TEXT,
        has_time INTEGER NOT NULL,
        closing_local TEXT NOT NULL,
        closing_explicit INTEGER NOT NULL,
        venue TEXT,
        city TEXT,
        lat REAL,
        lon REAL,
        location_unconfirmed INTEGER NOT NULL DEFAULT 0,
        primary_url TEXT NOT NULL,
        best_provider TEXT NOT NULL,
        require_approval INTEGER,
        sold_out INTEGER,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        missing_since TEXT,
        notified_new_at TEXT,
        notified_new_urgent INTEGER NOT NULL DEFAULT 0,
        notified_closing_at TEXT,
        user_status TEXT,
        user_status_at TEXT
    )""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_events_dedupe_key ON events(dedupe_key)""",
    """CREATE INDEX IF NOT EXISTS ix_events_category_start ON events(category, start_local)""",
    """CREATE TABLE IF NOT EXISTS event_links (
        id INTEGER PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id),
        source_id INTEGER,
        provider TEXT NOT NULL,
        origin_id TEXT NOT NULL,
        url TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
    )""",
    """CREATE UNIQUE INDEX IF NOT EXISTS ux_event_links_provider_origin
        ON event_links(provider, origin_id)""",
    """CREATE TABLE IF NOT EXISTS event_source_health (
        source_id INTEGER PRIMARY KEY,
        last_run_at TEXT,
        last_status TEXT,
        last_count INTEGER,
        last_error TEXT,
        last_ok_at TEXT,
        last_duration_s REAL,
        streak_kind TEXT,
        streak_started_at TEXT,
        streak_alerted_at TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS event_radar_state (
        key TEXT PRIMARY KEY,
        value TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS event_page_hashes (
        source_id INTEGER PRIMARY KEY,
        last_hash TEXT,
        previous_hash TEXT,
        last_http_status INTEGER,
        previous_http_status INTEGER,
        last_checked_at TEXT,
        last_changed_at TEXT,
        change_notified_at TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS event_calendar_candidates (
        cal_api_id TEXT PRIMARY KEY,
        name TEXT,
        slug TEXT,
        event_ids TEXT NOT NULL DEFAULT '[]',
        seen_count INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'proposed'
    )""",
)

# Columnas aditivas que una base creada por una versión anterior de este
# módulo podría no tener (patrón PRAGMA table_info + ALTER TABLE ADD COLUMN).
_ADDITIVE_COLUMNS: Dict[str, Tuple[Tuple[str, str], ...]] = {
    "event_sources": (
        ("default_category", "TEXT"),
        ("disabled_reason", "TEXT"),
    ),
    # Addendum inscripciones: estado del usuario sobre el evento (NULL,
    # 'dismissed' o 'registered') y cuándo lo fijó (hora AR).
    "events": (
        ("user_status", "TEXT"),
        ("user_status_at", "TEXT"),
    ),
}


def _ensure_columns(cur, table: str, columns) -> List[str]:
    """Agrega las columnas que falten. Solo actúa sobre tablas `event_*`."""
    if not table.startswith("event"):
        raise ValueError("_ensure_columns solo toca tablas del radar, no %r" % (table,))
    if table not in TABLES:
        raise ValueError("tabla del radar desconocida: %r" % (table,))
    existing = {row[1] for row in cur.execute("PRAGMA table_info(%s)" % table)}
    added = []
    for name, decl in columns:
        if name not in existing:
            cur.execute("ALTER TABLE %s ADD COLUMN %s %s" % (table, name, decl))
            added.append(name)
    return added


def _now_iso(now: Union[None, datetime, Callable[[], datetime]]) -> str:
    if callable(now):
        now = now()
    if now is None:
        now = datetime.now(AR)
    if now.tzinfo is None:
        now = now.replace(tzinfo=AR)
    return now.astimezone(AR).isoformat(timespec="seconds")


def _seed(cur, ts: str) -> int:
    inserted = 0
    for row in EVENT_RADAR_SEED:
        cur.execute(
            """INSERT OR IGNORE INTO event_sources
               (kind, name, url, config, fixed_category, default_category,
                is_local, enabled, disabled_reason, origin, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, 'seed', ?, ?)""",
            (row["kind"], row["name"], row["url"],
             json.dumps(row["config"], ensure_ascii=False, sort_keys=True),
             row["fixed_category"], row["default_category"], row["is_local"], ts, ts),
        )
        inserted += cur.rowcount if cur.rowcount > 0 else 0
    cur.execute(
        "INSERT OR REPLACE INTO event_radar_state (key, value) VALUES ('sources_seeded_at', ?)",
        (ts,),
    )
    return inserted


def ensure_schema(db, now: Union[None, datetime, Callable[[], datetime]] = None) -> dict:
    """Crea o completa el esquema del radar y siembra una sola vez.

    `db` es la ruta de `metrics.db` o un `RadarContext` (la conexión sale de
    `context.connect`, con `timeout=60`; R33). `now` es opcional (datetime o
    callable) y fija `created_at`/`updated_at`/`sources_seeded_at`.

    Devuelve `{"added_columns": [...], "seeded": bool, "inserted": n}`.
    Ante cualquier error hace rollback y relanza la excepción.
    """
    if now is None and isinstance(db, _context.RadarContext):
        now = db.now
    ts = _now_iso(now)
    conn = _context.connect(db)
    conn.isolation_level = None  # transacción explícita: DDL + siembra atómicos
    result = {"added_columns": [], "seeded": False, "inserted": 0}
    try:
        cur = conn.cursor()
        cur.execute("BEGIN IMMEDIATE")
        try:
            for stmt in _DDL:
                cur.execute(stmt)
            for table, cols in _ADDITIVE_COLUMNS.items():
                for name in _ensure_columns(cur, table, cols):
                    result["added_columns"].append("%s.%s" % (table, name))
            row = cur.execute(
                "SELECT value FROM event_radar_state WHERE key = 'sources_seeded_at'"
            ).fetchone()
            if row is None or not row[0]:
                result["inserted"] = _seed(cur, ts)
                result["seeded"] = True
            cur.execute("COMMIT")
        except BaseException:
            cur.execute("ROLLBACK")
            raise
    finally:
        conn.close()
    return result
