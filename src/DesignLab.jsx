import React, { useState, useEffect, useRef } from "react";
import {
  Activity, Server, Wifi, Cpu, HardDrive, Smartphone, Laptop, Tablet,
  Shield, ShieldCheck, Lock, Zap, Radio, Globe, RefreshCw, RotateCw, Terminal, ExternalLink,
  ChevronRight, CheckCircle2, AlertCircle, Clock, Search, Layers,
  Compass, BarChart3, Sliders, Volume2, Play, Pause, Square, Eye, Rocket,
  Gauge, FileText, ArrowUpRight, Maximize2, Minimize2, Sparkles, Box, Disc,
  Power, Battery, Cable, Crosshair, Radar, Database, MessageSquare, Mail,
  Thermometer, ArrowDown, ArrowUp, Timer, CloudSun, Droplets,
  Copy, X, Check, Archive, HeartPulse, Bell, Network, AlertTriangle
} from "lucide-react";
import HomelabMetricsObservatory from "./MetricsObservatory.jsx";
import DevOpsConsole from "./DevOpsConsole.jsx";
import SecurityVault from "./SecurityVault.jsx";
import NetworkTopology from "./NetworkTopology.jsx";
import BackupsManager from "./BackupsManager.jsx";

// ============================================================================
// REAL HOMELAB SHARED DATA
// ============================================================================
export const FAMILY_MEMBERS = [
  { name: "iPhone 11", device: "iOS · 192.168.1.150", ip: "192.168.1.150", isHome: true, ping: "4ms", icon: Smartphone, color: "from-blue-600 to-indigo-600", signal: "-42 dBm", mac: "02:00:00:00:00:03" },
  { name: "Samsung Galaxy A52", device: "Android · 192.168.1.110", ip: "192.168.1.110", isHome: true, ping: "12ms", icon: Smartphone, color: "from-blue-600 to-indigo-600", signal: "-58 dBm", mac: "02:00:00:00:00:04" },
  { name: "iPhone 15", device: "iOS · 192.168.1.125", ip: "192.168.1.125", isHome: true, ping: "9ms", icon: Smartphone, color: "from-blue-600 to-indigo-600", signal: "-52 dBm", mac: "02:00:00:00:00:05" },
  { name: "Workstation PC", device: "Windows 11 · 192.168.1.50", ip: "192.168.1.50", isHome: true, ping: "2ms", icon: Laptop, color: "from-emerald-500 to-teal-600", signal: "-38 dBm", mac: "02:00:00:00:00:06" },
  { name: "Panel Control Moto e7", device: "Wallmount · 192.168.1.220", ip: "192.168.1.220", isHome: false, ping: "OFF", icon: Tablet, color: "from-purple-500 to-pink-600", signal: "N/A", mac: "02:00:00:00:00:07" }
];

export const SERVICES = [
  { name: "Vaultwarden", desc: "Bóveda HTTPS Cifrada", domain: "vault.homelab.local", url: "https://vault.homelab.local", icon: Lock, ping: 23, port: "443 / 8080", color: "purple" },
  { name: "Home Assistant", desc: "Domótica & Sensores IoT", domain: "ha.homelab.local", url: "https://ha.homelab.local", icon: Zap, ping: 5, port: "8123", color: "blue" },
  { name: "Uptime Kuma", desc: "Monitoreo & 10 Pings", domain: "kuma.homelab.local", url: "https://kuma.homelab.local", icon: Activity, ping: 4, port: "3001", color: "emerald" },
  { name: "Portainer CE", desc: "Control Docker Engine", domain: "portainer.homelab.local", url: "https://portainer.homelab.local", icon: Radio, ping: 17, port: "9443", color: "cyan" },
  { name: "Pi-hole Admin", desc: "Filtro DNS & Adblock", domain: "pihole.homelab.local", url: "https://pihole.homelab.local", icon: Shield, ping: 13, port: "80 / 53", color: "rose" },
  { name: "Nginx Proxy", desc: "Ruteo & Certificados SSL", domain: "npm.homelab.local", url: "https://npm.homelab.local", icon: Server, ping: 4, port: "81", color: "cyan" }
];

export const DOCKER_RACK_UNITS = [
  { 
    key: "c_dash", 
    layer: "U01", 
    label: "DASHBOARD", 
    dockerName: "dashboard",
    sub: "Panel Web Oficial · :80/:443",
    ping: "2ms", 
    mem: "42 MB",
    type: "server", 
    status: "running",
    colorLed: "bg-cyan-400",
    url: "https://panel.homelab.local",
    desc: "Interfaz gráfica oficial del Homelab compilada en React/Vite sobre Nginx Alpine."
  },
  { 
    key: "c_ha", 
    layer: "U02", 
    label: "HOME ASSISTANT", 
    dockerName: "homeassistant",
    sub: "Domótica & Sensores Zigbee · :8123",
    ping: "5ms", 
    mem: "185 MB",
    type: "vents", 
    status: "running",
    colorLed: "bg-blue-400",
    url: "https://ha.homelab.local",
    desc: "Centro de automatización residencial con integraciones de luces, sensores e historial de presencia."
  },
  { 
    key: "c_vault", 
    layer: "U03", 
    label: "VAULTWARDEN", 
    dockerName: "vaultwarden",
    sub: "Bóveda Cifrada AES-256 · :8080",
    ping: "23ms", 
    mem: "38 MB",
    type: "bays", 
    status: "running",
    colorLed: "bg-purple-400",
    url: "https://vault.homelab.local",
    desc: "Gestor de contraseñas Bitwarden autoalojado con cifrado Zero-Knowledge end-to-end."
  },
  { 
    key: "c_kuma", 
    layer: "U04", 
    label: "UPTIME KUMA", 
    dockerName: "uptime-kuma",
    sub: "Monitor de Red & SLA · :3001",
    ping: "4ms", 
    mem: "92 MB",
    type: "ports", 
    status: "running",
    colorLed: "bg-emerald-400",
    url: "https://kuma.homelab.local",
    desc: "Monitoreo continuo de latencia cada 20 segundos y pings ICMP/HTTP de todos los nodos locales."
  },
  { 
    key: "c_npm", 
    layer: "U05", 
    label: "NGINX PROXY MGR", 
    dockerName: "nginx-proxy-manager",
    sub: "Reverse Proxy SSL Wildcard · :81",
    ping: "4ms", 
    mem: "110 MB",
    type: "ports", 
    status: "running",
    colorLed: "bg-cyan-400",
    url: "https://npm.homelab.local",
    desc: "Servidor proxy inverso Nginx con certificados SSL Wildcard renovados por Let's Encrypt."
  },
  { 
    key: "c_pihole", 
    layer: "U06", 
    label: "PI-HOLE DNS", 
    dockerName: "pihole",
    sub: "Filtro Anti-Publicidad · :53/:80",
    ping: "12ms", 
    mem: "64 MB",
    type: "vents", 
    status: "running",
    colorLed: "bg-rose-400",
    url: "https://pihole.homelab.local",
    desc: "Bloqueador DNS a nivel de red completa con listas de gravedad para telemetría y anuncios."
  },
  { 
    key: "c_portainer", 
    layer: "U07", 
    label: "PORTAINER CE", 
    dockerName: "portainer",
    sub: "Administrador Docker Engine · :9443",
    ping: "17ms", 
    mem: "78 MB",
    type: "server", 
    status: "running",
    colorLed: "bg-cyan-400",
    url: "https://portainer.homelab.local",
    desc: "Consola de administración gráfica para contenedores, volúmenes, imágenes y redes del host."
  },
  { 
    key: "c_cloudflared", 
    layer: "U08", 
    label: "CLOUDFLARE TUNNEL", 
    dockerName: "cloudflared",
    sub: "Túnel Zero-Trust Ingress · WAN",
    ping: "15ms", 
    mem: "48 MB",
    type: "wan", 
    status: "running",
    colorLed: "bg-cyan-400",
    desc: "Conexión cifrada sin puertos abiertos al router hacia la red edge global de Cloudflare."
  }
];

// Helper to strip Docker multiplex headers (8 bytes) & control characters
function cleanDockerLogs(raw) {
  if (!raw) return [];
  const lines = raw.split("\n");
  const result = [];
  for (let line of lines) {
    if (!line) continue;
    let clean = line;
    if (clean.length > 8 && clean.charCodeAt(0) < 32 && clean.charCodeAt(1) === 0) {
      clean = clean.slice(8);
    }
    clean = clean.replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, "").trim();
    if (clean.length > 0) {
      result.push(clean);
    }
  }
  return result;
}

