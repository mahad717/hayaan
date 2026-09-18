// Task 63 debug — where does the saved city get lost?
// signup -> PUT /api/account {city} -> GET /api/account -> GET /api/auth/me
const BASE = "https://hayaan.co";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

const email = `task63dbg.${Date.now()}@example.com`;
const signup = await fetch(`${BASE}/api/auth/signup`, {
  method: "POST",
  headers: { "content-type": "application/json", "user-agent": UA },
  body: JSON.stringify({ email, password: "task63pass", name: "Debug Task63" }),
});
console.log("signup:", signup.status);
const cookies = signup.headers.getSetCookie().map((c) => c.split(";")[0]);
const cookie = cookies.join("; ");
console.log("cookies:", cookies.map((c) => c.split("=")[0]).join(", "));

const put = await fetch(`${BASE}/api/account`, {
  method: "PUT",
  headers: { "content-type": "application/json", "user-agent": UA, cookie },
  body: JSON.stringify({ name: "Debug Task63", city: "Hodan" }),
});
console.log("PUT /api/account {name, city}:", put.status, (await put.text()).slice(0, 300));

const acc = await fetch(`${BASE}/api/account`, { headers: { "user-agent": UA, cookie } });
const accBody = await acc.json();
console.log("GET /api/account:", acc.status, JSON.stringify(accBody).slice(0, 300));

const me = await fetch(`${BASE}/api/auth/me`, { headers: { "user-agent": UA, cookie } });
const meBody = await me.json();
console.log("GET /api/auth/me:", me.status, JSON.stringify(meBody).slice(0, 400));
