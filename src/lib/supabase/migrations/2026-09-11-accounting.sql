-- Migration: Accounting, reconciliation & product cost tracking (Task 49).
-- Run ONCE in the Supabase SQL editor for EXISTING deployments.
-- Fresh projects: skip — schema.sql already includes this section.
--
-- Design notes:
-- * Purely additive. No existing table is restructured; only four nullable /
--   defaulted columns are added to `orders` (receipt-level data the customer
--   already sees on their own orders: discount, shipping, tax, refunds).
-- * Confidential cost data lives in SIDE-CAR tables (product_costs,
--   order_item_costs) that are RLS-locked with NO public policies — anon /
--   authenticated roles are denied at the database level, so cost can never
--   leak through the public REST endpoint even with the anon key.
-- * payments has a partial UNIQUE index on (provider, transaction_ref) so a
--   gateway reference can never be double-counted.
-- * Aggregations run inside SECURITY DEFINER RPC functions over numeric
--   types (decimal-exact, index-friendly). Execute is revoked from the
--   public and granted to service_role only.
-- * Idempotent: safe to run multiple times.

-- ============ 1. orders: receipt-level accounting columns ============
alter table orders add column if not exists discount_amount numeric(12,2) not null default 0;
alter table orders add column if not exists shipping_cost  numeric(12,2) not null default 0;
alter table orders add column if not exists tax_amount     numeric(12,2) not null default 0;
alter table orders add column if not exists refund_amount  numeric(12,2) not null default 0;
alter table orders add column if not exists refunded_at    timestamptz;

