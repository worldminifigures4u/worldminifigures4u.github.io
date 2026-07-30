// Codigo da montra de produtos e filtros da loja.
// Separado de app.js para carregar apenas nas paginas que mostram catalogo.

const PRODUTOS_POR_LOTE = 48;
const PRODUTOS_POR_PAGINA_SERVIDOR = 48;
const TAMANHO_PAGINA_METADADOS = 1000;
const CACHE_TEMAS_LOJA_CHAVE = 'figures-planet-loja-temas-v2';
const CACHE_TEMAS_LOJA_TTL_MS = 30 * 60 * 1000;
const CAMPOS_PRODUTO_LOJA = 'id, sku, nome, preco, peso, tema, subtema, imagens, ativo, descontinuado';
let produtosVitrineAtual = [];
let produtosFiltradosAtual = [];
let indiceRenderizado = 0;
let sentinelaCarregarMais = null;
let observadorCarregarMais = null;
let totalProdutosRemotos = 0;
let offsetProdutosRemotos = 0;
let haMaisProdutosRemotos = false;
let carregandoProdutosRemotos = false;
let promessaCargaProdutosEmCurso = null;
let reinicioProdutosPendente = false;
let vitrineModoAleatorio = false;
let vitrineInicioAleatorio = 0;
let vitrineCursorCatalogo = 0;
let vitrineVoltaAoInicio = false;
const mapaTemasLoja = new Map();
let lojaFotoModalLigado = false;
let lojaFotoGaleriaUrls = [];
let lojaFotoGaleriaIndice = 0;
let lojaFotoGaleriaAlt = '';
let lojaFotoGaleriaOnChange = null;
let lojaFotoToqueInicioX = 0;
let lojaFotoToqueInicioY = 0;

function fecharFotoProdutoAmpliada() {
    const modal = document.getElementById('loja-foto-modal');
    const foto = document.getElementById('loja-foto-modal-img');
    if (!modal) return;
    modal.hidden = true;
    if (foto) {
        foto.removeAttribute('src');
        foto.alt = '';
    }
    lojaFotoGaleriaUrls = [];
    lojaFotoGaleriaIndice = 0;
    lojaFotoGaleriaAlt = '';
    lojaFotoGaleriaOnChange = null;
    document.body.classList.remove('loja-foto-modal-aberto');
}

function atualizarControlosFotoProdutoAmpliada() {
    const total = lojaFotoGaleriaUrls.length;
    const temVarias = total > 1;
    const anterior = document.getElementById('loja-foto-modal-anterior');
    const seguinte = document.getElementById('loja-foto-modal-seguinte');
    const indicador = document.getElementById('loja-foto-modal-indicador');
    if (anterior) anterior.hidden = !temVarias;
    if (seguinte) seguinte.hidden = !temVarias;
    if (indicador) {
        indicador.hidden = !temVarias;
        if (temVarias) {
            indicador.textContent = (lojaFotoGaleriaIndice + 1) + ' / ' + total;
        }
    }
}

function mostrarFotoProdutoAmpliadaAtual() {
    const foto = document.getElementById('loja-foto-modal-img');
    if (!foto || !lojaFotoGaleriaUrls.length) return;
    const url = lojaFotoGaleriaUrls[lojaFotoGaleriaIndice];
    const urlAmpliada = typeof otimizarImagemCloudinary === 'function'
        ? otimizarImagemCloudinary(url, 1200)
        : url;
    foto.src = urlAmpliada;
    foto.alt = lojaFotoGaleriaAlt || 'Produto';
    atualizarControlosFotoProdutoAmpliada();
    if (typeof lojaFotoGaleriaOnChange === 'function') {
        lojaFotoGaleriaOnChange(lojaFotoGaleriaIndice);
    }
}

function navegarFotoProdutoAmpliada(delta) {
    const total = lojaFotoGaleriaUrls.length;
    if (total < 2) return;
    lojaFotoGaleriaIndice = (lojaFotoGaleriaIndice + delta + total) % total;
    mostrarFotoProdutoAmpliadaAtual();
}

function abrirFotoProdutoAmpliada(opcoes) {
    const modal = document.getElementById('loja-foto-modal');
    const foto = document.getElementById('loja-foto-modal-img');
    const fechar = document.getElementById('loja-foto-modal-fechar');
    if (!modal || !foto) return;

    let urls = [];
    let indice = 0;
    let alt = 'Produto';
    let onChange = null;

    if (typeof opcoes === 'string') {
        urls = [opcoes];
        alt = arguments[1] || 'Produto';
    } else if (opcoes && typeof opcoes === 'object') {
        urls = Array.isArray(opcoes.urls)
            ? opcoes.urls.filter(Boolean)
            : (opcoes.url ? [opcoes.url] : []);
        indice = Number(opcoes.indice) || 0;
        alt = opcoes.alt || 'Produto';
        onChange = typeof opcoes.onChange === 'function' ? opcoes.onChange : null;
    }

    if (!urls.length) return;
    lojaFotoGaleriaUrls = urls;
    lojaFotoGaleriaIndice = ((indice % urls.length) + urls.length) % urls.length;
    lojaFotoGaleriaAlt = alt;
    lojaFotoGaleriaOnChange = onChange;
    mostrarFotoProdutoAmpliadaAtual();
    modal.hidden = false;
    document.body.classList.add('loja-foto-modal-aberto');
    fechar?.focus();
}

function garantirListenersModalFotoLoja() {
    if (lojaFotoModalLigado) return;
    const modal = document.getElementById('loja-foto-modal');
    if (!modal) return;
    lojaFotoModalLigado = true;

    document.getElementById('loja-foto-modal-fechar')?.addEventListener('click', (evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        fecharFotoProdutoAmpliada();
    });
    document.getElementById('loja-foto-modal-anterior')?.addEventListener('click', (evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        navegarFotoProdutoAmpliada(-1);
    });
    document.getElementById('loja-foto-modal-seguinte')?.addEventListener('click', (evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        navegarFotoProdutoAmpliada(1);
    });
    modal.addEventListener('click', (evento) => {
        if (evento.target === modal) fecharFotoProdutoAmpliada();
    });
    modal.addEventListener('pointerdown', (evento) => {
        if (evento.target.closest('.loja-foto-modal-fechar, .loja-foto-modal-seta')) return;
        lojaFotoToqueInicioX = evento.clientX;
        lojaFotoToqueInicioY = evento.clientY;
    });
    modal.addEventListener('pointerup', (evento) => {
        if (evento.target.closest('.loja-foto-modal-fechar, .loja-foto-modal-seta')) return;
        const deltaX = evento.clientX - lojaFotoToqueInicioX;
        const deltaY = evento.clientY - lojaFotoToqueInicioY;
        if (lojaFotoGaleriaUrls.length > 1 && Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
            navegarFotoProdutoAmpliada(deltaX < 0 ? 1 : -1);
        }
    });
    document.addEventListener('keydown', (evento) => {
        const atual = document.getElementById('loja-foto-modal');
        if (!atual || atual.hidden) return;
        if (evento.key === 'Escape') {
            fecharFotoProdutoAmpliada();
            return;
        }
        if (evento.key === 'ArrowLeft') {
            evento.preventDefault();
            navegarFotoProdutoAmpliada(-1);
            return;
        }
        if (evento.key === 'ArrowRight') {
            evento.preventDefault();
            navegarFotoProdutoAmpliada(1);
        }
    });
}

function slugificarTemaLoja(texto) {
    return String(texto || '').toLowerCase().replace(/\s+/g, '-');
}

function criarSvgTema(partes = [], opcoes = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    if (opcoes.preenchido) {
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('stroke', 'none');
    } else {
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.75');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
    }

    partes.forEach((parte) => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', parte.tag || 'path');
        Object.keys(parte.attrs || {}).forEach((chave) => {
            el.setAttribute(chave, parte.attrs[chave]);
        });
        svg.appendChild(el);
    });

    return svg;
}

function path(d, attrs = {}) {
    return { tag: 'path', attrs: { d, ...attrs } };
}

function circle(cx, cy, r, attrs = {}) {
    return { tag: 'circle', attrs: { cx: String(cx), cy: String(cy), r: String(r), ...attrs } };
}

function ellipse(cx, cy, rx, ry, attrs = {}) {
    return { tag: 'ellipse', attrs: { cx: String(cx), cy: String(cy), rx: String(rx), ry: String(ry), ...attrs } };
}

/* Ícones raster exactos (extraídos das imagens de referência). */
const MAPA_ICONES_MASCARA = {
    'Bluey': 'img/icone-bluey.png',
    'Dinossauros': 'img/icone-dinossauros.png'
};

