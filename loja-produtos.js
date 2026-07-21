// Codigo da montra de produtos e filtros da loja.
// Separado de app.js para carregar apenas nas paginas que mostram catalogo.

const PRODUTOS_POR_LOTE = 48;
const PRODUTOS_POR_PAGINA_SERVIDOR = 48;
const TAMANHO_PAGINA_METADADOS = 1000;
const CACHE_TEMAS_LOJA_CHAVE = 'figures-planet-loja-temas-v2';
const CACHE_TEMAS_LOJA_TTL_MS = 30 * 60 * 1000;
const CAMPOS_PRODUTO_LOJA = 'id, sku, nome, preco, peso, tema, subtema, imagens, ativo, descontinuado';
const ICONE_TEMA_PADRAO = 'brick';

let produtosVitrineAtual = [];
let produtosFiltradosAtual = [];
let indiceRenderizado = 0;
let sentinelaCarregarMais = null;
let observadorCarregarMais = null;
let totalProdutosRemotos = 0;
let offsetProdutosRemotos = 0;
let haMaisProdutosRemotos = false;
let carregandoProdutosRemotos = false;
let promessaCargaProdutosEmCurso = null;
let reinicioProdutosPendente = false;
const mapaTemasLoja = new Map();

function slugificarTemaLoja(texto) {
    return String(texto || '').toLowerCase().replace(/\s+/g, '-');
}

function criarSvgTema(pathD) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
}

const MAPA_ICONES_TEMAS = {
    'Todos':                    'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
    'Animais':                  'M10 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm4 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-7 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 21c-3.3 0-6-2.2-6-5 0-2 1.5-3.6 3.5-4.4L12 10l2.5 1.6c2 .8 3.5 2.4 3.5 4.4 0 2.8-2.7 5-6 5z',
    'Bluey':                    'M9 5.5C9 4.1 10.1 3 11.5 3S14 4.1 14 5.5v.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1v-.5zM10 10h4M10 14h4',
    'Bonecos':                  'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 8c-3.3 0-6 1.3-6 3v1h12v-1c0-1.7-2.7-3-6-3zM7 18h10v2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-2z',
    'Cidade':                   'M3 21V9l6-6 6 6v12H3zm6-10v4m3-4v4M3 21h18M15 21v-6h6v6',
    'DC Comics':                'M13 2L4 14h6l-1 8 9-12h-6z',
    'Dinossauros':              'M4 14c0-4.4 3.6-8 8-8s8 3.6 8 8M8 14c.5-2.2 2.2-4 4-4s3.5 1.8 4 4m-8 0v4h8v-4M9 18v2m6-2v2',
    'Disney':                   'M12 3C8.1 3 5 6.1 5 10c0 2.4 1.2 4.6 3 5.9V20h8v-4.1c1.8-1.3 3-3.5 3-5.9 0-3.9-3.1-7-7-7zm-2 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm4 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z',
    'Diversos':                 'M4 6h16M4 12h16M4 18h16',
    'Dragon Ball':              'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 4a6 6 0 1 1 0 12A6 6 0 0 1 12 6zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
    'Famosos':                  'M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 12c-5.3 0-8 2.7-8 4v2h16v-2c0-1.3-2.7-4-8-4z',
    'Faroeste':                 'M4 18h16M7 18V8l5-4 5 4v10M10 18v-5h4v5',
    'Filmes e Séries':          'M15 10l4.6-2.7A1 1 0 0 1 21 8.3v7.4a1 1 0 0 1-1.4.9L15 14v-4zm-13 5V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z',
    'Futebol':                  'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 3l2.4 1.7-.9 2.8H10.5l-.9-2.8L12 5zm-5.7 4.1l2.4 1.7-.9 2.8H5.3l-.3-1a8 8 0 0 1 1.3-3.5zm11.4 0c.6.9 1 2.1 1.3 3.5l-.3 1h-2.5l-.9-2.8 2.4-1.7zM8.4 16l-.9-2.8H5l.7 2.3A8 8 0 0 0 8.4 16zm7.2 0a8 8 0 0 0 2.7-.5l.7-2.3h-2.5L15.6 16zm-3.6 3a8 8 0 0 1-3.1-.9l-.7-2.1h7.6l-.7 2.1A8 8 0 0 1 12 19z',
    'Ghostbusters':             'M12 2a7 7 0 0 1 7 7c0 2.2-.9 4.1-2.3 5.5L18 22H6l1.3-7.5C5.9 13.1 5 11.2 5 9a7 7 0 0 1 7-7zm-2 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    'Harry Potter':             'M6 20L12 4l6 16M8.5 14h7',
    'Image Comics':             'M12 3l7 3v6c0 5-3.4 8.5-7 9-3.6-.5-7-4-7-9V6z',
    'Jogos':                    'M6 11h4m-2-2v4m7-2h.01M16 9h.01M21 6H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z',
    'Looney Tunes':             'M8 3c0 0-4 2-4 7s3 6 4 9h8c1-3 4-4 4-9s-4-7-4-7H8zm4 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    'Marvel':                   'M12 3l7 3v6c0 5-3.4 8.5-7 9-3.6-.5-7-4-7-9V6z',
    'Masters of the Universe':  'M12 2l9 7-3 12H6L3 9z',
    'Medieval':                 'M12 2l3 3h2l1 3-4 3-4-3 1-3h2zM7 12h10v8H7zM9 16h2v4H9zm4 0h2v4h-2z',
    'Militar':                  'M12 3l7 3v5c0 4.7-3 8.2-7 9-4-0.8-7-4.3-7-9V6z',
    'NBA':                      'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM7 7c1.4 1 2.5 3 3 5H4.5A8 8 0 0 1 7 7zm-2.5 7h5.5c-.5 2-1.6 4-3 5a8 8 0 0 1-2.5-5zm5.5 5c1.4-1 2.5-3 3-5h5.5a8 8 0 0 1-8.5 5zm9-7h-5.5c.5-2 1.6-4 3-5a8 8 0 0 1 2.5 5z',
    'Ninjago':                  'M12 2l4 4-4 4-4-4 4-4zm0 12l4 4-4 4-4-4 4-4zm-6-6l4 4-4 4-4-4 4-4zm12 0l4 4-4 4-4-4 4-4z',
    'O Senhor dos Anéis':       'M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0',
    'One Piece':                'M12 4a4 4 0 0 1 4 4c0 1.5-.6 2.8-1.6 3.7L16 20H8l1.6-8.3C8.6 10.8 8 9.5 8 8a4 4 0 0 1 4-4z',
    'Os Simpsons':              'M7 9h10v6a5 5 0 0 1-10 0V9zm5-5a4 4 0 0 1 4 4H8a4 4 0 0 1 4-4zM9.5 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-3 3h1',
    'Piratas das Caraíbas':     'M12 2L2 7l4 9h12l4-9L12 2zm0 5v6m-3-3h6',
    'Rua Sésamo':               'M6.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm11 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM4 22v-8a3 3 0 0 1 3-3h2l3 4 3-4h2a3 3 0 0 1 3 3v8',
    'Star Wars':                'M12 2l1 4h4l-3 3 1 4-3-2-3 2 1-4-3-3h4zM6 16c0 0-2 2-2 4h16c0-2-2-4-2-4',
    'Stranger Things':          'M3.3 7A9 9 0 0 1 12 3a9 9 0 1 1 0 18 9 9 0 0 1-8.7-6.5M3 12h9m0 0l-3-3m3 3-3 3',
    'Tartarugas Ninja':         'M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm0 3a6 6 0 1 1 0 12A6 6 0 0 1 12 6zm-2 5h4m-2-2v4',
    'Tempos Antigos':           'M3 18l5-10 4 6 3-4 6 8H3z',
    'Thundercats':              'M12 2L4 8l2 12h12l2-12L12 2zm0 4l5 4-1 7H8l-1-7 5-4z',
    'Toy Story':                'M12 3a4 4 0 0 1 4 4v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v1h4V7a2 2 0 0 0-2-2zm-2 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
};

