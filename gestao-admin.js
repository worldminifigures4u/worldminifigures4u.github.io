// Codigo de gestao/edicao de produtos.
// Separado de app.js para as paginas publicas nao carregarem este bloco.

const ADMIN_UPLOAD_IMAGEM_MAX_BYTES = 8 * 1024 * 1024;
const ADMIN_UPLOAD_IMAGEM_TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sugerirSkuAdmin() {
    const nomeInput = document.getElementById('admin-produto-nome');
    const skuInput = document.getElementById('admin-produto-sku');
    if(!nomeInput || !skuInput) return;

    const nome = nomeInput.value.trim();
    if(!nome) {
        skuInput.value = '';
        return;
    }

    skuInput.value = gerarSkuProduto(nome);
}

function obterUrlsImagensAdmin() {
    const textarea = document.getElementById('admin-produto-imagens');
    if(!textarea) return [];
    return textarea.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(url => url.length > 0);
}

function reordenarUrlsImagensAdmin(textareaId, origem, destino, atualizarPreview) {
    const textarea = document.getElementById(textareaId);
    if(!textarea || origem === destino || origem < 0 || destino < 0) return;

    const urls = textarea.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(Boolean);

    if(origem >= urls.length || destino >= urls.length) return;
    const [urlMovido] = urls.splice(origem, 1);
    urls.splice(destino, 0, urlMovido);
    textarea.value = urls.join('\n');
    atualizarPreview();
}

function criarPreviewOrdenavelImagens(preview, urls, textareaId, atualizarPreview) {
    preview.replaceChildren();

    urls.slice(0, 12).forEach((url, index) => {
        const item = document.createElement('div');
        item.className = 'item-preview-imagem-admin';
        item.draggable = true;
        item.dataset.indiceImagem = String(index);
        item.title = 'Arraste para alterar a ordem';

        const imagem = document.createElement('img');
        imagem.src = otimizarImagemCloudinary(url, 240);
        imagem.alt = 'Imagem ' + (index + 1);
        imagem.loading = 'lazy';
        imagem.onerror = () => { item.classList.add('oculto'); };
        item.appendChild(imagem);

        if(index === 0) {
            const etiqueta = document.createElement('span');
            etiqueta.className = 'etiqueta-imagem-principal';
            etiqueta.textContent = 'Principal';
            item.appendChild(etiqueta);
        }

        item.addEventListener('dragstart', event => {
            item.classList.add('arrastando');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
        });
        item.addEventListener('dragend', () => {
            preview.querySelectorAll('.item-preview-imagem-admin').forEach(elemento => {
                elemento.classList.remove('arrastando', 'destino-arrasto');
            });
        });
        item.addEventListener('dragover', event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            preview.querySelectorAll('.destino-arrasto').forEach(elemento => elemento.classList.remove('destino-arrasto'));
            item.classList.add('destino-arrasto');
        });
        item.addEventListener('drop', event => {
            event.preventDefault();
            const origem = Number(event.dataTransfer.getData('text/plain'));
            reordenarUrlsImagensAdmin(textareaId, origem, index, atualizarPreview);
        });

        item.addEventListener('pointerdown', event => {
            if(event.pointerType === 'mouse') return;
            item.setPointerCapture(event.pointerId);
            item.dataset.indiceDestino = String(index);
            item.classList.add('arrastando');
        });
        item.addEventListener('pointermove', event => {
            if(event.pointerType === 'mouse' || !item.hasPointerCapture(event.pointerId)) return;
            const destino = document.elementFromPoint(event.clientX, event.clientY)?.closest('.item-preview-imagem-admin');
            preview.querySelectorAll('.destino-arrasto').forEach(elemento => elemento.classList.remove('destino-arrasto'));
            if(destino && destino.parentElement === preview) {
                destino.classList.add('destino-arrasto');
                item.dataset.indiceDestino = destino.dataset.indiceImagem;
            }
        });
        const terminarArrastoToque = event => {
            if(event.pointerType === 'mouse') return;
            const destino = Number(item.dataset.indiceDestino ?? index);
            item.classList.remove('arrastando');
            preview.querySelectorAll('.destino-arrasto').forEach(elemento => elemento.classList.remove('destino-arrasto'));
            reordenarUrlsImagensAdmin(textareaId, index, destino, atualizarPreview);
        };
        item.addEventListener('pointerup', terminarArrastoToque);
        item.addEventListener('pointercancel', terminarArrastoToque);

        preview.appendChild(item);
    });
}

