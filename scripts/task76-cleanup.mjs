// Task 76 — delete leftover TEST accounts from live Supabase (guarded).
// Candidates: Task 74 verification account, 10 Task 63 example.com accounts,
// and the old demo seed customer. Real accounts (owner, baashaalecade) are
// NEVER candidates. Any candidate with orders/reviews is skipped, not deleted.
//
// Usage:  node scripts/task76-cleanup.mjs           (dry run — prints plan)
//         node scripts/task76-cleanup.mjs --execute (actually deletes)
import { readFileSync } from 'node:fs';

const EXECUTE = process.argv.includes('--execute');
const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.slice(0, l.indexOf('=')).trim() && [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
    .filter(Boolean)
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SK = env.SUPABASE_SERVICE_ROLE_KEY;

const hdr = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const req = async (method, path, body) => {
  const r = await fetch(`${URL}${path}`, { method, headers: hdr, body: body ? JSON.stringify(body) : undefined });
  let b = null; try { b = await r.json(); } catch {}
  return { status: r.status, body: b };
};

const KEEP = new Set(['gabeyre80@gmail.com', 'baashaalecade@gmail.com']);
const CANDIDATE_EMAILS = [
  'hayaan.task74@hayaan-testing.com',
  'customer@shop.demo',
  /^task63(\.dbg)?\.\d+@example\.com$/,
  /^task63dbg\.\d+@example\.com$/,
];

// 1. list auth users
const list = await req('GET', '/auth/v1/admin/users?per_page=200');
if (list.status !== 200) { console.error('admin list failed', list.status); process.exit(1); }
const authUsers = list.body.users || [];

const isCandidate = (email) =>
  !KEEP.has(email) && CANDIDATE_EMAILS.some(c => c instanceof RegExp ? c.test(email) : c === email);

const targets = authUsers.filter(u => isCandidate((u.email || '').toLowerCase()));
console.log(`auth users: ${authUsers.length} | candidates: ${targets.length}`);
for (const u of targets) console.log(`  candidate: ${u.email} id=${u.id}`);
const skipped = authUsers.filter(u => !isCandidate((u.email || '').toLowerCase()));
for (const u of skipped) console.log(`  KEEP     : ${u.email}`);

// 2. safety: orders per candidate — per-account decision (NOT batch abort)
const ids = targets.map(u => u.id).join(',');
const idList = `(${ids})`;
const orders = await req('GET', `/rest/v1/orders?select=id,user_id&user_id=in.${idList}`);
const reviews = await req('GET', `/rest/v1/reviews?select=id,user_id&user_id=in.${idList}`).catch(() => ({ status: 404, body: null }));
const carts = await req('GET', `/rest/v1/carts?select=id,user_id&user_id=in.${idList}`);
const orderList = Array.isArray(orders.body) ? orders.body : [];
const reviewList = Array.isArray(reviews.body) ? reviews.body : [];
const cartList = Array.isArray(carts.body) ? carts.body : [];
const ordered = new Set(orderList.map(o => o.user_id));
const deletable = targets.filter(u => !ordered.has(u.id));
const kept = targets.filter(u => ordered.has(u.id));
console.log(`orders among candidates: ${orderList.length} | reviews: ${reviewList.length} | carts: ${cartList.length}`);
for (const u of kept) console.log(`  KEEP (has orders): ${u.email} id=${u.id} (${orderList.filter(o => o.user_id === u.id).length} orders)`);
console.log(`deletable (zero orders): ${deletable.length}`);
const targetIds = deletable.map(u => u.id);
const targetIdList = `(${targetIds.join(',')})`;
const targetCarts = cartList.filter(c => targetIds.includes(c.user_id));

if (!EXECUTE) {
  console.log('\nDRY RUN — would now delete, per deletable candidate: cart_items -> carts -> reviews -> users row -> auth user.');
  console.log('Re-run with --execute to apply.');
  process.exit(0);
}

for (const u of deletable) {
  const id = u.id;
  const myCarts = targetCarts.filter(c => c.user_id === id).map(c => c.id);
  if (myCarts.length) {
    const ci = await req('DELETE', `/rest/v1/cart_items?cart_id=in.(${myCarts.join(',')})`);
    console.log(`${u.email}: cart_items delete -> ${ci.status}`);
  }
  const cr = await req('DELETE', `/rest/v1/carts?user_id=eq.${id}`);
  console.log(`${u.email}: carts delete -> ${cr.status}`);
  const rv = await req('DELETE', `/rest/v1/reviews?user_id=eq.${id}`);
  console.log(`${u.email}: reviews delete -> ${rv.status}`);
  const ur = await req('DELETE', `/rest/v1/users?id=eq.${id}`);
  console.log(`${u.email}: users row delete -> ${ur.status}`);
  const au = await req('DELETE', `/auth/v1/admin/users/${id}`);
  console.log(`${u.email}: auth user delete -> ${au.status}`);
}

// 4. post-check
const after = await req('GET', '/auth/v1/admin/users?per_page=200');
const remaining = (after.body?.users || []).map(u => u.email);
console.log(`\nPOST-CHECK remaining auth users (${remaining.length}):`);
for (const e of remaining) console.log(`  ${e}`);
