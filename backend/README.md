# Homelab Telemetry Micro-Backend (Python 3)

Un microservicio de telemetría y operaciones diseñado para correr en servidores domésticos con **restricciones severas de hardware** (ej. Intel Core i3 con 3 GB de memoria RAM compartida).

---

## Principios de Diseño

1. **Cero Dependencias Externas (`zero-pip`)**:
   Implementado 100% sobre la biblioteca estándar de Python 3 (`http.server`, `sqlite3`, `subprocess`, `threading`, `socket`). No requiere `virtualenv`, `pip install` ni mantenimiento de librerías.
2. **Huella de Memoria Minúscula (`<25 MB RSS`)**:
   Consume apenas ~20 MB de memoria RAM real en ejecución y 0% de CPU en reposo.
3. **Persistencia Eficiente (SQLite Time-Series)**:
   Registra muestras periódicas de hardware (CPU, RAM, temperatura y disco) en un archivo SQLite liviano (`metrics.db`). Incorpora auto-purga a los 30 días para mantener el tamaño del archivo por debajo de 5 MB.
4. **Integración Directa con Linux & Docker**:
   Inspecciona `/proc/stat`, `/proc/meminfo` y `/sys/class/thermal/` a nivel de kernel para mediciones precisas de hardware, e interactúa con el daemon de Docker (`docker logs`, `docker system prune`) de forma nativa.

---

## Endpoints de la API REST

### Telemetría & Sistema
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/system` | Estado en vivo: CPU %, RAM usada/libre, temperatura °C, disco y uptime. |
| `GET` | `/api/v1/telemetry?range=24h` | Series temporales SQLite (`1h`, `24h`, `7d`, `30d`, `historic`). |
| `GET` | `/api/v1/tailscale` | Malla de nodos Tailscale WireGuard (`tailscale status --json`). |
| `GET` | `/api/v1/docker/logs?container=...&lines=40` | Streaming de logs en vivo. Soporta contenedores Docker y servicios nativos (`pihole-FTL`, `cloudflared` vía journalctl), purga secuencias de escape ANSI y devuelve estado nominal si el contenedor no existe. |

### Operaciones & Mantenimiento
| Método | Endpoint | Acción Ejecutada en el Servidor |
| :--- | :--- | :--- |
| `POST` | `/api/v1/actions/docker-prune` | Ejecuta `docker system prune -f` para liberar espacio de imágenes huerfanas. |
| `POST` | `/api/v1/actions/sqlite-vacuum` | Ejecuta `VACUUM` en SQLite para compactar y defragmentar metrics.db. |
| `POST` | `/api/v1/actions/renew-ssl` | Valida y renueva certificados SSL / Tailscale MagicDNS. |
| `POST` | `/api/v1/actions/speedtest` | Dispara medición manual inmediata de latencia ICMP/DNS y throughput. |
| `POST` | `/api/v1/actions/gfs-purge` | Aplica la política de retención GFS (7 diarios, 4 semanales, 1 mensual). |
| `POST` | `/api/v1/actions/morning-briefing` | Genera y despacha el resumen matutino ejecutivo de 3 líneas vía Push. |
| `POST` | `/api/v1/actions/flush-dns` | Purga la caché DNS de Pi-hole (`pihole restartdns`). |
| `POST` | `/api/v1/actions/backup` | Dispara el snapshot manual atómico de Vaultwarden y Home Assistant. |
| `POST` | `/api/v1/actions/reload-nginx` | Recarga configuraciones del proxy inverso sin reiniciar conexiones. |
| `GET/POST`| `/api/v1/maintenance` | Consulta o activa/desactiva la bandera de modo mantenimiento (`maintenance.flag`). |
| `GET` | `/api/v1/cron/tasks` | Lista las 8 tareas programadas del host con estado y periodicidad. |
| `GET` | `/api/v1/alerts` | Historial de alertas proactivas emitidas a Home Assistant y registradas en SQLite. |
| `GET` | `/api/v1/network/speedtest` | Historial de pruebas de velocidad y latencias de enlace WAN/DNS. |
| `GET` | `/api/v1/dropzone/items` | Lista elementos compartidos en el DropZone y portapapeles compartido. |
| `POST` | `/api/v1/dropzone/text` | Envía un texto o URL al portapapeles compartido del Homelab. |
| `POST` | `/api/v1/dropzone/upload` | Recibe archivos y fotos en el SSD del servidor para transferencias PC ↔ iPhone. |
| `GET` | `/api/v1/dropzone/download?id=...` | Descarga directa de archivos alojados en DropZone. |

### Backups & Auditoría de Seguridad
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/backups` | Lista los archivos `.tar.gz` reales con tamaño legible y hash SHA-256. |
| `GET` | `/api/v1/backups/download?file=...` | Descarga directa de snapshots hacia el navegador web. |
| `GET` | `/api/v1/security/audit` | Escaneo local de puertos en escucha y auditoría de expiración SSL (TLS 1.3). |

