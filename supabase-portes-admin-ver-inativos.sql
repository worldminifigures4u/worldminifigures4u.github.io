-- Executar no SQL Editor do Supabase.
-- Permite ao admin ver tarifas inativas (para as poder reativar).

drop policy if exists "Leitura publica portes ativos" on public.portes_tarifas;
create policy "Leitura publica portes ativos"
on public.portes_tarifas for select
to anon, authenticated
using (
  ativo = true
    or public.is_admin()
);
