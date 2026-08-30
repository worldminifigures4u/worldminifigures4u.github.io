let gestaoClient = null;
let gestaoBanners = [];
let gestaoProdutosImportacao = [];
let gestaoImportacaoProdutosCarregados = false;
let gestaoImportacaoScriptPromessa = null;

const GESTAO_COR_BRANCO = '#ffffff';
const GESTAO_COR_AMARELO_LOGO = '#ffc107';

function definirStatusGestao(mensagem) {
    const status = document.getElementById('gestao-status');
    if (status) status.textContent = mensagem || '';
}

function selecionarSeccaoGestao(seccao, atualizarHash = true) {
    const seccaoNormalizada = ['portes', 'importar', 'exportar'].includes(seccao) ? seccao : 'banners';
    document.querySelectorAll('[data-gestao-seccao]').forEach((botao) => {
        const ativo = botao.dataset.gestaoSeccao === seccaoNormalizada;
        botao.classList.toggle('ativa', ativo);
        botao.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
    document.querySelectorAll('[data-gestao-painel]').forEach((painel) => {
        const ativo = painel.dataset.gestaoPainel === seccaoNormalizada;
        painel.hidden = !ativo;
        painel.classList.toggle('ativa', ativo);
    });
    if (atualizarHash) {
        const hash = seccaoNormalizada === 'portes'
            ? '#portes-de-envio'
            : (seccaoNormalizada === 'importar' ? '#importar' : (seccaoNormalizada === 'exportar' ? '#exportar' : '#banners'));
        history.replaceState(null, '', hash);
    }
    if (seccaoNormalizada === 'importar') {
        prepararImportacaoGestao(false).catch(console.error);
    }
}

function iniciarMenuSeccoesGestao() {
    document.querySelectorAll('[data-gestao-seccao]').forEach((botao) => {
        botao.addEventListener('click', () => selecionarSeccaoGestao(botao.dataset.gestaoSeccao));
    });
    const hash = String(window.location.hash || '').toLowerCase();
    selecionarSeccaoGestao(hash.includes('portes') ? 'portes' : (hash.includes('export') ? 'exportar' : (hash.includes('import') ? 'importar' : 'banners')), false);
}

function definirEstadoProdutosImportacaoGestao() {
    window.dbClient = gestaoClient;
    window.todosOsProdutos = gestaoProdutosImportacao;
}

async function carregarProdutosPorRpcGestao(nomeRpc) {
    const produtos = [];
    let inicio = 0;
    const tamanhoPagina = 500;
    while (true) {
        const resposta = await gestaoClient.rpc(nomeRpc, { p_limite: tamanhoPagina, p_offset: inicio });
        if (resposta.error) throw resposta.error;
        const pagina = Array.isArray(resposta.data) ? resposta.data : [];
        produtos.push(...pagina);
        if (pagina.length < tamanhoPagina) break;
        inicio += tamanhoPagina;
    }
    return produtos;
}

function normalizarProdutoImportacaoGestao(produto) {
    const stock = Number(produto?.stock);
    return {
        ...produto,
        stock: Number.isFinite(stock) ? Math.floor(stock) : 0
    };
}

async function carregarProdutosImportacaoGestao(forcar = false) {
    if (gestaoImportacaoProdutosCarregados && !forcar) {
        definirEstadoProdutosImportacaoGestao();
        return gestaoProdutosImportacao;
    }

    let produtos;
    try {
        produtos = await carregarProdutosPorRpcGestao('listar_produtos_mapas_admin');
    } catch (erroMapas) {
        console.warn('Não foi possível carregar produtos pela listagem de Mapas. A usar fallback antigo.', erroMapas);
        produtos = await carregarProdutosPorRpcGestao('listar_produtos_admin');
    }

    gestaoProdutosImportacao = produtos.map(normalizarProdutoImportacaoGestao);
    gestaoImportacaoProdutosCarregados = true;
    definirEstadoProdutosImportacaoGestao();
    return gestaoProdutosImportacao;
}

window.carregarProdutosAdminDaNuvem = async function carregarProdutosAdminDaNuvemGestao() {
    await carregarProdutosImportacaoGestao(true);
};

function garantirScriptImportacaoGestao() {
    if (typeof analisarFicheiroCatalogoAdmin === 'function') return Promise.resolve();
    if (gestaoImportacaoScriptPromessa) return gestaoImportacaoScriptPromessa;

    gestaoImportacaoScriptPromessa = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'gestao-importacao.js?v=20260830-fornecedores-sem-numeros';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Falha ao carregar importação administrativa.'));
        document.body.appendChild(script);
    });
    return gestaoImportacaoScriptPromessa;
}

function prefetchBibliotecaSheetJsGestao() {
    const url = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'script';
    document.head.appendChild(link);
}

async function prepararImportacaoGestao(comScript = true) {
    definirEstadoProdutosImportacaoGestao();
    if (!gestaoImportacaoProdutosCarregados) {
        const status = document.getElementById('status-importacao-stock')
            || document.getElementById('status-importacao-catalogo-sem-stock')
            || document.getElementById('status-importacao-catalogo');
        if (status && !status.textContent) status.textContent = 'A preparar importação...';
        await carregarProdutosImportacaoGestao();
        if (status && status.textContent === 'A preparar importação...') status.textContent = '';
    }
    if (comScript) await garantirScriptImportacaoGestao();
}

function ligarElementoImportacaoGestao(id, evento, handler) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.addEventListener(evento, handler);
}

