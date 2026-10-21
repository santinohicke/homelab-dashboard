import React, { useState, useEffect, useRef } from "react";
import {
  Share2, UploadCloud, Copy, Check, File, Trash2, Smartphone,
  Laptop, ArrowDown, ArrowUp, Send, RefreshCw, FileText, Download,
  CheckCircle2, Clock, HardDrive, Shield
} from "lucide-react";

export default function DropZone() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [sendingText, setSendingText] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fileInputRef = useRef(null);

  // Detect user agent for device label
  const getDeviceLabel = () => {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return "iPhone 11";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua)) return "Android";
    if (/Windows/i.test(ua)) return "PC Windows (HP 250)";
    if (/Macintosh/i.test(ua)) return "MacBook";
    return "Navegador Web";
  };

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/v1/dropzone/items");
      if (res.ok) {
        const d = await res.json();
        setItems(d.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchItems();
    const intv = setInterval(fetchItems, 4000);
    return () => clearInterval(intv);
  }, []);

  const handleSendText = async (e) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || sendingText) return;
    setSendingText(true);
    try {
      const res = await fetch("/api/v1/dropzone/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textInput.trim(),
          sender: getDeviceLabel()
        })
      });
      if (res.ok) {
        setTextInput("");
        setFeedback("Texto compartido en el portapapeles del Homelab");
        await fetchItems();
      }
    } catch (err) {
      setFeedback("Error al enviar texto");
    } finally {
      setSendingText(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(`Leyendo ${file.name}...`);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result.split(",")[1];
        setUploadProgress(`Transfiriendo ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`);
        
        const res = await fetch("/api/v1/dropzone/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            content_base64: base64Data,
            sender: getDeviceLabel()
          })
        });

        if (res.ok) {
          const d = await res.json();
          setFeedback(d.message || "Archivo recibido con éxito");
          await fetchItems();
        } else {
          setFeedback("Error al guardar archivo en el servidor");
        }
        setUploading(false);
        setUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setFeedback("Error al procesar archivo");
      setUploading(false);
      setUploadProgress(null);
    }
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch("/api/v1/dropzone/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        await fetchItems();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 glass-shine">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shrink-0">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-white text-base flex items-center gap-2">
              <span>DropZone Privado & Portapapeles Universal</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                P2P Gigabit LAN
              </span>
            </div>
            <div className="text-xs text-white/50 font-mono mt-0.5">
              Alternativa soberana a AirDrop para transferir archivos y texto entre PC y iPhone sin nubes externas
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {feedback && (
            <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
              {feedback}
            </span>
          )}
          <button
            onClick={fetchItems}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* INPUTS ROW: PORTAPAPELES COMPARTIDO + SUBIDA DE ARCHIVOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. PORTAPAPELES UNIVERSAL */}
        <div className="p-5 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 flex flex-col justify-between space-y-4 glass-shine">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-2">
                <Copy className="w-4 h-4" />
                <span>Portapapeles Universal (Texto / URLs / Comandos)</span>
              </span>
              <span className="text-[10px] font-mono text-white/40">Sincronización en vivo</span>
            </div>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Pegá un texto, link, número de teléfono o comando acá para que aparezca al instante en tu otro dispositivo..."
              rows={4}
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 resize-none font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-mono text-white/40">
              Emitiendo desde: <strong className="text-white/70">{getDeviceLabel()}</strong>
            </span>
            <button
              onClick={handleSendText}
              disabled={!textInput.trim() || sendingText}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                textInput.trim() && !sendingText
                  ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20 cursor-pointer"
                  : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingText ? "Enviando..." : "Compartir Texto"}</span>
            </button>
          </div>
        </div>

        {/* 2. DROPZONE DE ARCHIVOS */}
        <div className="p-5 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 flex flex-col justify-between space-y-4 glass-shine">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>DropZone de Archivos & Fotos (AirDrop Privado)</span>
              </span>
              <span className="text-[10px] font-mono text-white/40">Sin límite de compresión</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-cyan-400/50 rounded-2xl p-6 sm:p-7 flex flex-col items-center justify-center gap-2.5 bg-black/20 hover:bg-white/[0.02] cursor-pointer transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 group-hover:bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/20 transition-all">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-xs text-center font-medium text-white/80">
                <span>Tocá acá para elegir o arrastrá fotos, PDFs o archivos</span>
              </div>
              <span className="text-[10px] font-mono text-white/40">
                Directo al SSD del servidor Lenovo vía LAN / Tailscale
              </span>
            </div>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="text-xs font-mono text-cyan-300 animate-pulse flex items-center justify-between">
                <span>{uploadProgress || "Subiendo archivo..."}</span>
                <span>En progreso...</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full animate-pulse" style={{ width: "85%" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ITEMS LIST (SHARED FEED) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="text-xs uppercase tracking-wider text-white/60 font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Elementos Compartidos Recientes ({items.length})</span>
          </h2>
          <span className="text-[11px] font-mono text-white/40">Almacenados en /home/santino/infra/data/dropzone/</span>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-white/40 flex flex-col items-center gap-2 bg-white/[0.02] rounded-3xl border border-white/5">
            <Share2 className="w-8 h-8 text-white/20" />
            <span>Todavía no compartiste ningún archivo ni texto.</span>
            <span className="text-[11px] text-white/30">Arrastrá un archivo o pegá un texto arriba para comenzar.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl flex flex-col justify-between space-y-3 glass-shine hover:border-white/20 transition-all"
              >
                {/* ITEM HEADER */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      it.content_type === "file" 
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" 
                        : "bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
                    }`}>
                      {it.content_type === "file" ? <File className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate tracking-wide">
                        {it.title || (it.content_type === "file" ? it.file_name : "Texto Compartido")}
                      </div>
                      <div className="text-[10px] font-mono text-white/40 flex items-center gap-2 mt-0.5">
                        <span>{it.time_str}</span>
                        <span>·</span>
                        <span>{it.sender_device}</span>
                        {it.content_type === "file" && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-400">{formatSize(it.file_size)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(it.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Eliminar elemento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* ITEM BODY */}
                {it.content_type === "text" ? (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-white/80 font-mono break-words whitespace-pre-wrap max-h-36 overflow-y-auto selection:bg-cyan-500/30">
                    {it.text_content}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs text-white/70 font-mono">
                    <span className="truncate">{it.file_name}</span>
                    <span className="text-emerald-400 shrink-0 text-[11px]">{formatSize(it.file_size)}</span>
                  </div>
                )}

                {/* ITEM ACTIONS */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-end gap-2">
                  {it.content_type === "text" ? (
                    <button
                      onClick={() => handleCopyText(it.id, it.text_content)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedId === it.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <a
                      href={`/api/v1/dropzone/download?id=${it.id}`}
                      download={it.file_name}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar ({formatSize(it.file_size)})</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

