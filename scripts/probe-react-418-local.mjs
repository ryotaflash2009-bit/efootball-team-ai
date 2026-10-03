// React #418 の再現プローブ（ローカルだけ・2026-10-04）。
// 127.0.0.1:3100 の proxy が、ローカルの next start（:3000）の HTML 文書を MARKER（例 S:1）の直前で DELAY ms 止め、
// cold の streaming で segment が遅れて届く状態を作る。React の不一致の throw（chunk 4bd1b696 の rD）に記録を差し込み、
// 不一致の fiber と DOM の位置を出す（関数名はビルドで変わりうる。見つからなければ "inject: rD not found"）。
// 本番・外部へはアクセスしない。結果は data/work/r418/ に保存する。
//   npm run build && npx next start -p 3000
//   MSYS_NO_PATHCONV=1 LOADS=30 ROUTES=/managers MARKERS=S:1 DELAYS=200 node scripts/probe-react-418-local.mjs
// 2026-10-04: 対策前 /managers S:1@200 で約 10%（11/110）→ AppShell の Suspense の後 0/480。
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP } from "./lib/headless-chrome.mjs";

const UP = process.env.UP ?? "http://127.0.0.1:3000";
const PORT = 3100;
const ROUTES = (process.env.ROUTES ?? "/squads,/managers,/players/world/89138556575063,/best-xi,/").split(",");
const MARKERS = (process.env.MARKERS ?? "none,S:0,S:1,S:2,first-flight").split(",");
const DELAYS = (process.env.DELAYS ?? "1500").split(",").map(Number);
const LOADS = Number(process.env.LOADS ?? 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HYD = /H418|Minified React error #(418|423|425)|hydrat|did not match|reading 'parentNode'/i;

let cfg = { marker: "none", delay: 0 };
const server = http.createServer(async (req, res) => {
  const up = await fetch(UP + req.url, { headers: { "user-agent": req.headers["user-agent"] ?? "", accept: req.headers.accept ?? "*/*", "accept-encoding": "identity", rsc: req.headers.rsc, "next-router-state-tree": req.headers["next-router-state-tree"], "next-url": req.headers["next-url"] }, redirect: "manual" });
  const headers = {};
  up.headers.forEach((v, k) => { if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) headers[k] = v; });
  res.writeHead(up.status, headers);
  const isDoc = (up.headers.get("content-type") ?? "").includes("text/html");
  let buf = Buffer.from(await up.arrayBuffer());
  if (/\/_next\/static\/chunks\/4bd1b696-[^/]+\.js/.test(req.url)) {
    const INJ = 'function rD(e){try{var _f=e,_p=[];for(var _k=0;_f&&_k<16;_k++){var _t=_f.type,_m=_f.memoizedProps||{};_p.push((typeof _t==="string"?_t:(_t&&(_t.displayName||_t.name))||("tag"+_f.tag))+(_m.className?"."+String(_m.className).slice(0,32):"")+(_m["data-testid"]?"#"+_m["data-testid"]:""));_f=_f.return}var _d=function(f,dep){var o=[];for(var c=f.child;c&&o.length<6;c=c.sibling){var t=c.type;o.push(((typeof t==="string"?t:(t&&(t.displayName||t.name))||("tag"+c.tag))+(dep<5&&c.child?"{"+_d(c,dep+1)+"}":"")))}return o.join(",")};var _dm=e.stateNode&&e.stateNode.childNodes?Array.prototype.map.call(e.stateNode.childNodes,function(x){return x.nodeType===1?x.tagName+(x.id?"#"+x.id:""):x.nodeType===8?"<!--"+x.nodeValue+"-->":"t"}).join(","):"";var _ds=function(x){return !x?"null":x.nodeType===1?x.tagName+(x.id?"#"+x.id:"")+(x.className&&typeof x.className==="string"?"."+x.className.slice(0,20):""):x.nodeType===8?"<!--"+x.nodeValue+"-->":"t:"+String(x.nodeValue).slice(0,20)};var _n0=rN;var _ctx=_n0?("parent="+_ds(_n0.parentNode)+" gp="+_ds(_n0.parentNode&&_n0.parentNode.parentNode)+" prev="+_ds(_n0.previousSibling)+" next2="+_ds(_n0.nextSibling)+" next3="+_ds(_n0.nextSibling&&_n0.nextSibling.nextSibling)+" conn="+_n0.isConnected+" ps="+(rP?(typeof rP.type==="string"?rP.type:rP.tag):"null")):"";console.error("H418CTX "+_ctx);var _n=rN;console.error("H418 kids="+_d(e,0)+" | dom="+_dm+" | fiber="+_p.join(" < ")+" | next="+(_n?(_n.nodeType===1?_n.outerHTML.slice(0,240):"node"+_n.nodeType+":"+String(_n.nodeValue).slice(0,60)):"null"))}catch(_x){console.error("H418 log fail "+_x)}';
    const s = buf.toString("utf8");
    if (s.includes("function rD(e){")) buf = Buffer.from(s.replace("function rD(e){", INJ), "utf8");
    else console.log("inject: rD not found");
  }
  if (!isDoc || cfg.marker === "none") return res.end(buf);
  const html = buf.toString("utf8");
  const needle = cfg.marker === "first-flight" ? "<script>self.__next_f.push([1," : `<div hidden id="${cfg.marker}">`;
  const at = html.indexOf(needle);
  if (at < 0) return res.end(buf);
  res.write(html.slice(0, at));
  await sleep(cfg.delay);
  res.end(html.slice(at));
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await launchIsolatedBrowser();
const tab = await openTab(browser.port, "about:blank");
const c = connectCDP(tab.webSocketDebuggerUrl);
await c.ready;
await c.send("Runtime.enable");
await c.send("Network.enable");
await c.send("Page.enable");
await c.send("Network.setCacheDisabled", { cacheDisabled: true });
let errs = [];
c.on("Runtime.exceptionThrown", (p) => errs.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "").split("\n")[0].slice(0, 1200)));
c.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") errs.push(String(p.args?.map((a) => a.value ?? a.description ?? "").join(" ")).slice(0, 200)); });

const rows = [];
let n = 0;
for (const marker of MARKERS) for (const delay of marker === "none" ? [0] : DELAYS) {
  cfg = { marker, delay };
  for (const route of ROUTES) {
    let hits = 0;
    const samples = [];
    for (let i = 0; i < LOADS; i++) {
      errs = [];
      await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}${route}${route.includes("?") ? "&" : "?"}_p=${n++}` });
      for (let k = 0; k < 80; k++) {
        await sleep(250);
        const r = await c.send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true }).catch(() => null);
        if (r?.result?.value === "complete") break;
      }
      await sleep(1500);
      const h = errs.filter((e) => HYD.test(e) || e.startsWith("H418"));
      if (h.length) { hits++; samples.push(h.filter((x) => x.startsWith("H418CTX")).concat(h).slice(0, 3)); }
    }
    rows.push({ marker, delay, route, loads: LOADS, hydrationErrors: hits, samples: samples.slice(0, 1) });
    console.log(`${marker}@${delay} ${route}: ${hits}/${LOADS}${samples[0] ? "  " + samples[0].join(" || ").slice(0, 900) : ""}`);
  }
}
await closeTab(browser.port, tab.id);
c.close();
await browser.close();
server.close();
mkdirSync(new URL("../data/work/r418/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../data/work/r418/delay-result${process.env.TAG ? "-" + process.env.TAG : ""}.json`, import.meta.url), JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
