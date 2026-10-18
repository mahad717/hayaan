import ZAI from "z-ai-web-dev-sdk";

const zai = await ZAI.create();
const res = await zai.images.generations.create({
  prompt: "a single blank matte power bank on a cream background, no text, no logos",
  size: "1344x768",
});
console.log("top-level keys:", Object.keys(res));
const d = res?.data?.[0];
console.log("data[0] keys:", d ? Object.keys(d) : "none");
if (d?.url) console.log("url:", String(d.url).slice(0, 150));
if (d?.b64_json) console.log("b64 length:", d.b64_json.length);