function criarIconeTema(tema = '') {
    const d = MAPA_ICONES_TEMAS[tema] || MAPA_ICONES_TEMAS['Diversos'];
    return criarSvgTema(d);
}

function criarRotuloTema(temaTexto) {
    const conteudo = document.createElement('span');
    conteudo.className = 'conteudo-tema';

    const icone = criarIconeTema(temaTexto);
    icone.classList.add('icone-tema');

    const nomeTema = document.createElement('span');
    nomeTema.className = 'nome-tema';
    nomeTema.textContent = temaTexto;

    conteudo.appendChild(icone);
    conteudo.appendChild(nomeTema);
    return conteudo;
}

function obterClienteProdutosLoja() {
    const cliente = produtosClient || dbClient;
    if (!cliente) {
        throw new Error('Cliente Supabase indisponível.');
    }
    return cliente;
}

function mesclarProdutosNoCatalogoLocal(produtos = []) {
    if (!produtos.length) return;
    const existentes = new Set((todosOsProdutos || []).map(produto => String(produto.id)));
    todosOsProdutos.push(...produtos.filter(produto => !existentes.has(String(produto.id))));
}

function construirMapaTemasLoja(metadados = []) {
    mapaTemasLoja.clear();
    const mapa = {};

    metadados.forEach(item => {
        const tema = (item.tema || 'Outros').trim();
        const subtema = (item.subtema && item.subtema !== 'semsubtema') ? item.subtema.trim() : '';
        if (!mapa[tema]) mapa[tema] = [];
        if (subtema && !mapa[tema].includes(subtema)) mapa[tema].push(subtema);
    });

    Object.keys(mapa).forEach(tema => {
        const temaId = slugificarTemaLoja(tema);
        const subtemas = new Map();
        mapa[tema].forEach(subtema => subtemas.set(slugificarTemaLoja(subtema), subtema));
        mapaTemasLoja.set(temaId, { nome: tema, subtemas });
    });

    return Object.keys(mapa).map(tema => ({ tema, subtema: 'semsubtema' }));
}

