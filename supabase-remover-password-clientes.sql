-- Executar no SQL Editor do Supabase.
-- Remove a coluna orfa public.clientes.password.
-- As passwords dos clientes ficam apenas no Supabase Auth (auth.users).

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clientes'
      and column_name = 'password'
  ) then
    alter table public.clientes drop column password;
    raise notice 'Coluna public.clientes.password removida.';
  else
    raise notice 'Coluna public.clientes.password ja nao existe.';
  end if;
end;
$$;

-- Confirmacao
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'clientes'
  and column_name = 'password';
-- Esperado: 0 linhas.
