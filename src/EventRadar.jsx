import React, { useState, useEffect, useRef } from "react";
import {
  CalendarDays, MapPin, Clock, RefreshCw, ArrowUpRight, Plus, Trash2, X, Check,
  AlertCircle, Globe, Layers, Radar, CalendarCheck, RotateCcw, EyeOff
} from "lucide-react";

// ============================================================================
// Radar Eventos: hackatones, charlas, meetups y comunidad en CABA/AMBA.
// Contrato: /api/v1/events* (spec radar-eventos R41-R45, A8, A10, A12).
// Las fechas llegan en hora AR ("...-03:00") y se muestran tal cual vienen:
// se leen del string con una regex, sin conversiones de zona del dispositivo.
// ============================================================================

const API = "/api/v1/events";

const CATEGORY_TABS = [
  { id: "hackatones", label: "Hackatones", empty: "No hay hackatones próximos." },
  { id: "charlas_cfps", label: "Charlas y CFPs", empty: "No hay charlas ni CFPs abiertos." },
  { id: "meetups", label: "Meetups", empty: "No hay meetups próximos." },
  { id: "afters", label: "Afters", empty: "No hay afters próximos." },
  { id: "voluntariados", label: "Voluntariados", empty: "No hay voluntariados próximos." },
  { id: "otros", label: "Otros", empty: "No hay otros eventos próximos." }
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_TABS.map(t => [t.id, t.label]));

// Solapa de inscripciones (addendum: descartar / "Me inscribí").
const INSCRIPCIONES = "inscripciones";

// Acciones del usuario sobre un evento. `from`/`to` son los grupos entre los
// que se mueve en la UI: "cat" (su solapa y su contador), "registered"
// (Mis inscripciones) y "dismissed" (Descartados).
const USER_ACTIONS = {
  register: { path: "/register", from: "cat", to: "registered", verb: "marcar la inscripción", done: "Pasó a Mis inscripciones." },
  dismiss: { path: "/dismiss", from: "cat", to: "dismissed", verb: "descartar el evento", done: "Evento descartado. Se puede restaurar desde Mis inscripciones." },
  unregister: { path: "/unregister", from: "registered", to: "cat", verb: "quitar la inscripción", done: "Volvió a su solapa." },
  undismiss: { path: "/undismiss", from: "dismissed", to: "cat", verb: "restaurar el evento", done: "Evento restaurado en su solapa." }
};

const byStart = (a, b) =>
  String(a.start_local || "").localeCompare(String(b.start_local || "")) || a.id - b.id;

const KINDS = [
  { id: "luma_discover", label: "Luma · búsqueda por palabra clave", short: "Luma búsqueda", needsValue: true, placeholder: "Palabra clave (ej.: hackathon)" },
  { id: "luma_calendar", label: "Luma · calendario", short: "Luma calendarios", needsValue: true, placeholder: "cal-XXXXXXXX" },
  { id: "meetup", label: "Meetup · grupo", short: "Meetup", needsValue: true, placeholder: "urlname del grupo (ej.: sysarmy)" },
  { id: "page_hash", label: "Página monitoreada", short: "Páginas monitoreadas", needsValue: true, placeholder: "https://..." },
  { id: "nexa_mcp", label: "NEXA", short: "NEXA", needsValue: false },
  { id: "argentinahackathons_rss", label: "Argentina Hackathons (RSS)", short: "Argentina Hackathons", needsValue: false },
  { id: "condor_nest", label: "Condor Nest", short: "Condor Nest", needsValue: false },
  { id: "devevents_cfps", label: "developers.events (CFPs)", short: "developers.events", needsValue: false }
];

const KIND_BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k]));

