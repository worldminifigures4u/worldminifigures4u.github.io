-- Executar no SQL Editor do Supabase.
-- Sanitiza nomes de pessoa guardados em clientes / clientes_gestao
-- (remove HTML/tags e limita tamanho; a UI ja usa textContent).

create or replace function public.sanitizar_nome_pessoa(p_nome text)
returns text
language plpgsql
immutable
as $$
declare
  v text := coalesce(p_nome, '');
begin
  -- Remove tags HTML e artefactos comuns de XSS.
  v := regexp_replace(v, '<[^>]*>', ' ', 'g');
  v := replace(v, '&lt;', ' ');
  v := replace(v, '&gt;', ' ');
  v := replace(v, '&quot;', ' ');
  v := replace(v, '&#39;', ' ');
  v := replace(v, '&amp;', ' ');

  -- Remove < > " e caracteres de controlo (mantem letras acentuadas, espacos, hifen, apostrofo).
  v := regexp_replace(v, E'[<>"\\x00-\\x1F\\x7F]', '', 'g');

  -- Colapsa espacos.
  v := regexp_replace(trim(v), '\s+', ' ', 'g');

  if char_length(v) > 120 then
    v := left(v, 120);
    v := regexp_replace(v, '\s+$', '', 'g');
  end if;

  return nullif(v, '');
end;
$$;

revoke all on function public.sanitizar_nome_pessoa(text) from public, anon;
grant execute on function public.sanitizar_nome_pessoa(text) to authenticated;

create or replace function public.trg_sanitizar_nome_clientes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.nome := public.sanitizar_nome_pessoa(new.nome);
  return new;
end;
$$;

drop trigger if exists trg_sanitizar_nome_clientes on public.clientes;
create trigger trg_sanitizar_nome_clientes
before insert or update of nome
on public.clientes
for each row
execute function public.trg_sanitizar_nome_clientes();

do $$
begin
  if to_regclass('public.clientes_gestao') is null then
    return;
  end if;

  create or replace function public.trg_sanitizar_nome_clientes_gestao()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $fn$
  begin
    new.nome := public.sanitizar_nome_pessoa(new.nome);
    new.nome_utilizador := public.sanitizar_nome_pessoa(new.nome_utilizador);
    return new;
  end;
  $fn$;

  drop trigger if exists trg_sanitizar_nome_clientes_gestao on public.clientes_gestao;
  create trigger trg_sanitizar_nome_clientes_gestao
  before insert or update of nome, nome_utilizador
  on public.clientes_gestao
  for each row
  execute function public.trg_sanitizar_nome_clientes_gestao();
end;
$$;

-- Limpa nomes ja guardados com HTML.
update public.clientes
set nome = public.sanitizar_nome_pessoa(nome)
where nome is distinct from public.sanitizar_nome_pessoa(nome);

do $$
begin
  if to_regclass('public.clientes_gestao') is null then
    return;
  end if;
  update public.clientes_gestao
  set nome = public.sanitizar_nome_pessoa(nome)
  where nome is distinct from public.sanitizar_nome_pessoa(nome);
end;
$$;

-- Confirmacao rapida
select
  public.sanitizar_nome_pessoa('<img src=x onerror=alert(1)>Rui') as xss_limpo,
  public.sanitizar_nome_pessoa('  Maria   José  ') as espacos,
  char_length(public.sanitizar_nome_pessoa(repeat('A', 200))) as limite_120;