-- ============ 2. Confidential cost side-cars (RLS deny-all) ============
create table if not exists product_costs (
  product_id uuid primary key references products(id) on delete cascade,
  unit_cost  numeric(12,2) not null check (unit_cost >= 0),
  currency   text not null default 'USD',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_item_costs (
  id             uuid primary key default uuid_generate_v4(),
  order_item_id  uuid not null unique references order_items(id) on delete cascade,
  product_id     uuid,
  unit_cost      numeric(12,2) not null check (unit_cost >= 0),
  currency       text not null default 'USD',
  created_at     timestamptz not null default now()
);
create index if not exists idx_order_item_costs_product on order_item_costs(product_id);

create table if not exists payments (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references orders(id) on delete cascade,
  provider        text not null,
  method          text,
  transaction_ref text,
  amount          numeric(12,2) check (amount is null or amount >= 0),
  currency        text not null default 'USD',
  status          text not null default 'pending', -- pending | paid | failed
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_payments_order  on payments(order_id);
create index if not exists idx_payments_status on payments(status);
-- Duplicate-transaction guard: the same provider reference can be recorded
-- only once (partial — failed attempts without refs are exempt).
create unique index if not exists uq_payments_provider_ref
  on payments(provider, transaction_ref)
  where transaction_ref is not null;

create table if not exists ledger_entries (
  id          uuid primary key default uuid_generate_v4(),
  entry_type  text not null, -- sale | refund | purchase | cancel | adjustment
  account     text not null, -- revenue | cogs | gross_profit | refunds | shipping | tax | inventory | cash | accounts_payable
  entry_group uuid,
  order_id    uuid,
  payment_id  uuid,
  purchase_id uuid,
  product_id  uuid,
  amount      numeric(14,2) not null,
  currency    text not null default 'USD',
  description text,
  actor       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ledger_type   on ledger_entries(entry_type);
create index if not exists idx_ledger_group  on ledger_entries(entry_group);
create index if not exists idx_ledger_order  on ledger_entries(order_id);
create index if not exists idx_ledger_created on ledger_entries(created_at);

create table if not exists purchases (
  id             uuid primary key default uuid_generate_v4(),
  supplier       text not null,
  product_id     uuid references products(id) on delete set null,
  quantity       int not null check (quantity > 0),
  unit_cost      numeric(12,2) not null check (unit_cost >= 0),
  total_cost     numeric(12,2) not null,
  purchase_date  timestamptz not null default now(),
  reference      text,
  payment_status text not null default 'unpaid', -- paid | unpaid
  stock_applied  boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_purchases_date on purchases(purchase_date);

create table if not exists inventory_movements (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid not null references products(id) on delete cascade,
  order_id      uuid,
  purchase_id   uuid,
  movement_type text not null, -- sale | purchase | refund_restock | adjustment
  quantity_delta int not null,
  unit_cost     numeric(12,2),
  created_at    timestamptz not null default now()
);
create index if not exists idx_movements_product on inventory_movements(product_id);
create index if not exists idx_movements_created on inventory_movements(created_at);

create table if not exists accounting_audit (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid,
  actor_email text,
  entity      text not null, -- product | order | payment | purchase | reconciliation | inventory
  entity_id   text,
  field       text not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_entity  on accounting_audit(entity);
create index if not exists idx_audit_created on accounting_audit(created_at);

-- ============ 3. Lock everything down ============
-- RLS with zero policies = deny for anon + authenticated; the app server
-- always uses the service role (bypasses RLS). Belt-and-braces: revoke the
-- blanket table grants Supabase gives to those roles.
do $$
declare t text;
begin
  foreach t in array array['product_costs','order_item_costs','payments','ledger_entries','purchases','inventory_movements','accounting_audit']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('revoke all on %I from anon;', t);
    execute format('revoke all on %I from authenticated;', t);
  end loop;
end $$;

-- ============ 4. Aggregation RPCs (service-role only) ============

-- Atomic stock decrement, clamped at zero (never negative).
create or replace function decrement_product_stock(p_product_id uuid, p_qty int)
returns void
language sql
security definer
set search_path = public
as $$
  update products set stock = greatest(stock - p_qty, 0), updated_at = now()
  where id = p_product_id;
$$;
revoke execute on function decrement_product_stock(uuid, int) from public;
revoke execute on function decrement_product_stock(uuid, int) from anon;
revoke execute on function decrement_product_stock(uuid, int) from authenticated;
grant execute on function decrement_product_stock(uuid, int) to service_role;

-- Credit criterion for revenue: order is in a paid family
-- (paid / shipped / delivered) and not cancelled. Pending orders are not
-- revenue yet. Cancelled orders are always excluded.
-- COGS uses the cost-at-sale snapshot rows; order items without a snapshot
-- are counted in missing_cost_items and excluded from COGS (never guessed).

create or replace function accounting_overview(from_ts timestamptz, to_ts timestamptz)
returns table (
  revenue          numeric,
  cogs             numeric,
  gross_profit     numeric,
  gross_margin     numeric,
  discounts        numeric,
  refunds          numeric,
  shipping_revenue numeric,
  tax_collected    numeric,
  net_revenue      numeric,
  orders_count     bigint,
  missing_cost_items bigint,
  cancelled_count    bigint
)
language sql
security definer
set search_path = public
as $$
  with credited as (
    select o.id, o.discount_amount, o.refund_amount, o.shipping_cost, o.tax_amount
    from orders o
    where o.status in ('paid','shipped','delivered')
      and o.created_at >= from_ts and o.created_at < to_ts
  ),
  lines as (
    select c.id,
           sum(oi.price * oi.quantity) as merch
    from credited c join order_items oi on oi.order_id = c.id
    group by c.id
  ),
  cogs as (
    select c.id,
           sum(oi.quantity * oic.unit_cost) as cogs,
           count(*) filter (where oic.id is null) as missing
    from credited c
    join order_items oi on oi.order_id = c.id
    left join order_item_costs oic on oic.order_item_id = oi.id
    group by c.id
  )
  select
    (select coalesce(sum(l.merch - d.discount_amount), 0) from lines l join credited d on d.id = l.id)::numeric,
    (select coalesce(sum(g.cogs), 0) from cogs g)::numeric,
    (select coalesce(sum(l.merch - d.discount_amount), 0) from lines l join credited d on d.id = l.id)
      - (select coalesce(sum(g.cogs), 0) from cogs g),
    case when (select coalesce(sum(l.merch - d.discount_amount), 0) from lines l join credited d on d.id = l.id) > 0
      then round(((select coalesce(sum(l.merch - d.discount_amount), 0) from lines l join credited d on d.id = l.id)
        - (select coalesce(sum(g.cogs), 0) from cogs g)) * 100.0
        / (select coalesce(sum(l.merch - d.discount_amount), 0) from lines l join credited d on d.id = l.id), 2)
      else 0 end,
    (select coalesce(sum(discount_amount), 0) from credited)::numeric,
    (select coalesce(sum(refund_amount), 0) from credited)::numeric,
    (select coalesce(sum(shipping_cost), 0) from credited)::numeric,
    (select coalesce(sum(tax_amount), 0) from credited)::numeric,
    (select coalesce(sum(l.merch - d.discount_amount), 0) from lines l join credited d on d.id = l.id)
      - (select coalesce(sum(refund_amount), 0) from credited),
    (select count(*) from credited),
    (select coalesce(sum(missing), 0) from cogs)::bigint,
    (select count(*) from orders o
      where o.status = 'cancelled' and o.created_at >= from_ts and o.created_at < to_ts);
$$;

create or replace function accounting_profit(from_ts timestamptz, to_ts timestamptz)
returns table (
  product_id   uuid,
  product_name text,
  units_sold   bigint,
  revenue      numeric,
  cogs         numeric,
  gross_profit numeric,
  margin       numeric,
  missing_cost boolean
)
language sql
security definer
set search_path = public
as $$
  select
    oi.product_id,
    max(oi.name) as product_name,
    sum(oi.quantity)::bigint as units_sold,
    sum(oi.price * oi.quantity) as revenue,
    sum(oi.quantity * oic.unit_cost) as cogs,
    sum(oi.price * oi.quantity) - sum(oi.quantity * oic.unit_cost) as gross_profit,
    case when sum(oi.price * oi.quantity) > 0
      then round((sum(oi.price * oi.quantity) - sum(oi.quantity * oic.unit_cost)) * 100.0
        / sum(oi.price * oi.quantity), 2)
      else 0 end as margin,
    bool_or(oic.id is null) as missing_cost
  from order_items oi
  join orders o on o.id = oi.order_id
  left join order_item_costs oic on oic.order_item_id = oi.id
  where o.status in ('paid','shipped','delivered')
    and o.created_at >= from_ts and o.created_at < to_ts
  group by oi.product_id
  having oi.product_id is not null;
$$;

create or replace function accounting_recon(from_ts timestamptz, to_ts timestamptz)
returns table (
  order_id         uuid,
  customer         text,
  order_total      numeric,
  expected_payment numeric,
  actual_payment   numeric,
  difference       numeric,
  payment_method   text,
  payment_reference text,
  payment_status   text,
  recon_status     text,
  order_status     text,
  order_date       timestamptz,
  refunded         numeric
)
language sql
security definer
set search_path = public
as $$
  select
    o.id,
    coalesce(nullif(o.shipping_name, ''), 'Customer') as customer,
    o.total_amount,
    o.total_amount as expected_payment,
    coalesce(p.paid_sum,
      case when o.status in ('paid','shipped','delivered') then o.total_amount else 0 end) as actual_payment,
    coalesce(p.paid_sum,
      case when o.status in ('paid','shipped','delivered') then o.total_amount else 0 end) - o.total_amount as difference,
    o.payment_method,
    o.payment_ref as payment_reference,
    o.payment_status,
    case
      when o.status = 'cancelled' then
        case when o.refund_amount > 0 then 'Refunded' else 'Unmatched' end
      when o.refund_amount >= o.total_amount and o.total_amount > 0 then 'Refunded'
      when coalesce(p.paid_sum, 0) = 0 and o.payment_status = 'failed' then 'Failed'
      when coalesce(p.paid_sum, 0) = 0 then 'Unmatched'
      when abs(coalesce(p.paid_sum, 0) - o.total_amount) < 0.005 then 'Matched'
      when coalesce(p.paid_sum, 0) > o.total_amount then 'Overpaid'
      else 'Underpaid'
    end as recon_status,
    o.status as order_status,
    o.created_at as order_date,
    o.refund_amount as refunded
  from orders o
  left join (
    select order_id, sum(amount) as paid_sum
    from payments
    where status = 'paid'
    group by order_id
  ) p on p.order_id = o.id
  where o.created_at >= from_ts and o.created_at < to_ts
  order by o.created_at desc;
$$;

-- Functions default to EXECUTE granted to PUBLIC in Postgres — lock them to
-- the service role (the only role the app server uses for admin APIs).
revoke execute on function accounting_overview(timestamptz, timestamptz) from public;
revoke execute on function accounting_overview(timestamptz, timestamptz) from anon;
revoke execute on function accounting_overview(timestamptz, timestamptz) from authenticated;
grant execute on function accounting_overview(timestamptz, timestamptz) to service_role;

revoke execute on function accounting_profit(timestamptz, timestamptz) from public;
revoke execute on function accounting_profit(timestamptz, timestamptz) from anon;
revoke execute on function accounting_profit(timestamptz, timestamptz) from authenticated;
grant execute on function accounting_profit(timestamptz, timestamptz) to service_role;

revoke execute on function accounting_recon(timestamptz, timestamptz) from public;
revoke execute on function accounting_recon(timestamptz, timestamptz) from anon;
revoke execute on function accounting_recon(timestamptz, timestamptz) from authenticated;
grant execute on function accounting_recon(timestamptz, timestamptz) to service_role;