function obterFiltrosVitrineAtuais() {
    const campoPesquisa = document.getElementById('campo-pesquisa');
    const pesquisa = String(campoPesquisa?.value || '').trim();
    const partes = filtroTemaAtual.split('|');
    const slugTema = partes[0];
    const slugSubtema = partes[1] || '';
    const filtros = { pesquisa, tema: null, subtema: null };

    if (!pesquisa && filtroTemaAtual !== 'todos' && mapaTemasLoja.has(slugTema)) {
        const info = mapaTemasLoja.get(slugTema);
        filtros.tema = info.nome;
        if (slugSubtema) filtros.subtema = info.subtemas.get(slugSubtema) || null;
    }

    return filtros;
}

function aplicarFiltrosQueryProdutos(query, filtros) {
    let consulta = query.eq('ativo', true).eq('arquivado', false);

    if (filtros.pesquisa) {
        return consulta.ilike('nome', `%${filtros.pesquisa}%`);
    }
    if (filtros.tema) consulta = consulta.eq('tema', filtros.tema);
    if (filtros.subtema) consulta = consulta.eq('subtema', filtros.subtema);
    return consulta;
}

async function carregarMetadadosTemasLoja() {
    let metadados = lerCacheTemasLoja();

    if (!metadados?.length) {
        const cliente = obterClienteProdutosLoja();
        metadados = [];
        let inicio = 0;

        while (true) {
            const { data: pagina, error } = await executarComTimeout(
                cliente
                    .from('produtos_loja')
                    .select('tema, subtema')
                    .eq('ativo', true)
                    .eq('arquivado', false)
                    .order('tema', { ascending: true })
                    .order('subtema', { ascending: true })
                    .range(inicio, inicio + TAMANHO_PAGINA_METADADOS - 1),
                20000,
                'Consulta de temas demasiado lenta.'
            );

            if (error) throw error;
            if (!pagina?.length) break;

            metadados.push(...pagina);
            if (pagina.length < TAMANHO_PAGINA_METADADOS) break;
            inicio += TAMANHO_PAGINA_METADADOS;
        }

        guardarCacheTemasLoja(metadados);
    }

    construirMapaTemasLoja(metadados);
    return metadados;
}

function lerCacheTemasLoja() {
    try {
        const bruto = sessionStorage.getItem(CACHE_TEMAS_LOJA_CHAVE);
        if (!bruto) return null;
        const dados = JSON.parse(bruto);
        if (!dados?.guardadoEm || !Array.isArray(dados.metadados)) return null;
        if (Date.now() - dados.guardadoEm > CACHE_TEMAS_LOJA_TTL_MS) return null;
        return dados.metadados;
    } catch (erro) {
        return null;
    }
}

function guardarCacheTemasLoja(metadados) {
    try {
        sessionStorage.setItem(CACHE_TEMAS_LOJA_CHAVE, JSON.stringify({
            guardadoEm: Date.now(),
            metadados
        }));
    } catch (erro) {
        // Ignorar quota ou modo privado.
    }
}

async function carregarPaginaProdutosLoja({ reiniciar = false } = {}) {
    if (promessaCargaProdutosEmCurso) {
        if (reiniciar) reinicioProdutosPendente = true;
        return promessaCargaProdutosEmCurso;
    }

    promessaCargaProdutosEmCurso = (async () => {
        carregandoProdutosRemotos = true;
        atualizarBarraCarregarMaisVitrine();

        try {
            const cliente = obterClienteProdutosLoja();
            const filtros = obterFiltrosVitrineAtuais();
            const offset = reiniciar ? 0 : offsetProdutosRemotos;
            const limite = PRODUTOS_POR_PAGINA_SERVIDOR;
            const consultaBase = aplicarFiltrosQueryProdutos(
                cliente
                    .from('produtos_loja')
                    .select(CAMPOS_PRODUTO_LOJA, { count: 'exact' })
                    .order('tema', { ascending: true })
                    .order('subtema', { ascending: true })
                    .order('nome', { ascending: true })
                    .order('id', { ascending: true }),
                filtros
            );

            const { data: pagina, error, count } = await executarComTimeout(
                consultaBase.range(offset, offset + limite - 1),
                20000,
                'Consulta de produtos demasiado lenta.'
            );

            if (error) throw error;

            const produtosPagina = pagina || [];
            totalProdutosRemotos = Number(count || 0);
            offsetProdutosRemotos = offset + produtosPagina.length;
            haMaisProdutosRemotos = offsetProdutosRemotos < totalProdutosRemotos;

            mesclarProdutosNoCatalogoLocal(produtosPagina);

            if (reiniciar) {
                produtosFiltradosAtual = produtosPagina;
                produtosVitrineAtual = produtosPagina;
                indiceRenderizado = 0;
            } else {
                produtosFiltradosAtual.push(...produtosPagina);
                produtosVitrineAtual = produtosFiltradosAtual;
            }
        } finally {
            carregandoProdutosRemotos = false;
            promessaCargaProdutosEmCurso = null;
            atualizarIndicadoresProgressoVitrine();
        }
    })();

    return promessaCargaProdutosEmCurso;
}

