-- ============================================================================
-- BIOGRADIX PHASE 1 COMMERCE MIGRATION
-- Creates: biogradix_products, biogradix_orders, biogradix_inventory_movements
-- Access model: RLS enabled with NO anon policies. Only the service role
-- (used by the Vercel serverless functions) can read/write these tables.
-- ============================================================================

-- ── 1. PRODUCTS ─────────────────────────────────────────────────────────────
create table if not exists public.biogradix_products (
  id                  bigint generated always as identity primary key,
  sku                 text not null unique,
  name                text not null,
  peptide             text,
  price_mxn           numeric(10,2) not null,
  cost_mxn            numeric(10,2),
  stock               integer not null default 0,
  reserved            integer not null default 0,
  low_stock_threshold integer not null default 10,
  active              boolean not null default true,
  product_url         text,
  created_at          timestamptz not null default now()
);

comment on table public.biogradix_products is 'Biogradix D2C catalog. price_mxn values seeded below are PLACEHOLDER until real pricing is confirmed.';

-- ── 2. ORDERS ───────────────────────────────────────────────────────────────
create table if not exists public.biogradix_orders (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  customer_name     text,
  customer_email    text,
  customer_phone    text,
  shipping_address  jsonb,
  items             jsonb not null default '[]'::jsonb,
  subtotal_mxn      numeric(10,2),
  shipping_mxn      numeric(10,2),
  total_mxn         numeric(10,2),
  currency          text not null default 'MXN',
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
-- price_mxn = 1490.00 is a PLACEHOLDER for every SKU. Update before launch:
--   update public.biogradix_products set price_mxn = <real price> where sku = '<sku>';
-- stock is seeded at 0 on purpose: checkout stays disabled per SKU until real
-- inventory is entered (buy buttons fall back to WhatsApp until then).
insert into public.biogradix_products (sku, name, peptide, price_mxn, stock, active, product_url) values
  ('celldew',      'CellDew',      'Glutation',              1490.00, 0, true, '/producto/celldew'),
  ('immunefort',   'ImmuneFort',   'Thymosin Alpha-1',       1490.00, 0, true, '/producto/immunefort'),
  ('musclemaxx',   'MuscleMaxx',   'CJC-1295 / Ipamorelin',  1490.00, 0, true, '/producto/musclemaxx'),
  ('passionboost', 'PassionBoost', 'PT-141 + Oxitocina',     1490.00, 0, true, '/producto/passionboost'),
  ('radiancemax',  'RadianceMax',  'GHK-Cu',                 1490.00, 0, true, '/producto/radiancemax'),
  ('recoverypro',  'RecoveryPro',  'BPC-157',                1490.00, 0, true, '/producto/recoverypro'),
  ('vitacharge',   'VitaCharge',   'NAD+',                   1490.00, 0, true, '/producto/vitacharge')
on conflict (sku) do nothing;