function escaparCsvGestao(valor) {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return '"' + texto.replace(/"/g, '""') + '"';
}

function numeroCsvGestao(valor, casas = 2) {
    const numero = Number(valor || 0);
    return Number.isFinite(numero) ? numero.toFixed(casas) : (0).toFixed(casas);
}

function inteiroCsvGestao(valor) {
    const numero = Number(valor || 0);
    return Number.isFinite(numero) ? String(Math.max(0, Math.round(numero))) : '0';
}

function stockCsvGestao(valor) {
    const numero = Number(valor || 0);
    return Number.isFinite(numero) ? String(Math.floor(numero)) : '0';
}

function booleanoCsvGestao(valor) {
    return valor ? 'sim' : '';
}

function obterMarcacaoFornecedorCsvGestao(fornecedores, chave, nome) {
    const dados = fornecedores && typeof fornecedores === 'object' ? fornecedores : {};
    const valor = dados[chave] ?? dados[nome] ?? dados[String(nome || '').toLowerCase()];
    if (!valor) return '';
    if (typeof valor === 'string') return /^-?\d+(?:[,.]\d+)?$/.test(valor.trim()) ? '' : valor;
    if (typeof valor === 'object') {
        const estado = String(valor.estado || valor.texto || valor.marcacao || '').trim();
        return /^-?\d+(?:[,.]\d+)?$/.test(estado) ? '' : estado;
    }
    return '';
}

function obterObjetoFornecedoresGestao(produto) {
    const valor = produto?.fornecedores;
    if (!valor) return {};
    if (typeof valor === 'string') {
        try {
            const convertido = JSON.parse(valor);
            return convertido && typeof convertido === 'object' && !Array.isArray(convertido) ? convertido : {};
        } catch (_) {
            return {};
        }
    }
    return typeof valor === 'object' && !Array.isArray(valor) ? { ...valor } : {};
}

function limparFornecedoresNumericosProdutoGestao(produto) {
    const fornecedores = obterObjetoFornecedoresGestao(produto);
    let alterou = false;
    Object.keys(fornecedores).forEach((chave) => {
        const valor = fornecedores[chave];
        if (typeof valor === 'number' || (typeof valor === 'string' && /^-?\d+(?:[,.]\d+)?$/.test(valor.trim()))) {
            delete fornecedores[chave];
            alterou = true;
            return;
        }
        if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
            const estado = String(valor.estado || '').trim();
            if (/^-?\d+(?:[,.]\d+)?$/.test(estado)) {
                const proximo = { ...valor, estado: '' };
                const temHistorico = Array.isArray(proximo.historico) && proximo.historico.length > 0;
                if (temHistorico) {
                    fornecedores[chave] = proximo;
                } else {
                    delete fornecedores[chave];
                }
                alterou = true;
            }
        }
    });
    return alterou ? fornecedores : null;
}

function criarCsvMapasGestao(produtos) {
    const fornecedores = [
        ['Lote 50', 'lote50'],
        ['Ruishengtu', 'ruishengtu'],
        ['Leguoguo', 'leguoguo'],
        ['Chuangyaoke', 'chuangyaoke'],
        ['Kopf', 'kopf'],
        ['Brixtoy', 'brixtoy']
    ];
    const colunas = [
        'lego',
        'nome',
        'preco',
        'preco_compra',
        'sku',
        'top',
        'arquivado',
        'descontinuado',
        'novidade',
        'referencia',
        'stock',
        'tema',
        'subtema',
        'peso',
        ...fornecedores.map(([nome]) => nome)
    ];

    const linhas = [colunas.map(escaparCsvGestao).join(',')];
    produtos.forEach((produto) => {
        const linha = [
            produto.lego || '',
            produto.nome || '',
            numeroCsvGestao(produto.preco),
            numeroCsvGestao(produto.preco_compra),
            produto.sku || '',
            produto.top || '',
            booleanoCsvGestao(produto.arquivado),
            booleanoCsvGestao(produto.descontinuado),
            booleanoCsvGestao(produto.novidade),
            produto.referencia || '',
            stockCsvGestao(produto.stock),
            produto.tema || '',
            produto.subtema || '',
            inteiroCsvGestao(produto.peso || 10),
            ...fornecedores.map(([nome, chave]) => obterMarcacaoFornecedorCsvGestao(produto.fornecedores, chave, nome))
        ];
        linhas.push(linha.map(escaparCsvGestao).join(','));
    });

    return '\uFEFF' + linhas.join('\r\n') + '\r\n';
}

