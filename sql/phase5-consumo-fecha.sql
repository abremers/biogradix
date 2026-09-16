-- ============================================================================
-- BIOGRADIX — FECHA EN EL REGISTRO DE CONSUMO PROPIO
--
-- Hasta ahora biogradix_consumo solo guardaba created_at: el momento en que se
-- capturo el registro. Esta columna guarda el dia en que realmente se tomo el
-- pack, para poder anotar consumos de dias anteriores (igual que en Gastos).
--
-- Los registros existentes se rellenan con el dia en que se crearon, en hora
-- de la Ciudad de Mexico. Por eso la columna se crea primero sin default: si
-- se creara con default, todas las filas viejas quedarian con la fecha de hoy.
--
-- Ejecutar en: Supabase -> SQL Editor. Es idempotente.
-- ============================================================================

alter table public.biogradix_consumo
  add column if not exists fecha date;

update public.biogradix_consumo
  set fecha = (created_at at time zone 'America/Mexico_City')::date
  where fecha is null;

alter table public.biogradix_consumo
  alter column fecha set default ((now() at time zone 'America/Mexico_City')::date);

alter table public.biogradix_consumo
  alter column fecha set not null;

create index if not exists biogradix_consumo_fecha_idx
  on public.biogradix_consumo (fecha desc);

-- Que la API (PostgREST) vea la columna nueva sin esperar.
notify pgrst, 'reload schema';

-- Comprobacion: ninguna fila debe quedar sin fecha.
select count(*) as consumos,
       count(*) filter (where fecha is null) as sin_fecha,
       min(fecha) as primera,
       max(fecha) as ultima
from public.biogradix_consumo;
