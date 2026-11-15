import React, { useState, useEffect, useRef } from "react";
import {
  Radar, Briefcase, Sparkles, RefreshCw, CheckCircle2,
  Filter, Search, Plus, Check, Archive, Clock,
  ShieldCheck, MapPin, Tag, ChevronRight, AlertCircle, X, Sliders,
  CheckCircle, Globe, Terminal, ArrowUpRight, Send, Trash2, Undo2, XCircle,
  FileText, Download, Copy, FileCheck, ExternalLink, Printer, Edit3, Eye, Save
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

const isTopFinding = (f) => (f.is_top || (f.modality || "").startsWith("TOP") ? 1 : 0);

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
  const [filter, setFilter] = useState("new"); // "new" | "applied" | "top"
  const [appliedTopOnly, setAppliedTopOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [topMonitor, setTopMonitor] = useState({ total: 0, last_scan: 0, scanning: false });

  const fetchTopMonitor = async () => {
    try {
      const res = await fetch("/api/v1/agent/top-companies");
      if (res.ok) {
        const d = await res.json();
        setTopMonitor({ total: (d.companies || []).length, last_scan: d.last_scan || 0, scanning: !!d.scanning });
        return !!d.scanning;
      }
    } catch (err) {
      void err;
    }
    return false;
  };

  const handleTopScan = async () => {
    setTopMonitor(prev => ({ ...prev, scanning: true }));
    try {
      await fetch("/api/v1/agent/top-companies/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } catch (err) {
      void err;
    }
    // Refresca hasta que termine y recarga las ofertas
    const poll = setInterval(async () => {
      const still = await fetchTopMonitor();
      if (!still) {
        clearInterval(poll);
        fetchData();
      }
    }, 15000);
  };

  useEffect(() => {
    if (filter === "top") fetchTopMonitor();
  }, [filter]);
  
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
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [editableHtml, setEditableHtml] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [docFeedback, setDocFeedback] = useState(null);
  const [copiedText, setCopiedText] = useState(false);
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
        fetch("/api/v1/agent/findings?limit=300"),
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
        body: JSON.stringify(targetId ? { target_id: targetId, force: true } : { force: true })
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

  const handleToggleEdit = () => {
    if (!isEditingDoc) {
      setEditableHtml(docModal.docData?.html || "");
      setIsEditingDoc(true);
    } else {
      setIsEditingDoc(false);
    }
  };

  const handleSaveEditedDoc = async () => {
    if (!docModal.finding?.id || !editableHtml) return;
    setSavingDoc(true);
    setDocFeedback("Guardando y actualizando PDF...");
    try {
      const res = await fetch("/api/v1/agent/save-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finding_id: docModal.finding.id,
          doc_type: docModal.docType,
          html: editableHtml
        })
      });
      if (res.ok) {
        const d = await res.json();
        setDocModal(prev => ({
          ...prev,
          docData: {
            ...prev.docData,
            html: editableHtml,
            has_pdf: d.has_pdf,
            pdf_base64: d.pdf_base64
          }
        }));
        setIsEditingDoc(false);
        setDocFeedback("Documento y PDF guardados con éxito");
        fetchData();
      } else {
        setDocFeedback("Error al guardar cambios");
      }
    } catch (err) {
      setDocFeedback("Error de comunicación");
    } finally {
      setSavingDoc(false);
      setTimeout(() => setDocFeedback(null), 3000);
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

  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");

  // Verificador: abre el aviso real de cada oferta y Gemini 3.8 Flash (Antigravity en la PC) descarta las que no sirven
  const handleVerifyOffers = async () => {
    setVerifying(true);
    setVerifyMsg("");
    try {
      const res = await fetch("/api/v1/agent/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (!res.ok || d.status === "error") {
        setVerifyMsg(d.message || "No se pudo iniciar la verificación");
        setVerifying(false);
        return;
      }
      setVerifyMsg("Leyendo cada aviso y analizándolo con Gemini 3.8 Flash en la PC...");
      const poll = setInterval(async () => {
        try {
          const r2 = await fetch("/api/v1/agent/findings?limit=300");
          const d2 = await r2.json();
          if (d2.verifier && !d2.verifier.running) {
            clearInterval(poll);
            setVerifying(false);
            setVerifyMsg(`Listo: ${d2.verifier.checked} ofertas revisadas, ${d2.verifier.archived} archivadas.`);
            fetchData();
          }
        } catch (err) {
          void err;
        }
      }, 20000);
    } catch (err) {
      setVerifyMsg("No se pudo iniciar la verificación");
      setVerifying(false);
      void err;
    }
  };

  // Nuevas: sin postular y no top · Empresas Top: top sin postular · Mis Postulaciones: postuladas (opcionalmente solo top)
  const filteredFindings = findings.filter(f => {
    const top = isTopFinding(f);
    if (filter === "new" && (f.is_applied || top)) return false;
    if (filter === "top" && (f.is_applied || !top)) return false;
    if (filter === "applied" && (!f.is_applied || (appliedTopOnly && !top))) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const combined = `${f.title} ${f.company} ${f.summary} ${f.modality} ${f.target_name}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }
    return true;
  });
  const newCount = findings.filter(f => !f.is_applied && !isTopFinding(f)).length;
  const topCount = findings.filter(f => !f.is_applied && isTopFinding(f)).length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. HEADER */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-shine">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
            <Radar className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-base">Radar IT & Pasantías</div>
            <div className="text-xs text-white/50">Part-time y pasantías · CABA y remoto</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleRunScan()}
            disabled={scanning}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/30 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? "Rastreando..." : "Rastrear ahora"}</span>
          </button>
          <button
            onClick={() => setShowTargetsModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-white/60" />
            <span>Portales ({targets.length})</span>
          </button>
        </div>
      </div>

      {scanResult && (
        <div className={`px-4 py-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          scanResult.status === "ok"
            ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-200"
            : "bg-rose-500/10 border-rose-500/25 text-rose-300"
        }`}>
          <span>
            {scanResult.status === "ok"
              ? `Rastreo completado: ${scanResult.new_findings} ofertas nuevas.`
              : `Error en el rastreo: ${scanResult.message || "fallo de conexión"}`}
          </span>
          <button onClick={() => setScanResult(null)} className="text-white/50 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Analizadas", value: stats.total_scraped, color: "text-white" },
          { label: "Sin leer", value: stats.unread_count, color: "text-cyan-400" },
          { label: "Postulaciones", value: stats.applied_count, color: "text-emerald-400" },
          { label: "En espera", value: stats.pending_count, color: "text-white" },
          { label: "Rechazadas", value: stats.rejected_count, color: "text-rose-400" },
          { label: "Portales activos", value: stats.active_targets_count || targets.filter(t => t.active).length, color: "text-white" }
        ].map(m => (
          <div key={m.label} className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
            <div className="text-[11px] text-white/50 uppercase font-semibold">{m.label}</div>
            <div className={`text-2xl sm:text-3xl font-black font-mono mt-0.5 ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* 3. FILTERS & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: "new", label: `Nuevas (${newCount})` },
              { id: "top", label: `Empresas Top (${topCount})` },
              { id: "applied", label: `Mis Postulaciones (${stats.applied_count})` }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  filter === f.id
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filter === "applied" && (
            <button
              onClick={() => setAppliedTopOnly(v => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs border transition-colors cursor-pointer ${
                appliedTopOnly
                  ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/30"
                  : "bg-white/[0.04] text-white/60 border-white/10 hover:text-white"
              }`}
            >
              Solo empresas top
            </button>
          )}

          {filter === "top" && (
            <button
              onClick={handleTopScan}
              disabled={topMonitor.scanning}
              className="px-3 py-1.5 rounded-xl text-xs bg-white/[0.04] text-white/60 hover:text-white border border-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title={topMonitor.last_scan ? `Última revisión: ${new Date(topMonitor.last_scan * 1000).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
            >
              <RefreshCw className={`w-3 h-3 text-cyan-400 ${topMonitor.scanning ? "animate-spin" : ""}`} />
              <span>{topMonitor.scanning ? "Revisando..." : "Revisar empresas"}</span>
            </button>
          )}

          <button
            onClick={handleVerifyOffers}
            disabled={verifying}
            className="px-3 py-1.5 rounded-xl text-xs bg-white/[0.04] text-white/60 hover:text-white border border-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Abre el aviso real de cada oferta y descarta las cerradas, full-time, fuera de Buenos Aires o que piden experiencia"
          >
            <ShieldCheck className={`w-3 h-3 text-cyan-400 ${verifying ? "animate-pulse" : ""}`} />
            <span>{verifying ? "Verificando..." : "Verificar ofertas"}</span>
          </button>
          {verifyMsg && <span className="text-[11px] text-white/50">{verifyMsg}</span>}
        </div>

        <div className="relative flex-1 sm:w-72 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar puesto o empresa"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* 4. OFFERS */}
      {loading ? (
        <div className="p-12 text-center">
          <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-sm text-white/60 glass-shine">
          {searchQuery
            ? `Sin resultados para "${searchQuery}".`
            : filter === "applied"
            ? appliedTopOnly ? "No te postulaste a ninguna empresa top." : "Todavía no te postulaste a ninguna oferta."
            : filter === "top"
            ? "No hay ofertas nuevas de empresas top."
            : "No hay ofertas nuevas."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className="p-5 rounded-3xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all flex flex-col justify-between glass-shine"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider bg-white/[0.06] text-white/80 border border-white/15">
                      {cleanText(finding.modality)}
                    </span>
                    {finding.is_applied && (
                      finding.is_rejected ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          Rechazada
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          En espera
                        </span>
                      )
                    )}
                    {finding.verify_status === "ok" ? (
                      <span className="text-[10px] text-white/50 flex items-center gap-1" title={finding.verify_reason || "Aviso leído y analizado"}>
                        <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        Verificada
                      </span>
                    ) : finding.verify_status && finding.verify_status !== "sin_leer" ? (
                      <span className="text-[10px] text-white/50 flex items-center gap-1" title={finding.verify_reason}>
                        <AlertCircle className="w-3 h-3" />
                        {finding.verify_label}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-mono text-white/40 truncate max-w-[130px]">{finding.date_str}</span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {cleanText(finding.title)}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-white/50 mt-1 min-w-0">
                    <span className="text-cyan-400 font-semibold whitespace-nowrap">{cleanText(finding.company)}</span>
                    {finding.location && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="truncate min-w-0 flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" />{cleanText(finding.location)}</span>
                      </>
                    )}
                    <span className="text-white/30">·</span>
                    <span className="truncate min-w-0 text-white/40">{cleanText(finding.target_name)}</span>
                  </div>
                </div>

                <p className="text-xs text-white/70 leading-relaxed line-clamp-2">
                  {cleanText(finding.summary)}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <a
                    href={finding.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ver oferta</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-white/60" />
                  </a>
                  <button
                    onClick={() => handleOpenDocModal(finding, "cv")}
                    className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/90 border border-white/15 text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    title="CV personalizado en PDF"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{finding.has_cv_pdf ? "Ver CV" : "CV"}</span>
                  </button>
                  <button
                    onClick={() => handleOpenDocModal(finding, "cover_letter")}
                    className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/90 border border-white/15 text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    title="Cover letter personalizada en PDF"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{finding.has_cover_letter_pdf ? "Ver carta" : "Carta"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {finding.is_applied ? (
                    <>
                      <button
                        onClick={() => (finding.is_rejected ? handleUnreject(finding.id) : handleReject(finding.id))}
                        className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/80 border border-white/15 text-xs transition-colors cursor-pointer"
                        title={finding.is_rejected ? "Volver a en espera" : "Registrar que la empresa rechazó la postulación"}
                      >
                        {finding.is_rejected ? "Desmarcar rechazo" : "Me rechazaron"}
                      </button>
                      <button
                        onClick={() => handleUnapply(finding.id)}
                        className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                        title="Quitar de mis postulaciones"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleApply(finding.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      title="Marcar como postulado"
                    >
                      <Send className="w-3 h-3" />
                      <span>Postularse</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDiscard(finding.id)}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 transition-colors cursor-pointer"
                    title="Borrar oferta"
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
                {/* Botón Editar / Previsualizar */}
                <button
                  onClick={handleToggleEdit}
                  disabled={!docModal.docData?.html}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border ${
                    isEditingDoc
                      ? "bg-amber-500/20 text-amber-300 border-amber-400/40 font-bold"
                      : "bg-white/10 hover:bg-white/20 text-white border-white/15"
                  }`}
                  title={isEditingDoc ? "Volver a vista previa interactiva" : "Editar texto del documento"}
                >
                  {isEditingDoc ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isEditingDoc ? "Vista Previa" : "Editar Texto"}</span>
                </button>

                {isEditingDoc && (
                  <button
                    onClick={handleSaveEditedDoc}
                    disabled={savingDoc}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingDoc ? "Guardando..." : "Guardar & Regenerar PDF"}</span>
                  </button>
                )}

                {docModal.docData?.has_pdf && !isEditingDoc && (
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

            {/* Document Preview & Edit Area */}
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
              ) : isEditingDoc ? (
                <div className="w-full h-full p-4 flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-amber-300/90 pb-1">
                    <span>Modo Edición: Modificá palabras, fechas o datos directamente. Guardar regenerará el PDF vectorial.</span>
                    {docFeedback && <span className="text-cyan-300 font-bold animate-pulse">{docFeedback}</span>}
                  </div>
                  <textarea
                    value={editableHtml}
                    onChange={(e) => setEditableHtml(e.target.value)}
                    rows={18}
                    className="w-full flex-1 p-4 rounded-xl bg-black/60 border border-white/15 text-xs text-white/90 font-mono focus:outline-none focus:border-amber-400/60 resize-none selection:bg-amber-500/30"
                  />
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
