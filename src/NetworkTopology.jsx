import React, { useState, useEffect } from "react";
import {
  Network, Wifi, Server, Smartphone, Laptop, Tablet, Radio,
  Globe, ArrowRight, ShieldCheck, CheckCircle2, RefreshCw, Cpu,
  HardDrive, Layers, Activity, Search, Filter, Play, Check, Zap, ArrowUpRight
} from "lucide-react";

export default function NetworkTopology() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  // DHCP & Static IP Table baseline
  const dhcpTable = [
    { hostname: "sagemcom-gateway", ip: "192.168.0.1", mac: "20:9A:7D:AD:F4:54", type: "Gateway", lease: "Estática", iface: "WAN / LAN 1", vendor: "Sagemcom Broadband", speed: "1 Gbps", status: "online" },
    { hostname: "lenovo-server", ip: "192.168.1.100", mac: "44:8A:5B:3C:D9:11", type: "Servidor Homelab", lease: "Estática (DHCP Res)", iface: "wlp3s0 / eth0", vendor: "Lenovo Server (Laptop)", speed: "1 Gbps Full", status: "online" },
    { hostname: "iPhone-11-Santino", ip: "192.168.1.150", mac: "86:2D:A6:15:03:4F", type: "Móvil", lease: "Dinámica (24h)", iface: "wlan0 (5 GHz)", vendor: "Apple Inc.", speed: "433 Mbps", status: "online" },
    { hostname: "Galaxy-A52-Personal", ip: "192.168.0.110", mac: "B0:99:D7:66:3C:28", type: "Móvil", lease: "Dinámica (24h)", iface: "wlan0 (5 GHz)", vendor: "Samsung Electronics", speed: "390 Mbps", status: "online" },
    { hostname: "iPhone-15-Casa", ip: "192.168.0.125", mac: "46:64:96:D7:99:93", type: "Móvil", lease: "Dinámica (24h)", iface: "wlan0 (5 GHz)", vendor: "Apple Inc.", speed: "520 Mbps", status: "online" },
    { hostname: "Notebook-HP-250G7", ip: "192.168.1.50", mac: "DC:F5:05:CF:30:49", type: "Laptop", lease: "Estática", iface: "eth0 / wlan0", vendor: "HP Inc.", speed: "866 Mbps", status: "online" },
    { hostname: "Moto-E7-Dashboard", ip: "192.168.0.220", mac: "1C:E5:7F:04:A6:71", type: "Tablet / Panel", lease: "Estática", iface: "wlan0 (2.4 GHz)", vendor: "Motorola Mobility", speed: "72 Mbps", status: "online" }
  ];

  const [deviceList, setDeviceList] = useState(dhcpTable);

  const fetchRealDevices = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/v1/network/devices");
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.devices) && data.devices.length > 0) {
          setDeviceList(data.devices);
        }
      }
    } catch (e) {
      // Keep baseline on error
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    fetchRealDevices();
    const intv = setInterval(fetchRealDevices, 12000);
    return () => clearInterval(intv);
  }, []);

  const filteredDhcp = deviceList.filter(item =>
    item.hostname.toLowerCase().includes(filterQuery.toLowerCase()) ||
    item.ip.includes(filterQuery) ||
    item.mac.toLowerCase().includes(filterQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(filterQuery.toLowerCase())
  );


  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. TOP CONTROL BAR */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-shine">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-base flex flex-wrap items-center gap-2">
              <span>Topología de Red & Mapa de Dispositivos</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LAN 192.168.0.0/24
              </span>
            </div>
            <div className="text-xs text-white/50 font-mono">
              Gateway Fibra Óptica · Servidor Lenovo · Docker Bridge · WiFi 2.4/5 GHz
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRealDevices}
            disabled={isScanning}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Escaneando LAN..." : "Escanear Red"}</span>
          </button>
        </div>
      </div>

      {/* 2. STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Gateway</div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">192.168.0.1</div>
          <div className="text-[10px] text-emerald-400 mt-0.5">Sagemcom F@ST3890</div>
        </div>
        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Homelab Server</div>
          <div className="text-xl sm:text-2xl font-black text-cyan-400 font-mono mt-0.5">192.168.1.100</div>
          <div className="text-[10px] text-cyan-300/80 mt-0.5">1 Gbps Full-Duplex</div>
        </div>
        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Dispositivos LAN</div>
          <div className="text-xl sm:text-2xl font-black text-blue-400 font-mono mt-0.5">{deviceList.length}</div>
          <div className="text-[10px] text-blue-300/80 mt-0.5">Activos en Subred</div>
        </div>
        <div className="p-4 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 text-center glass-shine">
          <div className="text-[11px] text-white/50 uppercase font-semibold">Subred LAN</div>
          <div className="text-xl sm:text-2xl font-black text-purple-400 font-mono mt-0.5">/24 (254 IPs)</div>
          <div className="text-[10px] text-purple-300/80 mt-0.5">DNS Pi-hole :53</div>
        </div>
      </div>

      {/* SECTION 1: INTERACTIVE NETWORK TOPOLOGY TREE (DIAGRAMA EN ÁRBOL) */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-6 glass-shine">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Diagrama en Árbol de Conexiones
              </h2>
              <p className="text-xs text-white/50">Haz clic en cualquier nodo para ver sus detalles técnicos y puertos</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Cableado Ethernet 1 Gbps
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              WiFi 5 GHz (Dual Band)
            </span>
            <span className="flex items-center gap-1.5 text-purple-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              Docker Bridge Virtual
            </span>
          </div>
        </div>

        {/* TOPOLOGY NODES FLOW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* LEVEL 1: WAN & GATEWAY ROUTER */}
          <div className="space-y-4">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
              <span>Nivel 1: Acometida & Gateway</span>
            </div>

            <div 
              onClick={() => setSelectedNode({
                title: "Router Sagemcom F@ST3890",
                type: "Gateway Principal Fibra Óptica",
                ip: "192.168.0.1",
                mac: "58:8D:09:A1:22:E0",
                features: ["DOCSIS 3.1 / GPON Integrada", "WiFi 5 (802.11ac) 4x4 MU-MIMO", "4x Puertos Gigabit LAN", "DNS Primario apuntando a 192.168.1.100 (Pi-hole)"]
              })}
              className="p-5 rounded-2xl bg-gradient-to-br from-blue-900/40 to-slate-900/60 border border-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer space-y-3 glass-shine shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Radio className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                  WAN ONLINE (300M)
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Router Sagemcom F@ST3890</h3>
                <div className="text-xs text-cyan-300 font-mono">192.168.0.1 · Fibra Óptica</div>
              </div>
              <p className="text-[11px] text-white/60">
                Acometida GPON y ruteador central. Distribuye DHCP y asigna tráfico LAN Gigabit al servidor.
              </p>
            </div>

            {/* WAN INGRESS */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Fibra Óptica FTTH</span>
                <span className="text-emerald-400 font-mono font-bold">300 Mbps Simétrico</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Cloudflare Tunnel Edge</span>
                <span className="text-cyan-400 font-mono">Zero-Trust Ingress</span>
              </div>
            </div>
          </div>

          {/* LEVEL 2: LENOVO SERVER & DOCKER BRIDGE */}
          <div className="space-y-4">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
              <span>Nivel 2: Servidor Lenovo & Docker</span>
            </div>

            <div 
              onClick={() => setSelectedNode({
                title: "Servidor Lenovo (Intel Core i3 M 380)",
                type: "Servidor Homelab Principal",
                ip: "192.168.1.100 · Tailscale: 100.64.0.10",
                mac: "44:8A:5B:3C:D9:11",
                features: ["Intel Core i3 M 380 (2.53 GHz)", "3.0 GB RAM DDR3", "146 GB SSD Ext4 (/dev/sda3)", "Ubuntu 22.04 LTS Jammy Jellyfish", "Docker Engine 27.2 + Docker Compose v2"]
              })}
              className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-slate-900/60 border border-indigo-500/30 hover:border-indigo-400 transition-all cursor-pointer space-y-3 glass-shine shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  <Server className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                  ETH0 1000 Mb/s
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Servidor Lenovo (Intel Core i3 M 380)</h3>
                <div className="text-xs text-indigo-300 font-mono">192.168.1.100 (IP Fija)</div>
              </div>
              <p className="text-[11px] text-white/60">
                Host físico principal conectado vía cable Cat6 directo al router. Alberga los 7 stacks de contenedores.
              </p>
            </div>

            {/* DOCKER BRIDGE CONTAINERS LIST */}
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-2">
              <div className="text-[11px] font-mono font-bold text-purple-300 flex items-center justify-between">
                <span>Docker Bridge: 172.17.0.0/16</span>
                <span>7 Contenedores</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <span className="p-1 rounded bg-white/5 text-cyan-300">dashboard (:3000)</span>
                <span className="p-1 rounded bg-white/5 text-blue-300">homeassistant (:8123)</span>
                <span className="p-1 rounded bg-white/5 text-purple-300">vaultwarden (:8085)</span>
                <span className="p-1 rounded bg-white/5 text-emerald-300">uptime-kuma (:3001)</span>
                <span className="p-1 rounded bg-white/5 text-rose-300">pihole (:53/:80)</span>
                <span className="p-1 rounded bg-white/5 text-amber-300">nginx-proxy (:80/443)</span>
              </div>
            </div>
          </div>

          {/* LEVEL 3: CLIENT DEVICES & WIFI BRANCHES */}
          <div className="space-y-4">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
              <span>Nivel 3: Dispositivos WiFi & Familia</span>
            </div>

            <div className="space-y-2.5">
              <div 
                onClick={() => setSelectedNode({
                  title: "Notebook HP 250 G7 (Santino)",
                  type: "Estación de Trabajo Windows 11",
                  ip: "192.168.1.50",
                  mac: "CF:30:49:12:88:AA",
                  features: ["Conexión WiFi 5 GHz / Ethernet", "Latencia al servidor: 2.1 ms", "Visualización activa del panel"]
                })}
                className="p-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Laptop className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-xs text-white">Notebook HP 250 G7</div>
                    <div className="text-[10px] font-mono text-white/50">192.168.1.50 · Windows 11</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">2ms</span>
              </div>

              <div 
                onClick={() => setSelectedNode({
                  title: "iPhone 11 (Santino)",
                  type: "Dispositivo Móvil iOS",
                  ip: "192.168.1.150",
                  mac: "86:2D:A6:15:03:4F",
                  features: ["WiFi 5 GHz (Señal: -42 dBm)", "App Home Assistant conectada", "Tailscale client activo"]
                })}
                className="p-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="font-semibold text-xs text-white">iPhone 11</div>
                    <div className="text-[10px] font-mono text-white/50">192.168.1.150 · iOS</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-blue-400 font-bold">4ms</span>
              </div>

              <div 
                onClick={() => setSelectedNode({
                  title: "Samsung Galaxy A52",
                  type: "Dispositivo Móvil Android",
                  ip: "192.168.0.110",
                  mac: "66:3C:28:90:11:02",
                  features: ["WiFi 5 GHz (Señal: -58 dBm)", "En red local", "DNS apuntando a Pi-hole"]
                })}
                className="p-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  <div>
                    <div className="font-semibold text-xs text-white">Samsung Galaxy A52</div>
                    <div className="text-[10px] font-mono text-white/50">192.168.0.110 · Android</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-indigo-400 font-bold">12ms</span>
              </div>

              <div 
                onClick={() => setSelectedNode({
                  title: "iPhone 15",
                  type: "Dispositivo Móvil iOS",
                  ip: "192.168.0.125",
                  mac: "46:64:96:D7:99:93",
                  features: ["WiFi 5 GHz (Señal: -52 dBm)", "En red local"]
                })}
                className="p-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="font-semibold text-xs text-white">iPhone 15</div>
                    <div className="text-[10px] font-mono text-white/50">192.168.0.125 · iOS</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-blue-400 font-bold">9ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL DETALLES DEL NODO SELECCIONADO */}
        {selectedNode && (
          <div className="p-4 rounded-2xl bg-white/[0.08] border border-cyan-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-300 font-mono">{selectedNode.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/70">{selectedNode.type}</span>
              </div>
              <div className="text-xs font-mono text-white/60">IP: <span className="text-white font-bold">{selectedNode.ip}</span> · MAC: {selectedNode.mac}</div>
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedNode.features.map((f, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-white/80 border border-white/5">
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white/80 hover:text-white transition-all cursor-pointer self-start sm:self-center"
            >
              Cerrar Detalle
            </button>
          </div>
        )}
      </div>



      {/* SECTION 2: DHCP TABLE & IP/MAC LEASES */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 space-y-6 glass-shine">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Tabla DHCP & Asignación de IPs Fijas / MAC
              </h2>
              <p className="text-xs text-white/50">Control de direcciones físicas de hardware conectadas al router y al servidor</p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Buscar por IP, Hostname o MAC..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase font-mono tracking-wider">
                <th className="pb-3 pl-3">Dispositivo / Hostname</th>
                <th className="pb-3">Dirección IP</th>
                <th className="pb-3">Dirección MAC</th>
                <th className="pb-3">Tipo de Asignación</th>
                <th className="pb-3">Interfaz / Banda</th>
                <th className="pb-3">Fabricante</th>
                <th className="pb-3 pr-3 text-right">Velocidad Negociada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredDhcp.map((d) => (
                <tr key={d.mac} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-3 pl-3 font-semibold text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${d.status === "online" ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-neutral-600"}`} />
                    {d.hostname}
                  </td>
                  <td className="py-3 font-mono font-bold text-cyan-400">{d.ip}</td>
                  <td className="py-3 font-mono text-white/60">{d.mac}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] ${
                      d.lease.includes("Estática") ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-300" : "bg-white/5 text-white/60"
                    }`}>
                      {d.lease}
                    </span>
                  </td>
                  <td className="py-3 text-white/80 font-mono text-[11px]">{d.iface}</td>
                  <td className="py-3 text-white/60">{d.vendor}</td>
                  <td className="py-3 pr-3 text-right font-mono text-emerald-400 font-semibold">{d.speed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

