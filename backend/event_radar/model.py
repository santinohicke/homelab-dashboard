"""Modelos de datos compartidos entre parsers, normalize, store y engine.

Contrato fijado en plan.md, sección 4. Los nombres de campos siguen R3-R8.
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class RawEvent:
    """Salida de un parser, antes de filtros y normalización."""

    provider: str
    origin_id: str
    title: str
    description: Optional[str]
    start_local: str
    end_local: Optional[str]
    has_time: bool
    closing_local: Optional[str]
    closing_explicit: bool
    venue: Optional[str]
    city: Optional[str]
    region: Optional[str]
    location_text: Optional[str]
    lat: Optional[float]
    lon: Optional[float]
    url: str
    require_approval: Optional[bool]
    sold_out: Optional[bool]
    event_type: Optional[str]
    calendar: Optional[dict]   # {api_id, name, slug} de Luma


@dataclass
class Event(RawEvent):
    """Evento después de `normalize.apply()`."""

    category: str
    location_unconfirmed: bool
    dedupe_key: str
    canonical_url: str
    is_cfp: bool


@dataclass
class PageObservation:
    """Resultado de observar una página `page_hash` (R19)."""

    http_status: Optional[int]
    hash: Optional[str]
    error: Optional[str]


@dataclass
class SourceResult:
    """Resultado de correr una fuente en una pasada."""

    status: str                 # ok | zero | error | timeout
    raw_count: int              # ítems crudos antes de filtros (R39)
    events: List[RawEvent]
    error: Optional[str] = None
    page: Optional[PageObservation] = None
    duration_s: float = 0.0


SOURCE_STATUSES = ("ok", "zero", "error", "timeout")