async function carregarProdutosDaNuvem(){
    definirEstadoVitrine('A carregar produtos...');
    try{
        todosOsProdutos = [];
        catalogoAdminCarregado = false;
        offsetProdutosRemotos = 0;
        haMaisProdutosRemotos = false;
        totalProdutosRemotos = 0;

        const metadadosTemas = await carregarMetadadosTemasLoja();
        if (!metadadosTemas.length) {
            definirEstadoVitrine('Nenhum produto encontrado.', 'erro');
            return;
        }

        gerarMenus(metadadosTemas);
        await reiniciarVitrinePaginada();
        atualizarCarrinhoSeDisponivel();
    }catch(erro){
        console.error('Erro ao carregar produtos da loja:', erro);
        definirEstadoVitrine(
            'Não foi possível carregar os produtos. Tenta novamente dentro de momentos.',
            'erro'
        );
    }
}


function gerarMenus(listaProdutos){
    const menu = document.getElementById('menu-lateral-temas');
    if (!menu) return;
    menu.replaceChildren();

    const cabecalho = document.createElement('div');
    cabecalho.className = 'cabecalho-menu-temas';

    const tituloMenu = document.createElement('h2');
    tituloMenu.textContent = 'Temas';
    cabecalho.appendChild(tituloMenu);

    const toggleMenu = document.createElement('button');
    toggleMenu.className = 'btn-toggle-menu';
    toggleMenu.type = 'button';
    toggleMenu.textContent = 'Recolher';
    toggleMenu.onclick = function(){
        const recolhido = listaTemas.classList.toggle('recolhida');
        toggleMenu.textContent = recolhido ? 'Mostrar' : 'Recolher';
        agendarAtualizacaoStickyTemas();
    };
    cabecalho.appendChild(toggleMenu);
    menu.appendChild(cabecalho);

    const listaTemas = document.createElement('div');
    listaTemas.className = 'lista-temas';
    const iniciarRecolhido = window.matchMedia && window.matchMedia('(max-width: 1100px)').matches;
    if (iniciarRecolhido) {
        listaTemas.classList.add('recolhida');
        toggleMenu.textContent = 'Mostrar';
    }
    menu.appendChild(listaTemas);

    const todosBtn = document.createElement('button');
    todosBtn.className = 'btn-tema ativo';
    todosBtn.appendChild(criarRotuloTema('Todos'));
    todosBtn.onclick = function(){ filtrarTema('todos', this); };
    listaTemas.appendChild(todosBtn);

    const mapa = {};
    listaProdutos.forEach(prod => {
        const tema = (prod.tema || 'Outros').trim();
        const subtema = (prod.subtema && prod.subtema !== 'semsubtema') ? prod.subtema.trim() : '';
        if(!mapa[tema]){ mapa[tema] = []; }
        if(subtema && !mapa[tema].includes(subtema)){ mapa[tema].push(subtema); }
    });

    Object.keys(mapa).forEach(tema => {
        const temaId = tema.toLowerCase().replace(/\s+/g, '-');
        const linhaTema = document.createElement('div');
        linhaTema.className = 'linha-tema';

        const btnTema = document.createElement('button');
        btnTema.className = 'btn-tema';

        btnTema.appendChild(criarRotuloTema(tema));

        if(mapa[tema].length > 0){
            btnTema.classList.add('btn-tema-com-subtemas');
            const indicador = document.createElement('span');
            indicador.className = 'indicador-tema';
            indicador.textContent = '+';
            btnTema.appendChild(indicador);

            const group = document.createElement('div');
            group.className = 'grupo-subtemas';
            group.id = 'grupo-' + temaId;

            btnTema.onclick = function(){
                const estavaAberto = group.classList.contains('aberto');
                document.querySelectorAll('.grupo-subtemas').forEach(g => g.classList.remove('aberto'));
                document.querySelectorAll('.indicador-tema').forEach(i => i.textContent = '+');
                if(!estavaAberto){
                    group.classList.add('aberto');
                    indicador.textContent = '-';
                }
                filtrarTema(temaId, this);
                agendarAtualizacaoStickyTemas();
            };

            mapa[tema].forEach(subtema => {
                const subId = subtema.toLowerCase().replace(/\s+/g, '-');
                const btnSub = document.createElement('button');
                btnSub.className = 'btn-subtema';
                btnSub.textContent = subtema;
                btnSub.onclick = function(e){
                    e.stopPropagation();
                    filtrarTema(temaId + '|' + subId, this);
                };
                group.appendChild(btnSub);
            });
            linhaTema.appendChild(btnTema);
            linhaTema.appendChild(group);
        } else {
            btnTema.onclick = function(){ filtrarTema(temaId, this); };
            linhaTema.appendChild(btnTema);
        }

        listaTemas.appendChild(linhaTema);
    });

    observarTamanhoMenuTemas();
    agendarAtualizacaoStickyTemas();
}

