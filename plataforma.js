const WALLAPOP_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const WALLAPOP_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const WALLAPOP_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
const WALLAPOP_STORAGE_KEY = "figures-planet-wallapop-itens";
const PESO_PADRAO_PLATAFORMA = 10;
const IVA_PORTES_PLATAFORMA = 0.23;
const TABELA_PORTES_PLATAFORMA = {
    portugal: [
        { ate: 100, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 1.58 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 2.10 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 4.60 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 4.76 }
        ]},
        { ate: 500, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 2.34 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 3.90 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 5.40 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 4.76 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 5.55 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 7.80 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 8.93 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.42 }
        ]}
    ],
    espanha: [
        { ate: 100, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 5.80 }, { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }] },
        { ate: 250, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 7.55 }, { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }] },
        { ate: 500, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 9.80 }, { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }] },
        { ate: 1000, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 13.20 }, { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.81 }] },
        { ate: Infinity, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 21.20 }, { id: 'inpost_registado', nome: 'InPost Registado', valor: 6.64 }] }
    ],
    europa: [
        { ate: 100, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 5.80 }] },
        { ate: 250, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 7.55 }] },
        { ate: 500, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 9.80 }] },
        { ate: 1000, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 13.20 }] },
        { ate: Infinity, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 21.20 }] }
    ],
    resto_mundo: [
        { ate: 100, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 6.55 }] },
        { ate: 250, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 9.30 }] },
        { ate: 500, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 14.15 }] },
        { ate: 1000, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 23.95 }] },
        { ate: Infinity, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 36.15 }] }
    ]
};
const WALLAPOP_SEM_IMAGEM = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="100%" height="100%" fill="#f1f1f1"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#777" font-family="Arial" font-size="34">Sem foto</text></svg>'
);

let wallapopClient = null;
let wallapopProdutos = [];
let wallapopItens = carregarItensWallapop();
let wallapopRegistoConcluido = false;

function obterPlataformaAtual() {
    return document.getElementById('plataforma-tipo')?.value || 'Wallapop';
}

function formatarEuroWallapop(valor) {
    return Number(valor || 0).toFixed(2).replace('.', ',');
}

function calcularSubtotalPlataforma() {
    return wallapopItens.reduce((total, item) => (
        total + Math.max(1, Number(item.quantidade) || 1) * Number(item.preco || 0)
    ), 0);
}

function calcularPesoPlataforma() {
    return wallapopItens.reduce((total, item) => (
        total + Math.max(1, Number(item.quantidade) || 1) * Number(item.peso || PESO_PADRAO_PLATAFORMA)
    ), 0);
}

function obterOpcoesEnvioPlataforma(regiao, peso) {
    if (peso <= 0) return [];
    const tabela = TABELA_PORTES_PLATAFORMA[regiao] || TABELA_PORTES_PLATAFORMA.portugal;
    return (tabela.find(linha => peso <= linha.ate) || tabela[tabela.length - 1]).opcoes;
}

function calcularPortesPlataforma(valorBase) {
    return Math.round(Number(valorBase || 0) * (1 + IVA_PORTES_PLATAFORMA) * 100) / 100;
}

function obterEnvioPlataforma() {
    const regiao = document.getElementById('plataforma-pais-envio')?.value || 'portugal';
    const peso = calcularPesoPlataforma();
    const opcoes = obterOpcoesEnvioPlataforma(regiao, peso);
    const metodo = document.getElementById('plataforma-metodo-envio')?.value || '';
    const opcao = opcoes.find(item => item.id === metodo) || opcoes[0] || { id: '', nome: '', valor: 0 };
    return { regiao, peso, ...opcao, portes: calcularPortesPlataforma(opcao.valor) };
}

function atualizarOpcoesEnvioPlataforma() {
    const select = document.getElementById('plataforma-metodo-envio');
    if (!select) return;
    const anterior = select.value;
    const regiao = document.getElementById('plataforma-pais-envio')?.value || 'portugal';
    const opcoes = obterOpcoesEnvioPlataforma(regiao, calcularPesoPlataforma());
    select.replaceChildren();
    opcoes.forEach(opcao => {
        const option = document.createElement('option');
        option.value = opcao.id;
        option.textContent = `${opcao.nome} - ${formatarEuroWallapop(calcularPortesPlataforma(opcao.valor))} \u20ac`;
        select.appendChild(option);
    });
    const registado = opcoes.find(opcao => opcao.id === 'ctt_registado');
    select.value = opcoes.some(opcao => opcao.id === anterior) ? anterior : (registado?.id || opcoes[0]?.id || '');
    atualizarResumoPlataforma();
}