/* Ícones no estilo do mockup DEPOIS (line-art Lucide/Heroicons). */
const MAPA_ICONES_TEMAS = {
    'Todos': [
        circle(12, 12, 9),
        path('M3 12h18'),
        path('M12 3a14 14 0 0 1 0 18'),
        path('M12 3a14 14 0 0 0 0 18')
    ],
    'Animais': [
        ellipse(9.2, 5.8, 1.7, 2.5),
        ellipse(14.8, 5.8, 1.7, 2.5),
        ellipse(5.9, 10.6, 1.6, 2.2, { transform: 'rotate(-18 5.9 10.6)' }),
        ellipse(18.1, 10.6, 1.6, 2.2, { transform: 'rotate(18 18.1 10.6)' }),
        path('M7.5 19.2c.8-3.8 2.5-6 4.5-6s3.7 2.2 4.5 6c.2 1-.4 1.8-1.4 1.8-1 0-1.8-.8-3.1-.8s-2.1.8-3.1.8c-1 0-1.6-.8-1.4-1.8z')
    ],
    'Bluey': [], // silhueta exacta via img/icone-bluey.png
    'Bonecos': [
        circle(12, 7, 3.2),
        path('M6.5 20v-1.2c0-2.6 2.5-4.8 5.5-4.8s5.5 2.2 5.5 4.8V20'),
        path('M9 20v-1.5'),
        path('M15 20v-1.5')
    ],
    'Cidade': [
        path('M3 21h18'),
        path('M5 21V10l5-5 4 4v12'),
        path('M14 21V9h5v12'),
        path('M8 13h2'),
        path('M8 16h2'),
        path('M16 12h1.5'),
        path('M16 15h1.5')
    ],
    'DC Comics': [
        path(
            'M2 11.07L2 12.56L3.85 14.78L5.7 15.52L6.44 14.04L7.56 14.04L8.3 14.78L8.3 15.52L8.67 15.52L9.41 14.41L10.15 14.41L11.63 16.26L12.74 16.26L14.22 14.41L15.33 14.41L15.7 15.15L16.07 15.15L17.19 14.04L17.93 14.04L18.3 15.15L19.41 15.15L20.52 14.78L22 12.93L22 10.33L21.63 9.59L20.52 8.48L19.04 7.74L16.81 7.74L16.81 8.85L15.7 9.96L14.59 9.96L13.85 9.22L13.85 8.11L13.11 7.74L13.11 8.48L12 9.59L11.26 8.85L11.26 8.11L10.52 7.74L10.52 9.22L9.78 9.96L8.67 9.96L7.19 8.48L7.19 7.74L5.7 7.74L3.85 8.48L2.74 9.59ZM2.74 10.7L4.22 8.85L6.44 8.11L7.19 9.59L8.3 10.33L10.15 10.33L11.26 9.59L12.37 9.59L12.74 9.22L14.22 10.33L15.7 10.33L16.81 9.96L17.19 8.85L18.3 8.11L19.41 8.48L21.26 9.96L21.63 10.7L21.63 12.93L19.78 14.78L19.04 14.78L18.3 13.67L17.19 13.67L16.81 14.04L14.59 13.67L12.37 15.52L11.63 15.52L10.15 13.67L9.04 14.41L7.56 13.67L5.7 13.67L5.7 14.04L4.59 14.78L3.85 14.41L2.74 12.93Z',
            { fill: 'currentColor', stroke: 'none', 'fill-rule': 'evenodd' }
        )
    ],
    'Dinossauros': [], // silhueta exacta via img/icone-dinossauros.png (máscara CSS)
    'Disney': [
        path('M4 21h16'),
        path('M6 21V11l3-2.5V8l1.5-1.2L12 5l1.5 1.8L15 8v.5L18 11v10'),
        path('M9.5 21v-4h5v4'),
        path('M11 8.5h2'),
        path('M10 12h1.5'),
        path('M12.5 12H14'),
        path('M10 15h1.5'),
        path('M12.5 15H14')
    ],
    'Diversos': [
        path('M10.2 4.5a2.2 2.2 0 0 1 3.6 0l.4.6a1.2 1.2 0 0 0 1.4.5l.7-.3a2.2 2.2 0 0 1 2.9 2.9l-.3.7a1.2 1.2 0 0 0 .5 1.4l.6.4a2.2 2.2 0 0 1 0 3.6l-.6.4a1.2 1.2 0 0 0-.5 1.4l.3.7a2.2 2.2 0 0 1-2.9 2.9l-.7-.3a1.2 1.2 0 0 0-1.4.5l-.4.6a2.2 2.2 0 0 1-3.6 0l-.4-.6a1.2 1.2 0 0 0-1.4-.5l-.7.3a2.2 2.2 0 0 1-2.9-2.9l.3-.7a1.2 1.2 0 0 0-.5-1.4l-.6-.4a2.2 2.2 0 0 1 0-3.6l.6-.4a1.2 1.2 0 0 0 .5-1.4l-.3-.7a2.2 2.2 0 0 1 2.9-2.9l.7.3a1.2 1.2 0 0 0 1.4-.5z'),
        circle(12, 12, 2)
    ],
    'Dragon Ball': [
        circle(12, 12, 9),
        path('M12 7.2l1.1 2.2 2.4.4-1.7 1.7.4 2.4L12 12.8l-2.2 1.1.4-2.4-1.7-1.7 2.4-.4z')
    ],
    'Famosos': [
        circle(12, 8, 3.5),
        path('M5 20v-.8c0-2.9 3.1-5.2 7-5.2s7 2.3 7 5.2V20'),
        path('M9 4.5l1.2 1.2'),
        path('M15 4.5l-1.2 1.2')
    ],
    'Faroeste': [
        path('M4 20h16'),
        path('M6 20V10l6-5 6 5v10'),
        path('M10 20v-5h4v5'),
        path('M9 12h2'),
        path('M13 12h2')
    ],
    'Filmes e Séries': [
        path('M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5z'),
        path('M15 10.2l5.2-3a.8.8 0 0 1 1.2.7v8.2a.8.8 0 0 1-1.2.7l-5.2-3z')
    ],
    'Futebol': [
        circle(12, 12, 9),
        path('M12 7.2l2.2 1.6-.8 2.6H10.6l-.8-2.6z'),
        path('M7.2 10.5l2.2 1.6-.8 2.6H5.8l.2-1.4z'),
        path('M16.8 10.5l-2.2 1.6.8 2.6h2.8l-.2-1.4z'),
        path('M8.8 16.8l.8-2.6h4.8l.8 2.6')
    ],
    'Ghostbusters': [
        /* Fantasma da referência: braços laterais, base ondulada, 2 olhos + boca O (sem nariz) */
        path('M12 5c-3 0-5.2 2.2-5.2 5v1.4H5.2c-.55 0-1 .45-.95 1l.35 1.55c.08.4.45.7.85.7H6.8v1.5c0 .55.15 1 .7 1.15.35.1.7-.05.9-.3l.85-1.05 1.15 1.4c.2.25.55.25.75 0l1.15-1.4.85 1.05c.2.25.55.4.9.3.55-.15.7-.6.7-1.15v-1.5h1.35c.4 0 .77-.3.85-.7l.35-1.55c.05-.55-.4-1-.95-1h-1.6V10c0-2.8-2.2-5-5.2-5z'),
        circle(10.2, 10.5, 0.85),
        circle(13.8, 10.5, 0.85),
        circle(12, 13.2, 1.15)
    ],
    'Harry Potter': [
        path('M5 19L16.5 7.5'),
        path('M16 7l2.5-2.5'),
        path('M17.5 5.5l1.2-.2'),
        path('M17.5 5.5l.2-1.2'),
        path('M17.5 5.5l1 .8'),
        path('M7.5 16.5h2.8')
    ],
    'Image Comics': [
        path('M4 8.5c2.5-1.2 4.8-1.8 8-1.8s5.5.6 8 1.8'),
        path('M4 12c2.5-1 4.8-1.5 8-1.5s5.5.5 8 1.5'),
        path('M4 15.5c2.5-.8 4.8-1.2 8-1.2s5.5.4 8 1.2')
    ],
    'Jogos': [
        path('M6.5 8.5h11A2.5 2.5 0 0 1 20 11v3.5A2.5 2.5 0 0 1 17.5 17h-11A2.5 2.5 0 0 1 4 14.5V11a2.5 2.5 0 0 1 2.5-2.5z'),
        path('M8 11v3'),
        path('M6.5 12.5h3'),
        circle(15.2, 11.3, 0.7),
        circle(16.8, 13.3, 0.7)
    ],
    'Looney Tunes': [
        path('M8 6.5c0-1.5 1.3-2.5 3-2.5h2c1.7 0 3 1 3 2.5 0 1.2-.5 1.8-1 2.5 1.8.8 3 2.5 3 4.5 0 3.2-2.7 5-5 5H11c-2.3 0-5-1.8-5-5 0-2 1.2-3.7 3-4.5-.5-.7-1-1.3-1-2.5z'),
        circle(10, 12.5, 0.8),
        circle(14, 12.5, 0.8),
        path('M11 15h2')
    ],
    'Marvel': [
        circle(12, 12, 9),
        circle(12, 12, 5.5),
        path('M12 7.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 13.2l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z')
    ],
    'Masters of the Universe': [
        path('M12 3l2.2 4.4 4.8.7-3.5 3.4.8 4.8L12 14.2 7.7 16.3l.8-4.8L5 8.1l4.8-.7z'),
        circle(12, 10.5, 2)
    ],
    'Medieval': [
        path('M4 21h16'),
        path('M6 21V9l3-3v2l3-3 3 3v-2l3 3v12'),
        path('M10 21v-5h4v5'),
        path('M9 12h1.5'),
        path('M13.5 12H15')
    ],
    'Militar': [
        path('M12 3l8 3.2v5.6c0 4.8-3.2 8.4-8 9.7-4.8-1.3-8-4.9-8-9.7V6.2z'),
        path('M9 12.5h6'),
        path('M12 9.5v6')
    ],
    'NBA': [
        circle(12, 12, 9),
        path('M4.8 8.5c2.5 1.4 5.2 2.2 7.2 2.2s4.7-.8 7.2-2.2'),
        path('M4.8 15.5c2.5-1.4 5.2-2.2 7.2-2.2s4.7.8 7.2 2.2'),
        path('M12 3c2.2 2.8 3.3 5.8 3.3 9S14.2 18.2 12 21'),
        path('M12 3c-2.2 2.8-3.3 5.8-3.3 9S9.8 18.2 12 21')
    ],
    'Ninjago': [
        path('M5.5 7.5l5 5-1.8 5.2L4 17z'),
        path('M18.5 7.5l-5 5 1.8 5.2L20 17z'),
        path('M9.2 14.8l5.6-5.6'),
        path('M5.5 7.5l1.5-2'),
        path('M18.5 7.5l-1.5-2')
    ],
    'O Senhor dos Anéis': [
        circle(12, 12, 8),
        circle(12, 12, 4.5)
    ],
    'One Piece': [
        /* Chapéu de palha — copa + fita + aba larga */
        path('M7.2 12.2V9.2a4.8 4.8 0 0 1 9.6 0v3'),
        path('M7 11.6h10'),
        path('M7 13h10'),
        path('M2.8 14.2c2.2-1.6 5.4-2.4 9.2-2.4s7 0.8 9.2 2.4c.25.2.1.7-.3.7H3.1c-.4 0-.55-.5-.3-.7z'),
        path('M4 15.6c2-.7 4.8-1.1 8-1.1s6 .4 8 1.1')
    ],
    'Os Simpsons': [
        path('M8 9.5c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5v5.5c0 2.5-1.8 4.5-4 4.5s-4-2-4-4.5z'),
        circle(10.2, 11, 0.7),
        circle(13.8, 11, 0.7),
        path('M11.2 13.5h1.6'),
        path('M9.5 6.2c1-.8 2.2-1.2 3.5-1')
    ],
    'Piratas das Caraíbas': [
        circle(12, 9.5, 4.2),
        path('M9.2 9.2h.01'),
        path('M14.8 9.2h.01'),
        path('M10 11.5c.6.5 1.3.8 2 .8s1.4-.3 2-.8'),
        path('M7.5 14.5l-2.5 4.5'),
        path('M16.5 14.5l2.5 4.5'),
        path('M9 15.5l-3.5 3'),
        path('M15 15.5l3.5 3')
    ],
    'Rua Sésamo': [
        circle(8.5, 9, 3.2),
        circle(15.5, 9, 3.2),
        path('M5.5 20v-4.5c0-1.4 1.1-2.5 2.5-2.5h1'),
        path('M18.5 20v-4.5c0-1.4-1.1-2.5-2.5-2.5h-1'),
        path('M10.5 13.5l1.5 1.5 1.5-1.5')
    ],
    'Star Wars': [
        path('M8 8.5c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5v1.5H8z'),
        path('M7.5 10h9v2.5c0 1.2-.5 2.2-1.3 2.9L16.5 20H7.5l1.3-4.6C8 14.7 7.5 13.7 7.5 12.5z'),
        path('M9.5 13.5h5'),
        path('M10 16.5h4')
    ],
    'Stranger Things': [
        path('M5 7.5c1.5-2.2 4-3.5 7-3.5s5.5 1.3 7 3.5'),
        path('M4 12h9'),
        path('M10 9l3 3-3 3'),
        path('M5 16.5c1.5 2.2 4 3.5 7 3.5s5.5-1.3 7-3.5')
    ],
    'Tartarugas Ninja': [
        path('M8 8.5c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5v1c1.7.4 3 1.9 3 3.7 0 2.6-2.2 4.3-4.5 4.3h-5C7.2 17.5 5 15.8 5 13.2c0-1.8 1.3-3.3 3-3.7z'),
        path('M9.5 11.5h.01'),
        path('M14.5 11.5h.01'),
        path('M10.5 14h3'),
        path('M7 9.5l-1.5-1'),
        path('M17 9.5l1.5-1')
    ],
    'Tempos Antigos': [
        path('M3 19h18'),
        path('M5 19l4-8 3 5 3-4 4 7'),
        path('M16 9.5l1.5-1.5'),
        path('M17.5 8l1.2.3'),
        path('M17.5 8l.3-1.2')
    ],
    'Thundercats': [
        path('M6 10.5c0-2.8 2.7-5 6-5s6 2.2 6 5c0 1.5-.6 2.8-1.6 3.7L18 20H6l1.6-5.8A5.4 5.4 0 0 1 6 10.5z'),
        path('M9 8.5c.7-.7 1.7-1.1 2.8-1'),
        path('M15 8.5c-.7-.7-1.7-1.1-2.8-1'),
        path('M10 12h.01'),
        path('M14 12h.01'),
        path('M11 14.5h2')
    ],
    'Toy Story': [
        path('M8 9.5V8a4 4 0 0 1 8 0v1.5'),
        path('M7 9.5h10A2 2 0 0 1 19 11.5v7A2 2 0 0 1 17 20.5H7A2 2 0 0 1 5 18.5v-7A2 2 0 0 1 7 9.5z'),
        path('M9.5 13.5h.01'),
        path('M14.5 13.5h.01'),
        path('M10.5 16.5h3')
    ]
};

