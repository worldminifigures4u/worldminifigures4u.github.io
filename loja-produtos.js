// Codigo da montra de produtos e filtros da loja.
// Separado de app.js para carregar apenas nas paginas que mostram catalogo.

const PRODUTOS_POR_LOTE = 48;
const PRODUTOS_POR_PAGINA_SERVIDOR = 48;
const TAMANHO_PAGINA_METADADOS = 1000;
const CAMPOS_PRODUTO_LOJA = 'id, sku, nome, preco, peso, tema, subtema, imagens, ativo, descontinuado';

let produtosVitrineAtual = [];
let produtosFiltradosAtual = [];
let indiceRenderizado = 0;
let sentinelaCarregarMais = null;
let observadorCarregarMais = null;
let totalProdutosRemotos = 0;
let offsetProdutosRemotos = 0;
let haMaisProdutosRemotos = false;
let carregandoProdutosRemotos = false;
const mapaTemasLoja = new Map();

function slugificarTemaLoja(texto) {
    return String(texto || '').toLowerCase().replace(/\s+/g, '-');
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
    const cliente = obterClienteProdutosLoja();
    const metadados = [];
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

    return construirMapaTemasLoja(metadados);
}

async function carregarPaginaProdutosLoja({ reiniciar = false } = {}) {
    if (carregandoProdutosRemotos) return;
    carregandoProdutosRemotos = true;

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
    }
}

