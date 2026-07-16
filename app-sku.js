// Geracao de SKU para gestao.
function normalizarTextoSku(texto) {
    return String(texto || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

function obterPalavrasSku(nomeProduto) {
    const palavrasIgnoradas = new Set(['A', 'O', 'OS', 'AS', 'E', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'THE', 'OF', 'AND']);
    return normalizarTextoSku(nomeProduto)
        .replace(/[^A-Z0-9\s-]/g, ' ')
        .split(/[\s-]+/)
        .map(palavra => palavra.trim())
        .filter(palavra =>
            palavra.length > 0 &&
            !palavrasIgnoradas.has(palavra) &&
            !/^V\d+$/i.test(palavra) &&
            /[A-Z]/.test(palavra)
        );
}

function gerarPrefixoSku(nomeProduto) {
    const palavras = obterPalavrasSku(nomeProduto);
    if (palavras.length >= 2) {
        return (palavras[0][0] + palavras[1][0]).toUpperCase();
    }
    if (palavras.length === 1) {
        return palavras[0].slice(0, 2).padEnd(2, 'X').toUpperCase();
    }
    return 'PR';
}

function gerarSkuProduto(nomeProduto, produtosExistentes = todosOsProdutos) {
    const prefixo = gerarPrefixoSku(nomeProduto);
    const numerosUsados = (produtosExistentes || [])
        .map(produto => String(produto.sku || '').toUpperCase())
        .filter(sku => sku.startsWith(prefixo))
        .map(sku => Number(sku.slice(prefixo.length)))
        .filter(numero => Number.isInteger(numero) && numero > 0);

    const proximoNumero = numerosUsados.length > 0 ? Math.max(...numerosUsados) + 1 : 1;
    return prefixo + String(proximoNumero).padStart(2, '0');
}

window.gerarSkuProduto = gerarSkuProduto;
