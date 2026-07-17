-- Executar no SQL Editor do Supabase.
-- 1) Mostra a definição completa de criar_encomenda_com_stock
-- 2) Checklist rápida de qualidade (locks, stock, idempotência)

-- A) Definição completa (copia o resultado e envia se quiseres revisão linha a linha)
select pg_get_functiondef(p.oid) as definicao
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'criar_encomenda_com_stock';

-- B) Checklist automática (true = bom sinal)
select
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'criar_encomenda_com_stock') as funcoes_encontradas,
  pg_get_functiondef(p.oid) like '%for update%' as tem_for_update,
  pg_get_functiondef(p.oid) like '%stock%' as menciona_stock,
  pg_get_functiondef(p.oid) like '%produtos_sem_stock%' as devolve_sem_stock,
  pg_get_functiondef(p.oid) like '%sucesso%' as devolve_sucesso,
  pg_get_functiondef(p.oid) like '%stock = %stock%-%'
    or pg_get_functiondef(p.oid) like '%stock = coalesce(stock%' as parece_descontar_stock,
  pg_get_functiondef(p.oid) like '%insert into public.encomendas%'
    or pg_get_functiondef(p.oid) like '%insert into encomendas%' as cria_encomenda
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'criar_encomenda_com_stock'
limit 1;
