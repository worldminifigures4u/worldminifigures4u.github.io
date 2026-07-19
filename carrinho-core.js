// Lista e quantidades do carrinho (pagina Carrinho).
let ultimaChaveRenderCarrinho = '';

function obterChaveRenderCarrinho() {
    return JSON.stringify(
        carrinho.map(item => [
            String(item.id),
            Number(item.quantidade || 1),
            String(item.imagem || '')
        ])
    );
}

function finalizarRenderCarrinho() {
    const carrinhoDiv = document.getElementById('lista-carrinho');
    if (carrinhoDiv) {
        carrinhoDiv.classList.remove('lista-carrinho--preparar');
    }
}

function guardarCarrinho() {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
}

function restaurarCarrinhoGuardado() {
    carrinho = carregarCarrinhoLocal();
    atualizarCarrinho();
}

function limparCarrinho() {
    carrinho = [];
    guardarCarrinho();
    atualizarCarrinho();
}

function adicionarAoCarrinho(prod) {
    const itemExistente = carrinho.find(item => item.id === prod.id);

    if (itemExistente) {
        itemExistente.quantidade++;
    } else {
        carrinho.push({
            id: prod.id,
            nome: prod.nome,
            preco: prod.preco,
            peso: Number(prod.peso || PESO_PADRAO_PRODUTO_GRAMAS),
            imagem: obterImagemPrincipalProduto(prod),
            quantidade: 1
        });
    }

    guardarCarrinho();
    atualizarCarrinho();
}

function aumentarQuantidade(id) {
    const item = carrinho.find(p => p.id === id);
    if (!item) return;
    item.quantidade++;
    guardarCarrinho();
    atualizarCarrinho();
}

function diminuirQuantidade(id) {
    const item = carrinho.find(p => p.id === id);
    if (!item) return;
    if (Number(item.quantidade || 1) <= 1) return;
    item.quantidade--;
    guardarCarrinho();
    atualizarCarrinho();
}

function atualizarTotaisSemEnvio(subtotal) {
    const subtotalEl = document.getElementById('subtotal');
    const portesEl = document.getElementById('portes');
    const totalEl = document.getElementById('total');
    if (subtotalEl) subtotalEl.textContent = formatarEuro(subtotal) + ' €';
    if (portesEl) portesEl.textContent = '—';
    if (totalEl) totalEl.textContent = formatarEuro(subtotal) + ' €';
}

function solicitarAtualizacaoEnvio() {
    if (typeof atualizarOpcoesEnvio === 'function') {
        atualizarOpcoesEnvio();
        return;
    }

    const subtotal = carrinho.reduce(
        (total, item) => total + Number(item.preco || 0) * Number(item.quantidade || 1),
        0
    );
    atualizarTotaisSemEnvio(subtotal);

    if (typeof garantirModulosEnvioCarrinho === 'function') {
        garantirModulosEnvioCarrinho()
            .then(() => {
                if (typeof atualizarOpcoesEnvio === 'function') atualizarOpcoesEnvio();
            })
            .catch(console.error);
    }
}

