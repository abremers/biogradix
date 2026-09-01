-- ============================================================================
-- WEB REBRAND: product_url updates for the peptide-named pages
-- Run AFTER sql/phase1-commerce.sql. Idempotent (plain UPDATEs by sku).
--
-- The old brand pages 301-redirect to these URLs (see vercel.json redirects),
-- so nothing breaks if a stale URL is stored anywhere else.
-- Applied by the controlling session; do not run from the web track.
-- ============================================================================

update public.biogradix_products set product_url = '/producto-bpc-157'  where sku = 'bpc-157';
update public.biogradix_products set product_url = '/producto-mots-c'   where sku = 'mots-c';
update public.biogradix_products set product_url = '/producto-tb-500'   where sku = 'tb-500';
update public.biogradix_products set product_url = '/producto-ghk-cu'   where sku = 'ghk-cu';
update public.biogradix_products set product_url = '/producto-nad'      where sku = 'nad-plus';
