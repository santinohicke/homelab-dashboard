import React, { useState, useEffect, useRef } from "react";
import {
  Radar, Briefcase, Sparkles, RefreshCw, CheckCircle2,
  Filter, Search, Plus, Check, Archive, Clock,
  ShieldCheck, MapPin, Tag, ChevronRight, AlertCircle, X, Sliders,
  CheckCircle, Globe, Terminal, ArrowUpRight, Send, Trash2, Undo2, XCircle,
  FileText, Download, Copy, FileCheck, ExternalLink, Printer
} from "lucide-react";

// Sanitizer to repair broken accents and encodings (e.g. Pasant?as -> Pasantías)
const cleanText = (str) => {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/Pasant\?as/gi, "Pasantías")
    .replace(/Pasant\?a/gi, "Pasantía")
    .replace(/Ingenier\?a/gi, "Ingeniería")
    .replace(/tecnolog\?a/gi, "tecnología")
    .replace(/electr\?nica/gi, "electrónica")
    .replace(/t\?cnico/gi, "técnico")
    .replace(/atenci\?n/gi, "atención")
    .replace(/gesti\?n/gi, "gestión")
    .replace(/inform\?tica/gi, "informática")
    .replace(/pr\?ctica/gi, "práctica")
    .replace(/compa\?\?a/gi, "compañía")
    .replace(/([a-zA-ZáéíóúÁÉÍÓÚñÑ])\?([a-zA-Z])/g, "$1í$2");
};

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
  const [filter, setFilter] = useState("all"); // "all" | "match" | "new" | "applied"
  const [searchQuery, setSearchQuery] = useState("");
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  
  // Document Generation Modal state
  const [docModal, setDocModal] = useState({
    isOpen: false,
    finding: null,
    docType: "cv", // "cv" | "cover_letter"
    language: "auto",
    loading: false,
    error: null,
    docData: null
  });
  const [copiedText, setCopiedText] = useState(false);
  const [evaluatingMatchId, setEvaluatingMatchId] = useState(null);
  const iframeRef = useRef(null);

  // Add target form
  const [newTargetName, setNewTargetName] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [newTargetCriteria, setNewTargetCriteria] = useState("");
  const [newTargetCategory, setNewTargetCategory] = useState("Bolsa Universitaria / IT");
  const [isAddingTarget, setIsAddingTarget] = useState(false);

  useEffect(() => {
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
    if (scanning) return;
    try {
      setScanning(true);
      setScanResult(null);

      const res = await fetch("/api/v1/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetId ? { target_id: targetId } : {})
      });

      if (!res.ok) {
        throw new Error(`Error en el servidor (código HTTP ${res.status}).`);
      }

      const data = await res.json();

      // If backend started task in background, poll /api/v1/agent/status until complete
      if (data.status === "started" || data.scanning) {
        let attempts = 0;
        const maxAttempts = 40; // 40 * 2.5s = 100s max polling limit
        const pollInterval = setInterval(async () => {
          attempts += 1;
          try {
            const stRes = await fetch("/api/v1/agent/status");
            if (stRes.ok) {
              const stData = await stRes.json();
              if (!stData.scanning || attempts >= maxAttempts) {
                clearInterval(pollInterval);
                setScanning(false);
                setScanResult(stData.last_result || { status: "ok", new_findings: 0 });
                await fetchData();
              }
            }
          } catch (pollErr) {
            console.warn("Error en sondeo de estado de rastreo:", pollErr);
          }
        }, 2500);
      } else {
        setScanResult(data);
        setScanning(false);
        await fetchData();
      }
    } catch (err) {
      console.error("Error al ejecutar scraper:", err);
      setScanResult({ status: "error", message: err.message || "Fallo de conexión al ejecutar rastreo." });
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

  const handleOpenDocModal = async (finding, docType = "cv") => {
    const lang = finding.language || "auto";
    setDocModal({
      isOpen: true,
      finding: finding,
      docType: docType,
      language: lang,
      loading: true,
      error: null,
      docData: null
    });

    try {
      const res = await fetch(`/api/v1/agent/doc?id=${finding.id}&type=${docType}`);
      if (res.ok) {
        const data = await res.json();
        if (data.html) {
          setDocModal(prev => ({
            ...prev,
            loading: false,
            docData: data
          }));
          return;
        }
      }
      await triggerDocGeneration(finding.id, docType, lang);
    } catch (err) {
      setDocModal(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const triggerDocGeneration = async (findingId, docType, language) => {
    setDocModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/v1/agent/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finding_id: findingId,
          doc_type: docType,
          language: language
        })
      });
      if (!res.ok) throw new Error(`Error en el servidor (HTTP ${res.status})`);
      const data = await res.json();
      if (data.status !== "ok") throw new Error(data.message || "Error al generar documento");
      
      setDocModal(prev => ({
        ...prev,
        loading: false,
        docData: data
      }));
      fetchData();
    } catch (err) {
      setDocModal(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleDownloadPdf = (findingId, docType) => {
    window.open(`/api/v1/agent/download-doc?id=${findingId}&type=${docType}`, '_blank');
  };

  const handlePrintDoc = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleCopyText = () => {
    if (!docModal.docData?.html) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = docModal.docData.html;
    const txt = tmp.innerText || tmp.textContent || "";
    navigator.clipboard.writeText(txt);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const [evaluatingAll, setEvaluatingAll] = useState(false);

  const handleEvaluateMatch = async (findingId) => {
    try {
      setEvaluatingMatchId(findingId);
      const res = await fetch("/api/v1/agent/evaluate-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finding_id: findingId })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Error al evaluar afinidad:", err);
    } finally {
      setEvaluatingMatchId(null);
    }
  };

  const handleEvaluateAllUnscored = async () => {
    try {
      setEvaluatingAll(true);
      const res = await fetch("/api/v1/agent/evaluate-all-unscored", {
        method: "POST"
      });
      if (res.ok) {
        let checks = 0;
        const interval = setInterval(async () => {
          await fetchData();
          checks++;
          if (checks >= 8) {
            clearInterval(interval);
            setEvaluatingAll(false);
          }
        }, 4000);
      }
    } catch (err) {
      console.error("Error al evaluar afinidades:", err);
      setEvaluatingAll(false);
    }
  };

  // Filter and search logic - Todas, Alta Afinidad, Nuevas, Mis Postulaciones
  const filteredFindings = findings
    .filter(f => {
      if (filter === "new" && f.is_read) return false;
      if (filter === "applied" && !f.is_applied) return false;
      if (filter === "match" && (f.match_score < 80)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const combined = `${f.title} ${f.company} ${f.summary} ${f.modality} ${f.target_name} ${f.match_reason || ''}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. TOP CONTROL BAR (CONSISTENT WITH CENTRO DE CONTROL) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-shine">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
            <Radar className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-white text-base flex flex-wrap items-center gap-2">
              <span>Radar de Oportunidades IT & Pasantías</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Vigilancia 24/7
              </span>
            </div>
            <div className="text-xs text-white/50 font-mono">
              Filtro estricto: Part-time / Pasantías · CABA & Remoto · Redes, Telecomunicaciones, Embebidos & Dev (Sin Soporte ni QA)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => handleRunScan()}
            disabled={scanning}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-500/20 disabled:opacity-50"
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
          <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono mt-0.5">{stats.unread_count}</div>
          <div className="text-[10px] text-cyan-300/80 mt-0.5">Sin revisar</div>
        </div>

        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Mis Postulaciones</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-0.5">{stats.applied_count}</div>
          <div className="text-[10px] text-emerald-300/80 mt-0.5">CVs enviados</div>
        </div>

        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">En Espera</div>
          <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono mt-0.5">{stats.pending_count}</div>
          <div className="text-[10px] text-blue-300/80 mt-0.5">Sin respuesta aún</div>
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
          {/* Strict 4 filter pills + evaluate missing match */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 overflow-x-auto no-scrollbar max-w-full">
              {[
                { id: "all", label: `Todas (${findings.length})` },
                { id: "match", label: `Alta Afinidad (>=80%) (${findings.filter(f => f.match_score >= 80).length})` },
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
                        : f.id === "match"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shadow-sm"
                          : "bg-white/15 text-white border border-white/20 font-bold shadow-sm"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {findings.some(f => !f.match_score || f.match_score === 0) && (
              <button
                onClick={handleEvaluateAllUnscored}
                disabled={evaluatingAll}
                className="px-3 py-1.5 rounded-2xl text-xs font-mono font-medium text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Calcular la afinidad (Match Score) para todas las ofertas que todavía no fueron evaluadas"
              >
                <Sparkles className={`w-3 h-3 text-cyan-400 ${evaluatingAll ? 'animate-spin' : ''}`} />
                <span>{evaluatingAll ? "Evaluando con IA..." : "Calcular Match Faltante"}</span>
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-72 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar puesto, empresa, redes, C++..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 font-sans"
            />
          </div>
        </div>
      </div>

      {/* 5. OPPORTUNITIES FEED CARDS */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
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
                  ? "bg-gradient-to-br from-rose-500/[0.06] via-white/[0.02] to-transparent border-rose-500/25 hover:border-rose-400/40 shadow-lg shadow-rose-500/5"
                  : finding.is_applied
                  ? "bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-transparent border-emerald-500/30 hover:border-emerald-400/50 shadow-lg shadow-emerald-500/5"
                  : !finding.is_read
                  ? "bg-gradient-to-br from-cyan-500/[0.06] via-white/[0.02] to-transparent border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/5"
                  : "bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-cyan-500/30"
              }`}
            >
              <div className="space-y-2.5">
                {/* Header Pills: Modality + Match Score + Status Badge + Date */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-medium uppercase tracking-wider bg-white/[0.06] text-white/90 border border-white/15">
                      {cleanText(finding.modality)}
                    </span>

                    {/* Match Score Badge */}
                    {finding.match_score > 0 ? (
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase border flex items-center gap-1 ${
                        finding.match_score >= 85
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : finding.match_score >= 70
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                      }`}>
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        {finding.match_score}% Match
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEvaluateMatch(finding.id); }}
                        disabled={evaluatingMatchId === finding.id}
                        className="text-[9px] px-2 py-0.5 rounded-full font-mono text-white/50 hover:text-white/80 bg-white/[0.04] hover:bg-white/10 border border-white/10 flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                        title="Calcular afinidad con tu perfil real"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                        <span>{evaluatingMatchId === finding.id ? "Evaluando..." : "Calcular Match"}</span>
                      </button>
                    )}

                    {finding.is_applied ? (
                      finding.is_rejected ? (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          Rechazada
                        </span>
                      ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
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
                  <span className="text-[10px] font-mono text-white/40 truncate max-w-[130px]">
                    {finding.date_str}
                  </span>
                </div>

                {/* Job Title & Company */}
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {cleanText(finding.title)}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-white/60 mt-1">
                    <span className="text-cyan-400 font-semibold">{cleanText(finding.company)}</span>
                    <span className="text-white/30">·</span>
                    <span className="text-white/40 truncate max-w-[180px]">{cleanText(finding.target_name)}</span>
                  </div>
                </div>

                {/* Streamlined Summary (concise and non-cluttered) */}
                <p className="text-xs text-white/70 leading-relaxed font-sans line-clamp-2">
                  {cleanText(finding.summary)}
                </p>

                {/* Match Affinity & Missing Skills Detail */}
                {finding.match_reason && (
                  <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs space-y-1 mt-1">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Afinidad con perfil de Santino:</span>
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed font-sans">
                      {finding.match_reason}
                    </p>
                    {finding.missing_skills && finding.missing_skills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <span className="text-[10px] text-white/40 font-mono">Reforzar:</span>
                        {finding.missing_skills.map((s, idx) => (
                          <span key={idx} className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/[0.05] text-amber-300/80 border border-amber-400/20 font-mono">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-3 mt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <a
                    href={finding.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ver Oferta</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-white/60" />
                  </a>

                  {/* Harvard CV & Cover Letter Generation Buttons */}
                  <button
                    onClick={() => handleOpenDocModal(finding, "cv")}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      finding.has_cv_pdf
                        ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 font-bold"
                        : "bg-white/[0.06] hover:bg-white/15 text-white/90 border-white/15"
                    }`}
                    title="Generar CV personalizado formato Harvard en PDF"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{finding.has_cv_pdf ? "Ver CV (.pdf)" : "CV Harvard"}</span>
                  </button>

                  <button
                    onClick={() => handleOpenDocModal(finding, "cover_letter")}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      finding.has_cover_letter_pdf
                        ? "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/40 font-bold"
                        : "bg-white/[0.06] hover:bg-white/15 text-white/90 border-white/15"
                    }`}
                    title="Generar Cover Letter personalizada en PDF"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>{finding.has_cover_letter_pdf ? "Ver Carta (.pdf)" : "Cover Letter"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
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

      {/* 5B. DOCUMENT GENERATOR MODAL (HARVARD CV & COVER LETTER) */}
      {docModal.isOpen && docModal.finding && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-zinc-950 border border-white/20 rounded-3xl p-5 sm:p-6 max-w-4xl w-full max-h-[94vh] flex flex-col justify-between shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Documento Personalizado IA</span>
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 font-mono font-semibold border border-white/15">
                    {docModal.docType === "cv" ? "Formato Harvard ATS (1 Página)" : "Harvard Cover Letter"}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                  {cleanText(docModal.finding.title)} · <span className="text-cyan-400">{cleanText(docModal.finding.company)}</span>
                </h2>
              </div>

              <button
                onClick={() => setDocModal(prev => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-xl bg-white/5 text-white/60 hover:text-white cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar: Tabs, Language selector, Download, Copy, Print */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white/[0.03] p-2.5 rounded-2xl border border-white/10">
              {/* Doc type selector tabs */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => {
                    setDocModal(prev => ({ ...prev, docType: "cv" }));
                    handleOpenDocModal(docModal.finding, "cv");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    docModal.docType === "cv"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>CV Harvard</span>
                </button>
                <button
                  onClick={() => {
                    setDocModal(prev => ({ ...prev, docType: "cover_letter" }));
                    handleOpenDocModal(docModal.finding, "cover_letter");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    docModal.docType === "cover_letter"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cover Letter</span>
                </button>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-white/40 text-[11px]">Idioma:</span>
                <button
                  onClick={() => triggerDocGeneration(docModal.finding.id, docModal.docType, "es")}
                  className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all ${
                    docModal.docData?.language === "es"
                      ? "bg-white/20 text-white border-white/30 font-bold"
                      : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                  }`}
                >
                  Español
                </button>
                <button
                  onClick={() => triggerDocGeneration(docModal.finding.id, docModal.docType, "en")}
                  className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all ${
                    docModal.docData?.language === "en"
                      ? "bg-white/20 text-white border-white/30 font-bold"
                      : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                  }`}
                >
                  English
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {docModal.docData?.has_pdf && (
                  <button
                    onClick={() => handleDownloadPdf(docModal.finding.id, docModal.docType)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar PDF</span>
                  </button>
                )}

                <button
                  onClick={handleCopyText}
                  disabled={!docModal.docData?.html}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Copiar texto del documento al portapapeles"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? "Copiado!" : "Copiar"}</span>
                </button>

                <button
                  onClick={handlePrintDoc}
                  disabled={!docModal.docData?.html}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  title="Imprimir o guardar como PDF desde el navegador"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => triggerDocGeneration(docModal.finding.id, docModal.docType, docModal.language)}
                  disabled={docModal.loading}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  title="Regenerar con IA"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${docModal.loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Document Preview Area */}
            <div className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 flex flex-col items-center justify-center min-h-[460px]">
              {docModal.loading ? (
                <div className="text-center space-y-3 p-8">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-white">
                    Generando {docModal.docType === 'cv' ? 'CV Formato Harvard ATS' : 'Harvard Cover Letter'}...
                  </div>
                  <p className="text-xs text-white/50 max-w-md mx-auto font-mono leading-relaxed">
                    Sintetizando tu trayectoria de Ingeniería Informática UCA, proyectos de Homelab (Linux, Docker, Python) y nivel de inglés C1, renderizando PDF vectorial sin saturación.
                  </p>
                </div>
              ) : docModal.error ? (
                <div className="text-center space-y-3 p-8">
                  <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                  <div className="text-sm font-bold text-white">Error al generar documento</div>
                  <p className="text-xs text-rose-300/80 font-mono max-w-md">{docModal.error}</p>
                  <button
                    onClick={() => triggerDocGeneration(docModal.finding.id, docModal.docType, docModal.language)}
                    className="px-4 py-1.5 rounded-xl bg-white/10 text-white text-xs font-mono hover:bg-white/20 cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              ) : docModal.docData?.html ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={docModal.docData.html}
                  className="w-full h-full min-h-[480px] max-h-[64vh] rounded-2xl bg-white shadow-inner"
                  title="Vista Previa Documento Harvard"
                />
              ) : null}
            </div>

            {/* Footer Metadata */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-white/40 pt-1 border-t border-white/5">
              <div className="flex items-center gap-2">
                <span>Motor:</span>
                <span className="text-cyan-400 font-semibold">{docModal.docData?.model_used || "Gemini 3.8 Flash (High) [PC Bridge]"}</span>
              </div>
              {docModal.docData?.filename && (
                <div className="truncate max-w-[320px]">
                  Archivo: <span className="text-white/60">{docModal.docData.filename}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. CONFIGURACIÓN DE PORTALES & TARGETS MODAL */}
      {showTargetsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-cyan-400" />
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
                  className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 overflow-hidden"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-white truncate">{cleanText(t.name)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 border ${
                        t.active 
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                          : "bg-zinc-800 text-zinc-400 border-white/10"
                      }`}>
                        {t.active ? "Activo (Cada 6h)" : "Pausado"}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-white/40 truncate w-full" title={t.url}>
                      {t.url}
                    </div>
                    <div className="text-[11px] text-white/60 line-clamp-2 leading-relaxed break-words">
                      {cleanText(t.criteria)}
                    </div>
                    <div className="text-[10px] font-mono text-cyan-400/80 flex items-center gap-1.5 pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 shrink-0" />
                      <span className="truncate">Último escaneo: {t.last_checked_str}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 border-white/5 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => handleRunScan(t.id)}
                      disabled={scanning}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-mono text-xs border border-cyan-500/30 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      Escanear
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleTarget(t.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all cursor-pointer whitespace-nowrap ${
                        t.active 
                          ? "bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white" 
                          : "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-300"
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
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Agregar Nuevo Portal o Bolsa de Trabajo</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombre del Portal (ej: UCA Campus)"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
                  required
                />
                <input
                  type="url"
                  placeholder="URL pública a rastrear (https://...)"
                  value={newTargetUrl}
                  onChange={(e) => setNewTargetUrl(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
                  required
                />
              </div>

              <textarea
                placeholder="Criterios para la IA (ej: Pasantías y part-time en CABA para estudiante de sistemas/redes...)"
                value={newTargetCriteria}
                onChange={(e) => setNewTargetCriteria(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAddingTarget}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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

