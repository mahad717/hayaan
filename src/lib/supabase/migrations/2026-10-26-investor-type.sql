-- Task 128 (2026-10-26): allow the `investor` lead type.
-- The /investors page (equity-round pitch + expression-of-interest form)
-- writes leads with type = 'investor'; the table CHECK (last widened by
-- 2026-09-18-deals-type.sql) only allows 'newsletter', 'quote', 'deals'.
--
-- Run in Supabase SQL editor (Dashboard -> SQL editor -> New query -> Run).
-- Idempotent: safe to run more than once.
-- Until this runs, /api/leads stores investor submissions as quote-typed
-- rows with an "INVESTOR INQUIRY" message prefix (fallback added in the
-- same task), so no investor lead is ever dropped.

alter table public.leads drop constraint if exists leads_type_check;
alter table public.leads
  add constraint leads_type_check check (type in ('newsletter', 'quote', 'deals', 'investor'));
