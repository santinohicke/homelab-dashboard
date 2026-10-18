import React, { useState, useEffect } from "react";
import {
  Radar, Briefcase, Sparkles, RefreshCw, CheckCircle2, ExternalLink,
  Filter, Search, Bell, Smartphone, Plus, Check, Archive, Clock,
  ShieldCheck, MapPin, Tag, ChevronRight, AlertCircle, X, Sliders,
  CheckCircle, Globe, Terminal, ArrowUpRight, Send, Trash2, Undo2, XCircle
} from "lucide-react";

export default function AgentRadar() {
  const [findings, setFindings] = useState([]);
  const [targets, setTargets] = useState([]);
  const [stats, setStats] = useState({
    total_scraped: 0,
    unread_count: 0,
    applied_count: 0,
    rejected_count: 0,
    pending_count: 0,
    active_targets_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "new" | "applied"
  const [searchQuery, setSearchQuery] = useState("");
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [pushStatus, setPushStatus] = useState("default"); // "granted" | "denied" | "default" | "unsupported"
  
  // Add target form
  const [newTargetName, setNewTargetName] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [newTargetCriteria, setNewTargetCriteria] = useState("");
  const [newTargetCategory, setNewTargetCategory] = useState("Bolsa Universitaria / IT");
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
        fetch("/api/v1/agent/findings?limit=100"),
        fetch("/api/v1/agent/targets")
      ]);

      if (resFindings.ok) {
        const data = await resFindings.json();
        const list = data.findings || [];
        setFindings(list);

        if (data.stats) {
          setStats(data.stats);
        } else {
          const applied = list.filter(f => f.is_applied).length;
          const rejected = list.filter(f => f.is_applied && f.is_rejected).length;
          setStats({
            total_scraped: data.total_count ?? list.length,
            unread_count: data.unread_count ?? list.filter(f => !f.is_read).length,
            applied_count: applied,
            rejected_count: rejected,
            pending_count: Math.max(0, applied - rejected),
            active_targets_count: 0
          });
        }
      }

      if (resTargets.ok) {
        const data = await resTargets.json();
        const tList = data.targets || [];
        setTargets(tList);
        setStats(prev => ({
          ...prev,
          active_targets_count: tList.filter(t => t.active).length
        }));
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

  const handleApply = async (id) => {
    try {
      const res = await fetch("/api/v1/agent/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setFindings(prev => prev.map(f => f.id === id ? { ...f, is_applied: true, is_read: true, is_rejected: false } : f));
        setStats(prev => ({
          ...prev,
          applied_count: prev.applied_count + 1,
          pending_count: prev.pending_count + 1,
          unread_count: Math.max(0, prev.unread_count - 1)
        }));
      }
    } catch (err) {
      console.error("Error al marcar como postulado:", err);
    }
  };

  const handleUnapply = async (id) => {
    try {
      const item = findings.find(f => f.id === id);
      const wasRejected = item?.is_rejected;
      const res = await fetch("/api/v1/agent/unapply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setFindings(prev => prev.map(f => f.id === id ? { ...f, is_applied: false, is_rejected: false } : f));
        setStats(prev => ({
          ...prev,
          applied_count: Math.max(0, prev.applied_count - 1),
          rejected_count: wasRejected ? Math.max(0, prev.rejected_count - 1) : prev.rejected_count,
          pending_count: wasRejected ? prev.pending_count : Math.max(0, prev.pending_count - 1)
        }));
      }
    } catch (err) {
      console.error("Error al desmarcar postulación:", err);
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await fetch("/api/v1/agent/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setFindings(prev => prev.map(f => f.id === id ? { ...f, is_rejected: true, is_applied: true, is_read: true } : f));
        setStats(prev => ({
          ...prev,
          rejected_count: prev.rejected_count + 1,
          pending_count: Math.max(0, prev.pending_count - 1)
        }));
      }
    } catch (err) {
      console.error("Error al registrar rechazo:", err);
    }
  };

  const handleUnreject = async (id) => {
    try {
      const res = await fetch("/api/v1/agent/unreject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setFindings(prev => prev.map(f => f.id === id ? { ...f, is_rejected: false } : f));
        setStats(prev => ({
          ...prev,
          rejected_count: Math.max(0, prev.rejected_count - 1),
          pending_count: prev.pending_count + 1
        }));
      }
    } catch (err) {
      console.error("Error al desmarcar rechazo:", err);
    }
  };

  const handleDiscard = async (id) => {
    try {
      const res = await fetch("/api/v1/agent/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const item = findings.find(f => f.id === id);
        setFindings(prev => prev.filter(f => f.id !== id));
        setStats(prev => ({
          ...prev,
          total_scraped: Math.max(0, prev.total_scraped - 1),
          unread_count: (!item?.is_read) ? Math.max(0, prev.unread_count - 1) : prev.unread_count,
          applied_count: item?.is_applied ? Math.max(0, prev.applied_count - 1) : prev.applied_count,
          rejected_count: (item?.is_applied && item?.is_rejected) ? Math.max(0, prev.rejected_count - 1) : prev.rejected_count,
          pending_count: (item?.is_applied && !item?.is_rejected) ? Math.max(0, prev.pending_count - 1) : prev.pending_count
        }));
      }
    } catch (err) {
      console.error("Error al descartar oportunidad:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/v1/agent/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      if (res.ok) {
        setFindings(prev => prev.map(f => ({ ...f, is_read: true })));
        setStats(prev => ({ ...prev, unread_count: 0 }));
      }
    } catch (err) {
      console.error("Error al marcar todas como leídas:", err);
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
        setTargets(prev => {
          const next = prev.map(t => t.id === id ? { ...t, active: !t.active } : t);
          setStats(s => ({ ...s, active_targets_count: next.filter(t => t.active).length }));
          return next;
        });
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
          criteria: newTargetCriteria || "Pasantías y empleos part-time en CABA o remoto para estudiante de ingeniería informática.",
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
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Radar IT · Convocatoria Detectada", {
        body: "UCA HiringRoom: Pasantía en Infraestructura y Cloud - CABA",
        icon: "/apple-touch-icon.png"
      });
    } else {
      alert("Primero debes conceder permisos de notificación pulsando 'Activar Alertas'.");
    }
  };

  // Filter and search logic - ONLY Todas, Nuevas, Mis Postulaciones
  const filteredFindings = findings.filter(f => {
    if (filter === "new" && f.is_read) return false;
    if (filter === "applied" && !f.is_applied) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const combined = `${f.title} ${f.company} ${f.summary} ${f.modality} ${f.target_name}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. TOP CONTROL BAR (CONSISTENT WITH CENTRO DE CONTROL) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-shine">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <Radar className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-white text-base flex flex-wrap items-center gap-2">
              <span>Radar de Oportunidades IT & Pasantías</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Vigilancia 24/7
              </span>
            </div>
            <div className="text-xs text-white/50 font-mono">
              Filtro estricto: Part-time / Pasantías · CABA & Remoto · Redes, Infra, Embebidos, Electrónica & Dev
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => handleRunScan()}
            disabled={scanning}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? "Rastreando Web..." : "Rastrear Ahora"}</span>
          </button>

          <button
            onClick={() => setShowTargetsModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 font-mono text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-white/60" />
            <span>Portales ({targets.length})</span>
          </button>
        </div>
      </div>

      {/* Scan feedback alert banner */}
      {scanResult && (
        <div className={`p-4 rounded-2xl border text-xs font-mono flex items-center justify-between gap-3 ${
          scanResult.status === "ok" 
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            : "bg-rose-500/15 border-rose-500/30 text-rose-300"
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {scanResult.status === "ok" 
                ? `Rastreo completado: ${scanResult.new_findings} nuevas vacantes reales detectadas e indexadas.`
                : `Error en el rastreo: ${scanResult.message || "Fallo de conexión"}`}
            </span>
          </div>
          <button onClick={() => setScanResult(null)} className="text-white/50 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. REAL METRICS SUMMARY GRID (ZERO MOCK / ZERO HARDCODING) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Ofertas Analizadas</div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-0.5">{stats.total_scraped}</div>
          <div className="text-[10px] text-white/40 mt-0.5">En base SQLite</div>
        </div>

        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Nuevas sin Leer</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-0.5">{stats.unread_count}</div>
          <div className="text-[10px] text-amber-300/80 mt-0.5">Sin revisar</div>
        </div>

        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Mis Postulaciones</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-0.5">{stats.applied_count}</div>
          <div className="text-[10px] text-emerald-300/80 mt-0.5">CVs enviados</div>
        </div>

        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">En Espera</div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono mt-0.5">{stats.pending_count}</div>
          <div className="text-[10px] text-cyan-300/80 mt-0.5">Sin respuesta aún</div>
        </div>

        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Rechazadas</div>
          <div className="text-2xl sm:text-3xl font-black text-rose-400 font-mono mt-0.5">{stats.rejected_count}</div>
          <div className="text-[10px] text-rose-300/80 mt-0.5">Postulaciones cerradas</div>
        </div>

        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Portales Activos</div>
          <div className="text-2xl sm:text-3xl font-black text-purple-300 font-mono mt-0.5">
            {stats.active_targets_count || targets.filter(t => t.active).length}
          </div>
          <div className="text-[10px] text-purple-300/80 mt-0.5">UCA · LinkedIn · Get on Board</div>
        </div>
      </div>

      {/* 3. IPHONE WEB PUSH NOTIFICATIONS BANNER */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 glass-shine">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 flex items-center justify-center text-purple-400 border border-purple-500/20 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Alertas Push para iPhone (PWA Standalone)</h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                pushStatus === "granted"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold"
                  : pushStatus === "denied"
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
              }`}>
                {pushStatus === "granted" ? "Activas" : pushStatus === "denied" ? "Bloqueadas" : "Pendiente"}
              </span>
            </div>
            <p className="text-xs text-white/60">
              En iOS 16.4+, agregá este panel a la pantalla de inicio desde Safari para recibir notificaciones nativas en tu iPhone al detectar convocatorias.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {pushStatus !== "granted" ? (
            <button
              onClick={requestPushPermission}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-purple-500/20"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Activar en este iPhone</span>
            </button>
          ) : (
            <button
              onClick={testPushNotification}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 font-medium text-xs font-mono border border-white/15 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-purple-400" />
              <span>Probar Alerta</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. FILTER PILLS & SEARCH BAR (STRICTLY TODAS, NUEVAS, MIS POSTULACIONES) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>Explorador de Oportunidades ({filteredFindings.length})</span>
          </h2>
          {stats.unread_count > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Marcar todas como leídas</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Strict 3 filter pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: "all", label: `Todas (${findings.length})` },
              { id: "new", label: `Nuevas (${stats.unread_count})` },
              { id: "applied", label: `Mis Postulaciones (${stats.applied_count})` }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  filter === f.id
                    ? f.id === "applied"
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm"
                      : "bg-white/15 text-white border border-white/20 font-bold shadow-sm"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-72 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar puesto, empresa, redes, C++..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400 font-sans"
            />
          </div>
        </div>
      </div>

      {/* 5. OPPORTUNITIES FEED CARDS */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <div className="text-sm font-mono text-white/50">Consultando base de vacantes reales en el Homelab...</div>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white/[0.03] border border-white/10 text-center space-y-3 glass-shine">
          <Briefcase className="w-8 h-8 text-white/30 mx-auto" />
          <div className="text-sm font-semibold text-white/70">
            {filter === "applied" 
              ? "Aún no te has postulado a ninguna vacante" 
              : filter === "new"
              ? "No hay vacantes nuevas sin leer"
              : "No se encontraron vacantes registradas"}
          </div>
          <p className="text-xs text-white/40 max-w-md mx-auto">
            {filter === "applied"
              ? "Explorá las vacantes en 'Todas', postuláte pulsando 'Postularse' y haz el seguimiento aquí marcando si te contactaron o te rechazaron."
              : searchQuery 
              ? `No hay coincidencias para "${searchQuery}". Probá con otros términos.`
              : "Pulsá 'Rastrear Ahora' para que el agente extraiga las convocatorias vigentes de la UCA, LinkedIn y portales tecnológicos."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className={`p-5 rounded-3xl border transition-all relative flex flex-col justify-between glass-shine ${
                finding.is_applied && finding.is_rejected
                  ? "bg-gradient-to-br from-rose-500/[0.08] via-white/[0.03] to-transparent border-rose-500/30 hover:border-rose-400/50 shadow-lg shadow-rose-500/5"
                  : finding.is_applied
                  ? "bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.03] to-transparent border-emerald-500/40 hover:border-emerald-400/60 shadow-lg shadow-emerald-500/5"
                  : !finding.is_read
                  ? "bg-gradient-to-br from-amber-500/[0.06] via-white/[0.03] to-transparent border-amber-500/30 hover:border-amber-400/50 shadow-lg shadow-amber-500/5"
                  : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="space-y-3">
                {/* Header Pills: Modality + Real Status Badge + Date */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {finding.modality}
                    </span>

                    {finding.is_applied ? (
                      finding.is_rejected ? (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          Rechazada
                        </span>
                      ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Postulado · En espera
                        </span>
                      )
                    ) : !finding.is_read ? (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Nueva
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-mono text-white/40 truncate max-w-[140px]">
                    {finding.date_str}
                  </span>
                </div>

                {/* Job Title & Company */}
                <div>
                  <h3 className="text-base font-bold text-white leading-snug">
                    {finding.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-white/60 mt-1">
                    <span className="text-amber-400 font-semibold">{finding.company}</span>
                    <span>·</span>
                    <span className="text-white/40">{finding.target_name}</span>
                  </div>
                </div>

                {/* AI Synthesis Box */}
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
              <div className="pt-4 mt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                <a
                  href={finding.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Ver Oferta</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-white/60" />
                </a>

                <div className="flex items-center gap-2">
                  {finding.is_applied ? (
                    <>
                      {finding.is_rejected ? (
                        <button
                          onClick={() => handleUnreject(finding.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-mono transition-all flex items-center gap-1 cursor-pointer"
                          title="Desmarcar rechazo y volver a estado en espera"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Desmarcar rechazo</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReject(finding.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-mono transition-all flex items-center gap-1 cursor-pointer"
                          title="Registrar que la empresa rechazó la postulación"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Me rechazaron</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleUnapply(finding.id)}
                        className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                        title="Quitar de mis postulaciones"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleApply(finding.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-mono transition-all flex items-center gap-1 cursor-pointer"
                      title="Marcar como postulado para seguimiento"
                    >
                      <Send className="w-3 h-3" />
                      <span>Postularse</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDiscard(finding.id)}
                    className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-white/40 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                    title="Descartar / archivar vacante"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. CONFIGURACIÓN DE PORTALES & TARGETS MODAL */}
      {showTargetsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  <span>Portales de Empleo & Fuentes de Vigilancia</span>
                </h2>
                <p className="text-xs text-white/50 font-mono mt-0.5">
                  Gestiona las bolsas de trabajo rastreadas por el agente autónomo
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
                <span>Agregar Nuevo Portal o Bolsa de Trabajo</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombre del Portal (ej: UCA Campus)"
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
                placeholder="Criterios para la IA (ej: Pasantías y part-time en CABA para estudiante de sistemas/redes...)"
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