function criarIconeTema(tema = '') {
    const mascara = MAPA_ICONES_MASCARA[tema];
    if (mascara) {
        const el = document.createElement('span');
        el.className = tema === 'DC Comics' ? 'icone-tema-mask icone-tema-dc' : 'icone-tema-mask';
        el.style.webkitMaskImage = `url('${mascara}')`;
        el.style.maskImage = `url('${mascara}')`;
        el.setAttribute('aria-hidden', 'true');
        return el;
    }
    const partes = MAPA_ICONES_TEMAS[tema] || MAPA_ICONES_TEMAS['Diversos'];
    return criarSvgTema(partes);
}

function criarRotuloTema(temaTexto) {
    const conteudo = document.createElement('span');
    conteudo.className = 'conteudo-tema';

    const icone = criarIconeTema(temaTexto);
    icone.classList.add('icone-tema');

    const nomeTema = document.createElement('span');
    nomeTema.className = 'nome-tema';
    nomeTema.textContent = temaTexto;

    conteudo.appendChild(icone);
    conteudo.appendChild(nomeTema);
    return conteudo;
}

function obterClienteProdutosLoja() {
    const cliente = produtosClient || dbClient;
    if (!cliente) {
        throw new Error('Cliente Supabase indisponível.');
    }
    return cliente;
}

function mesclarProdutosNoCatalogoLocal(produtos = []) {
    if (!produtos.length) return;
    const existentes = new Set((todosOsProdutos || []).map(produto => String(produto.id)));
    todosOsProdutos.push(...produtos.filter(produto => !existentes.has(String(produto.id))));
}

function construirMapaTemasLoja(metadados = []) {
    mapaTemasLoja.clear();
    const mapa = {};

    metadados.forEach(item => {
        const tema = (item.tema || 'Outros').trim();
        const subtema = (item.subtema && item.subtema !== 'semsubtema') ? item.subtema.trim() : '';
        if (!mapa[tema]) mapa[tema] = [];
        if (subtema && !mapa[tema].includes(subtema)) mapa[tema].push(subtema);
    });

    Object.keys(mapa).forEach(tema => {
        const temaId = slugificarTemaLoja(tema);
        const subtemas = new Map();
        mapa[tema].forEach(subtema => subtemas.set(slugificarTemaLoja(subtema), subtema));
        mapaTemasLoja.set(temaId, { nome: tema, subtemas });
    });

    return Object.keys(mapa).map(tema => ({ tema, subtema: 'semsubtema' }));
}

