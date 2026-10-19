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
│ [Centro Control] [Radar IT] [Telemetría IA] [Métricas] [Seguridad] [Red] [Backups]          │
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
* **Arquitectura Asíncrona No Bloqueante (Anti-Timeout 504)**: El accionador "Rastrear Ahora" ejecuta el web scraper e inferencia LLM en hilos daemon en segundo plano (`threading.Thread(daemon=True)`). Responde de inmediato con HTTP 200 JSON (`{"status": "started", "scanning": true}`) y el frontend sondea de forma reactiva el estado en vivo a través de `GET /api/v1/agent/status`, garantizando cero bloqueos de red o caídas por límites de tiempo (`proxy_read_timeout`) en proxies inversos Nginx.
* **Criterios Estrictos de Filtrado (Orientado a Ingeniería Informática)**:
  * **Jornada Obligatoria**: Exclusivamente Part-Time / Media Jornada (descarta jornadas completas o full-time de 8-9h).
  * **Ubicación & Modalidad**: Remoto o presencial/híbrido **estrictamente en CABA (Ciudad Autónoma de Buenos Aires) o GBA cercano**, descartando puestos presenciales fuera de Buenos Aires.
  * **Ramas Tecnológicas de Interés**: Redes, Telecomunicaciones, Sistemas Embebidos, Electrónica, Microcontroladores, Firmware, Bajo Nivel (C/C++, Rust, Go), Sysadmin Linux, Infraestructura, Cloud, DevOps, Ciberseguridad y Software Engineering.
  * **Exclusión Categórica**: Descarta sin excepciones puestos de Soporte Técnico, Help Desk, Service Desk, Mesa de Ayuda, Soporte Nivel 1/2, Atención a Usuarios, QA, Software Testing o Control de Calidad.
* **Blindaje Anti-Estafas y Prevención de Malware (Cero-Trust)**:
  * El prompt de inferencia de Gemini descarta activamente cualquier vacante que exija descargas de archivos ejecutables (.exe, .zip), librerías sospechosas o clones de repositorios desconocidos para supuestas "pruebas técnicas".
  * Descarta reclutadores con contacto exclusivo por canales informales (Telegram, WhatsApp o correos @gmail) sin respaldo corporativo.
  * Solo admite empresas con personería jurídica verificable, convenios universitarios formales y ATS corporativos.
* **Evaluación de Perfil Real & Match Score (0-100%)**:
  * Ponderación analítica en tiempo real de cada vacante contra el perfil real de Santino Hickethier (Ingeniería en Informática UCA 40%, Linux Headless, Docker, Python, C, Redes, Cambridge C1 Advanced).
  * Insignias dinámicas de afinidad: `>=85%` (verde esmeralda), `70-84%` (cyan), `<70%` (slate).
  * Justificación ejecutiva en 1 frase de fortalezas clave y listado interactivo de tecnologías a reforzar (`missing_skills`).
  * Píldora de filtrado "Alta Afinidad (>=80%)" y cálculo por lotes en background (`/api/v1/agent/evaluate-all-unscored`).
* **Generador de CV Harvard Estricto & Cover Letter en PDF Vectorial**:
  * **CV Formato Harvard FAS**: Estructura canónica ATS de 1 sola página, márgenes estándar de 0.65in, tipografía serif Georgia, encabezados con borde inferior y métricas reales de impacto técnico (cero experiencia ficticia).
  * **Cover Letter Personalizada**: Redacción persuasiva y formal orientada a la empresa y sus tecnologías, destacando autonomía y homelab.
  * **Renderizado Vectorial con Edge Headless**: Conversión limpia a PDF vectorial nativo (90-125 KB) sin dependencias externas pesadas.
  * **Modal de Previsualización & Descarga**: Modal con vista previa en iframe aislado, selector de idioma (Español / Inglés), copiado de texto y descarga directa de PDF binario.
