-- Hayaan Market — blog posts
-- Run once in the Supabase SQL editor (Dashboard → SQL editor → New query).
-- Idempotent: safe to re-run.
--
-- RLS: anonymous/authenticated readers can SELECT only published rows; the
-- admin API routes use the service-role client, which bypasses RLS, so all
-- management (drafts included) flows exclusively through /api/admin/blog.

create table if not exists blog_posts (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  cover_image text,
  author_name text not null default 'Hayaan Team',
  status text not null default 'draft',           -- 'draft' | 'published'
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_published_idx
  on blog_posts (status, published_at desc);

alter table blog_posts enable row level security;

drop policy if exists "public reads published posts" on blog_posts;
create policy "public reads published posts"
  on blog_posts for select using (status = 'published');
