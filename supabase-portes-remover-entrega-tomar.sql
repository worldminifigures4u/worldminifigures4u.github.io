-- Executar no SQL Editor do Supabase.
-- Remove a opcao "Entrega em mao em Tomar" das tarifas de portes.

delete from public.portes_tarifas
where metodo_id = 'entrega_tomar';
