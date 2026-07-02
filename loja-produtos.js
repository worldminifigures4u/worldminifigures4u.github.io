// Codigo da montra de produtos e filtros da loja.
// Separado de app.js para carregar apenas nas paginas que mostram catalogo.

async function carregarProdutosDaNuvem(){
    definirEstadoVitrine('A carregar minifiguras extraordinárias...');
    try{
        const clienteProdutos = produtosClient || dbClient;
        if(!clienteProdutos){
            throw new Error('Cliente Supabase indisponível.');
        }

        const listaProdutos = [];
        const tamanhoPagina = 500;
        let inicio = 0;

        while(true) {
            const query = clienteProdutos
                .from('produtos_loja')
                .select('id, sku, nome, preco, peso, tema, subtema, imagens, ativo, descontinuado')
                .order('tema', { ascending:true })
                .order('subtema', { ascending:true })
                .order('nome', { ascending:true })
                .order('id', { ascending:true })
                .range(inicio, inicio + tamanhoPagina - 1);

            const { data: pagina, error } = await executarComTimeout(
                query,
                20000,
                'Consulta de produtos demasiado lenta.'
            );

            if(error){ console.error(error); throw error; }
            if(!pagina || pagina.length === 0) break;

            listaProdutos.push(...pagina);
            if(pagina.length < tamanhoPagina) break;
            inicio += tamanhoPagina;
        }

        if(!listaProdutos || listaProdutos.length === 0){
            definirEstadoVitrine('Nenhum produto encontrado.', 'erro');
            return;
        }

        todosOsProdutos = listaProdutos;
        catalogoAdminCarregado = false;
        const produtosVisiveis = listaProdutos.filter(produto => produto.ativo !== false);
        gerarMenus(produtosVisiveis);
        gerarProdutos(produtosVisiveis);
        atualizarCarrinho();
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

function gerarProdutos(listaProdutos){
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;
    vitrine.replaceChildren();

    listaProdutos.forEach(prod => {
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
                    } catch(e) {
                        listaImagens = textoLimpo.replace(/[\[\]"]/g, '').split(',').map(s => s.trim());
                    }
                } else {
                    listaImagens = [textoLimpo];
                }
            }
        }

        listaImagens = listaImagens.filter(url => url && typeof url === 'string' && url.trim() !== "");
        const imagemFallback = 'img/sem-imagem.png';
        const imagensOtimizadas = listaImagens.map(url => otimizarImagemCloudinary(url, 520));
        const imagemInicial = imagensOtimizadas[0] || imagemFallback;

        const botaoFavorito = document.createElement('button');
        botaoFavorito.className = 'btn-favorito-produto';
        botaoFavorito.type = 'button';
        botaoFavorito.dataset.favoritoProdutoId = String(prod.id);
        botaoFavorito.textContent = '♥';
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
        }, { once:true });
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

                const seguinte = imagensOtimizadas[(imagemAtual + 1) % totalImagens];
                const anterior = imagensOtimizadas[(imagemAtual - 1 + totalImagens) % totalImagens];
                precarregarImagemProduto(seguinte);
                precarregarImagemProduto(anterior);
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

            galeria.addEventListener('pointerdown', evento => {
                toqueInicioX = evento.clientX;
            });
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

        if(prod.subtema && prod.subtema !== 'semsubtema'){
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
        btn.onclick = function(){ adicionarAoCarrinho(prod); };
        card.appendChild(btn);

        vitrine.appendChild(card);
    });

    executarFiltrosCombinados();
    atualizarBotoesFavoritos();
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
    const campoPesquisa = document.getElementById('campo-pesquisa');
    if (!campoPesquisa) return;
    const inputRaw = campoPesquisa.value || '';
    // Normaliza acentos e remove caracteres especiais
    const textoPesquisa = inputRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const pesquisaAtiva = textoPesquisa.length > 0;
    
    const todosOsCards = document.querySelectorAll('.produto-card');
    let totalVisiveis = 0;

    const partesTema = filtroTemaAtual.split('|');
    const temaAtivo = partesTema[0];
    const subtemaAtivo = partesTema[1] || null;

    todosOsCards.forEach(card => {
        let correspondeAoTema = false;
        if (pesquisaAtiva || filtroTemaAtual === 'todos') {
            correspondeAoTema = true;
        } else {
            const cardTema = card.dataset.tema || '';
            const cardSubtema = card.dataset.subtema || '';
            correspondeAoTema = subtemaAtivo 
                ? (cardTema === temaAtivo && cardSubtema === subtemaAtivo) 
                : (cardTema === temaAtivo);
        }

        const nomeCardBruto = card.dataset.nome || '';
        const nomeCardNormalizado = nomeCardBruto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const correspondeAoNome = nomeCardNormalizado.includes(textoPesquisa);

        const imagem = card.querySelector('.produto-img');

        if (correspondeAoTema && correspondeAoNome) {
            card.classList.remove('oculto');
            if(imagem && imagem.dataset.srcOriginal && !imagem.src) {
                imagem.src = imagem.dataset.srcOriginal;
            }
            totalVisiveis++;
        } else {
            card.classList.add('oculto');
            if(imagem) {
                imagem.removeAttribute('src');
            }
        }
    });

    const avisoExistente = document.getElementById('aviso-pesquisa-vazia');
    if (avisoExistente) avisoExistente.remove();

    atualizarContadorProdutos(totalVisiveis, todosOsCards.length, pesquisaAtiva);

    if (totalVisiveis === 0 && todosOsCards.length > 0) {
        const vitrine = document.getElementById('vitrine-produtos');
        const erroDiv = document.createElement('div');
        erroDiv.id = 'aviso-pesquisa-vazia';
        erroDiv.className = 'estado-vitrine erro';
        erroDiv.innerText = 'Nenhuma minifigura encontrada com esse nome.';
        vitrine.appendChild(erroDiv);
    }
}
