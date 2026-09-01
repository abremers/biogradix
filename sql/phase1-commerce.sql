-- ============================================================================
-- BIOGRADIX PHASE 1 COMMERCE MIGRATION
-- Creates: biogradix_products, biogradix_orders, biogradix_inventory_movements
-- Access model: RLS enabled with NO anon policies. Only the service role
-- (used by the Vercel serverless functions) can read/write these tables.
--
-- Currency model: each product row carries its own currency (launch: USD).
-- Switching a product to MXN later is a data change only:
--   update public.biogradix_products set currency = 'MXN', price = <mxn price>;
-- The checkout endpoint follows the product currency and enables OXXO
-- automatically when (and only when) the currency is MXN.
-- ============================================================================

-- ── 1. PRODUCTS ─────────────────────────────────────────────────────────────
create table if not exists public.biogradix_products (
  id                  bigint generated always as identity primary key,
  sku                 text not null unique,
  name                text not null,
  peptide             text,
  unit_label          text not null default 'Pack de 20 parches',
  price               numeric(10,2) not null,
  currency            text not null default 'USD' check (currency in ('USD','MXN')),
  cost                numeric(10,2),
  stock               integer not null default 0,
  reserved            integer not null default 0,
  low_stock_threshold integer not null default 10,
  active              boolean not null default true,
  product_url         text,
  created_at          timestamptz not null default now()
);

comment on table public.biogradix_products is 'Biogradix D2C catalog. One unit = one pack of 20 patches. price 340.00 USD seeded below is PLACEHOLDER-CONFIRMED launch pricing; currency drives checkout currency and payment methods.';

-- ── 2. ORDERS ───────────────────────────────────────────────────────────────
-- Money columns are currency-neutral; the currency column (copied from the
-- Stripe session at webhook time) says what they are denominated in.
create table if not exists public.biogradix_orders (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  customer_name     text,
  customer_email    text,
  customer_phone    text,
  shipping_address  jsonb,
  items             jsonb not null default '[]'::jsonb,
  subtotal          numeric(10,2),
  shipping          numeric(10,2),
  total             numeric(10,2),
  currency          text not null default 'USD',
  payment_provider  text not null default 'stripe',
  payment_id        text,
  stripe_session_id text unique,
  status            text not null default 'paid'
                    check (status in ('paid','preparing','shipped','delivered','refunded','cancelled')),
  tracking_carrier  text,
  tracking_number   text,
  shipped_at        timestamptz,
  source            text,
  utm               jsonb
);

create index if not exists biogradix_orders_created_at_idx on public.biogradix_orders (created_at desc);
create index if not exists biogradix_orders_status_idx     on public.biogradix_orders (status);
create index if not exists biogradix_orders_email_idx      on public.biogradix_orders (customer_email);

-- ── 3. INVENTORY MOVEMENTS ──────────────────────────────────────────────────
create table if not exists public.biogradix_inventory_movements (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  sku        text not null references public.biogradix_products (sku),
  delta      integer not null,
  reason     text not null
             check (reason in ('sale','restock','sample','damage','adjustment')),
  order_id   bigint references public.biogradix_orders (id),
  note       text
);

create index if not exists biogradix_inventory_movements_sku_idx
  on public.biogradix_inventory_movements (sku, created_at desc);

-- ── 4. ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- RLS on, zero policies: anon and authenticated roles get nothing.
-- The service role bypasses RLS, so the serverless functions keep full access.
alter table public.biogradix_products            enable row level security;
alter table public.biogradix_orders              enable row level security;
alter table public.biogradix_inventory_movements enable row level security;

-- ── 5. SEED PRODUCTS ────────────────────────────────────────────────────────
-- Real inventory: 5 peptide SKUs, 120 packs each, 340.00 USD per pack
-- (PLACEHOLDER until final pricing is signed off - update with:
--   update public.biogradix_products set price = <real price> where sku = '<sku>';)
-- product_url is the page that sells the sku. mots-c and tb-500 page mapping
-- is pending owner confirmation, so their product_url stays null for now.
insert into public.biogradix_products (sku, name, peptide, unit_label, price, currency, stock, active, product_url) values
  ('bpc-157',  'BPC-157', 'BPC-157', 'Pack de 20 parches', 340.00, 'USD', 120, true, '/producto/recoverypro'),
  ('mots-c',   'MOTS-C',  'MOTS-C',  'Pack de 20 parches', 340.00, 'USD', 120, true, null),
  ('tb-500',   'TB-500',  'TB-500',  'Pack de 20 parches', 340.00, 'USD', 120, true, null),
  ('ghk-cu',   'GHK-Cu',  'GHK-Cu',  'Pack de 20 parches', 340.00, 'USD', 120, true, '/producto/radiancemax'),
  ('nad-plus', 'NAD+',    'NAD+',    'Pack de 20 parches', 340.00, 'USD', 120, true, '/producto/vitacharge')
on conflict (sku) do nothing;
