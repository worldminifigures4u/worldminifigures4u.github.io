const ENCOMENDAS_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const ENCOMENDAS_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const ENCOMENDAS_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
const ENCOMENDAS_ANEXOS_BUCKET = 'anexos-encomendas';
const ENCOMENDAS_ANEXO_MAX_BYTES = 10 * 1024 * 1024;
const ESTADOS_ENCOMENDA = [
    'A aguardar pagamento',
    'Pago',
    'Em preparação',
    'Enviado',
    'Concluído',
    'Cancelado'
];

let encomendasClient = null;
let encomendasAdmin = [];
let imagensProdutosEncomendas = new Map();
let imagensProdutosEncomendasPorSku = new Map();
let referenciasProdutosEncomendas = new Map();
let referenciasProdutosEncomendasPorSku = new Map();

const ENCOMENDAS_SEM_IMAGEM = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="#222"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#888" font-family="Arial" font-size="13">Sem foto</text></svg>'
);

function normalizarEncomenda(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatarEuroEncomenda(valor) {
    return Number(valor || 0).toFixed(2).replace('.', ',') + ' €';
}

function formatarDataEncomenda(valor) {
    if (!valor) return 'Data indisponível';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).format(data);
}

function estadoNormalizadoEncomenda(estado) {
    return String(estado || '').toLowerCase() === 'pendente'
        ? 'A aguardar pagamento'
        : (estado || 'A aguardar pagamento');
}

function definirStatusEncomendas(texto, erro = false) {
    const status = document.getElementById('status-encomendas-admin');
    status.textContent = texto || '';
    status.classList.toggle('msg-erro', erro);
    status.classList.toggle('msg-sucesso', Boolean(texto) && !erro);
}

function detalheErroEncomendas(error) {
    if (!error) return 'sem detalhe';
    const partes = [
        error.message,
        error.details,
        error.hint,
        error.code ? `código ${error.code}` : '',
        error.status ? `estado HTTP ${error.status}` : ''
    ].filter(Boolean);
    return partes.join(' | ') || String(error);
}

async function atualizarEstadoDiretoEncomendaAdmin(encomenda, estado) {
    const { data, error } = await encomendasClient
        .from('encomendas')
        .update({ estado })
        .eq('id', String(encomenda.id))
        .select('id, estado')
        .single();
    if (error) throw error;
    return data;
}

async function atualizarPrioridadeEncomendaAdmin(encomenda, prioritaria, checkbox) {
    checkbox.disabled = true;
    definirStatusEncomendas('A guardar prioridade...');
    try {
        const { data, error } = await encomendasClient.rpc('atualizar_prioridade_encomenda_admin', {
            p_encomenda_id: String(encomenda.id),
            p_prioritaria: prioritaria
        });
        if (error || data?.sucesso === false) {
            throw error || new Error(data?.erro || 'N\u00e3o foi poss\u00edvel guardar a prioridade.');
        }
        encomenda.prioritaria = prioritaria;
        renderizarEncomendasAdmin();
        definirStatusEncomendas(prioritaria ? 'Encomenda marcada como priorit\u00e1ria.' : 'Prioridade removida.');
    } catch (error) {
        checkbox.checked = !prioritaria;
        checkbox.disabled = false;
        definirStatusEncomendas(
            'Erro ao guardar prioridade: ' + detalheErroEncomendas(error)
            + '. Execute o SQL atualizado do painel de encomendas no Supabase.',
            true
        );
    }
}