function criarIconeCoracaoFavorito() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 21s-7.5-4.6-10-9.2C-0.3 7.5 2.2 3 6.7 3c2.1 0 4 1.2 5.3 3 1.3-1.8 3.2-3 5.3-3 4.5 0 7 4.5 4.7 8.8C19.5 16.4 12 21 12 21z');
    svg.appendChild(path);
    return svg;
}

function criarCardProduto(prod) {
    const card = document.createElement('div');
    card.className = 'produto-card';
    card.dataset.id = prod.id;

    const nomeLimpo = (prod.nome || '').trim().toLowerCase();
    card.dataset.nome = nomeLimpo;
    card.dataset.tema = (prod.tema || '').toLowerCase().replace(/\s+/g, '-');
    card.dataset.subtema = (prod.subtema || '').toLowerCase().replace(/\s+/g, '-');

    let listaImagens = [];
    if (prod.imagens) {
        if (Array.isArray(prod.imagens)) {
            listaImagens = prod.imagens;
        } else if (typeof prod.imagens === 'string') {
            const textoLimpo = prod.imagens.trim();
            if (textoLimpo.startsWith('[') && textoLimpo.endsWith(']')) {
                try {
                    listaImagens = JSON.parse(textoLimpo);
                } catch (e) {
                    listaImagens = textoLimpo.replace(/[\[\]"]/g, '').split(',').map(s => s.trim());
                }
            } else {
                listaImagens = [textoLimpo];
            }
        }
    }

    listaImagens = listaImagens.filter(url => url && typeof url === 'string' && url.trim() !== '');
    const imagemFallback = 'img/sem-imagem.png?v=20260719-sem-texto';
    const imagensOtimizadas = listaImagens.map(url => otimizarImagemCloudinary(url, 520));
    const urlPrincipal = listaImagens[0] || imagemFallback;
    const imagemResponsiva = otimizarImagemCloudinarySrcset(urlPrincipal);
    const imagemInicial = imagemResponsiva.src || imagensOtimizadas[0] || imagemFallback;

    const botaoFavorito = document.createElement('button');
    botaoFavorito.className = 'favorite-btn';
    botaoFavorito.type = 'button';
    botaoFavorito.dataset.favoritoProdutoId = String(prod.id);
    botaoFavorito.appendChild(criarIconeCoracaoFavorito());
    if (typeof produtoEstaNosFavoritos === 'function' && typeof atualizarBotaoFavorito === 'function') {
        atualizarBotaoFavorito(botaoFavorito, produtoEstaNosFavoritos(prod.id));
    }
    botaoFavorito.addEventListener('click', (evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        const alternar = () => {
            if (typeof alternarFavoritoProduto === 'function') {
                alternarFavoritoProduto(prod);
            }
        };
        if (typeof alternarFavoritoProduto === 'function') {
            alternar();
            return;
        }
        if (typeof window.garantirAppFavoritos === 'function') {
            window.garantirAppFavoritos().then(alternar).catch(console.error);
        }
    });
    card.appendChild(botaoFavorito);

    const imagemPrincipal = document.createElement('img');
    imagemPrincipal.className = 'produto-img';
    imagemPrincipal.loading = 'lazy';
    imagemPrincipal.decoding = 'async';
    imagemPrincipal.dataset.srcOriginal = imagemInicial;
    if (imagemResponsiva.srcset) {
        imagemPrincipal.srcset = imagemResponsiva.srcset;
        imagemPrincipal.sizes = imagemResponsiva.sizes;
    }
    imagemPrincipal.addEventListener('load', () => {
        const iniciarPrecarregamento = () => {
            imagensOtimizadas.slice(1).forEach(precarregarImagemProduto);
        };
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciarPrecarregamento, { timeout: 1200 });
        } else {
            setTimeout(iniciarPrecarregamento, 100);
        }
    }, { once: true });
    imagemPrincipal.src = imagemInicial;
    imagemPrincipal.onerror = () => {
        if (imagemPrincipal.src.indexOf(imagemFallback) === -1) {
            imagemPrincipal.src = imagemFallback;
        }
    };

    const galeria = document.createElement('div');
    galeria.className = 'produto-galeria';
    galeria.appendChild(imagemPrincipal);

    if (imagensOtimizadas.length > 1) {
        let imagemAtual = 0;
        let toqueInicioX = 0;
        const totalImagens = imagensOtimizadas.length;
        const indicador = document.createElement('span');
        indicador.className = 'produto-galeria-indicador';

        const atualizarImagem = (proximoIndice) => {
            imagemAtual = (proximoIndice + totalImagens) % totalImagens;
            const proximaUrl = listaImagens[imagemAtual];
            const proximaImagem = imagensOtimizadas[imagemAtual];
            const responsivoNovo = otimizarImagemCloudinarySrcset(proximaUrl);
            imagemPrincipal.dataset.srcOriginal = proximaImagem;
            if (responsivoNovo.srcset) {
                imagemPrincipal.srcset = responsivoNovo.srcset;
                imagemPrincipal.sizes = responsivoNovo.sizes;
                imagemPrincipal.src = responsivoNovo.src;
            } else {
                imagemPrincipal.removeAttribute('srcset');
                imagemPrincipal.removeAttribute('sizes');
                imagemPrincipal.src = proximaImagem;
            }
            indicador.textContent = (imagemAtual + 1) + ' / ' + totalImagens;
            precarregarImagemProduto(imagensOtimizadas[(imagemAtual + 1) % totalImagens]);
            precarregarImagemProduto(imagensOtimizadas[(imagemAtual - 1 + totalImagens) % totalImagens]);
        };

        const criarSeta = (classe, texto, direcao) => {
            const botao = document.createElement('button');
            botao.className = 'produto-galeria-seta ' + classe;
            botao.type = 'button';
            botao.textContent = texto;
            botao.setAttribute('aria-label', direcao < 0 ? 'Imagem anterior' : 'Imagem seguinte');
            const ativarSeta = (evento) => {
                evento.preventDefault();
                evento.stopPropagation();
                atualizarImagem(imagemAtual + direcao);
            };
            botao.addEventListener('pointerdown', evento => evento.stopPropagation());
            botao.addEventListener('click', ativarSeta);
            return botao;
        };

        galeria.appendChild(criarSeta('produto-galeria-seta-anterior', '<', -1));
        galeria.appendChild(criarSeta('produto-galeria-seta-seguinte', '>', 1));
        galeria.appendChild(indicador);
        indicador.textContent = '1 / ' + totalImagens;

        galeria.addEventListener('pointerdown', evento => {
            if (evento.target.closest('.produto-galeria-seta')) return;
            toqueInicioX = evento.clientX;
        });
        galeria.addEventListener('pointerup', evento => {
            if (evento.target.closest('.produto-galeria-seta')) return;
            const deltaX = evento.clientX - toqueInicioX;
            if (Math.abs(deltaX) < 40) return;
            atualizarImagem(imagemAtual + (deltaX < 0 ? 1 : -1));
        });
    }

    card.appendChild(galeria);

    const titulo = document.createElement('h3');
    titulo.innerText = prod.nome || '';
    card.appendChild(titulo);

    const category = document.createElement('div');
    category.className = 'categoria';
    category.innerText = prod.tema || 'Outros';
    card.appendChild(category);

    if (prod.subtema && prod.subtema !== 'semsubtema') {
        const subcategoria = document.createElement('div');
        subcategoria.className = 'subcategoria';
        subcategoria.innerText = prod.subtema;
        card.appendChild(subcategoria);
    }

    const preco = document.createElement('div');
    preco.className = 'preco';
    preco.innerText = formatarEuro(prod.preco) + ' €';
    card.appendChild(preco);

    const btn = document.createElement('button');
    btn.className = 'btn-adicionar';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Adicionar ao carrinho');
    const textoAdicionar = document.createElement('span');
    textoAdicionar.textContent = 'Adicionar';
    const iconeCarrinho = document.createElement('span');
    iconeCarrinho.className = 'icone-carrinho';
    iconeCarrinho.setAttribute('aria-hidden', 'true');
    btn.append(textoAdicionar, iconeCarrinho);
    btn.onclick = function () { adicionarAoCarrinho(prod); };
    card.appendChild(btn);

    return card;
}

