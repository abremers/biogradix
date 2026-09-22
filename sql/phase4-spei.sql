-- ============================================================================
-- BIOGRADIX - FASE 4: PAGO POR TRANSFERENCIA BANCARIA (SPEI)
--
-- Stripe cerro la cuenta, asi que el checkout de tarjeta queda fuera. Este
-- script prepara biogradix_orders para el flujo manual de transferencia:
--
--   payment_reference   referencia unica que el cliente escribe en el
--                       concepto de su transferencia (BGX-XXXXXXXX, aleatoria)
--   total_mxn           monto exacto a transferir en MXN; los centavos son
--                       unicos por pedido (id % 100) para casar depositos
--   mxn_rate            tipo de cambio USD -> MXN aplicado al crear el pedido
--   expires_note        nota operativa sobre la caducidad de la reserva
--
-- FLUJO DE INVENTARIO (reserva -> deposito -> confirmacion):
--   1. /api/create-order inserta el pedido con status 'pending_payment' y
--      suma la cantidad a biogradix_products.reserved. El stock NO se toca:
--      el sitio y el checkout ya calculan disponible = stock - reserved,
--      asi que el pack queda apartado sin salir del almacen y sin movimiento
--      de inventario.
--   2. Cuando el deposito es visible en el banco, el panel (boton "Confirmar
--      pago") descuenta stock Y reserved, registra el movimiento 'sale'
--      (nota "SPEI confirmado") y pasa el pedido a 'paid'.
--   3. Si el pedido se cancela sin pagarse, solo se libera la reserva
--      (reserved -= cantidad). No se registra movimiento porque el stock
--      nunca se movio.
--
-- La caducidad de 72 horas es una convencion operativa (manual por ahora):
-- cancela desde el panel los pedidos "Por pagar" con mas de 72 horas y la
-- reserva se libera sola al cancelar.
--
-- Ejecutar en: Supabase -> SQL Editor. Es idempotente.
-- ============================================================================

-- 1. Recrear el check de status para admitir 'pending_payment'.
alter table public.biogradix_orders
  drop constraint if exists biogradix_orders_status_check;

alter table public.biogradix_orders
  add constraint biogradix_orders_status_check
  check (status in ('pending_payment','paid','preparing','shipped','delivered','refunded','cancelled'));

-- 2. Columnas del flujo SPEI.
alter table public.biogradix_orders
  add column if not exists payment_reference text unique;

alter table public.biogradix_orders
  add column if not exists total_mxn numeric(12,2);

alter table public.biogradix_orders
  add column if not exists mxn_rate numeric(8,4);

alter table public.biogradix_orders
  add column if not exists expires_note text;

comment on column public.biogradix_orders.payment_reference is
  'Referencia SPEI unica e impredecible (BGX- + 8 chars aleatorios). Es el concepto de la transferencia y la llave de consulta de pago.html.';
comment on column public.biogradix_orders.total_mxn is
  'Monto exacto en MXN a transferir. Centavos = id % 100 para identificar el deposito en el banco.';
comment on column public.biogradix_orders.mxn_rate is
  'Tipo de cambio USD -> MXN aplicado al crear el pedido (env MXN_RATE).';
comment on column public.biogradix_orders.expires_note is
  'Nota operativa sobre la caducidad de la reserva (convencion: 72 horas).';

-- 3. Comprobacion: el check debe listar pending_payment y las 4 columnas
--    deben existir.
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.biogradix_orders'::regclass
   and conname = 'biogradix_orders_status_check';

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'biogradix_orders'
   and column_name in ('payment_reference','total_mxn','mxn_rate','expires_note')
 order by column_name;
