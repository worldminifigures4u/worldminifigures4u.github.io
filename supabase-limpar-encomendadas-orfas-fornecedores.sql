-- Limpa entradas antigas "Encomendada" no historico dos fornecedores
-- quando nao existe uma linha real de encomenda a fornecedor nessa data.
-- Nao altera stock, vendas, encomendas de clientes, nem encomendas a fornecedores.

-- 1) PRE-VISUALIZAR ANTES DE LIMPAR
with historico_encomendado as (
  select
    p.id,
    p.nome,
    p.referencia,
    f.key as fornecedor,
    h.item as linha_historico,
    case
      when coalesce(h.item ->> 'data', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then to_date(substr(h.item ->> 'data', 1, 10), 'YYYY-MM-DD')
      when coalesce(h.item ->> 'data', '') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' then to_date(h.item ->> 'data', 'DD/MM/YYYY')
      else null
    end as data_historico
  from public.produtos p
  cross join lateral jsonb_each(coalesce(p.fornecedores, '{}'::jsonb)) as f(key, value)
  cross join lateral jsonb_array_elements(coalesce(f.value -> 'historico', '[]'::jsonb)) with ordinality as h(item, pos)
  where jsonb_typeof(f.value) = 'object'
    and lower(coalesce(h.item ->> 'tipo', '')) in ('encomendada', 'encomendado')
)
select
  h.nome,
  h.referencia,
  h.fornecedor,
  h.linha_historico ->> 'data' as data_marcada
from historico_encomendado h
where h.data_historico is not null
  and not exists (
    select 1
    from public.encomendas_fornecedores ef
    cross join lateral jsonb_array_elements(coalesce(ef.itens, '[]'::jsonb)) as item(value)
    where regexp_replace(lower(coalesce(ef.fornecedor, '')), '[^a-z0-9]+', '', 'g')
        = regexp_replace(lower(coalesce(h.fornecedor, '')), '[^a-z0-9]+', '', 'g')
      and coalesce(ef.estado, '') <> 'Cancelada'
      and (
        nullif(item.value ->> 'id', '') = h.id::text
        or regexp_replace(upper(coalesce(item.value ->> 'referencia', '')), '[^A-Z0-9]+', '', 'g')
         = regexp_replace(upper(coalesce(h.referencia, '')), '[^A-Z0-9]+', '', 'g')
      )
      and coalesce(ef.data_encomendada::date, ef.criado_em::date) = h.data_historico
  )
order by h.nome, h.fornecedor, data_marcada;

-- 2) LIMPAR
with fornecedores_filtrados as (
  select
    p.id,
    coalesce(jsonb_object_agg(f.key, f.valor_filtrado) filter (where f.valor_filtrado is not null), '{}'::jsonb) as fornecedores
  from public.produtos p
  cross join lateral (
    select
      fornecedor.key,
      case
        when jsonb_typeof(fornecedor.value) <> 'object'
          then fornecedor.value
        else
          jsonb_set(
            case
              when lower(coalesce(fornecedor.value ->> 'estado', '')) in ('encomendada', 'encomendado')
                   and not exists (
                     select 1
                     from public.encomendas_fornecedores ef_estado
                     cross join lateral jsonb_array_elements(coalesce(ef_estado.itens, '[]'::jsonb)) as item_estado(value)
                     where regexp_replace(lower(coalesce(ef_estado.fornecedor, '')), '[^a-z0-9]+', '', 'g')
                         = regexp_replace(lower(coalesce(fornecedor.key, '')), '[^a-z0-9]+', '', 'g')
                       and coalesce(ef_estado.estado, '') in ('Encomendada', 'Recebida parcialmente')
                       and (
                         nullif(item_estado.value ->> 'id', '') = p.id::text
                         or regexp_replace(upper(coalesce(item_estado.value ->> 'referencia', '')), '[^A-Z0-9]+', '', 'g')
                          = regexp_replace(upper(coalesce(p.referencia, '')), '[^A-Z0-9]+', '', 'g')
                       )
                       and greatest(0, coalesce(nullif(item_estado.value ->> 'recebido', '')::int, 0))
                         < greatest(0, coalesce(nullif(item_estado.value ->> 'quantidade', '')::int, 0))
                   )
                then jsonb_set(fornecedor.value, '{estado}', '""'::jsonb, true)
              else fornecedor.value
            end,
            '{historico}',
            coalesce((
              select jsonb_agg(h.item order by h.pos)
              from jsonb_array_elements(coalesce(fornecedor.value -> 'historico', '[]'::jsonb)) with ordinality as h(item, pos)
              where not (
                lower(coalesce(h.item ->> 'tipo', '')) in ('encomendada', 'encomendado')
                and (
                  case
                    when coalesce(h.item ->> 'data', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then to_date(substr(h.item ->> 'data', 1, 10), 'YYYY-MM-DD')
                    when coalesce(h.item ->> 'data', '') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' then to_date(h.item ->> 'data', 'DD/MM/YYYY')
                    else null
                  end
                ) is not null
                and not exists (
                  select 1
                  from public.encomendas_fornecedores ef
                  cross join lateral jsonb_array_elements(coalesce(ef.itens, '[]'::jsonb)) as item(value)
                  where regexp_replace(lower(coalesce(ef.fornecedor, '')), '[^a-z0-9]+', '', 'g')
                      = regexp_replace(lower(coalesce(fornecedor.key, '')), '[^a-z0-9]+', '', 'g')
                    and coalesce(ef.estado, '') <> 'Cancelada'
                    and (
                      nullif(item.value ->> 'id', '') = p.id::text
                      or regexp_replace(upper(coalesce(item.value ->> 'referencia', '')), '[^A-Z0-9]+', '', 'g')
                       = regexp_replace(upper(coalesce(p.referencia, '')), '[^A-Z0-9]+', '', 'g')
                    )
                    and coalesce(ef.data_encomendada::date, ef.criado_em::date) = (
                      case
                        when coalesce(h.item ->> 'data', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then to_date(substr(h.item ->> 'data', 1, 10), 'YYYY-MM-DD')
                        when coalesce(h.item ->> 'data', '') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' then to_date(h.item ->> 'data', 'DD/MM/YYYY')
                        else null
                      end
                    )
                )
              )
            ), '[]'::jsonb),
            true
          )
      end as valor_filtrado
    from jsonb_each(coalesce(p.fornecedores, '{}'::jsonb)) as fornecedor(key, value)
  ) f
  group by p.id
)
update public.produtos p
set fornecedores = ff.fornecedores
from fornecedores_filtrados ff
where p.id = ff.id
  and p.fornecedores is distinct from ff.fornecedores;
