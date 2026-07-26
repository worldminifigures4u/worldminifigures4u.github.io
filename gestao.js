let gestaoClient = null;
let gestaoBanners = [];

const GESTAO_COR_BRANCO = '#ffffff';
const GESTAO_COR_AMARELO_LOGO = '#ffc107';

function definirStatusGestao(mensagem) {
    const status = document.getElementById('gestao-status');
    if (status) status.textContent = mensagem || '';
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

function criarTextoBannerPadrao(parcial = {}) {
    return {
        id: parcial.id || novoIdTextoGestao(),
        texto: String(parcial.texto || ''),
        cor: normalizarCorHexGestao(parcial.cor, GESTAO_COR_BRANCO),
        cor_destaque: normalizarCorHexGestao(parcial.cor_destaque, GESTAO_COR_AMARELO_LOGO),
        x: limitarPercentagem(parcial.x ?? 50, 0, 100),
        y: limitarPercentagem(parcial.y ?? 50, 0, 100),
        maxWidth: limitarPercentagem(parcial.maxWidth ?? 28, 10, 80),
        align: ['left', 'center', 'right'].includes(parcial.align) ? parcial.align : 'left'
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
            x: 10,
            y: 50,
            align: 'left'
        }));
    }
    if (dir) {
        lista.push(criarTextoBannerPadrao({
            id: 'legado-dir',
            texto: dir,
            cor: banner?.cor_direita,
            cor_destaque: banner?.cor_destaque,
            x: 90,
            y: 50,
            align: 'right'
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
    el.style.left = limitarPercentagem(item.x) + '%';
    el.style.top = limitarPercentagem(item.y) + '%';
    el.style.maxWidth = limitarPercentagem(item.maxWidth, 10, 80) + '%';
    el.style.textAlign = item.align || 'left';
    el.style.transform = 'translate(-50%, -50%)';
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

function ligarArrastoTextoGestao(el, item, previewWrap) {
    let aArrastar = false;

    const atualizarPosicao = (evento) => {
        const rect = previewWrap.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        item.x = limitarPercentagem(((evento.clientX - rect.left) / rect.width) * 100);
        item.y = limitarPercentagem(((evento.clientY - rect.top) / rect.height) * 100);
        aplicarEstiloTextoLivre(el, item);
    };

    el.addEventListener('pointerdown', (evento) => {
        if (evento.button != null && evento.button !== 0) return;
        evento.preventDefault();
        aArrastar = true;
        el.classList.add('is-a-arrastar');
        el.setPointerCapture?.(evento.pointerId);
        atualizarPosicao(evento);
    });
    el.addEventListener('pointermove', (evento) => {
        if (!aArrastar) return;
        atualizarPosicao(evento);
    });
    const terminar = (evento) => {
        if (!aArrastar) return;
        aArrastar = false;
        el.classList.remove('is-a-arrastar');
        try { el.releasePointerCapture?.(evento.pointerId); } catch (_) { /* ignore */ }
    };
    el.addEventListener('pointerup', terminar);
    el.addEventListener('pointercancel', terminar);
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
        ajudaPreview.textContent = 'Arrasta os textos na pré-visualização para os posicionar.';
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
                el.title = 'Arrastar para posicionar';
                el.addEventListener('pointerdown', () => {
                    textoAtivoId = item.id;
                    sincronizarLista();
                    sincronizarPreview();
                });
                ligarArrastoTextoGestao(el, item, previewWrap);
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
                cabeca.appendChild(btnRemover);

                const area = document.createElement('textarea');
                area.rows = 2;
                area.maxLength = 160;
                area.value = item.texto;
                area.dataset.semLimparCampo = '1';
                area.placeholder = 'Escreve o texto… Enter para nova linha. **destaque**';
                area.addEventListener('focus', () => {
                    textoAtivoId = item.id;
                    sincronizarLista();
                    sincronizarPreview();
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
                alignLabel.innerHTML = '<span>Alinhamento</span>';
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
                    item.align = alignSelect.value;
                    sincronizarPreview();
                });
                alignLabel.appendChild(alignSelect);

                const larguraLabel = document.createElement('label');
                larguraLabel.className = 'gestao-campo';
                larguraLabel.innerHTML = '<span>Largura máx. (%)</span>';
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

                linhaCores.appendChild(corLabel);
                linhaCores.appendChild(destLabel);
                linhaCores.appendChild(alignLabel);
                linhaCores.appendChild(larguraLabel);

                bloco.appendChild(cabeca);
                bloco.appendChild(area);
                bloco.appendChild(linhaCores);
                listaTextos.appendChild(bloco);
            });
        };

        btnAddTexto.addEventListener('click', () => {
            const novo = criarTextoBannerPadrao({
                texto: 'Novo texto',
                x: 50,
                y: 50,
                align: 'center'
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
    const { data: { user }, error } = await gestaoClient.auth.getUser();
    if (error || !user || !ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
        if (bloqueio) bloqueio.textContent = 'Acesso reservado ao administrador. A regressar à conta...';
        setTimeout(() => window.location.replace('conta.html'), 1400);
        return;
    }

    if (typeof mostrarNavegacaoAdminValidada === 'function') {
        mostrarNavegacaoAdminValidada();
    }
    if (bloqueio) bloqueio.hidden = true;
    if (aplicacao) aplicacao.hidden = false;

    document.getElementById('form-novo-banner')?.addEventListener('submit', (evento) => {
        adicionarBannerGestao(evento).catch(console.error);
    });
    document.getElementById('btn-atualizar-banners')?.addEventListener('click', () => {
        carregarBannersGestao().catch(console.error);
    });

    try {
        await carregarBannersGestao();
    } catch (erro) {
        console.error(erro);
        definirStatusGestao(
            'Erro ao carregar. Confirma se executaste o SQL supabase-banners-loja-textos-livres.sql no Supabase. '
            + (erro.message || '')
        );
    }
}

document.addEventListener('DOMContentLoaded', () => {
    iniciarPainelGestao().catch((erro) => {
        console.error(erro);
        const bloqueio = document.getElementById('gestao-bloqueio');
        if (bloqueio) bloqueio.textContent = 'Erro ao iniciar a página de gestão.';
    });
});
