import React, { useState, useRef, useEffect } from "react";
import {
  RotateCw, Trash2, Shield, RefreshCw, Archive, Check,
  AlertCircle, Sparkles, CheckCircle2, Server, Box,
  Clock, Layers, Activity, Terminal
} from "lucide-react";

export default function DevOpsConsole() {
  const [quickActionState, setQuickActionState] = useState({});
  const [actionLogs, setActionLogs] = useState([
    {
      id: 1,
      time: new Date().toLocaleTimeString(),
      label: "Servidor Iniciado",
      status: "success",
      output: "Sistema listo. Endpoints de control conectados a /api/v1/actions/."
    }
  ]);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [actionLogs]);

  // Execute Real Maintenance Action via API
  const runRealAction = async (actionKey, endpoint, label) => {
    setQuickActionState(prev => ({ ...prev, [actionKey]: "running" }));
    const startTime = Date.now();

    try {
      const res = await fetch(`/api/v1/actions/${endpoint}`, { method: "POST" });
      const data = await res.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (res.ok && data.status === "ok") {
        setQuickActionState(prev => ({ ...prev, [actionKey]: "success" }));
        setActionLogs(prev => [
          ...prev,
          {
            id: Date.now(),
            time: data.timestamp || new Date().toLocaleTimeString(),
            label: label,
            status: "success",
            duration: `${duration}s`,
            output: data.output || "Operación ejecutada con éxito."
          }
        ]);
      } else {
        throw new Error(data.message || "Error al ejecutar acción");
      }
    } catch (err) {
      setQuickActionState(prev => ({ ...prev, [actionKey]: "error" }));
      setActionLogs(prev => [
        ...prev,
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          label: label,
          status: "error",
          output: `Error de conexión: ${err.message}`
        }
      ]);
    } finally {
      setTimeout(() => {
        setQuickActionState(prev => ({ ...prev, [actionKey]: null }));
      }, 4000);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. SECCIÓN DE ACCIONES RÁPIDAS CON 1 CLIC (REALES) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-2 gap-2">
          <div>
            <h2 className="text-xs uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Acciones Rápidas de Mantenimiento con 1 Clic</span>
            </h2>
            <p className="text-[11px] text-white/50 font-mono mt-0.5">
              Ejecución directa en el servidor Ubuntu mediante micro-backend (/api/v1/actions)
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Backend Activo :8088
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* ACTION 1: LIMPIAR DOCKER */}
          <div className="p-4 rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-3 glass-shine flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                docker prune
              </span>
            </div>
            <div>
              <div className="font-bold text-white text-sm">Limpiar Docker</div>
              <p className="text-[11px] text-white/50 font-mono mt-0.5">
                Ejecuta prune real de capas e imágenes huérfanas en el SSD
              </p>
            </div>
            <button
              onClick={() => runRealAction("dockerPrune", "docker-prune", "Limpieza de Capas Docker (Prune)")}
              disabled={quickActionState.dockerPrune === "running"}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                quickActionState.dockerPrune === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : quickActionState.dockerPrune === "running"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-cyan-500/40"
              }`}
            >
              {quickActionState.dockerPrune === "running" && <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
              {quickActionState.dockerPrune === "success" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              <span>
                {quickActionState.dockerPrune === "running" ? "Limpiando..." : quickActionState.dockerPrune === "success" ? "¡Prune Exitoso!" : "Ejecutar Prune"}
              </span>
            </button>
          </div>

          {/* ACTION 2: VACIAR CACHÉ DNS */}
          <div className="p-4 rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-3 glass-shine flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                flush dns
              </span>
            </div>
            <div>
              <div className="font-bold text-white text-sm">Vaciar Caché DNS</div>
              <p className="text-[11px] text-white/50 font-mono mt-0.5">
                Purga la memoria RAM del resolver DNS y recarga listas
              </p>
            </div>
            <button
              onClick={() => runRealAction("dnsFlush", "flush-dns", "Purga de Memoria DNS")}
              disabled={quickActionState.dnsFlush === "running"}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                quickActionState.dnsFlush === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : quickActionState.dnsFlush === "running"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-rose-500/40"
              }`}
            >
              {quickActionState.dnsFlush === "running" && <RotateCw className="w-3.5 h-3.5 animate-spin text-rose-400" />}
              {quickActionState.dnsFlush === "success" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              <span>
                {quickActionState.dnsFlush === "running" ? "Purgando..." : quickActionState.dnsFlush === "success" ? "¡Caché Vaciada!" : "Purgar DNS"}
              </span>
            </button>
          </div>

          {/* ACTION 3: RECARGAR NGINX PROXY */}
          <div className="p-4 rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-3 glass-shine flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400 border border-purple-500/20">
                <RefreshCw className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                nginx -s reload
              </span>
            </div>
            <div>
              <div className="font-bold text-white text-sm">Recargar Nginx</div>
              <p className="text-[11px] text-white/50 font-mono mt-0.5">
                Aplica cambios de SSL y proxies sin desconectar usuarios
              </p>
            </div>
            <button
              onClick={() => runRealAction("nginxReload", "reload-nginx", "Recarga en Caliente de Nginx")}
              disabled={quickActionState.nginxReload === "running"}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                quickActionState.nginxReload === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : quickActionState.nginxReload === "running"
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-purple-500/40"
              }`}
            >
              {quickActionState.nginxReload === "running" && <RotateCw className="w-3.5 h-3.5 animate-spin text-purple-400" />}
              {quickActionState.nginxReload === "success" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              <span>
                {quickActionState.nginxReload === "running" ? "Recargando..." : quickActionState.nginxReload === "success" ? "¡Nginx Recargado!" : "Recargar Proxies"}
              </span>
            </button>
          </div>

          {/* ACTION 4: CREAR BACKUP AHORA */}
          <div className="p-4 rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-3 glass-shine flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/20">
                <Archive className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                backup.sh
              </span>
            </div>
            <div>
              <div className="font-bold text-white text-sm">Crear Backup Ahora</div>
              <p className="text-[11px] text-white/50 font-mono mt-0.5">
                Genera snapshot real SQLite consistente con hash SHA-256
              </p>
            </div>
            <button
              onClick={() => runRealAction("backupNow", "backup", "Generación de Snapshot Manual de Bases de Datos")}
              disabled={quickActionState.backupNow === "running"}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                quickActionState.backupNow === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : quickActionState.backupNow === "running"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-amber-500/40"
              }`}
            >
              {quickActionState.backupNow === "running" && <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />}
              {quickActionState.backupNow === "success" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              <span>
                {quickActionState.backupNow === "running" ? "Creando Backup..." : quickActionState.backupNow === "success" ? "¡Backup Creado!" : "Disparar Backup"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. REGISTRO EN VIVO DE OPERACIONES EJECUTADAS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <h2 className="text-xs uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>Consola de Auditoría & Salida en Tiempo Real</span>
            </h2>
            <p className="text-[11px] text-white/50 font-mono mt-0.5">
              Registro stdout devuelto por los procesos de mantenimiento en el servidor
            </p>
          </div>
          <button
            onClick={() => setActionLogs([])}
            className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
          >
            Limpiar Registro
          </button>
        </div>

        <div className="rounded-2xl border border-white/15 bg-black/90 shadow-2xl overflow-hidden font-mono text-xs">
          <div className="px-4 py-2.5 bg-zinc-900/90 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block shadow-sm shadow-rose-500/30" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block shadow-sm shadow-amber-500/30" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block shadow-sm shadow-emerald-500/30" />
              <span className="ml-2 text-white/60 text-[11px]">operaciones@lenovo-server: /opt/homelab/scripts</span>
            </div>
            <div className="text-[10px] text-white/40">
              Total eventos: {actionLogs.length}
            </div>
          </div>

          <div className="p-4 sm:p-5 h-[320px] overflow-y-auto space-y-3 selection:bg-cyan-500/30 text-white/90">
            {actionLogs.length === 0 ? (
              <div className="text-white/30 italic text-center py-10 font-mono">
                Ninguna operación ejecutada recientemente. Tocá cualquier botón de arriba para disparar tareas en el servidor.
              </div>
            ) : (
              actionLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      {log.status === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className="font-bold text-white">{log.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/40 text-[10px]">
                      {log.duration && <span className="text-cyan-400">{log.duration}</span>}
                      <span>{log.time}</span>
                    </div>
                  </div>
                  <pre className="text-zinc-300 whitespace-pre-wrap font-mono text-[11px] leading-snug bg-black/40 p-2.5 rounded-lg border border-white/5">
                    {log.output}
                  </pre>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

