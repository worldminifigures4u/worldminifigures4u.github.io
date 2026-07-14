// Calculo de portes e metodos de envio (carregamento tardio).

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
        return 'Este método não inclui rastreamento. Para maior segurança, recomendamos CTT Registado ou InPost Registado.';
    }
    if (metodoEnvioRegistado(metodoId)) {
        return 'Este método inclui rastreamento da encomenda.';
    }
    if (metodoEnvioEmMao(metodoId)) {
        return 'A entrega será combinada após a confirmação da encomenda.';
    }
    return '';
}

function mostrarBadgeRecomendadoEnvio(opcoes) {
    return opcoes.some(opcao => !metodoEnvioRegistado(opcao.id));
}

function obterRotuloOpcaoEnvio(opcao, opcoesVisiveis) {
    const preco = formatarEuro(valorPortesComIva(opcao.valor)) + ' €';
    const recomendado = mostrarBadgeRecomendadoEnvio(opcoesVisiveis) && metodoEnvioRegistado(opcao.id);

    if (opcao.id === 'entrega_tomar') {
        return { nome: 'Entrega em mão em Tomar', preco };
    }
    if (opcao.id === 'ctt_normal') {
        return { nome: 'CTT Normal', preco, subtitulo: 'Sem rastreamento' };
    }
    if (opcao.id === 'ctt_azul') {
        return { nome: 'CTT Azul', preco, subtitulo: 'Sem rastreamento' };
    }
    if (opcao.id === 'ctt_registado') {
        return { nome: 'CTT Registado', preco, badge: recomendado ? 'Recomendado' : '' };
    }
    if (opcao.id === 'inpost_registado') {
        return { nome: 'InPost Registado', preco, badge: recomendado ? 'Recomendado' : '' };
    }
    return { nome: opcao.nome, preco };
}

function criarOpcaoEnvioCheckout(opcao, selecionado, opcoesVisiveis) {
    const rotulo = obterRotuloOpcaoEnvio(opcao, opcoesVisiveis);
    const label = document.createElement('label');
    label.className = 'opcao-envio';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'metodo-envio-radio';
    input.value = opcao.id;
    input.checked = selecionado;

    const conteudo = document.createElement('span');
    conteudo.className = 'opcao-envio-conteudo';

    const principal = document.createElement('span');
    principal.className = 'opcao-envio-principal';

    const nome = document.createElement('span');
    nome.className = 'opcao-envio-nome';
    nome.textContent = rotulo.nome;

    const preco = document.createElement('span');
    preco.className = 'opcao-envio-preco';
    preco.textContent = rotulo.preco;

    principal.append(nome, preco);
    conteudo.appendChild(principal);

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
    if (!selectPais || !containerMetodos || !inputMetodo) return;

    atualizarBandeiraPaisEnvio();

    const metodoAnterior = inputMetodo.value;
    const pesoTotal = calcularPesoTotalCarrinho();
    const subtotal = calcularSubtotalCarrinho();
    const opcoesCompletas = obterOpcoesEnvio(selectPais.value, pesoTotal);
    const opcoes = filtrarOpcoesEnvioCheckout(opcoesCompletas, subtotal);
    containerMetodos.replaceChildren();

    if (opcoes.length === 0) {
        inputMetodo.value = '';
        const vazio = document.createElement('p');
        vazio.className = 'metodos-envio-vazio';
        vazio.textContent = 'Adicione produtos para calcular o envio';
        containerMetodos.appendChild(vazio);
        if (infoEnvio) infoEnvio.textContent = '';
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
        containerMetodos.appendChild(criarOpcaoEnvioCheckout(opcao, opcao.id === metodoSelecionado, opcoes));
    });

    inputMetodo.value = metodoSelecionado;
    if (infoEnvio) infoEnvio.textContent = '';
    atualizarAvisosEnvioCheckout(opcoesCompletas, opcoes, subtotal, metodoSelecionado);
    recalcularTotais();
}

function recalcularTotais() {
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

    document.getElementById('subtotal').innerText = formatarEuro(subtotal) + ' €';
    document.getElementById('portes').innerText = formatarEuro(portes) + ' €';
    document.getElementById('total').innerText = formatarEuro(subtotal + portes) + ' €';

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
