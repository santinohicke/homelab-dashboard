import React, { useState, useEffect } from "react";
import {
  Radar, Briefcase, Sparkles, RefreshCw, CheckCircle2, ExternalLink,
  Filter, Search, Bell, Smartphone, Plus, Check, Archive, Clock,
  ShieldCheck, MapPin, Tag, ChevronRight, AlertCircle, X, Sliders,
  CheckCircle, Globe, Terminal, ArrowUpRight
} from "lucide-react";

export default function AgentRadar() {
  const [findings, setFindings] = useState([]);
  const [targets, setTargets] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "unread" | "trainee" | "part-time" | "remote"
  const [searchQuery, setSearchQuery] = useState("");
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [pushStatus, setPushStatus] = useState("default"); // "granted" | "denied" | "default" | "unsupported"
  const [newTargetName, setNewTargetName] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [newTargetCriteria, setNewTargetCriteria] = useState("");
  const [newTargetCategory, setNewTargetCategory] = useState("Pasantías / IT");
  const [isAddingTarget, setIsAddingTarget] = useState(false);

  // Check notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus("unsupported");
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resFindings, resTargets] = await Promise.all([
        fetch("/api/v1/agent/findings?limit=50"),
        fetch("/api/v1/agent/targets")
      ]);

      if (resFindings.ok) {
        const data = await resFindings.json();
        setFindings(data.findings || []);
        setUnreadCount(data.unread_count || 0);
        setTotalCount(data.total_count || 0);
      }

      if (resTargets.ok) {
        const data = await resTargets.json();
        setTargets(data.targets || []);
      }
    } catch (err) {
      console.error("Error al cargar datos del Radar IT:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunScan = async (targetId = null) => {
    try {
      setScanning(true);
      setScanResult(null);
      const res = await fetch("/api/v1/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetId ? { target_id: targetId } : {})
      });
      const data = await res.json();
      setScanResult(data);
      await fetchData();
    } catch (err) {
      setScanResult({ status: "error", message: String(err) });
    } finally {
      setScanning(false);
    }
  };

  const handleMarkRead = async (id = null, markAll = false) => {
    try {
      const payload = markAll ? { all: true } : { id };
      const res = await fetch("/api/v1/agent/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        if (markAll) {
          setFindings(prev => prev.map(f => ({ ...f, is_read: true })));
          setUnreadCount(0);
        } else {
          setFindings(prev => prev.map(f => f.id === id ? { ...f, is_read: true } : f));
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error("Error al marcar como leído:", err);
    }
  };

  const handleArchive = async (id) => {
    try {
      const res = await fetch("/api/v1/agent/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setFindings(prev => prev.filter(f => f.id !== id));
        setTotalCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error al archivar oportunidad:", err);
    }
  };

  const handleToggleTarget = async (id) => {
    try {
      const res = await fetch("/api/v1/agent/targets/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setTargets(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));
      }
    } catch (err) {
      console.error("Error al cambiar target:", err);
    }
  };

  const handleAddTarget = async (e) => {
    e.preventDefault();
    if (!newTargetName || !newTargetUrl) return;

    try {
      setIsAddingTarget(true);
      const res = await fetch("/api/v1/agent/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTargetName,
          url: newTargetUrl,
          category: newTargetCategory,
          criteria: newTargetCriteria || "Buscar pasantías, trainee o puestos iniciales en informática.",
          interval_hours: 6
        })
      });
      if (res.ok) {
        setNewTargetName("");
        setNewTargetUrl("");
        setNewTargetCriteria("");
        await fetchData();
      }
    } catch (err) {
      console.error("Error al crear target:", err);
    } finally {
      setIsAddingTarget(false);
    }
  };

  const requestPushPermission = async () => {
    if (!("Notification" in window)) {
      alert("Las notificaciones Web no están soportadas en este navegador.");
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setPushStatus(perm);

      if (perm === "granted" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await reg.showNotification("Radar Autónomo IT Homelab", {
          body: "Notificaciones activadas exitosamente en tu iPhone.",
          icon: "/apple-touch-icon.png",
          badge: "/icon-192.png"
        });
      }
    } catch (err) {
      console.error("Error al solicitar permisos push:", err);
    }
  };

  const testPushNotification = async () => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "TEST_NOTIFICATION"
      });
    }

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Radar IT · Nueva Pasantía Detectada", {
        body: "Get on Board: Trainee Desarrollador Cloud / DevOps (Híbrido)",
        icon: "/apple-touch-icon.png"
      });
    } else {
      alert("Primero debes conceder permisos de notificación pulsando 'Activar Alertas'.");
    }
  };

  // Filter and search logic
  const filteredFindings = findings.filter(f => {
    if (filter === "unread" && f.is_read) return false;
    if (filter === "trainee") {
      const m = (f.modality + " " + f.title).toLowerCase();
      if (!m.includes("trainee") && !m.includes("pasant") && !m.includes("junior")) return false;
    }
    if (filter === "part-time") {
      const m = (f.modality + " " + f.title).toLowerCase();
      if (!m.includes("part-time") && !m.includes("medio") && !m.includes("tiempo")) return false;
    }
    if (filter === "remote") {
      const m = (f.modality + " " + f.title).toLowerCase();
      if (!m.includes("remot") && !m.includes("híbrid") && !m.includes("hibrid")) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const combined = (f.title + " " + f.company + " " + f.summary + " " + f.modality).toLowerCase();
      if (!combined.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. TOP HERO: RADAR AUTÓNOMO IA */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-white/[0.02] backdrop-blur-2xl border border-amber-500/20 space-y-5 relative overflow-hidden glass-shine">
        {/* Subtle background glow effect */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Agente IA 24/7 Activo
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold">
                Google Gemini 3.1 Flash-Lite
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold">
                Costo $0.00 Strict
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Radar className="w-8 h-8 text-amber-400 animate-pulse" />
              <span>Radar Autónomo IT · Pasantías & Part-Time</span>
            </h1>

            <p className="text-sm text-white/70 leading-relaxed">
              Vigilancia web continua en portales de empleo de tecnología. Filtra, analiza y extrae oportunidades iniciales (Trainee, Junior, Pasantías, Medio Tiempo) optimizadas para estudiantes universitarios, descartando roles senior.
            </p>
          </div>

          {/* Quick KPIs & Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center min-w-[110px]">
                <div className="text-2xl font-black font-mono text-amber-400">{unreadCount}</div>
                <div className="text-[11px] uppercase tracking-wider font-mono text-white/50">Nuevas</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center min-w-[110px]">
                <div className="text-2xl font-black font-mono text-white">{totalCount}</div>
                <div className="text-[11px] uppercase tracking-wider font-mono text-white/50">Total Radar</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleRunScan()}
                disabled={scanning}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs uppercase tracking-wider hover:from-amber-400 hover:to-amber-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
                <span>{scanning ? "Rastreando Web..." : "Rastrear Ahora con IA"}</span>
              </button>

              <button
                onClick={() => setShowTargetsModal(true)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all font-mono text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-white/60" />
                <span>Configurar Portales ({targets.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scan feedback alert banner */}
        {scanResult && (
          <div className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center justify-between gap-3 ${
            scanResult.status === "ok" 
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/30 text-rose-300"
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {scanResult.status === "ok" 
                  ? `Rastreo completado: ${scanResult.new_findings} nuevas ofertas detectadas y sincronizadas.`
                  : `Error en el rastreo: ${scanResult.message || "Fallo de conexión"}`}
              </span>
            </div>
            <button onClick={() => setScanResult(null)} className="text-white/50 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. IPHONE WEB PUSH NOTIFICATIONS BANNER */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Alertas Web Push para tu iPhone (PWA Standalone)</h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  pushStatus === "granted"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold"
                    : pushStatus === "denied"
                    ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}>
                  {pushStatus === "granted" ? "Notificaciones Activas" : pushStatus === "denied" ? "Bloqueadas en Safari" : "Pendiente de Activación"}
                </span>
              </div>
              <p className="text-xs text-white/60">
                En iOS 16.4+, añade este dashboard a tu Pantalla de Inicio en Safari ("Compartir" &gt; "Agregar a inicio") para recibir notificaciones nativas de pasantías en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {pushStatus !== "granted" ? (
              <button
                onClick={requestPushPermission}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-purple-500/20"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Activar Alertas en este iPhone</span>
              </button>
            ) : (
              <button
                onClick={testPushNotification}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/15 text-white/90 font-medium text-xs font-mono border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-purple-400" />
                <span>Probar Notificación</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. FILTER BAR & SEARCH */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 max-w-full overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: `Todas (${findings.length})` },
            { id: "unread", label: `Nuevas (${unreadCount})` },
            { id: "trainee", label: "Pasantías / Trainee" },
            { id: "part-time", label: "Part-Time" },
            { id: "remote", label: "Remoto / Híbrido" }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                filter === f.id
                  ? "bg-white/15 text-white border border-white/20 font-bold shadow-sm"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search input & bulk read button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por rol, empresa o stack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400 font-sans"
            />
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => handleMarkRead(null, true)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-xs font-mono transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Marcar todos como leídos"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Marcar Leídos</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. OPPORTUNITIES FEED */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <div className="text-sm font-mono text-white/50">Cargando oportunidades del Radar Autónomo...</div>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white/[0.02] border border-white/5 text-center space-y-3">
          <Briefcase className="w-8 h-8 text-white/30 mx-auto" />
          <div className="text-sm font-semibold text-white/70">No se encontraron ofertas con los filtros actuales</div>
          <p className="text-xs text-white/40 max-w-md mx-auto">
            {searchQuery 
              ? `No hay coincidencias para "${searchQuery}". Prueba con otros términos.`
              : "Ejecuta un rastreo inmediato con el botón 'Rastrear Ahora con IA' para buscar nuevas convocatorias."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className={`p-5 rounded-3xl border transition-all relative flex flex-col justify-between glass-shine ${
                !finding.is_read
                  ? "bg-gradient-to-br from-amber-500/[0.07] via-white/[0.04] to-transparent border-amber-500/30 hover:border-amber-400/50 shadow-lg shadow-amber-500/5"
                  : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="space-y-3">
                {/* Header: Modality Pill + Unread Badge + Portal */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {finding.modality}
                    </span>
                    {!finding.is_read && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Nuevo
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-white/40 truncate max-w-[140px]">
                    {finding.date_str}
                  </span>
                </div>

                {/* Job Title & Company */}
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors leading-snug">
                    {finding.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-white/60 mt-1">
                    <span className="text-amber-400 font-semibold">{finding.company}</span>
                    <span>·</span>
                    <span className="text-white/40">{finding.target_name}</span>
                  </div>
                </div>

                {/* AI Summary Box */}
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-purple-300 font-semibold">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>Síntesis Agente IA:</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed font-sans">
                    {finding.summary}
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between gap-3">
                <a
                  href={finding.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Postularse en Portal</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-white/60" />
                </a>

                <div className="flex items-center gap-1.5">
                  {!finding.is_read && (
                    <button
                      onClick={() => handleMarkRead(finding.id)}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 text-white/60 hover:text-emerald-400 transition-all cursor-pointer"
                      title="Marcar como leído"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleArchive(finding.id)}
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 text-white/40 hover:text-rose-400 transition-all cursor-pointer"
                    title="Archivar de la vista principal"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. CONFIGURACIÓN DE PORTALES & TARGETS MODAL */}
      {showTargetsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  <span>Portales y Fuentes de Vigilancia 24/7</span>
                </h2>
                <p className="text-xs text-white/50 font-mono mt-0.5">
                  Gestiona las URLs monitoreadas por el agente de forma continua
                </p>
              </div>
              <button
                onClick={() => setShowTargetsModal(false)}
                className="p-2 rounded-xl bg-white/5 text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of active targets */}
            <div className="space-y-3">
              <div className="text-xs uppercase font-mono tracking-wider text-white/40">Portales Configurados:</div>
              {targets.map(t => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{t.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                        t.active ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-400"
                      }`}>
                        {t.active ? "Activo (Cada 6h)" : "Pausado"}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-white/40 truncate max-w-md">{t.url}</div>
                    <div className="text-[11px] text-white/60">{t.criteria}</div>
                    <div className="text-[10px] font-mono text-amber-400/80">
                      Último escaneo: {t.last_checked_str}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRunScan(t.id)}
                      disabled={scanning}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono text-xs border border-amber-500/30 transition-all cursor-pointer"
                    >
                      Escanear
                    </button>
                    <button
                      onClick={() => handleToggleTarget(t.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
                        t.active 
                          ? "bg-white/5 border-white/10 text-white/60 hover:text-white" 
                          : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                      }`}
                    >
                      {t.active ? "Pausar" : "Activar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new target form */}
            <form onSubmit={handleAddTarget} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Agregar Nuevo Portal / URL de Búsqueda</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombre del Portal (ej: Computrabajo Trainee)"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
                <input
                  type="url"
                  placeholder="URL pública a rastrear (https://...)"
                  value={newTargetUrl}
                  onChange={(e) => setNewTargetUrl(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <textarea
                placeholder="Criterios para la IA (ej: Extraer roles iniciales de QA, soporte técnico o desarrollo part-time...)"
                value={newTargetCriteria}
                onChange={(e) => setNewTargetCriteria(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAddingTarget}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingTarget ? "Guardando..." : "Guardar Portal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

