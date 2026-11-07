// Browser smoke test for Cortex Sense Domain Studio, against a running app (local or deployed).
//   APP_URL=http://localhost:8501 CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run smoke
// Template checks: bundle version, bundle sent once, rebuilt bundle swaps in, bridge input
// never takes focus, nav fits, no console errors, no off-page requests. App checks: every
// tab renders real content, Mermaid nodes are clickable, loading stays visible, lineage both ways.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.APP_URL || "http://localhost:8501";
const BUNDLE = process.env.BUNDLE || path.join(here, "..", "ui", "sl_ui.js");
const VERSION = process.env.EXPECT_VERSION || JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8")).version;
const LONG = 180000;

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const hosts = new Set();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("request", (r) => hosts.add(new globalThis.URL(r.url()).host));
let failed = 0;
const t0 = Date.now();
const check = (name, ok, extra = "") => {
  console.log(`${String(Math.round((Date.now() - t0) / 100) / 10).padStart(6)}s ${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failed++;
};
const text = () => page.$eval(".sl", (e) => e.innerText);
const waitText = (re, timeout = LONG) =>
  page.waitForFunction(([src, flags]) => new RegExp(src, flags).test(document.querySelector(".sl")?.innerText || ""), [re.source, re.flags], { timeout }).then(() => true, () => false);
const tab = (name) => page.getByRole("tab", { name }).click();
const svgNodes = () => page.$$eval(".sl .mm svg g.node", (n) => n.length);
const shot = (n) => process.env.SHOTS && page.screenshot({ path: path.join(process.env.SHOTS, n + ".png"), fullPage: true });

await page.goto(URL);
await page.waitForSelector(".sl .nav", { timeout: 90000 });
check("bundle version " + VERSION, (await page.evaluate(() => window.SnowUI.version)) === VERSION);
check("landing view renders", /Domain Studio/.test(await text()));
check("overview loads the scope", await waitText(/What Sense was asked to index[\s\S]*Tables & views/i, 60000));
check("overview shows source cards", (await page.$$eval(".sl .srccard", (c) => c.length)) >= 3);
await shot("1-overview");

const bridge = await page.evaluate(() => {
  const i = document.querySelector(".st-key-sl_bridge input");
  return { tab: i?.tabIndex, hidden: i?.getAttribute("aria-hidden") };
});
check("bridge input out of the tab order", bridge.tab === -1 && bridge.hidden === "true");
await page.waitForFunction(() => document.getElementById("sl-a-bundle")?.dataset.code === "", null, { timeout: 30000 }).catch(() => {});
check("bundle sent once: later reruns carry a placeholder",
  await page.evaluate(() => document.getElementById("sl-a-bundle")?.dataset.code === ""));

for (const w of [1440, 1100, 800]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(150);
  const fits = await page.$eval(".sl .nav", (n) => n.scrollWidth <= n.clientWidth + 1 || getComputedStyle(n).overflowX === "auto");
  check(`nav fits or scrolls at ${w}px`, fits);
}
await page.setViewportSize({ width: 1440, height: 900 });

// Coverage: a two-stage background job, a Mermaid map, and click-through.
await tab("Coverage");
const before = await page.evaluate(() => document.activeElement?.tagName);
check("coverage gate shows while checking", await waitText(/Checking every object|Coverage map/, 30000));
check("a Working indicator shows while it loads", await page.waitForSelector(".sl .working", { timeout: 10000 }).then(() => true, () => false));
const faded = await page.evaluate(() => [...document.querySelectorAll("[data-stale=true]")].some((e) => getComputedStyle(e).opacity !== "1"));
check("the page is never faded while a rerun runs", !faded);
check("coverage result arrives", await waitText(/Profiled by Sense[\s\S]*Coverage map/i));
await page.waitForSelector(".sl .mm svg g.node", { timeout: 30000 }).catch(() => {});
check("coverage map draws nodes", (await svgNodes()) > 1, `${await svgNodes()} nodes`);
check("focus never moved to the bridge input",
  (await page.evaluate(() => !document.activeElement?.closest(".st-key-sl_bridge"))) && before !== "INPUT");
const nodeLabel = await page.$$eval(".sl .mm svg g.node", (ns) => ns.map((n) => n.textContent || "").find((t) => /\d+\/\d+/.test(t)) || "");
const schema = nodeLabel.split("·")[0].trim();
await page.locator(".sl .mm svg g.node", { hasText: nodeLabel.trim() }).first().click();
check("clicking a schema node drills into it", await waitText(new RegExp(schema.replace(/[.$]/g, "\\$&") + " · click an object"), 20000), schema);
await page.waitForFunction(() => document.querySelectorAll(".sl .mm svg").length >= 2, null, { timeout: 20000 }).catch(() => {});
const objNode = page.locator(".sl .grid23 .mm svg g.node").nth(1);
await objNode.click().catch(() => {});
check("clicking an object opens its Sense profile", await waitText(/PROFILED|NOT PROFILED/, 20000));
const scrollY = await page.evaluate(() => { window.scrollTo(0, 600); return window.scrollY; });
await page.waitForTimeout(1500);
check("scroll position survives reruns", Math.abs((await page.evaluate(() => window.scrollY)) - scrollY) < 40);
await shot("2-coverage");

// Search explorer.
await page.evaluate(() => window.scrollTo(0, 0));
await tab("Search explorer");
check("search returns Sense documents", await waitText(/Table profile \d+[\s\S]*(TABLE PROFILE|DOMAIN OVERVIEW|ONTOLOGY NODE)/i, 90000));
await page.locator(".sl .ritem").nth(1).click();
check("a result opens in the detail panel", await page.$eval(".sl .ritem.on", (e) => !!e).catch(() => false) && /Grain|Purpose|Description/i.test(await text()));
await shot("3-search");

// Knowledge graph: parallel searches, a graph, click to focus.
await tab("Knowledge graph");
check("ontology graph loads", await waitText(/Nodes found[\s\S]*Relationships found/i, LONG));
await page.waitForSelector(".sl .mm svg g.node", { timeout: 60000 }).catch(() => {});
const n0 = await svgNodes();
check("knowledge graph draws nodes", n0 > 5, `${n0} nodes`);
await page.locator(".sl .mm svg g.node").first().click();
check("clicking a node focuses the graph", await waitText(/Around |Relationships/, 20000));
await shot("4-graph");

// Lineage: renders a graph, or the grant the role needs.
await tab("Lineage");
await page.getByRole("textbox", { name: "Object" }).fill(process.env.LINEAGE_FQN || "SI_DDACCOUNTING.DDACCOUNTING_SNOW_INTELLIGENCE.V_GL_TRANSACTIONS");
await page.getByRole("button", { name: "both" }).click();
await page.getByRole("button", { name: "Show lineage" }).click();
check("lineage both ways shows a graph", await waitText(/Lineage graph/, 90000), (await text()).match(/(Incorrect[^\n]*|VIEW LINEAGE[^\n]*|No lineage recorded)/)?.[0] || "");
await shot("5-lineage");

// A rebuilt bundle reaches the open page on the next rerun and renders (no blank page).
const held = await page.evaluate(() => window.__slAssets?.bundle);
const orig = fs.readFileSync(BUNDLE);
fs.writeFileSync(BUNDLE, Buffer.concat([orig, Buffer.from("\n")]));
try {
  await tab("Overview");
  await page.mouse.click(5, 450);
  await page.keyboard.press("r");
  await page.waitForFunction((h) => window.__slAssets?.bundle && window.__slAssets.bundle !== h, held, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  check("rebuilt bundle swaps in", (await page.evaluate(() => window.__slAssets?.bundle)) !== held);
  check("app still renders after the swap", /Domain Studio/.test(await text()));
} finally {
  fs.writeFileSync(BUNDLE, orig);
}

const local = new Set([new globalThis.URL(URL).host]);
const offPage = [...hosts].filter((h) => h && !local.has(h));
check("no requests to other hosts", offPage.length === 0, offPage.join(", "));
check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
await browser.close();
process.exit(failed ? 1 : 0);