function criarElementoEncomenda(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function obterProdutosEncomenda(encomenda) {
    let produtos = encomenda.produtos;
    if (typeof produtos === 'string') {
        try { produtos = JSON.parse(produtos); } catch (_) { produtos = []; }
    }
    return Array.isArray(produtos) ? produtos : [];
}

function obterPrimeiraImagemEncomenda(imagens) {
    let lista = imagens;
    if (typeof lista === 'string') {
        try { lista = JSON.parse(lista); }
        catch (_) { lista = lista.split(',').map(item => item.trim()).filter(Boolean); }
    }
    return Array.isArray(lista) ? String(lista.find(Boolean) || '') : '';
}

function otimizarMiniaturaEncomenda(url) {
    const original = String(url || '');
    if (!original.includes('res.cloudinary.com/') || !original.includes('/image/upload/')) return original;
    return original.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_120,h_120,c_fit/');
}

function obterImagemProdutoEncomenda(item) {
    return imagensProdutosEncomendas.get(String(item.id_produto || item.id || ''))
        || imagensProdutosEncomendasPorSku.get(String(item.sku || '').toUpperCase())
        || '';
}

function obterReferenciaProdutoEncomenda(item) {
    return item.referencia
        || referenciasProdutosEncomendas.get(String(item.id_produto || item.id || ''))
        || referenciasProdutosEncomendasPorSku.get(String(item.sku || '').toUpperCase())
        || '';
}

function abrirImagemProdutoEncomenda(url, nome) {
    if (!url) return;
    const modal = document.getElementById('admin-imagem-modal');
    const foto = document.getElementById('admin-imagem-modal-foto');
    foto.src = url;
    foto.alt = nome || 'Fotografia do produto';
    modal.hidden = false;
    document.body.classList.add('admin-imagem-modal-aberto');
    document.getElementById('admin-imagem-modal-fechar').focus();
}

function fecharImagemProdutoEncomenda() {
    const modal = document.getElementById('admin-imagem-modal');
    const foto = document.getElementById('admin-imagem-modal-foto');
    modal.hidden = true;
    foto.removeAttribute('src');
    document.body.classList.remove('admin-imagem-modal-aberto');
}

function criarMiniaturaProdutoEncomenda(item) {
    const url = obterImagemProdutoEncomenda(item);
    const botao = criarElementoEncomenda('button', 'admin-encomenda-produto-foto');
    botao.type = 'button';
    botao.title = url ? 'Ampliar fotografia' : 'Produto sem fotografia';
    botao.disabled = !url;
    const imagem = document.createElement('img');
    imagem.src = url ? otimizarMiniaturaEncomenda(url) : ENCOMENDAS_SEM_IMAGEM;
    imagem.alt = item.nome || 'Produto';
    imagem.loading = 'lazy';
    imagem.onerror = () => {
        imagem.onerror = null;
        imagem.src = ENCOMENDAS_SEM_IMAGEM;
        botao.disabled = true;
    };
    if (url) botao.addEventListener('click', () => abrirImagemProdutoEncomenda(url, item.nome));
    botao.appendChild(imagem);
    return botao;
}

function pastaAnexosEncomenda(encomenda) {
    return String(encomenda.id);
}

function limparNomeAnexoEncomenda(nome) {
    const partes = String(nome || 'anexo').split('.');
    const extensao = partes.length > 1 ? `.${partes.pop().toLowerCase()}` : '';
    const base = partes.join('.')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'anexo';
    return `${base.slice(0, 100)}${extensao}`;
}

function nomeVisivelAnexoEncomenda(nome) {
    return String(nome || '').replace(/^\d{13}-[a-z0-9]{6}-/i, '');
}

async function listarAnexosEncomenda(encomenda) {
    const { data, error } = await encomendasClient.storage
        .from(ENCOMENDAS_ANEXOS_BUCKET)
        .list(pastaAnexosEncomenda(encomenda), {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' }
        });
    if (error) throw error;
    return (data || []).filter(item => item.name && item.name !== '.emptyFolderPlaceholder');
}

async function abrirAnexoEncomenda(encomenda, anexo) {
    const caminho = `${pastaAnexosEncomenda(encomenda)}/${anexo.name}`;
    const { data, error } = await encomendasClient.storage
        .from(ENCOMENDAS_ANEXOS_BUCKET)
        .createSignedUrl(caminho, 300);
    if (error) throw error;
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

async function apagarAnexosEncomenda(encomenda) {
    const anexos = await listarAnexosEncomenda(encomenda);
    if (!anexos.length) return 0;
    const caminhos = anexos.map(item => `${pastaAnexosEncomenda(encomenda)}/${item.name}`);
    const { error } = await encomendasClient.storage
        .from(ENCOMENDAS_ANEXOS_BUCKET)
        .remove(caminhos);
    if (error) throw error;
    return caminhos.length;
}

async function carregarAnexosEncomenda(encomenda, lista, status) {
    status.textContent = 'A carregar anexos...';
    try {
        const anexos = await listarAnexosEncomenda(encomenda);
        lista.replaceChildren();
        if (!anexos.length) {
            lista.appendChild(criarElementoEncomenda('p', 'admin-encomenda-anexos-vazio', 'Sem anexos.'));
        } else {
            anexos.forEach(anexo => {
                const linha = criarElementoEncomenda('div', 'admin-encomenda-anexo');
                const nome = criarElementoEncomenda('span', '', nomeVisivelAnexoEncomenda(anexo.name));
                nome.title = nome.textContent;
                const abrir = criarElementoEncomenda('button', 'wallapop-botao', 'Abrir');
                abrir.type = 'button';
                abrir.addEventListener('click', async () => {
                    abrir.disabled = true;
                    status.textContent = 'A abrir anexo...';
                    try {
                        await abrirAnexoEncomenda(encomenda, anexo);
                        status.textContent = '';
                    } catch (error) {
                        status.textContent = 'Erro ao abrir: ' + (error.message || 'sem detalhe');
                    } finally {
                        abrir.disabled = false;
                    }
                });
                const apagar = criarElementoEncomenda('button', 'wallapop-botao admin-encomenda-anexo-apagar', 'Eliminar');
                apagar.type = 'button';
                apagar.addEventListener('click', async () => {
                    if (!window.confirm(`Eliminar o anexo "${nome.textContent}"?`)) return;
                    apagar.disabled = true;
                    const caminho = `${pastaAnexosEncomenda(encomenda)}/${anexo.name}`;
                    const { error } = await encomendasClient.storage.from(ENCOMENDAS_ANEXOS_BUCKET).remove([caminho]);
                    if (error) {
                        status.textContent = 'Erro ao eliminar: ' + error.message;
                        apagar.disabled = false;
                        return;
                    }
                    await carregarAnexosEncomenda(encomenda, lista, status);
                });
                linha.append(nome, abrir, apagar);
                lista.appendChild(linha);
            });
        }
        status.textContent = '';
    } catch (error) {
        lista.replaceChildren();
        status.textContent = 'Anexos indispon\u00edveis. Execute primeiro o ficheiro SQL de configura\u00e7\u00e3o.';
        console.warn('Erro ao carregar anexos da encomenda.', error);
    }
}

function criarGestaoEncomenda(encomenda) {
    const painel = criarElementoEncomenda('div', 'admin-encomenda-gestao');

    const notasSecao = criarElementoEncomenda('section', 'admin-encomenda-notas');
    notasSecao.appendChild(criarElementoEncomenda('h3', '', 'Notas internas da encomenda'));
    const notas = document.createElement('textarea');
    notas.rows = 4;
    notas.maxLength = 10000;
    notas.value = encomenda.notas_internas || '';
    notas.placeholder = 'Pormenores de prepara\u00e7\u00e3o vis\u00edveis apenas ao administrador.';
    const guardarNotas = criarElementoEncomenda('button', 'wallapop-botao wallapop-botao-destaque', 'Guardar notas');
    guardarNotas.type = 'button';
    const statusNotas = criarElementoEncomenda('p', 'admin-encomenda-gestao-status');
    guardarNotas.addEventListener('click', async () => {
        guardarNotas.disabled = true;
        statusNotas.textContent = 'A guardar...';
        const { data, error } = await encomendasClient.rpc('guardar_notas_encomenda_admin', {
            p_encomenda_id: String(encomenda.id),
            p_notas: notas.value
        });
        guardarNotas.disabled = false;
        if (error || data?.sucesso === false) {
            statusNotas.textContent = 'Erro ao guardar: ' + (error?.message || data?.erro || 'sem detalhe');
            return;
        }
        encomenda.notas_internas = notas.value;
        statusNotas.textContent = 'Notas guardadas.';
    });
    notasSecao.append(notas, guardarNotas, statusNotas);

    const anexosSecao = criarElementoEncomenda('section', 'admin-encomenda-anexos');
    anexosSecao.appendChild(criarElementoEncomenda('h3', '', 'Anexos'));
    const lista = criarElementoEncomenda('div', 'admin-encomenda-anexos-lista');
    const statusAnexos = criarElementoEncomenda('p', 'admin-encomenda-gestao-status');
    const concluida = estadoNormalizadoEncomenda(encomenda.estado) === 'Conclu\u00eddo';
    let avisoConcluida = null;
    if (concluida) {
        avisoConcluida = criarElementoEncomenda(
            'p',
            'admin-encomenda-anexos-aviso',
            'Os anexos foram eliminados quando a encomenda foi conclu\u00edda.'
        );
        anexosSecao.appendChild(avisoConcluida);
    } else {
        const upload = criarElementoEncomenda('div', 'admin-encomenda-anexos-upload');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,image/jpeg,image/png,image/webp';
        input.multiple = true;
        const enviar = criarElementoEncomenda('button', 'wallapop-botao wallapop-botao-destaque', 'Adicionar anexos');
        enviar.type = 'button';
        enviar.addEventListener('click', async () => {
            const ficheiros = [...input.files];
            if (!ficheiros.length) {
                statusAnexos.textContent = 'Seleciona pelo menos um ficheiro.';
                return;
            }
            const demasiadoGrandes = ficheiros.filter(item => item.size > ENCOMENDAS_ANEXO_MAX_BYTES);
            if (demasiadoGrandes.length) {
                statusAnexos.textContent = 'Cada anexo pode ter no m\u00e1ximo 10 MB.';
                return;
            }
            enviar.disabled = true;
            input.disabled = true;
            statusAnexos.textContent = 'A enviar anexos...';
            try {
                for (const ficheiro of ficheiros) {
                    const aleatorio = Math.random().toString(36).slice(2, 8);
                    const nome = `${Date.now()}-${aleatorio}-${limparNomeAnexoEncomenda(ficheiro.name)}`;
                    const caminho = `${pastaAnexosEncomenda(encomenda)}/${nome}`;
                    const { error } = await encomendasClient.storage
                        .from(ENCOMENDAS_ANEXOS_BUCKET)
                        .upload(caminho, ficheiro, { cacheControl: '3600', upsert: false });
                    if (error) throw error;
                }
                input.value = '';
                await carregarAnexosEncomenda(encomenda, lista, statusAnexos);
                statusAnexos.textContent = `${ficheiros.length} anexo(s) guardado(s).`;
            } catch (error) {
                statusAnexos.textContent = 'Erro no envio: ' + (error.message || 'sem detalhe');
            } finally {
                enviar.disabled = false;
                input.disabled = false;
            }
        });
        upload.append(input, enviar);
        anexosSecao.appendChild(upload);
    }
    anexosSecao.append(lista, statusAnexos);
    painel.carregarAnexos = async () => {
        if (painel.dataset.anexosCarregados === 'true') return;
        painel.dataset.anexosCarregados = 'true';
        if (concluida) {
            statusAnexos.textContent = 'A verificar anexos residuais...';
            try {
                const eliminados = await apagarAnexosEncomenda(encomenda);
                avisoConcluida.textContent = eliminados
                    ? `${eliminados} anexo(s) residual(is) eliminado(s). As notas internas foram mantidas.`
                    : 'N\u00e3o existem anexos nesta encomenda conclu\u00edda. As notas internas foram mantidas.';
                statusAnexos.textContent = '';
            } catch (error) {
                painel.dataset.anexosCarregados = 'false';
                statusAnexos.textContent = 'N\u00e3o foi poss\u00edvel verificar a elimina\u00e7\u00e3o dos anexos: ' + (error.message || 'sem detalhe');
            }
            return;
        }
        await carregarAnexosEncomenda(encomenda, lista, statusAnexos);
    };
    painel.append(notasSecao, anexosSecao);
    return painel;
}

function textoProdutosEncomenda(encomenda) {
    return obterProdutosEncomenda(encomenda).map(item => {
        const quantidade = Number(item.quantidade || item.qtd || 1);
        const nome = item.nome || 'Produto';
        const referencia = obterReferenciaProdutoEncomenda(item);
        const identificadores = [referencia ? `Ref. ${referencia}` : '', item.sku ? `SKU ${item.sku}` : ''].filter(Boolean).join(' | ');
        const sufixo = identificadores ? ` (${identificadores})` : '';
        const preco = Number(item.preco_unitario ?? item.preco ?? 0);
        return `${quantidade}x ${nome}${sufixo} - ${formatarEuroEncomenda(preco)}`;
    }).join('\n');
}

function textoCompletoEncomenda(encomenda) {
    const morada = [encomenda.morada_cliente, encomenda.cp_cliente, encomenda.cidade_cliente, encomenda.pais_cliente]
        .filter(Boolean).join(', ');
    return [
        `Encomenda: ${encomenda.codigo_encomenda || encomenda.id}`,
        `Data: ${formatarDataEncomenda(encomenda.created_at)}`,
        `Estado: ${estadoNormalizadoEncomenda(encomenda.estado)}`,
        `Origem: ${encomenda.origem || 'Site'}`,
        encomenda.referencia_externa ? `Referência: ${encomenda.referencia_externa}` : '',
        '',
        `Cliente: ${encomenda.nome_cliente || ''}`,
        `E-mail: ${encomenda.email_cliente || ''}`,
        `Telemóvel: ${encomenda.telefone_cliente || ''}`,
        `Morada: ${morada}`,
        '',
        `Envio: ${encomenda.metodo_envio_nome || encomenda.metodo_envio || ''}`,
        `Portes: ${formatarEuroEncomenda(encomenda.portes)}`,
        `Pagamento: ${encomenda.metodo_pagamento || ''}`,
        '',
        'Produtos:',
        textoProdutosEncomenda(encomenda),
        '',
        `Total: ${formatarEuroEncomenda(encomenda.total)}`
    ].join('\n');
}

async function copiarEncomendaAdmin(encomenda) {
    try {
        await navigator.clipboard.writeText(textoCompletoEncomenda(encomenda));
        definirStatusEncomendas(`Encomenda ${encomenda.codigo_encomenda || ''} copiada.`);
    } catch (_) {
        definirStatusEncomendas('Não foi possível copiar os dados.', true);
    }
}

async function atualizarEstadoEncomendaAdmin(encomenda, estado, select) {
    const estadoAnterior = estadoNormalizadoEncomenda(encomenda.estado);
    const origem = String(encomenda.origem || 'Site').toLowerCase();
    const plataformaExterna = ['wallapop', 'olx', 'todocoleccion'].includes(origem);
    let reporStock = false;

    if (estado === 'Conclu\u00eddo' && estadoAnterior !== 'Conclu\u00eddo') {
        const confirmado = window.confirm(
            'Ao concluir a encomenda, todos os anexos ser\u00e3o eliminados definitivamente. As notas internas ser\u00e3o mantidas. Continuar?'
        );
        if (!confirmado) {
            select.value = estadoAnterior;
            return;
        }
    }

    if (estadoAnterior === 'Cancelado' && encomenda.stock_reposto && estado !== 'Cancelado') {
        select.value = estadoAnterior;
        definirStatusEncomendas('Esta encomenda foi cancelada com reposição de stock e não pode ser reaberta.', true);
        return;
    }

    if (estado === 'Cancelado' && plataformaExterna) {
        if (!window.confirm(`Cancelar esta encomenda ${encomenda.origem}?`)) {
            select.value = estadoAnterior;
            return;
        }
        reporStock = !encomenda.stock_reposto && window.confirm(
            'Pretende repor no stock as unidades desta encomenda?'
        );
    }

    select.disabled = true;
    definirStatusEncomendas('A atualizar o estado...');
    try {
        let data = null;
        let error = null;

        if (estado === 'Cancelado' && plataformaExterna) {
            ({ data, error } = await encomendasClient.rpc('cancelar_encomenda_plataforma_admin', {
                p_encomenda_id: String(encomenda.id),
                p_repor_stock: reporStock
            }));
        } else {
            let respostaRpc;
            try {
                respostaRpc = await encomendasClient.rpc('atualizar_estado_encomenda_admin', {
                    p_encomenda_id: String(encomenda.id),
                    p_estado: estado
                });
            } catch (erroRede) {
                respostaRpc = { data: null, error: erroRede };
            }
            data = respostaRpc.data;
            error = respostaRpc.error;

            if (error) {
                try {
                    await atualizarEstadoDiretoEncomendaAdmin(encomenda, estado);
                    data = { sucesso: true, estado };
                    error = null;
                    console.warn('Estado atualizado por fallback direto depois de falha na RPC.', respostaRpc.error);
                } catch (erroFallback) {
                    throw new Error(
                        `RPC: ${detalheErroEncomendas(respostaRpc.error)}. Atualização direta: ${detalheErroEncomendas(erroFallback)}`
                    );
                }
            }
        }
        if (error) throw error;
        if (data?.sucesso === false) throw new Error(data.erro || 'Não foi possível atualizar.');
        encomenda.estado = estado;
        if (data?.stock_reposto) encomenda.stock_reposto = true;
        let anexosEliminados = 0;
        let erroAnexos = null;
        if (estado === 'Conclu\u00eddo') {
            try {
                anexosEliminados = await apagarAnexosEncomenda(encomenda);
            } catch (erroLimpezaAnexos) {
                erroAnexos = erroLimpezaAnexos;
                console.error('Erro ao eliminar anexos da encomenda concluida.', erroLimpezaAnexos);
            }
        }
        select.dataset.estadoAtual = estado;
        atualizarResumoEncomendas();
        renderizarEncomendasAdmin();
        if (erroAnexos) {
            definirStatusEncomendas(
                `Estado atualizado, mas n\u00e3o foi poss\u00edvel eliminar os anexos: ${erroAnexos.message || 'erro desconhecido'}`,
                true
            );
        } else {
            const limpeza = estado === 'Conclu\u00eddo'
                ? ` ${anexosEliminados} anexo(s) eliminado(s).`
                : '';
            definirStatusEncomendas(`Estado da encomenda ${encomenda.codigo_encomenda || ''} atualizado.${limpeza}`);
        }
    } catch (error) {
        select.value = estadoAnterior;
        definirStatusEncomendas('Erro ao atualizar estado: ' + detalheErroEncomendas(error), true);
    } finally {
        select.disabled = false;
    }
}

async function apagarEncomendaAdmin(encomenda, botao) {
    const codigo = encomenda.codigo_encomenda || `#${encomenda.id}`;
    const avisoStock = estadoNormalizadoEncomenda(encomenda.estado) !== 'Cancelado'
        ? '\n\nAtenção: isto não repõe stock. Para repor stock, cancele primeiro a encomenda.'
        : '';
    if (!window.confirm(`Apagar definitivamente a encomenda ${codigo}?${avisoStock}`)) return;
    if (!window.confirm('Confirmar eliminação definitiva? Esta ação não pode ser desfeita.')) return;

    botao.disabled = true;
    definirStatusEncomendas('A apagar encomenda...');
    try {
        try {
            await apagarAnexosEncomenda(encomenda);
        } catch (erroAnexos) {
            console.warn('Nao foi possivel eliminar anexos antes de apagar a encomenda.', erroAnexos);
        }

        const { data, error } = await encomendasClient.rpc('apagar_encomenda_admin', {
            p_encomenda_id: String(encomenda.id)
        });
        if (error || data?.sucesso === false) {
            throw error || new Error(data?.erro || 'Erro ao apagar encomenda');
        }

        encomendasAdmin = encomendasAdmin.filter(item => String(item.id) !== String(encomenda.id));
        atualizarResumoEncomendas();
        renderizarEncomendasAdmin();
        definirStatusEncomendas(`Encomenda ${codigo} apagada.`);
    } catch (error) {
        botao.disabled = false;
        definirStatusEncomendas('Erro ao apagar encomenda: ' + detalheErroEncomendas(error), true);
    }
}

function criarLinhaDetalhe(rotulo, valor) {
    const linha = criarElementoEncomenda('div', 'admin-encomenda-detalhe-linha');
    linha.append(
        criarElementoEncomenda('strong', '', rotulo),
        criarElementoEncomenda('span', '', valor || '—')
    );
    return linha;
}

function definirStatusFichaCliente(texto, erro = false) {
    const status = document.getElementById('admin-cliente-status');
    status.textContent = texto || '';
    status.classList.toggle('msg-erro', erro);
    status.classList.toggle('msg-sucesso', Boolean(texto) && !erro);
}

function fecharFichaClienteAdmin() {
    document.getElementById('admin-cliente-modal').hidden = true;
    document.getElementById('admin-cliente-conteudo').replaceChildren();
    definirStatusFichaCliente('');
    document.body.classList.remove('admin-cliente-modal-aberto');
}

function criarCampoFichaCliente(rotulo, valor) {
    const linha = criarElementoEncomenda('div', 'admin-cliente-campo');
    linha.append(
        criarElementoEncomenda('strong', '', rotulo),
        criarElementoEncomenda('span', '', valor || '\u2014')
    );
    return linha;
}

function criarCampoEdicaoCliente(rotulo, nome, valor, tipo = 'text', obrigatorio = false) {
    const campo = document.createElement('label');
    campo.className = 'admin-cliente-formulario-campo';
    campo.appendChild(criarElementoEncomenda('span', '', rotulo));
    const input = document.createElement('input');
    input.type = tipo;
    input.name = nome;
    input.value = valor || '';
    input.required = obrigatorio;
    input.autocomplete = 'off';
    campo.appendChild(input);
    return campo;
}

function obterPerfisFormularioCliente(formulario) {
    return Array.from(formulario.querySelectorAll('[name^="perfil_url_"]'))
        .map(input => ({ url: input.value.trim() }))
        .filter(perfil => perfil.url);
}

function criarCamposPerfisCliente(perfis = []) {
    const fragmento = document.createDocumentFragment();
    for (let indice = 0; indice < 5; indice += 1) {
        const perfil = perfis[indice] || {};
        fragmento.appendChild(criarCampoEdicaoCliente(
            `Link externo ${indice + 1}`,
            `perfil_url_${indice + 1}`,
            perfil.url || '',
            'url'
        ));
    }
    return fragmento;
}

function renderizarFormularioClienteExterno(dados, secao) {
    const cliente = dados.cliente || {};
    const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
    const formulario = document.createElement('form');
    formulario.className = 'admin-cliente-formulario';
    formulario.append(
        criarCampoEdicaoCliente('Nome', 'nome', cliente.nome, 'text', true),
        criarCampoEdicaoCliente('E-mail', 'email', cliente.email, 'email'),
        criarCampoEdicaoCliente('Telem\u00f3vel', 'telefone', cliente.telefone),
        criarCampoEdicaoCliente('Morada', 'morada', cliente.morada),
        criarCampoEdicaoCliente('C\u00f3digo postal', 'cp', cliente.cp),
        criarCampoEdicaoCliente('Cidade', 'cidade', cliente.cidade),
        criarCampoEdicaoCliente('Pa\u00eds', 'pais', cliente.pais)
    );
    const tituloPerfis = criarElementoEncomenda('h3', 'admin-cliente-formulario-subtitulo', 'Links externos');
    formulario.appendChild(tituloPerfis);
    formulario.appendChild(criarCamposPerfisCliente(perfis));

    const acoes = criarElementoEncomenda('div', 'admin-cliente-formulario-acoes');
    const cancelar = criarElementoEncomenda('button', 'wallapop-botao', 'Cancelar');
    cancelar.type = 'button';
    cancelar.addEventListener('click', () => renderizarFichaClienteAdmin(dados));
    const guardar = criarElementoEncomenda('button', 'wallapop-botao wallapop-botao-destaque', 'Guardar altera\u00e7\u00f5es');
    guardar.type = 'submit';
    acoes.append(cancelar, guardar);
    formulario.appendChild(acoes);

    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        guardar.disabled = true;
        cancelar.disabled = true;
        definirStatusFichaCliente('A guardar dados do cliente...');
        const campos = new FormData(formulario);
        const { data, error } = await encomendasClient.rpc('atualizar_cliente_externo_admin', {
            p_cliente_id: cliente.id,
            p_nome: String(campos.get('nome') || ''),
            p_email: String(campos.get('email') || ''),
            p_telefone: String(campos.get('telefone') || ''),
            p_morada: String(campos.get('morada') || ''),
            p_cp: String(campos.get('cp') || ''),
            p_cidade: String(campos.get('cidade') || ''),
            p_pais: String(campos.get('pais') || '')
        });
        guardar.disabled = false;
        cancelar.disabled = false;
        if (error || data?.sucesso === false) {
            definirStatusFichaCliente('Erro ao guardar dados: ' + (error?.message || data?.erro || 'sem detalhe'), true);
            return;
        }
        const perfisAtualizados = obterPerfisFormularioCliente(formulario);
        const resultadoPerfis = await encomendasClient.rpc('guardar_perfis_cliente_admin', {
            p_cliente_id: cliente.id,
            p_perfis: perfisAtualizados
        });
        if (resultadoPerfis.error || resultadoPerfis.data?.sucesso === false) {
            definirStatusFichaCliente('Dados guardados, mas erro nos links: ' + (resultadoPerfis.error?.message || resultadoPerfis.data?.erro || 'sem detalhe'), true);
            return;
        }
        dados.cliente = data.cliente;
        const fichaAtualizada = await encomendasClient.rpc('obter_ficha_cliente_por_id_admin', {
            p_cliente_id: cliente.id
        });
        renderizarFichaClienteAdmin(fichaAtualizada.data?.sucesso ? fichaAtualizada.data : dados);
        definirStatusFichaCliente('Dados do cliente atualizados.');
    });

    secao.replaceChildren(criarElementoEncomenda('h3', '', 'Editar dados do cliente'), formulario);
    formulario.querySelector('input[name="nome"]').focus();
}

