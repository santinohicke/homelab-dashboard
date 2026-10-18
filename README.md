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
│  [Centro Control] [Métricas] [DevOps] [Seguridad] [Red] [Backups]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Módulos & Solapas del Dashboard

### 1. Centro de Control
* **Dynamic Island Expandible**: Cabecera interactiva con efecto de morphing físico (altura dinámica según contenido), selector de estado y widgets rápidos.
* **Rack 3D Interactivo de Contenedores**: Modelo tridimensional de gabinete de rack 19" con rieles extensibles en perspectiva CSS 3D. Al hacer clic en cualquier unidad (Dashboard, HA, Vaultwarden, Kuma, NPM, Pi-hole, Portainer), se abre una terminal de **Logs en Tiempo Real** con opción de copiar y reiniciar el contenedor.
* **Monitoreo Uptime Kuma**: Franja de disponibilidad histórica de 30 días con badges de latencia ICMP/HTTP por microservicio.
* **Desglose de Almacenamiento SSD**: Gráfica de barra apilada multi-segmento que clasifica el uso del disco `/dev/sda3` (Sistema Operativo, Capas Docker, Logs y Espacio Libre).
* **Estimador de Consumo Eléctrico & Costo en Pesos ($ ARS)**: Cálculo en tiempo real de la potencia en vatios del procesador Intel (~16W a 22W), proyección mensual en kWh, tarifa configurable y comparativa de ahorro de energía (~92%) frente a una PC de escritorio convencional.
* **Modo Mantenimiento Global**: Interruptor en cabecera que despliega un banner cristalino en ámbar alertando sobre tareas programadas o actualizaciones en curso.

---

### 2. Métricas & Observabilidad Analítica
* **Selector de 5 Intervalos Temporales**: Visualización instantánea en `1H`, `24H`, `7D`, `30D` y `HISTÓRICO`.
* **Filtro de Secciones**: Vista consolidada o segmentada por *Hardware*, *Red & WiFi*, *Docker*, *Seguridad* y *SLA*.
* **Comparativa Temporal ("Hoy vs Ayer / Período Anterior")**: Alterna una curva discontinua translúcida (`stroke-dasharray="4 4"`) superpuesta a la métrica actual para detectar anomalías de tráfico o picos térmicos al instante.
* **Gráficas Vectoriales Suaves**: Renderizado SVG nativo con curvas Bézier cúbicas, gradientes de luz dinámicos y tooltips con coordenadas milimétricas.

---

### 3. Consola de Operaciones & DevOps
* **Botones de Mantenimiento con 1 Clic**:
  * *Limpiar Docker*: Ejecuta poda de imágenes huérfanas (`docker system prune -af`).
  * *Vaciar Caché DNS*: Purga la memoria FTL de Pi-hole.
  * *Recargar Nginx*: Aplica cambios de proxies y certificados sin reiniciar.
  * *Crear Backup Ahora*: Dispara un snapshot manual inmediato.
* **Registro de Auditoría de Operaciones en Vivo**: Visor interactivo de salida estándar (stdout/stderr) en tiempo real con timestamp, código de retorno y badges de confirmación visual para cada tarea ejecutada en el servidor.

---

### 4. Bóveda de Seguridad & Auditoría
* **Filtrado DNS en Tiempo Real (Pi-hole FTL v6)**: Tarjeta interactiva con recuento de consultas bloqueadas del día, porcentaje de telemetría filtrada y lectura en vivo de la base de datos de gravedad (79.7k dominios). Incluye control de pausa interactiva de 5 minutos y reanudación inmediata.
* **Auditoría de Certificados SSL**: Días restantes antes del vencimiento (Let's Encrypt / Wildcard), algoritmo de curva elíptica ECDSA 384 bits y versión de protocolo TLS 1.3.
* **Descargador de Certificado CA Raíz**: Botón de un clic para exportar el certificado de confianza local en formato `.crt` para celulares y laptops.
* **Escáner de Puertos Abiertos**: Matriz de inspección de puertos en escucha (`:22`, `:80`, `:443`, `:81`, `:53`, `:8123`, `:3001`, `:9443`) con estado de firewall UFW y tasa de peticiones.
* **Registro de Intentos de Acceso (Fail2ban)**: Tabla de IPs bloqueadas por intentos de fuerza bruta con país de origen, recuento de ataques y acción de desbloqueo.
* **Salud de Bóveda Vaultwarden**: Verificación de arquitectura Zero-Knowledge y estado de checkpoints SQLite WAL.

---

### 5. Topología de Red & Mapa de Dispositivos
* **Malla WireGuard (Tailscale VPN) & Funnel**: Visualización de clientes autorizados en la malla peer-to-peer con filtrado y agregación automática de proxies Anycast de Tailscale Funnel (para evitar saturar la interfaz y destacar únicamente los dispositivos clientes reales).
* **Diagrama en Árbol Interactivo**: Visualización de la jerarquía completa: Gateway de Fibra Óptica -> Servidor Lenovo -> Docker Bridge Virtual (`172.20.0.0/16`) -> Ramas WiFi para cada móvil/PC. Al clickear cualquier nodo se despliega una ficha técnica con IPs, MACs y puertos.
* **Matriz de Ping Cruzado**: Medición interactiva de latencia ICMP entre nodos con botón de testeo en vivo.
* **Tabla DHCP & Mapeo de Direcciones MAC**: Buscador en tiempo real de hostnames, tipo de asignación (estática vs dinámica), interfaz física y velocidad negociada (1 Gbps Full-Duplex / WiFi 5 GHz).

---

### 6. Gestor de Backups & Recuperación (Disaster Recovery)
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
El proyecto incluye `manifest.json`, iconos de alta resolución (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) y meta-tags adaptados para **Notch y Safe Area** (`viewport-fit=cover`). Al seleccionar *"Agregar a la pantalla de inicio"* en Safari o Chrome, el dashboard se comporta como una aplicación nativa a pantalla completa sin barra de navegación del explorador.

---

## Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
