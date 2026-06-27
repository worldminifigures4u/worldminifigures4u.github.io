// Codigo de carrinho e portes.
// Separado de app.js para modularizar o site.

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

    if (item) {

        item.quantidade++;

        guardarCarrinho();

        atualizarCarrinho();

    }

}

function diminuirQuantidade(id) {

    const item = carrinho.find(p => p.id === id);

    if (!item) return;

    item.quantidade--;

    if (item.quantidade <= 0) {

        carrinho = carrinho.filter(
            p => p.id !== id
        );

    }

    guardarCarrinho();

    atualizarCarrinho();

}

function atualizarCarrinho() {
    atualizarContadorCarrinhoCabecalho();

const carrinhoDiv = document.getElementById("lista-carrinho");
    if (!carrinhoDiv) return;

    carrinhoDiv.replaceChildren();

    if(carrinho.length === 0){
        const vazio = document.createElement('p');
        vazio.id = 'carrinho-vazio';
        vazio.textContent = 'Nenhum produto adicionado.';
        carrinhoDiv.appendChild(vazio);
        atualizarOpcoesEnvio();
        return;
    }

    let subtotal = 0;

    let imagensCarrinhoAtualizadas = false;

    carrinho.forEach(item => {

        subtotal += Number(item.preco || 0) * item.quantidade;

        // linha principal
        const linha = document.createElement("div");
        linha.className = "linha-carrinho";

        const produtoCompleto = todosOsProdutos.find(produto => String(produto.id) === String(item.id));
        const imagemSrc = obterImagemAtualCarrinho(item, produtoCompleto);
        if(item.imagem !== imagemSrc) {
            item.imagem = imagemSrc;
            imagensCarrinhoAtualizadas = true;
        }

        const imagem = document.createElement("img");
        imagem.className = "imagem-carrinho";
        imagem.loading = "lazy";
        imagem.decoding = "async";
        imagem.src = otimizarImagemCloudinary(imagemSrc, 180);
        imagem.alt = item.nome;
        imagem.onerror = () => {
            if (imagem.src.indexOf('img/sem-imagem.png') === -1) {
                imagem.src = 'img/sem-imagem.png';
            }
        };

        // bloco nome + preço
        const info = document.createElement("div");
        info.className = "info-carrinho";

        const nome = document.createElement("strong");
        nome.textContent = item.nome;

        const preco = document.createElement("div");
        preco.className = "preco-carrinho";
        preco.textContent =
            formatarEuro(item.preco * item.quantidade) + " €";

        info.appendChild(nome);
        info.appendChild(document.createElement("br"));
        info.appendChild(preco);

        // bloco dos botões
        const botoes = document.createElement("div");
        botoes.className = "controlos-carrinho";

        // botão -
        const btnMenos = document.createElement("button");
        btnMenos.className = "btn-quantidade";
        btnMenos.textContent = "-";
        btnMenos.setAttribute("aria-label", "Diminuir quantidade");
        btnMenos.onclick = () => diminuirQuantidade(item.id);

        // quantidade
        const quantidade = document.createElement("span");
        quantidade.className = "quantidade-carrinho";
        quantidade.textContent = item.quantidade;

        // botão +
        const btnMais = document.createElement("button");
        btnMais.className = "btn-quantidade";
        btnMais.textContent = "+";
        btnMais.setAttribute("aria-label", "Aumentar quantidade");
        btnMais.onclick = () => aumentarQuantidade(item.id);

        // botão remover
        const btnRemover = document.createElement("button");
        btnRemover.className = "btn-remover";
        btnRemover.textContent = "X";
        btnRemover.setAttribute("aria-label", "Remover produto");
        btnRemover.onclick = () => removerCarrinho(item.id);

        botoes.appendChild(btnMenos);
        botoes.appendChild(quantidade);
        botoes.appendChild(btnMais);
        botoes.appendChild(btnRemover);

        linha.appendChild(imagem);
        linha.appendChild(info);
        linha.appendChild(botoes);

        carrinhoDiv.appendChild(linha);

    });

    if(imagensCarrinhoAtualizadas) {
        guardarCarrinho();
    }

document.getElementById("subtotal").textContent =
    formatarEuro(subtotal) + " €";

atualizarOpcoesEnvio();

}

function removerCarrinho(id) {

    carrinho = carrinho.filter(
        item => item.id !== id
    );

    guardarCarrinho();

    atualizarCarrinho();

}