function renderizarFichaClienteAdmin(dados) {
    const conteudo = document.getElementById('admin-cliente-conteudo');
    const cliente = dados.cliente || {};
    const resumo = dados.resumo || {};
    const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
    const historico = Array.isArray(dados.historico) ? dados.historico : [];
    conteudo.replaceChildren();

    const dadosPessoais = criarElementoEncomenda('section', 'admin-cliente-secao');
    const cabecalhoDados = criarElementoEncomenda('div', 'admin-cliente-secao-cabecalho');
    cabecalhoDados.appendChild(criarElementoEncomenda('h3', '', 'Dados do cliente'));
    if (!cliente.auth_user_id) {
        const editar = criarElementoEncomenda('button', 'wallapop-botao admin-cliente-editar', 'Editar dados');
        editar.type = 'button';
        editar.addEventListener('click', () => renderizarFormularioClienteExterno(dados, dadosPessoais));
        cabecalhoDados.appendChild(editar);
    }
    dadosPessoais.appendChild(cabecalhoDados);
    const grelha = criarElementoEncomenda('div', 'admin-cliente-grelha');
    grelha.append(
        criarCampoFichaCliente('Nome', cliente.nome),
        criarCampoFichaCliente('E-mail', cliente.email),
        criarCampoFichaCliente('Telem\u00f3vel', cliente.telefone),
        criarCampoFichaCliente('Morada', [cliente.morada, cliente.cp, cliente.cidade, cliente.pais].filter(Boolean).join(', '))
    );
    dadosPessoais.appendChild(grelha);
    if (cliente.auth_user_id) {
        dadosPessoais.appendChild(criarElementoEncomenda(
            'p',
            'admin-cliente-aviso-conta',
            'Os dados desta conta s\u00e3o geridos pelo pr\u00f3prio cliente no site.'
        ));
    }

    const indicadores = criarElementoEncomenda('section', 'admin-cliente-resumo');
    indicadores.append(
        criarCampoFichaCliente('Encomendas', String(resumo.encomendas || 0)),
        criarCampoFichaCliente('Total comprado', formatarEuroEncomenda(resumo.total)),
        criarCampoFichaCliente('\u00daltima compra', resumo.ultima_compra ? formatarDataEncomenda(resumo.ultima_compra) : '\u2014')
    );

    const perfisSecao = criarElementoEncomenda('section', 'admin-cliente-secao');
    perfisSecao.appendChild(criarElementoEncomenda('h3', '', 'Perfis externos'));
    const listaPerfis = criarElementoEncomenda('div', 'admin-cliente-perfis');
    if (!perfis.length) {
        listaPerfis.appendChild(criarElementoEncomenda('p', 'admin-cliente-vazio', 'Nenhum perfil externo associado.'));
    } else {
        perfis.forEach(perfil => {
            const link = criarElementoEncomenda('a', 'admin-cliente-perfil', `${perfil.plataforma}: ${perfil.utilizador}`);
            link.href = perfil.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            listaPerfis.appendChild(link);
        });
    }
    perfisSecao.appendChild(listaPerfis);

    const historicoSecao = criarElementoEncomenda('section', 'admin-cliente-secao');
    historicoSecao.appendChild(criarElementoEncomenda('h3', '', 'Hist\u00f3rico de encomendas'));
    const listaHistorico = criarElementoEncomenda('div', 'admin-cliente-historico');
    historico.forEach(item => {
        const linha = criarElementoEncomenda('div', 'admin-cliente-historico-linha');
        linha.append(
            criarElementoEncomenda('strong', '', item.codigo || `#${item.id}`),
            criarElementoEncomenda('span', '', item.origem || 'Site'),
            criarElementoEncomenda('span', '', item.estado || ''),
            criarElementoEncomenda('span', '', formatarDataEncomenda(item.data)),
            criarElementoEncomenda('strong', '', formatarEuroEncomenda(item.total))
        );
        listaHistorico.appendChild(linha);
    });
    if (!historico.length) listaHistorico.appendChild(criarElementoEncomenda('p', 'admin-cliente-vazio', 'Sem encomendas associadas.'));
    historicoSecao.appendChild(listaHistorico);

    const notasSecao = criarElementoEncomenda('section', 'admin-cliente-secao');
    notasSecao.appendChild(criarElementoEncomenda('h3', '', 'Notas internas'));
    const notas = document.createElement('textarea');
    notas.className = 'admin-cliente-notas';
    notas.rows = 5;
    notas.maxLength = 5000;
    notas.value = cliente.notas || '';
    notas.placeholder = 'Prefer\u00eancias, observa\u00e7\u00f5es de entrega ou outra informa\u00e7\u00e3o realmente necess\u00e1ria.';
    const guardar = criarElementoEncomenda('button', 'wallapop-botao wallapop-botao-destaque', 'Guardar notas');
    guardar.type = 'button';
    guardar.addEventListener('click', async () => {
        guardar.disabled = true;
        definirStatusFichaCliente('A guardar notas...');
        const { data, error } = await encomendasClient.rpc('guardar_notas_cliente_admin', {
            p_cliente_id: cliente.id,
            p_notas: notas.value
        });
        guardar.disabled = false;
        if (error || data?.sucesso === false) {
            definirStatusFichaCliente('Erro ao guardar notas: ' + (error?.message || data?.erro || 'sem detalhe'), true);
            return;
        }
        definirStatusFichaCliente('Notas guardadas.');
    });
    notasSecao.append(notas, guardar);
    conteudo.append(dadosPessoais, indicadores, perfisSecao, historicoSecao, notasSecao);
}