const STATUS_STYLES = {
  ok: { label: "OK", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  zero: { label: "0 resultados", cls: "bg-white/[0.06] text-white/70 border-white/15" },
  error: { label: "Error", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  timeout: { label: "Timeout", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" }
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

// Lee "AAAA-MM-DDTHH:MM..." sin pasar por la zona horaria del dispositivo.
const parseLocal = (s) => {
  if (typeof s !== "string") return null;
  const m = s.match(ISO_RE);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), hh: m[4] || null, mm: m[5] || null };
};

// Día de la semana por aritmética (Sakamoto), sin objetos de fecha.
const weekday = (y, mo, d) => {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = mo < 3 ? y - 1 : y;
  return (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[mo - 1] + d) % 7;
};

const fmtDay = (p) => `${DIAS[weekday(p.y, p.mo, p.d)]} ${p.d} ${MESES[p.mo - 1]} ${p.y}`;
const fmtTime = (p) => (p && p.hh ? `${p.hh}:${p.mm}` : "");
const sameDay = (a, b) => a && b && a.y === b.y && a.mo === b.mo && a.d === b.d;

const fmtEventWhen = (ev) => {
  const start = parseLocal(ev.start_local);
  if (!start) return ev.start_local || "Fecha sin informar";
  const withTime = !!ev.has_time && !!start.hh;
  let text = fmtDay(start);
  if (withTime) text += ` · ${fmtTime(start)}`;
  const end = parseLocal(ev.end_local);
  if (end) {
    if (sameDay(start, end)) {
      if (withTime && end.hh) text += ` a ${fmtTime(end)}`;
    } else {
      text += ` al ${fmtDay(end)}`;
      if (withTime && end.hh) text += ` · ${fmtTime(end)}`;
    }
  }
  return text;
};

// Sello de tiempo corto para estados del backend ("26 nov · 15:03").
const fmtStamp = (s) => {
  if (s === null || s === undefined || s === "") return "sin datos";
  const p = parseLocal(String(s));
  if (!p) return String(s);
  return p.hh ? `${p.d} ${MESES[p.mo - 1]} · ${p.hh}:${p.mm}` : `${p.d} ${MESES[p.mo - 1]} ${p.y}`;
};

const closingWarning = (days) => {
  if (typeof days !== "number" || days < 0 || days > 7) return null;
  if (days === 0) return "Cierra hoy";
  if (days === 1) return "Cierra mañana";
  return `Cierra en ${days} días`;
};

const hostOf = (url) => {
  const m = typeof url === "string" && url.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i);
  return m ? m[1] : url;
};

// `urls` puede venir como lista de strings o de objetos {url, provider}.
const eventLinks = (ev) => {
  const raw = Array.isArray(ev.urls) && ev.urls.length ? ev.urls : [ev.primary_url];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const url = typeof item === "string" ? item : item && item.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, label: hostOf(url) });
  }
  return out;
};

const apiErrorText = (status, data) => {
  const msg = data && (data.error || data.message || data.detail);
  return msg ? `Error ${status}: ${msg}` : `Error ${status}`;
};

const readJson = async (res) => {
  try {
    return await res.json();
  } catch (err) {
    void err;
    return null;
  }
};

const postJson = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await readJson(res);
  return { ok: res.ok, status: res.status, data };
};

const isOn = (v) => v === true || v === 1 || v === "1";

const tabBtnCls = (active) =>
  `min-h-[44px] px-3.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer border ${
    active
      ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/30"
      : "text-white/50 hover:text-white/80 hover:bg-white/5 border-transparent"
  }`;

const ghostBtnCls =
  "min-h-[44px] px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50";

const primaryBtnCls =
  "min-h-[44px] px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/30 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50";

const inputCls =
  "w-full min-h-[44px] px-3 rounded-xl bg-white/[0.04] border border-white/10 text-base sm:text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400";

