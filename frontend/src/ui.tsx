// Shared look (DESIGN.md of the Cortex Proliferation app) and building blocks:
// interactive Mermaid, a graph builder, a small Markdown renderer, tiles and the loading gate.
import React, { useEffect, useRef, useState } from "react";
import "@mermaid-js/tiny";   // flowchart-capable build, no CDN; sets globalThis.mermaid
import { Job } from "./kit";

const mermaid = (globalThis as any).mermaid;

type Any = any;

export const CSS = `
.sl{--sf:#29B5E8;--sf-d:#0b76a8;--ink:#0f172a;--mute:#64748b;--lbl:#475569;--line:#e2e8f0;--fill:#f1f5f9;--head:#f8fafc;
  --ok:#047857;--ok-bg:#ecfdf5;--bad:#b91c1c;--bad-bg:#fef2f2;--warn:#b45309;--warn-bg:#fffbeb;
  font-family:'Roboto Condensed',system-ui,-apple-system,sans-serif;color:var(--ink);font-size:13px;line-height:1.45}
.sl *{box-sizing:border-box}
.sl .num{font-variant-numeric:tabular-nums}
.sl .top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px}
.sl .eyebrow{font-size:12.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--sf-d);font-weight:600}
.sl h1{font-size:30px;line-height:1.15;margin:2px 0 0;font-weight:700;letter-spacing:-.02em}
.sl .ctxpick{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sl .ctxpick label{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}
.sl select,.sl input[type=text],.sl input[type=search],.sl textarea{font:13px 'Roboto Condensed',system-ui,sans-serif;color:var(--ink);
  background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 10px;outline:none}
.sl textarea{width:100%;resize:vertical}
.sl select:focus,.sl input:focus,.sl textarea:focus{border-color:var(--sf);box-shadow:0 0 0 3px rgba(41,181,232,.15)}
.sl .nav{display:flex;gap:4px;padding:3px;background:var(--fill);border-radius:12px;overflow-x:auto;margin-bottom:16px}
.sl .nav button{border:0;background:transparent;color:var(--mute);font:600 13px 'Roboto Condensed',system-ui,sans-serif;padding:7px 14px;border-radius:9px;cursor:pointer;white-space:nowrap}
.sl .nav button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(15,23,42,.12)}
.sl .nav button:focus-visible{box-shadow:0 0 0 3px rgba(41,181,232,.35)}
.sl .btn{border:1px solid var(--line);background:#fff;color:var(--ink);font:600 13px 'Roboto Condensed',system-ui,sans-serif;padding:7px 13px;border-radius:10px;cursor:pointer;transition:transform .15s}
.sl .btn:hover{transform:translateY(-1px)}
.sl .btn.primary{background:var(--sf-d);border-color:var(--sf-d);color:#fff}
.sl .btn:disabled{opacity:.5;cursor:default;transform:none}
.sl .btn.sm{padding:4px 9px;font-size:12px}
.sl .seg{display:inline-flex;padding:3px;background:var(--fill);border-radius:10px;gap:2px}
.sl .seg button{border:0;background:transparent;color:var(--mute);font:500 12.5px 'Roboto Condensed',system-ui,sans-serif;padding:5px 10px;border-radius:8px;cursor:pointer}
.sl .seg button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 1px 3px rgba(15,23,42,.12)}
.sl .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:860px){.sl .kpis{grid-template-columns:repeat(2,1fr)}}
.sl .tile{border-radius:16px;padding:14px 16px;background:#fff;border:1px solid var(--line);min-width:0}
.sl .tile .lbl{font-size:12px;color:var(--mute);font-weight:600;text-transform:uppercase;letter-spacing:.07em;display:flex;gap:6px;align-items:center}
.sl .tile .lbl i{width:8px;height:8px;border-radius:3px;display:inline-block}
.sl .tile .big{font-size:clamp(22px,2.4vw,32px);font-weight:700;letter-spacing:-.02em;margin-top:6px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sl .tile .sub{font-size:12px;color:var(--mute);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sl .panel{border:1px solid var(--line);border-radius:18px;background:#fff;padding:16px 18px;min-width:0}
.sl .panel h3{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em;display:flex;align-items:center;gap:8px;overflow-wrap:anywhere;min-width:0}
.sl .phead>div{min-width:0}
.sl .cap{font-size:12.5px;color:var(--mute);margin:3px 0 10px;overflow-wrap:anywhere}
.sl .phead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.sl .band{margin-top:16px}
.sl .grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
.sl .grid32{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:16px}
.sl .grid23{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:16px}
@media (max-width:1000px){.sl .grid2,.sl .grid32,.sl .grid23{grid-template-columns:1fr}}
.sl .pill{display:inline-block;white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11.5px;font-weight:700;letter-spacing:.03em}
.sl .pill.ok{background:var(--ok-bg);color:var(--ok)}.sl .pill.bad{background:var(--bad-bg);color:var(--bad)}
.sl .pill.warn{background:var(--warn-bg);color:var(--warn)}.sl .pill.info{background:#eef2ff;color:#4338ca}
.sl .pill.mute{background:var(--fill);color:var(--mute)}
.sl .catrow{position:relative;display:flex;justify-content:space-between;align-items:center;gap:10px;height:32px;padding:0 12px;margin:5px 0;
  border-radius:8px;background:var(--fill);overflow:hidden;font-size:13px;cursor:pointer;border:0;width:100%;text-align:left;font-family:inherit;color:var(--ink)}
.sl .catrow:hover{box-shadow:inset 0 0 0 1px var(--line)}
.sl .catrow.on{box-shadow:inset 0 0 0 2px var(--sf)}
.sl .catrow .bar{position:absolute;left:0;top:0;bottom:0;opacity:.32}
.sl .catrow b,.sl .catrow em{position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sl .catrow b{font-weight:600}.sl .catrow em{font-style:normal;font-variant-numeric:tabular-nums;color:var(--lbl)}
.sl table.t{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.sl .tframe{border:1px solid var(--line);border-radius:14px;overflow:auto;max-height:520px}
.sl table.t th{position:sticky;top:0;background:var(--head);color:var(--lbl);font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;
  text-align:left;font-weight:600;padding:8px 10px;border-bottom:1px solid var(--line);z-index:1}
.sl table.t td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}
.sl table.t tr:last-child td{border-bottom:0}
.sl table.t tr.click{cursor:pointer}.sl table.t tr.click:hover td{background:#f8fbff}
.sl table.t tr.on td{background:#eef8fd}
.sl .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.sl .chips{display:flex;flex-wrap:wrap;gap:6px}
.sl .chip{border:1px solid var(--line);background:#fff;color:var(--lbl);border-radius:999px;padding:3px 10px;font:500 12.5px 'Roboto Condensed',system-ui,sans-serif;cursor:pointer}
.sl .chip.on{border-color:var(--sf);background:#eef8fd;color:var(--sf-d);font-weight:600}
.sl .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sl .grow{flex:1;min-width:180px}
.sl .muted{color:var(--mute)}
.sl .err{background:var(--bad-bg);color:var(--bad);border-radius:10px;padding:9px 12px;margin:8px 0}
.sl .note{background:var(--warn-bg);color:var(--warn);border-radius:10px;padding:9px 12px;margin:8px 0}
.sl .info{background:#f0f9ff;color:#075985;border-radius:10px;padding:9px 12px;margin:8px 0}
.sl .gate{border:1px dashed #bae6fd;border-radius:18px;padding:22px;display:flex;gap:16px;align-items:flex-start;background:#fbfdff}
.sl .spin{width:22px;height:22px;border-radius:50%;border:3px solid #e0f2fe;border-top-color:var(--sf);animation:slspin .9s linear infinite;flex:none}
@keyframes slspin{to{transform:rotate(360deg)}}
.sl .gate ol{margin:8px 0 0;padding-left:18px;color:var(--mute)}.sl .gate li.now{color:var(--ink);font-weight:600}.sl .gate li.done{color:var(--ok)}
.sl .prog{height:6px;border-radius:999px;background:var(--fill);overflow:hidden;margin-top:10px;max-width:360px}
.sl .prog i{display:block;height:100%;background:var(--sf);transition:width .4s}
.sl .md{overflow-wrap:anywhere}.sl .md h4{margin:12px 0 4px;font-size:15px}.sl .md h5{margin:10px 0 3px;font-size:13.5px}.sl .md p{margin:4px 0}
.sl .md ul{margin:4px 0;padding-left:18px}.sl .md code{background:var(--fill);border-radius:4px;padding:0 4px;font-size:12px}
.sl .md pre{background:var(--head);border:1px solid var(--line);border-radius:10px;padding:8px 10px;overflow:auto;font-size:12px}
.sl .scroll{max-height:560px;overflow:auto}
.sl .mm{position:relative;border:1px solid var(--line);border-radius:14px;background:#fff;overflow:auto;min-height:200px;max-height:900px;cursor:grab;overscroll-behavior:contain}
.sl .mm.panning{cursor:grabbing;user-select:none}
.sl .mm .tools{align-items:center;background:rgba(255,255,255,.92);border-radius:10px;padding:3px}
.sl .mm .zoomv{font-size:12px;color:var(--mute);min-width:40px;text-align:right}
.sl .mm .hint{font-size:11.5px;color:var(--mute);margin-left:6px}
.sl .mm .tools{position:sticky;top:6px;left:6px;z-index:2;display:inline-flex;gap:4px;margin:6px}
.sl .mm .canvas{padding:8px 12px}
.sl .mm svg{max-width:none!important;height:auto}
.sl .mm g.node{cursor:pointer}.sl .mm g.node:hover{opacity:.72}
.sl .card{border:1px solid var(--line);border-radius:14px;margin:8px 0;background:#fff}
.sl .card>button{all:unset;display:flex;gap:10px;align-items:center;width:100%;padding:10px 12px;cursor:pointer;box-sizing:border-box}
.sl .card>button:focus-visible{box-shadow:0 0 0 3px rgba(41,181,232,.35);border-radius:14px}
.sl .card .body{padding:0 14px 12px;border-top:1px solid var(--line)}
.sl .legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--mute)}
.sl .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.sl .kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;font-size:13px}.sl .kv dt{color:var(--mute)}.sl .kv dd{margin:0}
.sl .hero{position:relative;overflow:hidden;border-radius:22px;padding:22px 24px;border:1px solid #dbeafe;
  background:radial-gradient(900px 260px at 0% 0%,rgba(41,181,232,.16),transparent 60%),radial-gradient(700px 260px at 100% 0%,rgba(113,89,255,.12),transparent 60%),linear-gradient(180deg,#fff,#f8fbff);
  box-shadow:0 10px 40px rgba(14,116,144,.08)}
.sl .hero h2{font-size:28px;line-height:1.15;margin:2px 0 0;font-weight:700;letter-spacing:-.02em;overflow-wrap:anywhere}
.sl .heroSub{color:var(--mute);font-size:13.5px;margin-top:6px;max-width:980px}
.sl .hero .kpis{margin-top:16px}.sl .hero .tile{background:rgba(255,255,255,.9)}
.sl .topbusy{position:fixed;left:0;right:0;top:0;height:3px;z-index:1000;overflow:hidden;pointer-events:none}
.sl .topbusy i{position:absolute;top:0;bottom:0;width:30%;background:linear-gradient(90deg,transparent,var(--sf),transparent);animation:slslide 1.1s ease-in-out infinite}
@keyframes slslide{0%{left:-30%}100%{left:100%}}
.sl .working{display:inline-flex;align-items:center;gap:7px;background:#eef8fd;color:var(--sf-d);border-radius:999px;padding:4px 11px;font-size:12.5px;font-weight:600}
.sl .working .spin{width:13px;height:13px;border-width:2px}
.sl .gate{border:1px solid #bae6fd;border-radius:18px;padding:22px 24px;display:flex;gap:18px;align-items:flex-start;
  background:linear-gradient(110deg,#f8fbff 30%,#eef8fd 50%,#f8fbff 70%);background-size:200% 100%;animation:slshimmer 2.2s linear infinite}
@keyframes slshimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.sl .gate .spin{width:30px;height:30px}
.sl .gate b{font-size:16px}
.sl .prog{height:8px;border-radius:999px;background:#e0f2fe;overflow:hidden;margin-top:12px;max-width:420px;position:relative}
.sl .prog i{display:block;height:100%;background:var(--sf);transition:width .5s;border-radius:999px}
.sl .prog.ind i{position:absolute;width:35%;animation:slslide 1.3s ease-in-out infinite}
.sl .skel{height:12px;border-radius:6px;background:#e2e8f0;margin-top:10px;opacity:.6}
.sl .srcgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.sl .srccard{border:1px solid var(--line);border-radius:18px;background:#fff;padding:16px 18px;min-width:0}
.sl .srccard .sh{display:flex;align-items:center;gap:10px}
.sl .srccard .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:15px;flex:none}
.sl .srccard h4{margin:0;font-size:16px}.sl .srccard .cnt{margin-left:auto;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
.sl .flow{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;margin-top:8px}
.sl .flow .st{flex:1;min-width:120px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--head)}
.sl .flow .st b{display:block;font-size:13.5px}.sl .flow .st span{font-size:12px;color:var(--mute)}
.sl .flow .ar{align-self:center;color:var(--mute);font-size:18px}
.sl .rlist{border:1px solid var(--line);border-radius:14px;overflow:auto;max-height:640px;background:#fff}
.sl .ritem{all:unset;box-sizing:border-box;display:block;width:100%;padding:11px 14px;border-bottom:1px solid var(--line);cursor:pointer}
.sl .ritem:last-child{border-bottom:0}.sl .ritem:hover{background:#f8fbff}
.sl .ritem.on{background:#eef8fd;box-shadow:inset 3px 0 0 var(--sf)}
.sl .ritem:focus-visible{box-shadow:inset 0 0 0 2px var(--sf)}
.sl .ritem .rt{display:flex;gap:8px;align-items:center;min-width:0}
.sl .ritem .rt b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px}
.sl .ritem .rk{font-size:11.5px;color:var(--mute);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sl .ritem .rs{font-size:12.5px;color:var(--lbl);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sl .dot{width:9px;height:9px;border-radius:3px;flex:none;display:inline-block}
.sl .stack{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--fill);margin-top:8px}
.sl .sticky{position:sticky;top:12px}
.sl .appbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:4px 0 14px;border-bottom:1px solid var(--line);margin-bottom:14px}
.sl .brand{display:flex;align-items:baseline;gap:10px}.sl .brand .eyebrow{margin:0}.sl .brand b{font-size:30px;letter-spacing:-.02em;line-height:1.1}
.sl .ctxchip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--line);border-radius:999px;padding:5px 6px 5px 16px;background:#fff;min-width:0}
.sl .ctxchip .lbl{font-size:12.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}
.sl .ctxchip b{font-size:17px}.sl .ctxchip select{padding:4px 8px;max-width:260px}
.sl .sections{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;background:var(--fill);border-radius:999px;margin-bottom:12px}
.sl .sections button{border:0;background:transparent;border-radius:999px;padding:10px 16px;cursor:pointer;
  font:700 17px 'Roboto Condensed',system-ui,sans-serif;color:var(--mute);display:flex;align-items:baseline;justify-content:center;gap:8px}
.sl .sections button span{font-weight:400;font-size:14px;color:var(--mute)}
.sl .sections button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(15,23,42,.14)}
.sl .sections button:focus-visible{box-shadow:0 0 0 3px rgba(41,181,232,.35)}
@media (max-width:700px){.sl .sections button span{display:none}}
.sl .welcome{max-width:1180px;margin:0 auto}
.sl .whero{border-radius:22px;padding:34px 36px;border:1px solid #dbeafe;
  background:radial-gradient(900px 300px at 0% 0%,rgba(41,181,232,.18),transparent 60%),radial-gradient(700px 300px at 100% 0%,rgba(113,89,255,.12),transparent 60%),linear-gradient(180deg,#fff,#f8fbff);
  box-shadow:0 10px 40px rgba(14,116,144,.08)}
.sl .whero h1{font-size:clamp(28px,3.4vw,40px);line-height:1.1;margin:6px 0 10px;letter-spacing:-.02em}
.sl .whero p{font-size:15px;color:var(--lbl);max-width:820px;margin:0}
.sl .wfeat{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:22px}
.sl .wfeat div{background:rgba(255,255,255,.85);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.sl .wfeat b{display:block;font-size:14.5px}.sl .wfeat span{font-size:12.5px;color:var(--mute)}
@media (max-width:1000px){.sl .wfeat{grid-template-columns:repeat(2,minmax(0,1fr))}}
.sl .wstep{display:flex;align-items:center;gap:10px;font-size:20px;margin:30px 0 12px}
.sl .wstep span{width:28px;height:28px;border-radius:50%;background:var(--sf-d);color:#fff;display:grid;place-items:center;font-size:14px}
.sl .ctxgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.sl .ctxcard{all:unset;box-sizing:border-box;cursor:pointer;border:1px solid var(--line);border-radius:18px;background:#fff;padding:18px 20px;
  display:flex;flex-direction:column;gap:6px;transition:transform .2s,box-shadow .2s}
.sl .ctxcard:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(15,23,42,.08);border-color:#bae6fd}
.sl .ctxcard:focus-visible{box-shadow:0 0 0 3px rgba(41,181,232,.35)}
.sl .ctxcard .cn{font-size:20px;font-weight:700;letter-spacing:-.01em}.sl .ctxcard .cl{font-size:12px;color:var(--mute)}
.sl .ctxcard .cd{font-size:13px;color:var(--lbl);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.sl .ctxcard .cm{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mute);margin-top:6px}
.sl .ctxcard .go{margin-left:auto;color:var(--sf-d);font-weight:600}
.sl .wfoot{text-align:center;margin:26px 0 8px}
.sl .prompt{border:1px solid var(--line);border-radius:12px;background:var(--head);padding:10px 12px;margin-top:10px}
.sl .prompt .ph2{display:flex;align-items:center;gap:8px}.sl .prompt .ph2 .btn{margin-left:auto}
.sl .prompt pre{margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;user-select:all}
.sl .soon{margin-top:24px;border:1px dashed #bae6fd;background:#f5fbfe;border-radius:14px;padding:12px 16px;color:var(--lbl)}
.sl .searchbox{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:6px 6px 6px 14px;background:#fff}
.sl .searchbox input{border:0!important;box-shadow:none!important;flex:1;font-size:15px;padding:8px 0}
`;

