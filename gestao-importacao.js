// Codigo de importacao da pagina Gestao.
// Separado de app.js para as outras paginas nao carregarem este bloco.

let importacaoStockPendente = null;
let importacaoCatalogoPendente = null;
let importacaoCatalogoSemStockPendente = null;

function normalizarCabecalhoStock(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

const COLUNAS_CATALOGO_BASE = new Set(['lego', 'nome', 'preco', 'sku', 'top', 'arquivado', 'arquivada', 'arquivados', 'arquivadas', 'archived', 'descontinuado', 'descontinuada', 'descontinuados', 'descontinuadas', 'discontinued', 'novidade', 'nova', 'novo', 'stock', 'tema', 'subtema', 'peso', 'referencia']);
const FORNECEDORES_IMPORTACAO = [
    { chave:'lote50', nome:'Lote 50' },
    { chave:'ruishengtu', nome:'Ruishengtu' },
    { chave:'leguoguo', nome:'Leguoguo' },
    { chave:'chuangyaoke', nome:'Chuangyaoke' },
    { chave:'kopf', nome:'Kopf' },
    { chave:'brixtoy', nome:'Brixtoy' }
];

function obterFornecedoresImportacao() {
    const mapa = new Map(FORNECEDORES_IMPORTACAO.map(fornecedor => [fornecedor.nome, fornecedor]));
    try {
        const chaveFichas = typeof FORNECEDORES_FICHAS_KEY !== 'undefined'
            ? FORNECEDORES_FICHAS_KEY
            : 'figures-planet-fornecedores-fichas';
        const fichas = JSON.parse(localStorage.getItem(chaveFichas) || "[]");
        if (Array.isArray(fichas)) {
            fichas.forEach(ficha => {
                const nome = String(ficha?.nome || "").trim();
                if (!nome || ficha?.ativo === false || mapa.has(nome)) return;
                mapa.set(nome, { chave: normalizarChaveImportacaoFornecedor(nome), nome });
            });
        }
    } catch (_) {}
    return [...mapa.values()];
}

function normalizarChaveImportacaoFornecedor(texto) {
    return normalizarCabecalhoStock(texto).replace(/[^a-z0-9]/g, '');
}

function obterFornecedorPorCabecalhoImportacao(cabecalho) {
    const textoCabecalho = String(cabecalho || '').trim();
    const chaveCabecalho = normalizarChaveImportacaoFornecedor(textoCabecalho);
    if(!textoCabecalho || !chaveCabecalho || COLUNAS_CATALOGO_BASE.has(chaveCabecalho)) return null;
    return obterFornecedoresImportacao().find(fornecedor =>
        chaveCabecalho === normalizarChaveImportacaoFornecedor(fornecedor.nome)
    ) || null;
}

function obterValorFornecedorImportacao(valor) {
    if(valor === null || valor === undefined) return '';
    return String(valor).trim();
}

function obterBooleanoImportacao(valor) {
    const texto = normalizarCabecalhoStock(valor);
    return ['1', 'sim', 's', 'x', 'yes', 'y', 'true', 'verdadeiro'].includes(texto);
}

function juntarValoresFornecedorImportacao(atual, novo) {
    if(!atual) return novo;
    if(!novo || atual === novo) return atual;
    return atual + ' | ' + novo;
}

function extrairFornecedoresImportacao(linha, cabecalhos) {
    const fornecedores = {};
    cabecalhos.forEach((cabecalho, indice) => {
        const fornecedor = obterFornecedorPorCabecalhoImportacao(cabecalho);
        if(!fornecedor) return;
        const valor = obterValorFornecedorImportacao(linha[indice]);
        if(!valor) return;
        fornecedores[fornecedor.chave] = juntarValoresFornecedorImportacao(fornecedores[fornecedor.chave], valor);
    });
    return fornecedores;
}

function criarIndicadorImportacaoStock(valor, legenda) {
    const bloco = document.createElement('div');
    const numero = document.createElement('strong');
    numero.textContent = String(valor);
    const texto = document.createElement('span');
    texto.textContent = legenda;
    bloco.append(numero, texto);
    return bloco;
}

function somarStockProdutos(lista) {
    return (Array.isArray(lista) ? lista : []).reduce((total, produto) => {
        const stock = Number(produto?.stock || 0);
        return total + (Number.isFinite(stock) ? stock : 0);
    }, 0);
}

function somarStockAlteracoes(lista, campo) {
    return (Array.isArray(lista) ? lista : []).reduce((total, item) => {
        const stock = Number(item?.[campo] || 0);
        return total + (Number.isFinite(stock) ? stock : 0);
    }, 0);
}

function renderizarResumoImportacaoStock(resultado) {
    const resumo = document.getElementById('resumo-importacao-stock');
    const detalhes = document.getElementById('detalhes-importacao-stock');
    if(!resumo || !detalhes) return;

    resumo.replaceChildren(
        criarIndicadorImportacaoStock(resultado.totalLinhas, 'SKUs no ficheiro'),
        criarIndicadorImportacaoStock(resultado.totalStockLinhasFicheiro, 'Stock linhas ficheiro'),
        criarIndicadorImportacaoStock(resultado.totalStockFicheiro, 'Stock no ficheiro'),
        criarIndicadorImportacaoStock(resultado.totalStockAtual, 'Stock atual site'),
        criarIndicadorImportacaoStock(resultado.totalStockPrevisto, 'Stock previsto'),
        criarIndicadorImportacaoStock(resultado.alteracoes.length, 'Alterações'),
        criarIndicadorImportacaoStock(resultado.aumentos, 'Aumentam'),
        criarIndicadorImportacaoStock(resultado.reducoes, 'Diminuem'),
        criarIndicadorImportacaoStock(resultado.desativados, 'Ficam inativos'),
        criarIndicadorImportacaoStock(resultado.naoEncontrados.length, 'Não encontrados')
    );
    resumo.classList.remove('oculto');

    detalhes.replaceChildren();
    const diferencaPrevista = resultado.totalStockPrevisto - resultado.totalStockFicheiro;
    const diferencaLinhas = resultado.totalStockFicheiro - resultado.totalStockLinhasFicheiro;
    const linhas = [
        `Stock bruto nas linhas do ficheiro: ${resultado.totalStockLinhasFicheiro}`,
        `Stock lido no ficheiro: ${resultado.totalStockFicheiro}`,
        `Stock atual no site antes da importação: ${resultado.totalStockAtual}`,
        `Stock previsto no site depois da importação: ${resultado.totalStockPrevisto}`
    ];
    if(diferencaLinhas !== 0) {
        linhas.push(`Diferença entre linhas do ficheiro e SKUs importados: ${diferencaLinhas > 0 ? '+' : ''}${diferencaLinhas}. Normalmente isto indica SKUs duplicados ou linhas ignoradas.`);
    }
    if(diferencaPrevista !== 0) {
        linhas.push(`Diferença prevista face ao ficheiro: ${diferencaPrevista > 0 ? '+' : ''}${diferencaPrevista}. Verifique SKUs não encontrados, duplicados ou produtos ausentes no ficheiro.`);
    }
    resultado.alteracoes.slice(0, 60).forEach(item => {
        linhas.push(`${item.sku} | ${item.nome} | ${item.stockAtual} → ${item.stockNovo} | ${item.ativoNovo ? 'ativo' : 'inativo'}`);
    });
    resultado.naoEncontrados.slice(0, 30).forEach(item => {
        linhas.push(`${item.sku} | não encontrado no Supabase`);
    });
    if(resultado.ausentesNoFicheiro.length > 0) {
        linhas.push(`${resultado.ausentesNoFicheiro.length} produto(s) do Supabase não constam do ficheiro e não serão alterados.`);
    }
    if(resultado.duplicados.length > 0) {
        linhas.push(`${resultado.duplicados.length} SKU(s) duplicado(s) no ficheiro. Foi usado o último valor encontrado.`);
        resultado.duplicados.slice(0, 20).forEach(item => linhas.push(`Duplicado: ${item.sku} | linha ${item.linha}`));
    }
    if(resultado.invalidos.length > 0) {
        linhas.push(`${resultado.invalidos.length} linha(s) foram ignoradas por SKU ou stock inválido.`);
    }

    linhas.forEach(linha => {
        const div = document.createElement('div');
        div.textContent = linha;
        detalhes.appendChild(div);
    });
    detalhes.classList.toggle('oculto', !linhas.length);
}

let xlsxAdminPromessa = null;

function garantirXlsxAdmin() {
    if(typeof XLSX !== 'undefined') return Promise.resolve();
    if(xlsxAdminPromessa) return xlsxAdminPromessa;

    xlsxAdminPromessa = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        script.async = true;
        script.onload = () => typeof XLSX !== 'undefined'
            ? resolve()
            : reject(new Error('A ferramenta de Excel nao ficou disponivel.'));
        script.onerror = () => reject(new Error('Nao foi possivel carregar a ferramenta de Excel.'));
        document.head.appendChild(script);
    });

    return xlsxAdminPromessa;
}