* **Búsqueda Profunda y Multi-Portal Expandido**:
  1. *CaféDev REST API Oficial* (`api.cafedev.co/v1/jobs`): Consultas concurrentes multi-query (`junior`, `trainee`, `pasantia`) sobre más de 1.700 vacantes tech abiertas en LATAM.
  2. *Work Search Argentina API* (`work-search-ten.vercel.app/api/jobs`): Pasantías y vacantes trainee de empresas líderes (Mercado Libre, Newsan, BBVA).
  3. *Bolsa de Empleo Campus UCA* (`ucaecono.hiringroomcampus.com`)
  4. *Bolsa de Empleo Campus Universidad de Belgrano* (`ub.hiringroomcampus.com`)
  5. *LinkedIn Jobs: Pasantías & Part-Time IT CABA* (Paginación multi-página `start=0` y `start=25`)
  6. *LinkedIn Jobs: Redes, Telecomunicaciones & Electrónica*
  7. *LinkedIn Jobs: Pasantías de Ingeniería & Tecnología*
  8. *LinkedIn Jobs: Trainee / Junior Infraestructura & DevOps*
  9. *LinkedIn Jobs: Programación Embebida, Firmware & IoT*
  10. *Get on Board: Pasantías & Part-Time Tech*
  11. *Get on Board: Sysadmin, DevOps & Cloud*
* **Pipeline de Ingesta Inteligente & Priorización de Afinidades (`priority_score`)**:
  * **Filtrado Léxico Anti-Ruido**: Descarte automático en memoria (`NON_TECH_BLACKLIST`, `JUNK_TITLE_PATTERNS`) de puestos no afines (administrativos, secretarias, finanzas) y enlaces de navegación (login, cookies, términos).
  * **Ponderación Técnica Ponderada**: Puntuación automática (`TECH_KEYWORDS`) que ubica al inicio de la remesa evaluada por la IA las vacantes con palabras clave troncales (software, linux, devops, cloud, redes, sistemas, python, docker, pasantía, junior).
  * **Concurrencia Resiliente Multihilo**: Extracción paralela en menos de 3 segundos mediante `ThreadPoolExecutor(max_workers=8)` y `as_completed(timeout=14)` con manejo tolerante de timeouts para portales lentos.
  * **Evaluación Consolidada y Parser Tolerante a Fallos**: Lote de 25 candidatos de máxima afinidad evaluados en una sola inferencia de Gemini 3.8 Flash (`ai_bridge.py` en la PC host o nube de respaldo) con parser de recuperación por expresiones regulares a nivel de objeto (`parse_agent_findings_json`).
* **Seguimiento de Postulaciones y Rechazos ("Me rechazaron")**:
  * En "Mis Postulaciones", botón de acción "Me rechazaron" que etiqueta la vacante con el badge `Rechazada` (color rubí/rosa) y opción de deshacer ("Desmarcar rechazo"), manteniéndolas en el flujo sin crear secciones redundantes.
  * Vacantes abiertas señaladas con estado `Postulado · En espera`.
* **Diseño Cyber Glass & Despeje Visual (Sin Naranja)**:
  * Estética depurada Apple Glass Cyber: acentos en cian puro, bordes translúcidos y fondos oscuros neutrales, eliminando completamente la paleta ámbar/naranja.
  * Formato de tarjetas simplificado: síntesis directa de 2 líneas (`line-clamp-2`), eliminando cajas pesadas con bordes redundantes.
  * Saneamiento nativo UTF-8 (`cleanText()`) para corrección de caracteres y tildes rotas (`Pasantías`).
* **Métricas Reales en Vivo**: Cuadrícula de 6 métricas extraídas en tiempo real de SQLite: *Ofertas Analizadas*, *Nuevas sin Leer*, *Mis Postulaciones*, *En Espera*, *Rechazadas* y *Portales en Vigilancia*.
* **Gestión de Portales con Contención Elástica**: Modal de administración de fuentes de empleo con diseño responsivo (`overflow-hidden`, `min-w-0`), URLs fluidas y botones "Escanear" y "Pausar" blindados contra desbordes en pantallas móviles y de escritorio.
* **Notificaciones Web Push Nativas para iPhone (PWA Standalone)**: Integración con Service Worker (`sw.js`), Web Push API y Badging en iOS 16.4+ para alertas instantáneas.

---

### 3. Telemetría & Observabilidad de IA (Google Gemini 3.1 Flash-Lite)
* **Medición Real de Consumo de Tokens (Sin Datos Hardcodeados)**: Registro analítico de tokens consumidos (Prompt, Completion y Total) por inferencia, con persistencia en tabla SQLite `ai_usage_logs`.
* **Visualización de Cuota Máxima**: Tarjeta de consumo con límite máximo de tokens (`/ 1.000.000 máx`), saldo restante y barra de progreso porcentual dinámica.
* **Límites de Cuota & Rate Limits**:
  * **RPD (Requests per Day)**: 1.500 solicitudes diarias máximas.
  * **RPM (Requests per Minute)**: 15 solicitudes por minuto máximas.
  * **TPM (Tokens per Minute)**: 1.000.000 tokens por minuto.
