// Rotacao suave dos banners CGI da vitrine.
(function () {
    const INTERVALO_MS = 7000;
    const raiz = document.querySelector('[data-loja-banner]');
    if (!raiz) return;

    const slides = Array.from(raiz.querySelectorAll('[data-loja-banner-slide]'));
    if (slides.length < 2) return;

    let indice = Math.floor(Math.random() * slides.length);
    let temporizador = null;
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function mostrar(proximo) {
        slides.forEach((slide, i) => {
            const ativo = i === proximo;
            slide.classList.toggle('is-ativo', ativo);
            slide.setAttribute('aria-hidden', ativo ? 'false' : 'true');
        });
        indice = proximo;
    }

    function seguinte() {
        mostrar((indice + 1) % slides.length);
    }

    mostrar(indice);
    if (reduzirMovimento) return;

    temporizador = window.setInterval(seguinte, INTERVALO_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (temporizador) {
                window.clearInterval(temporizador);
                temporizador = null;
            }
            return;
        }
        if (!temporizador) {
            temporizador = window.setInterval(seguinte, INTERVALO_MS);
        }
    });
})();
