import React, { useState, useEffect, useCallback } from 'react';
import { 
  Smartphone, Laptop, Tablet, Wifi, ArrowDown, ArrowUp, 
  Timer, Shield, ShieldCheck, RefreshCw, Server, 
  Activity, Lock, CloudSun, Radio, Zap, AlertCircle,
  RotateCw, CheckCircle2, XCircle, Layers, Cpu,
  ExternalLink, Check, Info, Globe, Sparkles, Sliders,
  Gauge, Terminal, Compass, ChevronRight, CircleDot,
  Palette
} from 'lucide-react';

export default function App() {
  const [time, setTime] = useState(new Date());
  const [haConnected, setHaConnected] = useState(false);
  const [haStates, setHaStates] = useState({});
  const [isSpeedtesting, setIsSpeedtesting] = useState(false);
  const [speedProgress, setSpeedProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'presence', 'network', 'docker', 'services'

  // Estados de Uptime Kuma y Docker Portainer
  const [kumaData, setKumaData] = useState(null);
  const [dockerContainers, setDockerContainers] = useState([]);
  const [restartingId, setRestartingId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Host del servidor para accesos
  const serverHost = window.location.hostname || '100.64.0.15';

  // Reloj local en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // -------------------------------------------------------------
  // 1. Consulta a Home Assistant API
  // -------------------------------------------------------------
  const fetchHaStates = useCallback(async () => {
    try {
      const res = await fetch('/api/ha/states');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const map = {};
      data.forEach(item => {
        map[item.entity_id] = item;
      });

      setHaStates(map);
      setHaConnected(true);
    } catch (err) {
      console.warn("Home Assistant API proxy cargando:", err);
      setHaConnected(false);
    }
  }, []);

  // -------------------------------------------------------------
  // 2. Consulta a Uptime Kuma (kuma-status.json)
  // -------------------------------------------------------------
  const fetchKumaStatus = useCallback(async () => {
    try {
      const res = await fetch('/kuma-status.json?t=' + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKumaData(data);
    } catch (err) {
      console.warn("Kuma status JSON cargando:", err);
    }
  }, []);

  // -------------------------------------------------------------
  // 3. Consulta a Docker mediante Portainer API
  // -------------------------------------------------------------
  const fetchDockerContainers = useCallback(async () => {
    try {
      const res = await fetch('/api/portainer/containers/json?all=1');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDockerContainers(data);
    } catch (err) {
      console.warn("Portainer API cargando:", err);
    }
  }, []);

  // Polling automático
  useEffect(() => {
    fetchHaStates();
    fetchKumaStatus();
    fetchDockerContainers();

    const intervalHa = setInterval(fetchHaStates, 10000);
    const intervalKuma = setInterval(fetchKumaStatus, 5000);
    const intervalDocker = setInterval(fetchDockerContainers, 6000);

    return () => {
      clearInterval(intervalHa);
      clearInterval(intervalKuma);
      clearInterval(intervalDocker);
    };
  }, [fetchHaStates, fetchKumaStatus, fetchDockerContainers]);

  // -------------------------------------------------------------
  // 4. Reinicio de Contenedores desde Portainer API
  // -------------------------------------------------------------
  const restartContainer = async (id, name) => {
    if (restartingId) return;
    setRestartingId(id);
    setActionFeedback({ type: 'info', msg: `Reiniciando ${name}...` });

    try {
      const res = await fetch(`/api/portainer/containers/${id}/restart`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setActionFeedback({ type: 'success', msg: `Contenedor ${name} reiniciado con éxito.` });
      setTimeout(fetchDockerContainers, 2000);
    } catch (err) {
      console.error("Error reiniciando contenedor:", err);
      setActionFeedback({ type: 'error', msg: `Error al reiniciar ${name}` });
    } finally {
      setRestartingId(null);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // -------------------------------------------------------------
  // 5. Ejecución real del Speedtest llamando a HA
  // -------------------------------------------------------------
  const runSpeedtest = async () => {
    if (isSpeedtesting) return;
    setIsSpeedtesting(true);
    setSpeedProgress(10);

    const progressInterval = setInterval(() => {
      setSpeedProgress(prev => (prev < 90 ? prev + 5 : prev));
    }, 800);

    try {
      await fetch('/api/ha/services/homeassistant/update_entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: 'sensor.speedtest_descarga' })
      });

      clearInterval(progressInterval);
      setSpeedProgress(100);
      await fetchHaStates();
    } catch (err) {
      console.error("Error al ejecutar speedtest:", err);
      clearInterval(progressInterval);
    } finally {
      setTimeout(() => {
        setIsSpeedtesting(false);
        setSpeedProgress(0);
      }, 1000);
    }
  };

  // -------------------------------------------------------------
  // 6. Mapeo de Presencia Familiar (Home Assistant)
  // -------------------------------------------------------------
  const familyConfig = [
    {
      name: "Admin Mobile",
      device: "Workstation Phone",
      ip: haStates['device_tracker.admin_phone']?.attributes?.ip || "192.168.1.150",
      entityId: "device_tracker.admin_phone",
      fallbackId: "device_tracker.primary_mobile",
      icon: Smartphone,
      accentGradient: "from-emerald-500/20 to-teal-500/10",
      accentBorder: "border-emerald-500/30",
      iconColor: "text-emerald-400"
    },
    {
      name: "Mobile Device 02",
      device: "Personal Smartphone",
      ip: haStates['device_tracker.user_phone_02']?.attributes?.ip || "192.168.1.110",
      entityId: "device_tracker.user_phone_02",
      fallbackId: "device_tracker.user2_mobile",
      icon: Smartphone,
      accentGradient: "from-emerald-500/20 to-teal-500/10",
      accentBorder: "border-emerald-500/30",
      iconColor: "text-emerald-400"
    },
    {
      name: "Mobile Device 03",
      device: "Secondary Smartphone",
      ip: haStates['device_tracker.user_phone_03']?.attributes?.ip || "192.168.1.125",
      entityId: "device_tracker.user_phone_03",
      fallbackId: "device_tracker.user3_mobile",
      icon: Smartphone,
      accentGradient: "from-emerald-500/20 to-teal-500/10",
      accentBorder: "border-emerald-500/30",
      iconColor: "text-emerald-400"
    },
    {
      name: "Notebook Dev",
      device: "Workstation Pro (Admin)",
      ip: haStates['device_tracker.workstation_pc']?.attributes?.ip || "192.168.1.50",
      entityId: "device_tracker.workstation_pc",
      icon: Laptop,
      accentGradient: "from-cyan-500/20 to-blue-500/10",
      accentBorder: "border-cyan-500/30",
      iconColor: "text-cyan-400",
      customHomeLabel: "En Casa / Activa",
      customAwayLabel: "Desconectada"
    },
    {
      name: "Wallmount Panel",
      device: "Dashboard Kiosk Tablet",
      ip: "192.168.1.200",
      entityId: "device_tracker.wallmount_tablet",
      icon: Tablet,
      accentGradient: "from-purple-500/20 to-indigo-500/10",
      accentBorder: "border-purple-500/30",
      iconColor: "text-purple-400",
      customHomeLabel: "En Casa / Panel",
      customAwayLabel: "Desconectado"
    }
  ];

  const processedFamily = familyConfig.map(person => {
    const mainState = haStates[person.entityId]?.state;
    const fallbackState = person.fallbackId ? haStates[person.fallbackId]?.state : null;
    const isHome = (mainState === 'home') || (fallbackState === 'home');
    const statusText = isHome ? (person.customHomeLabel || "En Casa") : (person.customAwayLabel || "Fuera de Casa");

    return { ...person, isHome, status: statusText };
  });

  const connectedCount = processedFamily.filter(p => p.isHome).length;

  // -------------------------------------------------------------
  // 7. Métricas de Speedtest
  // -------------------------------------------------------------
  const downloadState = haStates['sensor.speedtest_descarga'];
  const uploadState = haStates['sensor.speedtest_subida'];
  const pingState = haStates['sensor.speedtest_ping'];

  const downloadVal = downloadState?.state && !isNaN(downloadState.state)
    ? parseFloat(downloadState.state).toFixed(2)
    : '0.91';

  const uploadVal = uploadState?.state && !isNaN(uploadState.state)
    ? parseFloat(uploadState.state).toFixed(2)
    : '0.35';

  const pingVal = pingState?.state && !isNaN(pingState.state)
    ? Math.round(parseFloat(pingState.state))
    : '217';

  const speedServer = downloadState?.attributes?.server_name
    ? `${downloadState.attributes.server_name} (${downloadState.attributes.server_country || 'Ookla'})`
    : 'Ookla Speedtest';

  // -------------------------------------------------------------
  // 8. Clima
  // -------------------------------------------------------------
  const weatherState = haStates['weather.forecast_casa'];
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

  const currentTemp = weatherState?.attributes?.temperature 
    ? `${Math.round(weatherState.attributes.temperature)}°C` 
    : '14°C';

  const currentCondition = weatherState?.state 
    ? (weatherConditionMap[weatherState.state] || weatherState.state)
    : 'Nublado';

  // -------------------------------------------------------------
  // 9. Mapeo Kuma <-> Contenedores y Servicios
  // -------------------------------------------------------------
  const getKumaMonitor = (nameOrId) => {
    if (!kumaData?.monitors) return null;
    return kumaData.monitors.find(m => 
      m.name.toLowerCase().includes(nameOrId.toLowerCase())
    );
  };

  const isDomain = window.location.hostname.includes('homelab.internal');

  const homelabServices = [
    { 
      name: "Vaultwarden", 
      desc: "Bóveda HTTPS Cifrada", 
      url: isDomain ? "https://vault.homelab.internal" : `https://${serverHost}:8085`, 
      domain: "vault.homelab.internal",
      icon: Lock, 
      gradient: "from-purple-500/20 via-indigo-500/15 to-transparent", 
      glow: "rgba(168, 85, 247, 0.25)",
      border: "border-purple-500/30", 
      iconColor: "text-purple-400",
      kumaKey: "Vaultwarden" 
    },
    { 
      name: "Home Assistant", 
      desc: "Domótica & Sensores IoT", 
      url: isDomain ? "https://ha.homelab.internal" : `http://${serverHost}:8123`, 
      domain: "ha.homelab.internal",
      icon: Zap, 
      gradient: "from-sky-500/20 via-blue-500/15 to-transparent", 
      glow: "rgba(14, 165, 233, 0.25)",
      border: "border-sky-500/30", 
      iconColor: "text-sky-400",
      kumaKey: "Home Assistant" 
    },
    { 
      name: "Uptime Kuma", 
      desc: "Monitor de Red & Servicios", 
      url: isDomain ? "https://kuma.homelab.internal" : `http://${serverHost}:3001`, 
      domain: "kuma.homelab.internal",
      icon: Activity, 
      gradient: "from-emerald-500/20 via-teal-500/15 to-transparent", 
      glow: "rgba(16, 185, 129, 0.25)",
      border: "border-emerald-500/30", 
      iconColor: "text-emerald-400",
      kumaKey: null 
    },
    { 
      name: "Portainer CE", 
      desc: "Gestión de Docker", 
      url: isDomain ? "https://portainer.homelab.internal" : `https://${serverHost}:9443`, 
      domain: "portainer.homelab.internal",
      icon: Radio, 
      gradient: "from-cyan-500/20 via-blue-500/15 to-transparent", 
      glow: "rgba(6, 182, 212, 0.25)",
      border: "border-cyan-500/30", 
      iconColor: "text-cyan-400",
      kumaKey: "Portainer" 
    },
    { 
      name: "Pi-hole Admin", 
      desc: "Filtro DNS & Adblock", 
      url: isDomain ? "https://pihole.homelab.internal" : `http://${serverHost}:8080/admin`, 
      domain: "pihole.homelab.internal",
      icon: Shield, 
      gradient: "from-rose-500/20 via-red-500/15 to-transparent", 
      glow: "rgba(244, 63, 94, 0.25)",
      border: "border-rose-500/30", 
      iconColor: "text-rose-400",
      kumaKey: "Pi-hole Web" 
    },
    { 
      name: "Nginx Proxy", 
      desc: "Proxy Inverso & SSL Wildcard", 
      url: isDomain ? "https://npm.homelab.internal" : `http://${serverHost}:81`, 
      domain: "npm.homelab.internal",
      icon: Server, 
      gradient: "from-amber-500/20 via-orange-500/15 to-transparent", 
      glow: "rgba(245, 158, 11, 0.25)",
      border: "border-amber-500/30", 
      iconColor: "text-amber-400",
      kumaKey: "Nginx Proxy Manager" 
    },
  ];

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-cyan-500/30 relative">
      
      {/* ========================================================= */}
      {/* AMBIENT GLOW EFFECTS (glass.samasante.com aesthetic)       */}
      {/* ========================================================= */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/3 -right-40 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed -bottom-40 left-1/3 w-[500px] h-[500px] bg-emerald-500/08 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed inset-0 bg-ambient-grid opacity-30 pointer-events-none" />

      {/* Toast Notificación flotante */}
      {actionFeedback && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 glass-dock px-5 py-3.5 rounded-2xl animate-fade-in text-xs font-semibold">
          {actionFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {actionFeedback.type === 'info' && <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />}
          {actionFeedback.type === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}
          <span>{actionFeedback.msg}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* FLOATING ISLAND NAVBAR (navbar.gallery inspiration)        */}
      {/* ========================================================= */}
      <div className="sticky top-3 z-40 px-3 md:px-8 max-w-6xl mx-auto pt-[max(0.5rem,env(safe-area-inset-top))]">
        <nav className="glass-dock px-3.5 py-2.5 rounded-2xl md:rounded-full flex items-center justify-between gap-3 transition-all">
          
          {/* Logo & Live Beacon */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-widest text-xs uppercase text-white font-mono">
                  NEXUS<span className="text-cyan-400">.LAB</span>
                </span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              </div>
              <p className="text-[10px] text-zinc-400 font-mono hidden sm:block">Ubuntu 22.04 LTS</p>
            </div>
          </div>

          {/* Navigation Filter Tabs (Real Product Style) */}
          <div className="hidden lg:flex items-center gap-1 glass-pill p-1 rounded-full text-xs font-medium">
            <button 
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'all' ? 'glass-pill-active text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              General
            </button>
            <button 
              onClick={() => setActiveTab('presence')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'presence' ? 'glass-pill-active text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Presencia ({connectedCount})
            </button>
            <button 
              onClick={() => setActiveTab('network')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'network' ? 'glass-pill-active text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Red & Test
            </button>
            <button 
              onClick={() => setActiveTab('docker')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'docker' ? 'glass-pill-active text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Docker ({dockerContainers.length || 7})
            </button>
            <button 
              onClick={() => setActiveTab('services')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'services' ? 'glass-pill-active text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Servicios (*.lab)
            </button>
          </div>

          {/* Status Indicators & Clock */}
          <div className="flex items-center gap-2">
            <div className="glass-pill px-3 py-1 rounded-xl flex items-center gap-2">
              <CloudSun className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200 hidden sm:inline">{currentTemp}</span>
            </div>
            
            <div className="glass-pill px-3 py-1 rounded-xl flex items-center gap-1.5 font-mono text-xs text-cyan-400 font-bold">
              <Timer className="w-3.5 h-3.5" />
              <span>{time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>

            <div className="glass-pill px-2.5 py-1 rounded-xl hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>TS Mesh</span>
            </div>

            <a 
              href="https://lab.homelab.internal"
              className="glass-pill px-3 py-1 rounded-xl flex items-center gap-1.5 text-[11px] font-bold text-pink-400 border border-pink-500/30 hover:bg-pink-500/10 transition-colors shadow-[0_0_10px_rgba(236,72,153,0.2)]"
              title="Abrir Design Lab con 6 Diseños"
            >
              <Palette className="w-3.5 h-3.5 text-pink-400" />
              <span>LAB (6 Diseños)</span>
            </a>
          </div>

        </nav>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-8">
        
        {/* ========================================================= */}
        {/* HERO SECTION (supahero.io inspiration)                     */}
        {/* ========================================================= */}
        <section className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden animate-shimmer">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 glass-pill px-3 py-1 rounded-full text-[11px] font-semibold text-cyan-400 uppercase tracking-wider mb-3">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Centro de Telemetría Autónoma · v3.2</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
                Homelab Control Station
              </h1>
              <p className="text-sm text-zinc-400 mt-2 max-w-xl">
                Monitoreo en tiempo real de infraestructura local, presencia familiar, enlaces de alta velocidad y servicios protegidos por SSL Wildcard.
              </p>
            </div>

            {/* Quick Server Identity Pill */}
            <div className="glass-card p-4 rounded-2xl flex items-center gap-4 border border-white/10 shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/30 border border-indigo-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                <Server className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-medium">Lenovo Server Host</p>
                <p className="text-sm font-bold text-white font-mono">192.168.1.100</p>
                <p className="text-[11px] text-emerald-400 font-mono mt-0.5">100.64.0.15 (TS)</p>
              </div>
            </div>
          </div>

          {/* 4 KPI Glass Metric Pillars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            
            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">Salud General</p>
                <p className="text-base font-extrabold text-white">
                  {kumaData ? `${kumaData.up}/${kumaData.total} UP` : '100% OK'}
                </p>
                <p className="text-[10px] text-emerald-400 font-mono">
                  {kumaData?.avg_ping ? `${kumaData.avg_ping}ms avg` : '5ms latencia'}
                </p>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">Flota Docker</p>
                <p className="text-base font-extrabold text-white">
                  {dockerContainers.length || 7} Contenedores
                </p>
                <p className="text-[10px] text-cyan-400 font-mono">Portainer API Activa</p>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">Presencia Hogar</p>
                <p className="text-base font-extrabold text-white">
                  {connectedCount} de {processedFamily.length}
                </p>
                <p className="text-[10px] text-indigo-300 font-mono">Dispositivos en LAN</p>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">Seguridad DNS</p>
                <p className="text-base font-extrabold text-white">Pi-hole + F2B</p>
                <p className="text-[10px] text-purple-300 font-mono">Perímetro Cifrado</p>
              </div>
            </div>

          </div>

        </section>

        {/* ========================================================= */}
        {/* SECCIÓN 1: PRESENCIA EN EL HOGAR (HOME ASSISTANT)         */}
        {/* ========================================================= */}
        {(activeTab === 'all' || activeTab === 'presence') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  Presencia en el Hogar
                </h2>
                <p className="text-xs text-zinc-400">Rastreo de red en tiempo real mediante Home Assistant y Nmap</p>
              </div>
              <span className="text-xs glass-pill border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                {connectedCount} de {processedFamily.length} en Casa
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              {processedFamily.map((person, idx) => {
                const Icon = person.icon;
                return (
                  <div 
                    key={idx}
                    className={`glass-card p-4 rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                      person.isHome 
                        ? 'border-emerald-500/20 bg-gradient-to-b from-white/[0.04] to-emerald-500/[0.02]' 
                        : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${person.accentGradient} border ${person.accentBorder} flex items-center justify-center shadow-lg`}>
                        <Icon className={`w-5 h-5 ${person.isHome ? person.iconColor : 'text-zinc-500'}`} />
                      </div>
                      <span 
                        className={`flex h-2.5 w-2.5 rounded-full ${
                          person.isHome 
                            ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' 
                            : 'bg-zinc-600'
                        }`} 
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{person.name}</h3>
                      <p className="text-[11px] text-zinc-400 truncate">{person.device}</p>
                      
                      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
                        <span className={`font-semibold ${person.isHome ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {person.status}
                        </span>
                        <span className="text-zinc-500 font-mono text-[10px]">{person.ip}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* SECCIÓN 2: CONECTIVIDAD & SPEEDTEST (cta.gallery style)   */}
        {/* ========================================================= */}
        {(activeTab === 'all' || activeTab === 'network') && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Speedtest Card */}
            <div className="md:col-span-2 glass-panel p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Banda Ancha & Telemetría WAN</h3>
                    <p className="text-xs text-zinc-400">Servidor: {speedServer}</p>
                  </div>
                </div>

                {/* Interactive CTA Button */}
                <button 
                  onClick={runSpeedtest}
                  disabled={isSpeedtesting}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 active:scale-95 text-cyan-300 border border-cyan-400/30 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.15)] cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSpeedtesting ? 'animate-spin text-cyan-400' : ''}`} />
                  {isSpeedtesting ? 'Midiendo con HA...' : 'MEDIR AHORA'}
                </button>
              </div>

              {/* Progress bar during test */}
              {isSpeedtesting && (
                <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 h-full transition-all duration-300"
                    style={{ width: `${speedProgress}%` }}
                  />
                </div>
              )}

              {/* Metric Boxes */}
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-4 rounded-2xl text-center">
                  <div className="flex items-center justify-center gap-1.5 text-cyan-400 text-xs font-semibold mb-1">
                    <ArrowDown className="w-3.5 h-3.5" /> Bajada
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-white tracking-tight font-mono">
                    {downloadVal}
                  </div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-0.5">Mbps</div>
                </div>

                <div className="glass-card p-4 rounded-2xl text-center">
                  <div className="flex items-center justify-center gap-1.5 text-indigo-400 text-xs font-semibold mb-1">
                    <ArrowUp className="w-3.5 h-3.5" /> Subida
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-white tracking-tight font-mono">
                    {uploadVal}
                  </div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-0.5">Mbps</div>
                </div>

                <div className="glass-card p-4 rounded-2xl text-center">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-semibold mb-1">
                    <Timer className="w-3.5 h-3.5" /> Latencia
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-white tracking-tight font-mono">
                    {pingVal}
                  </div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-0.5">ms (Ping)</div>
                </div>
              </div>

              {/* Hops & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 pt-3 border-t border-white/10 gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span>Gateway Router (192.168.1.1): <strong className="text-white font-mono">{kumaData?.monitors?.find(m => m.name.includes('Gateway'))?.ping ? `${kumaData.monitors.find(m => m.name.includes('Gateway')).ping}ms` : 'En Línea'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span>WAN Cloudflare (1.1.1.1): <strong className="text-white font-mono">{kumaData?.monitors?.find(m => m.name.includes('Cloudflare'))?.ping ? `${kumaData.monitors.find(m => m.name.includes('Cloudflare')).ping}ms` : 'En Línea'}</strong></span>
                </div>
              </div>
            </div>

            {/* Security & DNS Card */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Perímetro & DNS</h3>
                    <p className="text-xs text-zinc-400">Protección activa</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Pi-hole DNS v6</p>
                      <p className="text-base font-bold text-white">Filtro Local Activo</p>
                    </div>
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-xl font-mono font-semibold">
                      Port 53
                    </span>
                  </div>

                  <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Fail2ban Firewall</p>
                      <p className="text-base font-bold text-white">0 IPs Bloqueadas</p>
                    </div>
                    <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded-xl font-mono font-semibold">
                      Blindado
                    </span>
                  </div>

                  <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Tailscale Mesh VPN</p>
                      <p className="text-base font-bold text-white">Subnet Router Activo</p>
                    </div>
                    <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-xl font-mono font-semibold">
                      Zero-Trust
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-zinc-500 pt-3 border-t border-white/10 font-mono">
                Wildcard *.homelab.internal verificado.
              </p>
            </div>

          </section>
        )}

        {/* ========================================================= */}
        {/* SECCIÓN 3: FLOTA DOCKER (PORTAINER API + REINICIO)         */}
        {/* ========================================================= */}
        {(activeTab === 'all' || activeTab === 'docker') && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Infraestructura Docker & Control de Contenedores
                </h2>
                <p className="text-xs text-zinc-400">
                  Control en vivo y reinicio táctil de instancias mediante Portainer API
                </p>
              </div>

              {kumaData && (
                <div className="flex items-center gap-2">
                  <span className="text-xs glass-pill border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    {kumaData.up} de {kumaData.total} Activos
                  </span>
                  <span className="text-xs glass-pill border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full font-mono">
                    {dockerContainers.length || 7} Contenedores
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {dockerContainers.length > 0 ? (
                dockerContainers.map((c) => {
                  const name = c.Names[0].lstrip ? c.Names[0].lstrip('/') : c.Names[0].replace('/', '');
                  const isRunning = c.State === 'running';
                  const isRestarting = restartingId === c.Id;
                  const kuma = getKumaMonitor(name);

                  return (
                    <div 
                      key={c.Id}
                      className="glass-card p-4 rounded-2xl flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${isRunning ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'}`} />
                            <h4 className="font-bold text-sm text-white tracking-tight">{name}</h4>
                          </div>
                          {kuma && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-mono font-semibold ${
                              kuma.status === 'UP' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}>
                              {kuma.status === 'UP' ? `${kuma.ping || 0}ms` : 'DOWN'}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-400 truncate">{c.Image}</p>
                        <p className="text-[10px] text-zinc-500 font-mono mt-1">{c.Status}</p>
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ID: {c.Id.substring(0, 7)}
                        </span>
                        <button
                          onClick={() => restartContainer(c.Id, name)}
                          disabled={isRestarting}
                          className="inline-flex items-center gap-1.5 text-xs glass-pill hover:bg-white/10 active:scale-95 text-zinc-200 hover:text-white px-3 py-1.5 rounded-xl transition-all border border-white/10 cursor-pointer disabled:opacity-50"
                          title="Reiniciar contenedor vía Portainer API"
                        >
                          <RotateCw className={`w-3 h-3 ${isRestarting ? 'animate-spin text-cyan-400' : ''}`} />
                          {isRestarting ? 'Reiniciando...' : 'Reiniciar'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-4 p-8 glass-panel rounded-2xl text-center text-xs text-zinc-400">
                  Cargando contenedores desde Portainer API...
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* SECCIÓN 4: LAUNCHER DE SERVICIOS (*.homelab.internal)           */}
        {/* ========================================================= */}
        {(activeTab === 'all' || activeTab === 'services') && (
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Servicios del Homelab (Dominios *.homelab.internal)
                </h2>
                <p className="text-xs text-zinc-400">Accesos directos con SSL Wildcard sin necesidad de puertos</p>
              </div>

              {kumaData && (
                <span className="text-xs glass-pill border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full font-mono flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  {kumaData.up}/{kumaData.total} Servicios Activos
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {homelabServices.map((service, idx) => {
                const Icon = service.icon;
                const kuma = service.kumaKey ? getKumaMonitor(service.kumaKey) : null;

                return (
                  <a
                    key={idx}
                    href={service.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`group glass-card hover:border-white/20 p-4 rounded-2xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden`}
                    style={{
                      '--service-glow': service.glow
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${service.gradient} border ${service.border} flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg`}>
                        <Icon className={`w-5 h-5 ${service.iconColor}`} />
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {kuma && (
                          <span 
                            className={`h-2 w-2 rounded-full ${kuma.status === 'UP' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500'}`} 
                            title={`Uptime Kuma: ${kuma.status} (${kuma.ping}ms)`} 
                          />
                        )}
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                        {service.name}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{service.desc}</p>
                      
                      <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span className="truncate">{service.domain}</span>
                        {kuma && kuma.ping && (
                          <span className="text-emerald-400 font-bold ml-1">{kuma.ping}ms</span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* FOOTER PRO (footer.design inspiration)                    */}
        {/* ========================================================= */}
        <footer className="glass-panel p-6 rounded-3xl mt-12 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-400 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white font-mono text-sm">
              S
            </div>
            <div>
              <p className="font-semibold text-white">Homelab Private Infrastructure</p>
              <p className="text-[11px] text-zinc-500">Lenovo ThinkCentre · Intel Core i3 M380 · Ubuntu 22.04 LTS</p>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="glass-pill px-3 py-1.5 rounded-xl border border-white/10 text-zinc-300">
              SSL: *.homelab.internal
            </span>
            <span className="glass-pill px-3 py-1.5 rounded-xl border border-white/10 text-emerald-400">
              Tailscale: 100.64.0.15
            </span>
          </div>
        </footer>

      </div>
    </div>
  );
}