async function analisarFicheiroStockAdmin(input) {
    const status = document.getElementById('status-importacao-stock');
    const botao = document.getElementById('btn-confirmar-importacao-stock');
    importacaoStockPendente = null;
    if(botao) botao.disabled = true;

    try {
        const ficheiro = input.files?.[0];
        if(!ficheiro) return;
        await garantirXlsxAdmin();
        if(typeof XLSX === 'undefined') {
            throw new Error('O leitor de folhas de cálculo não foi carregado. Atualize a página e tente novamente.');
        }

        mostrarMensagem(status, 'A analisar o ficheiro de stock...');
        const conteudo = await ficheiro.arrayBuffer();
        const workbook = XLSX.read(conteudo, { type:'array' });
        const primeiraFolha = workbook.Sheets[workbook.SheetNames[0]];
        const linhas = XLSX.utils.sheet_to_json(primeiraFolha, { header:1, defval:null, raw:true });
        const indiceCabecalho = linhas.findIndex(linha => {
            const cabecalhos = linha.map(normalizarCabecalhoStock);
            return cabecalhos.includes('sku') && cabecalhos.includes('stock');
        });

        if(indiceCabecalho < 0) {
            throw new Error('Não foram encontradas as colunas sku e stock.');
        }

        const cabecalhos = linhas[indiceCabecalho].map(normalizarCabecalhoStock);
        const colunaSku = cabecalhos.indexOf('sku');
        const colunaStock = cabecalhos.indexOf('stock');
        const stockPorSku = new Map();
        const invalidos = [];
        const duplicados = [];
        let totalStockLinhasFicheiro = 0;

        linhas.slice(indiceCabecalho + 1).forEach((linha, indice) => {
            const sku = normalizarTextoSku(linha[colunaSku]).replace(/[^A-Z0-9]/g, '');
            const stock = Number(linha[colunaStock]);
            if(!sku || !Number.isInteger(stock) || stock < 0) {
                if(linha.some(valor => valor !== null && valor !== '')) invalidos.push(indice + indiceCabecalho + 2);
                return;
            }
            totalStockLinhasFicheiro += stock;
            if(stockPorSku.has(sku)) {
                duplicados.push({ sku, linha: indice + indiceCabecalho + 2 });
            }
            stockPorSku.set(sku, stock);
        });

        const produtosPorSku = new Map(todosOsProdutos.map(produto => [String(produto.sku || '').trim().toUpperCase(), produto]));
        const alteracoes = [];
        const naoEncontrados = [];
        let aumentos = 0;
        let reducoes = 0;
        let desativados = 0;

        stockPorSku.forEach((stockNovo, sku) => {
            const produto = produtosPorSku.get(sku);
            if(!produto) {
                naoEncontrados.push({ sku, stock:stockNovo });
                return;
            }

            const stockAtual = Number(produto.stock || 0);
            const ativoAtual = produto.ativo !== false;
            const ativoNovo = stockNovo > 0;
            if(stockAtual !== stockNovo || ativoAtual !== ativoNovo) {
                alteracoes.push({
                    sku,
                    nome:produto.nome || '',
                    stockAtual,
                    stockNovo,
                    ativoNovo
                });
                if(stockNovo > stockAtual) aumentos += 1;
                if(stockNovo < stockAtual) reducoes += 1;
                if(!ativoNovo) desativados += 1;
            }
        });

        const ausentesNoFicheiro = todosOsProdutos
            .filter(produto => !stockPorSku.has(String(produto.sku || '').trim().toUpperCase()))
            .map(produto => produto.sku);
        const totalStockFicheiro = [...stockPorSku.values()].reduce((total, stock) => total + stock, 0);
        const totalStockAtual = somarStockProdutos(todosOsProdutos);
        const totalStockAtualAlterado = somarStockAlteracoes(alteracoes, 'stockAtual');
        const totalStockNovoAlterado = somarStockAlteracoes(alteracoes, 'stockNovo');
        const totalStockPrevisto = totalStockAtual - totalStockAtualAlterado + totalStockNovoAlterado;

        importacaoStockPendente = {
            nomeFicheiro:ficheiro.name,
            totalLinhas:stockPorSku.size,
            totalStockLinhasFicheiro,
            totalStockFicheiro,
            totalStockAtual,
            totalStockPrevisto,
            alteracoes,
            naoEncontrados,
            ausentesNoFicheiro,
            duplicados,
            invalidos,
            aumentos,
            reducoes,
            desativados
        };

        renderizarResumoImportacaoStock(importacaoStockPendente);
        if(botao) botao.disabled = alteracoes.length === 0;
        mostrarMensagem(
            status,
            alteracoes.length > 0
                ? `Análise concluída. Confirme para atualizar ${alteracoes.length} produto(s).`
                : 'Análise concluída. O stock já está atualizado.',
            'msg-sucesso'
        );
    } catch(error) {
        console.error('Erro ao analisar stock:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível ler o ficheiro.'), 'msg-erro');
    }
}