* **Gráfica Temporal SVG Multirrango (24H, 7D, 30D, HISTÓRICO)**: Curva cúbica Bézier de consumo de tokens con selector interactivo de períodos, agrupamiento temporal dinámico en el backend y cero datos simulados.
* **Temporizador de Reseteo de Cuota**: Contador regresivo en tiempo real hacia la medianoche UTC (00:00 UTC) donde se renueva el cupo diario de Google AI Studio.
* **Herramienta de Diagnóstico en Tiempo Real**: Botón de prueba de inferencia (`POST /api/v1/ai/test`) con medición de latencia en milisegundos y consumo de tokens en vivo.

---

### 4. Métricas & Observabilidad Analítica
* **Selector de 5 Intervalos Temporales**: Visualización instantánea en `1H`, `24H`, `7D`, `30D` y `HISTÓRICO`.
* **Filtro de Secciones**: Vista consolidada o segmentada por *Hardware*, *Red & WiFi*, *Docker*, *Seguridad* y *SLA*.
* **Comparativa Temporal ("Hoy vs Ayer / Período Anterior")**: Alterna una curva discontinua translúcida (`stroke-dasharray="4 4"`) superpuesta a la métrica actual para detectar anomalías de tráfico o picos térmicos al instante.
* **Gráficas Vectoriales Suaves**: Renderizado SVG nativo con curvas Bézier cúbicas, gradientes de luz dinámicos y tooltips con coordenadas milimétricas.

---