const Badge = ({ cls, children }) => (
  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider border ${cls}`}>
    {children}
  </span>
);

const Notice = ({ tone, children, onClose }) => (
  <div className={`px-4 py-2 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
    tone === "error"
      ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
      : "bg-cyan-500/10 border-cyan-500/25 text-cyan-200"
  }`}>
    <span className="break-words min-w-0">{children}</span>
    {onClose && (
      <button onClick={onClose} aria-label="Cerrar aviso" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/50 hover:text-white cursor-pointer shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

// ============================================================================
// Tarjeta de evento
// ============================================================================
function EventCard({ ev, children }) {
  const warning = closingWarning(ev.closing_in_days);
  const closing = parseLocal(ev.closing_local);
  const closingText = !isOn(ev.closing_explicit)
    ? "Cierre = inicio"
    : closing
    ? `Cierre: ${fmtDay(closing)}${closing.hh ? ` · ${fmtTime(closing)}` : ""}`
    : "Cierre sin informar";
  const place = [ev.venue, ev.city].filter(Boolean).join(", ");
  const links = eventLinks(ev);

  return (
    <div className="p-5 rounded-3xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all flex flex-col gap-3 min-w-0 glass-shine">
      {(warning || isOn(ev.require_approval) || isOn(ev.sold_out) || isOn(ev.location_unconfirmed) || ev.missing_since) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {warning && <Badge cls="bg-rose-500/15 text-rose-300 border-rose-500/30">{warning}</Badge>}
          {isOn(ev.sold_out) && <Badge cls="bg-rose-500/15 text-rose-300 border-rose-500/30">Agotado</Badge>}
          {isOn(ev.require_approval) && <Badge cls="bg-cyan-500/15 text-cyan-200 border-cyan-500/30">Requiere aprobación</Badge>}
          {isOn(ev.location_unconfirmed) && <Badge cls="bg-white/[0.06] text-white/70 border-white/15">Lugar sin confirmar</Badge>}
          {ev.missing_since && <Badge cls="bg-white/[0.04] text-white/50 border-white/10">Ya no figura en la fuente</Badge>}
        </div>
      )}

      <div className="font-semibold text-white text-base leading-snug break-words">{ev.title}</div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-start gap-2 text-cyan-200">
          <CalendarDays className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{fmtEventWhen(ev)}</span>
        </div>
        <div className="flex items-start gap-2 text-white/70">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/40" />
          <span className="break-words">{place || "Lugar sin informar"}</span>
        </div>
        <div className="flex items-start gap-2 text-white/60">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/40" />
          <span className="break-words">{closingText}</span>
        </div>
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {links.map(link => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-3.5 rounded-xl bg-white/5 hover:bg-cyan-500/15 text-white/80 hover:text-cyan-200 border border-white/10 hover:border-cyan-500/30 text-xs transition-colors flex items-center gap-1.5 min-w-0 max-w-full"
            >
              <span className="truncate">{link.label}</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            </a>
          ))}
        </div>
      )}

      {children && <div className="flex flex-wrap gap-2 border-t border-white/10 mt-1 pt-3">{children}</div>}
    </div>
  );
}

// Fila compacta de un evento descartado, con "Restaurar".
function DismissedRow({ ev, onRestore }) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-semibold text-white/80 break-words">{ev.title}</div>
        <div className="text-[11px] text-white/50 break-words">
          {CATEGORY_LABELS[ev.category] || ev.category} · {fmtEventWhen(ev)}
        </div>
      </div>
      <button onClick={() => onRestore(ev)} className={`${ghostBtnCls} w-full sm:w-auto shrink-0`}>
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Restaurar</span>
      </button>
    </div>
  );
}

// ============================================================================
// Solapa Fuentes
// ============================================================================
function SourceRow({ source, busy, confirming, onToggle, onAskDelete, onCancelDelete, onDelete }) {
  const h = source.health && typeof source.health === "object" ? { ...source, ...source.health } : source;
  const status = STATUS_STYLES[h.last_status];
  const enabled = isOn(source.enabled);
  const isPage = source.kind === "page_hash";

  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 space-y-1">
          <div className={`font-semibold text-sm break-words ${enabled ? "text-white" : "text-white/40"}`}>{source.name}</div>
          {source.url && <div className="text-[11px] text-white/40 font-mono break-all">{source.url}</div>}
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? `Desactivar ${source.name}` : `Activar ${source.name}`}
          onClick={() => onToggle(source)}
          disabled={busy}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
        >
          <span className={`relative w-11 h-6 rounded-full border transition-colors ${enabled ? "bg-cyan-500/40 border-cyan-400/50" : "bg-white/10 border-white/15"}`}>
            <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full transition-all ${enabled ? "left-[22px] bg-cyan-200" : "left-0.5 bg-white/50"}`} />
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {status ? <Badge cls={status.cls}>{status.label}</Badge> : <Badge cls="bg-white/[0.04] text-white/50 border-white/10">Sin datos</Badge>}
        {!enabled && <Badge cls="bg-white/[0.04] text-white/50 border-white/10">Desactivada</Badge>}
        {h.streak_kind && (
          <span className="text-rose-300">
            Racha {h.streak_kind === "down" ? "caída" : "sin resultados"} desde {fmtStamp(h.streak_started_at)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-white/50">
        <span>Última consulta: {fmtStamp(h.last_run_at)}</span>
        {!isPage && <span>Último OK: {fmtStamp(h.last_ok_at)}</span>}
        {!isPage && typeof h.last_count === "number" && <span>Resultados: {h.last_count}</span>}
        {isPage && <span>Código HTTP: {h.last_http_status ?? "sin datos"}</span>}
        {isPage && <span>Último cambio: {fmtStamp(h.last_changed_at)}</span>}
      </div>

      {(h.last_error || source.disabled_reason) && (
        <div className="text-[11px] text-rose-300 break-words">
          {source.disabled_reason ? `Desactivada por ${source.disabled_reason}. ` : ""}
          {h.last_error || ""}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {confirming ? (
          <>
            <button onClick={() => onDelete(source)} disabled={busy} className="min-h-[44px] px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              <span>Confirmar borrado</span>
            </button>
            <button onClick={onCancelDelete} disabled={busy} className={ghostBtnCls}>
              <span>Cancelar</span>
            </button>
          </>
        ) : (
          <button onClick={() => onAskDelete(source)} disabled={busy} className={ghostBtnCls}>
            <Trash2 className="w-3.5 h-3.5 text-white/60" />
            <span>Borrar</span>
          </button>
        )}
      </div>
    </div>
  );
}

function SourcesPanel({ dataVersion, runStatus, onRun, runMsg }) {
  const [sources, setSources] = useState([]);
  const [health, setHealth] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const [form, setForm] = useState({ kind: "luma_discover", value: "", name: "", default_category: "" });
  const [formError, setFormError] = useState(null);
  const [formBusy, setFormBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoadError(null);
      try {
        const [sRes, hRes, cRes] = await Promise.all([
          fetch(`${API}/sources`),
          fetch(`${API}/health`),
          fetch(`${API}/candidates`)
        ]);
        const [sData, hData, cData] = await Promise.all([readJson(sRes), readJson(hRes), readJson(cRes)]);
        if (!alive) return;
        if (!sRes.ok) throw new Error(`Fuentes: ${apiErrorText(sRes.status, sData)}`);
        setSources(Array.isArray(sData) ? sData : (sData && sData.sources) || []);
        setHealth(hRes.ok ? hData : null);
        setCandidates(cRes.ok && cData ? cData.candidates || [] : []);
      } catch (err) {
        if (!alive) return;
        setLoadError(err.message || "No se pudo conectar con la API.");
      }
      if (alive) setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, [dataVersion, reload]);

  const refresh = () => setReload(v => v + 1);

  const handleToggle = async (source) => {
    setBusyId(source.id);
    setActionMsg(null);
    try {
      const r = await postJson("/sources/update", { id: source.id, enabled: !isOn(source.enabled) });
      if (!r.ok) setActionMsg({ tone: "error", text: apiErrorText(r.status, r.data) });
    } catch (err) {
      setActionMsg({ tone: "error", text: `No se pudo actualizar la fuente: ${err.message}` });
    }
    setBusyId(null);
    refresh();
  };

  const handleDelete = async (source) => {
    setBusyId(source.id);
    setActionMsg(null);
    try {
      const r = await postJson("/sources/delete", { id: source.id });
      setActionMsg(r.ok
        ? { tone: "ok", text: `Fuente "${source.name}" borrada. Sus eventos se conservan.` }
        : { tone: "error", text: apiErrorText(r.status, r.data) });
    } catch (err) {
      setActionMsg({ tone: "error", text: `No se pudo borrar la fuente: ${err.message}` });
    }
    setBusyId(null);
    setConfirmId(null);
    refresh();
  };

  const handleCandidate = async (cand, action) => {
    const key = `cand-${cand.calendar_api_id}`;
    setBusyId(key);
    setActionMsg(null);
    try {
      const r = await postJson(`/candidates/${action}`, { cal_api_id: cand.calendar_api_id });
      setActionMsg(r.ok
        ? { tone: "ok", text: action === "accept" ? `Ahora se sigue el calendario "${cand.name || cand.slug}".` : `Calendario "${cand.name || cand.slug}" descartado.` }
        : { tone: "error", text: apiErrorText(r.status, r.data) });
    } catch (err) {
      setActionMsg({ tone: "error", text: `No se pudo procesar el calendario: ${err.message}` });
    }
    setBusyId(null);
    refresh();
  };

  const kindInfo = KIND_BY_ID[form.kind];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setActionMsg(null);
    const body = { kind: form.kind, name: form.name.trim(), value: kindInfo.needsValue ? form.value.trim() : "" };
    if (form.default_category) body.default_category = form.default_category;
    setFormBusy(true);
    try {
      const r = await postJson("/sources", body);
      if (r.ok) {
        setForm(f => ({ ...f, value: "", name: "" }));
        setActionMsg({ tone: "ok", text: `Fuente "${body.name}" agregada.` });
        refresh();
      } else {
        setFormError(apiErrorText(r.status, r.data));
      }
    } catch (err) {
      setFormError(`No se pudo conectar con la API: ${err.message}`);
    }
    setFormBusy(false);
  };

  const running = !!(runStatus && runStatus.running);
  const summary = runStatus && runStatus.last_pass_summary;
  const pageSources = sources.filter(s => s.kind === "page_hash");
  const groups = KINDS
    .filter(k => k.id !== "page_hash")
    .map(k => ({ kind: k, items: sources.filter(s => s.kind === k.id) }))
    .filter(g => g.items.length > 0);
  const unknown = sources.filter(s => !KIND_BY_ID[s.kind]);

  const rowProps = (s) => ({
    source: s,
    busy: busyId === s.id,
    confirming: confirmId === s.id,
    onToggle: handleToggle,
    onAskDelete: (src) => setConfirmId(src.id),
    onCancelDelete: () => setConfirmId(null),
    onDelete: handleDelete
  });

  return (
    <div className="space-y-6">
      {/* Correr ahora + salud */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.04] border border-white/10 space-y-4 glass-shine">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Pasada del radar</div>
            <div className="text-xs text-white/50 break-words">
              {running
                ? "Pasada en curso..."
                : runStatus && runStatus.last_pass_finished_at
                ? `Última pasada terminó: ${fmtStamp(runStatus.last_pass_finished_at)}`
                : "Sin pasadas registradas."}
            </div>
            {!running && summary && summary.events && (
              <div className="text-[11px] text-white/40 mt-0.5">
                Eventos: {summary.events.new ?? 0} nuevos, {summary.events.updated ?? 0} actualizados, {summary.events.missing ?? 0} sin figurar
                {summary.sources ? ` · Fuentes: ${summary.sources.ok ?? 0} OK, ${(summary.sources.error ?? 0) + (summary.sources.timeout ?? 0)} con error` : ""}
              </div>
            )}
          </div>
          <button onClick={onRun} disabled={running} className={`${primaryBtnCls} w-full sm:w-auto`}>
            <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
            <span>{running ? "En curso..." : "Correr ahora"}</span>
          </button>
        </div>
        {runMsg && <Notice tone={runMsg.tone}>{runMsg.text}</Notice>}

        {health && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Fuentes", value: health.sources_total, color: "text-white" },
              { label: "OK", value: health.sources_ok, color: "text-cyan-300" },
              { label: "0 resultados", value: health.sources_zero, color: "text-white/70" },
              { label: "Con error", value: health.sources_error, color: "text-rose-300" }
            ].map(m => (
              <div key={m.label} className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                <div className="text-[10px] text-white/50 uppercase font-semibold">{m.label}</div>
                <div className={`text-xl font-black font-mono ${m.color}`}>{m.value ?? 0}</div>
              </div>
            ))}
          </div>
        )}
        {health && Array.isArray(health.alerting) && health.alerting.length > 0 && (
          <div className="space-y-1 text-[11px] text-rose-300">
            {health.alerting.map(a => (
              <div key={a.id} className="flex items-start gap-1.5 break-words">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>{a.name}: {a.streak_kind === "down" ? "caída" : "sin resultados"} desde {fmtStamp(a.streak_started_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionMsg && <Notice tone={actionMsg.tone} onClose={() => setActionMsg(null)}>{actionMsg.text}</Notice>}

      {/* Alta de fuente */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 rounded-3xl bg-white/[0.04] border border-white/10 space-y-3 glass-shine">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus className="w-4 h-4 text-cyan-400" />
          <span>Agregar fuente</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1 min-w-0">
            <span className="text-[11px] text-white/50">Tipo</span>
            <select
              value={form.kind}
              onChange={(e) => { setForm(f => ({ ...f, kind: e.target.value })); setFormError(null); }}
              className={inputCls}
            >
              {KINDS.map(k => <option key={k.id} value={k.id} className="bg-zinc-900">{k.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 min-w-0">
            <span className="text-[11px] text-white/50">Valor</span>
            <input
              type="text"
              value={kindInfo.needsValue ? form.value : ""}
              disabled={!kindInfo.needsValue}
              placeholder={kindInfo.needsValue ? kindInfo.placeholder : "No requiere valor"}
              onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`${inputCls} disabled:opacity-50`}
            />
          </label>
          <label className="space-y-1 min-w-0">
            <span className="text-[11px] text-white/50">Nombre</span>
            <input
              type="text"
              value={form.name}
              maxLength={80}
              placeholder="Nombre visible (1 a 80 caracteres)"
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </label>
          <label className="space-y-1 min-w-0">
            <span className="text-[11px] text-white/50">Categoría por defecto</span>
            <select
              value={form.default_category}
              onChange={(e) => setForm(f => ({ ...f, default_category: e.target.value }))}
              className={inputCls}
            >
              <option value="" className="bg-zinc-900">Automática</option>
              {CATEGORY_TABS.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.label}</option>)}
            </select>
          </label>
        </div>
        {formError && <Notice tone="error">{formError}</Notice>}
        <button type="submit" disabled={formBusy} className={`${primaryBtnCls} w-full sm:w-auto`}>
          <Plus className="w-3.5 h-3.5" />
          <span>{formBusy ? "Agregando..." : "Agregar"}</span>
        </button>
      </form>

      {loading ? (
        <div className="p-12 text-center">
          <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
        </div>
      ) : loadError ? (
        <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-sm text-rose-300 space-y-3 glass-shine">
          <div className="break-words">{loadError}</div>
          <button onClick={refresh} className={`${ghostBtnCls} mx-auto`}>Reintentar</button>
        </div>
      ) : (
        <>
          {/* Calendarios propuestos */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Calendarios propuestos ({candidates.length})</span>
            </div>
            {candidates.length === 0 ? (
              <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-xs text-white/50">
                No hay calendarios propuestos por ahora.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {candidates.map(c => {
                  const busy = busyId === `cand-${c.calendar_api_id}`;
                  return (
                    <div key={c.calendar_api_id || c.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 min-w-0">
                      <div className="font-semibold text-sm text-white break-words">{c.name || c.slug || c.calendar_api_id}</div>
                      <div className="text-[11px] text-white/40 font-mono break-all">
                        {c.slug ? `luma.com/${c.slug} · ` : ""}visto en {c.seen_count} eventos
                      </div>
                      {Array.isArray(c.sample_titles) && c.sample_titles.length > 0 && (
                        <ul className="text-[11px] text-white/60 space-y-0.5 list-disc pl-4">
                          {c.sample_titles.slice(0, 3).map((t, i) => <li key={i} className="break-words">{t}</li>)}
                        </ul>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button onClick={() => handleCandidate(c, "accept")} disabled={busy} className={primaryBtnCls}>
                          <Check className="w-3.5 h-3.5" />
                          <span>Seguir</span>
                        </button>
                        <button onClick={() => handleCandidate(c, "dismiss")} disabled={busy} className={ghostBtnCls}>
                          <X className="w-3.5 h-3.5" />
                          <span>Descartar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Fuentes por tipo */}
          {groups.map(g => (
            <section key={g.kind.id} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Radar className="w-4 h-4 text-cyan-400" />
                <span>{g.kind.short} ({g.items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {g.items.map(s => <SourceRow key={s.id} {...rowProps(s)} />)}
              </div>
            </section>
          ))}

          {/* Páginas monitoreadas */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Páginas monitoreadas ({pageSources.length})</span>
            </div>
            {pageSources.length === 0 ? (
              <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-xs text-white/50">
                No hay páginas monitoreadas.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pageSources.map(s => <SourceRow key={s.id} {...rowProps(s)} />)}
              </div>
            )}
          </section>

          {unknown.length > 0 && (
            <section className="space-y-3">
              <div className="text-sm font-semibold text-white">Otros tipos ({unknown.length})</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unknown.map(s => <SourceRow key={s.id} {...rowProps(s)} />)}
              </div>
            </section>
          )}

          {sources.length === 0 && (
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-sm text-white/60">
              Todavía no hay fuentes cargadas.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Vista principal
// ============================================================================
export default function EventRadar() {
  const [tab, setTab] = useState("hackatones");
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({});
  const [lastPass, setLastPass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const [runStatus, setRunStatus] = useState(null);
  const [runMsg, setRunMsg] = useState(null);
  const [registered, setRegistered] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [dismissedError, setDismissedError] = useState(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const pollRef = useRef(null);
  const tabRef = useRef(tab);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  const runningRef = useRef(false);
  const aliveRef = useRef(true);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const loadRunStatus = async () => {
    try {
      const res = await fetch(`${API}/run/status`);
      const data = await readJson(res);
      if (!aliveRef.current || !res.ok || !data) return null;
      setRunStatus(data);
      if (data.running) {
        runningRef.current = true;
      } else {
        stopPolling();
        if (runningRef.current) {
          runningRef.current = false;
          setRunMsg({ tone: "ok", text: `Pasada terminada: ${fmtStamp(data.last_pass_finished_at)}.` });
          setDataVersion(v => v + 1);
        }
      }
      return data;
    } catch (err) {
      void err;
      return null;
    }
  };

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(loadRunStatus, 3000);
  };

  // Estado de la pasada al montar; si hay una en curso, se sigue cada 3 s.
  useEffect(() => {
    aliveRef.current = true;
    loadRunStatus().then(d => {
      if (d && d.running && aliveRef.current) startPolling();
    });
    return () => {
      aliveRef.current = false;
      stopPolling();
    };
  }, []);

  const handleRun = async () => {
    setRunMsg(null);
    try {
      const r = await postJson("/run", {});
      if (!aliveRef.current) return;
      if (r.status === 202 || r.status === 409) {
        runningRef.current = true;
        setRunStatus(prev => ({ ...(prev || {}), running: true }));
        setRunMsg(r.status === 409
          ? { tone: "ok", text: "Ya había una pasada en curso; se sigue su estado." }
          : { tone: "ok", text: "Pasada iniciada." });
        startPolling();
      } else {
        setRunMsg({ tone: "error", text: apiErrorText(r.status, r.data) });
      }
    } catch (err) {
      setRunMsg({ tone: "error", text: `No se pudo iniciar la pasada: ${err.message}` });
    }
  };

  // Eventos de la solapa activa (en Mis inscripciones, también los descartados).
  useEffect(() => {
    if (tab === "fuentes") return undefined;
    const ctrl = new AbortController();
    const getJson = (url) =>
      fetch(url, { signal: ctrl.signal }).then(async res => {
        const data = await readJson(res);
        if (!res.ok || !data) throw new Error(apiErrorText(res.status, data));
        return data;
      });
    const isInscripciones = tab === INSCRIPCIONES;
    setLoading(true);
    setError(null);
    setActionMsg(null);
    getJson(isInscripciones ? API : `${API}?category=${encodeURIComponent(tab)}`)
      .then(data => {
        setEvents(!isInscripciones && Array.isArray(data.events) ? data.events : []);
        setRegistered(Array.isArray(data.registered) ? data.registered : []);
        setCounts(data.counts || {});
        setLastPass(data.last_pass || null);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setEvents([]);
        setError(err.message || "No se pudo conectar con la API.");
        setLoading(false);
      });
    if (isInscripciones) {
      setDismissedError(null);
      getJson(`${API}/dismissed`)
        .then(data => setDismissed(Array.isArray(data.events) ? data.events : []))
        .catch(err => {
          if (err.name === "AbortError") return;
          setDismissed([]);
          setDismissedError(err.message || "No se pudo conectar con la API.");
        });
    }
    return () => ctrl.abort();
  }, [tab, retry, dataVersion]);

  // Mueve un evento entre grupos en la UI (optimista) y ajusta los contadores.
  const moveEvent = (ev, from, to) => {
    const bump = (key, delta) =>
      setCounts(c => ({ ...c, [key]: Math.max(0, (c[key] ?? 0) + delta) }));
    const without = (list) => list.filter(e => e.id !== ev.id);
    if (from === "cat") {
      setEvents(without);
      bump(ev.category, -1);
    } else if (from === "registered") {
      setRegistered(without);
      bump(INSCRIPCIONES, -1);
    } else if (from === "dismissed") {
      setDismissed(without);
    }
    if (to === "cat") {
      if (tabRef.current === ev.category) setEvents(list => [...without(list), ev].sort(byStart));
      bump(ev.category, 1);
    } else if (to === "registered") {
      setRegistered(list => [...without(list), ev].sort(byStart));
      bump(INSCRIPCIONES, 1);
    } else if (to === "dismissed") {
      setDismissed(list => [ev, ...without(list)]);
    }
  };

  const handleUserAction = async (ev, action) => {
    const plan = USER_ACTIONS[action];
    setActionMsg(null);
    moveEvent(ev, plan.from, plan.to);
    try {
      const r = await postJson(plan.path, { id: ev.id });
      if (!r.ok) throw new Error(apiErrorText(r.status, r.data));
      if (aliveRef.current) setActionMsg({ tone: "ok", text: `"${ev.title}": ${plan.done}` });
    } catch (err) {
      if (!aliveRef.current) return;
      moveEvent(ev, plan.to, plan.from);
      setActionMsg({ tone: "error", text: `No se pudo ${plan.verb}. ${err.message}` });
    }
  };

  const running = !!(runStatus && runStatus.running);
  const finishedAt = (runStatus && runStatus.last_pass_finished_at) || (lastPass && lastPass.finished_at);
  const activeCat = CATEGORY_TABS.find(c => c.id === tab);
  const isInscripciones = tab === INSCRIPCIONES;
  const shown = isInscripciones ? registered : events;

  return (
    <div className="space-y-6 animate-fadeIn pb-12 min-w-0">
      {/* Encabezado */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-shine">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-base">Radar Eventos</div>
            <div className="text-xs text-white/50">Hackatones, charlas y comunidad · CABA y AMBA</div>
          </div>
        </div>
        <div className="text-xs text-white/50 flex items-center gap-2">
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${running ? "animate-spin" : ""}`} />
          <span>{running ? "Pasada en curso..." : finishedAt ? `Última pasada: ${fmtStamp(finishedAt)}` : "Sin pasadas registradas"}</span>
        </div>
      </div>

      {/* Solapas */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 overflow-x-auto no-scrollbar max-w-full">
        {CATEGORY_TABS.map(c => (
          <button key={c.id} onClick={() => setTab(c.id)} className={tabBtnCls(tab === c.id)}>
            {c.label} ({counts[c.id] ?? 0})
          </button>
        ))}
        <button onClick={() => setTab(INSCRIPCIONES)} className={tabBtnCls(isInscripciones)}>
          Mis inscripciones ({counts[INSCRIPCIONES] ?? 0})
        </button>
        <button onClick={() => setTab("fuentes")} className={tabBtnCls(tab === "fuentes")}>
          Fuentes
        </button>
      </div>

      {tab !== "fuentes" && actionMsg && (
        <Notice tone={actionMsg.tone} onClose={() => setActionMsg(null)}>{actionMsg.text}</Notice>
      )}

      {tab === "fuentes" ? (
        <SourcesPanel dataVersion={dataVersion} runStatus={runStatus} onRun={handleRun} runMsg={runMsg} />
      ) : loading ? (
        <div className="p-12 text-center">
          <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-sm text-rose-300 space-y-3 glass-shine">
          <div className="break-words">No se pudieron cargar los eventos. {error}</div>
          <button onClick={() => setRetry(v => v + 1)} className={`${ghostBtnCls} mx-auto`}>Reintentar</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-sm text-white/60 glass-shine">
          {isInscripciones
            ? "Todavía no te inscribiste a ningún evento próximo."
            : activeCat ? activeCat.empty : "No hay eventos."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map(ev => (
            <EventCard key={ev.id} ev={ev}>
              {isInscripciones ? (
                <>
                  {ev.user_status_at && (
                    <span className="min-h-[44px] flex items-center text-[11px] text-cyan-200/80 mr-auto">
                      Inscripto el {fmtStamp(ev.user_status_at)}
                    </span>
                  )}
                  <button onClick={() => handleUserAction(ev, "unregister")} className={`${ghostBtnCls} flex-1 sm:flex-none`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ya no voy</span>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleUserAction(ev, "register")} className={`${primaryBtnCls} flex-1 sm:flex-none`}>
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>Me inscribí</span>
                  </button>
                  <button onClick={() => handleUserAction(ev, "dismiss")} className={`${ghostBtnCls} flex-1 sm:flex-none`}>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Descartar</span>
                  </button>
                </>
              )}
            </EventCard>
          ))}
        </div>
      )}

      {tab !== "fuentes" && !loading && !error && shown.length > 0 && (
        <div className="text-[11px] text-white/40 text-center">
          {isInscripciones
            ? `${shown.length} ${shown.length === 1 ? "inscripción" : "inscripciones"} a eventos próximos`
            : `${shown.length} ${shown.length === 1 ? "evento" : "eventos"} en ${CATEGORY_LABELS[tab]}`} · horarios en hora de Argentina
        </div>
      )}

      {isInscripciones && !loading && !error && (
        <section className="space-y-3">
          <button
            onClick={() => setShowDismissed(v => !v)}
            aria-expanded={showDismissed}
            className={`${ghostBtnCls} w-full sm:w-auto`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>{showDismissed ? "Ocultar descartados" : "Ver descartados"} ({dismissed.length})</span>
          </button>
          {showDismissed && (
            dismissedError ? (
              <Notice tone="error">No se pudieron cargar los descartados. {dismissedError}</Notice>
            ) : dismissed.length === 0 ? (
              <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 text-center text-xs text-white/50">
                No hay eventos descartados próximos.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dismissed.map(ev => (
                  <DismissedRow key={ev.id} ev={ev} onRestore={(e) => handleUserAction(e, "undismiss")} />
                ))}
              </div>
            )
          )}
        </section>
      )}
    </div>
  );
}
