// Task 110 — validate the emitted inline scripts after wheel removal.
// Extracts each inline <script> template literal from the TSX sources,
// evaluates the template (reproducing \\\" escaping + ${} interpolation),
// then node --check's the result and asserts the wheels are gone.
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";

const page = readFileSync("/home/z/my-project/src/app/page.tsx", "utf8");
const layout = readFileSync("/home/z/my-project/src/app/layout.tsx", "utf8");

function emitted(src, anchor) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error("anchor not found: " + anchor);
  const a = src.lastIndexOf("__html: `", i);
  if (a < 0) throw new Error("__html backtick not found for " + anchor);
  const start = a + "__html: `".length;
  const end = src.indexOf("`", start); // first backtick after start = closing
  if (end < 0) throw new Error("closing backtick not found for " + anchor);
  const tpl = src.slice(start, end);
  // Evaluate the template literal exactly as the TSX compiler would.
  return new Function("lang", "return `" + tpl + "`")("en");
}

const cover = emitted(page, "__hayaanShopCover");
const restore = emitted(page, "__hayaanShopScroll");
const tap = emitted(layout, "__hayaanTapFeedback");

const checks = [
  ["cover", cover, ["hayaanShopCover", "hayaan-cov", "faf8f1"], ["hayaanCovSpin", "body::before", "rotate"]],
  ["restore", restore, ["hayaanShopScroll", "hayaanShopY"], []],
  ["tap", tap, ["hayaanTapFeedback", "Loading the shop", "if(!label)return"], ["hayaanSpin", "border-top-color", "rotate", "createElement(\"style\")"]],
];

let fail = 0;
for (const [name, code, mustHave, mustNotHave] of checks) {
  const f = `/tmp/task110-${name}.js`;
  writeFileSync(f, code);
  try {
    execFileSync("node", ["--check", f], { stdio: "pipe" });
  } catch (e) {
    console.error(`SYNTAX FAIL ${name}:`, e.stderr?.toString());
    fail = 1;
    continue;
  }
  for (const s of mustHave) {
    if (!code.includes(s)) { console.error(`MISSING in ${name}: ${s}`); fail = 1; }
  }
  for (const s of mustNotHave) {
    if (code.includes(s)) { console.error(`FORBIDDEN in ${name}: ${s}`); fail = 1; }
  }
  console.log(`OK ${name} (${code.length} bytes emitted)`);
}
unlinkSync("/tmp/task110-cover.js");
unlinkSync("/tmp/task110-restore.js");
unlinkSync("/tmp/task110-tap.js");
process.exit(fail);
