import React, { useState, useEffect } from "react";
import { Building2, RefreshCw, ArrowUpRight, GraduationCap, Briefcase, Search, Zap, Clock } from "lucide-react";

// Monitor directo de grandes empresas: estado por empresa + links oficiales para postularse primero.
export default function TopCompanies() {
  const [data, setData] = useState({ tiers: [], companies: [], scanning: false, last_scan: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/v1/agent/top-companies");
      if (res.ok) setData(await res.json());
    } catch (err) {
      void err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Mientras escanea, refresca cada 15 s hasta que termine
  useEffect(() => {
    if (!data.scanning) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [data.scanning]);

  const handleScan = async () => {
    setData(prev => ({ ...prev, scanning: true }));
    try {
      await fetch("/api/v1/agent/top-companies/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } catch (err) {
      void err;
    }
  };

  const q = query.trim().toLowerCase();
  const visible = data.companies.filter(c =>
    (!q || c.name.toLowerCase().includes(q)) && (!onlyOpen || c.entry.length > 0)
  );
  const openCount = data.companies.filter(c => c.entry.length > 0).length;

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
        <div className="text-sm font-mono text-white/50">Cargando empresas top...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-500/[0.08] via-white/[0.02] to-transparent border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-shine">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Empresas Top · monitor cada 2 horas</span>
          </div>
          <p className="text-xs text-white/60 max-w-2xl">
            Cuando una de estas empresas publica una pasantía, intern o trainee en Argentina (o remoto), aparece en "Nuevas" con la etiqueta TOP y te llega una notificación al celular.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-white/50">{openCount} con pasantías abiertas</span>
          <button
            onClick={handleScan}
            disabled={data.scanning}
            className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${data.scanning ? "animate-spin" : ""}`} />
            <span>{data.scanning ? "Revisando empresas..." : "Revisar ahora"}</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar empresa..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400 font-sans"
          />
        </div>
        <button
          onClick={() => setOnlyOpen(v => !v)}
          className={`px-3 py-2 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
            onlyOpen ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-white/[0.04] text-white/60 border-white/10 hover:text-white/80"
          }`}
        >
          Solo con pasantías abiertas
        </button>
      </div>

      {/* Grupos por tier */}
      {data.tiers.map((tier, ti) => {
        const items = visible.filter(c => c.tier_index === ti);
        if (items.length === 0) return null;
        return (
          <div key={tier} className="space-y-2.5">
            <h3 className="text-xs uppercase tracking-wider text-white/50 font-semibold">{tier} ({items.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map(c => (
                <div
                  key={c.name}
                  className={`p-4 rounded-3xl border flex flex-col gap-2.5 glass-shine ${
                    c.entry.length > 0
                      ? "bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.02] to-transparent border-emerald-500/35"
                      : "bg-white/[0.03] border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{c.name}</div>
                      <div className="text-[10px] font-mono text-white/40 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{c.last_checked ? `Revisado ${c.last_checked_str}` : "Pendiente de revisar"}</span>
                        {c.official_api && (
                          <span className="ml-1 px-1.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 flex items-center gap-0.5" title="Además de LinkedIn, se consulta su portal oficial">
                            <Zap className="w-2.5 h-2.5" /> portal
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                      c.entry.length > 0
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-white/[0.05] text-white/45 border-white/10"
                    }`}>
                      {c.entry.length > 0 ? `${c.entry.length} abierta${c.entry.length > 1 ? "s" : ""}` : "Sin pasantías"}
                    </span>
                  </div>

                  {c.entry.length > 0 && (
                    <div className="space-y-1">
                      {c.entry.slice(0, 4).map((e, i) => (
                        <a
                          key={i}
                          href={e.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-emerald-200 hover:text-white hover:underline leading-snug"
                        >
                          {e.title}
                          <span className="text-white/35 font-mono"> · {e.label}{e.location ? ` · ${e.location}` : ""}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {c.note && <p className="text-[11px] text-white/50 leading-snug">{c.note}</p>}

                  <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
                    <a
                      href={c.careers_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1 transition-all"
                    >
                      <span>Portal de empleo</span>
                      <ArrowUpRight className="w-3 h-3 text-white/60" />
                    </a>
                    {c.students_url && (
                      <a
                        href={c.students_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 text-[11px] font-medium flex items-center gap-1 transition-all"
                      >
                        <GraduationCap className="w-3 h-3" />
                        <span>Estudiantes</span>
                      </a>
                    )}
                    {c.linkedin_url && (
                      <a
                        href={c.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-white/15 text-white/80 border border-white/10 text-[11px] font-medium flex items-center gap-1 transition-all"
                        title="Ofertas de la empresa en Argentina, más recientes primero"
                      >
                        <Briefcase className="w-3 h-3" />
                        <span>LinkedIn AR</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-xs text-white/50">
          No hay empresas que coincidan con el filtro.
        </div>
      )}
    </div>
  );
}
