(function () {
    const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2';
    let carregamento = null;

    window.carregarScriptSupabase = function carregarScriptSupabase() {
        if (typeof supabase !== 'undefined') return Promise.resolve();
        if (carregamento) return carregamento;

        carregamento = new Promise((resolve, reject) => {
            const existente = document.querySelector('script[data-supabase-cdn]');
            if (existente) {
                existente.addEventListener('load', () => resolve(), { once: true });
                existente.addEventListener('error', () => reject(new Error('Supabase CDN falhou')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = SUPABASE_CDN;
            script.async = true;
            script.dataset.supabaseCdn = '1';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Supabase CDN falhou'));
            document.head.appendChild(script);
        });

        return carregamento;
    };
})();
