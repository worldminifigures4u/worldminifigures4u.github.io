// Codigo de finalizacao de encomenda.
// Carregado apenas na pagina Carrinho.

async function criarNovaEncomenda() {
  const statusDiv = document.getElementById('status-encomenda');
  statusDiv.className = "msg-status";
  statusDiv.innerText = "A processar encomenda...";

  if (carrinho.length === 0) {
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "O seu carrinho está vazio. Adicione pelo menos um produto antes de finalizar.";
    return;
  }

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

  const totais = recalcularTotais();

  const metodoPagamento = obterMetodoPagamentoSelecionado();

  const itensPedido = carrinho.map(item => ({
    id_produto: item.id,
    quantidade: Number(item.quantidade || 1)
  }));

  try {
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

    console.log("Encomenda gravada com sucesso:", resultado);
    mostrarMensagem(
      statusDiv,
      mensagemSucessoEncomenda(metodoPagamento, resultado.encomenda?.codigo_encomenda || ''),
      "msg-sucesso"
    );
    
    carrinho = [];
    guardarCarrinho();
    atualizarCarrinho();
    await carregarProdutosConformeUtilizador();
    if(typeof carregarHistoricoEncomendas === 'function') carregarHistoricoEncomendas(user.id);

  } catch (err) {
    console.error("Erro ao gravar encomenda:", err.message);
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "Erro ao guardar: " + err.message;
  }
}
