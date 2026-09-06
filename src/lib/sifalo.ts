// Sifalo Pay gateway client (server-side only).
//
// Docs: https://developer.sifalopay.com/
//   • Hosted checkout:  POST https://api.sifalopay.com/gateway/
//       body { amount, gateway: "checkout", currency: "USD", return_url }
//       → { key, token } → redirect the user to
//         https://pay.sifalo.com/checkout/?key=…&token=…
//       The customer pays there (20+ methods: cards, EVC Plus, eDahab, Sahal,
//       Premier Wallet…) and is returned to return_url with an extra `sid`
//       query parameter (the Sifalo transaction ID).
//   • Verify:           POST https://api.sifalopay.com/gateway/verify.php
//       body { sid } (or { order_id } when sid is unavailable)
//       → { sid, account, payment_type, amount, status: "success"|"failure"|"pending", code }
//         code 601 = paid.
//
// Auth for both endpoints: HTTP Basic with the merchant API username/password.
//
// Required environment variables (Cloudflare Worker → Settings → Variables):
//   SIFALO_USERNAME          API username           (SIFALOPAY_API_USER also accepted)
//   SIFALO_PASSWORD          API password           (SIFALOPAY_API_KEY  also accepted)
//   SIFALO_RETURN_URL_BASE   e.g. https://hayaan.gabeyre80.workers.dev
//   SIFALO_ENVIRONMENT       "live" | "test" (informational — logged in /api/diag only)

const GATEWAY_URL = "https://api.sifalopay.com/gateway/";
const VERIFY_URL = "https://api.sifalopay.com/gateway/verify.php";
const CHECKOUT_PAGE_URL = "https://pay.sifalo.com/checkout/";

export interface SifaloConfig {
  username: string;
  password: string;
  environment: string;
  returnUrlBase: string;
}

/** Read the merchant config from the environment (lazily, per call). */
export function getSifaloConfig(): SifaloConfig {
  const username = (process.env.SIFALO_USERNAME || process.env.SIFALOPAY_API_USER || "").trim();
  const password = (process.env.SIFALO_PASSWORD || process.env.SIFALOPAY_API_KEY || "").trim();
  const environment = (process.env.SIFALO_ENVIRONMENT || "live").trim().toLowerCase();
  const returnUrlBase = (
    process.env.SIFALO_RETURN_URL_BASE ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, ""); // no trailing slash — we append /payment/sifalo
  return { username, password, environment, returnUrlBase };
}

/** True when the merchant credentials are present — the store can take real payments. */
export function isSifaloConfigured(): boolean {
  const { username, password } = getSifaloConfig();
  return Boolean(username && password);
}

function basicAuthHeader(cfg: SifaloConfig): string {
  // btoa is available in both Node 18+ and workerd; credentials are ASCII.
  return `Basic ${btoa(`${cfg.username}:${cfg.password}`)}`;
}

async function postJson(url: string, cfg: SifaloConfig, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(cfg),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  // The gateway may answer with HTML error pages — never assume JSON.
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { ok: false, status: res.status, data: { response: text.slice(0, 300) } as Record<string, unknown> };
  }
}

export interface SifaloInitiateResult {
  ok: boolean;
  redirectUrl?: string;
  error?: string;
}

/**
 * Step 1+2 of the hosted-checkout flow: authenticate the payment and build the
 * URL the browser must be redirected to. `orderRef` is our order id — Sifalo
 * echoes it via the return_url and accepts it for verify.php lookups.
 */