function descarregarCsvMapasGestao(csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const data = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `mapas-catalogo-${data}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function exportarMapasCsvGestao() {
    const status = document.getElementById('status-exportar-mapas');
    const botao = document.getElementById('btn-exportar-mapas-csv');
    try {
        const { data: { user }, error } = await gestaoClient.auth.getUser();
        if (error || !user || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode exportar os mapas.');
        }

        if (botao) botao.disabled = true;
        mostrarMensagem(status, 'A preparar CSV...');
        const produtos = await carregarProdutosImportacaoGestao(true);
        const csv = criarCsvMapasGestao(produtos);
        descarregarCsvMapasGestao(csv);
        const stockTotal = produtos.reduce((total, produto) => total + Number(produto.stock || 0), 0);
        const produtosComStockNegativo = produtos.filter((produto) => Number(produto.stock || 0) < 0);
        const stockNegativoTotal = produtosComStockNegativo.reduce((total, produto) => total + Number(produto.stock || 0), 0);
        const avisoStockNegativo = produtosComStockNegativo.length
            ? ` Inclui ${produtosComStockNegativo.length} produto(s) com stock negativo (${stockNegativoTotal}).`
            : '';
        mostrarMensagem(status, `${produtos.length} produto(s) exportado(s) em CSV. Stock total: ${stockTotal}.${avisoStockNegativo}`, 'msg-sucesso');
    } catch (erro) {
        console.error('Erro ao exportar mapas:', erro);
        mostrarMensagem(status, erro.message || 'Não foi possível exportar os mapas.', 'msg-erro');
    } finally {
        if (botao) botao.disabled = false;
    }
}

async function limparFornecedoresNumericosGestao() {
    const status = document.getElementById('status-exportar-mapas');
    const botao = document.getElementById('btn-limpar-fornecedores-numericos');
    try {
        const { data: { user }, error } = await gestaoClient.auth.getUser();
        if (error || !user || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode limpar estas marcações.');
        }

        if (botao) botao.disabled = true;
        mostrarMensagem(status, 'A procurar marcações numéricas...');
        const produtos = await carregarProdutosImportacaoGestao(true);
        const alteracoes = produtos
            .map((produto) => ({ produto, fornecedores: limparFornecedoresNumericosProdutoGestao(produto) }))
            .filter((item) => item.fornecedores);

        if (!alteracoes.length) {
            mostrarMensagem(status, 'Não foram encontradas marcações numéricas nos fornecedores.', 'msg-sucesso');
            return;
        }

        let atualizados = 0;
        for (const item of alteracoes) {
            const { error: erroAtualizar } = await gestaoClient.rpc('atualizar_fornecedores_produto_admin', {
                p_id: String(item.produto.id),
                p_fornecedores: item.fornecedores
            });
            if (erroAtualizar) throw erroAtualizar;
            atualizados += 1;
            mostrarMensagem(status, `A limpar marcações: ${atualizados}/${alteracoes.length}`);
        }

        await carregarProdutosImportacaoGestao(true);
        mostrarMensagem(status, `${atualizados} produto(s) corrigido(s). Stock e encomendas não foram alterados.`, 'msg-sucesso');
    } catch (erro) {
        console.error('Erro ao limpar marcações numéricas:', erro);
        mostrarMensagem(status, erro.message || 'Não foi possível limpar as marcações numéricas.', 'msg-erro');
    } finally {
        if (botao) botao.disabled = false;
    }
}

function ligarImportacaoGestao() {
    ligarElementoImportacaoGestao('btn-exportar-mapas-csv', 'click', () => {
        exportarMapasCsvGestao().catch(console.error);
    });
    ligarElementoImportacaoGestao('btn-limpar-fornecedores-numericos', 'click', () => {
        limparFornecedoresNumericosGestao().catch(console.error);
    });
    ligarElementoImportacaoGestao('admin-ficheiro-stock', 'change', function () {
        prepararImportacaoGestao().then(() => {
            if (typeof analisarFicheiroStockAdmin === 'function') analisarFicheiroStockAdmin(this);
        }).catch(console.error);
    });
    ligarElementoImportacaoGestao('btn-confirmar-importacao-stock', 'click', () => {
        prepararImportacaoGestao().then(() => {
            if (typeof confirmarImportacaoStockAdmin === 'function') confirmarImportacaoStockAdmin();
        }).catch(console.error);
    });
    ligarElementoImportacaoGestao('admin-ficheiro-catalogo-sem-stock', 'change', function () {
        prepararImportacaoGestao().then(() => {
            if (typeof analisarFicheiroCatalogoSemStockAdmin === 'function') analisarFicheiroCatalogoSemStockAdmin(this);
        }).catch(console.error);
    });
    ligarElementoImportacaoGestao('btn-confirmar-importacao-catalogo-sem-stock', 'click', () => {
        prepararImportacaoGestao().then(() => {
            if (typeof confirmarImportacaoCatalogoSemStockAdmin === 'function') confirmarImportacaoCatalogoSemStockAdmin();
        }).catch(console.error);
    });
    ligarElementoImportacaoGestao('admin-ficheiro-catalogo', 'change', function () {
        prepararImportacaoGestao().then(() => {
            if (typeof analisarFicheiroCatalogoAdmin === 'function') analisarFicheiroCatalogoAdmin(this);
        }).catch(console.error);
    });
    ligarElementoImportacaoGestao('confirmacao-substituir-catalogo', 'input', () => {
        garantirScriptImportacaoGestao().then(() => {
            if (typeof atualizarConfirmacaoCatalogoAdmin === 'function') atualizarConfirmacaoCatalogoAdmin();
        }).catch(console.error);
    });
    ligarElementoImportacaoGestao('btn-confirmar-importacao-catalogo', 'click', () => {
        prepararImportacaoGestao().then(() => {
            if (typeof confirmarImportacaoCatalogoAdmin === 'function') confirmarImportacaoCatalogoAdmin();
        }).catch(console.error);
    });

    document.querySelector('[data-gestao-seccao="importar"]')?.addEventListener('mouseenter', prefetchBibliotecaSheetJsGestao, { once: true });
    document.querySelector('[data-gestao-seccao="importar"]')?.addEventListener('focus', prefetchBibliotecaSheetJsGestao, { once: true });
}

function normalizarCorHexGestao(valor, fallback = GESTAO_COR_BRANCO) {
    const bruto = String(valor || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(bruto)) return bruto.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(bruto)) {
        return ('#' + bruto[1] + bruto[1] + bruto[2] + bruto[2] + bruto[3] + bruto[3]).toLowerCase();
    }
    return fallback;
}

function textoPlanoGestao(valor) {
    return String(valor || '').replace(/\*\*/g, '').trim();
}

function limitarPercentagem(valor, minimo = 0, maximo = 100) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return minimo;
    return Math.min(maximo, Math.max(minimo, Math.round(n * 10) / 10));
}

function novoIdTextoGestao() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'txt-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function alinharHTextoBanner(valor) {
    return ['left', 'center', 'right'].includes(valor) ? valor : 'center';
}

function alinharVTextoBanner(valor) {
    return ['top', 'middle', 'bottom'].includes(valor) ? valor : 'middle';
}

/** Margem mínima (%) para o texto não colar no corte da imagem. */
const BANNER_TEXTO_INSET = 1.5;

function coordenadasPorAlinhamento(align, alignV) {
    const h = alinharHTextoBanner(align);
    const v = alinharVTextoBanner(alignV);
    return {
        x: h === 'left' ? BANNER_TEXTO_INSET : h === 'right' ? 100 - BANNER_TEXTO_INSET : 50,
        y: v === 'top' ? BANNER_TEXTO_INSET : v === 'bottom' ? 100 - BANNER_TEXTO_INSET : 50
    };
}

function transformTextoBanner(align, alignV) {
    const tx = align === 'left' ? '0' : align === 'right' ? '-100%' : '-50%';
    const ty = alignV === 'top' ? '0' : alignV === 'bottom' ? '-100%' : '-50%';
    return `translate(${tx}, ${ty})`;
}

function limitarTamanhoFonteBanner(valor) {
    return limitarPercentagem(valor ?? 100, 50, 200);
}

/** Escala 100 = tamanho actual da loja (clamp responsivo). */
function cssFonteTextoBanner(escala) {
    const s = limitarTamanhoFonteBanner(escala) / 100;
    return `clamp(${(0.85 * s).toFixed(3)}rem, ${(1.7 * s).toFixed(3)}vw, ${(1.35 * s).toFixed(3)}rem)`;
}

function criarTextoBannerPadrao(parcial = {}) {
    const align = alinharHTextoBanner(parcial.align);
    const alignV = alinharVTextoBanner(parcial.alignV);
    const coords = coordenadasPorAlinhamento(align, alignV);
    const posicaoLivre = Boolean(parcial.posicaoLivre);
    return {
        id: parcial.id || novoIdTextoGestao(),
        texto: String(parcial.texto || ''),
        cor: normalizarCorHexGestao(parcial.cor, GESTAO_COR_BRANCO),
        cor_destaque: normalizarCorHexGestao(parcial.cor_destaque, GESTAO_COR_AMARELO_LOGO),
        x: posicaoLivre ? limitarPercentagem(parcial.x ?? coords.x, 0, 100) : coords.x,
        y: posicaoLivre ? limitarPercentagem(parcial.y ?? coords.y, 0, 100) : coords.y,
        maxWidth: limitarPercentagem(parcial.maxWidth ?? 28, 10, 80),
        fontSize: limitarTamanhoFonteBanner(parcial.fontSize),
        align,
        alignV,
        posicaoLivre
    };
}

function normalizarListaTextosBanner(banner) {
    if (Array.isArray(banner?.textos) && banner.textos.length) {
        return banner.textos.map((item) => criarTextoBannerPadrao(item));
    }
    const lista = [];
    const esq = String(banner?.texto_esquerda || banner?.alt || '').trim();
    const dir = String(banner?.texto_direita || '').trim();
    if (esq) {
        lista.push(criarTextoBannerPadrao({
            id: 'legado-esq',
            texto: esq,
            cor: banner?.cor_esquerda,
            cor_destaque: banner?.cor_destaque,
            x: undefined,
            y: undefined,
            align: 'left',
            alignV: 'middle'
        }));
    }
    if (dir) {
        lista.push(criarTextoBannerPadrao({
            id: 'legado-dir',
            texto: dir,
            cor: banner?.cor_direita,
            cor_destaque: banner?.cor_destaque,
            x: undefined,
            y: undefined,
            align: 'right',
            alignV: 'middle'
        }));
    }
    return lista;
}

function preencherTextoBannerGestao(el, valor, corBase, corDestaque) {
    el.replaceChildren();
    el.style.color = corBase;
    const bruto = String(valor || '');
    const partes = bruto.split(/(\*\*[^*]+\*\*)/g);
    partes.forEach((parte) => {
        if (/^\*\*[^*]+\*\*$/.test(parte)) {
            const destaque = document.createElement('span');
            destaque.className = 'gestao-banner-preview-destaque';
            destaque.style.color = corDestaque;
            destaque.textContent = parte.slice(2, -2);
            el.appendChild(destaque);
            return;
        }
        if (parte) el.appendChild(document.createTextNode(parte));
    });
}

function aplicarEstiloTextoLivre(el, item) {
    const align = alinharHTextoBanner(item.align);
    const alignV = alinharVTextoBanner(item.alignV);
    item.align = align;
    item.alignV = alignV;
    const coords = item.posicaoLivre
        ? { x: limitarPercentagem(item.x, 0, 100), y: limitarPercentagem(item.y, 0, 100) }
        : coordenadasPorAlinhamento(align, alignV);
    item.x = coords.x;
    item.y = coords.y;
    const largura = limitarPercentagem(item.maxWidth, 10, 80) + '%';
    el.style.left = coords.x + '%';
    el.style.top = coords.y + '%';
    el.style.width = largura;
    el.style.maxWidth = largura;
    el.style.fontSize = cssFonteTextoBanner(item.fontSize);
    el.style.textAlign = align;
    el.style.transform = transformTextoBanner(align, alignV);
}

function aplicarAlinhamentoAutomatico(item) {
    item.posicaoLivre = false;
    Object.assign(item, coordenadasPorAlinhamento(item.align, item.alignV));
}

async function obterAssinaturaCloudinaryGestao() {
    const { data: { session }, error: sessionError } = await gestaoClient.auth.getSession();
    if (sessionError || !session?.access_token) {
        throw new Error('Sessão de administrador obrigatória para enviar imagens.');
    }
    const resposta = await fetch(`${SUPABASE_URL}/functions/v1/cloudinary-sign-upload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_KEY
        },
        body: JSON.stringify({ origem: 'gestao-banners' })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados?.error || 'Não foi possível obter assinatura do Cloudinary.');
    if (!dados?.cloudName || !dados?.apiKey || !dados?.timestamp || !dados?.signature) {
        throw new Error('Assinatura Cloudinary incompleta.');
    }
    return dados;
}

