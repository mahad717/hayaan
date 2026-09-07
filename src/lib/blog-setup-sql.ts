// SQL that enables the blog on a Supabase project. Run once in the
// Supabase SQL editor (Dashboard → SQL editor → New query).
//
// The admin Blog section shows this exact SQL (with a copy button) when it
// detects the table is missing, mirroring the original "Seed now" bootstrap
// flow. Safe to re-run: every statement is idempotent.

export const BLOG_SETUP_SQL = `-- Hayaan Market — blog posts (run once in the Supabase SQL editor)
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
`;
