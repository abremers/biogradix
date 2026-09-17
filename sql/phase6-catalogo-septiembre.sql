-- ============================================================================
-- BIOGRADIX — AMPLIACION DEL CATALOGO (septiembre 2026)
--
-- 1) Da de alta los 3 productos nuevos, todos con stock = 0: el sitio los
--    muestra como "Temporalmente agotado" hasta que registres existencias
--    desde el panel (Inventario -> Ajustar, motivo Restock). En cuanto el
--    stock sea mayor que 0, la pagina muestra sola el precio y el boton
--    Comprar, y el quiz empieza a recomendarlos.
-- 2) Renombra Glutation a "Glutation Liposomal", su presentacion nueva, y
--    guarda la dosis por parche de los demas agotados en la columna peptide.
--
-- Precio: USD 299.00 por pack de 20 parches, igual que el resto.
--
-- Ejecutar en: Supabase -> SQL Editor. Es idempotente: se puede correr dos
-- veces sin duplicar nada.
-- ============================================================================

insert into public.biogradix_products
  (sku, name, peptide, unit_label, price, currency, stock, active, product_url)
values
  ('wolverine-stack',  'Wolverine Stack',   'BPC-157 500 mcg + TB-500 300 mcg', 'Pack de 20 parches', 299.00, 'USD', 0, true, '/producto-wolverine-stack'),
  ('semax',            'Semax',             'Semax 200 mcg',                    'Pack de 20 parches', 299.00, 'USD', 0, true, '/producto-semax'),
  ('dsip-melatonina',  'DSIP + Melatonina', 'DSIP 100 mcg + melatonina 1 mg',   'Pack de 20 parches', 299.00, 'USD', 0, true, '/producto-dsip-melatonina')
on conflict (sku) do nothing;

-- Glutation pasa a ser la presentacion liposomal de 100 mg.
update public.biogradix_products
   set name    = 'Glutatión Liposomal',
       peptide = 'Glutatión liposomal 100 mg'
 where sku = 'glutation';

-- Dosis por parche de los demas agotados, para que el panel muestre lo mismo
-- que el sitio.
update public.biogradix_products set peptide = 'Timosina Alfa-1 500 mcg'       where sku = 'timosina-alfa-1';
update public.biogradix_products set peptide = 'PT-141 (bremelanotida) 2.5 mg' where sku = 'pt-141';
update public.biogradix_products set peptide = 'CJC-1295 / Ipamorelin 250 mcg' where sku = 'cjc-1295-ipamorelin';

-- Comprobacion: deben aparecer 12 productos, 5 con stock y 7 en cero.
select sku, name, peptide, price, currency, stock, active
from public.biogradix_products
order by stock desc, sku asc;