async function abrirFichaClienteAdmin(encomenda) {
    const modal = document.getElementById('admin-cliente-modal');
    modal.hidden = false;
    document.body.classList.add('admin-cliente-modal-aberto');
    document.getElementById('admin-cliente-conteudo').replaceChildren(
        criarElementoEncomenda('p', 'admin-cliente-carregar', 'A carregar ficha do cliente...')
    );
    definirStatusFichaCliente('');
    const { data, error } = await encomendasClient.rpc('obter_ficha_cliente_admin', {
        p_encomenda_id: String(encomenda.id)
    });
    if (error || data?.sucesso === false) {
        document.getElementById('admin-cliente-conteudo').replaceChildren();
        definirStatusFichaCliente('Erro ao carregar ficha: ' + (error?.message || data?.erro || 'sem detalhe'), true);
        return;
    }
    renderizarFichaClienteAdmin(data);
}

function criarCardEncomenda(encomenda) {
    const card = criarElementoEncomenda(
        'article',
        `admin-encomenda-card${encomenda.prioritaria ? ' prioritaria' : ''}`
    );
    const cabecalho = criarElementoEncomenda('div', 'admin-encomenda-cabecalho');
    cabecalho.tabIndex = 0;
    cabecalho.setAttribute('role', 'button');

    const identificacao = criarElementoEncomenda('div', 'admin-encomenda-identificacao');
    identificacao.append(
        criarElementoEncomenda('strong', '', encomenda.codigo_encomenda || `#${encomenda.id}`),
        criarElementoEncomenda('span', '', formatarDataEncomenda(encomenda.created_at)),
        criarElementoEncomenda('span', 'admin-encomenda-origem', encomenda.origem || 'Site')
    );
    const cliente = criarElementoEncomenda('div', 'admin-encomenda-cliente');
    const abrirCliente = criarElementoEncomenda('button', 'admin-encomenda-cliente-link', encomenda.nome_cliente || 'Cliente sem nome');
    abrirCliente.type = 'button';
    abrirCliente.title = 'Abrir ficha do cliente';
    abrirCliente.addEventListener('click', evento => {
        evento.stopPropagation();
        abrirFichaClienteAdmin(encomenda);
    });
    abrirCliente.addEventListener('keydown', evento => evento.stopPropagation());
    cliente.appendChild(abrirCliente);
    if (encomenda.email_cliente) {
        const abrirClienteEmail = criarElementoEncomenda('button', 'admin-encomenda-cliente-email', encomenda.email_cliente);
        abrirClienteEmail.type = 'button';
        abrirClienteEmail.title = 'Abrir ficha do cliente';
        abrirClienteEmail.addEventListener('click', evento => {
            evento.stopPropagation();
            abrirFichaClienteAdmin(encomenda);
        });
        abrirClienteEmail.addEventListener('keydown', evento => evento.stopPropagation());
        cliente.appendChild(abrirClienteEmail);
    }
    const resumo = criarElementoEncomenda('div', 'admin-encomenda-valor');
    resumo.append(
        criarElementoEncomenda('strong', '', formatarEuroEncomenda(encomenda.total)),
        criarElementoEncomenda('span', `estado-encomenda estado-${normalizarEncomenda(estadoNormalizadoEncomenda(encomenda.estado)).replace(/\s+/g, '-')}`, estadoNormalizadoEncomenda(encomenda.estado))
    );
    const filtroEstado = document.getElementById('filtro-estado-encomendas-admin').value;
    if (filtroEstado === 'Pago' && estadoNormalizadoEncomenda(encomenda.estado) === 'Pago') {
        const prioridade = criarElementoEncomenda('label', 'admin-encomenda-prioridade');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(encomenda.prioritaria);
        checkbox.addEventListener('click', evento => evento.stopPropagation());
        checkbox.addEventListener('keydown', evento => evento.stopPropagation());
        checkbox.addEventListener('change', () => {
            atualizarPrioridadeEncomendaAdmin(encomenda, checkbox.checked, checkbox);
        });
        prioridade.addEventListener('click', evento => evento.stopPropagation());
        prioridade.append(checkbox, criarElementoEncomenda('span', '', 'Priorit\u00e1ria'));
        resumo.appendChild(prioridade);
    }
    cabecalho.append(identificacao, cliente, resumo, criarElementoEncomenda('span', 'admin-encomenda-seta', '▾'));

    const detalhes = criarElementoEncomenda('div', 'admin-encomenda-detalhes');
    detalhes.hidden = true;
    let gestaoEncomenda = null;
    const alternarDetalhes = () => {
        detalhes.hidden = !detalhes.hidden;
        card.classList.toggle('aberta', !detalhes.hidden);
        if (!detalhes.hidden) gestaoEncomenda?.carregarAnexos?.();
    };
    cabecalho.addEventListener('click', alternarDetalhes);
    cabecalho.addEventListener('keydown', evento => {
        if (evento.key !== 'Enter' && evento.key !== ' ') return;
        evento.preventDefault();
        alternarDetalhes();
    });

    const dados = criarElementoEncomenda('div', 'admin-encomenda-dados');
    const morada = [encomenda.morada_cliente, encomenda.cp_cliente, encomenda.cidade_cliente, encomenda.pais_cliente]
        .filter(Boolean).join(', ');
    dados.append(
        criarLinhaDetalhe('Nome', encomenda.nome_cliente),
        criarLinhaDetalhe('E-mail', encomenda.email_cliente),
        criarLinhaDetalhe('Telemóvel', encomenda.telefone_cliente),
        criarLinhaDetalhe('Morada', morada),
        criarLinhaDetalhe('Envio', encomenda.metodo_envio_nome || encomenda.metodo_envio),
        criarLinhaDetalhe('Portes', formatarEuroEncomenda(encomenda.portes)),
        criarLinhaDetalhe('Pagamento', encomenda.metodo_pagamento)
    );
    if (encomenda.referencia_externa) {
        dados.appendChild(criarLinhaDetalhe('Referência externa', encomenda.referencia_externa));
    }
    if (encomenda.stock_reposto) {
        dados.appendChild(criarLinhaDetalhe('Stock', 'Reposto após cancelamento'));
    }

    const produtos = criarElementoEncomenda('div', 'admin-encomenda-produtos');
    produtos.appendChild(criarElementoEncomenda('h3', '', 'Produtos'));
    const lista = criarElementoEncomenda('div', 'admin-encomenda-produtos-lista');
    obterProdutosEncomenda(encomenda).forEach(item => {
        const linha = criarElementoEncomenda('div', 'admin-encomenda-produto');
        const quantidade = Number(item.quantidade || item.qtd || 1);
        const preco = Number(item.preco_unitario ?? item.preco ?? 0);
        linha.append(
            criarElementoEncomenda('span', 'admin-encomenda-produto-quantidade', `${quantidade}x`),
            criarElementoEncomenda('strong', 'admin-encomenda-produto-nome', item.nome || 'Produto'),
            criarMiniaturaProdutoEncomenda(item),
            criarElementoEncomenda('span', 'admin-encomenda-produto-referencia', `Ref. ${obterReferenciaProdutoEncomenda(item) || '—'}`),
            criarElementoEncomenda('span', 'admin-encomenda-produto-sku', `SKU ${item.sku || '—'}`),
            criarElementoEncomenda('span', 'admin-encomenda-produto-preco', formatarEuroEncomenda(preco))
        );
        lista.appendChild(linha);
    });
    produtos.append(lista, criarElementoEncomenda('p', 'admin-encomenda-total', `Total: ${formatarEuroEncomenda(encomenda.total)}`));

    const acoes = criarElementoEncomenda('div', 'admin-encomenda-acoes');
    const grupoEstado = criarElementoEncomenda('label', 'admin-encomenda-estado-edicao');
    grupoEstado.appendChild(criarElementoEncomenda('span', '', 'Estado'));
    const select = document.createElement('select');
    const estadoAtual = estadoNormalizadoEncomenda(encomenda.estado);
    ESTADOS_ENCOMENDA.forEach(estado => {
        const option = new Option(estado, estado, false, estado === estadoAtual);
        select.add(option);
    });
    select.dataset.estadoAtual = estadoAtual;
    select.addEventListener('change', () => atualizarEstadoEncomendaAdmin(encomenda, select.value, select));
    grupoEstado.appendChild(select);
    const copiar = criarElementoEncomenda('button', 'wallapop-botao', 'Copiar dados');
    copiar.type = 'button';
    copiar.addEventListener('click', () => copiarEncomendaAdmin(encomenda));
    const botoes = criarElementoEncomenda('div', 'admin-encomenda-botoes');
    const origem = normalizarEncomenda(encomenda.origem);
    const plataformaExterna = ['wallapop', 'olx', 'todocoleccion'].includes(origem);
    const podeEditar = plataformaExterna
        && estadoNormalizadoEncomenda(encomenda.estado) !== 'Cancelado'
        && encomenda.codigo_encomenda;
    if (podeEditar) {
        const editar = criarElementoEncomenda('a', 'wallapop-botao admin-encomenda-editar', 'Editar encomenda');
        editar.href = `plataforma.html?editar=${encodeURIComponent(encomenda.codigo_encomenda)}`;
        botoes.appendChild(editar);
    }
    const apagar = criarElementoEncomenda('button', 'wallapop-botao admin-encomenda-apagar', 'Apagar encomenda');
    apagar.type = 'button';
    apagar.addEventListener('click', () => apagarEncomendaAdmin(encomenda, apagar));
    botoes.appendChild(copiar);
    botoes.appendChild(apagar);
    acoes.append(grupoEstado, botoes);

    gestaoEncomenda = criarGestaoEncomenda(encomenda);
    detalhes.append(dados, produtos, gestaoEncomenda, acoes);
    card.append(cabecalho, detalhes);
    return card;
}

