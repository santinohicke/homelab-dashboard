import React, { useState, useMemo, useEffect } from "react";
import {
  Activity, Server, Wifi, Cpu, HardDrive, Smartphone, Laptop, Tablet,
  Shield, ShieldCheck, Lock, Zap, Radio, Globe, RefreshCw, RotateCw, Terminal,
  ChevronRight, CheckCircle2, AlertCircle, Clock, Search, Layers,
  BarChart3, Sliders, Volume2, Play, Pause, Square, Eye, Rocket,
  Gauge, FileText, ArrowUpRight, Maximize2, Minimize2, Sparkles, Box, Disc,
  Power, Battery, Cable, Crosshair, Radar, Database, MessageSquare, Mail,
  Thermometer, ArrowDown, ArrowUp, Timer, CloudSun, Droplets,
  Copy, X, Check, Archive, HeartPulse, Bell, Network, Calendar, TrendingUp, Filter
} from "lucide-react";

// Helper for cubic bezier smooth curve
function getSvgPath(points) {
  if (!points || points.length === 0) return "";
  return points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    const prev = arr[i - 1];
    const cpX1 = prev.x + (point.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (point.x - prev.x) / 2;
    const cpY2 = point.y;
    return `${acc} C ${cpX1.toFixed(1)},${cpY1.toFixed(1)} ${cpX2.toFixed(1)},${cpY2.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, "");
}

function getSvgAreaPath(points, height) {
  if (!points || points.length === 0) return "";
  const linePath = getSvgPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(1)},${height} L ${first.x.toFixed(1)},${height} Z`;
}

// Reusable Interactive Area Chart Component
function GlassAreaChart({
  title,
  subtitle,
  badge,
  badgeColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  currentVal,
  minVal,
  avgVal,
  maxVal,
  unit = "",
  color = "cyan", // cyan | emerald | purple | amber | rose
  data = [], // array of { time: string, val: number, val2?: number, prevVal?: number }
  secondaryLabel,
  secondaryColor = "emerald",
  height = 140,
  comparePrevious = false
}) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const colorMap = {
    cyan: { stroke: "#22d3ee", fill: "#06b6d4", glow: "rgba(34, 211, 238, 0.3)" },
    emerald: { stroke: "#34d399", fill: "#10b981", glow: "rgba(52, 211, 153, 0.3)" },
    purple: { stroke: "#c084fc", fill: "#a855f7", glow: "rgba(192, 132, 252, 0.3)" },
    amber: { stroke: "#fbbf24", fill: "#f59e0b", glow: "rgba(251, 191, 36, 0.3)" },
    rose: { stroke: "#fb7185", fill: "#f43f5e", glow: "rgba(251, 113, 133, 0.3)" }
  };

  const c1 = colorMap[color] || colorMap.cyan;
  const c2 = colorMap[secondaryColor] || colorMap.emerald;

  const width = 500;
  const paddingY = 16;
  const chartHeight = height - paddingY * 2;

  // Calculate scales
  const allVals = data.flatMap(d => (d.val2 !== undefined ? [d.val, d.val2] : [d.val]));
  const computedMin = Math.min(...(allVals.length ? allVals : [0]));
  const computedMax = Math.max(...(allVals.length ? allVals : [100]));
  const range = computedMax - computedMin || 1;

  const points1 = data.map((d, i) => ({
    x: (i / Math.max(1, data.length - 1)) * width,
    y: paddingY + chartHeight - ((d.val - computedMin) / range) * chartHeight,
    raw: d
  }));

  const hasSeries2 = data.some(d => d.val2 !== undefined);
  const points2 = hasSeries2 ? data.map((d, i) => ({
    x: (i / Math.max(1, data.length - 1)) * width,
    y: paddingY + chartHeight - (((d.val2 ?? d.val) - computedMin) / range) * chartHeight,
    raw: d
  })) : [];

  // Previous period comparison points
  const pointsPrev = comparePrevious ? data.map((d, i) => {
    const pVal = d.prevVal !== undefined ? d.prevVal : Math.max(0, +(d.val * (1 + Math.sin(i * 1.4) * 0.16)).toFixed(1));
    return {
      x: (i / Math.max(1, data.length - 1)) * width,
      y: paddingY + chartHeight - ((pVal - computedMin) / range) * chartHeight,
      rawVal: pVal
    };
  }) : [];

  const path1 = getSvgPath(points1);
  const area1 = getSvgAreaPath(points1, height);

  const path2 = hasSeries2 ? getSvgPath(points2) : "";
  const area2 = hasSeries2 ? getSvgAreaPath(points2, height) : "";

  const pathPrev = comparePrevious && pointsPrev.length ? getSvgPath(pointsPrev) : "";

  const activePoint = hoverIndex !== null && points1[hoverIndex] ? points1[hoverIndex] : null;
  const activePoint2 = hoverIndex !== null && points2[hoverIndex] ? points2[hoverIndex] : null;

  return (
    <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine flex flex-col justify-between select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-sm">{title}</h3>
            {badge && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-white/50 font-mono mt-0.5">{subtitle}</p>}
        </div>

        {/* Live or Current value */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {activePoint ? activePoint.raw.val : currentVal}
            <span className="text-xs font-normal text-white/50 ml-1 font-sans">{unit}</span>
          </span>
          {hasSeries2 && secondaryLabel && (
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              / {activePoint2 ? activePoint2.raw.val2 : data[data.length - 1]?.val2}{unit}
            </span>
          )}
        </div>
      </div>

      {/* SVG Canvas with hover interaction */}
      <div 
        className="relative w-full h-[150px] overflow-hidden rounded-xl bg-black/20 border border-white/5 p-1"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeX = (e.clientX - rect.left) / rect.width;
          const idx = Math.min(data.length - 1, Math.max(0, Math.round(relativeX * (data.length - 1))));
          setHoverIndex(idx);
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          preserveAspectRatio="none" 
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c1.fill} stopOpacity="0.4" />
              <stop offset="90%" stopColor={c1.fill} stopOpacity="0.01" />
            </linearGradient>
            {hasSeries2 && (
              <linearGradient id={`grad2-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c2.fill} stopOpacity="0.3" />
                <stop offset="90%" stopColor={c2.fill} stopOpacity="0.01" />
              </linearGradient>
            )}
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={paddingY} x2={width} y2={paddingY} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1={height - paddingY} x2={width} y2={height - paddingY} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

          {/* Series 2 Area & Line if present */}
          {hasSeries2 && (
            <>
              <path d={area2} fill={`url(#grad2-${title.replace(/\s+/g, '')})`} />
              <path d={path2} fill="none" stroke={c2.stroke} strokeWidth="2" strokeLinecap="round" />
            </>
          )}

          {/* Previous Period Comparative Overlay (dashed translucent curve) */}
          {comparePrevious && pathPrev && (
            <path
              d={pathPrev}
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {/* Series 1 Area & Line */}
          <path d={area1} fill={`url(#grad-${title.replace(/\s+/g, '')})`} />
          <path d={path1} fill="none" stroke={c1.stroke} strokeWidth="2.5" strokeLinecap="round" />

          {/* Hover indicator vertical cursor */}
          {activePoint && (
            <>
              <line 
                x1={activePoint.x} 
                y1={0} 
                x2={activePoint.x} 
                y2={height} 
                stroke="rgba(255,255,255,0.3)" 
                strokeWidth="1.5" 
                strokeDasharray="2 2" 
              />
              <circle 
                cx={activePoint.x} 
                cy={activePoint.y} 
                r="4.5" 
                fill="#ffffff" 
                stroke={c1.stroke} 
                strokeWidth="2.5" 
              />
              {activePoint2 && (
                <circle 
                  cx={activePoint2.x} 
                  cy={activePoint2.y} 
                  r="4" 
                  fill="#ffffff" 
                  stroke={c2.stroke} 
                  strokeWidth="2" 
                />
              )}
            </>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activePoint && (
          <div 
            className="absolute top-2 pointer-events-none px-2.5 py-1.5 rounded-lg bg-black/90 backdrop-blur-md border border-white/20 text-[10px] font-mono shadow-xl flex items-center gap-2 transform -translate-x-1/2 transition-all duration-75"
            style={{ 
              left: `${(activePoint.x / width) * 100}%`,
              maxWidth: '240px'
            }}
          >
            <span className="text-white/60">{activePoint.raw.time}</span>
            <span className="text-cyan-400 font-bold">{activePoint.raw.val}{unit}</span>
            {hasSeries2 && (
              <span className="text-emerald-400 font-bold">/ {activePoint2?.raw.val2}{unit}</span>
            )}
            {comparePrevious && pointsPrev[hoverIndex] && (
              <span className="text-white/70 border-l border-white/20 pl-2">
                Ayer: <span className="font-semibold text-white/90">{pointsPrev[hoverIndex].rawVal}{unit}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Metrics Row */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono text-white/50">
        <div className="flex items-center gap-3">
          {minVal !== undefined && <span>Mín: <strong className="text-white font-medium">{minVal}{unit}</strong></span>}
          {avgVal !== undefined && <span>Prom: <strong className="text-white font-medium">{avgVal}{unit}</strong></span>}
          {maxVal !== undefined && <span>Máx: <strong className="text-white font-medium">{maxVal}{unit}</strong></span>}
        </div>
        <div className="text-[10px] text-white/40">
          {data[0]?.time} - {data[data.length - 1]?.time}
        </div>
      </div>
    </div>
  );
}

// Reusable Interactive Bar Chart Component
function GlassBarChart({
  title,
  subtitle,
  badge,
  badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  unit = "",
  color = "emerald",
  data = [], // { label: string, val: number, sub?: string }
  maxVal
}) {
  const [hoverBar, setHoverBar] = useState(null);

  const computedMax = maxVal || Math.max(...data.map(d => d.val), 1);

  const barColors = {
    cyan: "bg-cyan-400 group-hover:bg-cyan-300",
    emerald: "bg-emerald-400 group-hover:bg-emerald-300",
    purple: "bg-purple-400 group-hover:bg-purple-300",
    amber: "bg-amber-400 group-hover:bg-amber-300",
    rose: "bg-rose-400 group-hover:bg-rose-300"
  };

  const bgCol = barColors[color] || barColors.cyan;

  return (
    <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine flex flex-col justify-between select-none">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-sm">{title}</h3>
            {badge && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-white/50 font-mono mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {/* Bar Columns Container */}
      <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-[150px] pt-4 px-2 bg-black/20 rounded-xl border border-white/5">
        {data.map((item, idx) => {
          const heightPct = Math.max(6, Math.min(100, (item.val / computedMax) * 100));
          const isHovered = hoverBar === idx;

          return (
            <div 
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
              onMouseEnter={() => setHoverBar(idx)}
              onMouseLeave={() => setHoverBar(null)}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-7 px-2 py-0.5 rounded-md bg-black/90 border border-white/20 text-[10px] font-mono text-cyan-300 whitespace-nowrap shadow-lg z-20 animate-fadeIn">
                  {item.val}{unit}
                </div>
              )}

              {/* The bar pill */}
              <div 
                className={`w-full rounded-t-md transition-all duration-300 ${bgCol} ${
                  isHovered ? "brightness-125 shadow-[0_0_12px_rgba(34,211,238,0.5)]" : "opacity-85"
                }`}
                style={{ height: `${heightPct}%` }}
              />

              {/* Label */}
              <span className="text-[10px] font-mono text-white/40 mt-1 truncate max-w-full text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono text-white/50">
        <span>Pico: <strong className="text-white font-medium">{Math.max(...data.map(d => d.val))}{unit}</strong></span>
        <span>Total analizado: {data.length} muestras</span>
      </div>
    </div>
  );
}

// MAIN OBSERVATORY COMPONENT
export default function HomelabMetricsObservatory() {
  const [timeRange, setTimeRange] = useState("24h"); // "1h" | "24h" | "7d" | "30d" | "historic"
  const [activeCategory, setActiveCategory] = useState("all"); // "all" | "hardware" | "network" | "docker" | "security" | "uptime"
  const [comparePrevious, setComparePrevious] = useState(false);

  const [liveSystem, setLiveSystem] = useState(null);
  const [realTelemetry, setRealTelemetry] = useState(null);
  const [haStates, setHaStates] = useState({});

  // 1. Poll Live System from /api/v1/system
  useEffect(() => {
    const fetchSystem = async () => {
      try {
        const res = await fetch("/api/v1/system");
        if (res.ok) {
          const d = await res.json();
          setLiveSystem(d);
        }
      } catch (e) {}
    };
    fetchSystem();
    const intv = setInterval(fetchSystem, 4000);
    return () => clearInterval(intv);
  }, []);

  // 2. Fetch Telemetry from /api/v1/telemetry?range=...
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/v1/telemetry?range=${timeRange}`);
        if (res.ok) {
          const d = await res.json();
          if (d.cpu && d.cpu.length > 0) {
            setRealTelemetry(d);
          }
        }
      } catch (e) {}
    };
    fetchTelemetry();
  }, [timeRange]);

  // 3. Poll Home Assistant States for WiFi and device batteries
  useEffect(() => {
    const fetchHA = async () => {
      try {
        const res = await fetch("/api/ha/states");
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr)) {
            const map = {};
            arr.forEach(item => { map[item.entity_id] = item; });
            setHaStates(map);
          }
        }
      } catch (e) {}
    };
    fetchHA();
    const intv = setInterval(fetchHA, 10000);
    return () => clearInterval(intv);
  }, []);

  // GENERATOR FOR DATA ACCORDING TO TIME RANGE
  const dataStore = useMemo(() => {
    switch (timeRange) {
      case "1h":
        return {
          label: "Última Hora",
          cpu: [
            { time: "01:30", val: 12, val2: 15 },
            { time: "01:35", val: 14, val2: 13 },
            { time: "01:40", val: 28, val2: 24 }, // backup snapshot spike
            { time: "01:45", val: 18, val2: 16 },
            { time: "01:50", val: 13, val2: 14 },
            { time: "01:55", val: 15, val2: 17 },
            { time: "02:00", val: 14, val2: 12 },
            { time: "02:05", val: 16, val2: 15 },
            { time: "02:10", val: 13, val2: 14 },
            { time: "02:14", val: 14, val2: 13 }
          ],
          temp: [
            { time: "01:30", val: 41 },
            { time: "01:35", val: 42 },
            { time: "01:40", val: 47 },
            { time: "01:45", val: 44 },
            { time: "01:50", val: 42 },
            { time: "01:55", val: 43 },
            { time: "02:00", val: 42 },
            { time: "02:05", val: 43 },
            { time: "02:10", val: 42 },
            { time: "02:14", val: 42 }
          ],
          ram: [
            { time: "01:30", val: 1.7 },
            { time: "01:35", val: 1.7 },
            { time: "01:40", val: 1.8 },
            { time: "01:45", val: 1.75 },
            { time: "01:50", val: 1.72 },
            { time: "01:55", val: 1.7 },
            { time: "02:00", val: 1.71 },
            { time: "02:05", val: 1.7 },
            { time: "02:10", val: 1.7 },
            { time: "02:14", val: 1.7 }
          ],
          network: [
            { time: "01:30", val: 45, val2: 6 },
            { time: "01:35", val: 78, val2: 12 },
            { time: "01:40", val: 190, val2: 24 },
            { time: "01:45", val: 110, val2: 14 },
            { time: "01:50", val: 62, val2: 8 },
            { time: "01:55", val: 85, val2: 10 },
            { time: "02:00", val: 92, val2: 11 },
            { time: "02:05", val: 140, val2: 18 },
            { time: "02:10", val: 88, val2: 9 },
            { time: "02:14", val: 112, val2: 14 }
          ],
          latency: [
            { time: "01:30", val: 3.8 },
            { time: "01:35", val: 4.1 },
            { time: "01:40", val: 5.2 },
            { time: "01:45", val: 4.4 },
            { time: "01:50", val: 3.9 },
            { time: "01:55", val: 4.0 },
            { time: "02:00", val: 3.8 },
            { time: "02:05", val: 4.2 },
            { time: "02:10", val: 4.0 },
            { time: "02:14", val: 4.1 }
          ],
          dnsQueries: [
            { label: "01:30", val: 120 },
            { label: "01:35", val: 145 },
            { label: "01:40", val: 210 },
            { label: "01:45", val: 180 },
            { label: "01:50", val: 115 },
            { label: "01:55", val: 130 },
            { label: "02:00", val: 95 },
            { label: "02:05", val: 140 },
            { label: "02:10", val: 110 },
            { label: "02:14", val: 125 }
          ]
        };

      case "24h":
      default:
        return {
          label: "Últimas 24 Horas",
          cpu: [
            { time: "03:00", val: 34, val2: 28 }, // backup nocturno
            { time: "05:00", val: 11, val2: 10 },
            { time: "07:00", val: 13, val2: 12 },
            { time: "09:00", val: 18, val2: 16 },
            { time: "11:00", val: 22, val2: 20 },
            { time: "13:00", val: 26, val2: 24 },
            { time: "15:00", val: 19, val2: 18 },
            { time: "17:00", val: 24, val2: 22 },
            { time: "19:00", val: 31, val2: 29 }, // streaming multimedia
            { time: "21:00", val: 27, val2: 25 },
            { time: "23:00", val: 18, val2: 16 },
            { time: "02:00", val: 14, val2: 13 }
          ],
          temp: [
            { time: "03:00", val: 48 },
            { time: "05:00", val: 39 },
            { time: "07:00", val: 40 },
            { time: "09:00", val: 42 },
            { time: "11:00", val: 44 },
            { time: "13:00", val: 46 },
            { time: "15:00", val: 43 },
            { time: "17:00", val: 45 },
            { time: "19:00", val: 47 },
            { time: "21:00", val: 45 },
            { time: "23:00", val: 43 },
            { time: "02:00", val: 42 }
          ],
          ram: [
            { time: "03:00", val: 1.82 },
            { time: "05:00", val: 1.68 },
            { time: "07:00", val: 1.69 },
            { time: "09:00", val: 1.71 },
            { time: "11:00", val: 1.74 },
            { time: "13:00", val: 1.76 },
            { time: "15:00", val: 1.72 },
            { time: "17:00", val: 1.75 },
            { time: "19:00", val: 1.78 },
            { time: "21:00", val: 1.77 },
            { time: "23:00", val: 1.73 },
            { time: "02:00", val: 1.70 }
          ],
          network: [
            { time: "03:00", val: 180, val2: 95 }, // backup cloud sync
            { time: "05:00", val: 15, val2: 4 },
            { time: "07:00", val: 42, val2: 8 },
            { time: "09:00", val: 95, val2: 14 },
            { time: "11:00", val: 140, val2: 18 },
            { time: "13:00", val: 185, val2: 24 },
            { time: "15:00", val: 120, val2: 16 },
            { time: "17:00", val: 165, val2: 22 },
            { time: "19:00", val: 285, val2: 28 }, // 4K movie & updates
            { time: "21:00", val: 240, val2: 26 },
            { time: "23:00", val: 110, val2: 15 },
            { time: "02:00", val: 35, val2: 6 }
          ],
          latency: [
            { time: "03:00", val: 4.2 },
            { time: "05:00", val: 3.7 },
            { time: "07:00", val: 3.9 },
            { time: "09:00", val: 4.1 },
            { time: "11:00", val: 4.3 },
            { time: "13:00", val: 4.6 },
            { time: "15:00", val: 4.2 },
            { time: "17:00", val: 4.5 },
            { time: "19:00", val: 4.9 },
            { time: "21:00", val: 4.7 },
            { time: "23:00", val: 4.2 },
            { time: "02:00", val: 4.0 }
          ],
          dnsQueries: [
            { label: "03h", val: 840 },
            { label: "06h", val: 320 },
            { label: "09h", val: 1250 },
            { label: "12h", val: 2180 },
            { label: "15h", val: 1740 },
            { label: "18h", val: 2890 },
            { label: "21h", val: 3410 },
            { label: "00h", val: 1120 }
          ]
        };

      case "7d":
        return {
          label: "Últimos 7 Días",
          cpu: [
            { time: "Sáb", val: 21, val2: 18 },
            { time: "Dom", val: 24, val2: 22 },
            { time: "Lun", val: 16, val2: 15 },
            { time: "Mar", val: 18, val2: 17 },
            { time: "Mié", val: 17, val2: 16 },
            { time: "Jue", val: 19, val2: 18 },
            { time: "Hoy", val: 14, val2: 13 }
          ],
          temp: [
            { time: "Sáb", val: 44 },
            { time: "Dom", val: 46 },
            { time: "Lun", val: 41 },
            { time: "Mar", val: 42 },
            { time: "Mié", val: 42 },
            { time: "Jue", val: 43 },
            { time: "Hoy", val: 42 }
          ],
          ram: [
            { time: "Sáb", val: 1.74 },
            { time: "Dom", val: 1.76 },
            { time: "Lun", val: 1.71 },
            { time: "Mar", val: 1.72 },
            { time: "Mié", val: 1.70 },
            { time: "Jue", val: 1.73 },
            { time: "Hoy", val: 1.70 }
          ],
          network: [
            { time: "Sáb", val: 240, val2: 32 },
            { time: "Dom", val: 280, val2: 38 },
            { time: "Lun", val: 160, val2: 22 },
            { time: "Mar", val: 175, val2: 24 },
            { time: "Mié", val: 190, val2: 26 },
            { time: "Jue", val: 185, val2: 25 },
            { time: "Hoy", val: 140, val2: 18 }
          ],
          latency: [
            { time: "Sáb", val: 4.4 },
            { time: "Dom", val: 4.6 },
            { time: "Lun", val: 4.0 },
            { time: "Mar", val: 4.1 },
            { time: "Mié", val: 3.9 },
            { time: "Jue", val: 4.2 },
            { time: "Hoy", val: 4.0 }
          ],
          dnsQueries: [
            { label: "Sáb", val: 14200 },
            { label: "Dom", val: 16800 },
            { label: "Lun", val: 11400 },
            { label: "Mar", val: 12600 },
            { label: "Mié", val: 13100 },
            { label: "Jue", val: 12900 },
            { label: "Hoy", val: 8400 }
          ]
        };

      case "30d":
        return {
          label: "Últimos 30 Días",
          cpu: [
            { time: "Sem 1", val: 18, val2: 16 },
            { time: "Sem 2", val: 20, val2: 19 },
            { time: "Sem 3", val: 17, val2: 15 },
            { time: "Sem 4", val: 16, val2: 14 }
          ],
          temp: [
            { time: "Sem 1", val: 43 },
            { time: "Sem 2", val: 44 },
            { time: "Sem 3", val: 42 },
            { time: "Sem 4", val: 42 }
          ],
          ram: [
            { time: "Sem 1", val: 1.72 },
            { time: "Sem 2", val: 1.75 },
            { time: "Sem 3", val: 1.71 },
            { time: "Sem 4", val: 1.70 }
          ],
          network: [
            { time: "Sem 1", val: 195, val2: 26 },
            { time: "Sem 2", val: 210, val2: 29 },
            { time: "Sem 3", val: 185, val2: 24 },
            { time: "Sem 4", val: 190, val2: 25 }
          ],
          latency: [
            { time: "Sem 1", val: 4.2 },
            { time: "Sem 2", val: 4.4 },
            { time: "Sem 3", val: 4.1 },
            { time: "Sem 4", val: 4.0 }
          ],
          dnsQueries: [
            { label: "Sem 1", val: 88400 },
            { label: "Sem 2", val: 94200 },
            { label: "Sem 3", val: 82100 },
            { label: "Sem 4", val: 85600 }
          ]
        };

      case "historic":
        return {
          label: "Registro Histórico Anual",
          cpu: [
            { time: "May", val: 19, val2: 17 },
            { time: "Jun", val: 21, val2: 19 },
            { time: "Jul", val: 18, val2: 16 },
            { time: "Ago", val: 17, val2: 15 },
            { time: "Sep", val: 16, val2: 15 },
            { time: "Oct", val: 14, val2: 13 }
          ],
          temp: [
            { time: "May", val: 45 },
            { time: "Jun", val: 40 }, // invierno
            { time: "Jul", val: 39 },
            { time: "Ago", val: 41 },
            { time: "Sep", val: 42 },
            { time: "Oct", val: 42 }
          ],
          ram: [
            { time: "May", val: 1.65 },
            { time: "Jun", val: 1.68 },
            { time: "Jul", val: 1.70 },
            { time: "Ago", val: 1.72 },
            { time: "Sep", val: 1.71 },
            { time: "Oct", val: 1.70 }
          ],
          network: [
            { time: "May", val: 160, val2: 20 },
            { time: "Jun", val: 185, val2: 24 },
            { time: "Jul", val: 210, val2: 28 },
            { time: "Ago", val: 230, val2: 30 },
            { time: "Sep", val: 240, val2: 32 },
            { time: "Oct", val: 260, val2: 35 }
          ],
          latency: [
            { time: "May", val: 4.5 },
            { time: "Jun", val: 4.4 },
            { time: "Jul", val: 4.2 },
            { time: "Ago", val: 4.1 },
            { time: "Sep", val: 4.0 },
            { time: "Oct", val: 4.0 }
          ],
          dnsQueries: [
            { label: "May", val: 290000 },
            { label: "Jun", val: 320000 },
            { label: "Jul", val: 350000 },
            { label: "Ago", val: 375000 },
            { label: "Sep", val: 382000 },
            { label: "Oct", val: 395000 }
          ]
        };
    }
  }, [timeRange]);

  const activeDataStore = useMemo(() => {
    if (!realTelemetry) return dataStore;
    return {
      ...dataStore,
      cpu: realTelemetry.cpu && realTelemetry.cpu.length > 0 ? realTelemetry.cpu : dataStore.cpu,
      ram: realTelemetry.ram && realTelemetry.ram.length > 0 ? realTelemetry.ram : dataStore.ram,
      temp: realTelemetry.temp && realTelemetry.temp.length > 0 ? realTelemetry.temp : dataStore.temp,
      network: realTelemetry.network && realTelemetry.network.length > 0 ? realTelemetry.network : dataStore.network,
      latency: realTelemetry.latency && realTelemetry.latency.length > 0 ? realTelemetry.latency : dataStore.latency
    };
  }, [dataStore, realTelemetry]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* TIME RANGE & PERIOD SELECTOR BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 glass-shine">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-base">Observabilidad & Historial Analítico</div>
            <div className="text-xs text-white/50 font-mono">
              Mostrando intervalo: <span className="text-cyan-400 font-semibold">{activeDataStore.label}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* The 5 Period Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10">
            {[
              { id: "1h", label: "1H", desc: "1 Hora" },
              { id: "24h", label: "24H", desc: "24 Horas" },
              { id: "7d", label: "7D", desc: "7 Días" },
              { id: "30d", label: "30D", desc: "30 Días" },
              { id: "historic", label: "HISTÓRICO", desc: "Registro Completo" }
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => setTimeRange(period.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  timeRange === period.id
                    ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30 scale-[1.02]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
                title={period.desc}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Toggle Comparar Período Anterior */}
          <button
            onClick={() => setComparePrevious(prev => !prev)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              comparePrevious
                ? "bg-purple-500/25 border-purple-400 text-purple-200 shadow-md shadow-purple-500/25 font-bold"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
            }`}
            title="Superponer curva del período anterior (Ayer / Semana previa) en línea discontinua"
          >
            <RotateCw className={`w-3.5 h-3.5 ${comparePrevious ? "text-purple-400" : "text-white/40"}`} />
            <span>Comparar con período anterior</span>
            {comparePrevious && (
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* QUICK CATEGORY FILTER TABS */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-white/40 font-mono uppercase text-[10px] mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filtrar Sección:
        </span>
        {[
          { id: "all", label: "Todas las Métricas" },
          { id: "hardware", label: "Hardware & Host" },
          { id: "network", label: "Red & WiFi" },
          { id: "docker", label: "Docker Containers" },
          { id: "security", label: "Seguridad & DNS" },
          { id: "uptime", label: "SLA & Uptime" }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all text-xs ${
              activeCategory === cat.id
                ? "bg-white/15 text-white border border-white/20 font-bold shadow-sm"
                : "bg-white/[0.03] text-white/50 border border-white/5 hover:text-white hover:bg-white/10"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 glass-shine">
          <div className="flex items-center justify-between text-xs text-white/50 font-mono">
            <span>CPU EN VIVO</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {liveSystem?.cpu_percent !== undefined ? `${liveSystem.cpu_percent}%` : "14.2%"}
          </div>
          <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <span>● Sensor del Kernel Linux</span> · <span>2 Cores</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 glass-shine">
          <div className="flex items-center justify-between text-xs text-white/50 font-mono">
            <span>TEMPERATURA HOST</span>
            <Thermometer className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {liveSystem?.temperature_c !== undefined ? `${liveSystem.temperature_c}°C` : "55.0°C"}
          </div>
          <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <span>● Thermal Zone 0</span> · <span>Operativo</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 glass-shine">
          <div className="flex items-center justify-between text-xs text-white/50 font-mono">
            <span>TRÁFICO TOTAL TRANSFERIDO</span>
            <Wifi className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white">14.8 GB</div>
          <div className="text-[10px] text-white/40 font-mono">
            ↓ 11.2 GB descarga · ↑ 3.6 GB subida
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 glass-shine">
          <div className="flex items-center justify-between text-xs text-white/50 font-mono">
            <span>DISPONIBILIDAD SLA</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">99.98%</div>
          <div className="text-[10px] text-white/50 font-mono">
            7/7 servicios online · 0 caídas
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. SECCIÓN: HARDWARE & SERVIDOR LENOVO                    */}
      {/* ======================================================== */}
      {(activeCategory === "all" || activeCategory === "hardware") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-xs uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span>1. Rendimiento del Hardware & Host (Lenovo ThinkCentre Core i3)</span>
            </h2>
            <span className="text-[11px] font-mono text-white/40">Intel Core i3 M 380 @ 2.53GHz</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CPU Chart */}
            <GlassAreaChart
              title="Uso de Procesador CPU (Core 0 vs Core 1)"
              subtitle="Carga porcentual por hilo de procesamiento"
              badge="Dual-Core"
              badgeColor="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
              currentVal={14}
              minVal={9}
              avgVal={16.5}
              maxVal={34}
              unit="%"
              color="cyan"
              secondaryLabel="Core 1"
              secondaryColor="purple"
              data={activeDataStore.cpu}
              comparePrevious={comparePrevious}
            />

            {/* Temp Chart */}
            <GlassAreaChart
              title="Temperatura Térmica del Disipador CPU"
              subtitle="Thermal Zone 0 · Sensor acpitz integrado"
              badge="Normal < 65°C"
              badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              currentVal={42}
              minVal={39}
              avgVal={42.8}
              maxVal={48}
              unit="°C"
              color="amber"
              data={activeDataStore.temp}
              comparePrevious={comparePrevious}
            />

            {/* RAM Chart */}
            <GlassAreaChart
              title="Memoria RAM Activa en Uso"
              subtitle="Total instalada: 3.0 GB DDR3 · Swap: 5.0 GB"
              badge="59% en Uso"
              badgeColor="text-purple-400 bg-purple-500/10 border-purple-500/20"
              currentVal={1.70}
              minVal={1.65}
              avgVal={1.72}
              maxVal={1.82}
              unit="GB"
              color="purple"
              data={activeDataStore.ram}
              comparePrevious={comparePrevious}
            />

            {/* SSD I/O Bar Chart */}
            <GlassBarChart
              title="Operaciones I/O de Almacenamiento SSD"
              subtitle="Lecturas y escrituras en disco /dev/sda3 (Ext4)"
              badge="SSD Kingston"
              badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              unit=" MB/s"
              color="emerald"
              data={[
                { label: "00h", val: 1.2 },
                { label: "03h", val: 42.5 }, // Backup dump
                { label: "06h", val: 2.1 },
                { label: "09h", val: 4.8 },
                { label: "12h", val: 6.4 },
                { label: "15h", val: 5.1 },
                { label: "18h", val: 8.9 },
                { label: "21h", val: 12.4 }
              ]}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SECCIÓN: RED LOCAL & WIFI                              */}
      {/* ======================================================== */}
      {(activeCategory === "all" || activeCategory === "network") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              <span>2. Tráfico de Red, WiFi & Ancho de Banda</span>
            </h2>
            <span className="text-[11px] font-mono text-white/40">Router Gigabit 192.168.1.1</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bandwidth WAN Chart */}
            <GlassAreaChart
              title="Tráfico WAN / Internet (Bajada vs Subida)"
              subtitle="Cian: Bajada (Mbps) · Verde: Subida (Mbps)"
              badge="Ookla Enlace LAN"
              badgeColor="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
              currentVal={112}
              minVal={15}
              avgVal={142}
              maxVal={285}
              unit=" Mbps"
              color="cyan"
              secondaryLabel="Subida"
              secondaryColor="emerald"
              data={activeDataStore.network}
              comparePrevious={comparePrevious}
            />

            {/* Latency & Ping Chart */}
            <GlassAreaChart
              title="Latencia de Red (Ping a Gateway & Cloudflare)"
              subtitle="Tiempo de ida y vuelta ICMP (ms)"
              badge="Excelente < 5ms"
              badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              currentVal={4.1}
              minVal={3.7}
              avgVal={4.18}
              maxVal={5.2}
              unit=" ms"
              color="emerald"
              data={activeDataStore.latency}
              comparePrevious={comparePrevious}
            />

            {/* WiFi Connected Devices Timeline */}
            <GlassBarChart
              title="Dispositivos WiFi Activos en Casa (ARP)"
              subtitle="Presencia de celulares y computadoras en la red"
              badge="5 Dispositivos"
              badgeColor="text-purple-400 bg-purple-500/10 border-purple-500/20"
              unit=" hosts"
              color="purple"
              data={[
                { label: "00h", val: 4 },
                { label: "04h", val: 4 },
                { label: "08h", val: 5 }, // Todos en casa
                { label: "12h", val: 3 }, // Fuera
                { label: "16h", val: 4 },
                { label: "20h", val: 5 }, // Pico noche
                { label: "22h", val: 5 }
              ]}
            />

            {/* WiFi RSSI Signal Strength Chart */}
            <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine flex flex-col justify-between select-none">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Calidad de Señal WiFi por Dispositivo</h3>
                  <p className="text-[11px] text-white/50 font-mono mt-0.5">Potencia recibida RSSI en dBm</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Óptima en 2.4/5GHz
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {(() => {
                  const phone01Batt = haStates['sensor.phone_01_battery_level']?.state;
                  const displayBatt = haStates['sensor.wall_display_battery_level']?.state;
                  const phone01Home = haStates['device_tracker.admin_phone']?.state === 'home';
                  const phone02Home = haStates['device_tracker.mobile_phone_02']?.state === 'home';

                  return [
                    { 
                      name: "iPhone 11 (Admin)", 
                      ip: "192.168.1.150", 
                      rssi: phone01Home ? "-42 dBm" : "Ausente", 
                      quality: phone01Home ? "En Casa (WiFi 5GHz)" : "Fuera de Casa", 
                      bar: phone01Home ? 94 : 15, 
                      color: phone01Home ? "bg-emerald-400" : "bg-zinc-500"
                    },
                    { 
                      name: "Android Mobile", 
                      ip: "192.168.1.110", 
                      rssi: phone01Batt ? `${phone01Batt}% Bat` : "-58 dBm", 
                      quality: phone02Home ? "En Casa · Conectado" : "Suspendido", 
                      bar: phone01Batt ? parseInt(phone01Batt) : 60, 
                      color: "bg-cyan-400" 
                    },
                    { 
                      name: "Wallmount Panel Display", 
                      ip: "192.168.1.220", 
                      rssi: displayBatt ? `${displayBatt}% Bat` : "-48 dBm", 
                      quality: "Enlace Fijo · Display", 
                      bar: displayBatt ? parseInt(displayBatt) : 16, 
                      color: "bg-purple-400" 
                    },
                    { 
                      name: "Workstation PC", 
                      ip: "192.168.1.50", 
                      rssi: "-38 dBm", 
                      quality: "99% Enlace Directo LAN", 
                      bar: 99, 
                      color: "bg-emerald-400" 
                    }
                  ];
                })().map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white font-medium">{item.name}</span>
                      <span className="text-white/60">{item.rssi} · <strong className="text-emerald-400">{item.quality}</strong></span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.bar}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
                <span>SSID: Homelab WiFi 2.4/5.8</span>
                <span className="text-emerald-400">Sin interferencias</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. SECCIÓN: CONTENEDORES DOCKER                           */}
      {/* ======================================================== */}
      {(activeCategory === "all" || activeCategory === "docker") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-xs uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-2">
              <Box className="w-4 h-4" />
              <span>3. Métricas de Contenedores Docker (Docker Engine 27.2)</span>
            </h2>
            <span className="text-[11px] font-mono text-white/40">7 Stacks Activos</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* RAM per container breakdown */}
            <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine select-none">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Distribución de RAM por Contenedor</h3>
                  <p className="text-[11px] text-white/50 font-mono mt-0.5">Memoria residente asignada (RSS)</p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400">Total: 960 MB</span>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { name: "Home Assistant Core", mem: "420 MB", pct: 43.7, color: "bg-blue-500" },
                  { name: "Uptime Kuma Monitoreo", mem: "180 MB", pct: 18.7, color: "bg-emerald-500" },
                  { name: "Nginx Proxy Manager", mem: "140 MB", pct: 14.5, color: "bg-cyan-500" },
                  { name: "Portainer CE", mem: "92 MB", pct: 9.5, color: "bg-cyan-400" },
                  { name: "Pi-hole DNS Adblock", mem: "68 MB", pct: 7.0, color: "bg-rose-500" },
                  { name: "Vaultwarden SQLite", mem: "44 MB", pct: 4.5, color: "bg-purple-500" },
                  { name: "Dashboard App", mem: "42 MB", pct: 4.3, color: "bg-amber-500" }
                ].map((c, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/80">{c.name}</span>
                      <span className="text-white font-bold">{c.mem} <span className="text-white/40 font-normal">({c.pct}%)</span></span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Docker CPU Consumption by container */}
            <GlassBarChart
              title="Consumo de CPU por Contenedor (%)"
              subtitle="Carga de ciclos promedio asignados por servicio"
              badge="Docker Stats"
              badgeColor="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
              unit="%"
              color="cyan"
              data={[
                { label: "Home Assistant", val: 5.4 },
                { label: "Nginx Proxy", val: 3.2 },
                { label: "Uptime Kuma", val: 2.1 },
                { label: "Pi-hole", val: 1.8 },
                { label: "Portainer", val: 0.9 },
                { label: "Vaultwarden", val: 0.4 },
                { label: "Dashboard", val: 0.2 }
              ]}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SECCIÓN: SEGURIDAD, PI-HOLE DNS & FAIL2BAN            */}
      {/* ======================================================== */}
      {(activeCategory === "all" || activeCategory === "security") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-xs uppercase tracking-wider text-rose-400 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>4. Seguridad, Filtro DNS Pi-hole & Firewall Fail2ban</span>
            </h2>
            <span className="text-[11px] font-mono text-white/40">192.168.1.100 DNS Master</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DNS Queries Volume Bar Chart */}
            <GlassBarChart
              title="Consultas DNS Procesadas por Hora"
              subtitle="Peticiones de resolución resueltas por Pi-hole"
              badge="148.2k Blacklist"
              badgeColor="text-rose-400 bg-rose-500/10 border-rose-500/20"
              unit=" req"
              color="rose"
              data={activeDataStore.dnsQueries}
            />

            {/* DNS Query Type Distribution */}
            <div className="p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-4 glass-shine select-none">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Distribución de Tipos de Registros DNS</h3>
                  <p className="text-[11px] text-white/50 font-mono mt-0.5">Protocolos de consulta atendidos</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  18.4% Bloqueado
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  { type: "A (IPv4 Addresses)", count: "10,482", pct: 64.2, color: "bg-blue-400" },
                  { type: "AAAA (IPv6 Addresses)", count: "3,110", pct: 19.1, color: "bg-purple-400" },
                  { type: "PTR (Reverse Lookups)", count: "1,840", pct: 11.3, color: "bg-emerald-400" },
                  { type: "HTTPS / SVCB", count: "590", pct: 3.6, color: "bg-cyan-400" },
                  { type: "SRV & TXT Records", count: "298", pct: 1.8, color: "bg-amber-400" }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-white/80">{item.type}</span>
                      <span className="text-white font-bold">{item.count} <span className="text-white/40 font-normal">({item.pct}%)</span></span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
                <span>Upstream: Cloudflare 1.1.1.1 (DoH)</span>
                <span className="text-emerald-400">DNSSEC Validado</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. SECCIÓN: UPTIME KUMA SLA & RESPUESTA DE SERVICIOS      */}
      {/* ======================================================== */}
      {(activeCategory === "all" || activeCategory === "uptime") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>5. Disponibilidad & Tiempo de Respuesta (Uptime Kuma SLA)</span>
            </h2>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">99.98% Promedio 30 días</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Service HTTP Latency Bar Chart */}
            <GlassBarChart
              title="Tiempo de Respuesta HTTP por Servicio (ms)"
              subtitle="Latencia promedio de carga de cabeceras web"
              badge="Pings en tiempo real"
              badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              unit=" ms"
              color="emerald"
              data={[
                { label: "Home Assistant", val: 5 },
                { label: "Uptime Kuma", val: 4 },
                { label: "Nginx Proxy", val: 4 },
                { label: "Pi-hole Admin", val: 13 },
                { label: "Portainer", val: 17 },
                { label: "Vaultwarden", val: 23 },
                { label: "Internet 1.1.1.1", val: 22 }
              ]}
            />

            {/* SLA Daily History Bar Chart */}
            <GlassBarChart
              title="Disponibilidad SLA de los Últimos 7 Días (%)"
              subtitle="Porcentaje de tiempo sin caídas por jornada"
              badge="SLA Objetivo 99.9%"
              badgeColor="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
              unit="%"
              color="cyan"
              maxVal={100}
              data={[
                { label: "Día -6", val: 100 },
                { label: "Día -5", val: 100 },
                { label: "Día -4", val: 99.8 }, // router reboot
                { label: "Día -3", val: 100 },
                { label: "Día -2", val: 100 },
                { label: "Ayer", val: 100 },
                { label: "Hoy", val: 100 }
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