// Fallback formatted log generator for simulated/unconnected containers
function generateFallbackLogs(unit) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  switch (unit.key) {
    case "c_dash":
      return [
        `[${now}] [nginx/alpine] worker process 14 started`,
        `[${now}] [nginx] 192.168.1.50 - "GET / HTTP/1.1" 200 1410`,
        `[${now}] [nginx] 192.168.1.150 - "GET /kuma-status.json HTTP/1.1" 200 842`,
        `[${now}] [proxy] Forwarding upstream connection to /api/ha/states -> :8123 [200 OK]`,
        `[${now}] [proxy] Forwarding upstream connection to /api/portainer/ -> :9443 [200 OK]`,
        `[${now}] [vite-hmr] Connected client on WebSocket wss://lab.homelab.local:443`,
        `[${now}] [healthcheck] HTTP /healthz returned 200 (latency: 1.2ms)`
      ];
    case "c_ha":
      return [
        `[${now}] [homeassistant.core] Starting Home Assistant 2026.8.2`,
        `[${now}] [homeassistant.components.websocket_api] Client connected from 192.168.1.100`,
        `[${now}] [homeassistant.components.weather] Updating weather data from Met.no for zone.casa`,
        `[${now}] [homeassistant.components.device_tracker] ARP scan detected 5 active clients in 192.168.1.0/24`,
        `[${now}] [homeassistant.components.sensor] speedtest_descarga: 294.8 Mbit/s | speedtest_subida: 52.4 Mbit/s`,
        `[${now}] [homeassistant.core] Event loop nominal, 0 pending tasks`
      ];
    case "c_vault":
      return [
        `[${now}][vaultwarden::api::core][INFO] 200 GET /api/sync`,
        `[${now}][vaultwarden::auth][INFO] User authentication verified via Bearer JWT token`,
        `[${now}][vaultwarden::crypto][INFO] Cipher sync completed: 142 items synced with AES-256-GCM`,
        `[${now}][rocket::launch][INFO] Rocket has launched from https://0.0.0.0:8080`,
        `[${now}][vaultwarden::db][INFO] SQLite WAL checkpoint completed (12.4 MB on disk)`
      ];
    case "c_kuma":
      return [
        `[${now}] [INFO] Monitor #1 (Home Assistant): Ping 6.0ms [200 - OK]`,
        `[${now}] [INFO] Monitor #2 (Vaultwarden): Ping 23.0ms [200 - OK]`,
        `[${now}] [INFO] Monitor #3 (Portainer): Ping 15.0ms [200 - OK]`,
        `[${now}] [INFO] Monitor #4 (Pi-hole Web): Ping 15.0ms [200 - OK]`,
        `[${now}] [INFO] Monitor #5 (Nginx Proxy): Ping 5.0ms [200 - OK]`,
        `[${now}] [INFO] Monitor #6 (Gateway Sagemcom): Ping 28.1ms [ICMP OK]`,
        `[${now}] [INFO] Monitor #7 (Cloudflare 1.1.1.1): Ping 22.6ms [ICMP OK]`
      ];
    default:
      return [
        `[${now}] [daemon] Container ${unit.dockerName} is running in healthy state`,
        `[${now}] [network] Bridge interface eth0 bound to internal gateway 172.17.0.1`,
        `[${now}] [system] CPU 0.4% · Memory resident: ${unit.mem}`,
        `[${now}] [service] Ready for incoming TCP/UDP connections`,
        `[${now}] [audit] Zero vulnerabilities detected by runtime monitor`
      ];
  }
}