function atualizarPreviewImagensAdmin() {
    const preview = document.getElementById('preview-imagens-admin');
    if(!preview) return;
    criarPreviewOrdenavelImagens(preview, obterUrlsImagensAdmin(), 'admin-produto-imagens', atualizarPreviewImagensAdmin);
}

function adicionarUrlsAoCampoImagens(textareaId, urls) {
    const textarea = document.getElementById(textareaId);
    if(!textarea || !urls.length) return;

    const atuais = textarea.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(Boolean);
    const todas = [...atuais];

    urls.forEach(url => {
        if(!todas.includes(url)) {
            todas.push(url);
        }
    });

    textarea.value = todas.join('\n');
}

async function obterAssinaturaCloudinaryAdmin() {
    const { data: { session }, error: sessionError } = await dbClient.auth.getSession();
    if(sessionError || !session?.access_token) {
        throw new Error('Sessão de administrador obrigatória para enviar fotos.');
    }

    const resposta = await fetch(`${SUPABASE_URL}/functions/v1/cloudinary-sign-upload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({ origem: 'gestao-produtos' })
    });
    const dados = await resposta.json().catch(() => ({}));

    if(!resposta.ok) {
        throw new Error(dados?.error || 'Não foi possível obter assinatura segura do Cloudinary.');
    }

    if(!dados?.cloudName || !dados?.apiKey || !dados?.timestamp || !dados?.signature) {
        throw new Error('Assinatura Cloudinary incompleta.');
    }

    return dados;
}

async function enviarFicheiroCloudinaryAssinadoAdmin(ficheiro) {
    const assinatura = await obterAssinaturaCloudinaryAdmin();
    const formData = new FormData();
    formData.append('file', ficheiro);
    formData.append('api_key', assinatura.apiKey);
    formData.append('timestamp', String(assinatura.timestamp));
    formData.append('signature', assinatura.signature);
    if(assinatura.folder) {
        formData.append('folder', assinatura.folder);
    }
    if(assinatura.eager) {
        formData.append('eager', assinatura.eager);
    }

    const resposta = await fetch(`https://api.cloudinary.com/v1_1/${assinatura.cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    });
    const resultado = await resposta.json().catch(() => ({}));

    if(!resposta.ok) {
        throw new Error(resultado?.error?.message || 'Falha no upload assinado para o Cloudinary.');
    }
    if(!resultado?.secure_url) {
        throw new Error('O Cloudinary não devolveu URL seguro da imagem.');
    }

    return resultado.eager?.[0]?.secure_url || resultado.secure_url;
}

async function enviarFotosCloudinaryAdmin(input, textareaId, atualizarPreview, statusId) {
    const status = document.getElementById(statusId);
    const ficheiros = Array.from(input.files || []);
    if(ficheiros.length === 0) return;

    try {
        const { data: { user }, error: authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode enviar fotos.');
        }

        mostrarMensagem(status, `A enviar ${ficheiros.length} foto(s) para o Cloudinary...`);
        const urls = [];

        for(const ficheiro of ficheiros) {
            if(!ADMIN_UPLOAD_IMAGEM_TIPOS_PERMITIDOS.has(ficheiro.type)) {
                throw new Error('Só pode enviar imagens JPG, PNG ou WebP.');
            }
            if(ficheiro.size > ADMIN_UPLOAD_IMAGEM_MAX_BYTES) {
                throw new Error('Cada imagem pode ter no máximo 8 MB.');
            }

            const urlImagem = await enviarFicheiroCloudinaryAssinadoAdmin(ficheiro);
            urls.push(urlImagem);
            mostrarMensagem(status, `Enviadas ${urls.length}/${ficheiros.length} foto(s)...`);
        }

        adicionarUrlsAoCampoImagens(textareaId, urls);
        if(typeof atualizarPreview === 'function') {
            atualizarPreview();
        }
        input.value = '';
        mostrarMensagem(status, `${urls.length} foto(s) adicionada(s) com sucesso.`, 'msg-sucesso');
    } catch(error) {
        console.error('Erro Cloudinary:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível enviar as fotos.'), 'msg-erro');
    }
}
function obterProdutoId(produto) {
    return String(produto?.id ?? produto?.sku ?? '');
}