### 5. Bóveda de Seguridad & Auditoría
* **Filtrado DNS en Tiempo Real (Pi-hole FTL v6)**: Tarjeta interactiva con recuento de consultas bloqueadas del día, porcentaje de telemetría filtrada y lectura en vivo de la base de datos de gravedad (79.7k dominios). Incluye control de pausa interactiva de 5 minutos y reanudación inmediata.
* **Auditoría de Certificados SSL**: Días restantes antes del vencimiento (Let's Encrypt / Wildcard), algoritmo de curva elíptica ECDSA 384 bits y versión de protocolo TLS 1.3.
* **Descargador de Certificado CA Raíz**: Botón de un clic para exportar el certificado de confianza local en formato `.crt` para celulares y laptops.
* **Escáner de Puertos Abiertos**: Matriz de inspección de puertos en escucha (`:22`, `:80`, `:443`, `:81`, `:53`, `:8123`, `:3001`, `:9443`) con estado de firewall UFW y tasa de peticiones.
* **Registro de Intentos de Acceso (Fail2ban)**: Tabla de IPs bloqueadas por intentos de fuerza bruta con país de origen, recuento de ataques y acción de desbloqueo.
* **Salud de Bóveda Vaultwarden**: Verificación de arquitectura Zero-Knowledge y estado de checkpoints SQLite WAL.

---

### 6. Topología de Red & Mapa de Dispositivos
* **Malla WireGuard (Tailscale VPN) & Funnel**: Visualización de clientes autorizados en la malla peer-to-peer con filtrado y agregación automática de proxies Anycast de Tailscale Funnel (para evitar saturar la interfaz y destacar únicamente los dispositivos clientes reales).
* **Diagrama en Árbol Interactivo**: Visualización de la jerarquía completa: Gateway de Fibra Óptica -> Servidor Lenovo -> Docker Bridge Virtual (`172.20.0.0/16`) -> Ramas WiFi para cada móvil/PC. Al clickear cualquier nodo se despliega una ficha técnica con IPs, MACs y puertos.
* **Matriz de Ping Cruzado**: Medición interactiva de latencia ICMP entre nodos con botón de testeo en vivo.
* **Tabla DHCP & Mapeo de Direcciones MAC**: Buscador en tiempo real de hostnames, tipo de asignación (estática vs dinámica), interfaz física y velocidad negociada (1 Gbps Full-Duplex / WiFi 5 GHz).

---

### 7. Gestor de Backups & Recuperación (Disaster Recovery)
* **Calendario Mensual Visual**: Cuadrícula de 31 días con indicadores de ejecución exitosa del cron de las 03:00 AM.
* **Explorador de Snapshots**: Listado de respaldos comprimidos (`.tar.gz`, `.sqlite.bak`), tamaño en disco, fecha, botón de descarga y verificación criptográfica SHA-256.
* **Simulador de Restauración Asistida**: Asistente guiado en 4 pasos para ensayar la recuperación de un contenedor en menos de 5 minutos ante emergencias.

---

## Micro-Backend de Telemetría (Python 3 Stdlib)

La aplicación incluye un microservicio desacoplado en `backend/api.py` diseñado para entornos de bajos recursos:
* **Cero Librerías Externas (`zero-pip`)**: Desarrollado 100% sobre `http.server`, `sqlite3` y `subprocess`.
* **Consumo de Memoria**: Apenas ~20 MB de RAM y 0% de CPU en reposo.
* **Persistencia Time-Series**: Base de datos SQLite (`metrics.db`) con muestreo minuto a minuto de `/proc/stat`, `/proc/meminfo` y `/sys/class/thermal/`, con purga automática a 30 días.
* **Inferencia Híbrida Cero-Fricción**: Despachador dinámico de IA que delega tareas analíticas al micro-puente de Antigravity CLI (`agy`) en la PC de escritorio con **Gemini 3.8 Flash (High)** cuando está encendida, conmutando de forma autónoma a la cascada directa en la nube (`gemini-3.6-flash` / `3.5`) cuando la PC está apagada.
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

## Soporte PWA y Web Push en iPhone y Android
El proyecto incluye `manifest.json`, suite completa de iconos de alta resolución (`apple-touch-icon.png`, `apple-touch-icon-180x180.png`, `apple-touch-icon-precomposed.png`, `icon-192.png`, `icon-512.png`, `favicon.ico`) y meta-tags adaptados para **Notch y Safe Area** (`viewport-fit=cover`). La cápsula interactiva **Dynamic Island** calcula dinámicamente su cota superior mediante `calc(env(safe-area-inset-top) + 10px)` para librar completamente el altavoz frontal y los sensores TrueDepth en dispositivos iOS con notch (como iPhone 11 y superiores). Al seleccionar *"Agregar a la pantalla de inicio"* en Safari o Chrome, el dashboard se comporta como una aplicación nativa a pantalla completa sin barra de navegación del explorador.

### Iconografía Homelab para Pantalla de Inicio en iOS
* **Icono de Bastidor con Luces LED**: Diseñado específicamente en formato RGB de 24 bits totalmente opaco (sin canal alfa susceptible a inconsistencias en WebKit) con resolución retina (180x180 px y 512x512 px). Representa un gabinete de servidor homelab con rieles laterales, tornillos de anclaje, ranuras de ventilación y tres luces LED diferenciadas:
  - Unidad 1: Cyan (`#00ebff`)
  - Unidad 2: Lavanda / Índigo (`#9682ff`)
  - Unidad 3: Verde Esmeralda (`#10eb96`)
* **Matriz de Compatibilidad WebKit**: Se sirven explícitamente las variantes `/apple-touch-icon-180x180.png`, `/apple-touch-icon-precomposed.png`, `/apple-touch-icon.png` y `/favicon.ico` con directivas Nginx de caché y control de fallback (`try_files $uri =404;`), impidiendo que peticiones de iconos reciban respuestas HTML y asegurando que iOS cargue siempre la imagen real en lugar del monograma de texto por defecto.

### Notificaciones Push en iOS (iOS 16.4+)
En cumplimiento estricto con las especificaciones de seguridad de Apple WebKit:
* **Contexto Seguro Requerido (`HTTPS`)**: iOS restringe el acceso a la API de Notificaciones exclusivamente a conexiones seguras (`https://`). En conexiones HTTP sin cifrar, WebKit bloquea el prompt del sistema.
* **Modo PWA Standalone**: Para recibir notificaciones en segundo plano, la web debe iniciarse desde el acceso directo guardado en la Pantalla de Inicio de iOS.
* **Service Worker Universal**: Las alertas se canalizan mediante `navigator.serviceWorker.ready` y `registration.showNotification()`, evitando el constructor `new Notification()` no soportado en WebKit móvil.
* **Certificado Público Let's Encrypt**: En entornos con Tailscale MagicDNS, el panel se sirve con certificado oficial Let's Encrypt de confianza pública (`https://lenovo-server.tail197fd6.ts.net`), garantizando la descarga inmediata del icono del bastidor y el funcionamiento pleno de Web Push sin alertas de certificado en iOS.


---

## Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