async function enviarFicheiroCloudinaryGestao(ficheiro) {
    const assinatura = await obterAssinaturaCloudinaryGestao();
    const formData = new FormData();
    formData.append('file', ficheiro);
    formData.append('api_key', assinatura.apiKey);
    formData.append('timestamp', String(assinatura.timestamp));
    formData.append('signature', assinatura.signature);
    if (assinatura.folder) formData.append('folder', assinatura.folder);
    if (assinatura.eager) formData.append('eager', assinatura.eager);

    const resposta = await fetch(`https://api.cloudinary.com/v1_1/${assinatura.cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    });
    const resultado = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(resultado?.error?.message || 'Falha no upload para o Cloudinary.');
    if (!resultado?.secure_url) throw new Error('O Cloudinary não devolveu URL da imagem.');
    return resultado.eager?.[0]?.secure_url || resultado.secure_url;
}

function ligarArrastoTextoGestao(el, item, previewWrap, onSelecionar, onArrastou) {
    let aArrastar = false;
    let pointerIdAtivo = null;

    const atualizarPosicao = (evento) => {
        const rect = previewWrap.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        item.posicaoLivre = true;
        item.x = limitarPercentagem(((evento.clientX - rect.left) / rect.width) * 100);
        item.y = limitarPercentagem(((evento.clientY - rect.top) / rect.height) * 100);
        aplicarEstiloTextoLivre(el, item);
    };

    const emMovimento = (evento) => {
        if (!aArrastar || evento.pointerId !== pointerIdAtivo) return;
        evento.preventDefault();
        atualizarPosicao(evento);
    };

    const terminar = (evento) => {
        if (!aArrastar || (pointerIdAtivo != null && evento.pointerId !== pointerIdAtivo)) return;
        aArrastar = false;
        pointerIdAtivo = null;
        el.classList.remove('is-a-arrastar');
        document.removeEventListener('pointermove', emMovimento);
        document.removeEventListener('pointerup', terminar);
        document.removeEventListener('pointercancel', terminar);
        try { el.releasePointerCapture?.(evento.pointerId); } catch (_) { /* ignore */ }
        if (typeof onArrastou === 'function') onArrastou();
    };

    el.addEventListener('pointerdown', (evento) => {
        if (evento.button != null && evento.button !== 0) return;
        evento.preventDefault();
        evento.stopPropagation();
        if (typeof onSelecionar === 'function') onSelecionar();
        aArrastar = true;
        pointerIdAtivo = evento.pointerId;
        el.classList.add('is-a-arrastar');
        try { el.setPointerCapture(evento.pointerId); } catch (_) { /* ignore */ }
        document.addEventListener('pointermove', emMovimento);
        document.addEventListener('pointerup', terminar);
        document.addEventListener('pointercancel', terminar);
        atualizarPosicao(evento);
    });
}

function renderizarListaBannersGestao() {
    const lista = document.getElementById('gestao-lista-banners');
    if (!lista) return;
    lista.replaceChildren();

    if (!gestaoBanners.length) {
        const vazio = document.createElement('p');
        vazio.className = 'gestao-vazio';
        vazio.textContent = 'Ainda não há banners. Adiciona o primeiro acima (ou corre o SQL supabase-banners-loja-textos-livres.sql).';
        lista.appendChild(vazio);
        return;
    }

    gestaoBanners.forEach((banner) => {
        const card = document.createElement('article');
        card.className = 'gestao-banner-card';
        card.dataset.id = banner.id;

        const textosEstado = normalizarListaTextosBanner(banner);
        let textoAtivoId = textosEstado[0]?.id || null;

        const previewWrap = document.createElement('div');
        previewWrap.className = 'gestao-banner-preview-wrap';
        const preview = document.createElement('img');
        preview.className = 'gestao-banner-preview';
        preview.src = banner.url;
        preview.alt = textosEstado.map((t) => textoPlanoGestao(t.texto)).filter(Boolean).join(' · ') || 'Banner';
        preview.loading = 'lazy';
        preview.decoding = 'async';
        preview.draggable = false;
        previewWrap.appendChild(preview);

        const camadaTextos = document.createElement('div');
        camadaTextos.className = 'gestao-banner-preview-textos';
        previewWrap.appendChild(camadaTextos);

        const ajudaPreview = document.createElement('p');
        ajudaPreview.className = 'gestao-banner-preview-ajuda';
        ajudaPreview.textContent = 'Horizontal + Vertical = cantos/margens. Ou arrasta o texto para posição livre. O mesmo alinhamento (ou as mesmas coords livres) em todos os banners evita saltos ao alternar.';
        previewWrap.appendChild(ajudaPreview);

        card.appendChild(previewWrap);

        const campos = document.createElement('div');
        campos.className = 'gestao-banner-campos gestao-banner-campos-livres';

        const topoTextos = document.createElement('div');
        topoTextos.className = 'gestao-textos-topo';
        const tituloTextos = document.createElement('h3');
        tituloTextos.textContent = 'Textos do banner';
        const btnAddTexto = document.createElement('button');
        btnAddTexto.type = 'button';
        btnAddTexto.className = 'wallapop-botao';
        btnAddTexto.textContent = 'Adicionar texto';
        topoTextos.appendChild(tituloTextos);
        topoTextos.appendChild(btnAddTexto);

        const listaTextos = document.createElement('div');
        listaTextos.className = 'gestao-textos-lista';

        const labelOrdem = document.createElement('label');
        labelOrdem.className = 'gestao-campo gestao-campo-ordem';
        labelOrdem.innerHTML = '<span>Ordem</span>';
        const inputOrdem = document.createElement('input');
        inputOrdem.type = 'number';
        inputOrdem.value = String(banner.ordem ?? 0);
        inputOrdem.step = '1';
        inputOrdem.dataset.semLimparCampo = '1';
        labelOrdem.appendChild(inputOrdem);

        const acoes = document.createElement('div');
        acoes.className = 'gestao-banner-acoes';
        const labelAtivo = document.createElement('label');
        labelAtivo.className = 'gestao-check';
        const inputAtivo = document.createElement('input');
        inputAtivo.type = 'checkbox';
        inputAtivo.checked = banner.ativo !== false;
        labelAtivo.appendChild(inputAtivo);
        const textoAtivo = document.createElement('span');
        textoAtivo.textContent = 'Ativo na loja';
        labelAtivo.appendChild(textoAtivo);

        const mapaPreview = new Map();

        const marcarSelecaoVisual = () => {
            camadaTextos.querySelectorAll('.gestao-banner-preview-texto-livre').forEach((el) => {
                el.classList.toggle('is-selecionado', el.dataset.textoId === textoAtivoId);
            });
            listaTextos.querySelectorAll('.gestao-texto-item').forEach((bloco, indice) => {
                const item = textosEstado[indice];
                bloco.classList.toggle('is-ativo', Boolean(item && item.id === textoAtivoId));
            });
        };

        const sincronizarPreview = () => {
            camadaTextos.replaceChildren();
            mapaPreview.clear();
            textosEstado.forEach((item) => {
                if (!textoPlanoGestao(item.texto)) return;
                const el = document.createElement('span');
                el.className = 'gestao-banner-preview-texto gestao-banner-preview-texto-livre';
                if (item.id === textoAtivoId) el.classList.add('is-selecionado');
                el.dataset.textoId = item.id;
                aplicarEstiloTextoLivre(el, item);
                preencherTextoBannerGestao(el, item.texto, item.cor, item.cor_destaque);
                el.title = item.posicaoLivre
                    ? 'Posição livre — arrasta para mover; usa Horizontal/Vertical para voltar ao alinhamento'
                    : 'Arrasta para posição livre, ou usa Horizontal/Vertical';
                ligarArrastoTextoGestao(el, item, previewWrap, () => {
                    textoAtivoId = item.id;
                    marcarSelecaoVisual();
                }, () => {
                    sincronizarLista();
                });
                camadaTextos.appendChild(el);
                mapaPreview.set(item.id, el);
            });
        };

        const sincronizarLista = () => {
            listaTextos.replaceChildren();
            if (!textosEstado.length) {
                const vazio = document.createElement('p');
                vazio.className = 'gestao-vazio';
                vazio.textContent = 'Sem textos. Clica em «Adicionar texto».';
                listaTextos.appendChild(vazio);
                return;
            }

            textosEstado.forEach((item, indice) => {
                const bloco = document.createElement('div');
                bloco.className = 'gestao-texto-item' + (item.id === textoAtivoId ? ' is-ativo' : '');

                const cabeca = document.createElement('div');
                cabeca.className = 'gestao-texto-item-topo';
                const rotulo = document.createElement('strong');
                rotulo.textContent = 'Texto ' + (indice + 1);
                const btnRemover = document.createElement('button');
                btnRemover.type = 'button';
                btnRemover.className = 'wallapop-botao';
                btnRemover.textContent = 'Remover';
                btnRemover.addEventListener('click', () => {
                    const idx = textosEstado.findIndex((t) => t.id === item.id);
                    if (idx < 0) return;
                    textosEstado.splice(idx, 1);
                    if (textoAtivoId === item.id) textoAtivoId = textosEstado[0]?.id || null;
                    sincronizarLista();
                    sincronizarPreview();
                });
                cabeca.appendChild(rotulo);
                if (item.posicaoLivre) {
                    const notaLivre = document.createElement('span');
                    notaLivre.className = 'gestao-texto-posicao-livre';
                    notaLivre.textContent = 'Posição livre';
                    cabeca.appendChild(notaLivre);
                }
                cabeca.appendChild(btnRemover);

                const area = document.createElement('textarea');
                area.rows = 2;
                area.maxLength = 160;
                area.value = item.texto;
                area.dataset.semLimparCampo = '1';
                area.placeholder = 'Escreve o texto… Enter para nova linha. **destaque**';
                area.addEventListener('focus', () => {
                    textoAtivoId = item.id;
                    marcarSelecaoVisual();
                });
                area.addEventListener('input', () => {
                    item.texto = area.value;
                    const el = mapaPreview.get(item.id);
                    if (el) {
                        preencherTextoBannerGestao(el, item.texto, item.cor, item.cor_destaque);
                    } else {
                        sincronizarPreview();
                    }
                });

                const linhaCores = document.createElement('div');
                linhaCores.className = 'gestao-texto-item-cores';

                const corLabel = document.createElement('label');
                corLabel.className = 'gestao-campo gestao-campo-cor';
                corLabel.innerHTML = '<span>Cor</span>';
                const corInput = document.createElement('input');
                corInput.type = 'color';
                corInput.value = item.cor;
                corInput.dataset.semLimparCampo = '1';
                corInput.addEventListener('input', () => {
                    item.cor = normalizarCorHexGestao(corInput.value, GESTAO_COR_BRANCO);
                    sincronizarPreview();
                });
                corLabel.appendChild(corInput);

                const destLabel = document.createElement('label');
                destLabel.className = 'gestao-campo gestao-campo-cor';
                destLabel.innerHTML = '<span>Destaque **</span>';
                const destInput = document.createElement('input');
                destInput.type = 'color';
                destInput.value = item.cor_destaque;
                destInput.dataset.semLimparCampo = '1';
                destInput.addEventListener('input', () => {
                    item.cor_destaque = normalizarCorHexGestao(destInput.value, GESTAO_COR_AMARELO_LOGO);
                    sincronizarPreview();
                });
                destLabel.appendChild(destInput);

                const alignLabel = document.createElement('label');
                alignLabel.className = 'gestao-campo';
                alignLabel.innerHTML = '<span>Horizontal</span>';
                const alignSelect = document.createElement('select');
                alignSelect.dataset.semLimparCampo = '1';
                [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']].forEach(([valor, rotuloOpt]) => {
                    const opt = document.createElement('option');
                    opt.value = valor;
                    opt.textContent = rotuloOpt;
                    if (item.align === valor) opt.selected = true;
                    alignSelect.appendChild(opt);
                });
                alignSelect.addEventListener('change', () => {
                    item.align = alinharHTextoBanner(alignSelect.value);
                    aplicarAlinhamentoAutomatico(item);
                    sincronizarPreview();
                    sincronizarLista();
                });
                alignLabel.appendChild(alignSelect);

                const alignVLabel = document.createElement('label');
                alignVLabel.className = 'gestao-campo';
                alignVLabel.innerHTML = '<span>Vertical</span>';
                const alignVSelect = document.createElement('select');
                alignVSelect.dataset.semLimparCampo = '1';
                [['top', 'Topo'], ['middle', 'Meio'], ['bottom', 'Base']].forEach(([valor, rotuloOpt]) => {
                    const opt = document.createElement('option');
                    opt.value = valor;
                    opt.textContent = rotuloOpt;
                    if (item.alignV === valor) opt.selected = true;
                    alignVSelect.appendChild(opt);
                });
                alignVSelect.addEventListener('change', () => {
                    item.alignV = alinharVTextoBanner(alignVSelect.value);
                    aplicarAlinhamentoAutomatico(item);
                    sincronizarPreview();
                    sincronizarLista();
                });
                alignVLabel.appendChild(alignVSelect);

                const larguraLabel = document.createElement('label');
                larguraLabel.className = 'gestao-campo';
                larguraLabel.innerHTML = '<span>Largura (%)</span>';
                const larguraInput = document.createElement('input');
                larguraInput.type = 'number';
                larguraInput.min = '10';
                larguraInput.max = '80';
                larguraInput.step = '1';
                larguraInput.value = String(item.maxWidth);
                larguraInput.dataset.semLimparCampo = '1';
                larguraInput.addEventListener('input', () => {
                    item.maxWidth = limitarPercentagem(larguraInput.value, 10, 80);
                    sincronizarPreview();
                });
                larguraLabel.appendChild(larguraInput);

                const tamanhoLabel = document.createElement('label');
                tamanhoLabel.className = 'gestao-campo';
                tamanhoLabel.innerHTML = '<span>Tamanho letra (%)</span>';
                const tamanhoInput = document.createElement('input');
                tamanhoInput.type = 'number';
                tamanhoInput.min = '50';
                tamanhoInput.max = '200';
                tamanhoInput.step = '5';
                tamanhoInput.value = String(item.fontSize);
                tamanhoInput.title = '100 = tamanho normal da loja; 50 = metade; 200 = dobro';
                tamanhoInput.dataset.semLimparCampo = '1';
                tamanhoInput.addEventListener('input', () => {
                    item.fontSize = limitarTamanhoFonteBanner(tamanhoInput.value);
                    sincronizarPreview();
                });
                tamanhoLabel.appendChild(tamanhoInput);

                linhaCores.appendChild(corLabel);
                linhaCores.appendChild(destLabel);
                linhaCores.appendChild(alignLabel);
                linhaCores.appendChild(alignVLabel);
                linhaCores.appendChild(larguraLabel);
                linhaCores.appendChild(tamanhoLabel);

                bloco.appendChild(cabeca);
                bloco.appendChild(area);
                bloco.appendChild(linhaCores);

                if (item.posicaoLivre) {
                    const btnRepor = document.createElement('button');
                    btnRepor.type = 'button';
                    btnRepor.className = 'wallapop-botao gestao-texto-repor-alinhamento';
                    btnRepor.textContent = 'Voltar ao alinhamento H+V';
                    btnRepor.addEventListener('click', () => {
                        aplicarAlinhamentoAutomatico(item);
                        sincronizarPreview();
                        sincronizarLista();
                    });
                    bloco.appendChild(btnRepor);
                }

                listaTextos.appendChild(bloco);
            });
        };

        btnAddTexto.addEventListener('click', () => {
            const novo = criarTextoBannerPadrao({
                texto: 'Novo texto',
                align: 'center',
                alignV: 'middle'
            });
            textosEstado.push(novo);
            textoAtivoId = novo.id;
            sincronizarLista();
            sincronizarPreview();
        });

        const btnGuardar = document.createElement('button');
        btnGuardar.type = 'button';
        btnGuardar.className = 'wallapop-botao wallapop-botao-destaque';
        btnGuardar.textContent = 'Guardar';
        btnGuardar.addEventListener('click', () => {
            guardarBannerGestao(banner.id, {
                url: banner.url,
                textos: textosEstado.map((item) => criarTextoBannerPadrao(item)),
                ordem: Number(inputOrdem.value),
                ativo: inputAtivo.checked
            }).catch(console.error);
        });

        const btnApagar = document.createElement('button');
        btnApagar.type = 'button';
        btnApagar.className = 'wallapop-botao';
        btnApagar.textContent = 'Apagar';
        btnApagar.addEventListener('click', () => {
            apagarBannerGestao(banner.id).catch(console.error);
        });

        acoes.appendChild(labelAtivo);
        acoes.appendChild(labelOrdem);
        acoes.appendChild(btnGuardar);
        acoes.appendChild(btnApagar);

        campos.appendChild(topoTextos);
        campos.appendChild(listaTextos);
        campos.appendChild(acoes);
        card.appendChild(campos);
        lista.appendChild(card);

        sincronizarLista();
        sincronizarPreview();
    });
}

async function carregarBannersGestao() {
    definirStatusGestao('A carregar banners...');
    const { data, error } = await gestaoClient.rpc('listar_banners_loja_admin');
    if (error) throw error;
    gestaoBanners = Array.isArray(data) ? data : [];
    renderizarListaBannersGestao();
    definirStatusGestao(gestaoBanners.length ? `${gestaoBanners.length} banner(s).` : 'Sem banners.');
}

async function guardarBannerGestao(id, dados) {
    definirStatusGestao('A guardar...');
    const { data, error } = await gestaoClient.rpc('guardar_banner_loja_admin', {
        p_id: id || null,
        p_url: dados.url,
        p_textos: Array.isArray(dados.textos) ? dados.textos : [],
        p_ordem: Number.isFinite(Number(dados.ordem)) ? Number(dados.ordem) : 0,
        p_ativo: dados.ativo !== false
    });
    if (error) {
        definirStatusGestao('Erro ao guardar: ' + (error.message || 'desconhecido'));
        throw error;
    }
    if (!data?.sucesso) {
        definirStatusGestao('Não foi possível guardar o banner.');
        return;
    }
    await carregarBannersGestao();
    definirStatusGestao(id ? 'Banner atualizado.' : 'Banner adicionado. Já aparece na loja se estiver ativo.');
}

async function apagarBannerGestao(id) {
    if (!id) return;
    if (!window.confirm('Apagar este banner?')) return;
    definirStatusGestao('A apagar...');
    const { data, error } = await gestaoClient.rpc('apagar_banner_loja_admin', { p_id: id });
    if (error) {
        definirStatusGestao('Erro ao apagar: ' + (error.message || 'desconhecido'));
        throw error;
    }
    if (!data?.sucesso) {
        definirStatusGestao('Não foi possível apagar o banner.');
        return;
    }
    await carregarBannersGestao();
    definirStatusGestao('Banner apagado.');
}

async function adicionarBannerGestao(evento) {
    evento.preventDefault();
    const ficheiroInput = document.getElementById('novo-banner-ficheiro');
    const ficheiro = ficheiroInput?.files?.[0];
    if (!ficheiro) {
        definirStatusGestao('Escolhe uma imagem.');
        return;
    }

    const btn = document.getElementById('btn-adicionar-banner');
    if (btn) btn.disabled = true;
    definirStatusGestao('A enviar imagem...');

    try {
        const url = await enviarFicheiroCloudinaryGestao(ficheiro);
        const ordem = Number(document.getElementById('novo-banner-ordem')?.value);
        const ativo = document.getElementById('novo-banner-ativo')?.checked !== false;
        await guardarBannerGestao(null, {
            url,
            textos: [],
            ordem: Number.isFinite(ordem) ? ordem : 100,
            ativo
        });
        if (ficheiroInput) ficheiroInput.value = '';
    } catch (erro) {
        definirStatusGestao('Erro: ' + (erro.message || 'desconhecido'));
        throw erro;
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function iniciarPainelGestao() {
    const bloqueio = document.getElementById('gestao-bloqueio');
    const aplicacao = document.getElementById('gestao-aplicacao');

    await window.carregarScriptSupabase();
    if (typeof supabase === 'undefined') {
        throw new Error('A biblioteca Supabase não carregou.');
    }

    gestaoClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const user = await validarAdminRapido(gestaoClient, bloqueio);
    if (!user) return;

    if (typeof mostrarNavegacaoAdminValidada === 'function') {
        mostrarNavegacaoAdminValidada();
    }
    if (bloqueio) bloqueio.hidden = true;
    if (aplicacao) aplicacao.hidden = false;
    iniciarMenuSeccoesGestao();

    document.getElementById('form-novo-banner')?.addEventListener('submit', (evento) => {
        adicionarBannerGestao(evento).catch(console.error);
    });
    document.getElementById('btn-atualizar-banners')?.addEventListener('click', () => {
        carregarBannersGestao().catch(console.error);
    });
    ligarImportacaoGestao();

    try {
        await carregarBannersGestao();
    } catch (erro) {
        console.error(erro);
        definirStatusGestao(
            'Erro ao carregar. Confirma se executaste o SQL supabase-banners-loja-textos-livres.sql no Supabase. '
            + (erro.message || '')
        );
    }

    if (typeof window.iniciarPainelPortes === 'function') {
        try {
            await window.iniciarPainelPortes({ jaAutenticado: true, embutido: true });
            const seccaoAtiva = document.querySelector('[data-gestao-seccao].ativa')?.dataset.gestaoSeccao || 'banners';
            selecionarSeccaoGestao(seccaoAtiva, false);
        } catch (erroPortes) {
            console.error(erroPortes);
            const statusPortes = document.getElementById('portes-status');
            if (statusPortes) {
                statusPortes.textContent = 'Erro ao carregar portes: ' + (erroPortes.message || 'desconhecido');
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    iniciarPainelGestao().catch((erro) => {
        console.error(erro);
        const bloqueio = document.getElementById('gestao-bloqueio');
        if (bloqueio) bloqueio.textContent = 'Erro ao iniciar a página de gestão.';
    });
});