export async function initiateSifaloCheckout(
  amountUsd: number,
  orderRef: string,
): Promise<SifaloInitiateResult> {
  const cfg = getSifaloConfig();
  if (!cfg.username || !cfg.password) {
    return { ok: false, error: "Sifalo Pay is not configured (missing API credentials)." };
  }
  if (!cfg.returnUrlBase) {
    return { ok: false, error: "SIFALO_RETURN_URL_BASE is not set — cannot build the payment return URL." };
  }

  const return_url = `${cfg.returnUrlBase}/payment/sifalo?order_id=${encodeURIComponent(orderRef)}`;
  const { ok, status, data } = await postJson(GATEWAY_URL, cfg, {
    amount: amountUsd.toFixed(2),
    gateway: "checkout",
    currency: "USD",
    return_url,
  });

  const key = typeof data.key === "string" ? data.key : null;
  const token = typeof data.token === "string" ? data.token : null;
  if (!ok || !key || !token) {
    const detail =
      (typeof data.response === "string" && data.response) ||
      (typeof data.message === "string" && data.message) ||
      `gateway returned HTTP ${status}`;
    return { ok: false, error: `Sifalo Pay could not start the payment: ${detail}` };
  }

  const redirectUrl = `${CHECKOUT_PAGE_URL}?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
  return { ok: true, redirectUrl };
}

export type SifaloPaymentState = "paid" | "pending" | "failed" | "unknown";

/**
 * Admin diagnostic: try the PROVIDED credentials against the hosted-checkout
 * endpoint with a minimal $1.00 session and report the gateway's verdict.
 * Nothing is stored or logged — this answers "are these credentials valid?"
 * without touching the deployment's runtime variables.
 */
export async function testSifaloCredentials(
  username: string,
  password: string,
): Promise<{ ok: boolean; detail: string }> {
  const base = getSifaloConfig();
  if (!base.returnUrlBase) {
    return { ok: false, detail: "SIFALO_RETURN_URL_BASE is not set on this deployment." };
  }
  const cfg: SifaloConfig = { ...base, username, password };
  const { ok, status, data } = await postJson(GATEWAY_URL, cfg, {
    amount: "1.00",
    gateway: "checkout",
    currency: "USD",
    return_url: `${base.returnUrlBase}/payment/sifalo?order_id=credential-test`,
  });
  if (ok && typeof data.key === "string" && typeof data.token === "string") {
    return { ok: true, detail: "Credentials accepted — Sifalo returned a checkout session." };
  }
  const detail =
    (typeof data.response === "string" && data.response) ||
    (typeof data.message === "string" && data.message) ||
    (typeof data.error === "string" && data.error) ||
    (Object.keys(data).length > 0 ? JSON.stringify(data).slice(0, 250) : "") ||
    `gateway returned HTTP ${status}`;
  return { ok: false, detail };
}

export interface SifaloVerifyResult {
  state: SifaloPaymentState;
  sid?: string | null;
  paymentType?: string | null;
  amount?: string | null;
  message: string;
}

/** Map a gateway status/code pair to our payment state. */
function mapStatus(data: Record<string, unknown>): SifaloPaymentState {
  const status = String(data.status ?? "").toLowerCase();
  if (status === "success") return "paid";
  if (status === "pending") return "pending";
  if (status === "failure" || status === "failed") return "failed";
  const code = String(data.code ?? "");
  if (code === "601") return "paid";
  if (code === "603") return "pending";
  if (code === "600" || code === "604") return "failed";
  return "unknown";
}

/**
 * Step 3: ask Sifalo whether the transaction really happened.
 * Prefers `sid` (unique); falls back to our order id (verify.php converts it).
 */
export async function verifySifaloPayment(
  sid: string | null,
  orderRef: string | null,
): Promise<SifaloVerifyResult> {
  const cfg = getSifaloConfig();
  if (!cfg.username || !cfg.password) {
    return { state: "unknown", message: "Sifalo Pay is not configured on the server." };
  }

  const body: Record<string, string> = {};
  if (sid) body.sid = sid;
  else if (orderRef) body.order_id = orderRef;
  else return { state: "unknown", message: "No transaction reference to verify." };

  const { ok, status, data } = await postJson(VERIFY_URL, cfg, body);
  if (!ok) {
    const detail =
      (typeof data.response === "string" && data.response) ||
      (typeof data.message === "string" && data.message) ||
      `gateway returned HTTP ${status}`;
    return { state: "unknown", message: `Verification request failed: ${detail}` };
  }

  const state = mapStatus(data);
  const message =
    (typeof data.response === "string" && data.response) ||
    (state === "paid"
      ? "Payment confirmed."
      : state === "pending"
        ? "The transaction is pending approval."
        : state === "failed"
          ? "The transaction failed or was declined."
          : "Unrecognised verification response.");
  return {
    state,
    sid: typeof data.sid === "string" ? data.sid : sid,
    paymentType: typeof data.payment_type === "string" ? data.payment_type : null,
    amount: typeof data.amount === "string" ? data.amount : null,
    message,
  };
}
