// Codigo de carrinho e portes.
// Separado de app.js para modularizar o site.

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

    if (item) {

        item.quantidade++;

        guardarCarrinho();

        atualizarCarrinho();

    }

}

function diminuirQuantidade(id) {

    const item = carrinho.find(p => p.id === id);

    if (!item) return;

    if (Number(item.quantidade || 1) <= 1) return;

    item.quantidade--;

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
        btnMenos.disabled = Number(item.quantidade || 1) <= 1;
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

function obterOpcaoEnvioSelecionadaCheckout(paisEnvio, pesoTotal, metodoEnvio, subtotal) {
    const opcoes = filtrarOpcoesEnvioCheckout(obterOpcoesEnvio(paisEnvio, pesoTotal), subtotal);
    return opcoes.find(opcao => opcao.id === metodoEnvio)
        || opcoes.find(opcao => opcao.id === 'ctt_registado')
        || opcoes.find(opcao => metodoEnvioRegistado(opcao.id))
        || opcoes[0]
        || { id: '', nome: '', valor: 0 };
}

function valorPortesComIva(valorBase) {
    return Math.round(Number(valorBase || 0) * 100) / 100;
}

function calcularSubtotalCarrinho() {
    return carrinho.reduce((total, item) => total + Number(item.preco || 0) * Number(item.quantidade || 1), 0);
}

function metodoEnvioSemRastreamento(id) {
    return METODOS_ENVIO_SEM_RASTREAMENTO.has(id);
}

function metodoEnvioRegistado(id) {
    return METODOS_ENVIO_REGISTADOS.has(id);
}

function filtrarOpcoesEnvioCheckout(opcoes, subtotal) {
    if (subtotal <= LIMITE_SUBTOTAL_ENVIO_SEM_RASTREAMENTO) return opcoes;
    return opcoes.filter(opcao => !metodoEnvioSemRastreamento(opcao.id));
}

function metodoEnvioEmMao(id) {
    return id === 'entrega_tomar';
}

function obterAvisoMetodoEnvioSelecionado(metodoId) {
    if (metodoEnvioSemRastreamento(metodoId)) {
        return 'Este m\u00e9todo n\u00e3o inclui rastreamento. Para maior seguran\u00e7a, recomendamos CTT Registado ou InPost Registado.';
    }

    if (metodoEnvioRegistado(metodoId)) {
        return 'Este m\u00e9todo inclui rastreamento da encomenda.';
    }

    if (metodoEnvioEmMao(metodoId)) {
        return 'A entrega ser\u00e1 combinada ap\u00f3s a confirma\u00e7\u00e3o da encomenda.';
    }

    return '';
}

function obterRotuloOpcaoEnvio(opcao) {
    const preco = formatarEuro(valorPortesComIva(opcao.valor)) + ' \u20ac';

    if (opcao.id === 'entrega_tomar') {
        return {
            titulo: `Entrega em m\u00e3o em Tomar \u2014 ${preco}`
        };
    }

    if (opcao.id === 'ctt_normal') {
        return {
            titulo: `CTT Normal \u2014 ${preco}`,
            subtitulo: 'Sem rastreamento'
        };
    }

    if (opcao.id === 'ctt_azul') {
        return {
            titulo: `CTT Azul \u2014 ${preco}`,
            subtitulo: 'Sem rastreamento'
        };
    }

    if (opcao.id === 'ctt_registado') {
        return {
            titulo: `CTT Registado \u2014 ${preco}`,
            badge: 'Recomendado'
        };
    }

    if (opcao.id === 'inpost_registado') {
        return {
            titulo: `InPost Registado \u2014 ${preco}`,
            badge: 'Recomendado'
        };
    }

    return {
        titulo: `${opcao.nome} \u2014 ${preco}`
    };
}

function criarOpcaoEnvioCheckout(opcao, selecionado) {
    const rotulo = obterRotuloOpcaoEnvio(opcao);
    const label = document.createElement('label');
    label.className = 'opcao-envio';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'metodo-envio-radio';
    input.value = opcao.id;
    input.checked = selecionado;

    const conteudo = document.createElement('span');
    conteudo.className = 'opcao-envio-conteudo';

    const titulo = document.createElement('span');
    titulo.className = 'opcao-envio-titulo';
    titulo.textContent = rotulo.titulo;
    conteudo.appendChild(titulo);

    if (rotulo.subtitulo) {
        const subtitulo = document.createElement('span');
        subtitulo.className = 'opcao-envio-subtitulo';
        subtitulo.textContent = rotulo.subtitulo;
        conteudo.appendChild(subtitulo);
    }

    if (rotulo.badge) {
        const badge = document.createElement('span');
        badge.className = 'opcao-envio-badge';
        badge.textContent = rotulo.badge;
        conteudo.appendChild(badge);
    }

    label.append(input, conteudo);
    return label;
}

function atualizarAvisosEnvioCheckout(opcoesCompletas, opcoesVisiveis, subtotal, metodoSelecionado = '') {
    const avisoMetodo = document.getElementById('aviso-recomendacao-registado');
    const limite = document.getElementById('aviso-limite-sem-rastreamento');
    const avisoAntigo = document.getElementById('aviso-envio-nao-registado');

    const bloqueadoPorValor = subtotal > LIMITE_SUBTOTAL_ENVIO_SEM_RASTREAMENTO
        && opcoesCompletas.some(opcao => metodoEnvioSemRastreamento(opcao.id));
    const textoAviso = obterAvisoMetodoEnvioSelecionado(metodoSelecionado);

    if (avisoMetodo) {
        avisoMetodo.textContent = textoAviso;
        avisoMetodo.hidden = !textoAviso;
    }

    if (limite) {
        limite.hidden = !bloqueadoPorValor;
    }

    if (avisoAntigo) {
        avisoAntigo.hidden = true;
        avisoAntigo.textContent = '';
    }
}

const CODIGO_BANDEIRA_POR_PAIS_ENVIO = {
    portugal: 'pt',
    espanha: 'es',
    alemanha: 'de',
    austria: 'at',
    belgica: 'be',
    bulgaria: 'bg',
    chequia: 'cz',
    chipre: 'cy',
    croacia: 'hr',
    dinamarca: 'dk',
    eslovaquia: 'sk',
    eslovenia: 'si',
    estonia: 'ee',
    finlandia: 'fi',
    franca: 'fr',
    grecia: 'gr',
    hungria: 'hu',
    irlanda: 'ie',
    italia: 'it',
    letonia: 'lv',
    lituania: 'lt',
    luxemburgo: 'lu',
    malta: 'mt',
    paises_baixos: 'nl',
    polonia: 'pl',
    romenia: 'ro',
    suecia: 'se'
};

function atualizarBandeiraPaisEnvio() {
    const selectPais = document.getElementById('pais-envio');
    const bandeira = document.getElementById('pais-envio-bandeira');
    if (!selectPais || !bandeira) return;

    const codigo = CODIGO_BANDEIRA_POR_PAIS_ENVIO[selectPais.value] || 'pt';
    bandeira.src = `https://flagcdn.com/w40/${codigo}.png`;
}
function atualizarOpcoesEnvio() {
    const selectPais = document.getElementById('pais-envio');
    const containerMetodos = document.getElementById('metodos-envio');
    const inputMetodo = document.getElementById('metodo-envio');
    const infoEnvio = document.getElementById('info-envio');
    if(!selectPais || !containerMetodos || !inputMetodo) return;
    atualizarBandeiraPaisEnvio();

    const metodoAnterior = inputMetodo.value;
    const pesoTotal = calcularPesoTotalCarrinho();
    const subtotal = calcularSubtotalCarrinho();
    const opcoesCompletas = obterOpcoesEnvio(selectPais.value, pesoTotal);
    const opcoes = filtrarOpcoesEnvioCheckout(opcoesCompletas, subtotal);
    containerMetodos.replaceChildren();

    if(opcoes.length === 0) {
        inputMetodo.value = '';
        const vazio = document.createElement('p');
        vazio.className = 'metodos-envio-vazio';
        vazio.textContent = 'Adicione produtos para calcular o envio';
        containerMetodos.appendChild(vazio);
        if(infoEnvio) infoEnvio.textContent = '';
        atualizarAvisosEnvioCheckout(opcoesCompletas, opcoes, subtotal, '');
        recalcularTotais();
        return;
    }

    const metodoAindaDisponivel = opcoes.some(opcao => opcao.id === metodoAnterior);
    const metodoRegistado = opcoes.find(opcao => opcao.id === 'ctt_registado')
        || opcoes.find(opcao => metodoEnvioRegistado(opcao.id));
    const metodoSelecionado = metodoAindaDisponivel
        ? metodoAnterior
        : (metodoRegistado?.id || opcoes[0].id);

    opcoes.forEach(opcao => {
        containerMetodos.appendChild(criarOpcaoEnvioCheckout(opcao, opcao.id === metodoSelecionado));
    });

    inputMetodo.value = metodoSelecionado;
    if(infoEnvio) infoEnvio.textContent = '';
    atualizarAvisosEnvioCheckout(opcoesCompletas, opcoes, subtotal, metodoSelecionado);
    recalcularTotais();
}

function recalcularTotais(){
    let subtotal = 0;
    carrinho.forEach(item => { subtotal += Number(item.preco || 0) * item.quantidade; });

    const paisEnvio = document.getElementById('pais-envio')?.value || 'portugal';
    const metodoEnvio = document.getElementById('metodo-envio')?.value || '';
    const pesoTotal = calcularPesoTotalCarrinho();
    const opcaoEnvio = obterOpcaoEnvioSelecionadaCheckout(paisEnvio, pesoTotal, metodoEnvio, subtotal);
    const inputMetodo = document.getElementById('metodo-envio');
    if (inputMetodo && inputMetodo.value !== opcaoEnvio.id) {
        inputMetodo.value = opcaoEnvio.id;
        document.querySelectorAll('input[name="metodo-envio-radio"]').forEach(radio => {
            radio.checked = radio.value === opcaoEnvio.id;
        });
    }
    const portes = valorPortesComIva(opcaoEnvio.valor);
    const opcoesCompletas = obterOpcoesEnvio(paisEnvio, pesoTotal);
    const opcoesVisiveis = filtrarOpcoesEnvioCheckout(opcoesCompletas, subtotal);
    atualizarAvisosEnvioCheckout(opcoesCompletas, opcoesVisiveis, subtotal, opcaoEnvio.id);

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