async function confirmarImportacaoStockAdmin() {
    const status = document.getElementById('status-importacao-stock');
    const botao = document.getElementById('btn-confirmar-importacao-stock');
    const importacao = importacaoStockPendente;
    if(!importacao || importacao.alteracoes.length === 0) return;

    try {
        const { data: { user }, error: authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode atualizar o stock.');
        }

        botao.disabled = true;
        const erros = [];
        let atualizados = 0;
        const tamanhoLote = 8;

        for(let inicio = 0; inicio < importacao.alteracoes.length; inicio += tamanhoLote) {
            const lote = importacao.alteracoes.slice(inicio, inicio + tamanhoLote);
            const resultados = await Promise.all(lote.map(async item => {
                const { data, error } = await dbClient.rpc('atualizar_stock_produto_admin', {
                    p_sku: item.sku,
                    p_stock: item.stockNovo,
                    p_ativo: item.ativoNovo
                });
                if(error) throw error;
                if(!data || data.length === 0) throw new Error('Produto não atualizado.');
                return item.sku;
            }));

            resultados.forEach(sku => {
                if(sku) atualizados += 1;
                else erros.push('SKU desconhecido');
            });
            mostrarMensagem(status, `A atualizar stock: ${atualizados}/${importacao.alteracoes.length}`);
        }

        if(erros.length > 0) {
            throw new Error(`${erros.length} produto(s) não foram atualizados.`);
        }

        importacaoStockPendente = null;
        await carregarProdutosAdminDaNuvem();
        const totalStockGravado = somarStockProdutos(todosOsProdutos);
        const diferenca = totalStockGravado - importacao.totalStockFicheiro;
        const diferencaLinhas = totalStockGravado - importacao.totalStockLinhasFicheiro;
        mostrarMensagem(
            status,
            diferenca === 0
                ? (
                    diferencaLinhas === 0
                        ? `${atualizados} produto(s) atualizados com sucesso. Stock gravado: ${totalStockGravado}. Bate certo com as linhas do ficheiro.`
                        : `${atualizados} produto(s) atualizados. Stock gravado: ${totalStockGravado}. Bate com os SKUs importados, mas difere das linhas do ficheiro: ${diferencaLinhas > 0 ? '+' : ''}${diferencaLinhas}. Veja duplicados/linhas ignoradas.`
                )
                : `${atualizados} produto(s) atualizados. Stock gravado: ${totalStockGravado}. Diferença face ao ficheiro: ${diferenca > 0 ? '+' : ''}${diferenca}. Veja os detalhes da importação.`,
            diferenca === 0 && diferencaLinhas === 0 ? 'msg-sucesso' : 'msg-erro'
        );
    } catch(error) {
        console.error('Erro ao atualizar stock:', error);
        botao.disabled = false;
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível atualizar o stock.'), 'msg-erro');
    }
}