function obterFiltrosVitrineAtuais() {
    const pesquisa = typeof obterValorPesquisaLoja === 'function'
        ? obterValorPesquisaLoja().trim()
        : String(document.getElementById('campo-pesquisa')?.value || '').trim();
    const partes = filtroTemaAtual.split('|');
    const slugTema = partes[0];
    const slugSubtema = partes[1] || '';
    const filtros = { pesquisa, tema: null, subtema: null };

    if (!pesquisa && filtroTemaAtual !== 'todos' && mapaTemasLoja.has(slugTema)) {
        const info = mapaTemasLoja.get(slugTema);
        filtros.tema = info.nome;
        if (slugSubtema) filtros.subtema = info.subtemas.get(slugSubtema) || null;
    }

    return filtros;
}

function aplicarFiltrosQueryProdutos(query, filtros) {
    let consulta = query.eq('ativo', true).eq('arquivado', false);

    if (filtros.pesquisa) {
        return consulta.ilike('nome', `%${filtros.pesquisa}%`);
    }
    if (filtros.tema) consulta = consulta.eq('tema', filtros.tema);
    if (filtros.subtema) consulta = consulta.eq('subtema', filtros.subtema);
    return consulta;
}

function deveBaralharPrimeiraPaginaVitrine(filtros) {
    return !String(filtros?.pesquisa || '').trim() && !filtros?.tema && filtroTemaAtual === 'todos';
}

function baralharProdutosVitrine(lista) {
    const itens = Array.isArray(lista) ? lista.slice() : [];
    for (let i = itens.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = itens[i];
        itens[i] = itens[j];
        itens[j] = temp;
    }
    return itens;
}

function reiniciarEstadoPaginacaoVitrine() {
    vitrineModoAleatorio = false;
    vitrineInicioAleatorio = 0;
    vitrineCursorCatalogo = 0;
    vitrineVoltaAoInicio = false;
    offsetProdutosRemotos = 0;
    haMaisProdutosRemotos = false;
}

function criarConsultaProdutosLoja(cliente, filtros) {
    return aplicarFiltrosQueryProdutos(
        cliente
            .from('produtos_loja')
            .select(CAMPOS_PRODUTO_LOJA, { count: 'exact' })
            .order('tema', { ascending: true })
            .order('subtema', { ascending: true })
            .order('nome', { ascending: true })
            .order('id', { ascending: true }),
        filtros
    );
}

async function contarProdutosLoja(cliente, filtros) {
    const { count, error } = await executarComTimeout(
        aplicarFiltrosQueryProdutos(
            cliente
                .from('produtos_loja')
                .select('id', { count: 'exact', head: true }),
            filtros
        ),
        20000,
        'Contagem de produtos demasiado lenta.'
    );
    if (error) throw error;
    return Math.max(0, Number(count || 0));
}

