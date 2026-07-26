// Rotacao dos banners da vitrine (HTML de fallback + ativos no Supabase).
(function () {
    const INTERVALO_MS = 7000;
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

    function criarSlide(banner, ativo) {
        const img = document.createElement('img');
        img.className = 'loja-banner-cgi-img' + (ativo ? ' is-ativo' : '');
        img.src = banner.url;
        img.alt = banner.alt || '';
        img.width = 2048;
        img.height = 362;
        img.decoding = 'async';
        img.fetchPriority = ativo ? 'low' : 'low';
        img.setAttribute('data-loja-banner-slide', '');
        img.setAttribute('aria-hidden', ativo ? 'false' : 'true');
        return img;
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
                .select('url, alt, ordem')
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
