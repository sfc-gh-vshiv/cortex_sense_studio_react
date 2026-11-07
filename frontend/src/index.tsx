// Cortex Sense Studio: the app shell and its seven views.
import React, { useMemo } from "react";
import { Any, busy, defineIslands, job, resetJob, send, setStore, useStore, W } from "./kit";
import { Badge, CSS, Gate, Graph, Markdown, Mermaid, Panel, Tile, useTick } from "./ui";

declare const __SL_VERSION__: string;

const TABS = [
  { id: "overview", label: "Overview" }, { id: "coverage", label: "Coverage" },
  { id: "search", label: "Search explorer" }, { id: "graph", label: "Knowledge graph" },
  { id: "lineage", label: "Lineage" },
];
const PRESETS = ["revenue recognition", "general ledger journal entries", "trial balance", "income statement",
  "balance sheet", "accounts receivable aging", "accounts payable invoices", "cash refunds", "subscriptions",
  "subsidiary hierarchy", "exchange rates", "intercompany eliminations", "accounting period close", "tips", "vendor spend"];
const TYPE_LABEL: Record<string, string> = { table_entity: "Table profile", datamart: "Domain overview", ontology_node: "Ontology node", qbe: "Query pattern" };
const TYPE_PILL: Record<string, string> = { table_entity: "info", datamart: "ok", ontology_node: "warn", qbe: "mute" };
const TYPE_COLOR: Record<string, string> = { table_entity: "#7159FF", datamart: "#11B981", ontology_node: "#F59E0B", qbe: "#94a3b8" };
const SOURCE_META: Record<string, { label: string; color: string; letter: string; what: string }> = {
  catalog_objects: { label: "Tables & views", color: "#7159FF", letter: "T", what: "schema patterns" },
  semantic_views: { label: "Semantic views", color: "#11B981", letter: "S", what: "semantic views" },
  streamlit_apps: { label: "Dashboards & apps", color: "#F59E0B", letter: "D", what: "stages" },
  query_history: { label: "Query history", color: "#0b76a8", letter: "Q", what: "usage patterns" },
  business_ontology: { label: "Business ontology", color: "#db2777", letter: "O", what: "ontology domains" },
};
const ago = (iso?: string) => {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  return s < 90 ? "just now" : s < 5400 ? Math.round(s / 60) + " min ago" : s < 129600 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " days ago";
};
const lagLabel = (lag?: string) => { const h = /^(\d+)h/.exec(lag || ""); if (!h) return lag || "-"; const n = +h[1]; return n % 24 === 0 ? (n / 24 === 7 ? "Weekly" : n / 24 === 1 ? "Daily" : `Every ${n / 24} days`) : `Every ${n} h`; };

type Ctx = { key: string; id: number; db: string; schema: string; name: string; description: string; last_processed_at?: string; target_lag?: string };