function encomendasFiltradasAdmin() {
    const pesquisa = normalizarEncomenda(document.getElementById('pesquisa-encomendas-admin').value);
    const estado = document.getElementById('filtro-estado-encomendas-admin').value;
    const filtradas = encomendasAdmin.filter(encomenda => {
        const correspondeEstado = estado === 'todos' || estadoNormalizadoEncomenda(encomenda.estado) === estado;
        const texto = normalizarEncomenda([
            encomenda.codigo_encomenda,
            encomenda.nome_cliente,
            encomenda.email_cliente,
            encomenda.origem,
            encomenda.referencia_externa
        ].join(' '));
        return correspondeEstado && (!pesquisa || texto.includes(pesquisa));
    });

    if (estado === 'Pago') {
        filtradas.sort((a, b) => {
            const prioridadeA = a.prioritaria ? 1 : 0;
            const prioridadeB = b.prioritaria ? 1 : 0;
            if (prioridadeA !== prioridadeB) return prioridadeB - prioridadeA;
            const dataA = new Date(a.created_at).getTime();
            const dataB = new Date(b.created_at).getTime();
            return (Number.isNaN(dataA) ? Number.MAX_SAFE_INTEGER : dataA)
                - (Number.isNaN(dataB) ? Number.MAX_SAFE_INTEGER : dataB);
        });
    }

    return filtradas;
}

