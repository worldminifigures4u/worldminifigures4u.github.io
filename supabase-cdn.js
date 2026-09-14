(function () {
    const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2';
    const SUPABASE_CDN_TIMEOUT_MS = 10000;
    let carregamento = null;

    window.carregarScriptSupabase = function carregarScriptSupabase() {
        if (typeof supabase !== 'undefined') return Promise.resolve();
        if (carregamento) return carregamento;

        carregamento = new Promise((resolve, reject) => {
            let temporizador = null;
            const concluir = (callback, valor) => {
                clearTimeout(temporizador);
                callback(valor);
            };
            const falhar = erro => {
                carregamento = null;
                concluir(reject, erro);
            };
            temporizador = setTimeout(() => {
                carregamento = null;
                reject(new Error('Supabase CDN demorou demasiado a carregar'));
            }, SUPABASE_CDN_TIMEOUT_MS);

            const existente = document.querySelector('script[data-supabase-cdn]');
            if (existente) {
                existente.addEventListener('load', () => concluir(resolve), { once: true });
                existente.addEventListener('error', () => falhar(new Error('Supabase CDN falhou')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = SUPABASE_CDN;
            script.async = true;
            script.dataset.supabaseCdn = '1';
            script.onload = () => concluir(resolve);
            script.onerror = () => falhar(new Error('Supabase CDN falhou'));
            document.head.appendChild(script);
        });

        return carregamento;
    };
})();
