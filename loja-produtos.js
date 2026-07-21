// Codigo da montra de produtos e filtros da loja.
// Separado de app.js para carregar apenas nas paginas que mostram catalogo.

const PRODUTOS_POR_LOTE = 48;
const PRODUTOS_POR_PAGINA_SERVIDOR = 48;
const TAMANHO_PAGINA_METADADOS = 1000;
const CACHE_TEMAS_LOJA_CHAVE = 'figures-planet-loja-temas-v2';
const CACHE_TEMAS_LOJA_TTL_MS = 30 * 60 * 1000;
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
let promessaCargaProdutosEmCurso = null;
let reinicioProdutosPendente = false;
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
    const pesquisaAtiva = obterPesquisaAtivaVitrine();
    atualizarContadorProdutos(
        indiceRenderizado,
        totalProdutosRemotos,
        pesquisaAtiva
    );
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
            ? 'A carregar mais figuras…'
            : 'Há mais figuras abaixo';
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
