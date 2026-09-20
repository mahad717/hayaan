// Task 76 — read-only live Supabase probe with the service_role key.
// Verifies: key validity, auth users vs public.users orphans, migration
// application status (tables + columns), product price audit, test account.
// Prints a compact report. Performs NO writes.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SK = env.SUPABASE_SERVICE_ROLE_KEY;
const AK = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SK) { console.error('NO SERVICE KEY in .env'); process.exit(1); }

const hdr = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });
const get = async (path, key = SK) => {
  const r = await fetch(`${URL}${path}`, { headers: hdr(key) });
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body };
};
const colProbe = async (table, col) => {
  const r = await get(`/rest/v1/${table}?select=${col}&limit=1`);
  if (r.status === 200) return 'OK';
  const code = r.body?.code || '';
  if (code === 'PGRST204') return 'COLUMN-MISSING';
  if (code === 'PGRST205') return 'TABLE-MISSING';
  return `ERR:${code || r.status}`;
};
const tabProbe = async (table) => {
  const r = await get(`/rest/v1/${table}?select=id&limit=1`);
  if (r.status === 200) return 'OK';
  const code = r.body?.code || '';
  if (code === 'PGRST205') return 'TABLE-MISSING';
  if (code === '42501' || r.status === 403) return 'RLS-DENIED(e)';
  return `ERR:${code || r.status}`;
};

// ---------- 1. service key validity + auth users ----------
const usersRes = await get('/auth/v1/admin/users?per_page=200');
if (usersRes.status !== 200) {
  console.error('SERVICE KEY INVALID or admin API unreachable:', usersRes.status, JSON.stringify(usersRes.body).slice(0, 200));
  process.exit(1);
}
const authUsers = usersRes.body.users || [];
console.log(`\n=== 1. AUTH USERS (${authUsers.length}) — service key VALID ===`);
for (const u of authUsers) {
  const prov = u.app_metadata?.provider || (u.identities || []).map(i => i.provider).join('+') || 'password?';
  console.log(`  ${u.email}  provider=${prov}  created=${(u.created_at || '').slice(0, 10)}  id=${u.id}`);
}

// ---------- 2. public.users orphans ----------
const pu = await get('/rest/v1/users?select=id,email,role');
const puIds = new Set((pu.body || []).map(r => r.id));
const orphans = authUsers.filter(u => !puIds.has(u.id));
console.log(`\n=== 2. public.users rows: ${pu.body?.length ?? pu.status} | auth users WITHOUT a users row: ${orphans.length} ===`);
for (const o of orphans) console.log(`  ORPHAN: ${o.email} (${o.app_metadata?.provider || 'password'}) id=${o.id}`);

// ---------- 3. migration status ----------
console.log('\n=== 3. MIGRATION STATUS (live REST probes) ===');
const checks = [
  ['2026-09-06 profile-address', [['users', 'address'], ['users', 'city'], ['users', 'phone'], ['orders', 'shipping_phone']]],
  ['2026-09-06 sifalo-payments', [['orders', 'payment_status']]],
  ['2026-09-11 accounting', [['orders', 'discount_amount'], ['orders', 'tax_amount'], ['orders', 'refund_amount'],
    ['product_costs', 'id'], ['order_item_costs', 'id'], ['payments', 'id'], ['accounting_audit', 'id'],
    ['inventory_movements', 'id'], ['ledger_entries', 'id']]],
  ['2026-09-18 deals-type', [['leads', 'type']]],
  ['2026-09-18 dropshipping', [['products', 'supplier_sku'], ['products', 'supplier_url']]],
  ['2026-09-17 catalog-categories', [['categories', 'id']]],
  ['2026-09-17 leads', [['leads', 'id']]],
  ['2026-09-07 blog-posts', [['blog_posts', 'id']]],
  ['2026-09-20 health-supplements', [['products', 'category_id']]],
];
for (const [name, probes] of checks) {
  const results = [];
  for (const [t, c] of probes) results.push(`${t}.${c}=${await colProbe(t, c)}`);
  const bad = results.filter(r => !r.endsWith('=OK')).length;
  console.log(`  ${bad === 0 ? '✅ APPLIED ' : '❌ MISSING?'} ${name}  ${results.join('  ')}`);
}
const dealsLead = await get('/rest/v1/leads?select=id,type&limit=50');
const hasDeals = (dealsLead.body || []).some(l => l.type === 'deals');
console.log(`  ℹ️  leads rows with type='deals' present: ${hasDeals} (CHECK-constraint proxy for deals-type migration)`);

// ---------- 4. product audit ----------
const prod = await get('/rest/v1/products?select=id,name,slug,price,category_id&limit=1000');
const ps = Array.isArray(prod.body) ? prod.body : [];
if (!ps.length) console.log('  products query status:', prod.status, JSON.stringify(prod.body).slice(0, 200));
const noPrice = ps.filter(p => p.price == null || Number(p.price) <= 0);
console.log(`\n=== 4. PRODUCTS: ${ps.length} total | missing/zero price: ${noPrice.length} ===`);
for (const p of noPrice.slice(0, 20)) console.log(`  ${p.name} (${p.slug})`);

// ---------- 5. leftover test account ----------
const testAcc = authUsers.find(u => (u.email || '').toLowerCase() === 'hayaan.task74@hayaan-testing.com');
console.log(`\n=== 5. TEST ACCOUNT hayaan.task74@hayaan-testing.com: ${testAcc ? 'FOUND id=' + testAcc.id : 'not found' } ===`);

// ---------- 6. unpriced catalog items ----------
const cat = (await import('fs')).readFileSync('/home/z/my-project/scripts/catalog_data.json', 'utf8');
const sections = JSON.parse(cat);
console.log('\n=== 6. UNPRICED CATALOG ITEMS (Sanguni list, never created) ===');
let n = 0;
for (const s of sections) {
  const up = (s.products || []).filter(p => !p.price);
  n += up.length;
  console.log(`  ${s.title}: ${up.length} unpriced`);
  for (const p of up) console.log(`    - ${p.name}`);
}
console.log(`  TOTAL unpriced: ${n}`);
console.log('\nPROBE DONE (no writes performed)');
