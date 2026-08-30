-- Remove apenas marcações numéricas guardadas dentro de produtos.fornecedores.
-- Não altera stock, encomendas de clientes nem encomendas a fornecedores.

with fornecedores_normalizados as (
  select
    id,
    coalesce((
      select jsonb_object_agg(chave, valor)
      from (
        select
          chave,
          case
            when jsonb_typeof(valor) = 'object'
              and coalesce(valor->>'estado', '') ~ '^-?[0-9]+([,.][0-9]+)?$'
              and valor ? 'historico'
            then jsonb_set(valor, '{estado}', '""'::jsonb, true)
            else valor
          end as valor
        from jsonb_each(produtos.fornecedores) as item(chave, valor)
      ) as normalizado
      where not (
        jsonb_typeof(valor) in ('string', 'number')
        and trim(both '"' from valor::text) ~ '^-?[0-9]+([,.][0-9]+)?$'
      )
      and not (
        jsonb_typeof(valor) = 'object'
        and coalesce(valor->>'estado', '') ~ '^-?[0-9]+([,.][0-9]+)?$'
        and not (valor ? 'historico')
      )
    ), '{}'::jsonb) as fornecedores
  from public.produtos
  where fornecedores <> '{}'::jsonb
)
update public.produtos as produto
set fornecedores = fornecedores_normalizados.fornecedores
from fornecedores_normalizados
where produto.id = fornecedores_normalizados.id
  and produto.fornecedores is distinct from fornecedores_normalizados.fornecedores;