async function buscarProdutosLojaIntervalo(cliente, filtros, inicio, fimInclusivo) {
    if (fimInclusivo < inicio) return [];
    const { data, error } = await executarComTimeout(
        criarConsultaProdutosLoja(cliente, filtros).range(inicio, fimInclusivo),
        20000,
        'Consulta de produtos demasiado lenta.'
    );
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

async function carregarMetadadosTemasLoja() {
    let metadados = lerCacheTemasLoja();

    if (!metadados?.length) {
        const cliente = obterClienteProdutosLoja();
        metadados = [];
        let inicio = 0;

        while (true) {
            const { data: pagina, error } = await executarComTimeout(
                cliente
                    .from('produtos_loja')
                    .select('tema, subtema')
                    .eq('ativo', true)
                    .eq('arquivado', false)
                    .order('tema', { ascending: true })
                    .order('subtema', { ascending: true })
                    .range(inicio, inicio + TAMANHO_PAGINA_METADADOS - 1),
                20000,
                'Consulta de temas demasiado lenta.'
            );

            if (error) throw error;
            if (!pagina?.length) break;

            metadados.push(...pagina);
            if (pagina.length < TAMANHO_PAGINA_METADADOS) break;
            inicio += TAMANHO_PAGINA_METADADOS;
        }

        guardarCacheTemasLoja(metadados);
    }

    construirMapaTemasLoja(metadados);
    return metadados;
}

function lerCacheTemasLoja() {
    try {
        const bruto = sessionStorage.getItem(CACHE_TEMAS_LOJA_CHAVE);
        if (!bruto) return null;
        const dados = JSON.parse(bruto);
        if (!dados?.guardadoEm || !Array.isArray(dados.metadados)) return null;
        if (Date.now() - dados.guardadoEm > CACHE_TEMAS_LOJA_TTL_MS) return null;
        return dados.metadados;
    } catch (erro) {
        return null;
    }
}

function guardarCacheTemasLoja(metadados) {
    try {
        sessionStorage.setItem(CACHE_TEMAS_LOJA_CHAVE, JSON.stringify({
            guardadoEm: Date.now(),
            metadados
        }));
    } catch (erro) {
        // Ignorar quota ou modo privado.
    }
}

async function carregarPaginaProdutosLoja({ reiniciar = false } = {}) {
    if (promessaCargaProdutosEmCurso) {
        if (reiniciar) reinicioProdutosPendente = true;
        return promessaCargaProdutosEmCurso;
    }

    promessaCargaProdutosEmCurso = (async () => {
        carregandoProdutosRemotos = true;
        atualizarBarraCarregarMaisVitrine();

        try {
            const cliente = obterClienteProdutosLoja();
            const filtros = obterFiltrosVitrineAtuais();
            const limite = PRODUTOS_POR_PAGINA_SERVIDOR;
            const baralharAbertura = reiniciar && deveBaralharPrimeiraPaginaVitrine(filtros);

            if (reiniciar) {
                reiniciarEstadoPaginacaoVitrine();
                totalProdutosRemotos = await contarProdutosLoja(cliente, filtros);

                let produtosPagina = [];
                if (baralharAbertura && totalProdutosRemotos > 0) {
                    vitrineModoAleatorio = true;
                    vitrineInicioAleatorio = Math.floor(Math.random() * totalProdutosRemotos);
                    vitrineCursorCatalogo = vitrineInicioAleatorio;
                    vitrineVoltaAoInicio = false;

                    const fim = Math.min(vitrineCursorCatalogo + limite - 1, totalProdutosRemotos - 1);
                    produtosPagina = await buscarProdutosLojaIntervalo(
                        cliente, filtros, vitrineCursorCatalogo, fim
                    );
                    vitrineCursorCatalogo = fim + 1;
                    if (vitrineCursorCatalogo >= totalProdutosRemotos) {
                        vitrineCursorCatalogo = 0;
                        vitrineVoltaAoInicio = true;
                    }

                    if (produtosPagina.length < limite && vitrineVoltaAoInicio && vitrineInicioAleatorio > 0) {
                        const falta = limite - produtosPagina.length;
                        const fimExtra = Math.min(falta - 1, vitrineInicioAleatorio - 1);
                        const extra = await buscarProdutosLojaIntervalo(cliente, filtros, 0, fimExtra);
                        produtosPagina = produtosPagina.concat(extra);
                        vitrineCursorCatalogo = fimExtra + 1;
                    }

                    produtosPagina = baralharProdutosVitrine(produtosPagina);
                    offsetProdutosRemotos = produtosPagina.length;
                    haMaisProdutosRemotos = offsetProdutosRemotos < totalProdutosRemotos
                        && !(vitrineVoltaAoInicio && vitrineCursorCatalogo >= vitrineInicioAleatorio);
                } else {
                    produtosPagina = await buscarProdutosLojaIntervalo(
                        cliente, filtros, 0, Math.max(0, limite - 1)
                    );
                    offsetProdutosRemotos = produtosPagina.length;
                    haMaisProdutosRemotos = offsetProdutosRemotos < totalProdutosRemotos;
                }

                mesclarProdutosNoCatalogoLocal(produtosPagina);
                produtosFiltradosAtual = produtosPagina;
                produtosVitrineAtual = produtosPagina;
                indiceRenderizado = 0;
                return;
            }

            let produtosPagina = [];
            if (vitrineModoAleatorio) {
                if (!vitrineVoltaAoInicio) {
                    if (vitrineCursorCatalogo >= totalProdutosRemotos) {
                        vitrineCursorCatalogo = 0;
                        vitrineVoltaAoInicio = true;
                    } else {
                        const fim = Math.min(vitrineCursorCatalogo + limite - 1, totalProdutosRemotos - 1);
                        produtosPagina = await buscarProdutosLojaIntervalo(
                            cliente, filtros, vitrineCursorCatalogo, fim
                        );
                        vitrineCursorCatalogo = fim + 1;
                        if (vitrineCursorCatalogo >= totalProdutosRemotos) {
                            vitrineCursorCatalogo = 0;
                            vitrineVoltaAoInicio = true;
                        }
                    }
                }

                if (vitrineVoltaAoInicio && produtosPagina.length < limite && vitrineCursorCatalogo < vitrineInicioAleatorio) {
                    const falta = limite - produtosPagina.length;
                    const fim = Math.min(vitrineCursorCatalogo + falta - 1, vitrineInicioAleatorio - 1);
                    const extra = await buscarProdutosLojaIntervalo(
                        cliente, filtros, vitrineCursorCatalogo, fim
                    );
                    produtosPagina = produtosPagina.concat(extra);
                    vitrineCursorCatalogo = fim + 1;
                }

                offsetProdutosRemotos += produtosPagina.length;
                haMaisProdutosRemotos = offsetProdutosRemotos < totalProdutosRemotos
                    && !(vitrineVoltaAoInicio && vitrineCursorCatalogo >= vitrineInicioAleatorio);
            } else {
                const offset = offsetProdutosRemotos;
                produtosPagina = await buscarProdutosLojaIntervalo(
                    cliente, filtros, offset, offset + limite - 1
                );
                offsetProdutosRemotos = offset + produtosPagina.length;
                haMaisProdutosRemotos = offsetProdutosRemotos < totalProdutosRemotos;
            }

            mesclarProdutosNoCatalogoLocal(produtosPagina);
            produtosFiltradosAtual.push(...produtosPagina);
            produtosVitrineAtual = produtosFiltradosAtual;
        } finally {
            carregandoProdutosRemotos = false;
            promessaCargaProdutosEmCurso = null;
            atualizarIndicadoresProgressoVitrine();
        }
    })();

    return promessaCargaProdutosEmCurso;
}

async function carregarProdutosDaNuvem(){
    definirEstadoVitrine('A carregar produtos...');
    try{
        todosOsProdutos = [];
        catalogoAdminCarregado = false;
        reiniciarEstadoPaginacaoVitrine();
        totalProdutosRemotos = 0;

        const metadadosTemas = await carregarMetadadosTemasLoja();
        if (!metadadosTemas.length) {
            definirEstadoVitrine('Nenhum produto encontrado.', 'erro');
            return;
        }

        gerarMenus(metadadosTemas);
        await reiniciarVitrinePaginada();
        atualizarCarrinhoSeDisponivel();
    }catch(erro){
        console.error('Erro ao carregar produtos da loja:', erro);
        definirEstadoVitrine(
            'Não foi possível carregar os produtos. Tenta novamente dentro de momentos.',
            'erro'
        );
    }
}


function gerarMenus(listaProdutos){
    const menu = document.getElementById('menu-lateral-temas');
    if (!menu) return;
    menu.replaceChildren();

    const cabecalho = document.createElement('div');
    cabecalho.className = 'cabecalho-menu-temas';

    const tituloMenu = document.createElement('h2');
    tituloMenu.textContent = 'Categorias';
    cabecalho.appendChild(tituloMenu);

    const toggleMenu = document.createElement('button');
    toggleMenu.className = 'btn-toggle-menu';
    toggleMenu.type = 'button';
    toggleMenu.textContent = 'Recolher';
    toggleMenu.onclick = function(){
        const recolhido = listaTemas.classList.toggle('recolhida');
        toggleMenu.textContent = recolhido ? 'Mostrar' : 'Recolher';
        sincronizarBotaoCategoriasCabecalho();
        agendarAtualizacaoStickyTemas();
    };
    cabecalho.appendChild(toggleMenu);
    menu.appendChild(cabecalho);

    const listaTemas = document.createElement('div');
    listaTemas.className = 'lista-temas';
    const iniciarRecolhido = window.matchMedia && window.matchMedia('(max-width: 1100px)').matches;
    if (iniciarRecolhido) {
        listaTemas.classList.add('recolhida');
        toggleMenu.textContent = 'Mostrar';
    }

    const blocoPesquisa = document.createElement('div');
    blocoPesquisa.className = 'menu-temas-pesquisa';
    const campoMenu = document.createElement('input');
    campoMenu.type = 'search';
    campoMenu.id = 'campo-pesquisa-menu';
    campoMenu.className = 'input-pesquisa input-pesquisa-menu';
    campoMenu.name = 'q-menu';
    campoMenu.placeholder = 'O que estás à procura?';
    campoMenu.autocomplete = 'off';
    campoMenu.setAttribute('enterkeyhint', 'search');
    campoMenu.setAttribute('aria-label', 'Pesquisar produtos');
    campoMenu.value = typeof obterValorPesquisaLoja === 'function'
        ? obterValorPesquisaLoja()
        : (document.getElementById('campo-pesquisa')?.value || '');
    campoMenu.addEventListener('input', () => {
        if (typeof definirValorPesquisaLoja === 'function') {
            definirValorPesquisaLoja(campoMenu.value, campoMenu);
        }
        window.clearTimeout(window.__pesquisaLojaTimer);
        window.__pesquisaLojaTimer = window.setTimeout(() => {
            if (typeof executarFiltrosCombinados === 'function') executarFiltrosCombinados();
        }, 250);
    });
    campoMenu.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        if (typeof definirValorPesquisaLoja === 'function') {
            definirValorPesquisaLoja(campoMenu.value, campoMenu);
        }
        if (typeof executarFiltrosCombinados === 'function') {
            executarFiltrosCombinados({ rolarParaProdutos: true });
        }
    });
    blocoPesquisa.appendChild(campoMenu);
    listaTemas.appendChild(blocoPesquisa);

    menu.appendChild(listaTemas);

    const todosBtn = document.createElement('button');
    todosBtn.className = 'btn-tema ativo';
    todosBtn.dataset.filtroTema = 'todos';
    todosBtn.appendChild(criarRotuloTema('Todos'));
    todosBtn.onclick = function(){ filtrarTema('todos', this); };
    listaTemas.appendChild(todosBtn);

    const mapa = {};
    listaProdutos.forEach(prod => {
        const tema = (prod.tema || 'Outros').trim();
        const subtema = (prod.subtema && prod.subtema !== 'semsubtema') ? prod.subtema.trim() : '';
        if(!mapa[tema]){ mapa[tema] = []; }
        if(subtema && !mapa[tema].includes(subtema)){ mapa[tema].push(subtema); }
    });

    Object.keys(mapa).forEach(tema => {
        const temaId = tema.toLowerCase().replace(/\s+/g, '-');
        const linhaTema = document.createElement('div');
        linhaTema.className = 'linha-tema';

        const btnTema = document.createElement('button');
        btnTema.className = 'btn-tema';
        btnTema.dataset.filtroTema = temaId;

        btnTema.appendChild(criarRotuloTema(tema));

        if(mapa[tema].length > 0){
            btnTema.classList.add('btn-tema-com-subtemas');
            const indicador = document.createElement('span');
            indicador.className = 'indicador-tema';
            indicador.textContent = '+';
            btnTema.appendChild(indicador);

            const group = document.createElement('div');
            group.className = 'grupo-subtemas';
            group.id = 'grupo-' + temaId;

            btnTema.onclick = function(){
                const estavaAberto = group.classList.contains('aberto');
                document.querySelectorAll('.grupo-subtemas').forEach(g => g.classList.remove('aberto'));
                document.querySelectorAll('.indicador-tema').forEach(i => i.textContent = '+');
                if(!estavaAberto){
                    group.classList.add('aberto');
                    indicador.textContent = '-';
                }
                filtrarTema(temaId, this);
                agendarAtualizacaoStickyTemas();
            };

            mapa[tema].forEach(subtema => {
                const subId = subtema.toLowerCase().replace(/\s+/g, '-');
                const btnSub = document.createElement('button');
                btnSub.className = 'btn-subtema';
                btnSub.dataset.filtroTema = temaId + '|' + subId;
                btnSub.textContent = subtema;
                btnSub.onclick = function(e){
                    e.stopPropagation();
                    filtrarTema(temaId + '|' + subId, this);
                };
                group.appendChild(btnSub);
            });
            linhaTema.appendChild(btnTema);
            linhaTema.appendChild(group);
        } else {
            btnTema.onclick = function(){ filtrarTema(temaId, this); };
            linhaTema.appendChild(btnTema);
        }

        listaTemas.appendChild(linhaTema);
    });

    observarTamanhoMenuTemas();
    agendarAtualizacaoStickyTemas();
    sincronizarBotaoCategoriasCabecalho();
    ligarFecharCategoriasAoScrollTelemovel();
    atualizarBreadcrumbLoja();
}

function criarIconeCoracaoFavorito() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 21s-7.5-4.6-10-9.2C-0.3 7.5 2.2 3 6.7 3c2.1 0 4 1.2 5.3 3 1.3-1.8 3.2-3 5.3-3 4.5 0 7 4.5 4.7 8.8C19.5 16.4 12 21 12 21z');
    svg.appendChild(path);
    return svg;
}

