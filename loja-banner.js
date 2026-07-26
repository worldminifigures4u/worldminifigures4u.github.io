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

    function limitarPercentagem(valor, minimo = 0, maximo = 100) {
        const n = Number(valor);
        if (!Number.isFinite(n)) return minimo;
        return Math.min(maximo, Math.max(minimo, n));
    }

    function textoPlanoBanner(valor) {
        return String(valor || '').replace(/\*\*/g, '').trim();
    }

    function alinharHTextoBanner(valor) {
        return ['left', 'center', 'right'].includes(valor) ? valor : 'center';
    }

    function alinharVTextoBanner(valor) {
        return ['top', 'middle', 'bottom'].includes(valor) ? valor : 'middle';
    }

    const BANNER_TEXTO_INSET = 1.5;

    function coordenadasPorAlinhamento(align, alignV) {
        const h = alinharHTextoBanner(align);
        const v = alinharVTextoBanner(alignV);
        return {
            x: h === 'left' ? BANNER_TEXTO_INSET : h === 'right' ? 100 - BANNER_TEXTO_INSET : 50,
            y: v === 'top' ? BANNER_TEXTO_INSET : v === 'bottom' ? 100 - BANNER_TEXTO_INSET : 50
        };
    }

    function transformTextoBanner(align, alignV) {
        const tx = align === 'left' ? '0' : align === 'right' ? '-100%' : '-50%';
        const ty = alignV === 'top' ? '0' : alignV === 'bottom' ? '-100%' : '-50%';
        return `translate(${tx}, ${ty})`;
    }

    function listaTextosBanner(banner) {
        if (Array.isArray(banner?.textos) && banner.textos.length) {
            return banner.textos;
        }
        const lista = [];
        const esq = String(banner?.texto_esquerda || banner?.alt || '').trim();
        const dir = String(banner?.texto_direita || '').trim();
        if (esq) {
            lista.push({
                texto: esq,
                cor: banner?.cor_esquerda || COR_BRANCO,
                cor_destaque: banner?.cor_destaque || COR_AMARELO_LOGO,
                maxWidth: 28,
                align: 'left',
                alignV: 'middle'
            });
        }
        if (dir) {
            lista.push({
                texto: dir,
                cor: banner?.cor_direita || COR_BRANCO,
                cor_destaque: banner?.cor_destaque || COR_AMARELO_LOGO,
                maxWidth: 28,
                align: 'right',
                alignV: 'middle'
            });
        }
        return lista;
    }

    function altBanner(banner) {
        return listaTextosBanner(banner)
            .map((item) => textoPlanoBanner(item.texto))
            .filter(Boolean)
            .join(' · ');
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

    function limitarTamanhoFonteBanner(valor) {
        return limitarPercentagem(valor ?? 100, 50, 200);
    }

    function cssFonteTextoBanner(escala) {
        const s = limitarTamanhoFonteBanner(escala) / 100;
        return `clamp(${(0.85 * s).toFixed(3)}rem, ${(1.7 * s).toFixed(3)}vw, ${(1.35 * s).toFixed(3)}rem)`;
    }

    function criarTextoLivre(item) {
        if (!textoPlanoBanner(item?.texto)) return null;
        const el = document.createElement('span');
        const align = alinharHTextoBanner(item.align);
        const alignV = alinharVTextoBanner(item.alignV);
        const coords = item.posicaoLivre
            ? {
                x: limitarPercentagem(item.x ?? 50),
                y: limitarPercentagem(item.y ?? 50)
            }
            : coordenadasPorAlinhamento(align, alignV);
        const largura = limitarPercentagem(item.maxWidth ?? 28, 10, 80) + '%';
        el.className = 'loja-banner-cgi-texto loja-banner-cgi-texto-livre';
        el.style.left = coords.x + '%';
        el.style.top = coords.y + '%';
        el.style.width = largura;
        el.style.maxWidth = largura;
        el.style.fontSize = cssFonteTextoBanner(item.fontSize);
        el.style.textAlign = align;
        el.style.transform = transformTextoBanner(align, alignV);
        preencherTextoComDestaques(
            el,
            item.texto,
            normalizarCorHex(item.cor, COR_BRANCO),
            normalizarCorHex(item.cor_destaque, COR_AMARELO_LOGO)
        );
        return el;
    }

    function criarSlide(banner, ativo) {
        const slide = document.createElement('div');
        slide.className = 'loja-banner-cgi-slide' + (ativo ? ' is-ativo' : '');
        slide.setAttribute('data-loja-banner-slide', '');
        slide.setAttribute('aria-hidden', ativo ? 'false' : 'true');

        const img = document.createElement('img');
        img.className = 'loja-banner-cgi-img';
        img.src = banner.url;
        img.alt = altBanner(banner);
        img.width = 2048;
        img.height = 362;
        img.decoding = 'async';
        img.fetchPriority = 'low';
        slide.appendChild(img);

        const textos = listaTextosBanner(banner)
            .map(criarTextoLivre)
            .filter(Boolean);
        if (textos.length) {
            const camada = document.createElement('div');
            camada.className = 'loja-banner-cgi-textos';
            textos.forEach((el) => camada.appendChild(el));
            slide.appendChild(camada);
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
                .select('url, alt, textos, texto_esquerda, texto_direita, cor_esquerda, cor_direita, cor_destaque, ordem')
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