function renderizarEncomendasAdmin() {
    const lista = document.getElementById('lista-encomendas-admin');
    const filtradas = encomendasFiltradasAdmin();
    lista.replaceChildren();
    document.getElementById('contagem-encomendas-admin').textContent = `${filtradas.length} encomenda(s) apresentada(s)`;
    if (!filtradas.length) {
        lista.appendChild(criarElementoEncomenda('p', 'admin-encomendas-vazio', 'Nenhuma encomenda encontrada.'));
        return;
    }
    filtradas.forEach(encomenda => lista.appendChild(criarCardEncomenda(encomenda)));
}

function atualizarResumoEncomendas() {
    const contar = estado => encomendasAdmin.filter(item => estadoNormalizadoEncomenda(item.estado) === estado).length;
    document.getElementById('encomendas-total').textContent = encomendasAdmin.length;
    document.getElementById('encomendas-pendentes').textContent = contar('A aguardar pagamento');
    document.getElementById('encomendas-preparacao').textContent = contar('Em preparação');
    document.getElementById('encomendas-enviadas').textContent = contar('Enviado');
}

async function carregarEncomendasAdmin() {
    definirStatusEncomendas('A carregar encomendas...');
    const { data, error } = await encomendasClient
        .from('encomendas')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    encomendasAdmin = data || [];
    await carregarImagensProdutosEncomendas();
    atualizarResumoEncomendas();
    renderizarEncomendasAdmin();
    definirStatusEncomendas('');
}

