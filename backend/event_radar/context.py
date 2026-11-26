"""Contexto inyectable del radar de eventos y conexión SQLite (R33).

Todo lo que el radar necesita del backend (ruta de la base, envío de
alertas, red, reloj, log, azar) entra por `RadarContext`, así los tests
reemplazan cada pieza por un doble sin tocar la red ni la base real.
"""

import random
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Callable, Union

if TYPE_CHECKING:  # solo para anotaciones; net.py vive en otra tarea
    from .net import Fetcher

# R33: todas las conexiones del radar esperan hasta 60 s un lock de escritura.
SQLITE_TIMEOUT = 60


@dataclass
class RadarContext:
    db_path: str
    alert_fn: Callable[..., bool]        # firma de dispatch_ha_alert (A9)
    fetcher: "Fetcher"
    now: Callable[[], datetime]          # aware, -03:00
    monotonic: Callable[[], float]
    sleep: Callable[[float], None]
    log: Callable[[str], None]
    rng: random.Random


def connect(ctx_or_path: Union[RadarContext, str]) -> sqlite3.Connection:
    """Abre la base del radar con `timeout=60` y `row_factory=sqlite3.Row`.

    Acepta un `RadarContext` o directamente la ruta del archivo.
    """
    if isinstance(ctx_or_path, RadarContext):
        db_path = ctx_or_path.db_path
    elif isinstance(ctx_or_path, str):
        db_path = ctx_or_path
    else:
        raise TypeError(
            "connect() espera un RadarContext o una ruta str, no %s"
            % type(ctx_or_path).__name__
        )
    conn = sqlite3.connect(db_path, timeout=60)
    conn.row_factory = sqlite3.Row
    return conn
