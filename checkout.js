// Codigo de finalizacao de encomenda.
// Carregado apenas na pagina Carrinho.

let criarEncomendaEmCurso = false;
const CHAVE_POPUP_SUCESSO_ENCOMENDA = 'figures-planet-encomenda-sucesso';

function definirBotoesConfirmarEncomenda(desativado) {
  document.querySelectorAll('[data-acao-carrinho="confirmar-encomenda"]').forEach((botao) => {
    botao.disabled = !!desativado;
  });
}

function guardarPopupSucessoEncomenda(mensagem) {
  try {
    sessionStorage.setItem(CHAVE_POPUP_SUCESSO_ENCOMENDA, JSON.stringify({
      mensagem: String(mensagem || ''),
      criadoEm: Date.now()
    }));
    return true;
  } catch (erro) {
    console.warn('Nao foi possivel preparar o popup de sucesso da encomenda:', erro);
    return false;
  }
}

async function criarNovaEncomenda() {
  if (criarEncomendaEmCurso) return;

  const statusDiv = document.getElementById('status-encomenda');
  statusDiv.className = "msg-status";
  statusDiv.innerText = "A processar encomenda...";

  if (carrinho.length === 0) {
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "O seu carrinho está vazio. Adicione pelo menos um produto antes de finalizar.";
    return;
  }

  criarEncomendaEmCurso = true;
  definirBotoesConfirmarEncomenda(true);

  try {
    const { data: { user }, error: authError } = await dbClient.auth.getUser();

    if (authError || !user) {
      console.error("Erro de Autenticação:", authError);
      statusDiv.className = "msg-status msg-erro";
      statusDiv.innerText = "Necessita de iniciar sessão ou registar-se na secção Minha Conta para finalizar a encomenda.";
      return;
    }

    if (user.email_confirmed_at === null) {
      statusDiv.className = "msg-status msg-erro";
      statusDiv.innerText = "Confirme o seu e-mail antes de finalizar a encomenda.";
      return;
    }

    const { error: bloqueioErro } = await dbClient.rpc('assert_cliente_pode_comprar_site');
    if (bloqueioErro) {
      statusDiv.className = "msg-status msg-erro";
      statusDiv.innerText = obterMensagemErroCliente(
        bloqueioErro,
        "Não é possível concluir compras com esta conta."
      );
      return;
    }

    const totais = recalcularTotais();

    const metodoPagamento = obterMetodoPagamentoSelecionado();

    const itensPedido = [];
    for (const item of carrinho) {
      const quantidade = Math.floor(Number(item.quantidade));
      if (!item.id || !Number.isFinite(quantidade) || quantidade < 1 || quantidade > 99) {
        throw new Error("Carrinho inválido. Atualize as quantidades e tente novamente.");
      }
      itensPedido.push({
        id_produto: item.id,
        quantidade
      });
    }

    const { data: { session } } = await dbClient.auth.getSession();
    if(!session?.access_token){
      throw new Error("Sessão inválida. Faça login novamente.");
    }

    const resposta = await executarComTimeout(
      fetch(`${SUPABASE_URL}/functions/v1/criar-encomenda`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          itens: itensPedido,
          regiao: totais.paisEnvio,
          metodo_envio: totais.metodoEnvio,
          metodo_envio_nome: totais.metodoEnvioNome,
          metodo_pagamento: metodoPagamento
        })
      }),
      30000,
      "O checkout demorou demasiado. Tente novamente."
    );

    const resultado = await resposta.json().catch(() => ({}));

    if(!resposta.ok || !resultado.sucesso){
      const produtosSemStock = Array.isArray(resultado.produtos_sem_stock)
        ? resultado.produtos_sem_stock
            .map(item => String(item?.nome || '').trim())
            .filter(Boolean)
        : [];
      const mensagemStock = produtosSemStock.length > 0
        ? `Stock insuficiente para: ${produtosSemStock.join(', ')}. Atualize o carrinho e tente novamente.`
        : '';
      throw new Error(mensagemStock || resultado.error || "Não foi possível criar a encomenda.");
    }
    const mensagemSucesso = mensagemSucessoEncomenda(
      metodoPagamento,
      resultado.encomenda?.codigo_encomenda || ''
    );
    const popupPreparado = guardarPopupSucessoEncomenda(mensagemSucesso);
    mostrarMensagem(statusDiv, mensagemSucesso, "msg-sucesso");
    
    carrinho = [];
    guardarCarrinho();
    atualizarCarrinho();

    if (popupPreparado) {
      window.location.assign('index.html?encomenda=sucesso');
      return;
    }

    await carregarProdutosConformeUtilizador();
    if(typeof carregarHistoricoEncomendas === 'function') carregarHistoricoEncomendas(user.id);

  } catch (err) {
    console.error("Erro ao gravar encomenda:", err);
    statusDiv.className = "msg-status msg-erro";
    const mensagemStock = String(err?.message || '');
    statusDiv.innerText = mensagemStock.startsWith('Stock insuficiente')
      ? mensagemStock
      : obterMensagemErroCliente(err, "Não foi possível concluir a encomenda. Tente novamente.");
  } finally {
    criarEncomendaEmCurso = false;
    // Sucesso esvazia o carrinho: manter botão desativado evita reenvio acidental.
    if (carrinho.length > 0) definirBotoesConfirmarEncomenda(false);
  }
}