function gerarProdutos(listaProdutos) {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;
    produtosVitrineAtual = listaProdutos;
    produtosFiltradosAtual = listaProdutos;
    indiceRenderizado = 0;
    totalProdutosRemotos = listaProdutos.length;
    offsetProdutosRemotos = listaProdutos.length;
    haMaisProdutosRemotos = false;
    mesclarProdutosNoCatalogoLocal(listaProdutos);
    removerSentinelaCarregarMais();
    vitrine.replaceChildren();
    renderizarMaisProdutosVitrine();
    atualizarContadorProdutos(listaProdutos.length, listaProdutos.length, false);
}

function removerSentinelaCarregarMais() {
    if (observadorCarregarMais) {
        observadorCarregarMais.disconnect();
        observadorCarregarMais = null;
    }
    if (sentinelaCarregarMais) {
        sentinelaCarregarMais.remove();
        sentinelaCarregarMais = null;
    }
}

function obterPesquisaAtivaVitrine() {
    const campoPesquisa = document.getElementById('campo-pesquisa');
    const inputRaw = campoPesquisa?.value || '';
    const textoPesquisa = inputRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return textoPesquisa.length > 0 || filtroTemaAtual !== 'todos';
}

function atualizarIndicadoresProgressoVitrine() {
    atualizarBarraCarregarMaisVitrine();
}