/** Enter in an input runs `f`. Used instead of a form element, whose submit Snowsight's sandbox drops. */
const onEnter = (f: () => unknown) => (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); f(); } };
const fmtWhen = (s?: string) => (s ? s.replace("T", " ").replace(/\.\d+/, "").replace("Z", " UTC") : "never");
const short = (fqn: string) => fqn.split(".").pop() || fqn;
/** SCHEMA.OBJECT: short enough to read in a diagram, still unambiguous in most scopes. */
const mid = (fqn: string) => fqn.split(".").slice(-2).join(".");
const isFqn = (x: string) => /^[^.\s]+\.[^.\s]+\.[^.\s]+$/.test(x || "");
const docTitle = (d: Any) => { const t = (d.title || d.key || "").replace(/^#+\s*/, ""); return isFqn(t) ? short(t) : t; };
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

function Err({ error, retry }: { error: string; retry?: () => void }) {
  return <div className="err">{error}{retry ? <> <button className="btn sm" onClick={retry}>Try again</button></> : null}</div>;
}

// ------------------------------------------------------------------ Overview
function SourceCard({ src }: { src: Any }) {
  const m = SOURCE_META[src.name] || { label: src.name, color: "#64748b", letter: "?", what: "rules" };
  const rules: Any[] = src.rules || [];
  const weight = (r: Any) => r.est ?? r.nodes ?? 0;
  const max = Math.max(1, ...rules.map(weight));
  return (
    <div className="srccard">
      <div className="sh">
        <span className="ic" style={{ background: m.color }}>{m.letter}</span>
        <div style={{ minWidth: 0 }}><h4>{m.label}</h4><div className="cap" style={{ margin: 0 }}>{src.enabled ? "Included" : "Turned off"} · {src.type}</div></div>
        <span className="cnt">{rules.length || (src.enabled ? "All" : 0)}</span>
      </div>
      {rules.length ? rules.map((r, i) => (
        <div key={i} className="catrow" style={{ cursor: "default" }} title={r.note || r.rule}>
          <span className="bar" style={{ width: (weight(r) ? (100 * weight(r)) / max : 0) + "%", background: m.color }} />
          <b className="mono" style={{ fontSize: 12 }}>{r.rule}</b>
          <em>{r.est != null ? `~${r.est} tables` : r.nodes != null ? `${r.nodes} nodes · ${r.rels} links` : ""}</em>
        </div>))
        : <div className="muted" style={{ marginTop: 10 }}>{src.name === "query_history" ? "Sense learns SQL patterns from how these tables are queried." : "No rules."}</div>}
    </div>
  );
}

function Overview({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const k = "ov:" + ctx.key;
  const j = job(k, () => send("overview", { ctx: ctx.key }));
  const r: Any = j.result || {};
  const sources: Any[] = r.sources || [];
  const by = (n: string) => sources.find((x) => x.name === n);
  const tables = (by("catalog_objects")?.rules || []).reduce((n: number, x: Any) => n + (x.est || 0), 0);
  const nodes = (by("business_ontology")?.rules || []).reduce((n: number, x: Any) => n + (x.nodes || 0), 0);
  return (
    <>
      <div className="hero">
        <div className="eyebrow">Context · {ctx.db}.{ctx.schema}</div>
        <h2>{ctx.name}</h2>
        <div className="heroSub">{ctx.description || "No description."}</div>
        <div className="kpis">
          <Tile label="Last build" value={ago(ctx.last_processed_at)} sub={fmtWhen(ctx.last_processed_at)} dot="#29B5E8" />
          <Tile label="Refresh" value={lagLabel(ctx.target_lag)} sub={`target lag ${ctx.target_lag || "-"}`} />
          <Tile label="Tables in scope" value={j.loading ? "…" : `~${tables}`} sub={`${(by("catalog_objects")?.rules || []).length} schema patterns`} dot="#7159FF" />
          <Tile label="Ontology nodes" value={j.loading ? "…" : nodes} sub={`${(by("business_ontology")?.rules || []).length} domains · ${(by("semantic_views")?.rules || []).length} semantic views`} dot="#db2777" />
        </div>
      </div>
      {j.loading ? <div className="band"><Gate job={j} title="Reading the context's scope" steps={["Load scope.yaml from the context"]} /></div>
        : j.error ? <Err error={j.error} retry={() => resetJob(k)} />
          : r.error ? <div className="note">Could not read scope.yaml: {r.error}</div> : (
            <>
              <div className="band phead"><div><h3 style={{ margin: 0, fontSize: 18 }}>What Sense was asked to index</h3>
                <div className="cap">Scope version <span className="mono">{r.version || "-"}</span> · updated {fmtWhen(r.updated)}</div></div>
                <button className="btn sm" onClick={() => setStore({ showRaw: !s.showRaw })}>{s.showRaw ? "Hide" : "Show"} scope.yaml</button></div>
              {s.showRaw ? <pre className="mono scroll" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>{r.raw}</pre> : null}
              <div className="srcgrid">{sources.map((x) => <SourceCard key={x.name} src={x} />)}</div>
            </>)}
      <div className="band">
        <Panel title="How Cortex Sense works" cap="Sense keeps metadata and usage patterns only, never data rows. The built documents live in the context's internal index, not in a schema, so Catalog explorer does not show them.">
          <div className="flow">
            <div className="st"><b>1 · Scope</b><span>The tables, semantic views, dashboards and ontology listed above</span></div><span className="ar">→</span>
            <div className="st"><b>2 · Build</b><span>Profiles each object, learns query patterns, links ontology terms</span></div><span className="ar">→</span>
            <div className="st"><b>3 · Index</b><span>Table profiles, domain overviews, ontology nodes, SQL patterns</span></div><span className="ar">→</span>
            <div className="st"><b>4 · Serve</b><span>Agents and Cortex Code look things up at question time</span></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setStore({ tab: "coverage" })}>See what was profiled →</button>
            <button className="btn" onClick={() => setStore({ tab: "search" })}>Search the index →</button>
          </div>
        </Panel>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Coverage
function Coverage({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const k = "cov:" + ctx.key;
  const j = job(k, () => send("coverage", { ctx: ctx.key }));
  const r: Any = j.result;
  const sel = s.covSchema?.[ctx.key];
  const obj = s.covObj?.[ctx.key];
  const pickSchema = (x: string) => setStore({ covSchema: { ...(s.covSchema || {}), [ctx.key]: x }, covObj: { ...(s.covObj || {}), [ctx.key]: null } });
  const pickObj = (x: string) => setStore({ covObj: { ...(s.covObj || {}), [ctx.key]: x } });

  const bySchema = useMemo(() => {
    const m: Record<string, { total: number; ok: number }> = {};
    for (const o of r?.objects || []) { const e = (m[o.schema] ||= { total: 0, ok: 0 }); e.total++; if (o.profiled) e.ok++; }
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [r]);

  if (j.loading) return <Gate job={j} title="Checking every object in scope against Cortex Sense"
    steps={["Expand the scope patterns into objects", "Ask Sense for each object's stored profile"]} stage={j.total && j.total > bySchema.length ? 1 : 0} />;
  if (j.error) return <Err error={j.error} retry={() => resetJob(k)} />;
  const objects: Any[] = r.objects || [];
  const ok = objects.filter((o) => o.profiled).length;

  // One labelled column per database, its schemas stacked inside: a wide, short map
  // that Fit can show at a readable size.
  const map = new Graph("LR");
  map.node("__ctx__", ctx.name + " context", "ctx");
  const dbs: Record<string, { ok: number; total: number; schemas: string[] }> = {};
  for (const [sch, e] of bySchema) {
    const d = (dbs[sch.split(".")[0]] ||= { ok: 0, total: 0, schemas: [] });
    d.ok += e.ok; d.total += e.total; d.schemas.push(sch);
    map.node(sch, `${short(sch)} · ${e.ok}/${e.total}`, sch === sel ? "focus" : e.ok === e.total ? "ok" : e.ok ? "partial" : "none");
  }
  for (const [db, d] of Object.entries(dbs)) {
    map.group("db:" + db, `${db} · ${d.ok}/${d.total}`, d.schemas);
    map.edge("__ctx__", "db:" + db);
  }
  const part = objects.filter((o) => o.schema === sel);
  const drill = new Graph("LR");
  if (sel) {
    drill.node("__s__", sel, "ctx", "hex");
    for (const o of part) { drill.node(o.fqn, short(o.fqn), o.fqn === obj ? "focus" : o.profiled ? "ok" : "none", "box"); drill.edge("__s__", o.fqn); }
  }
  const q = (s.covFilter || "").toLowerCase();
  const rows = objects.filter((o) => (!s.covGaps || !o.profiled) && (!q || o.fqn.toLowerCase().includes(q)));

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row"><Badge complete /> <span className="muted">Each object in scope is checked one by one: Profiled means Sense returned a stored profile for it.</span></div>
        <button className="btn sm" onClick={() => resetJob(k)}>Re-check</button>
      </div>
      {(r.errors || []).length ? <div className="note">{r.errors.length} issue(s): {r.errors.slice(0, 3).join(" · ")}</div> : null}
      <div className="kpis band">
        <Tile label="Objects in scope" value={objects.length} dot="#29B5E8" />
        <Tile label="Profiled by Sense" value={ok} dot="#047857" />
        <Tile label="Not profiled" value={objects.length - ok} dot="#b91c1c" sub={objects.length - ok ? "in scope, not indexed" : "none"} />
        <Tile label="Coverage" value={pct(ok, objects.length) + "%"} sub={`${bySchema.length} schemas`} />
      </div>
      <div className="band">
        <Panel title="Coverage map" cap="Click a schema to see its objects. Green = all profiled · yellow = some · red = none.">
          <Mermaid graph={map} label="Coverage map" onPick={(x) => x !== "__ctx__" && !x.startsWith("db:") && pickSchema(x)}
            reset={sel ? { label: "All schemas", onClick: () => setStore({ covSchema: { ...(s.covSchema || {}), [ctx.key]: null }, covObj: { ...(s.covObj || {}), [ctx.key]: null } }) } : undefined} />
        </Panel>
      </div>
      {sel ? (
        <div className="band">
          <Panel title={short(sel)} cap={sel + " · click an object to open its Sense profile below"}>
            <Mermaid graph={drill} label={"Objects in " + sel} onPick={(x) => x !== "__s__" && pickObj(x)} />
          </Panel>
        </div>) : null}
      <div className="band grid23">
        <Panel title="Schemas" cap="Bar length = share of objects Sense profiled. Click to drill in.">
          {bySchema.map(([sch, e]) => (
            <button key={sch} className={"catrow" + (sch === sel ? " on" : "")} onClick={() => pickSchema(sch)} title={sch}>
              <span className="bar" style={{ width: pct(e.ok, e.total) + "%", background: e.ok === e.total ? "#11B981" : e.ok ? "#F59E0B" : "#ef4444" }} />
              <b>{sch}</b><em>{e.ok}/{e.total}</em>
            </button>))}
        </Panel>
        <Panel title={obj ? short(obj) : "Sense profile"} cap={obj || (sel ? "Click an object in the diagram above." : "Click a schema on the map, then an object.")}
          right={obj ? (r.profiles[obj] ? <span className="pill ok">PROFILED</span> : <span className="pill bad">NOT PROFILED</span>) : null}>
          {!obj ? <div className="muted">The profile text appears here exactly as Cortex Sense stores it.</div>
            : r.profiles[obj] ? <div className="scroll"><Markdown text={r.profiles[obj]} /></div>
              : <div className="note">Sense holds no profile for this object. It is in scope, but the build did not index it.</div>}
        </Panel>
      </div>
      <div className="band">
        <Panel title="All objects" cap={`${rows.length} of ${objects.length} shown`}
          right={<div className="row"><input type="search" placeholder="Filter objects" aria-label="Filter objects" value={s.covFilter || ""} onChange={(e) => setStore({ covFilter: e.target.value })} />
            <div className="seg"><button className={!s.covGaps ? "on" : ""} onClick={() => setStore({ covGaps: false })}>All</button><button className={s.covGaps ? "on" : ""} onClick={() => setStore({ covGaps: true })}>Not profiled</button></div></div>}>
          <div className="tframe"><table className="t"><thead><tr><th>Object</th><th>Status</th></tr></thead><tbody>
            {rows.map((o) => (
              <tr key={o.fqn} className={"click" + (o.fqn === obj ? " on" : "")} onClick={() => setStore({ covSchema: { ...(s.covSchema || {}), [ctx.key]: o.schema }, covObj: { ...(s.covObj || {}), [ctx.key]: o.fqn } })}>
                <td className="mono">{o.fqn}</td><td>{o.profiled ? <span className="pill ok">PROFILED</span> : <span className="pill bad">NOT PROFILED</span>}</td></tr>))}
          </tbody></table></div>
        </Panel>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Search explorer
function snippet(d: Any) {
  return (d.text || "").split("\n").map((l: string) => l.replace(/^#+\s*|\*\*/g, "").trim())
    .filter((l: string) => l && !l.startsWith(d.key) && l !== d.title).slice(0, 3).join(" · ");
}

function SearchResults({ ctx, query, max }: { ctx: Ctx; query: string; max: number }) {
  const s = useStore();
  const k = `srch:${ctx.key}:${max}:${query}`;
  const j = job(k, () => send("search", { ctx: ctx.key, query, max }));
  if (j.loading) return <div className="band"><Gate job={j} title={`Asking Sense about “${query}”`} steps={["Search the context's index"]} hint="usually 3–6 s" /></div>;
  if (j.error) return <Err error={j.error} retry={() => resetJob(k)} />;
  const r: Any = j.result;
  if (r.error) return <Err error={r.error} retry={() => resetJob(k)} />;
  const all: Any[] = r.docs || [];
  const type: string = s.srchType || "all";
  const docs = all.filter((d) => type === "all" || d.type === type);
  const counts: Record<string, number> = {};
  for (const d of all) counts[d.type] = (counts[d.type] || 0) + 1;
  const sel = docs.find((d, i) => `${d.type}:${d.key}:${i}` === s.srchSel) || docs[0];
  const selId = sel ? `${sel.type}:${sel.key}:${docs.indexOf(sel)}` : "";
  return (
    <>
      <div className="band phead">
        <div className="seg" role="tablist" aria-label="Document type">
          <button className={type === "all" ? "on" : ""} onClick={() => setStore({ srchType: "all" })}>All <span className="num">{all.length}</span></button>
          {Object.keys(TYPE_LABEL).map((t) => (
            <button key={t} className={type === t ? "on" : ""} disabled={!counts[t]} onClick={() => setStore({ srchType: t, srchSel: null })}>
              <span className="dot" style={{ background: TYPE_COLOR[t], marginRight: 5 }} />{TYPE_LABEL[t]} <span className="num">{counts[t] || 0}</span></button>))}
        </div>
        <div className="stack" style={{ width: 260 }} aria-hidden>{Object.keys(TYPE_LABEL).map((t) => counts[t] ? <i key={t} style={{ width: (100 * counts[t]) / all.length + "%", background: TYPE_COLOR[t] }} /> : null)}</div>
      </div>
      {counts.qbe && (type === "all" || type === "qbe") ? <div className="muted" style={{ marginTop: 6 }}>Query patterns come from the account-wide index and are not filtered to this context.</div> : null}
      {!docs.length ? <div className="info band">Sense returned no documents for this search.</div> : (
        <div className="band grid23">
          <div className="rlist" role="listbox" aria-label="Results">
            {docs.map((d, i) => {
              const id = `${d.type}:${d.key}:${i}`;
              return (
                <button key={id} role="option" aria-selected={id === selId} className={"ritem" + (id === selId ? " on" : "")} onClick={() => setStore({ srchSel: id })}>
                  <div className="rt"><span className="dot" style={{ background: TYPE_COLOR[d.type] }} /><b title={d.key}>{docTitle(d)}</b></div>
                  <div className="rk mono">{TYPE_LABEL[d.type] || d.type} · {d.key}</div>
                  <div className="rs">{snippet(d)}</div>
                </button>);
            })}
          </div>
          {sel ? (
            <div className="sticky">
              <Panel title={docTitle(sel)} cap={sel.key}
                right={<span className={"pill " + (TYPE_PILL[sel.type] || "mute")}>{(TYPE_LABEL[sel.type] || sel.type).toUpperCase()}</span>}>
                <div className="scroll"><Markdown text={sel.text} /></div>
                {sel.sources ? <div className="muted mono" style={{ marginTop: 8, overflowWrap: "anywhere" }}>Sources: {sel.sources}</div> : null}
              </Panel>
            </div>) : null}
        </div>)}
    </>
  );
}

function Search({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const draft = s.srchDraft ?? "revenue recognition";
  const run = s.srchRun ?? "revenue recognition";
  const max = s.srchMax || 20;
  const go = (q: string) => setStore({ srchDraft: q, srchRun: q, srchSel: null, srchType: "all" });
  return (
    <>
      <div className="hero">
        <div className="row" style={{ justifyContent: "space-between" }}><div className="eyebrow">Search explorer</div><Badge complete={false} /></div>
        <h2>What does Sense know about…</h2>
        <div className="heroSub">Exactly what Cortex Sense returns for a question, as an agent would see it. Documents that no search reaches are not shown.</div>
        <div className="searchbox" style={{ marginTop: 14 }}>
          <span className="muted" aria-hidden>⌕</span>
          <input type="search" aria-label="Search the context" value={draft} onChange={(e) => setStore({ srchDraft: e.target.value })}
            onKeyDown={onEnter(() => draft.trim() && go(draft.trim()))} placeholder="Try: net revenue by subsidiary" />
          <select aria-label="Max results" value={max} onChange={(e) => setStore({ srchMax: +e.target.value })}>{[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n} results</option>)}</select>
          <button className="btn primary" type="button" onClick={() => draft.trim() && go(draft.trim())}>Search</button>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>{PRESETS.map((p) => (
          <button key={p} className={"chip" + (p === run ? " on" : "")} onClick={() => go(p)}>{p}</button>))}</div>
      </div>
      {run ? <SearchResults ctx={ctx} query={run} max={max} /> : null}
    </>
  );
}

// ------------------------------------------------------------------ Knowledge graph
function Knowledge({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const terms: string[] = s.kgTerms || PRESETS;
  const applied: string[] = s.kgApplied || terms;
  const k = `kg:${ctx.key}:${[...applied].sort().join("|")}`;
  const j = job(k, () => send("ontology", { ctx: ctx.key, terms: applied }));
  const focus: string | null = s.kgFocus?.[ctx.key] || null;
  const hops: number = s.kgHops || 1;
  const setFocus = (x: string | null) => setStore({ kgFocus: { ...(s.kgFocus || {}), [ctx.key]: x } });
  const r: Any = j.result;
  const nodes: Record<string, Any> = r?.nodes || {};
  const edges: [string, string, string][] = r?.edges || [];
  const names = useMemo(() => Array.from(new Set([...Object.keys(nodes), ...edges.flatMap((e) => [e[0], e[2]])])).sort(), [r]);

  let keep = new Set(names);
  if (focus && names.includes(focus)) {
    keep = new Set([focus]);
    for (let i = 0; i < hops; i++) {
      const next = new Set(keep);
      for (const [a, , b] of edges) { if (keep.has(a)) next.add(b); if (keep.has(b)) next.add(a); }
      keep = next;
    }
  }
  // Nodes with no relationship would form one long column; list them under the graph instead.
  const linked = new Set(edges.flatMap(([a, , b]) => [a, b]));
  const lonely = [...keep].filter((n) => !linked.has(n)).sort();
  const g = new Graph("LR");
  for (const n of [...keep].filter((n) => linked.has(n) || n === focus).sort()) {
    const kind = nodes[n]?.kind;
    g.node(n, n, n === focus ? "focus" : kind === "entity" ? "entity" : kind === "concept" ? "concept" : "muted", kind === "entity" ? "round" : "stadium");
  }
  for (const [a, rel, b] of edges) if (keep.has(a) && keep.has(b)) g.edge(a, b, rel);

  const toggle = (t: string) => setStore({ kgTerms: terms.includes(t) ? terms.filter((x) => x !== t) : [...terms, t] });
  const addTerm = () => { const v = (s.kgNew || "").trim(); if (v && !terms.includes(v)) setStore({ kgTerms: [...terms, v], kgNew: "" }); };
  const dirty = [...terms].sort().join("|") !== [...applied].sort().join("|");
  return (
    <>
      <Panel title="Knowledge graph" cap="Ontology entities, metrics and relationships that Sense returns for these terms." right={<Badge complete={false} />}>
        <div className="chips">{Array.from(new Set([...PRESETS, ...terms])).map((t) => (
          <button key={t} className={"chip" + (terms.includes(t) ? " on" : "")} aria-pressed={terms.includes(t)} onClick={() => toggle(t)}>{t}</button>))}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <input type="text" aria-label="Add a term" placeholder="Add a term" value={s.kgNew || ""} onChange={(e) => setStore({ kgNew: e.target.value })} onKeyDown={onEnter(addTerm)} />
          <button className="btn" type="button" onClick={addTerm}>Add</button>
          <button className="btn primary" type="button" disabled={!dirty || !terms.length} onClick={() => setStore({ kgApplied: terms })}>Search {terms.length} terms</button>
        </div>
      </Panel>
      {j.loading ? <div className="band"><Gate job={j} title="Collecting ontology documents from Sense" steps={[`Search ${applied.length} terms in parallel`, "Build the graph"]} /></div>
        : j.error ? <Err error={j.error} retry={() => resetJob(k)} /> : (
          <>
            <div className="kpis band">
              <Tile label="Nodes found" value={Object.keys(nodes).length} dot="#2F5597" />
              <Tile label="Relationships found" value={edges.length} dot="#B7791F" />
              <Tile label="Nodes in scope domains" value={r.expected || "-"} sub="node_count in scope.yaml" />
              <Tile label="Terms searched" value={applied.length} sub={r.failed ? `${r.failed} failed` : "all answered"} />
            </div>
            <div className="band">
              <Panel title={focus ? "Around " + focus : "Whole graph"} cap="Click a node to open its Sense document below and center the graph on it."
                right={<div className="row">
                  <select aria-label="Focus on" value={focus || ""} onChange={(e) => setFocus(e.target.value || null)}>
                    <option value="">Whole graph</option>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                  <div className="seg" aria-label="Neighbor hops">{[1, 2, 3].map((h) => <button key={h} className={hops === h ? "on" : ""} disabled={!focus} onClick={() => setStore({ kgHops: h })}>{h} hop{h > 1 ? "s" : ""}</button>)}</div>
                </div>}>
                <div className="legend" style={{ marginBottom: 8 }}><span><i style={{ background: "#DDEBF7" }} />Entity</span><span><i style={{ background: "#FFF2CC" }} />Concept or metric</span><span><i style={{ background: "#EEEEEE" }} />Seen only in a relationship</span></div>
                {g.size ? <Mermaid graph={g} label="Knowledge graph" onPick={setFocus} reset={focus ? { label: "Whole graph", onClick: () => setFocus(null) } : undefined} /> : <div className="info">Sense returned no ontology documents for these terms.</div>}
                {!focus && lonely.length ? (
                  <div className="band"><div className="cap">{lonely.length} nodes have no relationship in these results. Click one to open it.</div>
                    <div className="chips">{lonely.map((n) => <button key={n} className="chip" onClick={() => setFocus(n)}>{n}</button>)}</div></div>) : null}
              </Panel>
            </div>
            <div className="band grid32">
              <Panel title={focus || "Node details"} cap={focus ? (nodes[focus]?.kind || "relationship only") : "Click a node on the graph above."}>
                {!focus ? <div className="muted">The node's document appears here exactly as Cortex Sense stores it.</div>
                  : nodes[focus] ? <div className="scroll"><Markdown text={nodes[focus].text} /></div>
                    : <div className="note">Sense returned relationships for this node but not its own document. Add it as a term to fetch it.</div>}
              </Panel>
              <Panel title="Relationships" cap={focus ? "Click a name to move the focus." : "Pick a node to see its relationships."}>
                {focus ? edges.filter(([a, , b]) => a === focus || b === focus).map(([a, rel, b], i) => (
                  <div key={i} className="row" style={{ marginTop: 4 }}>
                    <button className="chip" onClick={() => setFocus(a)}>{a}</button><span className="muted">{rel} →</span><button className="chip" onClick={() => setFocus(b)}>{b}</button></div>))
                  : null}
              </Panel>
            </div>
          </>)}
    </>
  );
}

// ------------------------------------------------------------------ Lineage
function LineageGraph({ target, direction, distance, start }: { target: string; direction: string; distance: number; start?: string }) {
  const k = `lin:${target}:${direction}:${distance}`;
  const j = job(k, () => send("lineage", { target, direction, distance }));
  if (j.loading) return <Gate job={j} title={"Reading lineage for " + target} steps={["Ask Snowflake lineage"]} />;
  if (j.error) return <Err error={j.error} retry={() => resetJob(k)} />;
  const r: Any = j.result;
  if (r.error) return <Err error={r.error} />;
  const edges: [string, string, number, string][] = r.edges || [];
  const warn = (r.errors || []).length ? <div className="note">{r.errors.join(" · ")}</div> : null;
  if (!edges.length) return <>{warn}<div className="info band">No lineage recorded for {target} in this direction.</div></>;
  const g = new Graph("LR");
  const all = Array.from(new Set(edges.flatMap((e) => [e[0], e[1]]))).sort();
  for (const o of all) g.node(o, mid(o), o.toUpperCase() === target.toUpperCase() ? "focus" : "entity", "box");
  for (const [a, b] of edges) g.edge(a, b);
  const up = edges.filter((e) => e[3] === "upstream").length, down = edges.length - up;
  return (
    <>{warn}
    <div className="kpis band">
      <Tile label="Objects" value={all.length} dot="#29B5E8" />
      <Tile label="Upstream links" value={up} sub="where the data comes from" dot="#2F5597" />
      <Tile label="Downstream links" value={down} sub="what uses it" dot="#11B981" />
      <Tile label="Deepest hop" value={Math.max(...edges.map((e) => e[2]))} />
    </div>
    <div className="band">
      <Panel title="Lineage graph" cap="Click an object to center the lineage on it.">
        <Mermaid graph={g} label={"Lineage of " + target} onPick={(x) => setStore({ linTarget: x, linDraft: x })}
          reset={start && start.toUpperCase() !== target.toUpperCase() ? { label: "Back to " + short(start), onClick: () => setStore({ linTarget: start, linDraft: start }) } : undefined} />
      </Panel>
    </div>
    <div className="band">
      <Panel title="Edges" cap={`${edges.length} edges`}>
        <div className="tframe"><table className="t"><thead><tr><th>Source</th><th>Target</th><th>Dir</th><th>Hop</th></tr></thead><tbody>
          {edges.map(([a, b, d, dir], i) => <tr key={i}><td className="mono" title={a}>{mid(a)}</td><td className="mono" title={b}>{mid(b)}</td>
            <td><span className={"pill " + (dir === "upstream" ? "info" : "ok")}>{dir === "upstream" ? "UP" : "DOWN"}</span></td><td className="num">{d}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
    </>
  );
}

function Lineage() {
  const s = useStore();
  const valid = /^[^.\s]+\.[^.\s]+\.[^.\s]+$/.test((s.linDraft || "").trim());
  // Plain buttons, not a form element: Snowsight's sandboxed frame does not deliver form submits.
  const show = () => { if (valid) setStore({ linTarget: s.linDraft.trim(), linStart: s.linDraft.trim() }); };
  return (
    <>
      <Panel title="Lineage" cap="Where a table's data comes from, and what uses it. Source: Snowflake lineage (SNOWFLAKE.CORE.GET_LINEAGE), not Sense.">
        <div className="row">
          <input className="grow" type="text" aria-label="Object" placeholder="DB.SCHEMA.TABLE" value={s.linDraft || ""} onChange={(e) => setStore({ linDraft: e.target.value })} onKeyDown={onEnter(show)} />
          <div className="seg">{["UPSTREAM", "DOWNSTREAM", "BOTH"].map((d) => <button type="button" key={d} className={(s.linDir || "UPSTREAM") === d ? "on" : ""} onClick={() => setStore({ linDir: d })}>{d.toLowerCase()}</button>)}</div>
          <select aria-label="Distance" value={s.linDist || 3} onChange={(e) => setStore({ linDist: +e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} hop{n > 1 ? "s" : ""}</option>)}</select>
          <button className="btn primary" type="button" disabled={!valid} onClick={show}>Show lineage</button>
        </div>
      </Panel>
      {s.linTarget ? <LineageGraph target={s.linTarget} direction={s.linDir || "UPSTREAM"} distance={s.linDist || 3} start={s.linStart} /> : null}
    </>
  );
}

// ------------------------------------------------------------------ Manage (read-only + Cortex Code prompts)
const MTABS = [
  { id: "status", label: "Status" }, { id: "inbox", label: "Inbox" },
  { id: "accuracy", label: "Accuracy" }, { id: "activate", label: "Activate" },
];
const STATES = ["all", "needs_feedback", "active", "rejected", "superseded", "expired", "absorbed"];
const STATE_LABEL: Record<string, string> = { all: "All", needs_feedback: "Needs approval", active: "Approved", rejected: "Rejected",
  superseded: "Superseded", expired: "Removed", absorbed: "Absorbed" };
const STATE_PILL: Record<string, string> = { needs_feedback: "warn", active: "ok", rejected: "bad", superseded: "mute", expired: "mute", absorbed: "mute" };

/** A ready-to-paste Cortex Code request. The copy button may be blocked in the sandboxed
 *  frame; the text is selectable either way. */
function Prompt({ title, text, why }: { title: string; text: string; why?: string }) {
  const s = useStore();
  const id = "p:" + title;
  const copied = s.copiedP === id && Date.now() - (s.copiedAt || 0) < 3000;
  const copy = () => {
    const done = () => setStore({ copiedP: id, copiedAt: Date.now() });
    try { (navigator as Any).clipboard?.writeText(text).then(done, () => setStore({ copiedP: "fail:" + id })); } catch { setStore({ copiedP: "fail:" + id }); }
  };
  return (
    <div className="prompt">
      <div className="ph2"><b>{title}</b>{why ? <span className="muted"> · {why}</span> : null}
        <button className="btn sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button></div>
      <pre className="mono">{text}</pre>
      {s.copiedP === "fail:" + id ? <div className="muted">Copy is blocked here. Select the text and copy it.</div> : null}
    </div>
  );
}

/** SHOW CONTACTS returns lists as text such as "[A, B]" or "[]". */
const listText = (v: Any) => String(v ?? "").replace(/^\[|\]$/g, "").trim() || "-";

function useManage(ctx: Ctx) {
  const k = "mg:" + ctx.key;
  return { k, j: job(k, () => send("manage", { ctx: ctx.key })) };
}

function ManageGate({ j, k }: { j: Any; k: string }) {
  if (j.loading) return <Gate job={j} title="Reading the context's status" steps={["Context, feedback, evals, access and contacts"]} />;
  if (j.error) return <Err error={j.error} retry={() => resetJob(k)} />;
  return null;
}

function Status({ ctx }: { ctx: Ctx }) {
  const { k, j } = useManage(ctx);
  if (j.loading || j.error) return <ManageGate j={j} k={k} />;
  const r: Any = j.result;
  const c = r.context || ctx;
  const fb: Any[] = r.feedback || [];
  const pending = fb.filter((x) => x.lifecycle_state === "needs_feedback").length;
  const qs = r.questions?.items || [];
  const last = (r.runs || [])[0];
  const score = last?.arms?.cortex_sense?.mean_ac;
  const others = (r.grants || []).filter((g: Any) => g.privilege !== "OWNERSHIP");
  return (
    <>
      {(r.errors || []).length ? <div className="note">{r.errors.join(" · ")}</div> : null}
      <div className="kpis">
        <Tile label="Build" value={c.last_processed_at ? "Ready" : "Not built"} sub={c.last_processed_at ? "last built " + ago(c.last_processed_at) : "no build yet"} dot={c.last_processed_at ? "#047857" : "#b45309"} />
        <Tile label="Accuracy" value={score != null ? Math.round(score * 100) + "%" : qs.length ? "Not run" : "No eval set"} sub={last ? "last run " + fmtWhen(last.run_at) : `${qs.length} questions`} dot="#7159FF" />
        <Tile label="Inbox" value={pending} sub={`needs approval · ${fb.length} records in all`} dot={pending ? "#b45309" : "#94a3b8"} />
        <Tile label="Access" value={others.length ? `${new Set(others.map((g: Any) => g.grantee)).size} roles` : "Owner only"} sub={`owner ${(r.grants || []).find((g: Any) => g.privilege === "OWNERSHIP")?.grantee || "-"}`} dot="#29B5E8" />
      </div>
      <div className="band grid2">
        <Panel title="Build" cap={`Refreshes ${lagLabel(c.target_lag).toLowerCase()} (target lag ${c.target_lag || "-"}).`}>
          <dl className="kv"><dt>Context</dt><dd className="mono">{ctx.key}</dd><dt>Last built</dt><dd>{fmtWhen(c.last_processed_at)}</dd><dt>ID</dt><dd className="num">{ctx.id}</dd></dl>
          <div className="band"><Prompt title="Rebuild now" why="starts a paid build" text={`$cortex-sense resume ${ctx.name}\nRebuild the ${ctx.key} context now (force reprocess).`} />
            <Prompt title="Change the refresh schedule" text={`$cortex-sense resume ${ctx.name}\nChange the refresh target lag of ${ctx.key} to <daily | weekly | N hours>.`} /></div>
        </Panel>
        <Panel title="Notifications" cap="Who hears about builds and feedback.">
          {(r.contacts || []).length ? (
            <div className="tframe"><table className="t"><thead><tr><th>Contact</th><th>Users</th><th>Emails</th></tr></thead><tbody>
              {r.contacts.map((x: Any) => <tr key={x.name}><td className="mono">{x.name}</td><td>{listText(x.users)}</td><td className="muted">{listText(x.emails)}</td></tr>)}</tbody></table></div>)
            : <div className="muted">No notification contact in this schema.</div>}
          <div className="band"><Prompt title="Change who is notified" text={`$cortex-sense resume ${ctx.name}\nConfigure Cortex Sense notifications for ${ctx.name}: notify <USER, USER>.`} /></div>
        </Panel>
      </div>
    </>
  );
}

function Inbox({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const { k, j } = useManage(ctx);
  if (j.loading || j.error) return <ManageGate j={j} k={k} />;
  const all: Any[] = (j.result as Any).feedback || [];
  const state = s.ibState || "all";
  const q = (s.ibQ || "").toLowerCase();
  const counts: Record<string, number> = { all: all.length };
  for (const x of all) counts[x.lifecycle_state] = (counts[x.lifecycle_state] || 0) + 1;
  const list = all.filter((x) => (state === "all" || x.lifecycle_state === state) &&
    (!q || JSON.stringify([x.feedback_rule, x.raw_feedback, x.entity_keys, x.created_by, x.submitted_by]).toLowerCase().includes(q)));
  const sel = list.find((x) => x.feedback_id === s.ibSel) || list[0];
  return (
    <>
      <div className="phead">
        <div className="seg">{STATES.filter((x) => x === "all" || counts[x]).map((x) => (
          <button key={x} className={state === x ? "on" : ""} onClick={() => setStore({ ibState: x, ibSel: null })}>{STATE_LABEL[x]} <span className="num">{counts[x] || 0}</span></button>))}
          {!counts.needs_feedback ? <button disabled>Needs approval <span className="num">0</span></button> : null}</div>
        <input type="search" aria-label="Filter feedback" placeholder="Filter by rule, target or author" value={s.ibQ || ""} onChange={(e) => setStore({ ibQ: e.target.value })} style={{ minWidth: 300 }} />
      </div>
      {!all.length ? (
        <div className="band grid2">
          <Panel title="No feedback yet" cap="Corrections, definitions and instructions that people record on this context appear here.">
            <div className="muted">When someone records feedback, a builder reviews it here and approves or rejects it.</div>
          </Panel>
          <Prompt title="Record a correction" text={`$cortex-sense feedback ${ctx.name}\n<What was wrong, and what the right answer is. For example: for net revenue, use FCT_ORDERS, not STG_ORDERS.>`} />
        </div>
      ) : (
        <div className="band grid23">
          <div className="rlist" role="listbox" aria-label="Feedback records">
            {!list.length ? <div className="muted" style={{ padding: 14 }}>No records match.</div> : list.map((x) => (
              <button key={x.feedback_id} role="option" aria-selected={x === sel} className={"ritem" + (x === sel ? " on" : "")} onClick={() => setStore({ ibSel: x.feedback_id })}>
                <div className="rt"><span className={"pill " + (STATE_PILL[x.lifecycle_state] || "mute")}>{(STATE_LABEL[x.lifecycle_state] || x.lifecycle_state || "").toUpperCase()}</span><b>{x.feedback_rule}</b></div>
                <div className="rk">{x.type} · {(x.entity_keys || []).join(", ") || "no targets"}</div>
              </button>))}
          </div>
          {sel ? (
            <div className="sticky">
              <Panel title={sel.feedback_rule || "Feedback"} cap={`${sel.type} · ${sel.feedback_id}`} right={<span className={"pill " + (STATE_PILL[sel.lifecycle_state] || "mute")}>{(STATE_LABEL[sel.lifecycle_state] || sel.lifecycle_state || "").toUpperCase()}</span>}>
                <dl className="kv">
                  <dt>Reported</dt><dd>{sel.raw_feedback || "-"}</dd>
                  <dt>Question</dt><dd>{sel.triggering_query || "-"}</dd>
                  <dt>Expected</dt><dd>{sel.expected_behavior || "-"}</dd>
                  <dt>Targets</dt><dd className="mono">{(sel.entity_keys || []).join(", ") || "-"}</dd>
                  <dt>Concepts</dt><dd>{(sel.concepts || []).join(", ") || "-"}</dd>
                  <dt>Matches</dt><dd>{sel.indexed_text || "-"}</dd>
                </dl>
                <div className="band">
                  {sel.lifecycle_state === "needs_feedback" ? <>
                    <Prompt title="Approve" text={`$cortex-sense resume ${ctx.name}\nApprove Cortex Sense feedback record ${sel.feedback_id} on ${ctx.key}.`} />
                    <Prompt title="Reject" text={`$cortex-sense resume ${ctx.name}\nReject Cortex Sense feedback record ${sel.feedback_id} on ${ctx.key}.`} /></>
                    : sel.lifecycle_state === "active" ? <Prompt title="Remove" text={`$cortex-sense resume ${ctx.name}\nRemove Cortex Sense feedback record ${sel.feedback_id} on ${ctx.key}.`} /> : null}
                </div>
              </Panel>
            </div>) : null}
        </div>)}
    </>
  );
}

function Accuracy({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const { k, j } = useManage(ctx);
  if (j.loading || j.error) return <ManageGate j={j} k={k} />;
  const r: Any = j.result;
  const qs: Any[] = r.questions?.items || [];
  const runs: Any[] = r.runs || [];
  const sub = s.accTab || "questions";
  return (
    <>
      <div className="phead">
        <div className="seg"><button className={sub === "questions" ? "on" : ""} onClick={() => setStore({ accTab: "questions" })}>Questions <span className="num">{qs.length}</span></button>
          <button className={sub === "runs" ? "on" : ""} onClick={() => setStore({ accTab: "runs" })}>Runs <span className="num">{runs.length}</span></button></div>
        {r.questions?.version ? <span className="muted mono">eval set {r.questions.version}</span> : null}
      </div>
      {sub === "questions" ? (
        !qs.length ? (
          <div className="band grid2">
            <Panel title="No eval questions yet" cap="An eval set is a list of real business questions, each with the answer it must give.">
              <div className="muted">Generate one, review the expected answers, then score an agent against it.</div>
            </Panel>
            <Prompt title="Generate an eval set" text={`$cortex-sense resume ${ctx.name}\ngenerate eval`} />
          </div>
        ) : (
          <div className="band">
            <div className="tframe"><table className="t"><thead><tr><th>ID</th><th>Question</th><th>Expected answer</th><th>Tier</th><th>Status</th></tr></thead><tbody>
              {qs.map((x) => <tr key={x.id}><td className="mono">{x.id}</td><td>{x.question}</td><td className="mono">{x.expected_answer}</td><td>{x.tier || "retrieval"}</td>
                <td><span className={"pill " + (x.user_grade === "confirmed" ? "ok" : x.user_grade === "rejected" ? "bad" : "warn")}>{String(x.user_grade || "").toUpperCase()}</span></td></tr>)}
            </tbody></table></div>
            <div className="band grid2"><Prompt title="Start an evaluation run" why="real judge spend" text={`$cortex-sense resume ${ctx.name}\nrun eval`} />
              <Prompt title="Add a question" text={`$cortex-sense resume ${ctx.name}\nadd "<question>"`} /></div>
          </div>)
      ) : !runs.length ? (
        <div className="band grid2"><Panel title="No runs yet" cap="Each run scores a Cortex Sense agent against the confirmed questions."><div className="muted">Runs use Snowflake's native agent evaluations.</div></Panel>
          <Prompt title="Start an evaluation run" why="real judge spend" text={`$cortex-sense resume ${ctx.name}\nrun eval`} /></div>
      ) : (
        <div className="band">
          <div className="tframe"><table className="t"><thead><tr><th>Run</th><th>When</th><th>Cortex Sense</th><th>Pass / partial / fail</th><th>Incumbent</th></tr></thead><tbody>
            {runs.map((x) => { const a = x.arms?.cortex_sense || {}, b = x.arms?.incumbent; return (
              <tr key={x.run_id}><td className="mono">{x.run_id}</td><td>{fmtWhen(x.run_at)}</td><td className="num">{a.mean_ac != null ? Math.round(a.mean_ac * 100) + "%" : "-"}</td>
                <td className="num">{a.pass_n ?? "-"} / {a.partial_n ?? "-"} / {a.fail_n ?? "-"}</td><td className="num">{b?.mean_ac != null ? Math.round(b.mean_ac * 100) + "%" : "-"}</td></tr>); })}
          </tbody></table></div>
          <div className="band grid2"><Prompt title="Compare the last two runs" text={`$cortex-sense resume ${ctx.name}\ndiff eval`} />
            <Prompt title="Start a new run" why="real judge spend" text={`$cortex-sense resume ${ctx.name}\nrun eval`} /></div>
        </div>)}
    </>
  );
}

function Activate({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const { k, j } = useManage(ctx);
  if (j.loading || j.error) return <ManageGate j={j} k={k} />;
  const grants: Any[] = (j.result as Any).grants || [];
  const owner = grants.find((g) => g.privilege === "OWNERSHIP");
  const others = grants.filter((g) => g.privilege !== "OWNERSHIP");
  const agent = (s.actAgent || "").trim() || "<DB.SCHEMA.AGENT>";
  const role = (s.actRole || "").trim() || "<ROLE>";
  return (
    <div className="grid2">
      <Panel title="Serve it" cap="Put this context in front of the people who ask the questions.">
        <Prompt title="Create a CoWork agent from this context" text={`$cortex-sense resume ${ctx.name}\nCreate a CoWork agent for ${ctx.name}.`} />
        <label className="muted" style={{ display: "block", marginTop: 10 }}>Existing agent
          <input type="text" style={{ width: "100%", marginTop: 4 }} placeholder="DB.SCHEMA.AGENT" value={s.actAgent || ""} onChange={(e) => setStore({ actAgent: e.target.value })} /></label>
        <Prompt title="Add this context to an existing agent" text={`$cortex-sense resume ${ctx.name}\nAdd Cortex Sense ${ctx.key} to agent ${agent}.`} />
        <Prompt title="Create a Cortex Code skill from this context" text={`$cortex-sense resume ${ctx.name}\nCreate a CoCo skill for ${ctx.name}.`} />
      </Panel>
      <Panel title="Who can reach it" cap="Context access lets a role use the context. Each query still runs under the user's own role.">
        <div className="tframe"><table className="t"><thead><tr><th>Role</th><th>Privilege</th><th>Since</th></tr></thead><tbody>
          {owner ? <tr><td className="mono">{owner.grantee}</td><td><span className="pill info">OWNER</span> <span className="muted">a build runs as this</span></td><td>{fmtWhen(owner.created_on).slice(0, 10)}</td></tr> : null}
          {others.map((g, i) => <tr key={i}><td className="mono">{g.grantee}</td><td>{g.privilege}</td><td>{fmtWhen(g.created_on).slice(0, 10)}</td></tr>)}
          {!others.length ? <tr><td colSpan={3} className="muted">Only the owner. Nothing is granted to anyone else yet.</td></tr> : null}
        </tbody></table></div>
        <label className="muted" style={{ display: "block", marginTop: 12 }}>Role to give access to
          <input type="text" style={{ width: "100%", marginTop: 4 }} placeholder="ROLE" value={s.actRole || ""} onChange={(e) => setStore({ actRole: e.target.value })} /></label>
        <Prompt title="Give a role access" text={`GRANT USAGE ON CORTEX SENSE ${ctx.db}.${ctx.schema}."${ctx.name}" TO ROLE ${role};`} why="run in a worksheet or Cortex Code" />
      </Panel>
    </div>
  );
}

function Manage({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const tab = MTABS.some((t) => t.id === s.mtab) ? s.mtab : "status";
  return (
    <>
      <div className="nav" role="tablist" aria-label="Manage">{MTABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setStore({ mtab: t.id })}>{t.label}</button>))}</div>
      {tab === "status" ? <Status ctx={ctx} /> : tab === "inbox" ? <Inbox ctx={ctx} /> : tab === "accuracy" ? <Accuracy ctx={ctx} /> : <Activate ctx={ctx} />}
      <div className="soon">
        <b>Direct management is coming soon.</b> For now, each action gives you a request to paste into
        Cortex Code, which checks it and runs it with your own role.
      </div>
    </>
  );
}

// ------------------------------------------------------------------ shell
/** Rendered after the views, so it sees the jobs they registered in this render. */
function BusyBar() {
  const on = busy();
  useTick(on);
  return on ? <><div className="topbusy" aria-hidden><i /></div><span className="working" role="status"><span className="spin" />Working…</span></> : null;
}

function Welcome({ contexts, onPick }: { contexts: Ctx[]; onPick: (k: string) => void }) {
  return (
    <div className="welcome">
      <div className="whero">
        <div className="eyebrow">Cortex Sense Studio</div>
        <h1>See what Cortex Sense knows about your data</h1>
        <p>Cortex Sense builds a context of your tables, semantic views, dashboards and business terms, so agents answer
          with the right data. Cortex Sense Studio shows you that context: what is in it, what is missing, and how well it answers.</p>
        <div className="wfeat">
          <div><b>Coverage</b><span>Every object in scope, checked: profiled or not.</span></div>
          <div><b>Search</b><span>The exact documents an agent receives for a question.</span></div>
          <div><b>Knowledge graph</b><span>Business terms, metrics and how they link.</span></div>
          <div><b>Lineage</b><span>Where each table's data comes from, and what uses it.</span></div>
          <div><b>Manage</b><span>Build status, feedback inbox, accuracy and access.</span></div>
        </div>
      </div>
      <h2 className="wstep"><span>1</span>Choose a context to begin</h2>
      {!contexts.length ? <div className="note">The app can see no Cortex Sense contexts. Grant USAGE ON CORTEX SENSE &lt;db&gt;.&lt;schema&gt;.&lt;name&gt; to the app owner role.</div> : (
        <div className="ctxgrid">{contexts.map((c) => (
          <button key={c.key} className="ctxcard" onClick={() => onPick(c.key)}>
            <div className="cn">{c.name}</div>
            <div className="cl mono">{c.db}.{c.schema}</div>
            <div className="cd">{c.description || "No description."}</div>
            <div className="cm">{c.last_processed_at ? <><span className="pill ok">READY</span> built {ago(c.last_processed_at)}</> : <span className="pill warn">NOT BUILT</span>}
              <span className="go">Open →</span></div>
          </button>))}</div>)}
      <div className="muted wfoot">Read-only. The app shows what Cortex Sense stores and never changes it.</div>
    </div>
  );
}

function App(p: Any) {
  const s = useStore();
  // Jobs re-register as pending while their view renders; a view that closed must not keep the page "busy".
  for (const k of Object.keys(W.__slPend || {})) delete W.__slPend[k];
  const contexts: Ctx[] = p.contexts || [];
  const tab = TABS.some((t) => t.id === s.tab) ? s.tab : "overview";
  const section = s.section === "manage" ? "manage" : "explore";
  const ctx = contexts.find((c) => c.key === s.ctx);
  const busyBar = <div style={{ position: "fixed", right: 24, bottom: 20, zIndex: 50 }}><BusyBar /></div>;
  if (p.ctxError) return <><Err error={"Could not list Cortex Sense contexts: " + p.ctxError} />{busyBar}</>;
  if (!ctx) return <><Welcome contexts={contexts} onPick={(k) => { setStore({ ctx: k, section: "explore", tab: "overview" }); window.scrollTo(0, 0); }} />{busyBar}</>;
  const view = section === "manage" ? <Manage ctx={ctx} />
    : tab === "overview" ? <Overview ctx={ctx} />
      : tab === "coverage" ? <Coverage ctx={ctx} />
        : tab === "search" ? <Search ctx={ctx} />
          : tab === "graph" ? <Knowledge ctx={ctx} />
            : <Lineage />;
  return (
    <>
      <div className="appbar">
        <div className="brand"><b>Cortex Sense Studio</b></div>
        <div className="ctxchip" title={ctx.description}>
          <span className="lbl">Context</span>
          <b>{ctx.name}</b><span className="mono muted">{ctx.db}.{ctx.schema}</span>
          {contexts.length > 1 ? (
            <select aria-label="Switch context" value={ctx.key} onChange={(e) => setStore({ ctx: e.target.value })}>
              {contexts.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}</select>) : null}
          <button className="btn sm" onClick={() => setStore({ ctx: null })}>Change</button>
        </div>
      </div>
      <div className="sections" role="tablist" aria-label="Section">
        <button role="tab" aria-selected={section === "explore"} className={section === "explore" ? "on" : ""} onClick={() => setStore({ section: "explore" })}>
          Explore <span>what Sense knows</span></button>
        <button role="tab" aria-selected={section === "manage"} className={section === "manage" ? "on" : ""} onClick={() => setStore({ section: "manage" })}>
          Manage <span>status, inbox, accuracy, access</span></button>
      </div>
      {section === "explore" ? <div className="nav" role="tablist" aria-label="Explore">{TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setStore({ tab: t.id })}>{t.label}</button>))}</div> : null}
      {view}
      {busyBar}
    </>
  );
}

defineIslands({ App }, CSS, __SL_VERSION__);