### DNS & Adblock (Pi-hole FTL v6)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/pihole` | Telemetría en vivo: dominios en gravedad, consultas del día y porcentaje bloqueado. |
| `POST` | `/api/v1/pihole/pause` | Pausa el filtrado de publicidad durante 5 minutos para pruebas (`pihole disable 5m`). |
| `POST` | `/api/v1/pihole/resume` | Reanuda el filtrado DNS inmediatamente (`pihole enable`). |

### Agente Autónomo de Investigación IT & Pasantías (Gemini AI Zero-Billing)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/agent/findings` | Devuelve convocatorias reales ordenadas por fecha con objeto `stats` (totales, aplicados, pendientes, rechazados). |
| `GET` | `/api/v1/agent/status` | Devuelve el estado en tiempo real del recolector (`scanning: true/false`, progreso y últimos resultados). |
| `GET` | `/api/v1/agent/targets` | Lista de portales web y fuentes de empleo configuradas con sus intervalos. |
| `POST` | `/api/v1/agent/run` | Dispara el rastreo autónomo en segundo plano de forma no bloqueante (retorna 200 JSON inmediato). |
| `POST` | `/api/v1/agent/apply` | Marca una convocatoria como postulado (`is_applied = 1`, `is_read = 1`, `is_rejected = 0`). |
| `POST` | `/api/v1/agent/unapply` | Desmarca la postulación activa (`is_applied = 0`, `is_rejected = 0`). |
| `POST` | `/api/v1/agent/reject` | Registra el rechazo de una postulación (`is_rejected = 1`, `is_applied = 1`, `is_read = 1`). |
| `POST` | `/api/v1/agent/unreject` | Desmarca el rechazo volviendo la postulación a estado en espera (`is_rejected = 0`). |
| `POST` | `/api/v1/agent/mark-read` | Marca una oferta (`{"id": N}`) o todas (`{"all": true}`) como leídas. |
| `POST` | `/api/v1/agent/archive` | Archiva una oferta (`{"id": N}`) de la vista activa. |
| `POST` | `/api/v1/agent/targets` | Agrega un nuevo portal o URL con criterios personalizados de búsqueda. |
| `POST` | `/api/v1/agent/targets/toggle` | Pausa o activa el monitoreo periódico de un portal existente (`{"id": N}`). |
| `POST` | `/api/v1/agent/generate-doc` | Genera CV en Formato Harvard ATS o Cover Letter personalizada (HTML y PDF vectorial embebido). |
| `POST` | `/api/v1/agent/save-doc` | Guarda modificaciones de texto/HTML en CV o Cover Letter y regenera el PDF vectorial vía Edge Headless. |
| `GET` | `/api/v1/agent/doc?id=...&type=cv\|cover_letter` | Consulta el HTML generado y representación binaria en Base64. |
| `GET` | `/api/v1/agent/download-doc?id=...&type=cv\|cover_letter` | Descarga directa del archivo PDF vectorial nativo (`application/pdf`). |
| `POST` | `/api/v1/agent/evaluate-match` | Calcula Match Score (0-100%), justificación y missing_skills para una vacante específica. |
| `POST` | `/api/v1/agent/evaluate-all-unscored` | Inicia en segundo plano la evaluación secuencial de todas las vacantes sin puntaje. |

