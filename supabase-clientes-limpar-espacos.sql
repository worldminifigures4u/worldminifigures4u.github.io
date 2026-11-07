-- 07/11/2026 — Fichas de cliente: tirar espaços a mais ao gravar
-- Morada (cada linha), cidade, código postal, telemóvel, e-mail e país: sem espaços no início/fim e sem espaços duplos.
-- (O nome e o nome de utilizador já eram limpos por trg_sanitizar_nome_clientes_gestao.)
create or replace function public.limpar_espacos_texto(p text, p_multilinha boolean default false) returns text
language sql immutable set search_path to 'public' as $f$
  select nullif(
    case when p_multilinha then
      btrim(regexp_replace(regexp_replace(regexp_replace(replace(coalesce(p,''), E'\r', ''), '[^\S\n]+', ' ', 'g'), ' *\n *', E'\n', 'g'), '\n{2,}', E'\n', 'g'), E' \n')
    else
      btrim(regexp_replace(coalesce(p,''), '\s+', ' ', 'g'))
    end, '')
$f$;

create or replace function public.trg_limpar_espacos_clientes_gestao() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  new.morada := limpar_espacos_texto(new.morada, true);
  new.cidade := limpar_espacos_texto(new.cidade);
  new.cp := limpar_espacos_texto(new.cp);
  new.telefone := limpar_espacos_texto(new.telefone);
  new.email := limpar_espacos_texto(new.email);
  new.pais := limpar_espacos_texto(new.pais);
  return new;
end $f$;

drop trigger if exists trg_limpar_espacos_clientes_gestao on public.clientes_gestao;
create trigger trg_limpar_espacos_clientes_gestao before insert or update of morada, cidade, cp, telefone, email, pais
  on public.clientes_gestao for each row execute function public.trg_limpar_espacos_clientes_gestao();

-- Correção das fichas existentes (2 moradas com espaços duplos em 07/11/2026):
-- update clientes_gestao set morada = morada where morada ~ '[^\S\n]{2,}';
