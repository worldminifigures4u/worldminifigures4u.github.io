-- Suporte a produtos cuja referencia do fornecedor vem em embalagens com
-- mais do que 1 unidade (ex: G0084 vem em embalagens de 4).
-- A quantidade escrita na encomenda ao fornecedor continua a representar
-- N.º de embalagens; ao receber, o stock aumenta N.º embalagens x unidades
-- por embalagem desse produto.
-- Executar uma vez no SQL Editor do Supabase.

alter table public.produtos
    add column if not exists unidades_por_embalagem integer not null default 1;

alter table public.produtos
    drop constraint if exists produtos_unidades_por_embalagem_check;

alter table public.produtos
    add constraint produtos_unidades_por_embalagem_check
    check (unidades_por_embalagem >= 1);

-- Atualiza listar_produtos_mapas_admin para devolver o novo campo.
create or replace function public.listar_produtos_mapas_admin(
  p_limite integer default 500,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
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
      'stock', coalesce(produto.stock, 0),
      'unidades_por_embalagem', coalesce(produto.unidades_por_embalagem, 1),
      'ativo', coalesce(produto.ativo, true),
      'observacoes', coalesce(produto.observacoes, ''),
      'imagens', coalesce(to_jsonb(produto.imagens), '[]'::jsonb),
      'fornecedores', coalesce(produto.fornecedores, '{}'::jsonb)
    ) order by produto.nome)
    from (
      select *
      from public.produtos
      order by nome, sku
      limit greatest(coalesce(p_limite, 500), 1)
      offset greatest(coalesce(p_offset, 0), 0)
    ) as produto
  ), '[]'::jsonb);
end;
$$;

-- Atualiza listar_produtos_plataforma_admin (pagina Fornecedores) para
-- devolver o mesmo campo.
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
      'unidades_por_embalagem', coalesce(produto.unidades_por_embalagem, 1),
      'observacoes', coalesce(produto.observacoes, ''),
      'fornecedores', coalesce(produto.fornecedores, '{}'::jsonb),
      'ativo', coalesce(produto.ativo, true)
    ) order by produto.nome)
    from public.produtos as produto
  ), '[]'::jsonb);
end;
$$;

