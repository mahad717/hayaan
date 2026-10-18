// Task 117 — delete the 7 agreed TEST accounts from live Supabase (guarded).
// Successor of scripts/task76-cleanup.mjs, simplified by the CASCADE map:
//   public.users delete  => cascades orders/order_items/carts/cart_items
//                           (+ payments/order_item_costs via their cascades)
//   auth.users   delete  => cascades identities/sessions/refresh_tokens,
//                           product_reviews, wishlist_items
//
// Requires SUPABASE_SERVICE_ROLE_KEY in /home/z/my-project/.env (owner-supplied
// runtime secret). NEVER touches gabeyre80@gmail.com, baashaalecade@gmail.com,
// admin@shop.demo. Any candidate that unexpectedly has orders is SKIPPED
// (delete it by hand after a human looks at it) — this script never deletes
// order-carrying accounts.
//
// Usage:  node scripts/task117-cleanup.mjs            (dry run — audit + plan)
//         node scripts/task117-cleanup.mjs --execute  (actually deletes)
import { readFileSync } from 'node:fs';

const EXECUTE = process.argv.includes('--execute');
const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
    .filter(([k, v]) => k && v)
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SK = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SK) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env — ask the owner or use scripts/task117-cleanup.sql in the dashboard.');
  process.exit(2);
}

const hdr = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const req = async (method, path, body) => {
  const r = await fetch(`${URL}${path}`, { method, headers: hdr, body: body ? JSON.stringify(body) : undefined });
  let b = null; try { b = await r.json(); } catch {}
  return { status: r.status, body: b };
};

const KEEP = new Set(['gabeyre80@gmail.com', 'baashaalecade@gmail.com', 'admin@shop.demo']);
const CANDIDATES = [
  'customer@shop.demo',                  // demo customer — audited 2026-10-18: 0 orders
  'task83-probe@hayaan-testing.com',     // Task 83 createUser health probe
  't85-reviewer@hayaan-testing.com',     // created by the Task 117 audit oracle (never a prod E2E account)
  't88-probe@shop.demo',                 // Task 88 wishlist degradation probe
  't90-norman@shop.demo',                // Task 90 browser-verified signup (1 cart item)
  'qa.task113@hayaan.co',                // Task 113 E2E v1 (locked: unknown password)
  'qa.task113b@hayaan.co',               // Task 113 E2E v2/v3
];

// 1. auth users
const list = await req('GET', '/auth/v1/admin/users?per_page=1000');
if (list.status !== 200) { console.error('admin list failed', list.status, JSON.stringify(list.body).slice(0, 200)); process.exit(1); }
const authUsers = list.body.users || [];
const byEmail = new Map(authUsers.map(u => [(u.email || '').toLowerCase(), u]));

console.log(`auth users total: ${authUsers.length}`);
for (const email of CANDIDATES) {
  const u = byEmail.get(email);
  console.log(`  ${u ? 'FOUND ' : 'absent'}  ${email}${u ? ` id=${u.id} created=${u.created_at}` : ''}`);
}
const unexpected = authUsers.filter(u => !CANDIDATES.includes((u.email || '').toLowerCase()) && !KEEP.has((u.email || '').toLowerCase()));
for (const u of unexpected) console.log(`  NOT-IN-LIST (left alone): ${u.email}`);

const found = CANDIDATES.map(e => byEmail.get(e)).filter(Boolean);
if (!found.length) { console.log('Nothing to delete.'); process.exit(0); }

// 2. per-candidate footprint audit
const ids = `(${found.map(u => u.id).join(',')})`;
const count = async (table, col) => {
  const r = await req('GET', `/rest/v1/${table}?select=${col}&${col}=in.${ids}`);
  return Array.isArray(r.body) ? r.body.length : -1;
};
const orders = await req('GET', `/rest/v1/orders?select=id,user_id&user_id=in.${ids}`);
const orderList = Array.isArray(orders.body) ? orders.body : [];
const perUserOrders = new Map(orderList.reduce((m, o) => m.set(o.user_id, (m.get(o.user_id) || 0) + 1), []));
console.log(`footprint: orders=${orderList.length} carts=${await count('carts', 'user_id')} reviews=${await count('product_reviews', 'user_id')} wishlist=${await count('wishlist_items', 'user_id')}`);

const blocked = found.filter(u => perUserOrders.get(u.id));
for (const u of blocked) console.log(`  SKIP (has ${perUserOrders.get(u.id)} orders — needs human eyes): ${u.email}`);
const deletable = found.filter(u => !perUserOrders.get(u.id));
console.log(`deletable now: ${deletable.length}/${found.length}`);

if (!EXECUTE) {
  console.log('\nDRY RUN — per deletable candidate: DELETE public.users (cascades orders/carts) -> DELETE auth.users (cascades sessions/reviews/wishlist).');
  console.log('Re-run with --execute to apply. Dashboard alternative: scripts/task117-cleanup.sql');
  process.exit(0);
}

// 3. delete
for (const u of deletable) {
  const pu = await req('DELETE', `/rest/v1/users?id=eq.${u.id}`);
  console.log(`${u.email}: public.users delete -> ${pu.status}${pu.status === 404 ? ' (no profile row — fine)' : ''}`);
  const au = await req('DELETE', `/auth/v1/admin/users/${u.id}`);
  console.log(`${u.email}: auth user delete   -> ${au.status}`);
}

// 4. post-check
const after = await req('GET', '/auth/v1/admin/users?per_page=1000');
const remaining = (after.body?.users || []).map(u => u.email);
const leftovers = CANDIDATES.filter(e => remaining.includes(e));
console.log(`\nPOST-CHECK: auth users now ${remaining.length}; candidate leftovers: ${leftovers.length ? leftovers.join(', ') : 'NONE'}`);
console.log(`kept: ${[...KEEP].filter(e => remaining.includes(e)).join(', ')}`);
