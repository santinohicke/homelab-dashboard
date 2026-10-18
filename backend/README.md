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
| `GET` | `/api/v1/docker/logs?container=...&lines=40` | Streaming de logs en vivo de un contenedor Docker. |

### Operaciones & Mantenimiento
| Método | Endpoint | Acción Ejecutada en el Servidor |
| :--- | :--- | :--- |
| `POST` | `/api/v1/actions/docker-prune` | Ejecuta `docker system prune -f` para liberar espacio de imágenes huerfanas. |
| `POST` | `/api/v1/actions/flush-dns` | Purga la caché DNS de Pi-hole (`pihole restartdns`). |
| `POST` | `/api/v1/actions/backup` | Dispara el snapshot manual atómico de Vaultwarden y Home Assistant. |
| `POST` | `/api/v1/actions/reload-nginx` | Recarga configuraciones del proxy inverso sin reiniciar conexiones. |
| `GET/POST`| `/api/v1/maintenance` | Consulta o activa/desactiva la bandera de modo mantenimiento (`maintenance.flag`). |

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
| `GET` | `/api/v1/agent/findings` | Devuelve las convocatorias detectadas ordenadas por fecha con contador de no leídos. |
| `GET` | `/api/v1/agent/targets` | Lista de portales web y fuentes de empleo configuradas con sus intervalos. |
| `POST` | `/api/v1/agent/run` | Fuerza la ejecución inmediata del scraper y análisis con Google Gemini 3.1 Flash-Lite. |
| `POST` | `/api/v1/agent/mark-read` | Marca una oferta (`{"id": N}`) o todas (`{"all": true}`) como leídas. |
| `POST` | `/api/v1/agent/archive` | Archiva una oferta (`{"id": N}`) de la vista activa. |
| `POST` | `/api/v1/agent/targets` | Agrega un nuevo portal o URL con criterios personalizados de búsqueda. |
| `POST` | `/api/v1/agent/targets/toggle` | Pausa o activa el monitoreo periódico de un portal existente (`{"id": N}`). |

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
