-- Migration: Lead capture (Task 57 — newsletter signups + bulk-quote requests).
-- Run ONCE in the Supabase SQL editor for EXISTING deployments.
-- Fresh projects: skip — schema.sql already includes this section.
--
-- Design notes:
-- * Purely additive. Stores leads captured by the footer form, the offer
--   popup, and the /quote (bulk orders) page.
-- * RLS is enabled with NO public policies — anon / authenticated roles are
--   denied at the database level, exactly like the accounting side-cars.
--   Leads are read/written only through the service-role API routes
--   (/api/leads POST, /api/admin/leads GET/PATCH/DELETE), so a visitor can
--   never read other people's submissions through the public REST endpoint.
-- * status flow: new -> contacted -> won | lost (set from the admin Leads tab).
-- * Idempotent: safe to run multiple times.

create table if not exists leads (
  id         uuid primary key default uuid_generate_v4(),
  type       text not null default 'newsletter' check (type in ('newsletter', 'quote')),
  name       text,
  email      text,
  phone      text,
  business   text,
  message    text,
  source     text not null default 'site',   -- popup | footer | quote-page | …
  status     text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_created on leads(created_at desc);
create index if not exists idx_leads_status  on leads(status);

-- Deny-by-default for the public API: no policies for anon/authenticated.
alter table leads enable row level security;
