// Control experiment: does Chromium 143 headless prerender (a) at all,
// (b) with Cache-Control no-cache, (c) with must-revalidate-only, (d) default?
import http from "node:http";
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = process.env.HOME + "/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";

const HTML = (target) => `<!doctype html><html><body><h1>PDP</h1>
<script type="speculationrules">{"prefetch":[{"source":"list","urls":["${target}"],"eagerness":"eager"}],"prerender":[{"source":"list","urls":["${target}"],"eagerness":"eager"}]}</script>
</body></html>`;
const TARGET = `<html><body><h1>Target page content</h1></body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const headers = { "Content-Type": "text/html" };
  if (url.startsWith("/target-a")) headers["Cache-Control"] = "private, no-cache, max-age=0, must-revalidate";
  else if (url.startsWith("/target-b")) headers["Cache-Control"] = "private, max-age=0, must-revalidate";
  else if (url.startsWith("/target-c")) headers["Cache-Control"] = "private, no-store";
  // /target-d: no Cache-Control at all
  if (url.startsWith("/pdp-")) { res.writeHead(200, headers); res.end(HTML("/" + url.replace("/pdp-", "target-"))); }
  else if (url.startsWith("/target-")) { res.writeHead(200, headers); res.end(TARGET); }
  else { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("no"); }
});

await new Promise((r) => server.listen(8099, "127.0.0.1", r));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const out = {};
for (const v of ["a", "b", "c", "d"]) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:8099/pdp-${v}`, { waitUntil: "load" });
  let found = false;
  for (let i = 0; i < 10; i++) {
    found = browser.targets().some((t) => t.type() === "page" && t.url().includes(`/target-${v}`));
    if (found) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  out[`target-${v}`] = found;
  await page.close();
}
await browser.close();
server.close();
fs.writeFileSync("/home/z/my-project/scripts/task108b-prerender-control.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
// a = no-cache+must-revalidate (108 header), b = must-revalidate only, c = no-store (pre-108), d = none
