// Rotacao dos banners da vitrine (HTML de fallback + ativos no Supabase).
(function () {
    const INTERVALO_MS = 7000;
    const COR_BRANCO = '#ffffff';
    const COR_AMARELO_LOGO = '#ffc107';
    const raiz = document.querySelector('[data-loja-banner]');
    if (!raiz) return;

    let slides = [];
    let indice = 0;
    let temporizador = null;
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function obterSlides() {
        return Array.from(raiz.querySelectorAll('[data-loja-banner-slide]'));
    }

    function limparTemporizador() {
        if (temporizador) {
            window.clearInterval(temporizador);
            temporizador = null;
        }
    }

    function mostrar(proximo) {
        slides.forEach((slide, i) => {
            const ativo = i === proximo;
            slide.classList.toggle('is-ativo', ativo);
            slide.setAttribute('aria-hidden', ativo ? 'false' : 'true');
        });
        indice = proximo;
    }

    function seguinte() {
        if (slides.length < 2) return;
        mostrar((indice + 1) % slides.length);
    }

    function iniciarRotacao() {
        limparTemporizador();
        slides = obterSlides();
        if (!slides.length) return;
        mostrar(0);
        if (reduzirMovimento || slides.length < 2) return;
        temporizador = window.setInterval(seguinte, INTERVALO_MS);
    }

    function normalizarCorHex(valor, fallback) {
        const bruto = String(valor || '').trim();
        if (/^#[0-9a-fA-F]{6}$/.test(bruto)) return bruto.toLowerCase();
        if (/^#[0-9a-fA-F]{3}$/.test(bruto)) {
            return ('#' + bruto[1] + bruto[1] + bruto[2] + bruto[2] + bruto[3] + bruto[3]).toLowerCase();
        }
        return fallback;
    }

    function textoPlanoBanner(valor) {
        return String(valor || '').replace(/\*\*/g, '').trim();
    }

    function textoBanner(valor) {
        return textoPlanoBanner(valor);
    }

    function altBanner(banner) {
        const esq = textoBanner(banner.texto_esquerda || banner.alt);
        const dir = textoBanner(banner.texto_direita);
        return [esq, dir].filter(Boolean).join(' · ');
    }

    function preencherTextoComDestaques(el, valor, corBase, corDestaque) {
        el.replaceChildren();
        el.style.color = corBase;
        const bruto = String(valor || '');
        const partes = bruto.split(/(\*\*[^*]+\*\*)/g);
        partes.forEach((parte) => {
            if (/^\*\*[^*]+\*\*$/.test(parte)) {
                const destaque = document.createElement('span');
                destaque.className = 'loja-banner-cgi-destaque';
                destaque.style.color = corDestaque;
                destaque.textContent = parte.slice(2, -2);
                el.appendChild(destaque);
                return;
            }
            if (parte) el.appendChild(document.createTextNode(parte));
        });
    }

    function criarTexto(lado, valor, corBase, corDestaque) {
        if (!textoPlanoBanner(valor)) return null;
        const el = document.createElement('span');
        el.className = 'loja-banner-cgi-texto loja-banner-cgi-texto-' + lado;
        preencherTextoComDestaques(el, valor, corBase, corDestaque);
        return el;
    }

    function criarSlide(banner, ativo) {
        const slide = document.createElement('div');
        slide.className = 'loja-banner-cgi-slide' + (ativo ? ' is-ativo' : '');
        slide.setAttribute('data-loja-banner-slide', '');
        slide.setAttribute('aria-hidden', ativo ? 'false' : 'true');

        const corEsq = normalizarCorHex(banner.cor_esquerda, COR_BRANCO);
        const corDir = normalizarCorHex(banner.cor_direita, COR_BRANCO);
        const corDest = normalizarCorHex(banner.cor_destaque, COR_AMARELO_LOGO);

        const img = document.createElement('img');
        img.className = 'loja-banner-cgi-img';
        img.src = banner.url;
        img.alt = altBanner(banner);
        img.width = 2048;
        img.height = 362;
        img.decoding = 'async';
        img.fetchPriority = 'low';
        slide.appendChild(img);

        const esq = criarTexto('esq', banner.texto_esquerda || banner.alt, corEsq, corDest);
        const dir = criarTexto('dir', banner.texto_direita, corDir, corDest);
        if (esq || dir) {
            const textos = document.createElement('div');
            textos.className = 'loja-banner-cgi-textos';
            if (esq) textos.appendChild(esq);
            if (dir) textos.appendChild(dir);
            slide.appendChild(textos);
        }

        return slide;
    }

    function aplicarBannersRemotos(banners) {
        if (!Array.isArray(banners) || !banners.length) return false;
        const fragment = document.createDocumentFragment();
        banners.forEach((banner, i) => {
            if (!banner?.url) return;
            fragment.appendChild(criarSlide(banner, i === 0));
        });
        if (!fragment.childNodes.length) return false;
        raiz.replaceChildren(fragment);
        iniciarRotacao();
        return true;
    }

    async function carregarBannersRemotos() {
        try {
            if (typeof window.carregarScriptSupabase === 'function') {
                await window.carregarScriptSupabase();
            }
            if (typeof supabase === 'undefined' || typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
                return;
            }
            const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            const { data, error } = await client
                .from('banners_loja')
                .select('url, alt, texto_esquerda, texto_direita, cor_esquerda, cor_direita, cor_destaque, ordem')
                .eq('ativo', true)
                .order('ordem', { ascending: true })
                .order('criado_em', { ascending: true });
            if (error || !data?.length) return;
            aplicarBannersRemotos(data);
        } catch (erro) {
            console.warn('Banners remotos indisponíveis; a usar fallback local.', erro);
        }
    }

    iniciarRotacao();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            limparTemporizador();
            return;
        }
        if (!temporizador && !reduzirMovimento && slides.length > 1) {
            temporizador = window.setInterval(seguinte, INTERVALO_MS);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            carregarBannersRemotos();
        }, { once: true });
    } else {
        carregarBannersRemotos();
    }
})();
