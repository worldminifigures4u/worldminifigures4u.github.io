-- Figures Planet: guardar o custo (preco de compra) de cada figura no momento da venda.
-- Corre uma vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
--
-- Funciona para todas as encomendas (site e plataformas) sem alterar as outras funcoes:
-- sempre que uma encomenda e criada, ou os produtos de uma encomenda mudam, cada figura
-- recebe "custo_unitario" com o preco_compra atual do produto.
-- Ao editar uma encomenda, as figuras que ja tinham custo mantem o custo original.
-- Encomendas antigas nao sao alteradas (as estatisticas usam o custo atual como estimativa).

create or replace function public.fp_preencher_custo_produtos_encomenda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lista jsonb;
  v_antiga jsonb := '[]'::jsonb;
  v_nova jsonb := '[]'::jsonb;
  v_item jsonb;
  v_id text;
  v_custo numeric;
begin
  if new.produtos is null then
    return new;
  end if;

  v_lista := new.produtos::jsonb;
  if jsonb_typeof(v_lista) <> 'array' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- So mexe quando os produtos mudam (mudar estado, notas, etc. nao toca nos custos).
    if old.produtos is not null and old.produtos::jsonb = v_lista then
      return new;
    end if;
    if old.produtos is not null and jsonb_typeof(old.produtos::jsonb) = 'array' then
      v_antiga := old.produtos::jsonb;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(v_lista) loop
    if jsonb_typeof(v_item) <> 'object' then
      v_nova := v_nova || jsonb_build_array(v_item);
      continue;
    end if;

    if nullif(v_item ->> 'custo_unitario', '') is not null then
      v_nova := v_nova || jsonb_build_array(v_item);
      continue;
    end if;

    v_id := nullif(coalesce(v_item ->> 'id_produto', v_item ->> 'id'), '');
    v_custo := null;

    if v_id is not null and jsonb_array_length(v_antiga) > 0 then
      select nullif(antigo ->> 'custo_unitario', '')::numeric
        into v_custo
        from jsonb_array_elements(v_antiga) as antigo
       where nullif(coalesce(antigo ->> 'id_produto', antigo ->> 'id'), '') = v_id
         and nullif(antigo ->> 'custo_unitario', '') is not null
       limit 1;
    end if;

    if v_custo is null and v_id is not null then
      select nullif(p.preco_compra, 0)
        into v_custo
        from public.produtos p
       where p.id::text = v_id
       limit 1;
    end if;

    if v_custo is not null and v_custo > 0 then
      v_item := v_item || jsonb_build_object('custo_unitario', round(v_custo, 4));
    end if;

    v_nova := v_nova || jsonb_build_array(v_item);
  end loop;

  new.produtos := v_nova;
  return new;
end;
$$;

drop trigger if exists fp_custo_produtos_encomenda on public.encomendas;
create trigger fp_custo_produtos_encomenda
  before insert or update of produtos on public.encomendas
  for each row
  execute function public.fp_preencher_custo_produtos_encomenda();