function calcularPesoTotalCarrinho() {
    return carrinho.reduce((total, item) => {
        const pesoUnitario = Number(item.peso || PESO_PADRAO_PRODUTO_GRAMAS);
        const quantidade = Number(item.quantidade || 1);
        return total + (pesoUnitario * quantidade);
    }, 0);
}

function obterEscalaoEnvio(paisEnvio, pesoTotal) {
    const zonaEnvio = obterZonaPortesPorPais(paisEnvio);
    const tabela = TABELA_PORTES_POR_PESO[zonaEnvio] || TABELA_PORTES_POR_PESO.portugal;
    return tabela.find(linha => pesoTotal <= linha.ate) || tabela[tabela.length - 1];
}

function obterOpcoesEnvio(paisEnvio, pesoTotal) {
    if (pesoTotal <= 0) return [];
    return obterEscalaoEnvio(paisEnvio, pesoTotal).opcoes;
}

function obterOpcaoEnvioSelecionada(paisEnvio, pesoTotal, metodoEnvio) {
    const opcoes = obterOpcoesEnvio(paisEnvio, pesoTotal);
    return opcoes.find(opcao => opcao.id === metodoEnvio) || opcoes[0] || { id: '', nome: '', valor: 0 };
}

function valorPortesComIva(valorBase) {
    return Math.round(Number(valorBase || 0) * 100) / 100;
}

function atualizarAvisoEnvio(metodoEnvio) {
    const aviso = document.getElementById('aviso-envio-nao-registado');
    if(!aviso) return;

    const mostrarAviso = metodoEnvio === 'ctt_normal' || metodoEnvio === 'ctt_azul';
    aviso.textContent = mostrarAviso
        ? 'Recomendado o Envio Registado. Não nos responsabilizamos pelo extravio de encomendas.'
        : '';
}

function atualizarOpcoesEnvio() {
    const selectPais = document.getElementById('pais-envio');
    const selectMetodo = document.getElementById('metodo-envio');
    const infoEnvio = document.getElementById('info-envio');
    if(!selectPais || !selectMetodo) return;

    const metodoAnterior = selectMetodo.value;
    const pesoTotal = calcularPesoTotalCarrinho();
    const opcoes = obterOpcoesEnvio(selectPais.value, pesoTotal);
    selectMetodo.replaceChildren();

    if(opcoes.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Adicione produtos para calcular o envio';
        selectMetodo.appendChild(option);
        if(infoEnvio) infoEnvio.textContent = '';
        recalcularTotais();
        return;
    }

    opcoes.forEach(opcao => {
        const option = document.createElement('option');
        option.value = opcao.id;
        option.textContent = opcao.nome + ' - ' + formatarEuro(valorPortesComIva(opcao.valor)) + ' \u20ac';
        selectMetodo.appendChild(option);
    });

    const metodoAindaDisponivel = opcoes.some(opcao => opcao.id === metodoAnterior);
    const metodoRegistado = opcoes.find(opcao => opcao.id === 'ctt_registado');
    selectMetodo.value = metodoAindaDisponivel ? metodoAnterior : (metodoRegistado?.id || opcoes[0].id);
    if(infoEnvio) infoEnvio.textContent = '';
    recalcularTotais();
}

function recalcularTotais(){
    let subtotal = 0;
    carrinho.forEach(item => { subtotal += Number(item.preco || 0) * item.quantidade; });

    const paisEnvio = document.getElementById('pais-envio')?.value || 'portugal';
    const metodoEnvio = document.getElementById('metodo-envio')?.value || '';
    const pesoTotal = calcularPesoTotalCarrinho();
    const opcaoEnvio = obterOpcaoEnvioSelecionada(paisEnvio, pesoTotal, metodoEnvio);
    const portes = valorPortesComIva(opcaoEnvio.valor);
    atualizarAvisoEnvio(opcaoEnvio.id);

    document.getElementById('subtotal').innerText = formatarEuro(subtotal) + ' \u20ac';
    document.getElementById('portes').innerText = formatarEuro(portes) + ' \u20ac';
    document.getElementById('total').innerText = formatarEuro(subtotal + portes) + ' \u20ac';

    return {
        subtotal,
        portes,
        total: subtotal + portes,
        regiao: paisEnvio,
        paisEnvio,
        metodoEnvio: opcaoEnvio.id,
        metodoEnvioNome: opcaoEnvio.nome,
        pesoTotal
    };
}

