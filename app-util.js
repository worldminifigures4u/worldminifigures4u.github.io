// Utilitarios partilhados (imagens, moeda, mensagens).
function formatarEuro(valor) {
    return Number(valor || 0).toFixed(2).replace('.', ',');
}

function mostrarMensagem(elemento, mensagem, tipo = '') {
    if (!elemento) return;
    elemento.className = tipo ? `msg-status ${tipo}` : 'msg-status';
    elemento.replaceChildren();
    mensagem.split('\n').forEach((linha, index) => {
        if (index > 0) elemento.appendChild(document.createElement('br'));
        elemento.appendChild(document.createTextNode(linha));
    });
}

function executarComTimeout(promessa, ms, mensagemErro) {
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => { reject(new Error(mensagemErro)); }, ms);
    });
    return Promise.race([promessa, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function otimizarImagemCloudinary(url, largura = 700) {
    const urlOriginal = String(url || '').trim();
    if (!urlOriginal || !urlOriginal.includes('res.cloudinary.com/') || !urlOriginal.includes('/image/upload/')) {
        return urlOriginal;
    }
    const larguraSegura = Math.max(80, Math.min(1600, Math.round(Number(largura) || 700)));
    return urlOriginal.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${larguraSegura},c_limit/`);
}

function otimizarImagemCloudinarySrcset(url, larguras = [260, 520, 780]) {
    const urlOriginal = String(url || '').trim();
    const fallback = otimizarImagemCloudinary(urlOriginal, larguras[1] || 520);
    if (!urlOriginal || !urlOriginal.includes('res.cloudinary.com/') || !urlOriginal.includes('/image/upload/')) {
        return { src: fallback, srcset: '', sizes: '' };
    }
    const lista = (Array.isArray(larguras) ? larguras : [260, 520, 780])
        .map(largura => Math.max(80, Math.min(1600, Math.round(Number(largura) || 520))))
        .filter((largura, indice, arr) => arr.indexOf(largura) === indice);
    return {
        src: otimizarImagemCloudinary(urlOriginal, lista[Math.min(1, lista.length - 1)]),
        srcset: lista.map(largura => `${otimizarImagemCloudinary(urlOriginal, largura)} ${largura}w`).join(', '),
        sizes: '(max-width: 560px) calc(100vw - 64px), (max-width: 1100px) 280px, 320px'
    };
}

function obterImagemPrincipalProduto(prod = {}) {
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
    return listaImagens.length > 0 ? listaImagens[0] : 'img/sem-imagem.png';
}