-- Atualiza editar_produto_admin_v2 para gravar/devolver o novo campo.
create or replace function public.editar_produto_admin_v2(
  p_id text,
  p_sku_original text,
  p_produto jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produto public.produtos%rowtype;
  v_imagens json[];
  v_sku text;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  if p_produto is null or jsonb_typeof(p_produto) <> 'object' then
    raise exception 'Produto invalido.';
  end if;

  v_sku := upper(trim(coalesce(p_produto->>'sku', '')));
  if v_sku = '' then
    raise exception 'SKU invalido.';
  end if;

  select coalesce(array_agg(to_json(trim(valor))), array[]::json[])
  into v_imagens
  from jsonb_array_elements_text(coalesce(p_produto->'imagens', '[]'::jsonb)) as imagens(valor)
  where trim(valor) <> '';

  update public.produtos as produto
  set
    sku = v_sku,
    referencia = nullif(trim(coalesce(p_produto->>'referencia', '')), ''),
    lego = nullif(trim(coalesce(p_produto->>'lego', produto.lego, '')), ''),
    nome = trim(coalesce(p_produto->>'nome', '')),
    tema = trim(coalesce(p_produto->>'tema', '')),
    subtema = coalesce(nullif(trim(coalesce(p_produto->>'subtema', '')), ''), 'semsubtema'),
    preco = (p_produto->>'preco')::numeric,
    preco_compra = coalesce(nullif(trim(coalesce(p_produto->>'preco_compra', '')), '')::numeric, 0),
    peso = (p_produto->>'peso')::numeric,
    stock = (p_produto->>'stock')::integer,
    unidades_por_embalagem = greatest(1, coalesce(nullif(trim(coalesce(p_produto->>'unidades_por_embalagem', '')), '')::integer, 1)),
    top = nullif(trim(coalesce(p_produto->>'top', '')), ''),
    arquivado = coalesce((p_produto->>'arquivado')::boolean, false),
    descontinuado = coalesce((p_produto->>'descontinuado')::boolean, false),
    observacoes = nullif(trim(coalesce(p_produto->>'observacoes', '')), ''),
    ativo = coalesce((p_produto->>'ativo')::boolean, true),
    novidade = coalesce((p_produto->>'novidade')::boolean, false),
    imagens = v_imagens,
    fornecedores = coalesce(p_produto->'fornecedores', produto.fornecedores, '{}'::jsonb)
  where nullif(trim(coalesce(p_id, '')), '') is not null
    and produto.id::text = trim(p_id)
  returning produto.*
  into v_produto;

  if not found then
    update public.produtos as produto
    set
      sku = v_sku,
      referencia = nullif(trim(coalesce(p_produto->>'referencia', '')), ''),
      lego = nullif(trim(coalesce(p_produto->>'lego', produto.lego, '')), ''),
      nome = trim(coalesce(p_produto->>'nome', '')),
      tema = trim(coalesce(p_produto->>'tema', '')),
      subtema = coalesce(nullif(trim(coalesce(p_produto->>'subtema', '')), ''), 'semsubtema'),
      preco = (p_produto->>'preco')::numeric,
      preco_compra = coalesce(nullif(trim(coalesce(p_produto->>'preco_compra', '')), '')::numeric, 0),
      peso = (p_produto->>'peso')::numeric,
      stock = (p_produto->>'stock')::integer,
      unidades_por_embalagem = greatest(1, coalesce(nullif(trim(coalesce(p_produto->>'unidades_por_embalagem', '')), '')::integer, 1)),
      top = nullif(trim(coalesce(p_produto->>'top', '')), ''),
      arquivado = coalesce((p_produto->>'arquivado')::boolean, false),
      descontinuado = coalesce((p_produto->>'descontinuado')::boolean, false),
      observacoes = nullif(trim(coalesce(p_produto->>'observacoes', '')), ''),
      ativo = coalesce((p_produto->>'ativo')::boolean, true),
      novidade = coalesce((p_produto->>'novidade')::boolean, false),
      imagens = v_imagens,
      fornecedores = coalesce(p_produto->'fornecedores', produto.fornecedores, '{}'::jsonb)
    where upper(produto.sku) = upper(trim(coalesce(p_sku_original, '')))
    returning produto.*
    into v_produto;
  end if;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  return jsonb_build_object(
    'id', v_produto.id,
    'referencia', v_produto.referencia,
    'lego', coalesce(v_produto.lego, ''),
    'sku', v_produto.sku,
    'nome', v_produto.nome,
    'preco', coalesce(v_produto.preco, 0),
    'preco_compra', coalesce(v_produto.preco_compra, 0),
    'top', coalesce(v_produto.top, ''),
    'arquivado', coalesce(v_produto.arquivado, false),
    'descontinuado', coalesce(v_produto.descontinuado, false),
    'novidade', coalesce(v_produto.novidade, false),
    'peso', coalesce(v_produto.peso, 10),
    'tema', coalesce(v_produto.tema, ''),
    'subtema', coalesce(v_produto.subtema, ''),
    'observacoes', coalesce(v_produto.observacoes, ''),
    'imagens', coalesce(to_jsonb(v_produto.imagens), '[]'::jsonb),
    'stock', coalesce(v_produto.stock, 0),
    'unidades_por_embalagem', coalesce(v_produto.unidades_por_embalagem, 1),
    'fornecedores', coalesce(v_produto.fornecedores, '{}'::jsonb),
    'ativo', coalesce(v_produto.ativo, true)
  );
end;
$$;

-- Atualiza receber_stock_fornecedor_admin: o stock passa a aumentar
-- qtd_aplicar (embalagens recebidas) x unidades_por_embalagem do produto.
-- O 'recebido'/'pendente' da encomenda mantem-se em embalagens (inalterado).
create or replace function public.receber_stock_fornecedor_admin(
    p_encomenda_id text,
    p_recebidos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    encomenda public.encomendas_fornecedores;
    item jsonb;
    novos_itens jsonb := '[]'::jsonb;
    aplicado jsonb := '[]'::jsonb;
    produto_id_text text;
    qtd_pedida int;
    qtd_ja_recebida int;
    qtd_solicitada int;
    qtd_aplicar int;
    qtd_pendente int;
    novo_recebido int;
    algum_recebido boolean := false;
    tudo_recebido boolean := true;
    atualizada public.encomendas_fornecedores;
    v_stock_atual int;
    v_unidades_por_embalagem int;
    v_qtd_stock int;
begin
    if not public.admin_fornecedores_autorizado() then
        raise exception 'Acesso reservado ao administrador.';
    end if;

    select * into encomenda
    from public.encomendas_fornecedores
    where id::text = p_encomenda_id
    for update;

    if encomenda.id is null then
        raise exception 'Encomenda de fornecedor nao encontrada.';
    end if;

    for item in select value from jsonb_array_elements(coalesce(encomenda.itens, '[]'::jsonb)) loop
        produto_id_text := item ->> 'id';
        qtd_pedida := greatest(0, coalesce((item ->> 'quantidade')::int, 0));
        qtd_ja_recebida := greatest(0, coalesce((item ->> 'recebido')::int, 0));
        qtd_pendente := greatest(0, qtd_pedida - qtd_ja_recebida);

        select coalesce(sum(greatest(0, coalesce((r.value ->> 'quantidade')::int, 0))), 0)
        into qtd_solicitada
        from jsonb_array_elements(coalesce(p_recebidos, '[]'::jsonb)) as r(value)
        where coalesce(r.value ->> 'produto_id', r.value ->> 'id') = produto_id_text;

        qtd_aplicar := least(qtd_solicitada, qtd_pendente);

        if produto_id_text is not null and qtd_aplicar > 0 then
            select coalesce(stock, 0), greatest(1, coalesce(unidades_por_embalagem, 1))
            into v_stock_atual, v_unidades_por_embalagem
            from public.produtos
            where id::text = produto_id_text
            for update;

            if not found then
                raise exception 'Produto % nao encontrado no catalogo.', produto_id_text;
            end if;

            v_qtd_stock := qtd_aplicar * v_unidades_por_embalagem;

            update public.produtos
            set
                novidade = case
                    when v_stock_atual <= 0 and (v_stock_atual + v_qtd_stock) > 0 then false
                    else novidade
                end,
                stock = v_stock_atual + v_qtd_stock,
                -- Stock saiu de <=0 (inclui negativo) para >0: ativar no catálogo
                ativo = (v_stock_atual + v_qtd_stock) > 0
            where id::text = produto_id_text;

            aplicado := aplicado || jsonb_build_array(jsonb_build_object(
                'produto_id', produto_id_text,
                'quantidade', qtd_aplicar,
                'unidades_por_embalagem', v_unidades_por_embalagem,
                'quantidade_stock', v_qtd_stock,
                'solicitada', qtd_solicitada,
                'pendente_antes', qtd_pendente,
                'stock_antes', v_stock_atual,
                'stock_depois', v_stock_atual + v_qtd_stock,
                'ativado', (v_stock_atual <= 0 and (v_stock_atual + v_qtd_stock) > 0)
            ));
        end if;

        novo_recebido := qtd_ja_recebida + qtd_aplicar;
        if novo_recebido > 0 then
            algum_recebido := true;
        end if;
        if novo_recebido < qtd_pedida then
            tudo_recebido := false;
        end if;

        novos_itens := novos_itens || jsonb_set(item, '{recebido}', to_jsonb(novo_recebido), true);
    end loop;

    if jsonb_array_length(novos_itens) = 0 then
        tudo_recebido := false;
        algum_recebido := false;
    end if;

    update public.encomendas_fornecedores
    set itens = novos_itens,
        estado = case
            when tudo_recebido and jsonb_array_length(novos_itens) > 0 then 'Recebida'
            when algum_recebido then 'Recebida parcialmente'
            else estado
        end
    where id = encomenda.id
    returning * into atualizada;

    return jsonb_build_object(
        'sucesso', true,
        'encomenda', to_jsonb(atualizada),
        'recebido_aplicado', aplicado
    );
end;
$$;
