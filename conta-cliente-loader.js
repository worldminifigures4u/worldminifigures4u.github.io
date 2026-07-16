// Carregamento partilhado de conta-cliente.js (Conta e Gestao).
(function () {
    let promessaContaCliente = null;

    function garantirContaCliente() {
        if (typeof fazerLogin === 'function') return Promise.resolve();
        if (promessaContaCliente) return promessaContaCliente;

        promessaContaCliente = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'conta-cliente.js?v=20260716-admin-plataformas';
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar conta-cliente.js'));
            document.body.appendChild(script);
        });

        return promessaContaCliente;
    }

    window.garantirContaCliente = garantirContaCliente;
})();