function atualizarResumoPlataforma() {
    const subtotal = calcularSubtotalPlataforma();
    const envio = obterEnvioPlataforma();
    const portes = obterPlataformaAtual() === 'OLX' ? envio.portes : 0;
    const peso = document.getElementById('plataforma-peso');
    if (peso) peso.textContent = `Peso estimado: ${envio.peso}g`;
    document.getElementById('plataforma-subtotal').textContent = `${formatarEuroWallapop(subtotal)} \u20ac`;
    document.getElementById('plataforma-portes').textContent = `${formatarEuroWallapop(portes)} \u20ac`;
    document.getElementById('plataforma-total').textContent = `${formatarEuroWallapop(subtotal + portes)} \u20ac`;
}

function atualizarModoPlataforma() {
    const plataforma = obterPlataformaAtual();
    const wallapop = plataforma === 'Wallapop';
    const olx = plataforma === 'OLX';
    document.getElementById('label-cliente-plataforma').textContent = `Cliente ${plataforma}`;
    document.getElementById('label-referencia-plataforma').textContent = `Refer\u00eancia ${plataforma} (opcional)`;
    document.getElementById('wallapop-nome-cliente').placeholder = `Nome ou utilizador no ${plataforma}`;
    document.getElementById('plataforma-envio').hidden = !olx;
    document.getElementById('wallapop-folha-escala').hidden = !wallapop;
    document.getElementById('plataforma-resumo').hidden = wallapop;
    document.getElementById('plataforma-resumo-titulo').textContent = plataforma === 'OLX'
        ? 'Ficheiros OLX'
        : 'Ficheiro Todocoleccion';
    document.getElementById('plataforma-resumo-texto').textContent = plataforma === 'OLX'
        ? 'Ser\u00e3o criados dois TXT: um para enviar ao cliente e outro para a gest\u00e3o interna.'
        : 'Ser\u00e1 criado um TXT interno com quantidade, nome e SKU separados por tabula\u00e7\u00f5es.';
    document.getElementById('btn-descarregar-wallapop').textContent = wallapop
        ? 'Guardar an\u00fancio'
        : (olx ? 'Guardar ficheiros OLX' : 'Guardar ficheiro Todocoleccion');
    document.getElementById('btn-registar-wallapop').textContent = `Registar encomenda ${plataforma}`;
    document.getElementById('plataforma-ajuda-ficheiros').textContent = wallapop
        ? 'Ao guardar, ser\u00e3o criados o PNG e o TXT dentro da pasta da encomenda.'
        : 'Ao guardar, escolhe a pasta de destino. Dentro dela ser\u00e1 criada uma pasta com o nome da encomenda.';
    marcarWallapopPorRegistar();
    if (olx) atualizarOpcoesEnvioPlataforma();
    atualizarResumoPlataforma();
}