function criarCardProduto(prod) {
    const card = document.createElement('div');
    card.className = 'produto-card';
    card.dataset.id = prod.id;

    const nomeLimpo = (prod.nome || '').trim().toLowerCase();
    card.dataset.nome = nomeLimpo;
    card.dataset.tema = (prod.tema || '').toLowerCase().replace(/\s+/g, '-');
    card.dataset.subtema = (prod.subtema || '').toLowerCase().replace(/\s+/g, '-');

    let listaImagens = [];
    if (prod.imagens) {
        if (Array.isArray(prod.imagens)) {
            listaImagens = prod.imagens;
        } else if (typeof prod.imagens === 'string') {
            const textoLimpo = prod.imagens.trim();
            if (textoLimpo.startsWith('[') && textoLimpo.endsWith(']')) {
                try {
                    listaImagens = JSON.parse(textoLimpo);
                } catch (e) {
                    listaImagens = textoLimpo.replace(/[\[\]"]/g, '').split(',').map(s => s.trim());
                }
            } else {
                listaImagens = [textoLimpo];
            }
        }
    }

    listaImagens = listaImagens.filter(url => url && typeof url === 'string' && url.trim() !== '');
    const imagemFallback = 'img/sem-imagem.png?v=20260719-sem-texto';
    const imagensOtimizadas = listaImagens.map(url => otimizarImagemCloudinary(url, 520));
    const urlPrincipal = listaImagens[0] || imagemFallback;
    const imagemResponsiva = otimizarImagemCloudinarySrcset(urlPrincipal);
    const imagemInicial = imagemResponsiva.src || imagensOtimizadas[0] || imagemFallback;

    const botaoFavorito = document.createElement('button');
    botaoFavorito.className = 'favorite-btn';
    botaoFavorito.type = 'button';
    botaoFavorito.dataset.favoritoProdutoId = String(prod.id);
    botaoFavorito.appendChild(criarIconeCoracaoFavorito());
    if (typeof produtoEstaNosFavoritos === 'function' && typeof atualizarBotaoFavorito === 'function') {
        atualizarBotaoFavorito(botaoFavorito, produtoEstaNosFavoritos(prod.id));
    }
    botaoFavorito.addEventListener('click', (evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        const alternar = () => {
            if (typeof alternarFavoritoProduto === 'function') {
                alternarFavoritoProduto(prod);
            }
        };
        if (typeof alternarFavoritoProduto === 'function') {
            alternar();
            return;
        }
        if (typeof window.garantirAppFavoritos === 'function') {
            window.garantirAppFavoritos().then(alternar).catch(console.error);
        }
    });
    card.appendChild(botaoFavorito);

    const imagemPrincipal = document.createElement('img');
    imagemPrincipal.className = 'produto-img';
    imagemPrincipal.loading = 'lazy';
    imagemPrincipal.decoding = 'async';
    imagemPrincipal.dataset.srcOriginal = imagemInicial;
    if (imagemResponsiva.srcset) {
        imagemPrincipal.srcset = imagemResponsiva.srcset;
        imagemPrincipal.sizes = imagemResponsiva.sizes;
    }
    imagemPrincipal.addEventListener('load', () => {
        const iniciarPrecarregamento = () => {
            imagensOtimizadas.slice(1).forEach(precarregarImagemProduto);
        };
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciarPrecarregamento, { timeout: 1200 });
        } else {
            setTimeout(iniciarPrecarregamento, 100);
        }
    }, { once: true });
    imagemPrincipal.src = imagemInicial;
    imagemPrincipal.onerror = () => {
        if (imagemPrincipal.src.indexOf(imagemFallback) === -1) {
            imagemPrincipal.src = imagemFallback;
        }
    };

    const galeria = document.createElement('div');
    galeria.className = 'produto-galeria';
    galeria.setAttribute('role', 'button');
    galeria.setAttribute('tabindex', '0');
    galeria.setAttribute('aria-label', 'Ver foto ampliada de ' + (prod.nome || 'produto'));
    galeria.appendChild(imagemPrincipal);

    let imagemAtual = 0;
    let toqueInicioX = 0;
    let toqueInicioY = 0;
    const totalImagens = Math.max(1, imagensOtimizadas.length || 1);
    let indicadorGaleria = null;

    const obterUrlOriginalAtual = () => listaImagens[imagemAtual] || listaImagens[0] || imagemFallback;

    const atualizarImagem = (proximoIndice) => {
        if (totalImagens < 2) return;
        imagemAtual = (proximoIndice + totalImagens) % totalImagens;
        const proximaUrl = listaImagens[imagemAtual];
        const proximaImagem = imagensOtimizadas[imagemAtual];
        const responsivoNovo = otimizarImagemCloudinarySrcset(proximaUrl);
        imagemPrincipal.dataset.srcOriginal = proximaImagem;
        if (responsivoNovo.srcset) {
            imagemPrincipal.srcset = responsivoNovo.srcset;
            imagemPrincipal.sizes = responsivoNovo.sizes;
            imagemPrincipal.src = responsivoNovo.src;
        } else {
            imagemPrincipal.removeAttribute('srcset');
            imagemPrincipal.removeAttribute('sizes');
            imagemPrincipal.src = proximaImagem;
        }
        if (indicadorGaleria) {
            indicadorGaleria.textContent = (imagemAtual + 1) + ' / ' + totalImagens;
        }
        precarregarImagemProduto(imagensOtimizadas[(imagemAtual + 1) % totalImagens]);
        precarregarImagemProduto(imagensOtimizadas[(imagemAtual - 1 + totalImagens) % totalImagens]);
    };

    const abrirAmpliacaoAtual = () => {
        garantirListenersModalFotoLoja();
        abrirFotoProdutoAmpliada({
            urls: listaImagens.length ? listaImagens : [imagemFallback],
            indice: imagemAtual,
            alt: prod.nome || 'Produto',
            onChange: (indice) => {
                if (indice === imagemAtual) return;
                atualizarImagem(indice);
            }
        });
    };

    if (totalImagens > 1) {
        indicadorGaleria = document.createElement('span');
        indicadorGaleria.className = 'produto-galeria-indicador';
        indicadorGaleria.textContent = '1 / ' + totalImagens;

        const criarSeta = (classe, texto, direcao) => {
            const botao = document.createElement('button');
            botao.className = 'produto-galeria-seta ' + classe;
            botao.type = 'button';
            botao.textContent = texto;
            botao.setAttribute('aria-label', direcao < 0 ? 'Imagem anterior' : 'Imagem seguinte');
            const ativarSeta = (evento) => {
                evento.preventDefault();
                evento.stopPropagation();
                atualizarImagem(imagemAtual + direcao);
            };
            botao.addEventListener('pointerdown', (evento) => evento.stopPropagation());
            botao.addEventListener('click', ativarSeta);
            return botao;
        };

        galeria.appendChild(criarSeta('produto-galeria-seta-anterior', '<', -1));
        galeria.appendChild(criarSeta('produto-galeria-seta-seguinte', '>', 1));
        galeria.appendChild(indicadorGaleria);
    }

    galeria.addEventListener('pointerdown', (evento) => {
        if (evento.target.closest('.produto-galeria-seta')) return;
        toqueInicioX = evento.clientX;
        toqueInicioY = evento.clientY;
    });
    galeria.addEventListener('pointerup', (evento) => {
        if (evento.target.closest('.produto-galeria-seta')) return;
        const deltaX = evento.clientX - toqueInicioX;
        const deltaY = evento.clientY - toqueInicioY;
        if (totalImagens > 1 && Math.abs(deltaX) >= 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
            atualizarImagem(imagemAtual + (deltaX < 0 ? 1 : -1));
            return;
        }
        if (Math.abs(deltaX) >= 40 || Math.abs(deltaY) >= 40) return;
        abrirAmpliacaoAtual();
    });
    galeria.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter' && evento.key !== ' ') return;
        evento.preventDefault();
        abrirAmpliacaoAtual();
    });

    card.appendChild(galeria);

    const titulo = document.createElement('h3');
    titulo.innerText = prod.nome || '';
    card.appendChild(titulo);

    const category = document.createElement('div');
    category.className = 'categoria';
    category.innerText = prod.tema || 'Outros';
    card.appendChild(category);

    if (prod.subtema && prod.subtema !== 'semsubtema') {
        const subcategoria = document.createElement('div');
        subcategoria.className = 'subcategoria';
        subcategoria.innerText = prod.subtema;
        card.appendChild(subcategoria);
    }

    const preco = document.createElement('div');
    preco.className = 'preco';
    preco.innerText = formatarEuro(prod.preco) + ' €';
    card.appendChild(preco);

    const btn = document.createElement('button');
    btn.className = 'btn-adicionar';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Adicionar ao carrinho');
    const textoAdicionar = document.createElement('span');
    textoAdicionar.textContent = 'Adicionar';
    const iconeCarrinho = document.createElement('span');
    iconeCarrinho.className = 'icone-carrinho';
    iconeCarrinho.setAttribute('aria-hidden', 'true');
    btn.append(textoAdicionar, iconeCarrinho);
    btn.onclick = function () { adicionarAoCarrinho(prod); };
    card.appendChild(btn);

    return card;
}