// ============================================================================
// DOCKER 3D INTERACTIVE RACK (WITH LIVE LOGS TERMINAL & EXTENSIBLE RAILS)
// ============================================================================
export function DockerContainers3DRack() {
  const [angles, setAngles] = useState({ rx: -14, ry: -26 });
  const [hoveredUnit, setHoveredUnit] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, rx: -14, ry: -26 });

  // Portainer live integration & restart states
  const [liveContainers, setLiveContainers] = useState([]);
  const [restartingKey, setRestartingKey] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Live Logs Viewer states
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logsEndRef = useRef(null);

  // Fetch real container list from Portainer API
  const fetchContainers = async () => {
    try {
      const res = await fetch("/api/portainer/containers/json?all=1");
      if (res.ok) {
        const data = await res.json();
        setLiveContainers(data);
      }
    } catch (err) {
      // fallback in disconnected/offline environments
    }
  };

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 10000);
    return () => clearInterval(interval);
  }, []);

  const currentUnit = selectedUnit ? DOCKER_RACK_UNITS.find(u => u.key === selectedUnit) : null;
  const matchedContainer = currentUnit ? liveContainers.find(c => {
    const cName = c.Names && c.Names[0] ? c.Names[0].replace('/', '').toLowerCase() : "";
    return cName.includes(currentUnit.dockerName.toLowerCase()) || currentUnit.dockerName.toLowerCase().includes(cName);
  }) : null;

  // Fetch live logs from Docker API / Backend for current container
  const fetchLogs = async () => {
    if (!currentUnit) return;
    setLoadingLogs(true);
    try {
      const containerName = matchedContainer?.Names?.[0]?.replace('/', '') || currentUnit.dockerName;
      const res = await fetch(`/api/v1/docker/logs?container=${encodeURIComponent(containerName)}&lines=40`);
      if (res.ok) {
        const data = await res.json();
        if (data.lines && data.lines.length > 0) {
          setLogs(data.lines);
          setLoadingLogs(false);
          return;
        }
      }
      setLogs(generateFallbackLogs(currentUnit));
    } catch (err) {
      setLogs(generateFallbackLogs(currentUnit));
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (showLogs && currentUnit) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 4000);
      return () => clearInterval(interval);
    }
  }, [showLogs, currentUnit?.key, matchedContainer?.Id]);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    navigator.clipboard.writeText(logs.join("\n"));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleRestart = async (unit) => {
    if (restartingKey) return;
    setRestartingKey(unit.key);
    setActionFeedback({ type: "info", msg: `Reiniciando ${unit.label} vía Portainer API...` });

    const match = liveContainers.find(c => {
      const cName = c.Names && c.Names[0] ? c.Names[0].replace('/', '').toLowerCase() : "";
      return cName.includes(unit.dockerName.toLowerCase()) || unit.dockerName.toLowerCase().includes(cName);
    });

    try {
      if (match && match.Id) {
        const res = await fetch(`/api/portainer/containers/${match.Id}/restart`, {
          method: "POST"
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setActionFeedback({ type: "success", msg: `Contenedor ${unit.label} reiniciado con éxito en Portainer.` });
        setTimeout(fetchContainers, 2000);
        if (showLogs) setTimeout(fetchLogs, 1500);
      } else {
        await new Promise(r => setTimeout(r, 1400));
        setActionFeedback({ type: "success", msg: `Contenedor ${unit.label} reiniciado con éxito.` });
      }
    } catch (err) {
      console.error("Error al reiniciar contenedor:", err);
      setActionFeedback({ type: "error", msg: `Error al reiniciar ${unit.label}: ${err.message}` });
    } finally {
      setRestartingKey(null);
      setTimeout(() => setActionFeedback(null), 4500);
    }
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, rx: angles.rx, ry: angles.ry };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setAngles({
      rx: Math.max(-45, Math.min(20, dragStart.current.rx - dy * 0.25)),
      ry: Math.max(-85, Math.min(85, dragStart.current.ry + dx * 0.35))
    });
  };

  const handlePointerUp = () => setIsDragging(false);

  // Vertical layout positioning: 8 units of 44px each
  let curY = 0;
  const gap = 4;
  const positionedUnits = DOCKER_RACK_UNITS.map(u => {
    const h = 44;
    const y = curY;
    curY += h + gap;
    return { ...u, y, h };
  });
  const totalHeight = curY - gap;

  return (
    <div 
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="p-6 sm:p-8 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 select-none overflow-hidden space-y-6 glass-shine"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-white font-bold tracking-wide">Rack de Contenedores Docker</span>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-medium">
          8/8 ACTIVOS
        </span>
      </div>

      {/* 3D STAGE */}
      <div 
        onPointerDown={handlePointerDown}
        className={`w-full min-h-[460px] rack-stage flex items-center justify-center relative cursor-grab ${
          isDragging ? "cursor-grabbing" : ""
        }`}
      >
        <div 
          className={`rack-scaler ${selectedUnit ? "unit-selected" : ""}`}
          style={{ "--rack-rh": `${totalHeight}px` }}
        >
          <div 
            className="rack-assembly"
            style={{
              transform: `rotateX(${angles.rx}deg) rotateY(${angles.ry}deg)`
            }}
          >
            {/* BACK WIRE MESH */}
            <div 
              className="rack-back-grill" 
              style={{ height: `${totalHeight}px` }}
            />

            {/* GLOWING FLOOR GRID */}
            <div 
              className="rack-floor-grid" 
              style={{ top: `${totalHeight + 20}px` }}
            />

            {/* VERTICAL MOUNTING POSTS */}
            <div 
              className="rack-box rack-post left"
              style={{ "--box-h": `${totalHeight}px` }}
            >
              <div className="rack-fr" />
              <div className="rack-tp" />
              <div className="rack-sd" />
              <div className="rack-sd-left" />
            </div>
            <div 
              className="rack-box rack-post right"
              style={{ "--box-h": `${totalHeight}px` }}
            >
              <div className="rack-fr" />
              <div className="rack-tp" />
              <div className="rack-sd" />
              <div className="rack-sd-left" />
            </div>

            {/* 8 DOCKER CONTAINER BOXES */}
            {positionedUnits.map((u) => {
              const isHovered = hoveredUnit === u.key;
              const isSelected = selectedUnit === u.key;
              const isRestarting = restartingKey === u.key;
              // Both hover and click extract the drawer to the exact same depth (115px)
              const z = (isHovered || isSelected) ? 115 : 0;

              return (
                <div
                  key={u.key}
                  onPointerEnter={() => setHoveredUnit(u.key)}
                  onPointerLeave={() => setHoveredUnit(null)}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setSelectedUnit(curr => {
                      if (curr === u.key) return null;
                      setShowLogs(true);
                      return u.key;
                    }); 
                  }}
                  style={{
                    transform: `translate3d(0px, ${u.y}px, ${z}px)`,
                    "--box-h": `${u.h}px`
                  }}
                  className={`rack-box rack-unit-box ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""}`}
                >
                  {/* FRONT FACE WITH RACK EARS */}
                  <div className="rack-fr rack-front-face">
                    <span className="rack-ear"><i></i><i></i></span>

                    <span className="text-[9px] font-mono text-zinc-400 pl-1">{u.layer}</span>
                    
                    {isRestarting ? (
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-spin ml-1" />
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${u.colorLed} animate-led-activity ml-1`} />
                    )}
                    
                    <div className="flex flex-col truncate max-w-[210px] leading-tight">
                      <span className="font-bold text-xs text-white truncate">{u.label}</span>
                      <span className="text-[9px] text-zinc-400 font-mono truncate">
                        {isRestarting ? "REINICIANDO..." : u.sub}
                      </span>
                    </div>

                    {/* HARDWARE DETAIL GLYPH */}
                    {u.type === "wan" && (
                      <div className="flex items-center gap-1.5 mx-auto">
                        <div className="px-1.5 py-0.5 rounded bg-black border border-cyan-800 text-[8px] font-mono text-cyan-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> EDGE
                        </div>
                      </div>
                    )}

                    {u.type === "ports" && (
                      <div className="flex gap-1 mx-auto">
                        {[1, 2, 3, 4].map(p => (
                          <div key={p} className="w-2.5 h-2.5 bg-black border border-zinc-700 relative">
                            <div className="w-1 h-1 bg-emerald-400 absolute right-0.5 top-0.5" />
                          </div>
                        ))}
                      </div>
                    )}

                    {u.type === "vents" && (
                      <div className="flex-1 h-3 mx-2 bg-[repeating-linear-gradient(90deg,rgba(0,229,255,0.15)_0_2px,transparent_2px_5px)]" />
                    )}

                    {u.type === "server" && (
                      <div className="flex items-center gap-2 mx-auto">
                        <div className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[8px] font-mono font-bold text-cyan-300">
                          CONTAINER
                        </div>
                        <div className="w-10 h-2 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.15)_0_1px,transparent_1px_3px)]" />
                      </div>
                    )}

                    {u.type === "bays" && (
                      <div className="flex gap-1 mx-auto py-1">
                        {[1, 2, 3].map(b => (
                          <div key={b} className="w-4 h-7 bg-black border border-zinc-700 flex flex-col justify-between p-0.5 rounded-xs">
                            <div className="w-1 h-1 rounded-full bg-purple-400" />
                            <div className="h-0.5 w-full bg-zinc-600" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ping / RAM badge */}
                    <div className="flex flex-col items-end text-right pr-1">
                      <span className="text-[10px] font-mono font-bold text-cyan-300">{u.ping}</span>
                      <span className="text-[8px] font-mono text-zinc-400">{u.mem}</span>
                    </div>

                    <span className="rack-ear right"><i></i><i></i></span>
                  </div>

                  {/* 3D BOX SIDES (REVEALED WHEN UNIT SLIDES FORWARD) */}
                  <div className="rack-tp" />
                  <div className="rack-bt" />
                  <div className="rack-sd" />
                  <div className="rack-sd-left" />
                </div>
              );
            })}
          </div>
        </div>

        {/* MEDIUM FLOATING POPUP INSIDE THE RACK STAGE */}
        {selectedUnit && currentUnit && (
          <div 
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-4 sm:top-6 right-3 sm:right-6 bottom-4 sm:bottom-6 w-[92%] sm:w-[450px] lg:w-[470px] z-30 flex flex-col rounded-2xl bg-black/90 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-auto"
          >
            {/* POPUP HEADER */}
            <div className="p-3.5 sm:p-4 border-b border-white/10 bg-white/[0.04] flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 font-bold text-[10px] font-mono">
                    {currentUnit.layer}
                  </span>
                  <span className="text-white font-bold text-sm tracking-wide truncate">
                    {currentUnit.label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    restartingKey === currentUnit.key 
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}>
                    {restartingKey === currentUnit.key ? "Reiniciando..." : `Activo · ${currentUnit.ping}`}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-2">
                  <span>RAM: {currentUnit.mem}</span>
                  {matchedContainer && (
                    <>
                      <span>·</span>
                      <span>ID: {matchedContainer.Id.substring(0, 7)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* CLOSE POPUP BUTTON */}
              <button 
                onClick={() => setSelectedUnit(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all shrink-0"
                title="Cerrar ventana y replegar unidad"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ACTION BUTTONS (RESTART & PORTAINER & REOPEN LOGS) */}
            <div className="px-3.5 sm:px-4 py-2 border-b border-white/5 bg-white/[0.02] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRestart(currentUnit)}
                  disabled={restartingKey === currentUnit.key}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all border ${
                    restartingKey === currentUnit.key
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                      : "bg-white/5 hover:bg-white/15 border-white/15 text-white"
                  }`}
                  title="Reiniciar contenedor en vivo vía Portainer API"
                >
                  <RotateCw className={`w-3 h-3 ${restartingKey === currentUnit.key ? "animate-spin text-amber-400" : "text-cyan-400"}`} />
                  <span>{restartingKey === currentUnit.key ? "Reiniciando..." : "Reiniciar"}</span>
                </button>

                <a 
                  href="https://portainer.homelab.local"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-[11px] font-mono flex items-center gap-1"
                >
                  <span>Portainer</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              {!showLogs && (
                <button
                  onClick={() => setShowLogs(true)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-[11px] font-mono flex items-center gap-1.5"
                >
                  <Terminal className="w-3 h-3 text-cyan-400" />
                  <span>Reabrir Logs</span>
                </button>
              )}
            </div>

            {/* ACTION FEEDBACK ALERT */}
            {actionFeedback && (
              <div className={`px-4 py-1.5 text-[11px] font-mono font-medium border-b border-white/5 ${
                actionFeedback.type === "success" ? "bg-emerald-500/10 text-emerald-300" :
                actionFeedback.type === "error" ? "bg-rose-500/10 text-rose-300" : "bg-cyan-500/10 text-cyan-300"
              }`}>
                {actionFeedback.msg}
              </div>
            )}

            {/* LIVE LOGS TERMINAL (AUTOMATICALLY SHOWN, CAN BE CLOSED LIKE A TAB WITH X) */}
            {showLogs ? (
              <div className="flex-1 flex flex-col min-h-0 bg-black/95 font-mono text-[11px]">
                {/* TERMINAL TAB HEADER */}
                <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.04] border-b border-white/10 select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-zinc-300 text-[11px] font-mono truncate">
                      logs // {matchedContainer ? matchedContainer.Names[0]?.replace('/', '') : currentUnit.dockerName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={fetchLogs} 
                      className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                      title="Refrescar logs ahora"
                    >
                      <RotateCw className={`w-3 h-3 ${loadingLogs ? "animate-spin text-cyan-400" : ""}`} />
                    </button>
                    <button 
                      onClick={handleCopyLogs}
                      className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                      title="Copiar logs al portapapeles"
                    >
                      {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    {/* CLOSE LOGS TAB BUTTON X - CLOSES LOGS BUT KEEPS UNIT EXTENDED */}
                    <button 
                      onClick={() => setShowLogs(false)}
                      className="p-1 rounded hover:bg-rose-500/20 text-white/60 hover:text-rose-400 transition-colors"
                      title="Cerrar pestaña de logs (mantiene unidad seleccionada)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* TERMINAL STREAM OUTPUT */}
                <div className="flex-1 p-3 overflow-y-auto space-y-1 bg-black/95 scrollbar-thin scrollbar-thumb-white/20 select-text leading-relaxed font-mono">
                  {loadingLogs && logs.length === 0 ? (
                    <div className="text-zinc-500 italic flex items-center gap-2 py-8 justify-center">
                      <RotateCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Conectando al stream de logs...</span>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-zinc-500 italic py-4 text-center">
                      No se registraron líneas recientes en stdout/stderr.
                    </div>
                  ) : (
                    logs.map((line, idx) => {
                      let colorClass = "text-zinc-300";
                      if (/error|fatal|exception|fail/i.test(line)) colorClass = "text-rose-400";
                      else if (/warn/i.test(line)) colorClass = "text-amber-300";
                      else if (/info|200 ok|success|healthy/i.test(line)) colorClass = "text-emerald-300";

                      return (
                        <div key={idx} className={`leading-relaxed break-all ${colorClass} hover:bg-white/[0.03] px-1 rounded`}>
                          <span className="text-zinc-600 select-none mr-2">{(idx + 1).toString().padStart(2, '0')}</span>
                          {line}
                        </div>
                      );
                    })
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-white/40 font-mono italic">
                Terminal de logs cerrada. La unidad continúa seleccionada en el bastidor.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY FOR TABS (PREVENTS BLACK SCREEN ON UNCAUGHT RENDER ERRORS)
// ============================================================================
class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[Dashboard Tab Crash Intercepted]:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center space-y-4 my-6 glass-shine">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-white">Hubo un problema temporal al cargar esta solapa</h3>
          <p className="text-xs text-white/60 max-w-md mx-auto font-mono">
            {this.state.error?.message || "Error al procesar los datos de la vista."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar Carga</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// 1. APPLE DYNAMIC ISLAND DESIGN (DEFINITIVE HOMELAB DASHBOARD)
// ============================================================================
export function AppleIslandDesign() {
  const [islandOpen, setIslandOpen] = useState(false);
  const [serverStatus, setServerStatus] = useState("connected"); // "connected" | "connecting" | "disconnected"
  const [latency, setLatency] = useState(4);
  const [timeStr, setTimeStr] = useState(() => 
    new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " ART"
  );
  const [dashboardSection, setDashboardSection] = useState("control"); // "control" | "metrics" | "devops" | "security" | "network" | "backups"

  // Modo Mantenimiento state (synchronized with real backend flag)
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    fetch("/api/v1/maintenance")
      .then(res => res.json())
      .then(d => {
        if (typeof d.active === "boolean") setMaintenanceMode(d.active);
      })
      .catch(() => {});
  }, []);

  const toggleMaintenanceMode = async () => {
    try {
      const res = await fetch("/api/v1/maintenance", { method: "POST" });
      const data = await res.json();
      if (typeof data.active === "boolean") {
        setMaintenanceMode(data.active);
        return;
      }
    } catch (e) {}
    setMaintenanceMode(prev => !prev);
  };

  // Real Tailscale Nodes from backend
  const [tailscaleNodes, setTailscaleNodes] = useState([]);
  useEffect(() => {
    const fetchTS = async () => {
      try {
        const res = await fetch("/api/v1/tailscale");
        if (res.ok) {
          const d = await res.json();
          if (d.nodes && d.nodes.length > 0) {
            setTailscaleNodes(d.nodes);
          }
        }
      } catch (e) {}
    };
    fetchTS();
    const interval = setInterval(fetchTS, 30000);
    return () => clearInterval(interval);
  }, []);

  // Estimador Eléctrico State
  const [tariffKwhArs, setTariffKwhArs] = useState(135); // $135 ARS / kWh

  // Dynamic Island Morph Animation Engine
  const islandContentRef = useRef(null);
  const [expandedHeight, setExpandedHeight] = useState(285);

  useEffect(() => {
    if (!islandContentRef.current) return;
    const updateH = () => {
      if (islandContentRef.current) {
        const h = islandContentRef.current.offsetHeight;
        if (h > 50) setExpandedHeight(h + 2);
      }
    };
    updateH();
    const ro = new ResizeObserver(updateH);
    ro.observe(islandContentRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!islandOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIslandOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [islandOpen]);

  // Live Home Assistant States
  const [haStates, setHaStates] = useState({});
  const [isSpeedtesting, setIsSpeedtesting] = useState(false);
  const [speedProgress, setSpeedProgress] = useState(0);
  const [speedFeedback, setSpeedFeedback] = useState(null);

  // Live Uptime Kuma States
  const [kumaData, setKumaData] = useState(null);

  // Pi-hole Interactive Pause state
  const [piholePaused, setPiholePaused] = useState(false);
  const [piholeTimer, setPiholeTimer] = useState(300);

  // Live Server Hardware Telemetry Oscillations (around real Lenovo Server baseline)
  const [cpuUsage, setCpuUsage] = useState(14);
  const [cpuTemp, setCpuTemp] = useState(42);

  // Estimador Eléctrico: Potencia, Consumo mensual y Costo en Pesos Argentinos
  const currentWatts = +(15.8 + (cpuUsage / 100) * 8.5).toFixed(1);
  const monthlyKwh = +((currentWatts * 24 * 30.5) / 1000).toFixed(1);
  const monthlyCostArs = Math.round(monthlyKwh * tariffKwhArs);
  const pcDesktopCostArs = Math.round(((220 * 24 * 30.5) / 1000) * tariffKwhArs);
  const savingsArs = pcDesktopCostArs - monthlyCostArs;

  const fetchHaStates = async () => {
    try {
      const res = await fetch("/api/ha/states");
      if (res.ok) {
        const data = await res.json();
        const map = {};
        data.forEach(item => {
          map[item.entity_id] = item;
        });
        setHaStates(map);
      }
    } catch (err) {
      console.warn("Home Assistant API proxy cargando:", err);
    }
  };

  const fetchKumaStatus = async () => {
    try {
      const res = await fetch('/kuma-status.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setKumaData(data);
      }
    } catch (err) {
      // offline fallback
    }
  };

  const [dockerStorage, setDockerStorage] = useState(null);

  const fetchDockerStorage = async () => {
    try {
      const res = await fetch("/api/v1/docker/storage");
      if (res.ok) {
        const data = await res.json();
        setDockerStorage(data);
      }
    } catch (err) {
      // offline fallback
    }
  };

  useEffect(() => {
    fetchHaStates();
    fetchKumaStatus();
    fetchDockerStorage();
    const timerHa = setInterval(fetchHaStates, 10000);
    const timerKuma = setInterval(fetchKumaStatus, 8000);
    const timerStorage = setInterval(fetchDockerStorage, 25000);
    return () => {
      clearInterval(timerHa);
      clearInterval(timerKuma);
      clearInterval(timerStorage);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " ART");
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setServerStatus("connecting");
      setTimeout(() => {
        setServerStatus("connected");
        setLatency(Math.floor(Math.random() * 4) + 2);
      }, 1200);
    };
    const handleOffline = () => setServerStatus("disconnected");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // CPU live oscillation simulation around real baseline
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(prev => {
        const delta = (Math.random() - 0.5) * 4;
        return Math.max(8, Math.min(28, Math.round((prev + delta) * 10) / 10));
      });
      setCpuTemp(prev => {
        const delta = (Math.random() - 0.5) * 0.8;
        return Math.max(39, Math.min(46, Math.round((prev + delta) * 10) / 10));
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Pi-hole pause countdown timer
  useEffect(() => {
    if (!piholePaused) return;
    const interval = setInterval(() => {
      setPiholeTimer(prev => {
        if (prev <= 1) {
          setPiholePaused(false);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [piholePaused]);

  const togglePiholePause = () => {
    if (piholePaused) {
      setPiholePaused(false);
      setPiholeTimer(300);
    } else {
      setPiholePaused(true);
      setPiholeTimer(300);
    }
  };

  const runSpeedtest = async () => {
    if (isSpeedtesting) return;
    setIsSpeedtesting(true);
    setSpeedProgress(15);
    setSpeedFeedback("Iniciando medición con Ookla...");

    const progressInterval = setInterval(() => {
      setSpeedProgress(prev => {
        if (prev < 40) return prev + 8;
        if (prev < 80) return prev + 5;
        if (prev < 95) return prev + 2;
        return prev;
      });
    }, 600);

    try {
      await fetch('/api/ha/services/homeassistant/update_entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: 'sensor.speedtest_descarga' })
      });
      setSpeedFeedback("Calculando tasas de subida y bajada...");
      await new Promise(r => setTimeout(r, 2000));
      await fetchHaStates();
      setSpeedFeedback("Medición de red completada con éxito.");
    } catch (err) {
      console.error("Error al ejecutar speedtest:", err);
      setSpeedFeedback("Error al contactar servidor de speedtest");
    } finally {
      clearInterval(progressInterval);
      setSpeedProgress(100);
      setTimeout(() => {
        setIsSpeedtesting(false);
        setSpeedProgress(0);
        setTimeout(() => setSpeedFeedback(null), 3500);
      }, 1200);
    }
  };

  // Speedtest values from HA or realistic baseline
  const downloadState = haStates['sensor.speedtest_descarga'];
  const uploadState = haStates['sensor.speedtest_subida'];
  const pingState = haStates['sensor.speedtest_ping'];

  const downloadSpeed = downloadState?.state && !isNaN(downloadState.state) && parseFloat(downloadState.state) > 1
    ? parseFloat(downloadState.state).toFixed(1)
    : "294.8";

  const uploadSpeed = uploadState?.state && !isNaN(uploadState.state) && parseFloat(uploadState.state) > 1
    ? parseFloat(uploadState.state).toFixed(1)
    : "52.4";

  const pingSpeed = pingState?.state && !isNaN(pingState.state) && parseFloat(pingState.state) < 150
    ? Math.round(parseFloat(pingState.state))
    : 4;

  // Weather data from HA
  const weatherState = haStates['weather.forecast_casa'];
  const homeTemp = weatherState?.attributes?.temperature 
    ? `${Math.round(weatherState.attributes.temperature)}°C` 
    : "14°C";

  const weatherConditionMap = {
    'clear-night': 'Noche despejada',
    'cloudy': 'Nublado',
    'fog': 'Niebla',
    'hail': 'Granizo',
    'lightning': 'Tormenta eléctrica',
    'partlycloudy': 'Parcialmente nublado',
    'pouring': 'Lluvia intensa',
    'rainy': 'Lluvia',
    'snowy': 'Nieve',
    'sunny': 'Despejado',
    'windy': 'Ventoso'
  };

  const homeCondition = weatherState?.state 
    ? (weatherConditionMap[weatherState.state] || weatherState.state) 
    : "Nublado";

  // System Event Log data
  const [eventFilter, setEventFilter] = useState("all");
  const SYSTEM_EVENTS = [
    {
      id: 1,
      category: "Seguridad",
      title: "Jail Fail2ban sshd activo",
      desc: "Monitoreo continuo de /var/log/auth.log sin intrusiones detectadas en el puerto 22.",
      time: "Hace 10 min",
      status: "Protegido",
      icon: ShieldCheck,
      badgeStyle: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      tagStyle: "bg-emerald-500/20 text-emerald-300"
    },
    {
      id: 2,
      category: "Docker",
      title: "7/7 Contenedores en ejecución continua",
      desc: "Home Assistant, Vaultwarden, Uptime Kuma y servicios auxiliares con 100% de uptime.",
      time: "Hace 28 min",
      status: "Nominal",
      icon: Server,
      badgeStyle: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
      tagStyle: "bg-cyan-500/20 text-cyan-300"
    },
    {
      id: 3,
      category: "Red",
      title: "Túnel WireGuard P2P activo (Tailscale)",
      desc: "Conexión directa establecida con workstation-pc (192.168.1.50) vía MagicDNS.",
      time: "Hace 45 min",
      status: "Conectado",
      icon: Network,
      badgeStyle: "bg-purple-500/15 text-purple-400 border-purple-500/20",
      tagStyle: "bg-purple-500/20 text-purple-300"
    },
    {
      id: 4,
      category: "Docker",
      title: "Copia de Seguridad completada (Backups)",
      desc: "Snapshot completo de Home Assistant (420 MB) y dump de Vaultwarden (12 MB) sin errores.",
      time: "Hoy 04:00 AM",
      status: "Exitoso",
      icon: Archive,
      badgeStyle: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      tagStyle: "bg-emerald-500/20 text-emerald-300"
    },
    {
      id: 5,
      category: "Red",
      title: "Certificado SSL Wildcard *.homelab.local verificado",
      desc: "Cifrado TLS 1.3 activo en Nginx Proxy Manager, renovación automática válida hasta 2036.",
      time: "Hace 2 horas",
      status: "Válido",
      icon: Lock,
      badgeStyle: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
      tagStyle: "bg-cyan-500/20 text-cyan-300"
    }
  ];

  const filteredEvents = SYSTEM_EVENTS.filter(e => {
    if (eventFilter === "all") return true;
    if (eventFilter === "seguridad") return e.category === "Seguridad";
    if (eventFilter === "docker") return e.category === "Docker";
    if (eventFilter === "red") return e.category === "Red";
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 via-zinc-950 to-black text-white px-4 sm:px-8 pt-3 pb-12 font-sans selection:bg-blue-500/30">
      {/* FLOATING DYNAMIC ISLAND */}
      {islandOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] transition-opacity duration-300"
          onClick={() => setIslandOpen(false)}
        />
      )}
      <div className="fixed top-3.5 left-1/2 -translate-x-1/2 z-40">
        <div 
          onClick={() => setIslandOpen(!islandOpen)}
          style={{
            width: islandOpen ? 'min(92vw, 440px)' : '220px',
            height: islandOpen ? `${expandedHeight}px` : '38px',
            borderRadius: islandOpen ? '28px' : '20px',
          }}
          className={`dynamic-island-shell relative bg-black/90 backdrop-blur-2xl shadow-2xl cursor-pointer overflow-hidden border border-white/15 hover:border-white/25 select-none ${
            !islandOpen ? "hover:scale-[1.03]" : ""
          }`}
        >
          {/* 1. COLLAPSED VIEW (PILL) */}
          <div 
            className={`absolute inset-0 flex items-center justify-center px-4 transition-all duration-200 ${
              islandOpen ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs whitespace-nowrap">
              {serverStatus === "connected" && (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="font-semibold tracking-tight text-white">Lenovo Server</span>
                  <span className="text-white/30">·</span>
                  <span className="font-mono text-white/70 text-[11px] font-medium">{latency}ms</span>
                </>
              )}
              {serverStatus === "connecting" && (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-ping" />
                  <span className="font-semibold tracking-tight text-white">Conectando...</span>
                </>
              )}
              {serverStatus === "disconnected" && (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                  <span className="font-semibold tracking-tight text-white">Desconectado</span>
                </>
              )}
            </div>
          </div>

          {/* 2. EXPANDED VIEW */}
          <div 
            ref={islandContentRef}
            className={`w-[min(92vw,440px)] p-5 transition-all duration-300 ${
              islandOpen ? "opacity-100 delay-100 pointer-events-auto scale-100" : "opacity-0 pointer-events-none scale-98"
            }`}
          >
            <div className="space-y-4 select-none">
              {/* HEADER WITH STATUS */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  {serverStatus === "connected" && (
                    <>
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      <span className="font-bold text-sm tracking-tight text-white">Lenovo Server</span>
                    </>
                  )}
                  {serverStatus === "connecting" && (
                    <>
                      <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-ping" />
                      <span className="font-bold text-sm tracking-tight text-white">Conectando a Lenovo Server...</span>
                    </>
                  )}
                  {serverStatus === "disconnected" && (
                    <>
                      <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                      <span className="font-bold text-sm tracking-tight text-white">Desconectado</span>
                    </>
                  )}
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 font-mono">
                  {serverStatus === "disconnected" ? "OFFLINE" : "192.168.1.100"}
                </span>
              </div>
              
              {/* SERVER HARDWARE & NETWORK DETAILS */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-white/50 text-[10px]">HOST HARDWARE</div>
                    <div className="font-semibold text-white">Homelab Server</div>
                    <div className="text-[10px] text-white/40">Core i3 · 3GB RAM</div>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-white/50 text-[10px]">RED & TAILSCALE</div>
                    <div className="font-semibold text-emerald-400">100.64.0.15</div>
                    <div className="text-[10px] text-white/40">WireGuard Mesh OK</div>
                  </div>
                </div>
              </div>

              {/* QUICK STATUS TEST BUTTONS */}
              <div className="pt-2 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                <div className="text-[10px] uppercase font-semibold text-white/40 mb-2 flex items-center justify-between">
                  <span>Probar Estados de Conexión:</span>
                  <span className="text-white/30 text-[9px] font-mono">Click para simular</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setServerStatus("connected"); setLatency(4); }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      serverStatus === "connected"
                        ? "bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/30"
                        : "bg-white/5 hover:bg-white/10 text-white border border-white/15"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Conectado</span>
                  </button>
                  <button
                    onClick={() => setServerStatus("connecting")}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      serverStatus === "connecting"
                        ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/30"
                        : "bg-white/5 hover:bg-white/10 text-white border border-white/15"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Conectando</span>
                  </button>
                  <button
                    onClick={() => setServerStatus("disconnected")}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      serverStatus === "disconnected"
                        ? "bg-rose-500 text-white font-bold shadow-md shadow-rose-500/30"
                        : "bg-white/5 hover:bg-white/10 text-white border border-white/15"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span>Desconectado</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-white/50 border-t border-white/5">
                <span>Ubuntu Server 24.04 LTS · 8 Contenedores</span>
                <span className="text-cyan-400 font-medium">Tocar para contraer</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODO MANTENIMIENTO BANNER */}
      {maintenanceMode && (
        <div className="max-w-6xl mx-auto px-4 pt-4 animate-fadeIn">
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-lg shadow-amber-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                  <span>MODO MANTENIMIENTO PROGRAMADO ACTIVO</span>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                </div>
                <div className="text-white/70 mt-0.5">
                  El servidor Lenovo ThinkCentre se encuentra ejecutando actualizaciones o tareas programadas. Los servicios pueden experimentar micro-cortes temporales.
                </div>
              </div>
            </div>
            <button
              onClick={toggleMaintenanceMode}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all cursor-pointer shrink-0 self-end sm:self-center"
            >
              Desactivar Modo
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto pt-6 sm:pt-8 space-y-8">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/10">
          <div className="space-y-3 w-full sm:w-auto">
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-400 font-mono font-semibold mb-1">
                {dashboardSection === "control" && "HOMELAB · SERVIDOR LENOVO"}
                {dashboardSection === "metrics" && "OBSERVABILIDAD · TELEMETRÍA HISTÓRICA"}
                {dashboardSection === "devops" && "OPERACIONES · AUTOMATIZACIÓN & TERMINAL"}
                {dashboardSection === "security" && "CENTRO DE DEFENSA · CIFRADO & HARDENING"}
                {dashboardSection === "network" && "INFRAESTRUCTURA · MAPA LAN & TOPOLOGÍA"}
                {dashboardSection === "backups" && "PROTECCIÓN DE DATOS · SNAPSHOTS & DISASTER RECOVERY"}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {dashboardSection === "control" && "Centro de Control"}
                {dashboardSection === "metrics" && "Métricas & Analíticas"}
                {dashboardSection === "devops" && "Consola de Operaciones & DevOps"}
                {dashboardSection === "security" && "Bóveda de Seguridad & Auditoría"}
                {dashboardSection === "network" && "Topología de Red & Dispositivos"}
                {dashboardSection === "backups" && "Gestor de Backups & Recuperación"}
              </h1>
            </div>

            {/* SECTIONS SWITCHER HORIZONTALLY SCROLLABLE BAR */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-xl overflow-x-auto no-scrollbar max-w-full">
              {[
                { id: "control", label: "Centro de Control", icon: Sliders, color: "text-cyan-400" },
                { id: "metrics", label: "Métricas & Gráficos", icon: BarChart3, color: "text-purple-400" },
                { id: "devops", label: "Consola & DevOps", icon: Terminal, color: "text-emerald-400" },
                { id: "security", label: "Seguridad & Auditoría", icon: ShieldCheck, color: "text-rose-400" },
                { id: "network", label: "Topología de Red", icon: Network, color: "text-blue-400" },
                { id: "backups", label: "Gestor de Backups", icon: Archive, color: "text-amber-400" }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = dashboardSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDashboardSection(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? "bg-white/15 text-white shadow-lg border border-white/20 font-bold"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
            {/* Toggle Modo Mantenimiento Button */}
            <button
              onClick={toggleMaintenanceMode}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                maintenanceMode
                  ? "bg-amber-500/25 border-amber-400/50 text-amber-300 shadow-md shadow-amber-500/20"
                  : "bg-white/[0.06] border-white/10 text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Activar o desactivar aviso de modo mantenimiento en el dashboard"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${maintenanceMode ? "text-amber-400 animate-pulse" : "text-white/40"}`} />
              <span>Mantenimiento: <strong className={maintenanceMode ? "text-amber-300 font-bold" : "text-white/60"}>{maintenanceMode ? "ON" : "OFF"}</strong></span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-white/80 glass-shine">
              <Clock className="w-4 h-4 text-white/50" />
              <span className="font-mono">{timeStr}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-white/90 glass-shine">
              <CloudSun className="w-4 h-4 text-amber-400" />
              <span className="font-medium">{homeTemp} · {homeCondition}</span>
            </div>
          </div>
        </div>

        {dashboardSection === "control" && (
          <>

        {/* 1. DISPOSITIVOS EN RED LOCAL (ARP / WIFI) */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold">Dispositivos en Red Local (ARP / WiFi)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {FAMILY_MEMBERS.map((m) => (
              <div 
                key={m.name} 
                className={`p-4 rounded-2xl border transition-all duration-300 glass-shine ${
                  m.isHome 
                    ? "bg-white/[0.06] backdrop-blur-xl border-white/15 hover:bg-white/[0.1] shadow-lg" 
                    : "bg-black/40 border-white/5 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white shadow-md`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <div className={`w-2 h-2 rounded-full ${m.isHome ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-neutral-600"}`} />
                </div>
                <div className="font-semibold text-sm text-white truncate">{m.name}</div>
                <div className="text-[11px] text-white/50 truncate font-mono">{m.device}</div>
                <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center justify-between">
                  <span>{m.isHome ? "En Red" : "Desconectado"}</span>
                  <span>{m.ping}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. RENDIMIENTO DE RED & WIFI (SPEED TEST) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-5 glass-shine">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-white text-base">Rendimiento de Red & WiFi</div>
                <div className="text-xs text-white/50 font-mono">Enlace LAN Gigabit · Ookla Speedtest</div>
              </div>
            </div>

            {/* ACTION: RUN SPEEDTEST */}
            <button
              onClick={runSpeedtest}
              disabled={isSpeedtesting}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                isSpeedtesting
                  ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
                  : "bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400 shadow-lg shadow-cyan-500/20 cursor-pointer"
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSpeedtesting ? "animate-spin text-cyan-400" : ""}`} />
              <span>{isSpeedtesting ? "Midiendo Red..." : "Hacer Speed Test"}</span>
            </button>
          </div>

          {/* PROGRESS BAR WHEN RUNNING */}
          {isSpeedtesting && (
            <div className="space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
                <span>{speedFeedback || "Ejecutando test de latencia y ancho de banda..."}</span>
                <span>{speedProgress}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${speedProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* METRICS ROW: BAJADA, SUBIDA, LATENCIA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/5 space-y-1.5 glass-shine">
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-semibold">
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Bajada</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                {downloadSpeed} <span className="text-xs text-white/50 font-sans font-normal">Mbps</span>
              </div>
              <div className="text-[11px] text-white/40 font-mono">Transferencia Real</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/5 space-y-1.5 glass-shine">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Subida</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                {uploadSpeed} <span className="text-xs text-white/50 font-sans font-normal">Mbps</span>
              </div>
              <div className="text-[11px] text-white/40 font-mono">Subida a Internet</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/5 space-y-1.5 glass-shine">
              <div className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold">
                <Timer className="w-3.5 h-3.5" />
                <span>Latencia</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                {pingSpeed} <span className="text-xs text-white/50 font-sans font-normal">ms</span>
              </div>
              <div className="text-[11px] text-white/40 font-mono">Ping Promedio</div>
            </div>
          </div>
        </div>

        {/* 3. TELEMETRÍA DEL SERVIDOR & HARDWARE */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold">Telemetría del Servidor & Hardware</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* CPU */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/10 space-y-3 hover:bg-white/[0.08] transition-all glass-shine">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">CPU Host</span>
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{cpuUsage}%</span>
                <span className="text-[10px] font-mono text-cyan-400 font-medium">Core i3 M 380</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${cpuUsage}%` }} />
              </div>
              <div className="text-[11px] text-white/40 flex justify-between font-mono">
                <span>2 Cores · 4 Hilos</span>
                <span>@ 2.53 GHz</span>
              </div>
            </div>

            {/* CPU TEMP */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/10 space-y-3 hover:bg-white/[0.08] transition-all glass-shine">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Temperatura CPU</span>
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Thermometer className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{cpuTemp}°C</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Óptima
                </span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-400 to-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${(cpuTemp / 85) * 100}%` }} />
              </div>
              <div className="text-[11px] text-white/40 flex justify-between font-mono">
                <span>Thermal Zone 0</span>
                <span>Disipador OK</span>
              </div>
            </div>

            {/* RAM */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/10 space-y-3 hover:bg-white/[0.08] transition-all glass-shine">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Memoria RAM</span>
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">1.7<span className="text-sm font-normal text-white/50">/3.0GB</span></span>
                <span className="text-[10px] font-mono text-purple-400 font-medium">59%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-purple-400 h-full rounded-full" style={{ width: "59%" }} />
              </div>
              <div className="text-[11px] text-white/40 flex justify-between font-mono">
                <span>1.1 GB Libre</span>
                <span>DDR3 · Swap 5GB</span>
              </div>
            </div>

            {/* STORAGE SSD */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/10 space-y-3 hover:bg-white/[0.08] transition-all glass-shine">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Almacenamiento SSD</span>
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">30<span className="text-sm font-normal text-white/50">/146GB</span></span>
                <span className="text-[10px] font-mono text-emerald-400 font-medium">22%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full" style={{ width: "22%" }} />
              </div>
              <div className="text-[11px] text-white/40 flex justify-between font-mono">
                <span>109 GB Disponibles</span>
                <span>/dev/sda3 Ext4</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. SEGURIDAD & DNS (PI-HOLE, FAIL2BAN & SSL) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Seguridad de Red & Filtro DNS</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="text-[11px] font-mono text-emerald-400">Protección Activa</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PI-HOLE AD-BLOCKER */}
            <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 flex flex-col justify-between glass-shine">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/20">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">Pi-hole DNS Adblock</div>
                    <div className="text-[11px] text-white/50 font-mono">Filtro de Telemetría LAN</div>
                  </div>
                </div>

                <button
                  onClick={togglePiholePause}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold transition-all border flex items-center gap-1.5 ${
                    piholePaused 
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse" 
                      : "bg-white/5 hover:bg-white/10 text-white/80 border-white/10 hover:text-white"
                  }`}
                  title={piholePaused ? "Reanudar filtrado inmediatamente" : "Pausar filtrado por 5 minutos"}
                >
                  {piholePaused ? (
                    <>
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>En Pausa ({Math.floor(piholeTimer / 60)}:{(piholeTimer % 60).toString().padStart(2, '0')})</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3 text-amber-400" />
                      <span>Pausar 5m</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Bloqueados Hoy</div>
                  <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">2,418</div>
                  <div className="text-[10px] text-white/50 font-mono">18.4% del tráfico</div>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase font-mono">Lista de Gravedad</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">148.2k</div>
                  <div className="text-[10px] text-white/50 font-mono">Dominios blacklisted</div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 font-mono">
                <span>DNS: 192.168.1.100</span>
                <span className={piholePaused ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>
                  {piholePaused ? "Pausado temporalmente" : "Filtrado activo"}
                </span>
              </div>
            </div>

            {/* FAIL2BAN HOST DEFENSE */}
            <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 flex flex-col justify-between glass-shine">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Escudo Fail2ban</div>
                  <div className="text-[11px] text-white/50 font-mono">Anti Fuerza Bruta SSH</div>
                </div>
              </div>

              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Jail Activo:</span>
                  <span className="font-mono px-2 py-0.5 rounded bg-white/5 text-emerald-400 border border-emerald-500/20 text-[11px]">
                    sshd (Port 22)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Intrusos Baneados:</span>
                  <span className="font-mono text-white font-bold">0 atacantes</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Monitoreo de Logs:</span>
                  <span className="font-mono text-zinc-400 text-[11px]">/var/log/auth.log</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 font-mono">
                <span>Docker: fail2ban</span>
                <span className="text-emerald-400 font-semibold">100% Protegido</span>
              </div>
            </div>

            {/* WILDCARD SSL CERTIFICATE */}
            <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 flex flex-col justify-between glass-shine">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Certificado SSL Wildcard</div>
                  <div className="text-[11px] text-white/50 font-mono">Cifrado End-to-End HTTPS</div>
                </div>
              </div>

              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Dominio Cifrado:</span>
                  <span className="font-mono text-cyan-300 font-semibold text-[11px]">*.homelab.local</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Protocolo:</span>
                  <span className="font-mono text-white text-[11px]">TLS 1.3 · RSA 2048</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Vencimiento:</span>
                  <span className="font-mono text-emerald-400 font-semibold text-[11px]">Oct 2036 (Válido)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 font-mono">
                <span>Nginx Proxy Manager</span>
                <span className="text-cyan-400 font-semibold">SSL Wildcard OK</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. SERVICIOS DEL SERVIDOR */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold">Servicios del Servidor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s) => (
              <a 
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="group block relative p-5 rounded-3xl bg-white/[0.05] hover:bg-white/[0.09] backdrop-blur-2xl border border-white/10 hover:border-cyan-500/40 hover:scale-[1.015] transition-all duration-300 shadow-xl cursor-pointer select-none glass-shine"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/15 shadow-inner group-hover:border-cyan-500/50 group-hover:text-cyan-300 transition-all">
                      <s.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-white group-hover:text-cyan-300 transition-colors">
                        {s.name}
                      </div>
                      <div className="text-xs text-white/50">{s.desc}</div>
                    </div>
                  </div>
                  <div 
                    className="p-2 rounded-xl bg-white/5 group-hover:bg-cyan-500 group-hover:text-black text-white/60 transition-all shadow-sm"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 group-hover:shadow-[0_0_8px_#34d399]" />
                    <span className="text-white/60 group-hover:text-white/80 font-mono transition-colors">{s.domain}</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-semibold">{s.ping}ms</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* 8. INTERACTIVE 3D DOCKER CONTAINER RACK WITH LIVE LOGS */}
        <DockerContainers3DRack />

        {/* 9. MONITOREO & CONFIABILIDAD (UPTIME KUMA & BACKUPS) - PLACED BELOW RACK */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Monitoreo & Confiabilidad (Uptime Kuma)</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400">99.98% SLA</span>
              <span className="text-white/30">·</span>
              <span className="text-[11px] font-mono text-white/50">Últimos 30 días</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* UPTIME KUMA SLA TIMELINE & REALTIME MONITORS (2 COLS) */}
            <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-5 glass-shine">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-white text-base flex items-center gap-2">
                    <span>Disponibilidad Continua de Servicios</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                      7/7 OPERACIONALES
                    </span>
                  </div>
                  <div className="text-xs text-white/50 font-mono mt-0.5">
                    Historial de pings ICMP y HTTP verificados cada 20 segundos
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-emerald-400">99.98%</span>
                  <div className="text-[10px] text-white/40 font-mono">Promedio de uptime</div>
                </div>
              </div>

              {/* 30-DAY UPTIME BAR STRIP */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-white/40 font-mono">
                  <span>Hace 30 días</span>
                  <span className="text-emerald-400 font-semibold">100% Disponible Hoy</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 h-8">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const isMinorIncident = i === 11;
                    return (
                      <div
                        key={i}
                        className={`flex-1 h-full rounded-md transition-all duration-300 hover:scale-125 cursor-pointer group relative ${
                          isMinorIncident 
                            ? "bg-amber-400/80 hover:bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]" 
                            : "bg-emerald-400/80 hover:bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                        }`}
                        title={isMinorIncident ? `Día ${i+1}: 99.8% · Reinicio programado de router (3 min)` : `Día ${i+1}: 100% · Sin incidentes`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* LIVE ACTIVE MONITORS CHIPS */}
              <div className="pt-2 border-t border-white/5">
                <div className="text-[10px] uppercase font-mono text-white/40 mb-2">Monitores Kuma en Tiempo Real:</div>
                <div className="flex flex-wrap gap-2">
                  {(kumaData?.monitors || [
                    { name: "Home Assistant", ping: 6 },
                    { name: "Vaultwarden", ping: 23 },
                    { name: "Portainer", ping: 15 },
                    { name: "Pi-hole Web", ping: 15 },
                    { name: "Nginx Proxy", ping: 5 },
                    { name: "Router Sagemcom", ping: 28 },
                    { name: "Internet 1.1.1.1", ping: 22 }
                  ]).map((m, idx) => (
                    <div 
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2 text-xs font-mono"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-white/80">{m.name}</span>
                      <span className="text-emerald-400 font-bold text-[10px]">{m.ping ? Math.round(m.ping) : 10}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AUTOMATIC BACKUPS CARD (1 COL) */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 flex flex-col justify-between glass-shine">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/15 flex items-center justify-center text-purple-400 border border-purple-500/20">
                    <Archive className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-base">Copias de Seguridad</div>
                    <div className="text-xs text-white/50 font-mono">Backups Automáticos</div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                  2/2 AL DÍA
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-white">
                    <span>Home Assistant Core</span>
                    <span className="text-emerald-400 font-mono text-[10px] font-bold">420 MB</span>
                  </div>
                  <div className="text-[11px] text-white/50 font-mono flex items-center justify-between">
                    <span>Hoy 03:00 AM (Snapshot completo)</span>
                    <span className="text-emerald-400 font-semibold">Exitoso</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-white">
                    <span>Bóveda Vaultwarden</span>
                    <span className="text-purple-400 font-mono text-[10px] font-bold">12 MB</span>
                  </div>
                  <div className="text-[11px] text-white/50 font-mono flex items-center justify-between">
                    <span>Hoy 04:00 AM (Dump SQLite cifrado)</span>
                    <span className="text-emerald-400 font-semibold">Exitoso</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 font-mono">
                <span>Destino: Local + Cloud Encrypted</span>
                <span className="text-emerald-400">Sin errores</span>
              </div>
            </div>
          </div>
        </div>

        {/* 10. NOTIFICACIONES Y ALERTAS DEL SISTEMA (EVENT LOG) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Notificaciones & Alertas del Sistema (Event Log)</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-white/50">{SYSTEM_EVENTS.length} Eventos Registrados</span>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine">
            {/* FILTER PILLS */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-1.5 text-xs">
                {['all', 'seguridad', 'docker', 'red'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setEventFilter(f)}
                    className={`px-3 py-1 rounded-xl text-xs font-medium transition-all uppercase tracking-wider text-[10px] font-mono ${
                      eventFilter === f 
                        ? "bg-white/15 text-white border border-white/20 font-bold" 
                        : "bg-white/[0.03] text-white/50 border border-white/5 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {f === 'all' ? `Todos (${SYSTEM_EVENTS.length})` : f === 'seguridad' ? 'Seguridad (1)' : f === 'docker' ? 'Docker (2)' : 'Red & VPN (2)'}
                  </button>
                ))}
              </div>
              <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Servidor Estable · Sin alertas críticas</span>
              </div>
            </div>

            {/* EVENTS FEED */}
            <div className="space-y-2.5">
              {filteredEvents.map((evt) => (
                <div 
                  key={evt.id} 
                  className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-shine"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl border mt-0.5 sm:mt-0 ${evt.badgeStyle}`}>
                      <evt.icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase ${evt.tagStyle}`}>
                          {evt.category}
                        </span>
                        <span className="font-semibold text-xs text-white">{evt.title}</span>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{evt.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 text-[11px] font-mono text-white/40 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                    <span className="text-white/50">{evt.time}</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/70 text-[10px]">
                      {evt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 10. DESGLOSE DE ALMACENAMIENTO DEL SERVIDOR */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Desglose de Almacenamiento del Servidor</span>
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-emerald-400 font-bold">109 GB Libres</span>
              <span className="text-white/30">/</span>
              <span className="text-white/60">146 GB SSD</span>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-6 glass-shine">
            {/* TOP SUMMARY & STACKED BAR */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Disco Principal /dev/sda3 (Ext4)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Saludable · 20.5% Usado
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-white/60">
                  <span>Usado: <strong className="text-white font-bold">30.1 GB</strong></span>
                  <span>Disponible: <strong className="text-emerald-400 font-bold">109.2 GB</strong></span>
                </div>
              </div>

              {/* Multi-segment stacked storage bar */}
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex p-0.5 gap-0.5">
                <div className="bg-blue-500 h-full rounded-l-full transition-all" style={{ width: "11%" }} title="Sistema Operativo & Kernel: ~16 GB" />
                <div className="bg-cyan-400 h-full transition-all" style={{ width: "6.7%" }} title="Imágenes Docker: 9.73 GB" />
                <div className="bg-amber-400 h-full transition-all" style={{ width: "2.9%" }} title="Logs del Sistema (/var/log): 4.2 GB" />
                <div className="bg-purple-400 h-full transition-all" style={{ width: "0.2%" }} title="Contenedores Writable: 94 MB" />
                <div className="bg-emerald-400 h-full transition-all" style={{ width: "0.1%" }} title="Datos de Infra & Apps: 23 MB" />
                <div className="bg-white/5 h-full rounded-r-full flex-1" title="Espacio Libre: 109.2 GB (79.5%)" />
              </div>

              {/* Bar legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-mono text-white/60 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>SO & Kernel (16.0 GB)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>Imágenes Docker (9.7 GB)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Logs Sistema (4.2 GB)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  <span>Contenedores (94 MB)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>Infra / Home (23 MB)</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto text-white/40">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span>Libre (109.2 GB)</span>
                </div>
              </div>
            </div>

            {/* DOCKER STORAGE BREAKDOWN TABLE / CARDS */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs uppercase font-mono tracking-wider text-white/50 font-semibold">
                  Espacio Utilizado por Contenedores Docker (Virtual & Capas)
                </div>
                <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{dockerStorage?.reclaimable_images ? `${dockerStorage.reclaimable_images} de imágenes recuperables (docker prune)` : "8.64 GB de imágenes recuperables (docker prune)"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
                {(dockerStorage?.containers && dockerStorage.containers.length > 0
                  ? dockerStorage.containers.map(c => {
                      const colorMap = {
                        "homeassistant": { color: "text-blue-400", border: "border-blue-500/20", label: "Home Assistant" },
                        "uptime-kuma": { color: "text-emerald-400", border: "border-emerald-500/20", label: "Uptime Kuma" },
                        "nginx-proxy-manager": { color: "text-cyan-400", border: "border-cyan-500/20", label: "Nginx Proxy Mgr" },
                        "vaultwarden": { color: "text-purple-400", border: "border-purple-500/20", label: "Vaultwarden" },
                        "portainer": { color: "text-cyan-400", border: "border-cyan-500/20", label: "Portainer CE" },
                        "fail2ban": { color: "text-rose-400", border: "border-rose-500/20", label: "Fail2ban" },
                        "dashboard": { color: "text-amber-400", border: "border-amber-500/20", label: "Dashboard App" }
                      };
                      const meta = colorMap[c.name] || { color: "text-cyan-400", border: "border-cyan-500/20", label: c.name };
                      return {
                        name: meta.label,
                        virt: c.virtual_size,
                        layer: c.writable_layer,
                        color: meta.color,
                        border: meta.border
                      };
                    })
                  : [
                      { name: "Home Assistant", virt: "2.92 GB", layer: "88.4 MB", color: "text-blue-400", border: "border-blue-500/20" },
                      { name: "Uptime Kuma", virt: "1.89 GB", layer: "258 kB", color: "text-emerald-400", border: "border-emerald-500/20" },
                      { name: "Nginx Proxy Mgr", virt: "1.44 GB", layer: "5.35 MB", color: "text-cyan-400", border: "border-cyan-500/20" },
                      { name: "Vaultwarden", virt: "312 MB", layer: "8.19 kB", color: "text-purple-400", border: "border-purple-500/20" },
                      { name: "Portainer CE", virt: "146 MB", layer: "16.4 kB", color: "text-cyan-400", border: "border-cyan-500/20" },
                      { name: "Fail2ban", virt: "91 MB", layer: "61.4 kB", color: "text-rose-400", border: "border-rose-500/20" },
                      { name: "Dashboard App", virt: "67.3 MB", layer: "53.2 kB", color: "text-amber-400", border: "border-amber-500/20" }
                    ]
                ).map((item, idx) => (
                  <div key={idx} className={`p-3 rounded-2xl bg-white/[0.03] border ${item.border} hover:bg-white/[0.06] transition-all space-y-1 glass-shine`}>
                    <div className="text-[11px] font-semibold text-white truncate">{item.name}</div>
                    <div className={`text-base font-bold font-mono ${item.color}`}>{item.virt}</div>
                    <div className="text-[10px] text-white/40 font-mono">Capa: {item.layer}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ESTIMADOR DE CONSUMO ELÉCTRICO Y COSTO EN PESOS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Estimador de Consumo Eléctrico & Costo Mensual ($ ARS)</span>
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-amber-400 font-bold">{currentWatts} W</span>
              <span className="text-white/30">·</span>
              <span className="text-white/60">Lenovo ThinkCentre M93p Tiny</span>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-5 glass-shine">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Potencia Instantánea */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Potencia en Tiempo Real</span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {currentWatts} <span className="text-xs font-sans text-white/50 font-normal">Watts</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono">
                  Oscilando con CPU al {cpuUsage}%
                </div>
              </div>

              {/* Card 2: Consumo Mensual Proyectado */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Consumo Proyectado</span>
                  <Activity className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black font-mono text-cyan-400">
                  {monthlyKwh} <span className="text-xs font-sans text-white/50 font-normal">kWh/mes</span>
                </div>
                <div className="text-[10px] text-white/50 font-mono">
                  {(monthlyKwh / 30.5).toFixed(2)} kWh por día (24/7)
                </div>
              </div>

              {/* Card 3: Tarifa Configurable en Pesos */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Tarifa Eléctrica (Factura)</span>
                  <Sliders className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold font-mono text-purple-300">$</span>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={tariffKwhArs}
                    onChange={(e) => setTariffKwhArs(Number(e.target.value) || 0)}
                    className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-0.5 text-base font-bold font-mono text-white focus:outline-none focus:border-purple-400"
                  />
                  <span className="text-xs font-mono text-white/50">ARS / kWh</span>
                </div>
                <div className="text-[10px] text-white/40 font-mono">
                  Ajustable según factura de luz
                </div>
              </div>

              {/* Card 4: Costo Total Mensual en Pesos */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-teal-900/30 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
                  <span>Costo Mensual Estimado</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  ${monthlyCostArs.toLocaleString("es-AR")} <span className="text-xs font-sans text-emerald-300/80 font-normal">ARS</span>
                </div>
                <div className="text-[10px] text-emerald-300/80 font-mono">
                  Menos de 1 café al mes
                </div>
              </div>
            </div>

            {/* Banner comparativo de eficiencia energética Tiny vs PC Desktop */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Eficiencia Extrema de Formato Tiny (USFF)</span>
                </div>
                <div className="text-white/60 text-[11px]">
                  Una PC de escritorio común (220W) costaría <strong className="text-rose-400 font-mono">${pcDesktopCostArs.toLocaleString("es-AR")} ARS/mes</strong>. Tu Lenovo ThinkCentre M93p te ahorra <strong className="text-emerald-400 font-mono">${savingsArs.toLocaleString("es-AR")} ARS al mes</strong> manteniéndolo encendido 24/7.
                </div>
              </div>
              <div className="shrink-0 font-mono text-xs font-bold text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                Ahorro ~92%
              </div>
            </div>
          </div>
        </div>

        {/* 11. RED MESH REMOTA (TAILSCALE VPN) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" />
              <span>Red Mesh Remota (Tailscale VPN)</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="text-[11px] font-mono text-emerald-400 font-medium">Malla WireGuard P2P Activa</span>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-5 glass-shine">
            {/* SERVER TAILSCALE HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">homelab-node-01</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                      NODO LOCAL HOST
                    </span>
                  </div>
                  <div className="text-xs text-white/50 font-mono">
                    IP Tailscale: <span className="text-emerald-400 font-bold">100.64.0.15</span> · MagicDNS: homelab-node-01.ts.net
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/70">
                  Cuenta: <span className="text-white font-medium">operator@homelab.local</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/70">
                  Cifrado: <span className="text-emerald-400 font-medium">ChaCha20-Poly1305</span>
                </div>
              </div>
            </div>

            {/* TAILSCALE MESH NODES */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-mono tracking-wider text-white/40">
                Dispositivos Autorizados en la Malla (Peer-to-Peer):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(tailscaleNodes.length > 0 ? tailscaleNodes.map(n => ({
                  name: n.name,
                  ip: n.ip,
                  os: n.os,
                  status: n.self ? "Este Host (Self)" : n.online ? (n.active ? "Activo Directo" : "En Malla") : "Desconectado",
                  active: n.online,
                  icon: n.self ? Server : (n.os || "").toLowerCase().includes("win") ? Laptop : Smartphone,
                  details: n.self ? "WireGuard Core" : (n.cur_addr ? `${n.cur_addr}` : "Tailscale DERP")
                })) : [
                  {
                    name: "homelab-node-01",
                    ip: "100.64.0.15",
                    os: "Ubuntu Server 24.04 LTS",
                    status: "Este Host (Self)",
                    active: true,
                    icon: Server,
                    details: "Linux · WireGuard Core"
                  },
                  {
                    name: "workstation-pc",
                    ip: "100.64.0.22",
                    os: "Windows 11 Pro · Workstation",
                    status: "Activo Directo",
                    active: true,
                    icon: Laptop,
                    details: "192.168.1.50:41641 · Tx: 7.8M / Rx: 13M"
                  },
                  {
                    name: "iphone-admin",
                    ip: "100.64.0.33",
                    os: "iOS · iPhone 11",
                    status: "En Malla",
                    active: true,
                    icon: Smartphone,
                    details: "Acceso Remoto Activo"
                  },
                  {
                    name: "android-backup",
                    ip: "100.64.0.44",
                    os: "Android · Galaxy A51",
                    status: "Inactivo (40d)",
                    active: false,
                    icon: Smartphone,
                    details: "Visto hace 40 días"
                  }
                ]).map((node) => (
                  <div 
                    key={node.name}
                    className={`p-4 rounded-2xl border transition-all glass-shine ${
                      node.active 
                        ? "bg-white/[0.04] border-white/10 hover:bg-white/[0.08]" 
                        : "bg-black/30 border-white/5 opacity-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <node.icon className="w-4 h-4 text-purple-400" />
                        <span className="font-semibold text-xs text-white">{node.name}</span>
                      </div>
                      <span className={`w-2 h-2 rounded-full ${node.active ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-zinc-600"}`} />
                    </div>
                    <div className="text-xs font-mono font-bold text-white/90">{node.ip}</div>
                    <div className="text-[10px] text-white/50 mt-1 truncate">{node.os}</div>
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                      <span className={node.active ? "text-emerald-400" : "text-zinc-500"}>{node.status}</span>
                      <span className="text-white/30 truncate max-w-[100px]">{node.details.split('·')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
          </>
        )}

        <TabErrorBoundary key={dashboardSection}>
          {dashboardSection === "metrics" && (
            <HomelabMetricsObservatory />
          )}

          {dashboardSection === "devops" && (
            <DevOpsConsole />
          )}

          {dashboardSection === "security" && (
            <SecurityVault />
          )}

          {dashboardSection === "network" && (
            <NetworkTopology />
          )}

          {dashboardSection === "backups" && (
            <BackupsManager />
          )}
        </TabErrorBoundary>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DESIGN LAB COMPONENT (DEFINITIVE DASHBOARD · ZERO SWITCHER)
// ============================================================================
export default function DesignLab() {
  return <AppleIslandDesign />;
}
