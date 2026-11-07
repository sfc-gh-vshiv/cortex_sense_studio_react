// Screenshots for the docs (and the video), taken from a running app.
//   APP_URL=http://localhost:8501 OUT=../docs/img MASK=/path/mask.json CHROME=... node capture.mjs
// MASK (optional, keep it out of the repo) is {"replace": [[from, to], ...], "block": [word, ...]}.
// The page text is rewritten in the browser only, before each shot, so a screenshot of a real
// context can leave out names you must not publish. A shot fails if a blocked word is still on screen.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const URL = process.env.APP_URL || "http://localhost:8501";
const OUT = process.env.OUT || "shots";
const SCALE = Number(process.env.SCALE || 2);
const mask = process.env.MASK ? JSON.parse(fs.readFileSync(process.env.MASK, "utf8")) : { replace: [], block: [] };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: SCALE });
await page.addInitScript((rules) => {
  // Case-insensitive, longest first; an all-caps match gets an all-caps replacement.
  const res = rules.slice().sort((a, b) => b[0].length - a[0].length)
    .map(([f, t]) => [new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), t]);
  const fix = (s) => res.reduce((a, [re, t]) => a.replace(re, (m) => (m === m.toUpperCase() && /[A-Z]/.test(m) ? t.toUpperCase() : t)), s);
  const run = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    root.querySelectorAll?.("input,textarea").forEach((i) => { const v = fix(i.value); if (v !== i.value) i.value = v; });
    root.querySelectorAll?.("[title]").forEach((e) => e.setAttribute("title", fix(e.getAttribute("title"))));
  };
  window.__mask = () => run(document.body);
  new MutationObserver(() => window.__mask()).observe(document, { subtree: true, childList: true, characterData: true });
}, mask.replace);

const tab = (name) => page.getByRole("tab", { name, exact: true }).click();
const waitText = (re, timeout = 180000) =>
  page.waitForFunction(([s, f]) => new RegExp(s, f).test(document.querySelector(".sl")?.innerText || ""), [re.source, re.flags], { timeout });
const rects = {};
async function shot(name, focus) {
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__mask());
  const seen = (await page.evaluate(() => document.body.innerText + " " +
    [...document.querySelectorAll("svg text, input, textarea")].map((e) => e.textContent || e.value).join(" "))).toLowerCase();
  const hit = (mask.block || []).filter((w) => seen.includes(w.toLowerCase()));
  if (hit.length) throw new Error(`${name}: blocked words on screen: ${hit.join(", ")}`);
  if (focus) rects[name] = await page.$eval(focus, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; }).catch(() => null);
  await page.screenshot({ path: path.join(OUT, name + ".png") });
  console.log("shot", name);
}
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const scrollTo = (sel, pad = 90) => page.$eval(sel, (e, p) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - p), pad);

await page.goto(URL);
// Streamlit's own toolbar is not part of the app.
await page.addStyleTag({ content: 'header[data-testid="stHeader"],[data-testid="stToolbar"]{display:none!important}' });
await page.waitForSelector(".sl .welcome", { timeout: 120000 });
await shot("01-welcome", ".sl .ctxgrid");
await page.locator(".sl .ctxcard").first().click();
await waitText(/What Sense was asked to index[\s\S]*Tables & views/i);
await shot("02-overview", ".sl .kpis");

await tab("Coverage");
await waitText(/Profiled by Sense[\s\S]*Coverage map/i);
await page.waitForSelector(".sl .mm svg g.node");
await scrollTo(".sl .mm", 160);
await shot("03-coverage", ".sl .mm");

await top();
await tab("Search explorer");
await waitText(/Table profile \d+/i, 90000);
await page.locator(".sl .ritem").nth(1).click();
await shot("04-search", ".sl .ritem.on");

await tab("Knowledge graph");
await waitText(/Nodes found[\s\S]*Relationships found/i);
await page.waitForSelector(".sl .mm svg g.node");
await scrollTo(".sl .mm", 150);
await shot("05-graph", ".sl .mm");
await page.locator(".sl .mm svg g.node", { hasText: process.env.GRAPH_NODE || "Trial Balance" }).first().click().catch(() => page.locator(".sl .mm svg g.node").first().click());
await waitText(/Around /, 20000).catch(() => {});
await scrollTo(".sl .mm", 230);
await shot("06-graph-focus", ".sl .mm");

await top();
await tab("Lineage");
if (process.env.LINEAGE_FQN) {
  await page.getByRole("textbox", { name: "Object" }).fill(process.env.LINEAGE_FQN);
  await page.getByRole("button", { name: "both" }).click();
  await page.getByRole("button", { name: "Show lineage" }).click();
  await waitText(/Lineage graph/, 90000);
  await page.waitForSelector(".sl .mm svg g.node");
  await scrollTo(".sl .kpis", 120);
  await shot("07-lineage", ".sl .mm");
}

await top();
await page.getByRole("tab", { name: /^Manage/ }).click();
await waitText(/_CONTACT|No contact/i, 90000);
await shot("08-manage", ".sl .sections");
await page.getByRole("tab", { name: /^Activate/ }).click().catch(() => {});
await page.waitForTimeout(800);
await shot("09-manage-access");

fs.writeFileSync(path.join(OUT, "rects.json"), JSON.stringify(rects, null, 1));
await browser.close();