async function carregarImagensProdutosEncomendas() {
    imagensProdutosEncomendas = new Map();
    imagensProdutosEncomendasPorSku = new Map();
    referenciasProdutosEncomendas = new Map();
    referenciasProdutosEncomendasPorSku = new Map();
    const ids = [...new Set(encomendasAdmin.flatMap(obterProdutosEncomenda)
        .map(item => String(item.id_produto || item.id || ''))
        .filter(Boolean))];
    if (!ids.length) return;

    for (let inicio = 0; inicio < ids.length; inicio += 200) {
        const loteIds = ids.slice(inicio, inicio + 200);
        let produtos = [];
        const respostaAdmin = await encomendasClient.rpc('obter_imagens_produtos_encomendas_admin', {
            p_ids: loteIds
        });

        if (!respostaAdmin.error) {
            produtos = Array.isArray(respostaAdmin.data) ? respostaAdmin.data : [];
        } else {
            // Mantem o painel funcional antes de a RPC administrativa ser instalada.
            const respostaPublica = await encomendasClient
                .from('produtos_loja')
                .select('id, sku, imagens')
                .in('id', loteIds);
            if (respostaPublica.error) {
                console.warn('Nao foi possivel carregar fotografias das encomendas.', respostaPublica.error);
                continue;
            }
            produtos = respostaPublica.data || [];
        }

        produtos.forEach(produto => {
            const referencia = String(produto.referencia || '').trim();
            if (referencia) {
                referenciasProdutosEncomendas.set(String(produto.id), referencia);
                if (produto.sku) referenciasProdutosEncomendasPorSku.set(String(produto.sku).toUpperCase(), referencia);
            }
            const imagem = obterPrimeiraImagemEncomenda(produto.imagens);
            if (!imagem) return;
            imagensProdutosEncomendas.set(String(produto.id), imagem);
            if (produto.sku) imagensProdutosEncomendasPorSku.set(String(produto.sku).toUpperCase(), imagem);
        });
    }
}