function gerarProdutos(listaProdutos) {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;
    produtosVitrineAtual = listaProdutos;
    produtosFiltradosAtual = listaProdutos;
    indiceRenderizado = 0;
    totalProdutosRemotos = listaProdutos.length;
    offsetProdutosRemotos = listaProdutos.length;
    haMaisProdutosRemotos = false;
    mesclarProdutosNoCatalogoLocal(listaProdutos);
    removerSentinelaCarregarMais();
    vitrine.replaceChildren();
    renderizarMaisProdutosVitrine();
    atualizarContadorProdutos(listaProdutos.length, listaProdutos.length, false);
}

function removerSentinelaCarregarMais() {
    if (observadorCarregarMais) {
        observadorCarregarMais.disconnect();
        observadorCarregarMais = null;
    }
    if (sentinelaCarregarMais) {
        sentinelaCarregarMais.remove();
        sentinelaCarregarMais = null;
    }
}

function obterPesquisaAtivaVitrine() {
    const inputRaw = typeof obterValorPesquisaLoja === 'function'
        ? obterValorPesquisaLoja()
        : (document.getElementById('campo-pesquisa')?.value || '');
    const textoPesquisa = inputRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return textoPesquisa.length > 0 || filtroTemaAtual !== 'todos';
}

function atualizarIndicadoresProgressoVitrine() {
    atualizarBarraCarregarMaisVitrine();
}

function atualizarBarraCarregarMaisVitrine() {
    if (!sentinelaCarregarMais) return;
    const aindaHaMais = indiceRenderizado < produtosFiltradosAtual.length || haMaisProdutosRemotos;
    if (!aindaHaMais) {
        removerSentinelaCarregarMais();
        return;
    }

    sentinelaCarregarMais.classList.toggle('esta-carregando', Boolean(carregandoProdutosRemotos));
    const texto = sentinelaCarregarMais.querySelector('.vitrine-carregar-mais-texto');
    const detalhe = sentinelaCarregarMais.querySelector('.vitrine-carregar-mais-detalhe');
    if (texto) {
        texto.textContent = carregandoProdutosRemotos
            ? 'A carregar mais produtos…'
            : 'Há mais produtos abaixo';
    }
    if (detalhe) {
        const total = Math.max(totalProdutosRemotos, produtosFiltradosAtual.length);
        detalhe.textContent = total > 0
            ? `A mostrar ${indiceRenderizado.toLocaleString('pt-PT')} de ${total.toLocaleString('pt-PT')}`
            : '';
        detalhe.hidden = total <= 0;
    }
}

function criarBarraCarregarMaisVitrine() {
    const barra = document.createElement('div');
    barra.className = 'vitrine-carregar-mais';
    barra.setAttribute('role', 'status');
    barra.setAttribute('aria-live', 'polite');

    const texto = document.createElement('p');
    texto.className = 'vitrine-carregar-mais-texto';
    const detalhe = document.createElement('p');
    detalhe.className = 'vitrine-carregar-mais-detalhe';
    barra.append(texto, detalhe);
    return barra;
}

function agendarPrefetchProdutosLoja() {
    if (!haMaisProdutosRemotos || carregandoProdutosRemotos) return;
    const porRenderizar = produtosFiltradosAtual.length - indiceRenderizado;
    if (porRenderizar >= PRODUTOS_POR_LOTE * 2) return;

    carregarPaginaProdutosLoja()
        .then(() => {
            atualizarIndicadoresProgressoVitrine();
            agendarPrefetchProdutosLoja();
        })
        .catch((erro) => {
            console.error('Erro ao pré-carregar produtos:', erro);
            atualizarIndicadoresProgressoVitrine();
        });
}

function renderizarMaisProdutosVitrine() {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;

    const renderizar = async () => {
        removerSentinelaCarregarMais();

        if (indiceRenderizado >= produtosFiltradosAtual.length && haMaisProdutosRemotos && !carregandoProdutosRemotos) {
            await carregarPaginaProdutosLoja();
        }

        const fim = Math.min(indiceRenderizado + PRODUTOS_POR_LOTE, produtosFiltradosAtual.length);
        for (let i = indiceRenderizado; i < fim; i++) {
            vitrine.appendChild(criarCardProduto(produtosFiltradosAtual[i]));
        }
        indiceRenderizado = fim;
        atualizarBotoesFavoritos();
        atualizarIndicadoresProgressoVitrine();

        if (indiceRenderizado < produtosFiltradosAtual.length || haMaisProdutosRemotos) {
            sentinelaCarregarMais = criarBarraCarregarMaisVitrine();
            atualizarBarraCarregarMaisVitrine();
            vitrine.appendChild(sentinelaCarregarMais);
            observadorCarregarMais = new IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    renderizarMaisProdutosVitrine();
                }
            }, { rootMargin: '700px' });
            observadorCarregarMais.observe(sentinelaCarregarMais);
            agendarPrefetchProdutosLoja();
        }
    };

    renderizar().catch(erro => {
        console.error('Erro ao renderizar produtos:', erro);
        atualizarIndicadoresProgressoVitrine();
    });
}

async function reiniciarVitrinePaginada() {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;

    removerSentinelaCarregarMais();
    vitrine.replaceChildren();

    const inputRaw = typeof obterValorPesquisaLoja === 'function'
        ? obterValorPesquisaLoja()
        : (document.getElementById('campo-pesquisa')?.value || '');
    const textoPesquisa = inputRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const pesquisaAtiva = textoPesquisa.length > 0;

    await carregarPaginaProdutosLoja({ reiniciar: true });

    while (reinicioProdutosPendente) {
        reinicioProdutosPendente = false;
        await carregarPaginaProdutosLoja({ reiniciar: true });
    }

    if (produtosFiltradosAtual.length === 0) {
        const erroDiv = document.createElement('div');
        erroDiv.id = 'aviso-pesquisa-vazia';
        erroDiv.className = 'estado-vitrine erro';

        const figura = document.createElement('img');
        figura.className = 'estado-vitrine-figura';
        figura.src = 'img/sem-imagem.png?v=20260719-sem-texto';
        figura.alt = '';
        figura.width = 120;
        figura.height = 120;
        figura.decoding = 'async';

        const texto = document.createElement('p');
        texto.className = 'estado-vitrine-texto';
        texto.textContent = pesquisaAtiva || filtroTemaAtual !== 'todos'
            ? 'Nenhuma minifigura encontrada com esse filtro.'
            : 'Nenhum produto encontrado.';

        erroDiv.append(figura, texto);
        vitrine.appendChild(erroDiv);
    } else {
        renderizarMaisProdutosVitrine();
    }

    atualizarContadorProdutos(
        indiceRenderizado,
        totalProdutosRemotos,
        pesquisaAtiva || filtroTemaAtual !== 'todos'
    );
}


function sincronizarBotaoCategoriasCabecalho() {
    const listaTemas = document.querySelector('#menu-lateral-temas .lista-temas');
    const botao = document.getElementById('btn-categorias-cabecalho');
    if (!botao) return;
    const aberto = Boolean(listaTemas) && !listaTemas.classList.contains('recolhida');
    botao.classList.toggle('ativa', aberto);
    botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    botao.setAttribute('aria-label', aberto ? 'Fechar categorias' : 'Abrir categorias');
}

let scrollYCategoriasAnterior = 0;
let ignorarFechoCategoriasScrollAte = 0;
let fechoCategoriasScrollLigado = false;

function prepararIgnorarFechoCategoriasPorScroll(ms = 800) {
    ignorarFechoCategoriasScrollAte = Date.now() + ms;
    scrollYCategoriasAnterior = window.scrollY || window.pageYOffset || 0;
}

function definirPesquisaCabecalhoEscondidaTelemovel(escondida) {
    const corpo = document.body;
    if (!corpo) return;
    const estavaEscondida = corpo.classList.contains('pesquisa-cabecalho-escondida');
    corpo.classList.toggle('pesquisa-cabecalho-escondida', Boolean(escondida));
    if (estavaEscondida === Boolean(escondida)) return;
    if (typeof window.sincronizarEspacamentoCabecalho === 'function') {
        window.requestAnimationFrame(window.sincronizarEspacamentoCabecalho);
    }
    if (typeof agendarAtualizacaoStickyTemas === 'function') {
        agendarAtualizacaoStickyTemas();
    }
}

function aoScrollFecharCategoriasTelemovel() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 1100px)').matches) {
        return;
    }

    const y = window.scrollY || window.pageYOffset || 0;
    if (Date.now() < ignorarFechoCategoriasScrollAte) {
        scrollYCategoriasAnterior = y;
        return;
    }

    const desceu = y > scrollYCategoriasAnterior + 12;
    scrollYCategoriasAnterior = y;

    if (!desceu) return;

    const listaTemas = document.querySelector('#menu-lateral-temas .lista-temas');
    if (!listaTemas || listaTemas.classList.contains('recolhida')) return;

    recolherMenuTemasNoTelemovel();
}