function atualizarBarraCarregarMaisVitrine() {
    if (!sentinelaCarregarMais) return;
    const aindaHaMais = indiceRenderizado < produtosFiltradosAtual.length || haMaisProdutosRemotos;
    if (!aindaHaMais) {
        removerSentinelaCarregarMais();
        return;
    }

    sentinelaCarregarMais.classList.toggle('esta-carregando', Boolean(carregandoProdutosRemotos));
    const texto = sentinelaCarregarMais.querySelector('.vitrine-carregar-mais-texto');
    const detalhe = sentinelaCarregarMais.querySelector('.vitrine-carregar-mais-detalhe');
    if (texto) {
        texto.textContent = carregandoProdutosRemotos
            ? 'A carregar mais produtos…'
            : 'Há mais produtos abaixo';
    }
    if (detalhe) {
        const total = Math.max(totalProdutosRemotos, produtosFiltradosAtual.length);
        detalhe.textContent = total > 0
            ? `A mostrar ${indiceRenderizado.toLocaleString('pt-PT')} de ${total.toLocaleString('pt-PT')}`
            : '';
        detalhe.hidden = total <= 0;
    }
}

function criarBarraCarregarMaisVitrine() {
    const barra = document.createElement('div');
    barra.className = 'vitrine-carregar-mais';
    barra.setAttribute('role', 'status');
    barra.setAttribute('aria-live', 'polite');

    const texto = document.createElement('p');
    texto.className = 'vitrine-carregar-mais-texto';
    const detalhe = document.createElement('p');
    detalhe.className = 'vitrine-carregar-mais-detalhe';
    barra.append(texto, detalhe);
    return barra;
}

function agendarPrefetchProdutosLoja() {
    if (!haMaisProdutosRemotos || carregandoProdutosRemotos) return;
    const porRenderizar = produtosFiltradosAtual.length - indiceRenderizado;
    if (porRenderizar >= PRODUTOS_POR_LOTE * 2) return;

    carregarPaginaProdutosLoja()
        .then(() => {
            atualizarIndicadoresProgressoVitrine();
            agendarPrefetchProdutosLoja();
        })
        .catch((erro) => {
            console.error('Erro ao pré-carregar produtos:', erro);
            atualizarIndicadoresProgressoVitrine();
        });
}

function renderizarMaisProdutosVitrine() {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;

    const renderizar = async () => {
        removerSentinelaCarregarMais();

        if (indiceRenderizado >= produtosFiltradosAtual.length && haMaisProdutosRemotos && !carregandoProdutosRemotos) {
            await carregarPaginaProdutosLoja();
        }

        const fim = Math.min(indiceRenderizado + PRODUTOS_POR_LOTE, produtosFiltradosAtual.length);
        for (let i = indiceRenderizado; i < fim; i++) {
            vitrine.appendChild(criarCardProduto(produtosFiltradosAtual[i]));
        }
        indiceRenderizado = fim;
        atualizarBotoesFavoritos();
        atualizarIndicadoresProgressoVitrine();

        if (indiceRenderizado < produtosFiltradosAtual.length || haMaisProdutosRemotos) {
            sentinelaCarregarMais = criarBarraCarregarMaisVitrine();
            atualizarBarraCarregarMaisVitrine();
            vitrine.appendChild(sentinelaCarregarMais);
            observadorCarregarMais = new IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    renderizarMaisProdutosVitrine();
                }
            }, { rootMargin: '700px' });
            observadorCarregarMais.observe(sentinelaCarregarMais);
            agendarPrefetchProdutosLoja();
        }
    };

    renderizar().catch(erro => {
        console.error('Erro ao renderizar produtos:', erro);
        atualizarIndicadoresProgressoVitrine();
    });
}

async function reiniciarVitrinePaginada() {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;

    removerSentinelaCarregarMais();
    vitrine.replaceChildren();

    const campoPesquisa = document.getElementById('campo-pesquisa');
    const inputRaw = campoPesquisa?.value || '';
    const textoPesquisa = inputRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const pesquisaAtiva = textoPesquisa.length > 0;

    await carregarPaginaProdutosLoja({ reiniciar: true });

    while (reinicioProdutosPendente) {
        reinicioProdutosPendente = false;
        await carregarPaginaProdutosLoja({ reiniciar: true });
    }

    if (produtosFiltradosAtual.length === 0) {
        const erroDiv = document.createElement('div');
        erroDiv.id = 'aviso-pesquisa-vazia';
        erroDiv.className = 'estado-vitrine erro';

        const figura = document.createElement('img');
        figura.className = 'estado-vitrine-figura';
        figura.src = 'img/sem-imagem.png?v=20260719-sem-texto';
        figura.alt = '';
        figura.width = 120;
        figura.height = 120;
        figura.decoding = 'async';

        const texto = document.createElement('p');
        texto.className = 'estado-vitrine-texto';
        texto.textContent = pesquisaAtiva || filtroTemaAtual !== 'todos'
            ? 'Nenhuma minifigura encontrada com esse filtro.'
            : 'Nenhum produto encontrado.';

        erroDiv.append(figura, texto);
        vitrine.appendChild(erroDiv);
    } else {
        renderizarMaisProdutosVitrine();
    }

    atualizarContadorProdutos(
        indiceRenderizado,
        totalProdutosRemotos,
        pesquisaAtiva || filtroTemaAtual !== 'todos'
    );
}