function atualizarCarrinho(opcoes = {}) {
    atualizarContadorCarrinhoCabecalho();

    const carrinhoDiv = document.getElementById('lista-carrinho');
    if (!carrinhoDiv) return;

    const chaveAtual = obterChaveRenderCarrinho();
    const temConteudoRenderizado = !!carrinhoDiv.querySelector('.linha-carrinho, #carrinho-vazio');
    if (!opcoes.forcar && chaveAtual === ultimaChaveRenderCarrinho && temConteudoRenderizado) {
        solicitarAtualizacaoEnvio();
        finalizarRenderCarrinho();
        return;
    }

    ultimaChaveRenderCarrinho = chaveAtual;
    carrinhoDiv.replaceChildren();

    if (carrinho.length === 0) {
        const vazio = document.createElement('p');
        vazio.id = 'carrinho-vazio';
        vazio.textContent = 'Nenhum produto adicionado.';
        carrinhoDiv.appendChild(vazio);
        solicitarAtualizacaoEnvio();
        finalizarRenderCarrinho();
        return;
    }

    let subtotal = 0;
    let imagensCarrinhoAtualizadas = false;

    carrinho.forEach(item => {
        subtotal += Number(item.preco || 0) * item.quantidade;

        const linha = document.createElement('div');
        linha.className = 'linha-carrinho';

        const produtoCompleto = todosOsProdutos.find(produto => String(produto.id) === String(item.id));
        const imagemSrc = typeof obterImagemAtualCarrinho === 'function'
            ? obterImagemAtualCarrinho(item, produtoCompleto)
            : (item.imagem || obterImagemPrincipalProduto(produtoCompleto || item));
        if (item.imagem !== imagemSrc) {
            item.imagem = imagemSrc;
            imagensCarrinhoAtualizadas = true;
        }

        const imagem = document.createElement('img');
        imagem.className = 'imagem-carrinho';
        imagem.loading = 'eager';
        imagem.decoding = 'sync';
        imagem.src = otimizarImagemCloudinary(imagemSrc, 180);
        imagem.alt = item.nome;
        imagem.onerror = () => {
            if (imagem.src.indexOf('img/sem-imagem.svg?v=20260719') === -1) {
                imagem.src = 'img/sem-imagem.svg?v=20260719';
            }
        };

        const info = document.createElement('div');
        info.className = 'info-carrinho';

        const linhaPrincipal = document.createElement('div');
        linhaPrincipal.className = 'carrinho-linha-principal';

        const nome = document.createElement('strong');
        nome.textContent = item.nome;

        const preco = document.createElement('div');
        preco.className = 'preco-carrinho';
        preco.textContent = formatarEuro(item.preco * item.quantidade) + ' €';

        const tema = document.createElement('span');
        tema.className = 'carrinho-tema';
        const temaDetalhe = [produtoCompleto?.tema, produtoCompleto?.subtema, item.tema, item.subtema]
            .map(valor => String(valor || '').trim())
            .filter(valor => valor && !/^sem\s*subtema$/i.test(valor));
        tema.textContent = temaDetalhe.length
            ? [...new Set(temaDetalhe)].join(' - ')
            : 'Sem tema';

        linhaPrincipal.append(nome, preco);
        info.append(linhaPrincipal, tema);

        const botoes = document.createElement('div');
        botoes.className = 'controlos-carrinho';

        const btnMenos = document.createElement('button');
        btnMenos.className = 'btn-quantidade';
        btnMenos.textContent = '-';
        btnMenos.setAttribute('aria-label', 'Diminuir quantidade');
        btnMenos.disabled = Number(item.quantidade || 1) <= 1;
        btnMenos.onclick = () => diminuirQuantidade(item.id);

        const quantidade = document.createElement('span');
        quantidade.className = 'quantidade-carrinho';
        quantidade.textContent = item.quantidade;

        const btnMais = document.createElement('button');
        btnMais.className = 'btn-quantidade';
        btnMais.textContent = '+';
        btnMais.setAttribute('aria-label', 'Aumentar quantidade');
        btnMais.onclick = () => aumentarQuantidade(item.id);

        const btnRemover = document.createElement('button');
        btnRemover.className = 'btn-remover';
        btnRemover.textContent = 'X';
        btnRemover.setAttribute('aria-label', 'Remover produto');
        btnRemover.onclick = () => removerCarrinho(item.id);

        botoes.append(btnMenos, quantidade, btnMais, btnRemover);
        linha.append(imagem, info, botoes);
        carrinhoDiv.appendChild(linha);
    });

    if (imagensCarrinhoAtualizadas) {
        guardarCarrinho();
    }

    solicitarAtualizacaoEnvio();
    finalizarRenderCarrinho();
}

function removerCarrinho(id) {
    carrinho = carrinho.filter(item => item.id !== id);
    guardarCarrinho();
    atualizarCarrinho();
}