function ligarFecharCategoriasAoScrollTelemovel() {
    if (fechoCategoriasScrollLigado) return;
    fechoCategoriasScrollLigado = true;
    scrollYCategoriasAnterior = window.scrollY || window.pageYOffset || 0;
    window.addEventListener('scroll', aoScrollFecharCategoriasTelemovel, { passive: true });
}

function abrirMenuCategoriasCabecalho() {
    const listaTemas = document.querySelector('#menu-lateral-temas .lista-temas');
    if (!listaTemas || !listaTemas.classList.contains('recolhida')) {
        sincronizarBotaoCategoriasCabecalho();
        return;
    }
    alternarMenuCategoriasCabecalho();
}

function alternarMenuCategoriasCabecalho() {
    const listaTemas = document.querySelector('#menu-lateral-temas .lista-temas');
    const botaoToggle = document.querySelector('#menu-lateral-temas .btn-toggle-menu');
    if (!listaTemas) return;

    const recolhido = listaTemas.classList.toggle('recolhida');
    if (botaoToggle) botaoToggle.textContent = recolhido ? 'Mostrar' : 'Recolher';
    sincronizarBotaoCategoriasCabecalho();
    agendarAtualizacaoStickyTemas();

    if (!recolhido) {
        prepararIgnorarFechoCategoriasPorScroll(900);
        const menu = document.getElementById('menu-lateral-temas');
        if (!menu) return;
        const header = document.querySelector('header');
        const headerAltura = header ? header.getBoundingClientRect().height : 0;
        const destino = menu.getBoundingClientRect().top + window.scrollY - headerAltura - 8;
        const reduzirMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({
            top: Math.max(0, destino),
            behavior: reduzirMovimento ? 'auto' : 'smooth'
        });
    }
}

function recolherMenuTemasNoTelemovel() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 1100px)').matches) return;

    const listaTemas = document.querySelector('#menu-lateral-temas .lista-temas');
    const botaoToggle = document.querySelector('#menu-lateral-temas .btn-toggle-menu');
    if (!listaTemas) return;

    listaTemas.classList.add('recolhida');
    if (botaoToggle) botaoToggle.textContent = 'Mostrar';
    sincronizarBotaoCategoriasCabecalho();
    agendarAtualizacaoStickyTemas();
}

function rolarParaPrimeiraLinhaProdutos() {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;

    const header = document.querySelector('header');
    const margem = 16;
    const headerAltura = header ? header.getBoundingClientRect().height : 0;
    const destino = vitrine.getBoundingClientRect().top + window.scrollY - headerAltura - margem;
    const reduzirMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
        top: Math.max(0, destino),
        behavior: reduzirMovimento ? 'auto' : 'smooth'
    });
}

function obterBotaoFiltroTemaLoja(filtro) {
    const alvo = String(filtro || 'todos');
    const escapado = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
        ? CSS.escape(alvo)
        : alvo.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return document.querySelector(`#menu-lateral-temas [data-filtro-tema="${escapado}"]`)
        || document.querySelector(`#menu-lateral-temas [data-tema-filtro="${escapado}"]`);
}

function atualizarBreadcrumbLoja() {
    const nav = document.getElementById('loja-breadcrumb');
    if (!nav) return;

    if (filtroTemaAtual === 'todos') {
        nav.hidden = true;
        nav.replaceChildren();
        return;
    }

    const partes = String(filtroTemaAtual || '').split('|');
    const slugTema = partes[0] || '';
    const slugSubtema = partes[1] || '';
    const infoTema = mapaTemasLoja.get(slugTema);
    if (!infoTema) {
        nav.hidden = true;
        nav.replaceChildren();
        return;
    }

    const nomeSubtema = slugSubtema ? (infoTema.subtemas.get(slugSubtema) || '') : '';

    function criarSeparador() {
        const sep = document.createElement('span');
        sep.className = 'loja-breadcrumb-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '›';
        return sep;
    }

    function criarLink(texto, filtro) {
        const link = document.createElement('a');
        link.href = 'index.html';
        link.textContent = texto;
        link.addEventListener('click', evento => {
            evento.preventDefault();
            const botao = obterBotaoFiltroTemaLoja(filtro) || document.querySelector('#menu-lateral-temas .btn-tema');
            if (botao) filtrarTema(filtro, botao);
        });
        return link;
    }

    nav.replaceChildren();
    nav.appendChild(criarLink('Home', 'todos'));
    nav.appendChild(criarSeparador());

    if (nomeSubtema) {
        nav.appendChild(criarLink(infoTema.nome, slugTema));
        nav.appendChild(criarSeparador());
        const atual = document.createElement('span');
        atual.className = 'loja-breadcrumb-atual';
        atual.textContent = nomeSubtema;
        nav.appendChild(atual);
    } else {
        const atual = document.createElement('span');
        atual.className = 'loja-breadcrumb-atual';
        atual.textContent = infoTema.nome;
        nav.appendChild(atual);
    }

    nav.hidden = false;
}

function filtrarTema(filtro, botao){
    document.querySelectorAll('.btn-tema, .btn-subtema').forEach(btn => { btn.classList.remove('ativo'); });
    botao.classList.add('ativo');

    filtroTemaAtual = filtro;

    if(filtro === 'todos'){
        document.querySelectorAll('.grupo-subtemas').forEach(g => { g.classList.remove('aberto'); });
        document.querySelectorAll('.indicador-tema').forEach(i => { i.textContent = '+'; });
    } else {
        const partes = filtro.split('|');
        const tema = partes[0];
        document.querySelectorAll('.grupo-subtemas').forEach(g => { if(g.id !== 'grupo-' + tema){ g.classList.remove('aberto'); } });
        document.querySelectorAll('.indicador-tema').forEach(i => {
            const linha = i.closest('.linha-tema');
            const grupo = linha ? linha.querySelector('.grupo-subtemas') : null;
            i.textContent = grupo && grupo.classList.contains('aberto') ? '-' : '+';
        });
        const grupoAlvo = document.getElementById('grupo-' + tema);
        if(grupoAlvo && partes.length === 1){ grupoAlvo.classList.add('aberto'); }
    }

    atualizarBreadcrumbLoja();
    recolherMenuTemasNoTelemovel();
    executarFiltrosCombinados({ rolarParaProdutos: true });
}

function verificarTeclaEnter(evento) {
    if (evento.key === "Enter") {
        evento.preventDefault();
        if (obterVistaPagina() !== 'loja') {
            const pesquisa = (typeof obterValorPesquisaLoja === 'function'
                ? obterValorPesquisaLoja()
                : document.getElementById('campo-pesquisa')?.value || '').trim();
            window.location.href = 'index.html' + (pesquisa ? '?q=' + encodeURIComponent(pesquisa) : '');
            return;
        }
        executarFiltrosCombinados();
    }
}

function atualizarContadorProdutos(totalVisiveis, totalProdutos, pesquisaAtiva) {
    const contador = document.getElementById('contador-produtos');
    if(!contador) return;

    const mostrados = Math.max(0, Number(totalVisiveis || 0));
    const total = Math.max(mostrados, Number(totalProdutos || 0));
    const incompleto = mostrados < total || haMaisProdutosRemotos || carregandoProdutosRemotos;

    contador.replaceChildren();
    const destaque = document.createElement('strong');

    if (incompleto && total > 0) {
        destaque.textContent = `${mostrados.toLocaleString('pt-PT')} de ${total.toLocaleString('pt-PT')}`;
        const legenda = carregandoProdutosRemotos
            ? 'produtos · a carregar mais…'
            : (pesquisaAtiva
                ? 'produtos · há mais abaixo'
                : 'produtos na loja · há mais abaixo');
        contador.append(destaque, document.createTextNode(' ' + legenda));
        return;
    }

    const numero = pesquisaAtiva || filtroTemaAtual !== 'todos' ? mostrados : total;
    const legenda = pesquisaAtiva
        ? (numero === 1 ? 'produto encontrado' : 'produtos encontrados')
        : filtroTemaAtual !== 'todos'
            ? (numero === 1 ? 'produto neste filtro' : 'produtos neste filtro')
            : (numero === 1 ? 'produto na loja' : 'produtos na loja');

    destaque.textContent = Number(numero || 0).toLocaleString('pt-PT');
    contador.append(destaque, document.createTextNode(' ' + legenda));
}

function executarFiltrosCombinados(opcoes = {}) {
    if (!document.getElementById('campo-pesquisa') && !document.getElementById('campo-pesquisa-menu')) {
        return Promise.resolve();
    }

    return reiniciarVitrinePaginada()
        .then(() => {
            if (!opcoes.rolarParaProdutos) return;
            requestAnimationFrame(() => {
                rolarParaPrimeiraLinhaProdutos();
            });
        })
        .catch(erro => {
            console.error('Erro ao aplicar filtros:', erro);
        });
}
