-- =====================================================================
-- Preço de custo fixo 0,57 € para tudo o que foi comprado ao fornecedor "Lote 50"
--
--  1) Encomendas a fornecedores (Lote 50): preco_custo = 0.57 em TODOS os artigos,
--     moeda EUR (deixa de ser provisório em USD). Remove o preço de lista USD
--     guardado nesses artigos, para o site não voltar a recalcular o custo.
--  2) Produtos que aparecem nessas encomendas:
--       - preco_compra (o "preço compra" dos Mapas) = 0.57
--       - preço de compra do fornecedor Lote 50 dentro de produtos.fornecedores = 0.57
--
-- COMO USAR (Supabase > SQL Editor):
--   PASSO 1: corre só o bloco "PRÉ-VISUALIZAÇÃO" e confirma os números.
--   PASSO 2: corre o bloco "APLICAR" (tudo entre BEGIN e COMMIT).
--   Antes de alterar, são criadas cópias de segurança das linhas afetadas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PRÉ-VISUALIZAÇÃO (não altera nada)
-- ---------------------------------------------------------------------
with encomendas_lote50 as (
    select id, codigo, fornecedor, estado, itens
    from public.encomendas_fornecedores
    where regexp_replace(lower(fornecedor), '\s', '', 'g') = 'lote50'
),
artigos as (
    select e.id as encomenda_id, item
    from encomendas_lote50 e,
         jsonb_array_elements(coalesce(e.itens, '[]'::jsonb)) as item
)
select
    (select count(*) from encomendas_lote50)                                   as encomendas_lote50,
    (select count(*) from artigos)                                             as artigos_nas_encomendas,
    (select count(*) from artigos where coalesce((item->>'preco_custo')::numeric, 0) <> 0.57) as artigos_com_preco_diferente,
    (select count(distinct p.id) from public.produtos p
       join artigos a
         on p.id::text = a.item->>'id'
         or (coalesce(a.item->>'sku', '') <> '' and p.sku = a.item->>'sku'))    as produtos_a_atualizar;

-- Lista das encomendas afetadas (opcional)
select codigo, fornecedor, estado, jsonb_array_length(itens) as artigos
from public.encomendas_fornecedores
where regexp_replace(lower(fornecedor), '\s', '', 'g') = 'lote50'
order by criado_em;


-- ---------------------------------------------------------------------
-- APLICAR
-- ---------------------------------------------------------------------
begin;

-- Cópias de segurança num esquema privado "backups" (não fica acessível pelo site/API)
create schema if not exists backups;
revoke all on schema backups from anon, authenticated;

create table if not exists backups.encomendas_fornecedores_lote50_20260930 as
select * from public.encomendas_fornecedores
where regexp_replace(lower(fornecedor), '\s', '', 'g') = 'lote50';

create table if not exists backups.produtos_lote50_20260930 as
select distinct p.*
from public.produtos p
join public.encomendas_fornecedores e
  on regexp_replace(lower(e.fornecedor), '\s', '', 'g') = 'lote50'
join lateral jsonb_array_elements(coalesce(e.itens, '[]'::jsonb)) as item on true
where p.id::text = item->>'id'
   or (coalesce(item->>'sku', '') <> '' and p.sku = item->>'sku');

-- 1) Encomendas a fornecedores: todos os artigos a 0,57 € (EUR, definitivo)
update public.encomendas_fornecedores e
set itens = (
        select coalesce(jsonb_agg(
                   (item - 'preco_lista_usd' - 'custo_calculado_lista_atual')
                   || jsonb_build_object(
                          'preco_custo', 0.57,
                          'preco_custo_moeda', 'EUR',
                          'preco_custo_provisorio', false
                      )
                   order by ordem
               ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(e.itens, '[]'::jsonb)) with ordinality as t(item, ordem)
    ),
    atualizado_em = now()
where regexp_replace(lower(e.fornecedor), '\s', '', 'g') = 'lote50';

-- 2) Produtos dessas encomendas: preço compra dos Mapas + preço do fornecedor Lote 50
with produtos_lote50 as (
    select distinct p.id
    from public.produtos p
    join public.encomendas_fornecedores e
      on regexp_replace(lower(e.fornecedor), '\s', '', 'g') = 'lote50'
    join lateral jsonb_array_elements(coalesce(e.itens, '[]'::jsonb)) as item on true
    where p.id::text = item->>'id'
       or (coalesce(item->>'sku', '') <> '' and p.sku = item->>'sku')
)
update public.produtos p
set preco_compra = 0.57,
    fornecedores = (
        with base as (
            select coalesce(p.fornecedores, '{}'::jsonb) as f
        ),
        chave as (
            -- usa a chave já existente para o Lote 50 (qualquer escrita), senão cria "Lote 50"
            select coalesce(
                (select k from base, jsonb_object_keys(base.f) as k
                 where regexp_replace(lower(k), '\s', '', 'g') = 'lote50'
                 limit 1),
                'Lote 50'
            ) as k
        )
        select base.f || jsonb_build_object(
            chave.k,
            case jsonb_typeof(base.f -> chave.k)
                when 'object' then (base.f -> chave.k)
                when 'string' then jsonb_build_object('estado', base.f -> chave.k, 'historico', '[]'::jsonb)
                else '{}'::jsonb
            end
            || jsonb_build_object(
                'preco_compra', 0.57,
                'data_preco_compra', to_char(now(), 'YYYY-MM-DD')
            )
        )
        from base, chave
    )
from produtos_lote50 alvo
where p.id = alvo.id;

-- Verificação rápida antes de confirmar
select
    (select count(*) from public.encomendas_fornecedores e,
            jsonb_array_elements(e.itens) item
      where regexp_replace(lower(e.fornecedor), '\s', '', 'g') = 'lote50'
        and (item->>'preco_custo')::numeric <> 0.57)        as artigos_ainda_diferentes,
    (select count(*) from backups.produtos_lote50_20260930) as produtos_alterados;

commit;
-- Se algo parecer errado ANTES do commit, corre "rollback;" em vez de "commit;".


-- =====================================================================
-- REPOR (só se for preciso desfazer) — volta a pôr os valores guardados na cópia
-- =====================================================================
-- begin;
-- update public.encomendas_fornecedores e
-- set itens = b.itens, atualizado_em = b.atualizado_em
-- from backups.encomendas_fornecedores_lote50_20260930 b
-- where e.id = b.id;
--
-- update public.produtos p
-- set preco_compra = b.preco_compra, fornecedores = b.fornecedores
-- from backups.produtos_lote50_20260930 b
-- where p.id = b.id;
-- commit;

-- =====================================================================
-- APAGAR AS CÓPIAS (quando tiveres a certeza de que está tudo bem)
-- =====================================================================
-- drop table backups.encomendas_fornecedores_lote50_20260930;
-- drop table backups.produtos_lote50_20260930;
