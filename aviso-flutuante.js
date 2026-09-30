// Aviso flutuante (toast) em cima ao centro, logo abaixo do menu.
// Espelha o texto de #fornecedores-status (Mapas e Fornecedores):
// - sucesso: desaparece ao fim de 3 s
// - mensagens em curso ("A gravar..."): ficam ate serem substituidas
// - erro: fica ate ser fechado com o x
(function () {
    "use strict";

    const TEMPO_SUCESSO_MS = 3000;
    let temporizador = null;

    function criarAviso() {
        let aviso = document.getElementById("fp-aviso-flutuante");
        if (aviso) return aviso;
        aviso = document.createElement("div");
        aviso.id = "fp-aviso-flutuante";
        aviso.className = "fp-aviso-flutuante";
        aviso.setAttribute("role", "status");
        aviso.setAttribute("aria-live", "polite");
        const texto = document.createElement("span");
        texto.className = "fp-aviso-flutuante-texto";
        const fechar = document.createElement("button");
        fechar.type = "button";
        fechar.className = "fp-aviso-flutuante-fechar";
        fechar.textContent = "×";
        fechar.title = "Fechar";
        fechar.setAttribute("aria-label", "Fechar aviso");
        fechar.addEventListener("click", esconder);
        aviso.append(texto, fechar);
        document.body.appendChild(aviso);
        return aviso;
    }

    function esconder() {
        clearTimeout(temporizador);
        temporizador = null;
        document.getElementById("fp-aviso-flutuante")?.classList.remove("visivel");
    }

    function mostrar(texto, tipo) {
        const aviso = criarAviso();
        clearTimeout(temporizador);
        temporizador = null;
        aviso.querySelector(".fp-aviso-flutuante-texto").textContent = texto;
        aviso.classList.remove("sucesso", "erro", "em-curso");
        aviso.classList.add(tipo);
        aviso.setAttribute("role", tipo === "erro" ? "alert" : "status");
        aviso.classList.add("visivel");
        if (tipo === "sucesso") temporizador = setTimeout(esconder, TEMPO_SUCESSO_MS);
    }

    // Mensagens informativas (contagens, estado de edicao) ficam na propria pagina
    const REGEX_INFO_NA_PAGINA = /(encontrad[oa]\(?s?\)?\.?$|^\d+ banner|^sem banners|^\d+ tarifa|n[aã]o gravad)/i;
    const REGEX_ERRO_TEXTO = /^(erro\b|n[aã]o foi poss[ií]vel|n[aã]o [eé] poss[ií]vel|acesso reservado|indica\b|indique\b|escolhe\b|escolha\b)/i;
    const TAMANHO_MAX_AVISO_PUBLICO = 90;

    function classificar(origem, texto) {
        const classes = origem.classList;
        if (classes.contains("status-erro") || classes.contains("msg-erro")) return "erro";
        if (classes.contains("msg-processando") || /(\.\.\.|…)\s*$/.test(texto)) return "em-curso";
        if (REGEX_ERRO_TEXTO.test(texto)) return "erro";
        if (REGEX_INFO_NA_PAGINA.test(texto)) return "info";
        return "sucesso";
    }

    function mostrarNaPagina(origem, visivel) {
        origem.style.display = visivel ? "" : "none";
    }

    function sincronizar(origem) {
        const texto = String(origem.textContent || "").trim();
        const aviso = document.getElementById("fp-aviso-flutuante");
        const modo = origem.dataset.avisoFlutuante || "todos";
        if (!texto) {
            mostrarNaPagina(origem, false);
            // Mensagem limpa pela pagina: esconde, exceto erros (fecham-se no x)
            if (aviso && !aviso.classList.contains("erro")) esconder();
            return;
        }
        const tipo = classificar(origem, texto);
        const longo = texto.length > TAMANHO_MAX_AVISO_PUBLICO || origem.querySelector("br");
        const ficaNaPagina = tipo === "info" || (modo === "sucesso" && (tipo !== "sucesso" || longo));
        if (ficaNaPagina) {
            mostrarNaPagina(origem, true);
            // A mensagem na pagina substitui o aviso "em curso" (ex.: "A pesquisar..." -> "3 clientes encontrados")
            if (aviso && !aviso.classList.contains("erro")) esconder();
            return;
        }
        mostrarNaPagina(origem, false);
        mostrar(texto, tipo);
    }

    function ligarOrigem(origem) {
        if (!origem || origem.dataset.avisoFlutuanteLigado === "1") return;
        origem.dataset.avisoFlutuanteLigado = "1";
        // Cada escrita na mensagem (mesmo repetida) volta a mostrar o aviso
        const observador = new MutationObserver(() => sincronizar(origem));
        observador.observe(origem, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
        sincronizar(origem);
    }

    function iniciar() {
        const fornecedores = document.getElementById("fornecedores-status");
        if (fornecedores && !fornecedores.dataset.avisoFlutuante) fornecedores.dataset.avisoFlutuante = "todos";
        document.querySelectorAll("[data-aviso-flutuante]").forEach(ligarOrigem);
        document.addEventListener("keydown", (evento) => {
            if (evento.key === "Escape" && document.getElementById("fp-aviso-flutuante")?.classList.contains("erro")) esconder();
        });
    }

    window.mostrarAvisoFlutuante = mostrar;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
