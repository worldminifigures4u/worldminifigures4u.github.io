-- Figures Planet: cópia de segurança a partir de Gestão -> Cópia de segurança.
-- Corre uma vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
--
-- Cria duas funções só para o administrador (só leitura, não altera dados):
--   listar_tabelas_copia_admin()            -> nomes das tabelas do esquema public
--   exportar_tabela_copia_admin(tabela, limite, offset) -> linhas da tabela em JSON

create or replace function public.listar_tabelas_copia_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', t.table_name,
             'linhas', coalesce(s.n_live_tup, 0)
           ) order by t.table_name)
      from information_schema.tables t
      left join pg_stat_user_tables s
        on s.schemaname = 'public' and s.relname = t.table_name
     where t.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.exportar_tabela_copia_admin(
  p_tabela text,
  p_limite integer default 1000,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
  v_limite integer := least(greatest(coalesce(p_limite, 1000), 1), 5000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado ao administrador';
  end if;

  if not exists (
    select 1
      from information_schema.tables t
     where t.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and t.table_name = p_tabela
  ) then
    raise exception 'Tabela inexistente: %', p_tabela;
  end if;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from public.%I order by ctid limit %s offset %s) t',
    p_tabela, v_limite, v_offset
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function public.listar_tabelas_copia_admin() from public, anon;
revoke execute on function public.exportar_tabela_copia_admin(text, integer, integer) from public, anon;
grant execute on function public.listar_tabelas_copia_admin() to authenticated;
grant execute on function public.exportar_tabela_copia_admin(text, integer, integer) to authenticated;
