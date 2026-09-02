-- ============================================================================
-- BIOGRADIX PHASE 3 — GASTOS Y CONSUMO PROPIO
-- Creates: biogradix_expenses, biogradix_consumo
-- Alters:  biogradix_inventory_movements (permite reason 'consumo')
-- Access model: RLS enabled with NO anon policies. Only the service role
-- (used by the Vercel serverless functions) can read/write these tables.
--
-- Como aplicar: pegar este archivo completo en el SQL Editor de Supabase
-- y ejecutarlo una sola vez. Es idempotente (create if not exists).
-- ============================================================================

-- Allow 'consumo' as an inventory movement reason
alter table public.biogradix_inventory_movements
  drop constraint if exists biogradix_inventory_movements_reason_check;
alter table public.biogradix_inventory_movements
  add constraint biogradix_inventory_movements_reason_check
  check (reason in ('sale','restock','sample','damage','adjustment','consumo'));

create table if not exists public.biogradix_expenses (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  fecha      date not null default current_date,
  categoria  text not null check (categoria in ('publicidad','muestras','envios','comisiones','herramientas','inventario','otros')),
  concepto   text not null,
  monto      numeric(10,2) not null,
  moneda     text not null default 'USD' check (moneda in ('USD','MXN')),
  persona    text,
  nota       text
);
create index if not exists biogradix_expenses_fecha_idx on public.biogradix_expenses (fecha desc);
alter table public.biogradix_expenses enable row level security;

create table if not exists public.biogradix_consumo (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  persona        text not null,
  sku            text not null references public.biogradix_products (sku),
  packs          integer not null check (packs > 0),
  costo_unitario numeric(10,2),
  total          numeric(10,2),
  pagado         boolean not null default false,
  pagado_at      timestamptz,
  nota           text
);
alter table public.biogradix_consumo enable row level security;