function recolherMenuTemasNoTelemovel() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 1100px)').matches) return;

    const listaTemas = document.querySelector('#menu-lateral-temas .lista-temas');
    const botaoToggle = document.querySelector('#menu-lateral-temas .btn-toggle-menu');
    if (!listaTemas) return;

    listaTemas.classList.add('recolhida');
    if (botaoToggle) botaoToggle.textContent = 'Mostrar';
    agendarAtualizacaoStickyTemas();
}

function rolarParaPrimeiraLinhaProdutos() {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;

    const header = document.querySelector('header');
    const margem = 16;
    const headerAltura = header ? header.getBoundingClientRect().height : 0;
    const destino = vitrine.getBoundingClientRect().top + window.scrollY - headerAltura - margem;
    const reduzirMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
        top: Math.max(0, destino),
        behavior: reduzirMovimento ? 'auto' : 'smooth'
    });
}

function filtrarTema(filtro, botao){
    document.querySelectorAll('.btn-tema, .btn-subtema').forEach(btn => { btn.classList.remove('ativo'); });
    botao.classList.add('ativo');

    filtroTemaAtual = filtro;

    if(filtro === 'todos'){
        document.querySelectorAll('.grupo-subtemas').forEach(g => { g.classList.remove('aberto'); });
        document.querySelectorAll('.indicador-tema').forEach(i => { i.textContent = '+'; });
    } else {
        const partes = filtro.split('|');
        const tema = partes[0];
        document.querySelectorAll('.grupo-subtemas').forEach(g => { if(g.id !== 'grupo-' + tema){ g.classList.remove('aberto'); } });
        document.querySelectorAll('.indicador-tema').forEach(i => {
            const linha = i.closest('.linha-tema');
            const grupo = linha ? linha.querySelector('.grupo-subtemas') : null;
            i.textContent = grupo && grupo.classList.contains('aberto') ? '-' : '+';
        });
        const grupoAlvo = document.getElementById('grupo-' + tema);
        if(grupoAlvo && partes.length === 1){ grupoAlvo.classList.add('aberto'); }
    }

    recolherMenuTemasNoTelemovel();
    executarFiltrosCombinados({ rolarParaProdutos: true });
}

function verificarTeclaEnter(evento) {
    if (evento.key === "Enter") {
        evento.preventDefault();
        if (obterVistaPagina() !== 'loja') {
            const pesquisa = document.getElementById('campo-pesquisa')?.value.trim() || '';
            window.location.href = 'index.html' + (pesquisa ? '?q=' + encodeURIComponent(pesquisa) : '');
            return;
        }
        executarFiltrosCombinados();
    }
}

function atualizarContadorProdutos(totalVisiveis, totalProdutos, pesquisaAtiva) {
    const contador = document.getElementById('contador-produtos');
    if(!contador) return;

    const mostrados = Math.max(0, Number(totalVisiveis || 0));
    const total = Math.max(mostrados, Number(totalProdutos || 0));
    const incompleto = mostrados < total || haMaisProdutosRemotos || carregandoProdutosRemotos;

    contador.replaceChildren();
    const destaque = document.createElement('strong');

    if (incompleto && total > 0) {
        destaque.textContent = `${mostrados.toLocaleString('pt-PT')} de ${total.toLocaleString('pt-PT')}`;
        const legenda = carregandoProdutosRemotos
            ? 'produtos · a carregar mais…'
            : (pesquisaAtiva
                ? 'produtos · há mais abaixo'
                : 'produtos na loja · há mais abaixo');
        contador.append(destaque, document.createTextNode(' ' + legenda));
        return;
    }

    const numero = pesquisaAtiva || filtroTemaAtual !== 'todos' ? mostrados : total;
    const legenda = pesquisaAtiva
        ? (numero === 1 ? 'produto encontrado' : 'produtos encontrados')
        : filtroTemaAtual !== 'todos'
            ? (numero === 1 ? 'produto neste filtro' : 'produtos neste filtro')
            : (numero === 1 ? 'produto na loja' : 'produtos na loja');

    destaque.textContent = Number(numero || 0).toLocaleString('pt-PT');
    contador.append(destaque, document.createTextNode(' ' + legenda));
}

function executarFiltrosCombinados(opcoes = {}) {
    if (!document.getElementById('campo-pesquisa')) return Promise.resolve();

    return reiniciarVitrinePaginada()
        .then(() => {
            if (!opcoes.rolarParaProdutos) return;
            requestAnimationFrame(() => {
                rolarParaPrimeiraLinhaProdutos();
            });
        })
        .catch(erro => {
            console.error('Erro ao aplicar filtros:', erro);
        });
}
