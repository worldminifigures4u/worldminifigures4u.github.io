-- Executar no SQL Editor do Supabase.
-- Permite apenas ao administrador consultar todas as encomendas e alterar o estado.

alter table public.encomendas enable row level security;

drop policy if exists "Administrador pode ler todas as encomendas" on public.encomendas;
create policy "Administrador pode ler todas as encomendas"
on public.encomendas
for select
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

grant select on public.encomendas to authenticated;

drop policy if exists "Administrador pode atualizar estado das encomendas" on public.encomendas;
create policy "Administrador pode atualizar estado das encomendas"
on public.encomendas
for update
to authenticated
using ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'worldminifigures4u@gmail.com');

grant update (estado) on public.encomendas to authenticated;

create or replace function public.atualizar_estado_encomenda_admin(
  p_encomenda_id text,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if p_estado not in (
    'A aguardar pagamento',
    'Pago',
    'Em preparação',
    'Enviado',
    'Concluído',
    'Cancelado'
  ) then
    raise exception 'Estado inválido';
  end if;

  update public.encomendas
  set estado = p_estado
  where id::text = p_encomenda_id;

  if not found then
    raise exception 'Encomenda não encontrada';
  end if;

  return jsonb_build_object('sucesso', true, 'estado', p_estado);
end;
$$;

revoke execute on function public.atualizar_estado_encomenda_admin(text, text)
from public, anon;

grant execute on function public.atualizar_estado_encomenda_admin(text, text)
to authenticated;

-- Devolve apenas as imagens necessarias ao painel de encomendas. Ao usar uma
-- funcao administrativa, as fotografias continuam disponiveis mesmo quando o
-- produto ficou sem stock e deixou de aparecer na vista publica da loja.
create or replace function public.obter_imagens_produtos_encomendas_admin(
  p_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produtos jsonb;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <>
     'worldminifigures4u@gmail.com' then
    raise exception 'Acesso reservado ao administrador';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', produto.id::text,
        'referencia', produto.referencia,
        'sku', produto.sku,
        'imagens', produto.imagens
      )
      order by produto.id
    ),
    '[]'::jsonb
  )
  into v_produtos
  from public.produtos as produto
  where produto.id::text = any(coalesce(p_ids, array[]::text[]));

  return v_produtos;
end;
$$;

revoke execute on function public.obter_imagens_produtos_encomendas_admin(text[])
from public, anon;

grant execute on function public.obter_imagens_produtos_encomendas_admin(text[])
to authenticated;
alter table public.produtos add column if not exists referencia text;
