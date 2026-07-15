(function () {
    const SELETOR_CAMPOS = [
        'input:not([type])',
        'input[type="text"]',
        'input[type="search"]',
        'input[type="email"]',
        'input[type="tel"]',
        'input[type="url"]',
        'input[type="number"]',
        'textarea',
    ].join(", ");

    function campoAceitaLimpar(campo) {
        if (!campo || !(campo instanceof HTMLElement)) return false;
        if (campo.closest(".campo-com-limpar")) return false;
        if (campo.dataset.semLimparCampo === "1" || campo.closest("[data-sem-limpar-campo]")) return false;
        if (campo.disabled || campo.readOnly) return false;
        if (!campo.matches(SELETOR_CAMPOS)) return false;
        return true;
    }

    function atualizarBotao(campo, botao) {
        const temValor = String(campo.value || "").length > 0;
        botao.hidden = !temValor;
        campo.classList.toggle("tem-limpar-campo", temValor);
    }

    function ajustarTamanhoBotao(campo, envoltorio) {
        const alturaCampo = campo.offsetHeight;
        if (!alturaCampo) return;
        const tamanho = Math.max(20, Math.min(36, alturaCampo - 4));
        envoltorio.style.setProperty("--campo-limpar-tamanho", `${tamanho}px`);
    }

    function limparCampo(campo, botao) {
        campo.value = "";
        atualizarBotao(campo, botao);
        campo.dispatchEvent(new Event("input", { bubbles: true }));
        campo.dispatchEvent(new Event("change", { bubbles: true }));
        campo.focus();
    }

    function envolverCampo(campo) {
        if (!campoAceitaLimpar(campo)) return;

        const envoltorio = document.createElement("span");
        envoltorio.className = "campo-com-limpar";
        if (campo.closest(".cabecalho-pesquisa")) {
            envoltorio.classList.add("campo-com-limpar--cabecalho");
        }
        if (campo.tagName === "TEXTAREA") {
            envoltorio.classList.add("campo-com-limpar--textarea");
        }

        const pai = campo.parentNode;
        if (!pai) return;
        pai.insertBefore(envoltorio, campo);
        envoltorio.appendChild(campo);

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "campo-limpar-botao";
        botao.setAttribute("aria-label", "Limpar campo");
        botao.textContent = "×";
        botao.hidden = true;
        botao.addEventListener("click", (evento) => {
            evento.preventDefault();
            limparCampo(campo, botao);
        });
        envoltorio.appendChild(botao);

        const sincronizar = () => {
            atualizarBotao(campo, botao);
            ajustarTamanhoBotao(campo, envoltorio);
        };

        campo.addEventListener("input", sincronizar);
        campo.addEventListener("change", sincronizar);
        sincronizar();

        if (typeof ResizeObserver !== "undefined") {
            const observador = new ResizeObserver(sincronizar);
            observador.observe(campo);
        }
    }

    function processarRaiz(raiz) {
        if (!(raiz instanceof Element)) return;
        if (raiz.matches(SELETOR_CAMPOS)) envolverCampo(raiz);
        raiz.querySelectorAll(SELETOR_CAMPOS).forEach(envolverCampo);
    }

    function iniciar() {
        processarRaiz(document.body);

        const observador = new MutationObserver((mutacoes) => {
            mutacoes.forEach((mutacao) => {
                mutacao.addedNodes.forEach((no) => {
                    if (no.nodeType !== 1) return;
                    processarRaiz(no);
                });
            });
        });

        observador.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
