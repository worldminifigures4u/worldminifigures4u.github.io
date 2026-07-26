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

function criarCampoTextoGestao(rotulo, valor, maxLength = 120) {
    const label = document.createElement('label');
    label.className = 'gestao-campo';
    const span = document.createElement('span');
    span.textContent = rotulo;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = valor || '';
    input.maxLength = maxLength;
    input.dataset.semLimparCampo = '1';
    label.appendChild(span);
    label.appendChild(input);
    return { label, input };
}

function criarCampoCorGestao(rotulo, valor, fallback) {
    const label = document.createElement('label');
    label.className = 'gestao-campo gestao-campo-cor';
    const span = document.createElement('span');
    span.textContent = rotulo;
    const wrap = document.createElement('div');
    wrap.className = 'gestao-cor-wrap';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = normalizarCorHexGestao(valor, fallback);
    input.dataset.semLimparCampo = '1';
    const codigo = document.createElement('code');
    codigo.className = 'gestao-cor-codigo';
    codigo.textContent = input.value;
    input.addEventListener('input', () => {
        codigo.textContent = input.value;
    });
    wrap.appendChild(input);
    wrap.appendChild(codigo);
    label.appendChild(span);
    label.appendChild(wrap);
    return { label, input };
}

function renderizarListaBannersGestao() {
    const lista = document.getElementById('gestao-lista-banners');
    if (!lista) return;
    lista.replaceChildren();

    if (!gestaoBanners.length) {
        const vazio = document.createElement('p');
        vazio.className = 'gestao-vazio';
        vazio.textContent = 'Ainda não há banners. Adiciona o primeiro acima (ou corre o SQL supabase-banners-loja.sql).';
        lista.appendChild(vazio);
        return;
    }

    gestaoBanners.forEach((banner) => {
        const card = document.createElement('article');
        card.className = 'gestao-banner-card';
        card.dataset.id = banner.id;

        const textoEsq = String(banner.texto_esquerda || banner.alt || '').trim();
        const textoDir = String(banner.texto_direita || '').trim();
        const corEsq = normalizarCorHexGestao(banner.cor_esquerda, GESTAO_COR_BRANCO);
        const corDir = normalizarCorHexGestao(banner.cor_direita, GESTAO_COR_BRANCO);
        const corDest = normalizarCorHexGestao(banner.cor_destaque, GESTAO_COR_AMARELO_LOGO);

        const previewWrap = document.createElement('div');
        previewWrap.className = 'gestao-banner-preview-wrap';
        const preview = document.createElement('img');
        preview.className = 'gestao-banner-preview';
        preview.src = banner.url;
        preview.alt = [textoPlanoGestao(textoEsq), textoPlanoGestao(textoDir)].filter(Boolean).join(' · ') || 'Banner';
        preview.loading = 'lazy';
        preview.decoding = 'async';
        previewWrap.appendChild(preview);
        if (textoPlanoGestao(textoEsq) || textoPlanoGestao(textoDir)) {
            const textos = document.createElement('div');
            textos.className = 'gestao-banner-preview-textos';
            if (textoPlanoGestao(textoEsq)) {
                const esq = document.createElement('span');
                esq.className = 'gestao-banner-preview-texto gestao-banner-preview-texto-esq';
                preencherTextoBannerGestao(esq, textoEsq, corEsq, corDest);
                textos.appendChild(esq);
            }
            if (textoPlanoGestao(textoDir)) {
                const dir = document.createElement('span');
                dir.className = 'gestao-banner-preview-texto gestao-banner-preview-texto-dir';
                preencherTextoBannerGestao(dir, textoDir, corDir, corDest);
                textos.appendChild(dir);
            }
            previewWrap.appendChild(textos);
        }
        card.appendChild(previewWrap);

        const campos = document.createElement('div');
        campos.className = 'gestao-banner-campos';

        const campoEsq = criarCampoTextoGestao('Texto à esquerda', textoEsq);
        const campoDir = criarCampoTextoGestao('Texto à direita', textoDir);
        const campoCorEsq = criarCampoCorGestao('Cor esquerda', corEsq, GESTAO_COR_BRANCO);
        const campoCorDir = criarCampoCorGestao('Cor direita', corDir, GESTAO_COR_BRANCO);
        const campoCorDest = criarCampoCorGestao('Cor destaque (**texto**)', corDest, GESTAO_COR_AMARELO_LOGO);

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

        const btnGuardar = document.createElement('button');
        btnGuardar.type = 'button';
        btnGuardar.className = 'wallapop-botao wallapop-botao-destaque';
        btnGuardar.textContent = 'Guardar';
        btnGuardar.addEventListener('click', () => {
            guardarBannerGestao(banner.id, {
                url: banner.url,
                texto_esquerda: campoEsq.input.value,
                texto_direita: campoDir.input.value,
                cor_esquerda: campoCorEsq.input.value,
                cor_direita: campoCorDir.input.value,
                cor_destaque: campoCorDest.input.value,
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
        acoes.appendChild(btnGuardar);
        acoes.appendChild(btnApagar);

        campos.appendChild(campoEsq.label);
        campos.appendChild(campoDir.label);
        campos.appendChild(labelOrdem);
        campos.appendChild(campoCorEsq.label);
        campos.appendChild(campoCorDir.label);
        campos.appendChild(campoCorDest.label);
        campos.appendChild(acoes);
        card.appendChild(campos);
        lista.appendChild(card);
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
        p_texto_esquerda: dados.texto_esquerda || '',
        p_texto_direita: dados.texto_direita || '',
        p_cor_esquerda: normalizarCorHexGestao(dados.cor_esquerda, GESTAO_COR_BRANCO),
        p_cor_direita: normalizarCorHexGestao(dados.cor_direita, GESTAO_COR_BRANCO),
        p_cor_destaque: normalizarCorHexGestao(dados.cor_destaque, GESTAO_COR_AMARELO_LOGO),
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
        const textoEsq = document.getElementById('novo-banner-texto-esq')?.value || '';
        const textoDir = document.getElementById('novo-banner-texto-dir')?.value || '';
        const corEsq = document.getElementById('novo-banner-cor-esq')?.value || GESTAO_COR_BRANCO;
        const corDir = document.getElementById('novo-banner-cor-dir')?.value || GESTAO_COR_BRANCO;
        const corDest = document.getElementById('novo-banner-cor-dest')?.value || GESTAO_COR_AMARELO_LOGO;
        const ordem = Number(document.getElementById('novo-banner-ordem')?.value);
        const ativo = document.getElementById('novo-banner-ativo')?.checked !== false;
        await guardarBannerGestao(null, {
            url,
            texto_esquerda: textoEsq,
            texto_direita: textoDir,
            cor_esquerda: corEsq,
            cor_direita: corDir,
            cor_destaque: corDest,
            ordem: Number.isFinite(ordem) ? ordem : 100,
            ativo
        });
        if (ficheiroInput) ficheiroInput.value = '';
        const esqInput = document.getElementById('novo-banner-texto-esq');
        const dirInput = document.getElementById('novo-banner-texto-dir');
        if (esqInput) esqInput.value = '';
        if (dirInput) dirInput.value = '';
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
            'Erro ao carregar. Confirma se executaste o SQL supabase-banners-loja-cores.sql no Supabase. '
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