async function carregarProdutosDaNuvem(){
    definirEstadoVitrine('A carregar minifiguras extraordinárias...');
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
        console.error(erro);
        definirEstadoVitrine('Erro ao carregar produtos do Supabase: ' + (erro.message || 'sem detalhe disponível'), 'erro');
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
    const iniciarRecolhido = window.matchMedia && window.matchMedia('(max-width: 560px)').matches;
    if (iniciarRecolhido) {
        listaTemas.classList.add('recolhida');
        toggleMenu.textContent = 'Mostrar';
    }
    menu.appendChild(listaTemas);

    const todosBtn = document.createElement('button');
    todosBtn.className = 'btn-tema ativo';
    todosBtn.textContent = 'Todos os Temas';
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

        const nomeTema = document.createElement('span');
        nomeTema.textContent = tema;
        btnTema.appendChild(nomeTema);

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
    const imagemFallback = 'img/sem-imagem.png';
    const imagensOtimizadas = listaImagens.map(url => otimizarImagemCloudinary(url, 520));
    const imagemInicial = imagensOtimizadas[0] || imagemFallback;

    const botaoFavorito = document.createElement('button');
    botaoFavorito.className = 'favorite-btn';
    botaoFavorito.type = 'button';
    botaoFavorito.dataset.favoritoProdutoId = String(prod.id);
    botaoFavorito.appendChild(criarIconeCoracaoFavorito());
    atualizarBotaoFavorito(botaoFavorito, produtoEstaNosFavoritos(prod.id));
    botaoFavorito.addEventListener('click', evento => {
        evento.preventDefault();
        evento.stopPropagation();
        alternarFavoritoProduto(prod);
    });
    card.appendChild(botaoFavorito);

    const imagemPrincipal = document.createElement('img');
    imagemPrincipal.className = 'produto-img';
    imagemPrincipal.loading = 'lazy';
    imagemPrincipal.decoding = 'async';
    imagemPrincipal.dataset.srcOriginal = imagemInicial;
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
            const proximaImagem = imagensOtimizadas[imagemAtual];
            imagemPrincipal.dataset.srcOriginal = proximaImagem;
            imagemPrincipal.src = proximaImagem;
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
            botao.addEventListener('click', evento => {
                evento.preventDefault();
                evento.stopPropagation();
                atualizarImagem(imagemAtual + direcao);
            });
            return botao;
        };

        galeria.appendChild(criarSeta('produto-galeria-seta-anterior', '<', -1));
        galeria.appendChild(criarSeta('produto-galeria-seta-seguinte', '>', 1));
        galeria.appendChild(indicador);
        indicador.textContent = '1 / ' + totalImagens;

        galeria.addEventListener('pointerdown', evento => { toqueInicioX = evento.clientX; });
        galeria.addEventListener('pointerup', evento => {
            const deltaX = evento.clientX - toqueInicioX;
            if (Math.abs(deltaX) < 40) return;
            atualizarImagem(imagemAtual + (deltaX < 0 ? 1 : -1));
        });
    }

    card.appendChild(galeria);

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

    const titulo = document.createElement('h3');
    titulo.innerText = prod.nome || '';
    card.appendChild(titulo);

    const preco = document.createElement('div');
    preco.className = 'preco';
    preco.innerText = formatarEuro(prod.preco) + ' €';
    card.appendChild(preco);

    const btn = document.createElement('button');
    btn.className = 'btn-adicionar';
    btn.innerText = 'Adicionar ao Carrinho';
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

        if (indiceRenderizado < produtosFiltradosAtual.length || haMaisProdutosRemotos) {
            sentinelaCarregarMais = document.createElement('div');
            sentinelaCarregarMais.className = 'vitrine-sentinel';
            sentinelaCarregarMais.setAttribute('aria-hidden', 'true');
            if (carregandoProdutosRemotos) {
                sentinelaCarregarMais.classList.add('vitrine-sentinel-carregando');
            }
            vitrine.appendChild(sentinelaCarregarMais);
            observadorCarregarMais = new IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    renderizarMaisProdutosVitrine();
                }
            }, { rootMargin: '500px' });
            observadorCarregarMais.observe(sentinelaCarregarMais);
        }
    };

    renderizar().catch(erro => {
        console.error('Erro ao renderizar produtos:', erro);
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

    if (produtosFiltradosAtual.length === 0) {
        const erroDiv = document.createElement('div');
        erroDiv.id = 'aviso-pesquisa-vazia';
        erroDiv.className = 'estado-vitrine erro';
        erroDiv.innerText = pesquisaAtiva || filtroTemaAtual !== 'todos'
            ? 'Nenhuma minifigura encontrada com esse filtro.'
            : 'Nenhum produto encontrado.';
        vitrine.appendChild(erroDiv);
    } else {
        renderizarMaisProdutosVitrine();
    }

    atualizarContadorProdutos(
        totalProdutosRemotos,
        totalProdutosRemotos,
        pesquisaAtiva || filtroTemaAtual !== 'todos'
    );
}


function recolherMenuTemasNoTelemovel() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 560px)').matches) return;

    const listaTemas = document.querySelector('#menu-lateral-temas .lista-temas');
    const botaoToggle = document.querySelector('#menu-lateral-temas .btn-toggle-menu');
    if (!listaTemas) return;

    listaTemas.classList.add('recolhida');
    if (botaoToggle) botaoToggle.textContent = 'Mostrar';
    agendarAtualizacaoStickyTemas();
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

    executarFiltrosCombinados();
    recolherMenuTemasNoTelemovel();
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

    const numero = pesquisaAtiva || filtroTemaAtual !== 'todos' ? totalVisiveis : totalProdutos;
    const legenda = pesquisaAtiva
        ? (numero === 1 ? 'produto encontrado' : 'produtos encontrados')
        : filtroTemaAtual !== 'todos'
            ? (numero === 1 ? 'produto neste filtro' : 'produtos neste filtro')
            : (numero === 1 ? 'produto na loja' : 'produtos na loja');

    contador.replaceChildren();
    const destaque = document.createElement('strong');
    destaque.textContent = Number(numero || 0).toLocaleString('pt-PT');
    contador.append(destaque, document.createTextNode(' ' + legenda));
}

function executarFiltrosCombinados() {
    if (!document.getElementById('campo-pesquisa')) return;
    reiniciarVitrinePaginada().catch(erro => {
        console.error('Erro ao aplicar filtros:', erro);
    });
}
