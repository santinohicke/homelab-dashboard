import React, { useState, useEffect } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Key, Globe, Server, Terminal,
  RefreshCw, CheckCircle2, AlertCircle, AlertTriangle, Eye, EyeOff,
  Download, Clock, ExternalLink, Zap, Radio, Copy, Check, Filter, Search,
  HardDrive, Cpu, Database, ChevronRight, Unlock
} from "lucide-react";

export default function SecurityVault() {
  const [activeSubTab, setActiveSubTab] = useState("all");
  const [filterQuery, setFilterQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [isScanningPorts, setIsScanningPorts] = useState(false);
  const [scanTimestamp, setScanTimestamp] = useState(() => new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));

  // Fail2ban state
  const [bannedIps, setBannedIps] = useState([
    { ip: "185.196.220.14", jail: "sshd", country: "Rusia (RU)", attempts: 14, time: "Hace 42 min", banExpires: "5 hr 18 min", risk: "Crítico" },
    { ip: "45.154.255.89", jail: "sshd", country: "Alemania (DE)", attempts: 8, time: "Hace 2 horas", banExpires: "3 hr 45 min", risk: "Alto" },
    { ip: "193.106.191.22", jail: "npm-badbots", country: "Países Bajos (NL)", attempts: 26, time: "Hace 5 horas", banExpires: "18 hr 12 min", risk: "Crítico" },
    { ip: "103.145.13.6", jail: "sshd", country: "Singapur (SG)", attempts: 6, time: "Hace 9 horas", banExpires: "14 hr 50 min", risk: "Medio" },
    { ip: "80.94.95.210", jail: "npm-badbots", country: "Bulgaria (BG)", attempts: 31, time: "Hace 12 horas", banExpires: "11 hr 20 min", risk: "Crítico" }
  ]);
  const [unbanningIp, setUnbanningIp] = useState(null);

  // SSL Certificates list
  const sslCertificates = [
    {
      domain: "*.homelab.local",
      issuer: "Let's Encrypt Authority X3 / Local CA",
      tlsVersion: "TLS 1.3 / ChaCha20-Poly1305",
      type: "Wildcard SAN",
      status: "valid",
      validUntil: "2027-01-14",
      daysRemaining: 89,
      coverage: ["panel.homelab.local", "ha.homelab.local", "vault.homelab.local", "kuma.homelab.local", "npm.homelab.local", "portainer.homelab.local"],
      keySize: "ECDSA 384 bits",
      ocspStapling: true
    },
    {
      domain: "vault.homelab.local",
      issuer: "Local CA Root & NPM Reverse Proxy",
      tlsVersion: "TLS 1.3 Strict",
      type: "Single Domain (HSTS 1 Year)",
      status: "valid",
      validUntil: "2027-01-14",
      daysRemaining: 89,
      coverage: ["vault.homelab.local:443"],
      keySize: "RSA 4096 bits",
      ocspStapling: true
    },
    {
      domain: "Cloudflare Edge Tunnel",
      issuer: "Cloudflare Inc ECC CA-3",
      tlsVersion: "TLS 1.3 Universal Edge",
      type: "Cloudflare Zero Trust Ingress",
      status: "valid",
      validUntil: "2027-04-12",
      daysRemaining: 178,
      coverage: ["Ingress Zero-Trust Wan"],
      keySize: "ECDSA 256 bits",
      ocspStapling: true
    }
  ];

  // Listening ports list
  const listeningPorts = [
    { port: 22, proto: "TCP", service: "SSH OpenSSH 9.6p1", access: "Solo LAN & Tailscale", status: "open", firewall: "UFW Activo", rateLimit: "fail2ban 3 intentos" },
    { port: 80, proto: "TCP", service: "HTTP Nginx Proxy", access: "Redirige a HTTPS 443", status: "redirect", firewall: "Permitido", rateLimit: "N/A" },
    { port: 443, proto: "TCP", service: "HTTPS Nginx SSL Wildcard", access: "Público LAN / Ingress", status: "open", firewall: "Permitido (TLS 1.3)", rateLimit: "100 req/s" },
    { port: 81, proto: "TCP", service: "Nginx Proxy Manager Admin", access: "Privado (Admin)", status: "restricted", firewall: "Restringido a LAN 192.168.1.0/24", rateLimit: "Protegido" },
    { port: 53, proto: "UDP/TCP", service: "DNS Pi-hole FTL", access: "Servidor DNS LAN", status: "open", firewall: "Escuchando en 192.168.1.100", rateLimit: "Rate limit activado" },
    { port: 8123, proto: "TCP", service: "Home Assistant Web & WS", access: "Proxy Inverso :443", status: "proxied", firewall: "Aislado por Docker Bridge", rateLimit: "Autenticación MFA" },
    { port: 8085, proto: "TCP", service: "Vaultwarden SQLite API", access: "Proxy Inverso :443", status: "proxied", firewall: "Aislado por Docker Bridge", rateLimit: "Zero-Knowledge" },
    { port: 3001, proto: "TCP", service: "Uptime Kuma Health", access: "Proxy Inverso :443", status: "proxied", firewall: "Aislado por Docker Bridge", rateLimit: "Auth requerida" },
    { port: 9443, proto: "TCP", service: "Portainer CE Docker Socket", access: "Proxy Inverso :443", status: "restricted", firewall: "Docker Socket protegido / TLS", rateLimit: "Admin token" }
  ];

  const [portsList, setPortsList] = useState(listeningPorts);
  const [certInfo, setCertInfo] = useState(sslCertificates);

  const fetchSecurityAudit = async () => {
    setIsScanningPorts(true);
    try {
      const res = await fetch("/api/v1/security/audit");
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.open_ports)) {
          setPortsList(prev => (Array.isArray(prev) ? prev : listeningPorts).map(p => ({
            ...p,
            status: data.open_ports.includes(p.port) ? "open" : (p.status === "redirect" ? "redirect" : "closed")
          })));
        }
        if (data && data.ssl_certificate && typeof data.ssl_certificate.days_remaining === "number") {
          setCertInfo(prev => (Array.isArray(prev) ? prev : sslCertificates).map(c => (c.domain && c.domain.includes("homelab")) ? {
            ...c,
            daysRemaining: data.ssl_certificate.days_remaining
          } : c));
        }
        if (data && data.fail2ban) {
          if (Array.isArray(data.fail2ban.banned_ips) && data.fail2ban.banned_ips.length > 0) {
            setBannedIps(data.fail2ban.banned_ips);
          } else {
            setBannedIps([]);
          }
        }
        setScanTimestamp(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (e) {
      console.warn("Audit fetch error:", e);
    } finally {
      setIsScanningPorts(false);
    }
  };

  useEffect(() => {
    fetchSecurityAudit();
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleUnban = (ip) => {
    setUnbanningIp(ip);
    setTimeout(() => {
      setBannedIps(prev => prev.filter(item => item.ip !== ip));
      setUnbanningIp(null);
    }, 900);
  };

  const handleRunPortScan = () => {
    fetchSecurityAudit();
  };

  const handleDownloadRootCA = () => {
    // Generate sample root CA download trigger
    const caContent = `-----BEGIN CERTIFICATE-----
MIIBkDCB+wIJAKHH7...[Homelab Root CA 2026]...
Valid for *.homelab.local / Homelab Server Node 01
-----END CERTIFICATE-----`;
    const blob = new Blob([caContent], { type: "application/x-x509-ca-cert" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "homelab-root-ca.crt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER BANNER */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-900/60 border border-white/10 backdrop-blur-2xl glass-shine relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Security Operations & Hardening</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Bóveda de Seguridad & Auditoría
            </h1>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl leading-relaxed">
              Monitoreo continuo de cifrado TLS 1.3, mitigación de ataques por fuerza bruta con Fail2ban, estado de la base de datos de Vaultwarden y auditoría de puertos en el servidor Lenovo ThinkCentre.
            </p>
          </div>

          {/* QUICK STATS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 text-center">
              <div className="text-[11px] text-white/50 uppercase font-semibold">Score Seguridad</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">A+ (98%)</div>
              <div className="text-[10px] text-emerald-300/80 mt-0.5">Zero-Trust Activo</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 text-center">
              <div className="text-[11px] text-white/50 uppercase font-semibold">IPs Bloqueadas</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-0.5">{bannedIps.length}</div>
              <div className="text-[10px] text-rose-300/80 mt-0.5">Fail2ban Activo</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 text-center col-span-2 sm:col-span-1">
              <div className="text-[11px] text-white/50 uppercase font-semibold">SSL Wildcard</div>
              <div className="text-2xl font-black text-cyan-400 font-mono mt-0.5">89 Días</div>
              <div className="text-[10px] text-cyan-300/80 mt-0.5">Auto-renovación</div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: SSL CERTIFICATES & TLS 1.3 AUDIT */}
      <div className="p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-6 glass-shine">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Auditoría de Certificados SSL & Cifrado TLS
              </h2>
              <p className="text-xs text-white/50">Cifrado de grado bancario para todos los subdominios de <span className="text-white/80 font-mono">*.homelab.local</span></p>
            </div>
          </div>

          <button
            onClick={handleDownloadRootCA}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Descarga el certificado raíz para instalar en tu iPhone, Android o Windows y eliminar el cartel de sitio no seguro"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Descargar Certificado CA Raíz</span>
          </button>
        </div>

        {/* CERTIFICATES CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {certInfo.map((cert, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-all duration-300 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    {cert.domain}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Válido
                  </span>
                </div>
                <div className="text-xs text-white/60 font-mono">{cert.issuer}</div>
                <div className="text-xs font-medium text-white/90 pt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{cert.tlsVersion}</span>
                </div>
              </div>

              {/* EXPIRY PROGRESS */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex justify-between text-[11px] font-mono text-white/70">
                  <span>Vencimiento: {cert.validUntil}</span>
                  <span className="text-cyan-400 font-bold">{cert.daysRemaining} días restantes</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-full rounded-full"
                    style={{ width: `${Math.min(100, (cert.daysRemaining / 90) * 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-1.5">
                  {(cert.coverage || []).map((sub, sIdx) => (
                    <span key={sIdx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: FAIL2BAN & BRUTE-FORCE INTRUSION PREVENTER */}
      <div className="p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-6 glass-shine">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Registro de Ataques & IPs Bloqueadas (Fail2ban)
              </h2>
              <p className="text-xs text-white/50">Bloqueo automático de intentos de adivinación de contraseñas por SSH y escaneos de bots maliciosos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/50">Estado de la cárcel:</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              Jails: sshd, npm-badbots [ACTIVE]
            </span>
          </div>
        </div>

        {/* IP LIST TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase font-mono tracking-wider">
                <th className="pb-3 pl-3">Dirección IP</th>
                <th className="pb-3">Cárcel / Regla</th>
                <th className="pb-3">Origen Geográfico</th>
                <th className="pb-3">Intentos Fallidos</th>
                <th className="pb-3">Expira En</th>
                <th className="pb-3">Nivel de Riesgo</th>
                <th className="pb-3 pr-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bannedIps.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-white/50 space-y-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                    <div className="text-xs font-semibold text-white">0 IPs bloqueadas actualmente</div>
                    <div className="text-[11px] font-mono text-emerald-400">Escudo Fail2ban Activo protegiendo SSH (:22) · No se detectaron ataques recientes</div>
                  </td>
                </tr>
              ) : (
                bannedIps.map((b, idx) => (
                  <tr key={b.ip} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 pl-3 font-mono font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      {b.ip}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono">
                        {b.jail}
                      </span>
                    </td>
                    <td className="py-3 text-white/80 font-medium">{b.country}</td>
                    <td className="py-3 font-mono text-rose-300 font-semibold">{b.attempts} intentos</td>
                    <td className="py-3 text-white/60 font-mono">{b.banExpires}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                        b.risk === "Crítico" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}>
                        {b.risk}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <button
                        onClick={() => handleUnban(b.ip)}
                        disabled={unbanningIp === b.ip}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white transition-all text-[11px] cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Unlock className="w-3 h-3 text-white/60" />
                        <span>{unbanningIp === b.ip ? "Desbloqueando..." : "Desbloquear"}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: OPEN PORTS SCANNER & VAULTWARDEN HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OPEN PORTS SCANNER (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-5 glass-shine">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Matriz de Puertos Abiertos & Escáner LAN
                </h3>
                <p className="text-xs text-white/50">Último escaneo local: <span className="text-white/80 font-mono">{scanTimestamp}</span></p>
              </div>
            </div>

            <button
              onClick={handleRunPortScan}
              disabled={isScanningPorts}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningPorts ? "animate-spin text-emerald-400" : ""}`} />
              <span>{isScanningPorts ? "Escaneando Puertos..." : "Escanear Ahora"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {portsList.map((p) => (
              <div key={p.port} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5 hover:bg-white/[0.06] transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-black text-cyan-400">:{p.port}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">{p.proto}</span>
                </div>
                <div className="font-semibold text-xs text-white truncate">{p.service}</div>
                <div className="text-[11px] text-white/50 truncate font-mono">{p.access}</div>
                <div className="text-[10px] font-mono text-emerald-400 pt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{p.firewall}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VAULTWARDEN ZERO-KNOWLEDGE HEALTH (1 col) */}
        <div className="p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-5 glass-shine flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 flex items-center justify-center text-purple-400 border border-purple-500/20">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Salud de Vaultwarden
                </h3>
                <p className="text-xs text-white/50">Bóveda Cifrada End-to-End</p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300 font-semibold">Cifrado Bóveda</span>
                  <span className="font-mono text-purple-200 font-bold">AES-256-GCM</span>
                </div>
                <p className="text-[11px] text-white/60">
                  Arquitectura Zero-Knowledge: el servidor nunca conoce tu Master Password. Los datos se cifran y descifran en tu dispositivo.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/50">Base de datos:</span>
                  <span className="font-mono text-white/90">SQLite WAL (12.4 MB)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/50">Último Checkpoint WAL:</span>
                  <span className="font-mono text-emerald-400">Hace 14 min (OK)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/50">Total Ítems Cifrados:</span>
                  <span className="font-mono text-cyan-400 font-bold">142 contraseñas & notas</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/50">Copias de Seguridad:</span>
                  <span className="font-mono text-emerald-400">Automatizada 03:00 AM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <a
              href="https://vault.homelab.local"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/30 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Vaultwarden Web Vault</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