function produtoCorrespondePesquisaAdmin(produto, termoNormalizado) {
    if(!termoNormalizado) return false;
    const textoProduto = [
        produto.nome,
        produto.referencia,
        produto.sku,
        produto.tema,
        produto.subtema
    ].map(valor => normalizarTextoSku(valor)).join(' ');
    return textoProduto.includes(termoNormalizado);
}

function renderizarListaProdutosAdmin() {
    const lista = document.getElementById('lista-admin-produtos');
    if(!lista) return;

    lista.replaceChildren();
    const termo = normalizarTextoSku(document.getElementById('admin-pesquisa-produtos')?.value || '');
    const produtos = todosOsProdutos
        .filter(produto => produtoCorrespondePesquisaAdmin(produto, termo))
        .slice(0, 40);

    if(produtos.length === 0) {
        const vazio = document.createElement('p');
        vazio.className = 'ajuda-admin';
        vazio.textContent = !termo
            ? 'Pesquise um produto para ver resultados.'
            : (todosOsProdutos.length === 0 ? 'Ainda não há produtos carregados.' : 'Nenhum produto encontrado.');
        lista.appendChild(vazio);
        return;
    }

    produtos.forEach(produto => {
        const item = document.createElement('div');
        item.className = 'item-admin-produto';

        const info = document.createElement('div');
        const nome = document.createElement('strong');
        nome.textContent = produto.nome || 'Produto sem nome';
        info.appendChild(nome);

        const detalhes = document.createElement('span');
        detalhes.className = 'admin-produto-detalhes-linha';
        const estado = produto.ativo === false ? 'Inativo' : 'Ativo';
        detalhes.textContent = `Ref.: ${produto.referencia || '-'} | SKU: ${produto.sku || '-'} | ${formatarEuro(produto.preco)} € | Stock: ${produto.stock ?? '-'} | ${estado}`;
        info.appendChild(detalhes);
        item.appendChild(info);

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn-admin-secundario';
        botao.textContent = 'Editar';
        botao.onclick = () => preencherEdicaoProdutoAdmin(obterProdutoId(produto));
        item.appendChild(botao);

        lista.appendChild(item);
    });
}

function obterUrlsImagensEditarAdmin() {
    const textarea = document.getElementById('admin-editar-imagens');
    if(!textarea) return [];
    return textarea.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(url => url.length > 0);
}

function atualizarPreviewEditarImagensAdmin() {
    const preview = document.getElementById('preview-editar-imagens-admin');
    if(!preview) return;
    criarPreviewOrdenavelImagens(preview, obterUrlsImagensEditarAdmin(), 'admin-editar-imagens', atualizarPreviewEditarImagensAdmin);
}

function imagensParaTextoAdmin(produto) {
    const imagens = Array.isArray(produto?.imagens) ? produto.imagens : [];
    return imagens.filter(url => typeof url === 'string' && url.trim()).join('\n');
}

function obterContainerEncomendasFornecedorProduto() {
    let container = document.getElementById('admin-editar-encomendas-fornecedor');
    const form = document.getElementById('form-admin-editar-produto');
    if(container || !form) return container;

    container = document.createElement('section');
    container.id = 'admin-editar-encomendas-fornecedor';
    container.className = 'admin-produto-encomendas-fornecedor';

    const titulo = document.createElement('h4');
    titulo.textContent = 'Encomendas a fornecedor deste produto';

    const conteudo = document.createElement('div');
    conteudo.className = 'admin-produto-encomendas-fornecedor-conteudo';
    conteudo.textContent = 'Escolha um produto para carregar o histórico.';

    container.append(titulo, conteudo);

    const acoes = form.querySelector('.acoes-form-admin');
    form.insertBefore(container, acoes || document.getElementById('status-admin-editar-produto') || null);
    return container;
}

function definirEncomendasFornecedorProduto(mensagem, tipo = '') {
    const container = obterContainerEncomendasFornecedorProduto();
    const conteudo = container?.querySelector('.admin-produto-encomendas-fornecedor-conteudo');
    if(!conteudo) return;
    conteudo.replaceChildren();
    const aviso = document.createElement('p');
    aviso.className = `ajuda-admin ${tipo}`.trim();
    aviso.textContent = mensagem;
    conteudo.appendChild(aviso);
}