### Telemetría de Inteligencia Artificial (Observabilidad & Cuotas)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/ai/stats?range=24h` | Métricas reales de consumo Gemini: tokens consumidos hoy/histórico, límites RPD/RPM/TPM, curva Bézier multirrango (`24h`, `7d`, `30d`, `historic`) y countdown a reseteo UTC. |
| `POST` | `/api/v1/ai/test` | Ejecuta un test de diagnóstico de inferencia en vivo registrando latencia y tokens exactos consumidos en `ai_usage_logs`. |

### Pipeline de Ingesta Inteligente y Scraper Paralelo Multihilo
* **Extracción Concurrente (`ThreadPoolExecutor`)**: Conexión simultánea a los 12 portales mediante `as_completed(timeout=14)` con gestión resiliente de timeouts, reduciendo el tiempo de sondeo de 155s a <3s.
* **Prefiltrado Léxico, Restricción Universitaria y Ponderación (`priority_score`)**:
  - **Filtro Anti-Ruido y Anti-SSR**: Descarte automático en memoria (`NON_TECH_BLACKLIST`, `SEMI_SENIOR_BLACKLIST`, `FULL_TIME_BLACKLIST`) para erradicar puestos de jornada completa, roles intermedios (Semi-Senior), carreras no afines y botones de interfaz.
  - **Restricción Geográfica**: Descarte de puestos fuera de CABA / GBA salvo que sean 100% remotos (`OUT_OF_COUNTRY_BLACKLIST`).
  - **Paginación y Enlaces Limpios en LinkedIn**: Coincidencia obligatoria de `/jobs/view/` y ventana temporal estricta (`f_TPR=r604800`, últimos 7 días).
  - **Ponderación Técnica Ponderada**: Puntuación automática (`TECH_KEYWORDS`) que ubica al inicio de la remesa evaluada por la IA las vacantes con palabras clave troncales (software, linux, devops, cloud, redes, sistemas, python, docker, pasantía, junior).
* **Evaluación Consolidada por Lotes**: Remesa de hasta 35 vacantes concurrentes evaluadas en una única inferencia LLM (`max_tokens=3500`, timeout=70s) contra el perfil real de Santino Hickethier.
* **Parser Híbrido de Recuperación Regex (`parse_agent_findings_json`)**: Extracción resiliente por coincidencia estructural de objetos JSON o viñetas Markdown (`Selected Candidate`, `PUESTO: ...`, `EMPRESA: ...`) si el modelo presenta preámbulos o formatos alternativos.
* **Enforcement de `responseMimeType: application/json`**: Obliga a los modelos de respaldo en la nube a generar JSON canónico sin Markdown exterior.

### Arquitectura de Inferencia Híbrida Cero-Fricción
El backend implementa un despachador dinámico de inferencia (`execute_hybrid_ai`) con detección automática de presencia:
1. **Modo PC Encendida (Prioridad 1):** Delega la inferencia mediante Tailscale WireGuard a un micro-puente HTTP en la máquina de escritorio (`100.64.0.20:8099`), el cual ejecuta el CLI oficial de Google Antigravity (`agy.exe -p`) resolviendo con **Gemini 3.8 Flash (High)** a través de los canales prioritarios de Cloud Code (sin saturación 503).
2. **Modo PC Apagada (Autonomía 24/7):** Si la PC de escritorio se encuentra apagada o suspendida, el servidor conmuta de inmediato y de forma autónoma a una cascada directa sobre la API de Google (`gemini-3.8-flash` -> `gemini-3.6-flash` -> `gemini-3.5-flash` -> `gemini-flash-lite-latest`), garantizando que el homelab nunca detenga sus tareas analíticas.

---

## Despliegue en el Servidor

### 1. Ejecución Manual
```bash
python3 /opt/homelab/backend/api.py
```

### 2. Servicio del Sistema (systemd)
Copiar el archivo de unidad provisto a systemd para que arranque automáticamente con el sistema y se reinicie ante fallos:
```bash
sudo cp backend/homelab-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now homelab-api
```

Verificar estado:
```bash
sudo systemctl status homelab-api
curl http://localhost:8088/api/v1/system
```