function lerFolhaMapas(conteudo) {
    if(typeof XLSX === 'undefined') {
        throw new Error('O leitor de folhas de cálculo não foi carregado. Atualize a página e tente novamente.');
    }

    const workbook = XLSX.read(conteudo, { type:'array' });
    const primeiraFolha = workbook.Sheets[workbook.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(primeiraFolha, { header:1, defval:null, raw:true });
    const indiceCabecalho = linhas.findIndex(linha => {
        const cabecalhos = linha.map(normalizarCabecalhoStock);
        return cabecalhos.includes('sku') && cabecalhos.includes('stock') && cabecalhos.includes('nome');
    });

    if(indiceCabecalho < 0) {
        throw new Error('Não foram encontradas as colunas nome, sku e stock.');
    }

    return {
        linhas:linhas.slice(indiceCabecalho + 1),
        cabecalhos:linhas[indiceCabecalho].map(normalizarCabecalhoStock),
        primeiraLinhaDados:indiceCabecalho + 2
    };
}

function obterIndiceColuna(cabecalhos, nomes, obrigatoria = true) {
    const aliases = Array.isArray(nomes) ? nomes : [nomes];
    const nome = aliases[0];
    const aliasesNormalizados = aliases.map(normalizarCabecalhoStock);
    const indice = cabecalhos.findIndex(cabecalho => aliasesNormalizados.includes(cabecalho));
    if(indice < 0 && obrigatoria) {
        throw new Error(`Não foi encontrada a coluna ${nome}.`);
    }
    return indice;
}

function renderizarResumoImportacaoCatalogo(resultado, ids) {
    const resumo = document.getElementById(ids.resumo);
    const detalhes = document.getElementById(ids.detalhes);
    if(!resumo || !detalhes) return;

    const indicadores = resultado.preservarStock
        ? [
            criarIndicadorImportacaoStock(resultado.produtos.length, 'Produtos válidos'),
            criarIndicadorImportacaoStock(resultado.totalStockAtual, 'Stock atual site'),
            criarIndicadorImportacaoStock(resultado.novos.length, 'Novos com stock 0'),
            criarIndicadorImportacaoStock(resultado.existentes.length, 'Atualizados'),
            criarIndicadorImportacaoStock(resultado.ativos, 'Ativos no ficheiro'),
            criarIndicadorImportacaoStock(resultado.inativos, 'Inativos no ficheiro')
        ]
        : [
            criarIndicadorImportacaoStock(resultado.produtos.length, 'Produtos válidos'),
            criarIndicadorImportacaoStock(resultado.totalStockLinhasFicheiro, 'Stock linhas ficheiro'),
            criarIndicadorImportacaoStock(resultado.totalStockFicheiro, 'Stock no ficheiro'),
            criarIndicadorImportacaoStock(resultado.novos.length, 'Novos'),
            criarIndicadorImportacaoStock(resultado.existentes.length, 'Atualizados'),
            criarIndicadorImportacaoStock(resultado.remover.length, 'A remover'),
            criarIndicadorImportacaoStock(resultado.ativos, 'Ativos'),
            criarIndicadorImportacaoStock(resultado.inativos, 'Inativos')
        ];

    resumo.replaceChildren(...indicadores);
    resumo.classList.remove('oculto');

    detalhes.replaceChildren();
    const linhas = resultado.preservarStock
        ? [
            `${resultado.produtos.length} produtos serão importados do ficheiro.`,
            'O stock e o estado ativo dos produtos existentes serão preservados.',
            `${resultado.novos.length} produto(s) novo(s) entrarão com stock 0.`,
            `${resultado.existentes.length} produto(s) existente(s) serão atualizados por SKU.`,
            'Produtos que não constem do ficheiro não serão removidos.'
        ]
        : [
            `${resultado.produtos.length} produtos serão importados do ficheiro.`,
            `Stock bruto nas linhas do ficheiro: ${resultado.totalStockLinhasFicheiro}.`,
            `Stock total do ficheiro: ${resultado.totalStockFicheiro}.`,
            `${resultado.novos.length} produtos serão adicionados.`,
            `${resultado.existentes.length} produtos existentes serão atualizados por SKU.`,
            `${resultado.remover.length} produtos atuais não constam do ficheiro e serão removidos.`
        ];

    if(!resultado.preservarStock) {
        const diferencaLinhas = resultado.totalStockFicheiro - resultado.totalStockLinhasFicheiro;
        if(diferencaLinhas !== 0) {
            linhas.push(`Diferença entre linhas do ficheiro e produtos importados: ${diferencaLinhas > 0 ? '+' : ''}${diferencaLinhas}. Verifique duplicados ou linhas ignoradas.`);
        }
    }
    if(resultado.invalidos.length) linhas.push(`${resultado.invalidos.length} linha(s) inválida(s) foram ignoradas.`);
    if(!resultado.preservarStock) {
        resultado.remover.slice(0, 30).forEach(produto => linhas.push(`Remover: ${produto.sku} | ${produto.nome || ''}`));
    }

    linhas.forEach(linha => {
        const div = document.createElement('div');
        div.textContent = linha;
        detalhes.appendChild(div);
    });
    detalhes.classList.remove('oculto');
}

function atualizarConfirmacaoCatalogoAdmin() {
    const botao = document.getElementById('btn-confirmar-importacao-catalogo');
    const confirmacao = document.getElementById('confirmacao-substituir-catalogo')?.value.trim().toUpperCase();
    if(botao) {
        botao.disabled = !importacaoCatalogoPendente || confirmacao !== 'SUBSTITUIR';
    }
}

function atualizarConfirmacaoCatalogoSemStockAdmin() {
    const botao = document.getElementById('btn-confirmar-importacao-catalogo-sem-stock');
    if(botao) {
        botao.disabled = !importacaoCatalogoSemStockPendente;
    }
}

async function extrairProdutosCatalogoDoFicheiro(conteudo, { preservarStock = false } = {}) {
    const { linhas, cabecalhos, primeiraLinhaDados } = lerFolhaMapas(conteudo);
    const colunas = {
        lego:obterIndiceColuna(cabecalhos, 'lego', false),
        nome:obterIndiceColuna(cabecalhos, 'nome'),
        preco:obterIndiceColuna(cabecalhos, 'preco'),
        sku:obterIndiceColuna(cabecalhos, 'sku'),
        top:obterIndiceColuna(cabecalhos, 'top', false),
        arquivado:obterIndiceColuna(cabecalhos, ['arquivado', 'arquivada', 'arquivados', 'arquivadas', 'archived'], false),
        descontinuado:obterIndiceColuna(cabecalhos, ['descontinuado', 'descontinuada', 'descontinuados', 'descontinuadas', 'discontinued'], false),
        novidade:obterIndiceColuna(cabecalhos, ['novidade', 'nova', 'novo'], false),
        referencia:obterIndiceColuna(cabecalhos, 'referencia', false),
        stock:obterIndiceColuna(cabecalhos, 'stock', !preservarStock),
        tema:obterIndiceColuna(cabecalhos, 'tema'),
        subtema:obterIndiceColuna(cabecalhos, 'subtema', false),
        peso:obterIndiceColuna(cabecalhos, 'peso')
    };

    const produtosPorSku = new Map();
    const invalidos = [];
    let totalStockLinhasFicheiro = 0;

    linhas.forEach((linha, indice) => {
        if(!linha.some(valor => valor !== null && valor !== '')) return;
        const lego = colunas.lego >= 0 ? String(linha[colunas.lego] || '').trim() : '';
        const nome = String(linha[colunas.nome] || '').trim();
        const sku = normalizarTextoSku(linha[colunas.sku]).replace(/[^A-Z0-9]/g, '');
        const top = colunas.top >= 0 ? String(linha[colunas.top] || '').trim() : '';
        const arquivado = colunas.arquivado >= 0 ? obterBooleanoImportacao(linha[colunas.arquivado]) : false;
        const descontinuado = colunas.descontinuado >= 0 ? obterBooleanoImportacao(linha[colunas.descontinuado]) : false;
        const novidade = colunas.novidade >= 0 ? obterBooleanoImportacao(linha[colunas.novidade]) : false;
        const referencia = colunas.referencia >= 0 ? String(linha[colunas.referencia] || '').trim() : '';
        const preco = Number(linha[colunas.preco]);
        const stockBruto = colunas.stock >= 0 ? Number(linha[colunas.stock]) : 0;
        const stock = preservarStock ? 0 : stockBruto;
        const tema = String(linha[colunas.tema] || '').trim();
        const subtema = colunas.subtema >= 0 ? String(linha[colunas.subtema] || '').trim() : '';
        const peso = Number(linha[colunas.peso]);
        const fornecedores = extrairFornecedoresImportacao(linha, cabecalhos);

        if(!preservarStock && Number.isInteger(stockBruto) && stockBruto >= 0) {
            totalStockLinhasFicheiro += stockBruto;
        }

        const stockValido = preservarStock || (Number.isInteger(stockBruto) && stockBruto >= 0);
        if(!nome || !sku || !tema || !Number.isFinite(preco) || preco < 0 || !stockValido || !Number.isFinite(peso) || peso < 1 || produtosPorSku.has(sku)) {
            invalidos.push(indice + primeiraLinhaDados);
            return;
        }

        produtosPorSku.set(sku, {
            lego,
            nome,
            preco,
            sku,
            top,
            arquivado,
            descontinuado,
            novidade,
            referencia,
            stock,
            tema,
            subtema:subtema || 'semsubtema',
            peso,
            fornecedores,
            ativo: preservarStock ? false : stock > 0
        });
    });

    return {
        produtosPorSku,
        invalidos,
        totalStockLinhasFicheiro,
        novidadeColunaPresente: colunas.novidade >= 0
    };
}

async function analisarFicheiroCatalogoComum(input, opcoes) {
    const {
        preservarStock,
        statusId,
        definirPendente,
        idsResumo,
        atualizarConfirmacao,
        mensagemErroInvalidos
    } = opcoes;
    const status = document.getElementById(statusId);
    definirPendente(null);
    atualizarConfirmacao();

    try {
        const ficheiro = input.files?.[0];
        if(!ficheiro) return;
        await garantirXlsxAdmin();
        mostrarMensagem(status, preservarStock
            ? 'A analisar o catálogo (stock será preservado)...'
            : 'A analisar o catálogo completo...');

        const conteudo = await ficheiro.arrayBuffer();
        const { produtosPorSku, invalidos, totalStockLinhasFicheiro, novidadeColunaPresente } = await extrairProdutosCatalogoDoFicheiro(conteudo, { preservarStock });

        if(produtosPorSku.size === 0) {
            throw new Error('O ficheiro não contém produtos válidos.');
        }
        if(invalidos.length > 0) {
            throw new Error(`Foram encontradas ${invalidos.length} linha(s) inválida(s). Corrija o ficheiro antes de ${preservarStock ? 'atualizar' : 'substituir'} o catálogo.`);
        }

        const atuaisPorSku = new Map(todosOsProdutos.map(produto => [String(produto.sku || '').trim().toUpperCase(), produto]));
        const produtos = [...produtosPorSku.values()];
        const novos = produtos.filter(produto => !atuaisPorSku.has(produto.sku));
        const existentes = produtos.filter(produto => atuaisPorSku.has(produto.sku));
        if (!novidadeColunaPresente) {
            novos.forEach(produto => {
                produto.novidade = true;
            });
        }
        const remover = preservarStock
            ? []
            : todosOsProdutos.filter(produto => !produtosPorSku.has(String(produto.sku || '').trim().toUpperCase()));
        const totalStockFicheiro = somarStockProdutos(produtos);
        const totalStockAtual = somarStockProdutos(todosOsProdutos);

        const resultado = {
            nomeFicheiro:ficheiro.name,
            preservarStock,
            produtos,
            totalStockLinhasFicheiro,
            totalStockFicheiro,
            totalStockAtual,
            novos,
            existentes,
            remover,
            invalidos,
            ativos:produtos.filter(produto => produto.ativo).length,
            inativos:produtos.filter(produto => !produto.ativo).length
        };

        definirPendente(resultado);
        renderizarResumoImportacaoCatalogo(resultado, idsResumo);
        atualizarConfirmacao();
        mostrarMensagem(status, mensagemErroInvalidos || 'Análise concluída. Reveja o resumo antes de confirmar.', 'msg-sucesso');
    } catch(error) {
        console.error(`Erro ao analisar catálogo${preservarStock ? ' sem stock' : ''}:`, error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível analisar o catálogo.'), 'msg-erro');
    }
}

async function analisarFicheiroCatalogoAdmin(input) {
    return analisarFicheiroCatalogoComum(input, {
        preservarStock: false,
        statusId: 'status-importacao-catalogo',
        definirPendente: (valor) => { importacaoCatalogoPendente = valor; },
        idsResumo: {
            resumo: 'resumo-importacao-catalogo',
            detalhes: 'detalhes-importacao-catalogo'
        },
        atualizarConfirmacao: atualizarConfirmacaoCatalogoAdmin
    });
}

async function analisarFicheiroCatalogoSemStockAdmin(input) {
    return analisarFicheiroCatalogoComum(input, {
        preservarStock: true,
        statusId: 'status-importacao-catalogo-sem-stock',
        definirPendente: (valor) => { importacaoCatalogoSemStockPendente = valor; },
        idsResumo: {
            resumo: 'resumo-importacao-catalogo-sem-stock',
            detalhes: 'detalhes-importacao-catalogo-sem-stock'
        },
        atualizarConfirmacao: atualizarConfirmacaoCatalogoSemStockAdmin
    });
}

function descarregarBackupCatalogoAdmin() {
    const conteudo = JSON.stringify({ criadoEm:new Date().toISOString(), produtos:todosOsProdutos }, null, 2);
    const blob = new Blob([conteudo], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function confirmarImportacaoCatalogoAdmin() {
    const status = document.getElementById('status-importacao-catalogo');
    const botao = document.getElementById('btn-confirmar-importacao-catalogo');
    const importacao = importacaoCatalogoPendente;
    const confirmacao = document.getElementById('confirmacao-substituir-catalogo')?.value.trim().toUpperCase();
    if(!importacao || confirmacao !== 'SUBSTITUIR') return;

    try {
        const { data: { user }, error:authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode substituir o catálogo.');
        }

        botao.disabled = true;
        descarregarBackupCatalogoAdmin();
        mostrarMensagem(status, 'Backup criado. A importar o novo catálogo...');

        const tamanhoLote = 100;
        let importados = 0;
        for(let inicio = 0; inicio < importacao.produtos.length; inicio += tamanhoLote) {
            const lote = importacao.produtos.slice(inicio, inicio + tamanhoLote);
            const { data, error } = await dbClient.rpc('importar_produtos_admin', {
                p_produtos:lote
            });
            if(error) throw error;
            const quantidadeImportada = Number(data?.importados || 0);
            if(quantidadeImportada !== lote.length) {
                throw new Error('Nem todos os produtos do lote foram importados.');
            }
            importados += quantidadeImportada;
            mostrarMensagem(status, `A importar catálogo: ${importados}/${importacao.produtos.length}`);
        }

        let removidos = 0;
        const skusRemover = importacao.remover.map(produto => String(produto.sku || '').trim()).filter(Boolean);
        for(let inicio = 0; inicio < skusRemover.length; inicio += 50) {
            const lote = skusRemover.slice(inicio, inicio + 50);
            const { data, error } = await dbClient.rpc('remover_produtos_admin', {
                p_skus:lote
            });
            if(error) throw error;
            removidos += Number(data?.removidos || 0);
            mostrarMensagem(status, `Catálogo importado. A remover produtos antigos: ${removidos}/${skusRemover.length}`);
        }

        if(removidos !== skusRemover.length) {
            throw new Error('Alguns produtos antigos não foram removidos. Verifique a policy DELETE no Supabase.');
        }

        importacaoCatalogoPendente = null;
        document.getElementById('confirmacao-substituir-catalogo').value = '';
        await carregarProdutosAdminDaNuvem();
        const totalStockGravado = somarStockProdutos(todosOsProdutos);
        const diferenca = totalStockGravado - importacao.totalStockFicheiro;
        const diferencaLinhas = totalStockGravado - importacao.totalStockLinhasFicheiro;
        mostrarMensagem(
            status,
            diferenca === 0
                ? (
                    diferencaLinhas === 0
                        ? `${importados} produtos importados e ${removidos} produtos antigos removidos. Stock gravado: ${totalStockGravado}. Bate certo com as linhas do ficheiro.`
                        : `${importados} produtos importados e ${removidos} produtos antigos removidos. Stock gravado: ${totalStockGravado}. Bate com os produtos importados, mas difere das linhas do ficheiro: ${diferencaLinhas > 0 ? '+' : ''}${diferencaLinhas}. Veja duplicados/linhas ignoradas.`
                )
                : `${importados} produtos importados e ${removidos} produtos antigos removidos. Stock gravado: ${totalStockGravado}. Diferença face ao ficheiro: ${diferenca > 0 ? '+' : ''}${diferenca}.`,
            diferenca === 0 && diferencaLinhas === 0 ? 'msg-sucesso' : 'msg-erro'
        );
    } catch(error) {
        console.error('Erro ao substituir catálogo:', error);
        botao.disabled = false;
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível substituir o catálogo.'), 'msg-erro');
    }
}

async function confirmarImportacaoCatalogoSemStockAdmin() {
    const status = document.getElementById('status-importacao-catalogo-sem-stock');
    const botao = document.getElementById('btn-confirmar-importacao-catalogo-sem-stock');
    const importacao = importacaoCatalogoSemStockPendente;
    if(!importacao) return;

    try {
        const { data: { user }, error:authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode atualizar o catálogo.');
        }

        botao.disabled = true;
        descarregarBackupCatalogoAdmin();
        mostrarMensagem(status, 'Backup criado. A atualizar o catálogo (stock preservado, ativo conforme stock)...');

        const stockAntes = somarStockProdutos(todosOsProdutos);
        const tamanhoLote = 100;
        let importados = 0;
        for(let inicio = 0; inicio < importacao.produtos.length; inicio += tamanhoLote) {
            const lote = importacao.produtos.slice(inicio, inicio + tamanhoLote);
            const { data, error } = await dbClient.rpc('importar_produtos_sem_stock_admin', {
                p_produtos:lote
            });
            if(error) throw error;
            const quantidadeImportada = Number(data?.importados || 0);
            if(quantidadeImportada !== lote.length) {
                throw new Error('Nem todos os produtos do lote foram importados.');
            }
            importados += quantidadeImportada;
            mostrarMensagem(status, `A atualizar catálogo: ${importados}/${importacao.produtos.length}`);
        }

        importacaoCatalogoSemStockPendente = null;
        await carregarProdutosAdminDaNuvem();
        const stockDepois = somarStockProdutos(todosOsProdutos);
        const diferencaStock = stockDepois - stockAntes;
        mostrarMensagem(
            status,
            diferencaStock === 0
                ? `${importados} produto(s) atualizados. Stock total preservado: ${stockDepois}. ${importacao.novos.length} novo(s), ${importacao.existentes.length} existente(s).`
                : `${importados} produto(s) atualizados. Stock total: ${stockAntes} → ${stockDepois} (${diferencaStock > 0 ? '+' : ''}${diferencaStock}). Verifique produtos novos com stock 0.`,
            diferencaStock === 0 ? 'msg-sucesso' : 'msg-erro'
        );
    } catch(error) {
        console.error('Erro ao atualizar catálogo sem stock:', error);
        botao.disabled = false;
        atualizarConfirmacaoCatalogoSemStockAdmin();
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível atualizar o catálogo.'), 'msg-erro');
    }
}

window.garantirXlsxAdmin = garantirXlsxAdmin;
