-- Corrige listar_produtos_plataforma_admin (usada na pagina Fornecedores)
-- para tambem devolver o campo "observacoes" do produto.
-- Sem isto, o campo Observacoes aparece sempre vazio ao editar produto
-- a partir de Fornecedores, mesmo que tenha sido gravado com sucesso.
-- Executar uma vez no SQL Editor do Supabase.

create or replace function public.listar_produtos_plataforma_admin()
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
      'id', produto.id,
      'referencia', produto.referencia,
      'lego', coalesce(produto.lego, ''),
      'sku', produto.sku,
      'nome', produto.nome,
      'preco', coalesce(produto.preco, 0),
      'preco_compra', coalesce(produto.preco_compra, 0),
      'top', coalesce(produto.top, ''),
      'arquivado', coalesce(produto.arquivado, false),
      'descontinuado', coalesce(produto.descontinuado, false),
      'novidade', coalesce(produto.novidade, false),
      'peso', coalesce(produto.peso, 10),
      'tema', coalesce(produto.tema, ''),
      'subtema', coalesce(produto.subtema, ''),
      'imagens', produto.imagens,
      'stock', coalesce(produto.stock, 0),
      'observacoes', coalesce(produto.observacoes, ''),
      'fornecedores', coalesce(produto.fornecedores, '{}'::jsonb),
      'ativo', coalesce(produto.ativo, true)
    ) order by produto.nome)
    from public.produtos as produto
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.listar_produtos_plataforma_admin()
from public, anon;
grant execute on function public.listar_produtos_plataforma_admin()
to authenticated;