function normalizarTextoWallapop(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function obterImagemWallapop(produto = {}) {
    let imagens = produto.imagens;
    if (typeof imagens === 'string') {
        try {
            imagens = JSON.parse(imagens);
        } catch (_) {
            imagens = imagens.split(',').map(item => item.trim());
        }
    }
    const url = Array.isArray(imagens) ? imagens.find(Boolean) : '';
    return url || WALLAPOP_SEM_IMAGEM;
}

function otimizarImagemWallapop(url, largura = 500) {
    const original = String(url || '');
    if (!original.includes('res.cloudinary.com/') || !original.includes('/image/upload/')) return original;
    return original.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${largura},c_limit/`);
}

function carregarItensWallapop() {
    try {
        const guardados = JSON.parse(localStorage.getItem(WALLAPOP_STORAGE_KEY) || '[]');
        return Array.isArray(guardados) ? guardados : [];
    } catch (_) {
        return [];
    }
}

function guardarItensWallapop() {
    localStorage.setItem(WALLAPOP_STORAGE_KEY, JSON.stringify(wallapopItens));
}

function marcarWallapopPorRegistar() {
    wallapopRegistoConcluido = false;
    const botao = document.getElementById('btn-registar-wallapop');
    if (botao) botao.disabled = false;
}

function definirStatusWallapop(texto, erro = false) {
    const elemento = document.getElementById('wallapop-status');
    elemento.textContent = texto || '';
    elemento.style.color = erro ? '#ff6262' : '#bbb';
}

async function carregarCatalogoWallapop() {
    const produtos = [];
    let inicio = 0;
    const tamanho = 500;

    while (true) {
        const { data, error } = await wallapopClient
            .from('produtos_loja')
            .select('id, sku, nome, preco, peso, imagens, ativo')
            .order('nome', { ascending: true })
            .range(inicio, inicio + tamanho - 1);
        if (error) throw error;
        if (!data?.length) break;
        produtos.push(...data.filter(produto => produto.ativo !== false));
        if (data.length < tamanho) break;
        inicio += tamanho;
    }

    wallapopProdutos = produtos;
    wallapopItens = wallapopItens
        .map(item => {
            const produto = produtos.find(atual => String(atual.id) === String(item.id));
            return produto ? { ...produto, quantidade: Math.max(1, Number(item.quantidade) || 1) } : null;
        })
        .filter(Boolean);
    guardarItensWallapop();
}

function criarImagemWallapop(src, alt, classe) {
    const imagem = document.createElement('img');
    imagem.className = classe;
    imagem.alt = alt;
    imagem.crossOrigin = 'anonymous';
    imagem.src = otimizarImagemWallapop(src);
    imagem.onerror = () => {
        imagem.onerror = null;
        imagem.removeAttribute('crossorigin');
        imagem.src = WALLAPOP_SEM_IMAGEM;
    };
    return imagem;
}

function adicionarProdutoWallapop(id) {
    const existente = wallapopItens.find(item => String(item.id) === String(id));
    if (existente) {
        existente.quantidade += 1;
    } else {
        const produto = wallapopProdutos.find(item => String(item.id) === String(id));
        if (!produto) return;
        wallapopItens.push({ ...produto, quantidade: 1 });
    }
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
}

function alterarQuantidadeWallapop(id, diferenca) {
    const item = wallapopItens.find(produto => String(produto.id) === String(id));
    if (!item) return;
    item.quantidade = Math.max(1, item.quantidade + diferenca);
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
}

function removerProdutoWallapop(id) {
    wallapopItens = wallapopItens.filter(item => String(item.id) !== String(id));
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
}

function moverProdutoWallapop(id, diferenca) {
    const indice = wallapopItens.findIndex(item => String(item.id) === String(id));
    const destino = indice + diferenca;
    if (indice < 0 || destino < 0 || destino >= wallapopItens.length) return;
    [wallapopItens[indice], wallapopItens[destino]] = [wallapopItens[destino], wallapopItens[indice]];
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
}

function renderizarResultadosWallapop() {
    const termo = normalizarTextoWallapop(document.getElementById('wallapop-pesquisa').value);
    const contentor = document.getElementById('wallapop-resultados');
    contentor.replaceChildren();

    if (!termo) {
        const ajuda = document.createElement('p');
        ajuda.className = 'wallapop-status';
        ajuda.textContent = 'Pesquise para adicionar produtos.';
        contentor.appendChild(ajuda);
        return;
    }

    const resultados = wallapopProdutos.filter(produto =>
        normalizarTextoWallapop(produto.nome).includes(termo) ||
        normalizarTextoWallapop(produto.sku).includes(termo)
    ).slice(0, 30);

    resultados.forEach(produto => {
        const linha = document.createElement('div');
        linha.className = 'wallapop-resultado';
        linha.appendChild(criarImagemWallapop(obterImagemWallapop(produto), produto.nome, 'wallapop-miniatura'));

        const info = document.createElement('div');
        info.className = 'wallapop-resultado-info';
        const nome = document.createElement('strong');
        nome.textContent = produto.nome;
        const preco = document.createElement('span');
        preco.textContent = `${formatarEuroWallapop(produto.preco)} €`;
        info.append(nome, preco);

        const adicionar = document.createElement('button');
        adicionar.className = 'wallapop-botao wallapop-botao-destaque';
        adicionar.type = 'button';
        adicionar.textContent = 'Adicionar';
        adicionar.onclick = () => adicionarProdutoWallapop(produto.id);
        linha.append(info, adicionar);
        contentor.appendChild(linha);
    });

    if (!resultados.length) {
        const vazio = document.createElement('p');
        vazio.className = 'wallapop-status';
        vazio.textContent = 'Nenhum produto encontrado.';
        contentor.appendChild(vazio);
    }
}

function renderizarSelecionadosWallapop() {
    const contentor = document.getElementById('wallapop-selecionados');
    contentor.replaceChildren();

    wallapopItens.forEach(item => {
        const linha = document.createElement('div');
        linha.className = 'wallapop-selecionado';
        linha.appendChild(criarImagemWallapop(obterImagemWallapop(item), item.nome, 'wallapop-miniatura'));

        const info = document.createElement('div');
        info.className = 'wallapop-selecionado-info';
        const nome = document.createElement('strong');
        nome.textContent = item.nome;
        const preco = document.createElement('span');
        preco.textContent = `${formatarEuroWallapop(item.preco)} €`;
        info.append(nome, preco);

        const controlos = document.createElement('div');
        controlos.className = 'wallapop-quantidade';
        const subir = document.createElement('button');
        subir.type = 'button';
        subir.textContent = '↑';
        subir.title = 'Mover para cima';
        subir.onclick = () => moverProdutoWallapop(item.id, -1);
        const descer = document.createElement('button');
        descer.type = 'button';
        descer.textContent = '↓';
        descer.title = 'Mover para baixo';
        descer.onclick = () => moverProdutoWallapop(item.id, 1);
        const menos = document.createElement('button');
        menos.type = 'button';
        menos.textContent = '−';
        menos.title = 'Diminuir quantidade';
        menos.onclick = () => alterarQuantidadeWallapop(item.id, -1);
        const quantidade = document.createElement('strong');
        quantidade.textContent = item.quantidade;
        const mais = document.createElement('button');
        mais.type = 'button';
        mais.textContent = '+';
        mais.title = 'Aumentar quantidade';
        mais.onclick = () => alterarQuantidadeWallapop(item.id, 1);
        const remover = document.createElement('button');
        remover.type = 'button';
        remover.className = 'wallapop-remover';
        remover.textContent = '×';
        remover.title = 'Remover produto';
        remover.onclick = () => removerProdutoWallapop(item.id);
        controlos.append(subir, descer, menos, quantidade, mais, remover);
        linha.append(info, controlos);
        contentor.appendChild(linha);
    });

    if (!wallapopItens.length) {
        const vazio = document.createElement('p');
        vazio.className = 'wallapop-status';
        vazio.textContent = 'A lista está vazia.';
        contentor.appendChild(vazio);
    }
    if (obterPlataformaAtual() === 'OLX') atualizarOpcoesEnvioPlataforma();
    else atualizarResumoPlataforma();
}

function renderizarFolhaWallapop() {
    const grelha = document.getElementById('wallapop-grelha');
    grelha.replaceChildren();

    wallapopItens.forEach(item => {
        const cartao = document.createElement('article');
        cartao.className = 'wallapop-cartao';
        const foto = document.createElement('div');
        foto.className = 'wallapop-foto';
        foto.appendChild(criarImagemWallapop(obterImagemWallapop(item), item.nome, ''));
        cartao.appendChild(foto);

        const texto = document.createElement('div');
        texto.className = 'wallapop-cartao-texto';
        const quantidade = document.createElement('p');
        quantidade.className = 'wallapop-cartao-quantidade';
        quantidade.textContent = item.quantidade > 1 ? `${item.quantidade}x` : '';
        quantidade.hidden = item.quantidade <= 1;
        const nome = document.createElement('h3');
        nome.textContent = item.nome;
        const preco = document.createElement('p');
        preco.className = 'wallapop-cartao-preco';
        preco.textContent = `${formatarEuroWallapop(item.preco)} € / un.`;
        texto.append(quantidade, nome, preco);
        cartao.appendChild(texto);
        grelha.appendChild(cartao);
    });

    if (!wallapopItens.length) {
        const vazio = document.createElement('div');
        vazio.className = 'wallapop-vazio';
        vazio.textContent = 'Adicione produtos para criar a imagem.';
        grelha.appendChild(vazio);
    }

}

async function esperarImagensWallapop() {
    const imagens = [...document.querySelectorAll('#wallapop-folha img')];
    await Promise.all(imagens.map(imagem => {
        if (imagem.complete) return Promise.resolve();
        return new Promise(resolve => {
            imagem.addEventListener('load', resolve, { once: true });
            imagem.addEventListener('error', resolve, { once: true });
        });
    }));
}

async function obterPastaBaseWallapop() {
    if (!window.showDirectoryPicker) throw new Error('Esta função requer Chrome ou Edge atualizado.');
    return window.showDirectoryPicker({
        id: 'figures-planet-anuncio-destino',
        mode: 'readwrite'
    });
}

function limparNomePastaWallapop(nome) {
    const limpo = String(nome || '')
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
        .replace(/[. ]+$/g, '')
        .slice(0, 100);
    if (!limpo || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(limpo)) return '';
    return limpo;
}

async function escreverFicheiroWallapop(pasta, nome, conteudo) {
    const ficheiro = await pasta.getFileHandle(nome, { create: true });
    const escrita = await ficheiro.createWritable();
    await escrita.write(conteudo);
    await escrita.close();
}

function criarTextoEncomendaWallapop() {
    const linhas = wallapopItens.map(item => [
        Math.max(1, Number(item.quantidade) || 1),
        String(item.nome || '').trim(),
        String(item.sku || '').trim()
    ].join('\t'));
    const total = wallapopItens.reduce((soma, item) => {
        return soma + (Math.max(1, Number(item.quantidade) || 1) * Number(item.preco || 0));
    }, 0);
    linhas.push('', `Total:\t${formatarEuroWallapop(total)} €`);
    return '\ufeff' + linhas.join('\r\n');
}

function criarTextoInternoPlataforma() {
    const linhas = wallapopItens.map(item => [
        Math.max(1, Number(item.quantidade) || 1),
        String(item.nome || '').trim(),
        String(item.sku || '').trim()
    ].join('\t'));
    return '\ufeff' + linhas.join('\r\n');
}

function criarTextoClienteOlx() {
    const envio = obterEnvioPlataforma();
    const subtotal = calcularSubtotalPlataforma();
    const linhas = ['Produtos:'];
    wallapopItens.forEach(item => {
        linhas.push([
            `${Math.max(1, Number(item.quantidade) || 1)}x`,
            String(item.nome || '').trim(),
            `${formatarEuroWallapop(item.preco)} \u20ac / un.`
        ].join('\t'));
    });
    linhas.push(
        '',
        `Portes de envio (${envio.nome}):\t${formatarEuroWallapop(envio.portes)} \u20ac`,
        `Total geral:\t${formatarEuroWallapop(subtotal + envio.portes)} \u20ac`
    );
    return '\ufeff' + linhas.join('\r\n');
}

function canvasParaBlobWallapop(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar o PNG.')), 'image/png');
    });
}

async function descarregarImagemWallapop() {
    const campoNome = document.getElementById('wallapop-nome-encomenda');
    const nomeEncomenda = limparNomePastaWallapop(campoNome.value);
    if (!nomeEncomenda) {
        definirStatusWallapop('Indique um nome válido para a encomenda.', true);
        campoNome.focus();
        return;
    }
    if (!wallapopItens.length) {
        definirStatusWallapop('Adicione pelo menos um produto.', true);
        return;
    }
    if (typeof html2canvas !== 'function') {
        definirStatusWallapop('A ferramenta de imagem não carregou. Atualize a página.', true);
        return;
    }

    definirStatusWallapop('A preparar a pasta e os ficheiros...');
    try {
        const pastaBase = await obterPastaBaseWallapop();
        await esperarImagensWallapop();
        const folha = document.getElementById('wallapop-folha');
        const transformAnterior = folha.style.transform;
        folha.style.transform = 'none';
        let canvas;
        try {
            canvas = await html2canvas(folha, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: folha.scrollWidth,
                windowHeight: folha.scrollHeight
            });
        } finally {
            folha.style.transform = transformAnterior;
        }
        const pastaEncomenda = await pastaBase.getDirectoryHandle(nomeEncomenda, { create: true });
        const imagem = await canvasParaBlobWallapop(canvas);
        await escreverFicheiroWallapop(pastaEncomenda, `${nomeEncomenda}.txt`, criarTextoEncomendaWallapop());
        await escreverFicheiroWallapop(pastaEncomenda, 'foto anuncio.png', imagem);
        definirStatusWallapop(`Pasta "${nomeEncomenda}" guardada com sucesso.`);
    } catch (error) {
        console.error(error);
        if (error?.name === 'AbortError') {
            definirStatusWallapop('Seleção da pasta cancelada.', true);
            return;
        }
        definirStatusWallapop('Não foi possível guardar a encomenda: ' + (error.message || 'erro desconhecido'), true);
    }
}

async function guardarFicheirosPlataforma() {
    const plataforma = obterPlataformaAtual();
    if (plataforma === 'Wallapop') {
        await descarregarImagemWallapop();
        return;
    }

    const campoNome = document.getElementById('wallapop-nome-encomenda');
    const nomeEncomenda = limparNomePastaWallapop(campoNome.value);
    if (!nomeEncomenda) {
        definirStatusWallapop('Indique um nome v\u00e1lido para a encomenda.', true);
        campoNome.focus();
        return;
    }
    if (!wallapopItens.length) {
        definirStatusWallapop('Adicione pelo menos um produto.', true);
        return;
    }

    definirStatusWallapop('A preparar a pasta e os ficheiros...');
    try {
        const pastaBase = await obterPastaBaseWallapop();
        const pastaEncomenda = await pastaBase.getDirectoryHandle(nomeEncomenda, { create: true });
        if (plataforma === 'OLX') {
            await escreverFicheiroWallapop(pastaEncomenda, 'informacao cliente.txt', criarTextoClienteOlx());
            await escreverFicheiroWallapop(pastaEncomenda, 'lista interna.txt', criarTextoInternoPlataforma());
            definirStatusWallapop(`Pasta "${nomeEncomenda}" guardada com os dois ficheiros OLX.`);
        } else {
            await escreverFicheiroWallapop(pastaEncomenda, `${nomeEncomenda}.txt`, criarTextoInternoPlataforma());
            definirStatusWallapop(`Ficheiro Todocoleccion guardado na pasta "${nomeEncomenda}".`);
        }
    } catch (error) {
        console.error(error);
        if (error?.name === 'AbortError') {
            definirStatusWallapop('Sele\u00e7\u00e3o da pasta cancelada.', true);
            return;
        }
        definirStatusWallapop('N\u00e3o foi poss\u00edvel guardar: ' + (error.message || 'erro desconhecido'), true);
    }
}

function obterItensEncomendaWallapop() {
    return wallapopItens.map((item, indice) => ({
        id_produto: String(item.id),
        quantidade: Math.max(1, Number(item.quantidade) || 1),
        ordem: indice
    }));
}

async function registarEncomendaWallapop() {
    const plataforma = obterPlataformaAtual();
    const nomeCliente = document.getElementById('wallapop-nome-cliente').value.trim();
    const referencia = document.getElementById('wallapop-referencia').value.trim();
    const botao = document.getElementById('btn-registar-wallapop');

    if (wallapopRegistoConcluido) {
        definirStatusWallapop(`Esta encomenda ${plataforma} já foi registada.`, true);
        return;
    }
    if (!nomeCliente) {
        definirStatusWallapop(`Indique o nome ou utilizador do cliente ${plataforma}.`, true);
        document.getElementById('wallapop-nome-cliente').focus();
        return;
    }
    if (!wallapopItens.length) {
        definirStatusWallapop('Adicione pelo menos um produto.', true);
        return;
    }

    const envio = plataforma === 'OLX' ? obterEnvioPlataforma() : { regiao: '', id: '', nome: '', portes: 0 };
    const total = calcularSubtotalPlataforma() + envio.portes;
    const confirmado = window.confirm(
        `Registar a encomenda ${plataforma} de ${nomeCliente} por ${formatarEuroWallapop(total)} € e descontar o stock?`
    );
    if (!confirmado) return;

    botao.disabled = true;
    definirStatusWallapop('A validar o stock e registar a encomenda...');
    try {
        const { data, error } = await wallapopClient.rpc('criar_encomenda_plataforma_admin', {
            p_plataforma: plataforma,
            p_itens: obterItensEncomendaWallapop(),
            p_nome_cliente: nomeCliente,
            p_referencia_externa: referencia || null,
            p_regiao_envio: envio.regiao || null,
            p_metodo_envio: envio.id || null,
            p_metodo_envio_nome: envio.nome || null,
            p_portes: envio.portes || 0
        });
        if (error) throw error;

        if (!data?.sucesso) {
            const indisponiveis = Array.isArray(data?.produtos_sem_stock)
                ? data.produtos_sem_stock.map(item => item.nome).filter(Boolean)
                : [];
            throw new Error(indisponiveis.length
                ? `Stock insuficiente: ${indisponiveis.join(', ')}.`
                : 'Não foi possível validar o stock.');
        }

        wallapopRegistoConcluido = true;
        const codigo = data.encomenda?.codigo_encomenda || '';
        definirStatusWallapop(`Encomenda ${codigo} registada. O stock foi atualizado.`);
        await carregarCatalogoWallapop();
        renderizarResultadosWallapop();
        renderizarSelecionadosWallapop();
        renderizarFolhaWallapop();
    } catch (error) {
        console.error(error);
        botao.disabled = false;
        definirStatusWallapop('Erro ao registar: ' + (error.message || 'erro desconhecido'), true);
    }
}

function limparListaWallapop() {
    if (!wallapopItens.length || !window.confirm('Limpar todos os produtos desta imagem?')) return;
    wallapopItens = [];
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
    definirStatusWallapop('Lista limpa.');
}

async function iniciarWallapopAdmin() {
    const bloqueio = document.getElementById('wallapop-bloqueio');
    try {
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase não carregou.');
        wallapopClient = supabase.createClient(WALLAPOP_SUPABASE_URL, WALLAPOP_SUPABASE_KEY);
        const { data: { user }, error } = await wallapopClient.auth.getUser();
        if (error || !user || !WALLAPOP_ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
            bloqueio.textContent = 'Acesso reservado ao administrador. A regressar à conta...';
            setTimeout(() => window.location.replace('conta.html'), 1400);
            return;
        }

        await carregarCatalogoWallapop();
        bloqueio.hidden = true;
        document.getElementById('wallapop-aplicacao').hidden = false;
        renderizarResultadosWallapop();
        renderizarSelecionadosWallapop();
        renderizarFolhaWallapop();
        atualizarModoPlataforma();
    } catch (error) {
        console.error(error);
        bloqueio.textContent = 'Erro ao abrir a ferramenta: ' + (error.message || 'sem detalhe disponível');
    }
}

document.getElementById('wallapop-pesquisa').addEventListener('input', renderizarResultadosWallapop);
document.getElementById('btn-limpar-wallapop').addEventListener('click', limparListaWallapop);
document.getElementById('btn-descarregar-wallapop').addEventListener('click', guardarFicheirosPlataforma);
document.getElementById('btn-registar-wallapop').addEventListener('click', registarEncomendaWallapop);
document.getElementById('wallapop-nome-cliente').addEventListener('input', marcarWallapopPorRegistar);
document.getElementById('wallapop-referencia').addEventListener('input', marcarWallapopPorRegistar);
document.getElementById('plataforma-tipo').addEventListener('change', atualizarModoPlataforma);
document.getElementById('plataforma-pais-envio').addEventListener('change', atualizarOpcoesEnvioPlataforma);
document.getElementById('plataforma-metodo-envio').addEventListener('change', () => {
    marcarWallapopPorRegistar();
    atualizarResumoPlataforma();
});
window.addEventListener('load', iniciarWallapopAdmin);
