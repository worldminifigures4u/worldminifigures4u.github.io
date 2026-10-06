// Escrever em qualquer sítio da página vai direto para o campo de pesquisa marcado com
// data-foco-teclado (só quando não há outro campo ativo nem nenhum modal/diálogo aberto).
(function () {
    function haModalAberto() {
        if (/modal-aberto|galeria-aberta|dialogo[a-z-]*-aberto/.test(document.body.className)) return true;
        return Array.from(document.querySelectorAll('[class*="modal"]:not([hidden]), [class*="dialogo"]:not([hidden]), dialog[open]'))
            .some(elemento => elemento.getClientRects().length && getComputedStyle(elemento).position === "fixed");
    }

    document.addEventListener("keydown", evento => {
        if (evento.defaultPrevented || evento.ctrlKey || evento.metaKey || evento.altKey || evento.isComposing) return;
        if (!evento.key || evento.key.length !== 1 || evento.key === " ") return;
        const ativo = document.activeElement;
        if (ativo && (ativo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName))) return;
        if (haModalAberto()) return;
        const campo = document.querySelector("[data-foco-teclado]");
        if (!campo || campo.disabled || campo.readOnly || !campo.getClientRects().length) return;
        campo.focus();
        const fim = campo.value.length;
        try { campo.setSelectionRange(fim, fim); } catch (_) {}
    });
})();
