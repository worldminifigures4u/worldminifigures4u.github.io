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

    function sincronizar(origem) {
        const texto = String(origem.textContent || "").trim();
        const aviso = document.getElementById("fp-aviso-flutuante");
        if (!texto) {
            // Mensagem limpa pela pagina: esconde, exceto erros (fecham-se no x)
            if (aviso && !aviso.classList.contains("erro")) esconder();
            return;
        }
        const erro = origem.classList.contains("status-erro");
        const emCurso = !erro && /(\.\.\.|…)\s*$/.test(texto);
        mostrar(texto, erro ? "erro" : (emCurso ? "em-curso" : "sucesso"));
    }

    function iniciar() {
        const origem = document.getElementById("fornecedores-status");
        if (!origem || origem.dataset.avisoFlutuante === "1") return;
        origem.dataset.avisoFlutuante = "1";
        origem.classList.add("fp-status-espelhado");
        // Cada escrita na mensagem (mesmo repetida) volta a mostrar o aviso
        const observador = new MutationObserver(() => sincronizar(origem));
        observador.observe(origem, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
        if (String(origem.textContent || "").trim()) sincronizar(origem);
        document.addEventListener("keydown", (evento) => {
            if (evento.key === "Escape" && document.getElementById("fp-aviso-flutuante")?.classList.contains("erro")) esconder();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
