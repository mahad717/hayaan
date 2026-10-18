// Task 117 — snapshot customer@shop.demo's test orders (and their items)
// to download/ before the guarded cleanup deletes the account. Documentation
// artifact only (all 32 orders are unpaid test artifacts, audited 2026-10-18).
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('/home/z/my-project/.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const hdr = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const UID = '27ef7a2e-252e-455c-ab4c-74f78f27b70f'; // customer@shop.demo auth id

const orders = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/orders?select=*&user_id=eq.${UID}`, { headers: hdr })).json();
const items = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/order_items?select=*&order_id=in.(${orders.map(o => o.id).join(',')})`, { headers: hdr })).json();
const profile = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=*&id=eq.${UID}`, { headers: hdr })).json();

const out = {
  snapshot: 'task117 pre-cleanup backup — customer@shop.demo (demo customer, 0 paid orders, created by Tasks 33-56 test flows)',
  takenAt: new Date().toISOString(),
  profile: profile[0] || null,
  orderCount: orders.length,
  orders,
  orderItems: items,
};
writeFileSync('/home/z/my-project/download/task117-customer-demo-backup.json', JSON.stringify(out, null, 2));
console.log(`backed up: ${orders.length} orders, ${items.length} order_items -> download/task117-customer-demo-backup.json`);
