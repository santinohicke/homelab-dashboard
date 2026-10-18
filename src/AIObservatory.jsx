import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles, Cpu, Zap, Activity, Clock, RefreshCw, CheckCircle2,
  AlertCircle, BarChart3, ArrowUpRight, Check, X, Shield, Terminal,
  Sliders, Timer, HardDrive, Database, Gauge, Play
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

// Helper for cubic bezier smooth curve
function getSvgPath(points) {
  if (!points || points.length === 0) return "";
  return points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    const prev = arr[i - 1];
    const cpX1 = prev.x + (point.x - prev.x) / 2;
    const cpX2 = prev.x + (point.x - prev.x) / 2;
    return `${acc} C ${cpX1.toFixed(1)},${prev.y.toFixed(1)} ${cpX2.toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, "");
}

function getSvgAreaPath(points, height) {
  if (!points || points.length === 0) return "";
  const linePath = getSvgPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(1)},${height} L ${first.x.toFixed(1)},${height} Z`;
}

export default function AIObservatory() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingAI, setTestingAI] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [timeRange, setTimeRange] = useState("24h"); // "24h" | "7d" | "30d" | "historic"

  const fetchStats = async (range = timeRange) => {
    try {
      const res = await fetch(`/api/v1/ai/stats?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.usage_current?.seconds_to_daily_reset) {
          setSecondsRemaining(data.usage_current.seconds_to_daily_reset);
        }
      }
    } catch (err) {
      console.error("Error al obtener estadísticas de IA:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = (newRange) => {
    setTimeRange(newRange);
    fetchStats(newRange);
  };

  useEffect(() => {
    fetchStats(timeRange);
    const interval = setInterval(() => fetchStats(timeRange), 10000);
    return () => clearInterval(interval);
  }, [timeRange]);

  // Countdown timer for quota reset
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  };

  const handleTestInference = async () => {
    try {
      setTestingAI(true);
      setTestResult(null);
      const res = await fetch("/api/v1/ai/test", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
      await fetchStats();
    } catch (err) {
      setTestResult({ status: "error", message: String(err) });
    } finally {
      setTestingAI(false);
    }
  };

  // SVG Chart points calculation for tokens
  const chartHeight = 160;
  const chartWidth = 700;
  const paddingX = 20;
  const paddingY = 25;

  const chartData = useMemo(() => {
    if (!stats?.hourly_chart || stats.hourly_chart.length === 0) return [];
    return stats.hourly_chart;
  }, [stats]);

  const maxTokens = useMemo(() => {
    if (chartData.length === 0) return 100;
    const max = Math.max(...chartData.map(d => d.tokens));
    return max > 0 ? Math.ceil(max * 1.2) : 100;
  }, [chartData]);

  const points = useMemo(() => {
    if (chartData.length === 0) return [];
    const stepX = (chartWidth - paddingX * 2) / (chartData.length - 1 || 1);
    const usableHeight = chartHeight - paddingY * 2;

    return chartData.map((d, i) => ({
      x: paddingX + i * stepX,
      y: chartHeight - paddingY - (d.tokens / maxTokens) * usableHeight,
      data: d
    }));
  }, [chartData, maxTokens]);

  const linePath = useMemo(() => getSvgPath(points), [points]);
  const areaPath = useMemo(() => getSvgAreaPath(points, chartHeight - paddingY), [points]);

  const today = stats?.usage_today || {
    requests: 0,
    requests_remaining: 1500,
    percent_used: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    avg_latency_sec: 0
  };

  const rangeLabels = {
    "24h": "Últimas 24 Horas",
    "7d": "Última Semana (7 Días)",
    "30d": "Últimos 30 Días",
    "historic": "Registro Histórico Completo"
  };

  const defaultAxisLabels = {
    "24h": ["Hace 24 horas", "Hace 12 horas", "Hace 6 horas", "Ahora"],
    "7d": ["Hace 7 días", "Hace 4 días", "Hace 2 días", "Hoy"],
    "30d": ["Hace 30 días", "Hace 20 días", "Hace 10 días", "Hoy"],
    "historic": ["Inicio Histórico", "Intermedio", "Reciente", "Ahora"]
  };
  const axisLabels = stats?.chart_axis_labels || defaultAxisLabels[timeRange] || defaultAxisLabels["24h"];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. TOP CONTROL BAR */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-shine">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 flex items-center justify-center text-purple-400 border border-purple-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-base flex flex-wrap items-center gap-2">
              <span>Google Gemini 3.1 Flash-Lite</span>
            </div>
            <div className="text-xs text-white/50 font-mono">
              Inferencia de baja latencia · Cuota oficial: 1.500 RPD / 15 RPM / 1M TPM
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            onClick={handleTestInference}
            disabled={testingAI}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-purple-500/20 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${testingAI ? "animate-spin" : ""}`} />
            <span>{testingAI ? "Ejecutando Inferencia..." : "Test de Diagnóstico IA"}</span>
          </button>

          <button
            onClick={fetchStats}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-all cursor-pointer"
            title="Actualizar métricas"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Test feedback banner */}
      {testResult && (
        <div className={`p-4 rounded-2xl border text-xs font-mono flex items-center justify-between gap-3 ${
          testResult.status === "ok"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            : "bg-rose-500/15 border-rose-500/30 text-rose-300"
        }`}>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div>
              <div className="font-bold">
                {testResult.status === "ok" ? "Inferencia de prueba exitosa:" : "Error en inferencia:"}
              </div>
              <div className="text-white/80 font-sans text-xs mt-0.5">
                {testResult.status === "ok" ? `"${cleanText(testResult.answer)}"` : testResult.message}
              </div>
              {testResult.status === "ok" && (
                <div className="text-[11px] text-white/50 mt-1">
                  Prompt: {testResult.prompt_tokens} tokens · Salida: {testResult.completion_tokens} tokens · Total: {testResult.total_tokens} tokens · Latencia: {testResult.latency_ms} ms
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setTestResult(null)} className="text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. KPIS METRICS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
            <Gauge className="w-4 h-4 text-purple-400" />
            <span>Consumo de Cuota & Presupuesto de Tokens</span>
          </h2>
          <span className="text-xs font-mono text-white/40">
            Reseteo en: <strong className="text-purple-300">{formatCountdown(secondsRemaining)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Peticiones Diarias (RPD) */}
          <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-3 glass-shine">
            <div className="flex items-center justify-between text-xs text-white/50 font-medium">
              <span>Peticiones Hoy (RPD)</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white">{today.requests}</span>
                <span className="text-xs font-mono text-white/40">/ 1.500 máx</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 font-semibold mt-0.5">
                {today.requests_remaining.toLocaleString("es-AR")} restantes
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(2, today.percent_used))}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-white/40 flex items-center justify-between">
              <span>{today.percent_used}% consumido</span>
              <span>Límite diario</span>
            </div>
          </div>

          {/* Card 2: Tokens Hoy */}
          <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-3 glass-shine">
            <div className="flex items-center justify-between text-xs text-white/50 font-medium">
              <span>Tokens Gastados Hoy</span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-300">
                  {today.total_tokens.toLocaleString("es-AR")}
                </span>
                <span className="text-xs font-mono text-white/40">
                  / {(stats?.limits?.tpm_limit || 1000000).toLocaleString("es-AR")} máx
                </span>
              </div>
              <div className="text-[11px] font-mono text-cyan-400 font-semibold mt-0.5">
                {Math.max(0, (stats?.limits?.tpm_limit || 1000000) - today.total_tokens).toLocaleString("es-AR")} disponibles
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(today.total_tokens > 0 ? 1 : 0, (today.total_tokens / (stats?.limits?.tpm_limit || 1000000)) * 100))}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-white/40 flex items-center justify-between">
              <span>{((today.total_tokens / (stats?.limits?.tpm_limit || 1000000)) * 100).toFixed(2)}% consumido</span>
              <span>Cuota 1M TPM</span>
            </div>
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono text-white/50">
              <div>
                Prompt: <span className="text-white font-bold">{today.prompt_tokens.toLocaleString("es-AR")}</span>
              </div>
              <div>
                Salida: <span className="text-white font-bold">{today.completion_tokens.toLocaleString("es-AR")}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Tasa por Minuto & Latencia */}
          <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-3 glass-shine">
            <div className="flex items-center justify-between text-xs text-white/50 font-medium">
              <span>Tasa Activa (RPM)</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {stats?.usage_current?.rpm || 0}
                </span>
                <span className="text-xs font-mono text-white/40">/ 15 RPM</span>
              </div>
              <div className="text-[11px] font-mono text-white/50 mt-0.5">
                {stats?.usage_current?.rpm_remaining || 15} disponibles este minuto
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/50">
              <span>Latencia Promedio:</span>
              <span className="text-emerald-300 font-bold font-mono">{today.avg_latency_sec}s</span>
            </div>
          </div>

          {/* Card 4: Tokens Históricos Totales */}
          <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-3 glass-shine">
            <div className="flex items-center justify-between text-xs text-white/50 font-medium">
              <span>Historial Acumulado</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-purple-300">
                {(stats?.all_time?.total_tokens || 0).toLocaleString("es-AR")}
              </div>
              <div className="text-[11px] font-mono text-white/50 mt-0.5">
                Tokens Totales desde Despliegue
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/50">
              <span>Peticiones Totales:</span>
              <span className="text-purple-300 font-bold">{stats?.all_time?.total_requests || 0} calls</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DYNAMIC SVG CONSUMPTION CHART */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span>Curva de Consumo de Tokens</span>
            </h2>
            <div className="text-[11px] font-mono text-white/40">
              Intervalo: <span className="text-purple-300 font-semibold">{rangeLabels[timeRange]}</span> · Escala Máx: <strong className="text-white">{maxTokens.toLocaleString("es-AR")}</strong> tokens
            </div>
          </div>

          {/* Time range selector pills matching MetricsObservatory */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: "24h", label: "24H", desc: "Últimas 24 Horas" },
              { id: "7d", label: "7D", desc: "Última Semana (7 Días)" },
              { id: "30d", label: "30D", desc: "Últimos 30 Días" },
              { id: "historic", label: "HISTÓRICO", desc: "Registro Histórico Completo" }
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => handleRangeChange(period.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  timeRange === period.id
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/30 scale-[1.02]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
                title={period.desc}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine">
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="aiTokenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.33, 0.66, 1].map((pct, idx) => {
                const y = paddingY + (chartHeight - paddingY * 2) * pct;
                return (
                  <line
                    key={idx}
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Area & Line */}
              {areaPath && <path d={areaPath} fill="url(#aiTokenGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Points & Interactive Tooltip triggers */}
              {points.map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoverIndex === i ? 5 : pt.data.tokens > 0 ? 3 : 1.5}
                    fill={hoverIndex === i ? "#ffffff" : "#c084fc"}
                    stroke="#a855f7"
                    strokeWidth={hoverIndex === i ? 2 : 1}
                    className="transition-all cursor-pointer"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />
                  {/* Invisible broad hover zone */}
                  <rect
                    x={pt.x - 12}
                    y={0}
                    width={24}
                    height={chartHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                    className="cursor-pointer"
                  />
                </g>
              ))}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoverIndex !== null && points[hoverIndex] && (
              <div
                className="absolute z-20 pointer-events-none transform -translate-x-1/2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-purple-500/40 backdrop-blur-md shadow-xl text-center"
                style={{
                  left: `${(points[hoverIndex].x / chartWidth) * 100}%`,
                  top: `${Math.max(0, points[hoverIndex].y - 45)}px`
                }}
              >
                <div className="text-[10px] font-mono text-purple-300 font-bold">
                  {points[hoverIndex].data.time}
                </div>
                <div className="text-xs font-mono font-black text-white">
                  {points[hoverIndex].data.tokens.toLocaleString("es-AR")} tokens
                </div>
                <div className="text-[9px] font-mono text-white/50">
                  {points[hoverIndex].data.requests} llamada(s)
                </div>
              </div>
            )}
          </div>

          {/* Time axis labels */}
          <div className="flex items-center justify-between text-[10px] font-mono text-white/40 pt-2 border-t border-white/5">
            {axisLabels.map((lbl, idx) => (
              <span key={idx} className={idx === axisLabels.length - 1 ? "text-purple-300 font-bold" : ""}>
                {lbl}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 4. ACTIVITY LOG OF RECENT AI CALLS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Registro de Consultas & Inferencia en Vivo</span>
          </h2>
          <span className="text-xs font-mono text-white/40">
            {stats?.recent_logs?.length || 0} Eventos Registrados
          </span>
        </div>

        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine overflow-x-auto">
          {(!stats?.recent_logs || stats.recent_logs.length === 0) ? (
            <div className="text-center py-8 text-white/40 text-xs font-mono">
              No hay consultas registradas aún. Ejecuta un "Test de Diagnóstico IA" o un "Rastreo de Radar IT" para poblar este registro.
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40 pb-2">
                  <th className="pb-2">Hora</th>
                  <th className="pb-2">Operación / Tarea</th>
                  <th className="pb-2">Modelo</th>
                  <th className="pb-2 text-right">Tokens Prompt</th>
                  <th className="pb-2 text-right">Tokens Salida</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Latencia</th>
                  <th className="pb-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.recent_logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 text-white/50 whitespace-nowrap">{log.time_str}</td>
                    <td className="py-2.5 text-white font-medium max-w-[220px] truncate">{cleanText(log.purpose)}</td>
                    <td className="py-2.5 text-purple-300">{log.model}</td>
                    <td className="py-2.5 text-right text-white/60">{log.prompt_tokens.toLocaleString("es-AR")}</td>
                    <td className="py-2.5 text-right text-white/60">{log.completion_tokens.toLocaleString("es-AR")}</td>
                    <td className="py-2.5 text-right font-bold text-white">{log.total_tokens.toLocaleString("es-AR")}</td>
                    <td className="py-2.5 text-right text-emerald-400">{log.latency_sec}s</td>
                    <td className="py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        log.status === "ok"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}>
                        {log.status === "ok" ? "200 OK" : "ERROR"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