function produtoCorrespondeItemFornecedor(produto, item) {
    if(!produto || !item) return false;
    const produtoId = obterProdutoId(produto);
    const itemId = String(item.id || item.id_produto || '').trim();
    const produtoSku = String(produto.sku || '').trim().toUpperCase();
    const itemSku = String(item.sku || '').trim().toUpperCase();
    const produtoReferencia = String(produto.referencia || '').trim().toUpperCase();
    const itemReferencia = String(item.referencia || '').trim().toUpperCase();

    return Boolean(
        (produtoId && itemId && produtoId === itemId)
        || (produtoSku && itemSku && produtoSku === itemSku)
        || (produtoReferencia && itemReferencia && produtoReferencia === itemReferencia)
    );
}

function obterPrecoCustoFornecedor(item) {
    const candidatos = [
        item?.preco_custo,
        item?.custo,
        item?.preco_compra,
        item?.preco_fornecedor,
        item?.preco
    ];
    const valor = candidatos.find(candidato => candidato !== undefined && candidato !== null && candidato !== '');
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
}

function normalizarPedidoFornecedorProduto(pedido) {
    if(!pedido) return null;
    let itens = pedido.itens;
    if(typeof itens === 'string') {
        try { itens = JSON.parse(itens); }
        catch(_) { itens = []; }
    }
    return {
        codigo: pedido.codigo || '',
        fornecedor: pedido.fornecedor || '',
        referencia: pedido.referencia || '',
        estado: pedido.estado || '',
        criado_em: pedido.criado_em || pedido.data || pedido.created_at || '',
        itens: Array.isArray(itens) ? itens : []
    };
}

function obterEncomendasFornecedorLocaisProduto() {
    try {
        const dados = JSON.parse(localStorage.getItem(FORNECEDORES_STORAGE_KEY) || '[]');
        return Array.isArray(dados) ? dados.map(normalizarPedidoFornecedorProduto).filter(Boolean) : [];
    } catch(_) {
        return [];
    }
}

async function carregarEncomendasFornecedorProduto(produto) {
    if(!produto) return [];
    try {
        if(!dbClient) throw new Error('Supabase indisponível.');
        const { data, error } = await dbClient
            .from('encomendas_fornecedores')
            .select('codigo,fornecedor,referencia,estado,criado_em,itens')
            .order('criado_em', { ascending:false })
            .limit(500);
        if(error) throw error;
        return (data || []).map(normalizarPedidoFornecedorProduto).filter(Boolean);
    } catch(error) {
        console.warn('Não foi possível carregar encomendas a fornecedor do Supabase; a usar cópia local.', error);
        return obterEncomendasFornecedorLocaisProduto();
    }
}