async function iniciarPainelEncomendas() {
    const bloqueio = document.getElementById('encomendas-bloqueio');
    try {
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase não carregou.');
        encomendasClient = supabase.createClient(ENCOMENDAS_SUPABASE_URL, ENCOMENDAS_SUPABASE_KEY);
        const { data: { user }, error } = await encomendasClient.auth.getUser();
        if (error || !user || !ENCOMENDAS_ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
            bloqueio.textContent = 'Acesso reservado ao administrador. A regressar à conta...';
            setTimeout(() => window.location.replace('conta.html'), 1400);
            return;
        }
        bloqueio.hidden = true;
        document.getElementById('encomendas-aplicacao').hidden = false;
        await carregarEncomendasAdmin();
    } catch (error) {
        console.error(error);
        bloqueio.hidden = false;
        bloqueio.textContent = 'Erro ao abrir o painel: ' + (error.message || 'sem detalhe disponível');
    }
}

document.getElementById('pesquisa-encomendas-admin').addEventListener('input', renderizarEncomendasAdmin);
document.getElementById('filtro-estado-encomendas-admin').addEventListener('change', renderizarEncomendasAdmin);
document.getElementById('btn-atualizar-encomendas').addEventListener('click', async () => {
    try { await carregarEncomendasAdmin(); }
    catch (error) { definirStatusEncomendas('Erro ao carregar: ' + (error.message || 'sem detalhe'), true); }
});
document.getElementById('admin-imagem-modal-fechar').addEventListener('click', fecharImagemProdutoEncomenda);
document.getElementById('admin-cliente-fechar').addEventListener('click', fecharFichaClienteAdmin);
document.getElementById('admin-cliente-modal').addEventListener('click', evento => {
    if (evento.target === evento.currentTarget) fecharFichaClienteAdmin();
});
document.getElementById('admin-imagem-modal').addEventListener('click', evento => {
    if (evento.target === evento.currentTarget) fecharImagemProdutoEncomenda();
});
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !document.getElementById('admin-imagem-modal').hidden) {
        fecharImagemProdutoEncomenda();
    } else if (evento.key === 'Escape' && !document.getElementById('admin-cliente-modal').hidden) {
        fecharFichaClienteAdmin();
    }
});
window.addEventListener('load', iniciarPainelEncomendas);