// ------------------------------------------------------------------ small pieces
export function Tile({ label, value, sub, dot }: { label: string; value: React.ReactNode; sub?: React.ReactNode; dot?: string }) {
  return (
    <div className="tile">
      <div className="lbl">{dot ? <i style={{ background: dot }} /> : null}{label}</div>
      <div className="big">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function Panel({ title, cap, right, children }: { title: string; cap?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="phead"><div><h3>{title}</h3>{cap ? <div className="cap">{cap}</div> : null}</div>{right}</div>
      {children}
    </div>
  );
}

export function Badge({ complete }: { complete: boolean }) {
  return complete ? <span className="pill ok">COMPLETE</span> : <span className="pill warn">SEARCH-ONLY</span>;
}

/** Re-render every second, so elapsed time keeps moving between polls. */
export function useTick(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => { if (!on) return; const t = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(t); }, [on]);
}

/** The loading gate: what is running, its steps, a live clock, and progress that never claims 100% early. */
export function Gate({ job, title, steps, stage = 0, hint }: { job: Job; title: string; steps: string[]; stage?: number; hint?: string }) {
  const t0 = useRef(Date.now());
  useTick(true);
  const secs = Math.max(job.elapsed || 0, Math.round((Date.now() - t0.current) / 1000));
  const known = !!job.total;
  const pct = known ? Math.min(95, Math.max(4, Math.round((100 * (job.done || 0)) / job.total!))) : 0;
  return (
    <div className="gate" role="status" aria-live="polite">
      <div className="spin" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{title}</b> <span className="muted num">· {secs}s</span>
        <ol>{steps.map((s, i) => <li key={s} className={i < stage ? "done" : i === stage ? "now" : ""}>{i < stage ? "✓ " : ""}{s}</li>)}</ol>
        <div className={"prog" + (known ? "" : " ind")}><i style={known ? { width: pct + "%" } : undefined} /></div>
        <div className="muted num" style={{ marginTop: 6 }}>
          {known ? `${job.done || 0} of ${job.total} Snowflake calls done` : "Waiting for Snowflake…"}{hint ? " · " + hint : ""}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Markdown (React nodes only, no raw HTML)
function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <b key={k++}>{t.slice(2, -2)}</b> : <code key={k++}>{t.slice(1, -1)}</code>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = (text || "").split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [], table: string[] = [], code: string[] | null = null;
  const flush = () => {
    if (list.length) { out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; }
    if (table.length) { out.push(<pre key={out.length}>{table.join("\n")}</pre>); table = []; }
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (l.trim().startsWith("```")) {
      if (code) { out.push(<pre key={out.length}>{code.join("\n")}</pre>); code = null; } else { flush(); code = []; }
      continue;
    }
    if (code) { code.push(raw); continue; }
    if (/^\s*[-*] /.test(l)) { if (table.length) flush(); list.push(l.replace(/^\s*[-*] /, "")); continue; }
    if (/^\s*\|/.test(l)) { if (list.length) flush(); table.push(l); continue; }
    flush();
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) out.push(h[1].length <= 2 ? <h4 key={out.length}>{inline(h[2])}</h4> : <h5 key={out.length}>{inline(h[2])}</h5>);
    else if (l.trim()) out.push(<p key={out.length}>{inline(l)}</p>);
  }
  if (code) out.push(<pre key={out.length}>{code.join("\n")}</pre>);
  flush();
  return <div className="md">{out}</div>;
}

// ------------------------------------------------------------------ Mermaid graphs
const CLASSES = [
  "classDef ctx fill:#29B5E8,stroke:#11567F,color:#ffffff;",
  "classDef ok fill:#D4EDDA,stroke:#2E7D32;",
  "classDef partial fill:#FFF3CD,stroke:#B7791F;",
  "classDef none fill:#F8D7DA,stroke:#C62828;",
  "classDef entity fill:#DDEBF7,stroke:#2F5597;",
  "classDef concept fill:#FFF2CC,stroke:#B7791F;",
  "classDef focus fill:#29B5E8,stroke:#11567F,color:#ffffff,stroke-width:3px;",
  "classDef muted fill:#EEEEEE,stroke:#999999,color:#555555;",
];
// Every node is the same slightly rounded rectangle (Mermaid's "(text)" shape); colour alone
// says what kind of node it is, so all diagrams look alike.
const SHAPES: Record<string, [string, string]> = { round: ['("', '")'] };

/** A flowchart whose nodes map back to app keys, so a click can say which key was hit. */
export class Graph {
  lines: string[];
  ids = new Map<string, string>();
  keys = new Map<string, string>();
  groups = 0;
  constructor(dir = "LR") { this.lines = [`flowchart ${dir}`]; }
  static clean(s: string) { return String(s).replace(/[\[\]{}()<>|#;"`]/g, " ").replace(/\s+/g, " ").trim() || "?"; }
  node(key: string, label: string, cls = "", shape = "round") {
    if (this.ids.has(key)) return this.ids.get(key)!;
    const id = "n" + this.ids.size;
    this.ids.set(key, id); this.keys.set(id, key);
    const [a, b] = SHAPES.round; void shape;
    this.lines.push(`${id}${a}${Graph.clean(label)}${b}${cls ? ":::" + cls : ""}`);
    return id;
  }
  /** A labelled box around existing nodes, stacked top to bottom inside it. Edges may
   *  point at the group key. Groups are not clickable. */
  group(key: string, label: string, members: string[]) {
    const id = "g" + this.groups++;
    this.ids.set(key, id);
    this.lines.push(`subgraph ${id} ["${Graph.clean(label)}"]`, "direction TB",
      ...members.map((m) => this.ids.get(m)).filter(Boolean) as string[], "end",
      `style ${id} fill:#f8fafc,stroke:#cbd5e1,stroke-width:1px,color:#475569`);
  }
  edge(a: string, b: string, label = "") {
    const x = this.ids.get(a), y = this.ids.get(b);
    if (x && y) this.lines.push(`${x} -->${label ? "|" + Graph.clean(label) + "|" : ""} ${y}`);
  }
  get size() { return this.ids.size; }
  code() { return this.lines.concat(CLASSES).join("\n"); }
}

mermaid.initialize({
  startOnLoad: false, securityLevel: "strict", theme: "neutral",
  fontFamily: "'Roboto Condensed', system-ui, sans-serif",
  flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: false },
  maxEdges: 2000, maxTextSize: 200000,
});
let chain: Promise<unknown> = Promise.resolve();
const MAX_H = 900;
let seq = 0;

/** Render a Graph. Clicking a node calls onPick with that node's app key.
 *  The wheel zooms around the pointer, dragging pans, and Fit shows the whole diagram
 *  (width and height). Sizes are set on the SVG itself, so the scrollbars match. */
export function Mermaid({ graph, onPick, label, reset }: { graph: Graph; onPick?: (key: string) => void; label: string; reset?: { label: string; onClick: () => void } }) {
  const host = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const natural = useRef<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [drawn, setDrawn] = useState(0);
  const code = graph.code();
  const pick = useRef(onPick); pick.current = onPick;
  const keys = useRef(graph.keys); keys.current = graph.keys;
  const dragged = useRef(false);

  // Fit = the panel's width. A tall diagram then scrolls down inside a box of up to
  // MAX_H, instead of shrinking until its labels cannot be read.
  const fitScale = () => {
    const n = natural.current, el = box.current;
    if (!n || !el) return 1;
    return Math.min(1, Math.max(200, el.clientWidth - 28) / n.w);
  };
  const scaleNow = () => (zoom === "fit" ? fitScale() : zoom);

  useEffect(() => {
    let live = true;
    const id = "slmm" + ++seq;
    // Mermaid keeps global state, so renders run one at a time.
    chain = chain.then(() => mermaid.render(id, code)).then((out: Any) => {
      if (!live || !host.current) return;
      const doc = new DOMParser().parseFromString(out.svg, "image/svg+xml");
      const svg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", label);
      host.current.replaceChildren(svg);
      // Mermaid sizes the SVG from text measured before our fonts apply, so labels can spill
      // past its viewBox. Refit the viewBox to what was actually drawn.
      let w = 0, h = 0;
      try {
        const b = (svg as Any).getBBox();
        if (b && b.width > 0 && b.height > 0) {
          const pad = 12;
          w = b.width + 2 * pad; h = b.height + 2 * pad;
          svg.setAttribute("viewBox", `${b.x - pad} ${b.y - pad} ${w} ${h}`);
        }
      } catch { /* getBBox is unavailable in non-rendering DOMs (tests) */ }
      natural.current = w ? { w, h } : null;
      svg.style.maxWidth = "none";
      // Size the box to the diagram at Fit: small diagrams get a short box, big ones up to MAX_H.
      if (w && box.current) {
        const wfit = Math.min(1, Math.max(200, box.current.clientWidth - 28) / w);
        box.current.style.height = Math.round(Math.max(200, Math.min(MAX_H, h * wfit + 64))) + "px";
      }
      svg.querySelectorAll("g.node").forEach((g) => {
        const m = /flowchart-(n\d+)-/.exec(g.id || "");
        if (!m) return;
        g.setAttribute("tabindex", "0");
        const fire = () => { const k = keys.current.get(m[1]); if (k && pick.current) pick.current(k); };
        g.addEventListener("click", () => { if (!dragged.current) fire(); });
        g.addEventListener("keydown", (e: Any) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); } });
      });
      setError(null);
      setZoom("fit");
      setDrawn((n) => n + 1);
    }).catch((e: Any) => { if (live) setError(String(e?.message || e)); });
    return () => { live = false; };
  }, [code]);

  // Apply the zoom to the SVG's own size.
  useEffect(() => {
    const svg = host.current?.querySelector("svg");
    const n = natural.current;
    if (!svg || !n) return;
    const s = scaleNow();
    svg.setAttribute("width", String(Math.round(n.w * s)));
    svg.setAttribute("height", String(Math.round(n.h * s)));
  }, [zoom, drawn]);

  // Wheel: zoom around the pointer. Drag: pan. Both on the scroll box.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!natural.current) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const s0 = scaleNow();
      const s1 = Math.max(0.1, Math.min(4, s0 * Math.exp(-e.deltaY * 0.0015)));
      const cx = (el.scrollLeft + px) / s0, cy = (el.scrollTop + py) / s0;
      setZoom(s1);
      requestAnimationFrame(() => { el.scrollLeft = cx * s1 - px; el.scrollTop = cy * s1 - py; });
    };
    let start: { x: number; y: number; l: number; t: number } | null = null;
    const down = (e: MouseEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest(".tools")) return;
      start = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
      dragged.current = false;
    };
    const move = (e: MouseEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { dragged.current = true; el.classList.add("panning"); }
      if (dragged.current) { el.scrollLeft = start.l - dx; el.scrollTop = start.t - dy; }
    };
    const up = () => { start = null; el.classList.remove("panning"); setTimeout(() => { dragged.current = false; }, 0); };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      el.removeEventListener("wheel", onWheel); el.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
    };
  });

  const step = (f: number) => setZoom(Math.max(0.1, Math.min(4, +(scaleNow() * f).toFixed(3))));
  const pctNow = natural.current ? Math.round(scaleNow() * 100) : 100;
  return (
    <div className="mm" ref={box}>
      <div className="tools">
        <button className="btn sm" aria-label="Zoom in" onClick={() => step(1.25)}>+</button>
        <button className="btn sm" aria-label="Zoom out" onClick={() => step(0.8)}>−</button>
        <button className={"btn sm" + (zoom === "fit" ? " primary" : "")} title="Fit to width" onClick={() => setZoom("fit")}>Fit</button>
        <button className={"btn sm" + (zoom === 1 ? " primary" : "")} onClick={() => setZoom(1)}>100%</button>
        <span className="zoomv num">{pctNow}%</span>
        {reset ? <button className="btn sm" onClick={reset.onClick}>← {reset.label}</button> : null}
        <span className="hint">Scroll to zoom · drag to pan</span>
      </div>
      {error ? <div className="err">Could not draw the diagram: {error}</div> : null}
      <div className="canvas" ref={host} />
    </div>
  );
}
