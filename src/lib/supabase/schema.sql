-- Supabase schema for the e-commerce app.
-- Run this in the Supabase SQL editor after creating your project.
-- This mirrors the Prisma schema in /prisma/schema.prisma so the same
-- TypeScript types work against either backend.

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Tables ----------
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text not null,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  slug text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  description text not null,
  price numeric(10,2) not null,
  compare_at numeric(10,2),
  currency text not null default 'USD',
  sku text,
  stock int not null default 0,
  rating numeric(2,1) not null default 0,
  review_count int not null default 0,
  images jsonb not null default '[]',
  tags jsonb default '[]',
  featured boolean not null default false,
  is_active boolean not null default true,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists carts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default uuid_generate_v4(),
  cart_id uuid references carts(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  quantity int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, product_id)
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  status text not null default 'pending',
  total_amount numeric(10,2) not null,
  currency text not null default 'USD',
  shipping_name text not null,
  shipping_address text not null,
  shipping_city text not null,
  shipping_zip text not null,
  shipping_country text not null,
  payment_method text not null default 'card',
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  quantity int not null,
  image text,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table users        enable row level security;
alter table categories   enable row level security;
alter table products     enable row level security;
alter table carts        enable row level security;
alter table cart_items   enable row level security;
alter table orders       enable row level security;
alter table order_items  enable row level security;

-- Public read access for catalog
create policy "public read categories" on categories for select using (true);
create policy "public read products"   on products   for select using (is_active = true);

-- Authenticated users manage their own cart
create policy "owner reads cart"  on carts      for select using (auth.uid() = user_id);
create policy "owner writes cart" on carts      for insert  with check (auth.uid() = user_id);
create policy "owner updates cart" on carts      for update using (auth.uid() = user_id);
create policy "owner reads items"  on cart_items for select using (
  exists (select 1 from carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid())
);
create policy "owner writes items" on cart_items for insert with check (
  exists (select 1 from carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid())
);
create policy "owner deletes items" on cart_items for delete using (
  exists (select 1 from carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid())
);

-- Orders visible to owner only
create policy "owner reads orders"  on orders      for select using (auth.uid() = user_id);
create policy "owner creates order" on orders      for insert with check (auth.uid() = user_id);
create policy "owner reads items"   on order_items for select using (
  exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
);

-- ---------- Realtime (optional) ----------
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table cart_items;
alter publication supabase_realtime add table orders;
