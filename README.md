<div align="center">

# Homelab Pro Dashboard

**Plataforma de Observabilidad, Telemetría y Operaciones para Servidores Personales**

[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-v8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Nginx](https://img.shields.io/badge/Nginx-Alpine-009639?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<br/>

> **Infraestructura Base**: Este dashboard funciona como la interfaz gráfica oficial para monitorear y administrar el cluster personal desplegado en:  
> **[homelab-infrastructure](https://github.com/santinohicke/homelab-infrastructure)**

</div>

---

## Características Principales

Una aplicación web progresiva (**PWA**) de alto impacto visual desarrollada en **React 19** y **Tailwind CSS v4**, diseñada bajo principios de *Glassmorphism*, micro-animaciones cristalinas y un lenguaje de diseño inspirado en la **Dynamic Island** de Apple:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DYNAMIC ISLAND WIDGET                             │
│       [Server Online]      ·      [4ms Latencia]      ·     [03:30 ART]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Centro Control] [Radar IT] [Telemetría IA] [Métricas] [DevOps] [Seguridad] [Red] [Backups] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Módulos & Solapas del Dashboard

### 1. Centro de Control
* **Dynamic Island Expandible**: Cabecera interactiva con efecto de morphing físico (altura dinámica según contenido), selector de estado y widgets rápidos.
* **Rack 3D Interactivo de Contenedores**: Modelo tridimensional de gabinete de rack 19" con rieles extensibles en perspectiva CSS 3D. Al hacer clic en cualquier unidad (Dashboard, HA, Vaultwarden, Kuma, NPM, Pi-hole, Portainer, Cloudflared):
  * **Inteligencia Cromática Semántica**: Analizador semántico de logs (`getLogLineClass`) que clasifica líneas por prioridad (verde esmeralda para estados nominales, arranque y códigos 200/OK; ámbar para advertencias; rojo rosa restringido a fallos críticos genuinos). Elimina falsos positivos causados por nombres de servicios (`fail2ban`) o estadísticas de ping ICMP (`0 errors`).
  * **Ergonomía Móvil Adaptativa**: En dispositivos móviles (<1024px), la tarjeta se expande verticalmente colocando el bastidor 3D interactivo arriba y la terminal de logs en flujo estándar abajo sin tapar el modelo tridimensional.
  * **Acciones en Vivo**: Botones para copiar logs, refrescar stream y reiniciar contenedores directamente vía Portainer API.
* **Monitoreo Uptime Kuma**: Franja de disponibilidad histórica de 30 días con badges de latencia ICMP/HTTP por microservicio.
* **Desglose de Almacenamiento SSD**: Gráfica de barra apilada multi-segmento que clasifica el uso del disco `/dev/sda3` (Sistema Operativo, Capas Docker, Logs y Espacio Libre).
* **Estimador de Consumo Eléctrico & Costo en Pesos ($ ARS)**: Cálculo en tiempo real de la potencia en vatios del procesador Intel (~16W a 22W), proyección mensual en kWh, tarifa configurable y comparativa de ahorro de energía (~92%) frente a una PC de escritorio convencional.
* **Modo Mantenimiento Global**: Interruptor en cabecera que despliega un banner cristalino en ámbar alertando sobre tareas programadas o actualizaciones en curso.

---

### 2. Radar Autónomo IT · Pasantías & Part-Time 24/7 (Google Gemini AI)
* **Vacantes 100% Reales (Zero-Mock)**: Extracción directa del estado embebido `window.__STATE__` en bolsas universitarias (UCA Campus, Universidad de Belgrano), LinkedIn Jobs y Get on Board, descartando de forma tajante datos sintéticos o alucinaciones.
* **Criterios Estrictos de Filtrado (Orientado a Ingeniería Informática)**:
  * **Jornada Obligatoria**: Exclusivamente Part-Time / Media Jornada (descarta jornadas completas o full-time de 8-9h).
  * **Ubicación & Modalidad**: Remoto o presencial/híbrido **estrictamente en CABA (Ciudad Autónoma de Buenos Aires) o GBA cercano**, descartando puestos presenciales fuera de Buenos Aires.
  * **Ramas Tecnológicas de Interés**: Redes, Telecomunicaciones, Sistemas Embebidos, Electrónica, Microcontroladores, Firmware, Bajo Nivel (C/C++, Rust, Go), Sysadmin Linux, Infraestructura, Cloud, DevOps, Ciberseguridad y Software Engineering.
  * **Exclusión Categórica**: Descarta sin excepciones puestos de Soporte Técnico, Help Desk, Service Desk, Mesa de Ayuda, Soporte Nivel 1/2, Atención a Usuarios, QA, Software Testing o Control de Calidad.
* **Blindaje Anti-Estafas y Prevención de Malware (Cero-Trust)**:
  * El prompt de inferencia de Gemini descarta activamente cualquier vacante que exija descargas de archivos ejecutables (.exe, .zip), librerías sospechosas o clones de repositorios desconocidos para supuestas "pruebas técnicas".
  * Descarta reclutadores con contacto exclusivo por canales informales (Telegram, WhatsApp o correos @gmail) sin respaldo corporativo.
  * Solo admite empresas con personería jurídica verificable, convenios universitarios formales y ATS corporativos.
* **Multi-Portal de 9 Fuentes Auditadas**:
  1. *Bolsa de Empleo Campus UCA* (`ucaecono.hiringroomcampus.com`)
  2. *Bolsa de Empleo Campus Universidad de Belgrano* (`ub.hiringroomcampus.com`)
  3. *LinkedIn Jobs: Pasantías & Part-Time IT CABA*
  4. *LinkedIn Jobs: Redes, Telecomunicaciones & Electrónica*
  5. *LinkedIn Jobs: Pasantías de Ingeniería & Tecnología*
  6. *LinkedIn Jobs: Trainee / Junior Infraestructura & DevOps*
  7. *LinkedIn Jobs: Programación Embebida, Firmware & IoT*
  8. *Get on Board: Pasantías & Part-Time Tech*
  9. *Get on Board: Sysadmin, DevOps & Cloud*
* **Filtros Simplificados**: Navegación canónica reducida a `Todas`, `Nuevas` y `Mis Postulaciones`.
* **Seguimiento de Postulaciones y Rechazos ("Me rechazaron")**:
  * En "Mis Postulaciones", botón de acción "Me rechazaron" que etiqueta la vacante con el badge `Rechazada` (color rubí/rosa) y opción de deshacer ("Desmarcar rechazo"), manteniéndolas en el flujo sin crear secciones redundantes.
  * Vacantes abiertas señaladas con estado `Postulado · En espera`.
* **Diseño Cyber Glass & Despeje Visual (Sin Naranja)**:
  * Estética depurada Apple Glass Cyber: acentos en cian puro, bordes translúcidos y fondos oscuros neutrales, eliminando completamente la paleta ámbar/naranja.
  * Formato de tarjetas simplificado: síntesis directa de 2 líneas (`line-clamp-2`), eliminando cajas pesadas con bordes redundantes.
  * Saneamiento nativo UTF-8 (`cleanText()`) para corrección de caracteres y tildes rotas (`Pasantías`).
* **Métricas Reales en Vivo**: Cuadrícula de 6 métricas extraídas en tiempo real de SQLite: *Ofertas Analizadas*, *Nuevas sin Leer*, *Mis Postulaciones*, *En Espera*, *Rechazadas* y *Portales en Vigilancia*.
* **Notificaciones Web Push Nativas para iPhone (PWA Standalone)**: Integración con Service Worker (`sw.js`), Web Push API y Badging en iOS 16.4+ para alertas instantáneas.

---

### 3. Telemetría & Observabilidad de IA (Google Gemini 3.1 Flash-Lite)
* **Medición Real de Consumo de Tokens (Sin Datos Hardcodeados)**: Registro analítico de tokens consumidos (Prompt, Completion y Total) por inferencia, con persistencia en tabla SQLite `ai_usage_logs`.
* **Límites de Cuota Free Tier & Rate Limits**:
  * **RPD (Requests per Day)**: 1.500 solicitudes diarias máximas.
  * **RPM (Requests per Minute)**: 15 solicitudes por minuto máximas.
  * **TPM (Tokens per Minute)**: 1.000.000 tokens por minuto.
* **Gráfica Temporal SVG de Consumo (24h)**: Curva cúbica Bézier de consumo de tokens distribuida por horas en las últimas 24 horas.
* **Temporizador de Reseteo de Cuota**: Contador regresivo en tiempo real hacia la medianoche UTC (00:00 UTC) donde se renueva el cupo diario gratuito de Google AI Studio.
* **Herramienta de Diagnóstico en Tiempo Real**: Botón de prueba de inferencia (`POST /api/v1/ai/test`) con medición de latencia en milisegundos y consumo de tokens en vivo.

---

### 4. Métricas & Observabilidad Analítica
* **Selector de 5 Intervalos Temporales**: Visualización instantánea en `1H`, `24H`, `7D`, `30D` y `HISTÓRICO`.
* **Filtro de Secciones**: Vista consolidada o segmentada por *Hardware*, *Red & WiFi*, *Docker*, *Seguridad* y *SLA*.
* **Comparativa Temporal ("Hoy vs Ayer / Período Anterior")**: Alterna una curva discontinua translúcida (`stroke-dasharray="4 4"`) superpuesta a la métrica actual para detectar anomalías de tráfico o picos térmicos al instante.
* **Gráficas Vectoriales Suaves**: Renderizado SVG nativo con curvas Bézier cúbicas, gradientes de luz dinámicos y tooltips con coordenadas milimétricas.

---

### 5. Consola de Operaciones & DevOps
* **Botones de Mantenimiento con 1 Clic**:
  * *Limpiar Docker*: Ejecuta poda de imágenes huérfanas (`docker system prune -af`).
  * *Vaciar Caché DNS*: Purga la memoria FTL de Pi-hole.
  * *Recargar Nginx*: Aplica cambios de proxies y certificados sin reiniciar.
  * *Crear Backup Ahora*: Dispara un snapshot manual inmediato.
* **Registro de Auditoría de Operaciones en Vivo**: Visor interactivo de salida estándar (stdout/stderr) en tiempo real con timestamp, código de retorno y badges de confirmación visual para cada tarea ejecutada en el servidor.

---

### 6. Bóveda de Seguridad & Auditoría
* **Filtrado DNS en Tiempo Real (Pi-hole FTL v6)**: Tarjeta interactiva con recuento de consultas bloqueadas del día, porcentaje de telemetría filtrada y lectura en vivo de la base de datos de gravedad (79.7k dominios). Incluye control de pausa interactiva de 5 minutos y reanudación inmediata.
* **Auditoría de Certificados SSL**: Días restantes antes del vencimiento (Let's Encrypt / Wildcard), algoritmo de curva elíptica ECDSA 384 bits y versión de protocolo TLS 1.3.
* **Descargador de Certificado CA Raíz**: Botón de un clic para exportar el certificado de confianza local en formato `.crt` para celulares y laptops.
* **Escáner de Puertos Abiertos**: Matriz de inspección de puertos en escucha (`:22`, `:80`, `:443`, `:81`, `:53`, `:8123`, `:3001`, `:9443`) con estado de firewall UFW y tasa de peticiones.
* **Registro de Intentos de Acceso (Fail2ban)**: Tabla de IPs bloqueadas por intentos de fuerza bruta con país de origen, recuento de ataques y acción de desbloqueo.
* **Salud de Bóveda Vaultwarden**: Verificación de arquitectura Zero-Knowledge y estado de checkpoints SQLite WAL.

---

### 7. Topología de Red & Mapa de Dispositivos
* **Malla WireGuard (Tailscale VPN) & Funnel**: Visualización de clientes autorizados en la malla peer-to-peer con filtrado y agregación automática de proxies Anycast de Tailscale Funnel (para evitar saturar la interfaz y destacar únicamente los dispositivos clientes reales).
* **Diagrama en Árbol Interactivo**: Visualización de la jerarquía completa: Gateway de Fibra Óptica -> Servidor Lenovo -> Docker Bridge Virtual (`172.20.0.0/16`) -> Ramas WiFi para cada móvil/PC. Al clickear cualquier nodo se despliega una ficha técnica con IPs, MACs y puertos.
* **Matriz de Ping Cruzado**: Medición interactiva de latencia ICMP entre nodos con botón de testeo en vivo.
* **Tabla DHCP & Mapeo de Direcciones MAC**: Buscador en tiempo real de hostnames, tipo de asignación (estática vs dinámica), interfaz física y velocidad negociada (1 Gbps Full-Duplex / WiFi 5 GHz).

---

### 8. Gestor de Backups & Recuperación (Disaster Recovery)
* **Calendario Mensual Visual**: Cuadrícula de 31 días con indicadores de ejecución exitosa del cron de las 03:00 AM.
* **Explorador de Snapshots**: Listado de respaldos comprimidos (`.tar.gz`, `.sqlite.bak`), tamaño en disco, fecha, botón de descarga y verificación criptográfica SHA-256.
* **Simulador de Restauración Asistida**: Asistente guiado en 4 pasos para ensayar la recuperación de un contenedor en menos de 5 minutos ante emergencias.

---

## Micro-Backend de Telemetría (Python 3 Stdlib)

La aplicación incluye un microservicio desacoplado en `backend/api.py` diseñado para entornos de bajos recursos:
* **Cero Librerías Externas (`zero-pip`)**: Desarrollado 100% sobre `http.server`, `sqlite3` y `subprocess`.
* **Consumo de Memoria**: Apenas ~20 MB de RAM y 0% de CPU en reposo.
* **Persistencia Time-Series**: Base de datos SQLite (`metrics.db`) con muestreo minuto a minuto de `/proc/stat`, `/proc/meminfo` y `/sys/class/thermal/`, con purga automática a 30 días.
* **Operaciones Seguras**: Ejecución controlada de tareas de Docker, Tailscale status en JSON y descarga directa de snapshots comprimidos `.tar.gz`.

---

## Tecnologías Utilizadas

* **Frontend**: React 19, JavaScript moderno (ESNext), Lucide React (iconografía técnica).
* **Backend**: Python 3 (Biblioteca Estándar), SQLite 3 (Series temporales), Systemd service unit.
* **Estilos & Animaciones**: Tailwind CSS v4, animaciones CSS 3D (perspectiva de rack y transformaciones), Glassmorphism (`backdrop-blur-2xl`, bordes cristalinos y hover shine effects).
* **Bundler & Build Tool**: Vite 8 con `@tailwindcss/vite` y soporte PWA para iPhone/Android.
* **Despliegue & Contenedorización**: Multi-stage Dockerfile basado en `node:20-alpine` (compilación) y `nginx:alpine` (servidor web optimizado con Gzip y caché inmutable de assets).

---

## Instalación & Ejecución Local

### 1. Clonar el Repositorio
```bash
git clone https://github.com/santinohicke/homelab-dashboard.git
cd homelab-dashboard
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Modo Desarrollo
```bash
npm run dev
```
La aplicación estará disponible localmente en `http://localhost:5173`.

### 4. Compilación para Producción
```bash
npm run build
```
Los archivos optimizados y minificados se generarán en la carpeta `dist/`.

---

## Despliegue con Docker

### Opción A: Usando Docker Compose (Recomendado)
```bash
docker compose up -d --build
```
El panel estará disponible en el puerto `3000`: `http://localhost:3000`.

### Opción B: Construcción de Imagen Manual
```bash
docker build -t homelab-dashboard:latest .
docker run -d --name homelab-dashboard -p 3000:80 --restart unless-stopped homelab-dashboard:latest
```

---

## Soporte PWA en iPhone y Android
El proyecto incluye `manifest.json`, iconos de alta resolución (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) y meta-tags adaptados para **Notch y Safe Area** (`viewport-fit=cover`). La cápsula interactiva **Dynamic Island** calcula dinámicamente su cota superior mediante `calc(env(safe-area-inset-top) + 10px)` para librar completamente el altavoz frontal y los sensores TrueDepth en dispositivos iOS con notch (como iPhone 11 y superiores). Al seleccionar *"Agregar a la pantalla de inicio"* en Safari o Chrome, el dashboard se comporta como una aplicación nativa a pantalla completa sin barra de navegación del explorador.

---

## Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
