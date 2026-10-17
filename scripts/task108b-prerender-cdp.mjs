// Raw CDP prerender check — browser.targets() may hide prerender targets.
import http from "node:http";
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = process.env.HOME + "/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";

const HTML = (target) => `<!doctype html><html><body><h1>PDP</h1>
<script type="speculationrules">{"prerender":[{"source":"list","urls":["${target}"],"eagerness":"eager"}]}</script>
</body></html>`;
const TARGET = `<html><body><h1>Target page content</h1></body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const headers = { "Content-Type": "text/html" };
  if (url.startsWith("/target-a")) headers["Cache-Control"] = "private, no-cache, max-age=0, must-revalidate";
  else if (url.startsWith("/target-b")) headers["Cache-Control"] = "private, max-age=0, must-revalidate";
  else if (url.startsWith("/target-d")) {} // none
  if (url.startsWith("/pdp-")) { res.writeHead(200, headers); res.end(HTML("/" + url.replace("/pdp-", "target-"))); }
  else if (url.startsWith("/target-")) { res.writeHead(200, headers); res.end(TARGET); }
  else { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("no"); }
});
await new Promise((r) => server.listen(8099, "127.0.0.1", r));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-features=Prerender2"],
});
const out = {};
const cdp = await browser.target().createCDPSession();
for (const v of ["a", "b", "d"]) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:8099/pdp-${v}`, { waitUntil: "load" });
  let found = null;
  for (let i = 0; i < 10; i++) {
    const { targetInfos } = await cdp.send("Target.getTargets");
    found = targetInfos.find((t) => t.url.includes(`/target-${v}`) || (t.subtype || "").includes("prerender"));
    if (found) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  out[`target-${v}`] = found ? { type: found.type, subtype: found.subtype || null, url: found.url } : null;
  // also probe document.prerendering inside the initiator (should be false) and
  // whether the spec API exposed the rule via <script> (sanity)
  out[`pdp-${v}-hasRule`] = await page.evaluate(() => !!document.querySelector('script[type="speculationrules"]'));
  await page.close();
}
await browser.close();
server.close();
fs.writeFileSync("/home/z/my-project/scripts/task108b-prerender-cdp.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