function renderizarEncomendasFornecedorProduto(produto, pedidos) {
    const container = obterContainerEncomendasFornecedorProduto();
    const conteudo = container?.querySelector('.admin-produto-encomendas-fornecedor-conteudo');
    if(!conteudo) return;

    const linhas = [];
    (pedidos || []).forEach(pedido => {
        (pedido.itens || []).forEach(item => {
            if(!produtoCorrespondeItemFornecedor(produto, item)) return;
            linhas.push({ pedido, item });
        });
    });

    conteudo.replaceChildren();
    if(!linhas.length) {
        const vazio = document.createElement('p');
        vazio.className = 'ajuda-admin';
        vazio.textContent = 'Ainda não há encomendas a fornecedor registadas para este produto.';
        conteudo.appendChild(vazio);
        return;
    }

    const tabela = document.createElement('table');
    tabela.className = 'admin-produto-encomendas-fornecedor-tabela';

    const thead = document.createElement('thead');
    const linhaCabecalho = document.createElement('tr');
    ['Data', 'Encomenda fornecedor', 'Fornecedor', 'Qtd.', 'Preço custo', 'Estado'].forEach(rotulo => {
        const th = document.createElement('th');
        th.textContent = rotulo;
        linhaCabecalho.appendChild(th);
    });
    thead.appendChild(linhaCabecalho);

    const tbody = document.createElement('tbody');
    linhas.forEach(({ pedido, item }) => {
        const tr = document.createElement('tr');
        const data = pedido.criado_em ? new Date(pedido.criado_em).toLocaleDateString('pt-PT') : '—';
        const quantidade = Number(item.quantidade_original ?? item.quantidade ?? item.qtd ?? 0) || '—';
        const precoCusto = obterPrecoCustoFornecedor(item);
        [
            data,
            pedido.codigo || pedido.referencia || '—',
            pedido.fornecedor || '—',
            String(quantidade),
            precoCusto === null ? '—' : `${formatarEuro(precoCusto)} €`,
            pedido.estado || '—'
        ].forEach(valor => {
            const td = document.createElement('td');
            td.textContent = valor;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    tabela.append(thead, tbody);
    conteudo.appendChild(tabela);
}

async function atualizarEncomendasFornecedorProduto(produto) {
    const container = obterContainerEncomendasFornecedorProduto();
    if(!container) return;
    container.dataset.produtoId = obterProdutoId(produto);
    definirEncomendasFornecedorProduto('A carregar encomendas a fornecedor...');
    const pedidos = await carregarEncomendasFornecedorProduto(produto);
    if(container.dataset.produtoId !== obterProdutoId(produto)) return;
    renderizarEncomendasFornecedorProduto(produto, pedidos);
}

function preencherEdicaoProdutoAdmin(produtoId) {
    const produto = todosOsProdutos.find(item => obterProdutoId(item) === String(produtoId));
    const form = document.getElementById('form-admin-editar-produto');
    const status = document.getElementById('status-admin-editar-produto');
    if(!produto || !form) return;

    document.getElementById('admin-editar-id').value = obterProdutoId(produto);
    document.getElementById('admin-editar-sku-original').value = produto.sku || '';
    document.getElementById('admin-editar-nome').value = produto.nome || '';
    document.getElementById('admin-editar-referencia').value = produto.referencia || '';
    document.getElementById('admin-editar-sku').value = produto.sku || '';
    document.getElementById('admin-editar-preco').value = Number(produto.preco || 0).toFixed(2);
    document.getElementById('admin-editar-peso').value = Number(produto.peso || PESO_PADRAO_PRODUTO_GRAMAS);
    document.getElementById('admin-editar-stock').value = Number(produto.stock ?? 1);
    document.getElementById('admin-editar-tema').value = produto.tema || '';
    document.getElementById('admin-editar-subtema').value = produto.subtema === 'semsubtema' ? '' : (produto.subtema || '');
    document.getElementById('admin-editar-imagens').value = imagensParaTextoAdmin(produto);
    document.getElementById('admin-editar-observacoes').value = produto.observacoes || '';
    document.getElementById('admin-editar-ativo').checked = produto.ativo !== false;
    const novidadeEditar = document.getElementById('admin-editar-novidade');
    if(novidadeEditar) novidadeEditar.checked = Boolean(produto.novidade);

    if(status) status.textContent = '';
    atualizarPreviewEditarImagensAdmin();
    atualizarEncomendasFornecedorProduto(produto);
    form.classList.remove('oculto');
    form.scrollIntoView({ behavior:'smooth', block:'start' });
}

function cancelarEdicaoProdutoAdmin() {
    const form = document.getElementById('form-admin-editar-produto');
    const status = document.getElementById('status-admin-editar-produto');
    if(!form) return;
    form.reset();
    form.classList.add('oculto');
    if(status) status.textContent = '';
    atualizarPreviewEditarImagensAdmin();
}

function lerProdutoEditadoAdmin() {
    const id = document.getElementById('admin-editar-id').value;
    const skuOriginal = document.getElementById('admin-editar-sku-original').value;
    const nome = document.getElementById('admin-editar-nome').value.trim();
    const referencia = document.getElementById('admin-editar-referencia').value.trim();
    const sku = normalizarTextoSku(document.getElementById('admin-editar-sku').value).replace(/[^A-Z0-9]/g, '');
    const tema = document.getElementById('admin-editar-tema').value.trim();
    const subtema = document.getElementById('admin-editar-subtema').value.trim();
    const preco = Number(document.getElementById('admin-editar-preco').value);
    const peso = Number(document.getElementById('admin-editar-peso').value || PESO_PADRAO_PRODUTO_GRAMAS);
    const stock = Number(document.getElementById('admin-editar-stock').value || 0);
    const observacoes = document.getElementById('admin-editar-observacoes').value.trim();
    const ativo = document.getElementById('admin-editar-ativo').checked;
    const novidade = document.getElementById('admin-editar-novidade')?.checked || false;
    const imagens = obterUrlsImagensEditarAdmin();

    if(!id || !nome || !sku || !tema || !Number.isFinite(preco) || preco < 0 || !Number.isFinite(peso) || peso < 1 || !Number.isInteger(stock) || stock < 0) {
        throw new Error('Preencha nome, SKU, tema, preço, peso e stock.');
    }

    return {
        id,
        skuOriginal,
        produto: {
            sku,
            referencia,
            nome,
            tema,
            subtema: subtema || 'semsubtema',
            preco,
            peso,
            stock,
            observacoes,
            ativo,
            novidade,
            imagens
        }
    };
}

async function guardarEdicaoProdutoAdmin(event) {
    event.preventDefault();
    const status = document.getElementById('status-admin-editar-produto');
    mostrarMensagem(status, 'A guardar alterações...');

    try {
        const { data: { user }, error: authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode editar produtos.');
        }

        const { id, skuOriginal, produto } = lerProdutoEditadoAdmin();
        const skuExistente = todosOsProdutos.some(item => {
            const skuItem = String(item.sku || '').toUpperCase();
            return skuItem !== String(skuOriginal || '').toUpperCase() && skuItem === produto.sku;
        });
        if(skuExistente) {
            throw new Error('Este SKU já existe noutro produto.');
        }

        const { data, error } = await dbClient.rpc('editar_produto_admin_v2', {
            p_id: id,
            p_sku_original: skuOriginal,
            p_produto: produto
        });

        if(error) throw error;
        if(!data || !data.id) {
            throw new Error('Produto não atualizado. Verifique se existe uma policy UPDATE no Supabase para o administrador.');
        }

        const produtoAtualizado = { ...produto, ...data };

        todosOsProdutos = todosOsProdutos.map(item => String(item.sku || '').toUpperCase() === String(skuOriginal || '').toUpperCase() ? produtoAtualizado : item);
        document.getElementById('admin-editar-sku-original').value = produtoAtualizado.sku || produto.sku;
        mostrarMensagem(status, 'Produto atualizado com sucesso.', 'msg-sucesso');
        await carregarProdutosAdminDaNuvem();
        renderizarListaProdutosAdmin();
    } catch(error) {
        console.error('Erro admin:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível guardar o produto.'), 'msg-erro');
    }
}

async function criarProdutoAdmin(event) {
    event.preventDefault();
    const status = document.getElementById('status-admin-produto');
    mostrarMensagem(status, 'A criar produto...');

    try {
        const { data: { user }, error: authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode criar produtos.');
        }

        const nome = document.getElementById('admin-produto-nome').value.trim();
        const referencia = document.getElementById('admin-produto-referencia').value.trim();
        const sku = normalizarTextoSku(document.getElementById('admin-produto-sku').value).replace(/[^A-Z0-9]/g, '');
        const tema = document.getElementById('admin-produto-tema').value.trim();
        const subtema = document.getElementById('admin-produto-subtema').value.trim();
        const preco = Number(document.getElementById('admin-produto-preco').value);
        const peso = Number(document.getElementById('admin-produto-peso').value || PESO_PADRAO_PRODUTO_GRAMAS);
        const stock = Number(document.getElementById('admin-produto-stock').value || 0);
        const observacoes = document.getElementById('admin-produto-observacoes').value.trim();
        const ativo = document.getElementById('admin-produto-ativo').checked;
        const novidade = document.getElementById('admin-produto-novidade')?.checked !== false;
        const imagens = obterUrlsImagensAdmin();

        if(!nome || !sku || !tema || !Number.isFinite(preco) || preco < 0 || !Number.isFinite(peso) || peso < 1 || !Number.isInteger(stock) || stock < 0) {
            throw new Error('Preencha nome, SKU, tema, preço, peso e stock.');
        }

        const skuExistente = todosOsProdutos.some(produto => String(produto.sku || '').toUpperCase() === sku);
        if(skuExistente) {
            throw new Error('Este SKU já existe. Ajuste o SKU antes de criar o produto.');
        }

        const novoProduto = {
            sku,
            referencia,
            nome,
            tema,
            subtema: subtema || 'semsubtema',
            preco,
            peso,
            stock,
            observacoes,
            ativo,
            novidade,
            imagens
        };

        const { data, error } = await dbClient.rpc('criar_produto_admin', {
            p_produto: novoProduto
        });

        if(error) throw error;

        todosOsProdutos.push({ ...novoProduto, ...data });
        document.getElementById('form-admin-produto').reset();
        document.getElementById('admin-produto-ativo').checked = true;
        const novidadeInput = document.getElementById('admin-produto-novidade');
        if(novidadeInput) novidadeInput.checked = true;
        atualizarPreviewImagensAdmin();
        mostrarMensagem(status, 'Produto criado com sucesso.', 'msg-sucesso');
        await carregarProdutosAdminDaNuvem();
    } catch(error) {
        console.error('Erro admin:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível criar o produto.'), 'msg-erro');
    }
}


async function carregarProdutosAdminDaNuvem(){
    if(!dbClient) return;

    const listaProdutos = [];
    const tamanhoPagina = 500;
    let inicio = 0;

    while(true) {
        const { data:pagina, error } = await executarComTimeout(
            dbClient.rpc('listar_produtos_admin', {
                p_limite:tamanhoPagina,
                p_offset:inicio
            }),
            20000,
            'Consulta administrativa de produtos demasiado lenta.'
        );

        if(error) throw error;
        if(!pagina || pagina.length === 0) break;

        listaProdutos.push(...pagina);
        if(pagina.length < tamanhoPagina) break;
        inicio += tamanhoPagina;
    }

    todosOsProdutos = listaProdutos;
    catalogoAdminCarregado = true;
    atualizarContadorCarrinhoCabecalho();
    renderizarListaProdutosAdmin();
}

let scriptImportacaoGestaoCarregado = false;
let promessaScriptImportacaoGestao = null;

function garantirScriptImportacaoGestao() {
    if (typeof analisarFicheiroCatalogoAdmin === 'function') {
        scriptImportacaoGestaoCarregado = true;
        return Promise.resolve();
    }
    if (promessaScriptImportacaoGestao) return promessaScriptImportacaoGestao;

    promessaScriptImportacaoGestao = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'gestao-importacao.js?v=20260717-catalogo-ativo-auto';
        script.defer = true;
        script.onload = () => {
            scriptImportacaoGestaoCarregado = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Falha ao carregar importação administrativa.'));
        document.body.appendChild(script);
    });

    return promessaScriptImportacaoGestao;
}

function prefetchBibliotecaSheetJsAdmin() {
    const url = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    if (document.querySelector('link[rel="prefetch"][href="' + url + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'script';
    document.head.appendChild(link);
}

function ligarElementoGestao(id, evento, handler) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.addEventListener(evento, handler);
}

function ligarGestaoAdmin() {
    ligarElementoGestao('form-admin-produto', 'submit', function (evento) {
        if (typeof criarProdutoAdmin === 'function') criarProdutoAdmin(evento);
    });
    ligarElementoGestao('admin-produto-nome', 'input', function () {
        if (typeof sugerirSkuAdmin === 'function') sugerirSkuAdmin();
    });
    ligarElementoGestao('admin-produto-imagens', 'input', function () {
        if (typeof atualizarPreviewImagensAdmin === 'function') atualizarPreviewImagensAdmin();
    });
    ligarElementoGestao('admin-pesquisa-produtos', 'input', function () {
        if (typeof renderizarListaProdutosAdmin === 'function') renderizarListaProdutosAdmin();
    });
    ligarElementoGestao('admin-ficheiro-stock', 'change', function () {
        garantirScriptImportacaoGestao().then(() => {
            if (typeof analisarFicheiroStockAdmin === 'function') analisarFicheiroStockAdmin(this);
        }).catch(console.error);
    });
    ligarElementoGestao('btn-confirmar-importacao-stock', 'click', function () {
        garantirScriptImportacaoGestao().then(() => {
            if (typeof confirmarImportacaoStockAdmin === 'function') confirmarImportacaoStockAdmin();
        }).catch(console.error);
    });
    ligarElementoGestao('admin-ficheiro-catalogo-sem-stock', 'change', function () {
        garantirScriptImportacaoGestao().then(() => {
            if (typeof analisarFicheiroCatalogoSemStockAdmin === 'function') analisarFicheiroCatalogoSemStockAdmin(this);
        }).catch(console.error);
    });
    ligarElementoGestao('btn-confirmar-importacao-catalogo-sem-stock', 'click', function () {
        garantirScriptImportacaoGestao().then(() => {
            if (typeof confirmarImportacaoCatalogoSemStockAdmin === 'function') confirmarImportacaoCatalogoSemStockAdmin();
        }).catch(console.error);
    });
    ligarElementoGestao('admin-ficheiro-catalogo', 'change', function () {
        garantirScriptImportacaoGestao().then(() => {
            if (typeof analisarFicheiroCatalogoAdmin === 'function') analisarFicheiroCatalogoAdmin(this);
        }).catch(console.error);
    });
    ligarElementoGestao('confirmacao-substituir-catalogo', 'input', function () {
        garantirScriptImportacaoGestao().then(() => {
            if (typeof atualizarConfirmacaoCatalogoAdmin === 'function') atualizarConfirmacaoCatalogoAdmin();
        }).catch(console.error);
    });
    ligarElementoGestao('btn-confirmar-importacao-catalogo', 'click', function () {
        garantirScriptImportacaoGestao().then(() => {
            if (typeof confirmarImportacaoCatalogoAdmin === 'function') confirmarImportacaoCatalogoAdmin();
        }).catch(console.error);
    });
    ligarElementoGestao('form-admin-editar-produto', 'submit', function (evento) {
        if (typeof guardarEdicaoProdutoAdmin === 'function') guardarEdicaoProdutoAdmin(evento);
    });
    ligarElementoGestao('admin-editar-imagens', 'input', function () {
        if (typeof atualizarPreviewEditarImagensAdmin === 'function') atualizarPreviewEditarImagensAdmin();
    });

    document.querySelectorAll('[data-acao-admin="pesquisar-produtos"]').forEach(function (botao) {
        botao.addEventListener('click', function () {
            if (typeof renderizarListaProdutosAdmin === 'function') renderizarListaProdutosAdmin();
        });
    });
    document.querySelectorAll('[data-acao-admin="cancelar-edicao-produto"]').forEach(function (botao) {
        botao.addEventListener('click', function () {
            if (typeof cancelarEdicaoProdutoAdmin === 'function') cancelarEdicaoProdutoAdmin();
        });
    });

    document.querySelectorAll('[data-tab-gestao]').forEach(function (botao) {
        botao.addEventListener('click', function () {
            const destino = botao.dataset.tabGestao;
            document.querySelectorAll('[data-tab-gestao]').forEach(function (item) {
                const ativo = item === botao;
                item.classList.toggle('ativa', ativo);
                item.setAttribute('aria-selected', ativo ? 'true' : 'false');
            });
            document.querySelectorAll('[data-painel-gestao]').forEach(function (painel) {
                const ativo = painel.dataset.painelGestao === destino;
                painel.classList.toggle('ativa', ativo);
                painel.hidden = !ativo;
            });
            if (destino === 'importar') {
                prefetchBibliotecaSheetJsAdmin();
                garantirScriptImportacaoGestao()
                    .then(function () {
                        if (typeof garantirXlsxAdmin === 'function') {
                            return garantirXlsxAdmin();
                        }
                    })
                    .catch(console.error);
            }
        });
    });

    document.querySelectorAll('[data-tab-gestao="importar"]').forEach(function (botao) {
        botao.addEventListener('mouseenter', prefetchBibliotecaSheetJsAdmin, { once: true });
        botao.addEventListener('focus', prefetchBibliotecaSheetJsAdmin, { once: true });
    });

    const uploadNovo = document.getElementById('admin-produto-upload-imagens');
    if (uploadNovo) {
        uploadNovo.addEventListener('change', function () {
            if (typeof enviarFotosCloudinaryAdmin === 'function') {
                enviarFotosCloudinaryAdmin(this, 'admin-produto-imagens', atualizarPreviewImagensAdmin, 'status-upload-admin-produto');
            }
        });
    }

    const uploadEditar = document.getElementById('admin-editar-upload-imagens');
    if (uploadEditar) {
        uploadEditar.addEventListener('change', function () {
            if (typeof enviarFotosCloudinaryAdmin === 'function') {
                enviarFotosCloudinaryAdmin(this, 'admin-editar-imagens', atualizarPreviewEditarImagensAdmin, 'status-upload-admin-editar');
            }
        });
    }
}

(function iniciarGestaoAdmin() {
    function quandoPronto(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    quandoPronto(function () {
        if (document.getElementById('form-admin-produto') || document.querySelector('[data-tab-gestao]')) {
            ligarGestaoAdmin();
        }
    });
})();
