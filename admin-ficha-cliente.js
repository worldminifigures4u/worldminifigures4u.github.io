(function (global) {
    'use strict';

    let fichaClient = null;
    let formatarEuro = (valor) => String(Number(valor || 0).toFixed(2)).replace('.', ',');
    let formatarData = (valor) => String(valor || '\u2014');
    let eventosConfigurados = false;
    let aoCriarCliente = null;

    function criarElemento(tag, classe, texto) {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    }

    function obterUrlExternoSeguro(valor) {
        const texto = String(valor || '').trim();
        if (!texto) return '';
        try {
            const url = new URL(texto);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    function definirStatusFichaCliente(texto, erro = false) {
        const status = document.getElementById('admin-cliente-status');
        if (!status) return;
        status.textContent = texto || '';
        status.classList.toggle('msg-erro', erro);
        status.classList.toggle('msg-sucesso', Boolean(texto) && !erro);
    }

    function fecharFichaClienteAdmin() {
        const modal = document.getElementById('admin-cliente-modal');
        if (!modal) return;
        modal.hidden = true;
        document.getElementById('admin-cliente-conteudo')?.replaceChildren();
        definirStatusFichaCliente('');
        document.body.classList.remove('admin-cliente-modal-aberto');
        const titulo = document.getElementById('admin-cliente-titulo');
        if (titulo) titulo.textContent = 'Ficha de cliente';
        aoCriarCliente = null;
    }

    function criarCampoFichaCliente(rotulo, valor) {
        const linha = criarElemento('div', 'admin-cliente-campo');
        linha.append(
            criarElemento('strong', '', rotulo),
            criarElemento('span', '', valor || '\u2014')
        );
        return linha;
    }

    function criarCampoFichaMorada(cliente) {
        const linha = criarElemento('div', 'admin-cliente-campo admin-cliente-campo-morada-bloco');
        linha.appendChild(criarElemento('strong', '', 'Morada'));
        const formatar = global.MoradaFormato;
        if (formatar?.criarBlocoMorada) {
            linha.appendChild(formatar.criarBlocoMorada(formatar.formatarLinhasMorada(cliente), criarElemento));
        } else {
            linha.appendChild(criarElemento(
                'span',
                '',
                [cliente.morada, cliente.cp, cliente.cidade, cliente.pais].filter(Boolean).join(', ') || '\u2014'
            ));
        }
        return linha;
    }

    function criarCampoEdicaoCliente(rotulo, nome, valor, tipo = 'text', obrigatorio = false) {
        const campo = document.createElement('label');
        campo.className = 'admin-cliente-formulario-campo';
        campo.classList.add(`admin-cliente-campo-${nome}`);
        campo.appendChild(criarElemento('span', '', rotulo));
        const input = document.createElement('input');
        input.type = tipo;
        input.name = nome;
        input.value = valor || '';
        input.required = obrigatorio;
        input.autocomplete = 'off';
        campo.appendChild(input);
        return campo;
    }

    function criarCampoNotasCliente(valor = '', linhas = 8) {
        const campo = document.createElement('label');
        campo.className = 'admin-cliente-formulario-campo admin-cliente-formulario-notas';
        campo.appendChild(criarElemento('span', '', 'Notas internas'));
        const notas = document.createElement('textarea');
        notas.className = 'admin-cliente-notas';
        notas.name = 'notas';
        notas.rows = linhas;
        notas.maxLength = 5000;
        notas.value = valor || '';
        notas.placeholder = 'Notas internas visiveis apenas ao administrador.';
        campo.appendChild(notas);
        return campo;
    }

    function obterPerfisFormularioCliente(formulario) {
        return Array.from(formulario.querySelectorAll('[name^="perfil_url_"]'))
            .map((input) => ({ url: input.value.trim() }))
            .filter((perfil) => perfil.url);
    }

    function criarCamposPerfisCliente(perfis = [], comNotas = false, notasValor = '') {
        const fragmento = document.createDocumentFragment();
        for (let indice = 0; indice < 5; indice += 1) {
            const perfil = perfis[indice] || {};
            fragmento.appendChild(criarCampoEdicaoCliente(
                indice === 0 ? 'Link principal' : `Link externo ${indice + 1}`,
                `perfil_url_${indice + 1}`,
                perfil.url || '',
                'url'
            ));
            if (comNotas && indice === 0) {
                fragmento.appendChild(criarCampoNotasCliente(notasValor));
            }
        }
        return fragmento;
    }

    function criarCheckboxClienteModal(rotulo, nome, marcado = false) {
        const campo = document.createElement('label');
        campo.className = 'admin-cliente-formulario-campo admin-cliente-formulario-checkbox';
        campo.classList.add(`admin-cliente-campo-${nome}`);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = nome;
        input.checked = Boolean(marcado);
        campo.append(input, criarElemento('span', '', rotulo));
        return campo;
    }

    function criarSecaoRestricoesFormularioModal(cliente = {}) {
        const secao = criarElemento('div', 'clientes-restricoes-formulario');
        secao.appendChild(criarElemento('h3', 'admin-cliente-formulario-subtitulo', 'Restricoes do site'));
        secao.appendChild(criarElemento(
            'p',
            'clientes-restricoes-ajuda',
            'Bloquear compras: o cliente mantem login, mas nao finaliza encomendas. Bloquear login: a conta deixa de entrar no site.'
        ));
        secao.append(
            criarCheckboxClienteModal('Bloquear compras no site', 'bloquear_compras', cliente.bloquear_compras),
            criarCheckboxClienteModal('Bloquear login no site', 'bloquear_conta', cliente.bloquear_conta)
        );
        return secao;
    }

    function montarFormularioClienteModal(opcoes = {}) {
        const {
            cliente = {},
            perfis = [],
            modoCriacao = false,
            onCancelar = null,
            onSubmit = null
        } = opcoes;

        const formulario = document.createElement('form');
        formulario.className = 'admin-cliente-formulario clientes-formulario';
        formulario.id = `admin-cliente-formulario-${cliente.id || 'novo'}`;

        const cancelar = criarElemento('button', 'wallapop-botao', 'Cancelar');
        cancelar.type = 'button';
        if (typeof onCancelar === 'function') {
            cancelar.addEventListener('click', onCancelar);
        }

        const guardar = criarElemento(
            'button',
            'wallapop-botao wallapop-botao-destaque',
            modoCriacao ? 'Gravar' : 'Guardar ficha'
        );
        guardar.type = 'submit';

        const acoesTopo = criarElemento('div', 'clientes-formulario-acoes-topo admin-cliente-formulario-acoes');
        acoesTopo.append(cancelar, guardar);
        formulario.appendChild(acoesTopo);

        const dadosCliente = criarElemento('div', 'clientes-formulario-dados');
        dadosCliente.append(
            criarCampoEdicaoCliente('Nome', 'nome', cliente.nome || '', 'text', true),
            global.MoradaFormato?.criarCampoMoradaEdicao(
                criarElemento,
                global.MoradaFormato.obterMoradaEdicao(cliente.morada)
            ) || criarCampoEdicaoCliente('Morada', 'morada', cliente.morada || ''),
            criarCampoEdicaoCliente('C\u00f3digo postal', 'cp', cliente.cp || ''),
            criarCampoEdicaoCliente('Cidade', 'cidade', cliente.cidade || ''),
            criarCampoEdicaoCliente('Pa\u00eds', 'pais', cliente.pais || (modoCriacao ? 'Portugal' : '')),
            criarCampoEdicaoCliente('Telem\u00f3vel', 'telefone', cliente.telefone || ''),
            criarCampoEdicaoCliente('E-mail', 'email', cliente.email || '', 'email')
        );
        if (!modoCriacao) {
            dadosCliente.appendChild(criarSecaoRestricoesFormularioModal(cliente));
        }
        formulario.appendChild(dadosCliente);

        const linksExternos = criarElemento('div', 'clientes-formulario-links');
        linksExternos.appendChild(criarCamposPerfisCliente(perfis, true, cliente.notas || ''));
        formulario.appendChild(linksExternos);

        formulario.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            if (typeof onSubmit !== 'function') return;
            guardar.disabled = true;
            cancelar.disabled = true;
            try {
                await onSubmit({ formulario, guardar, cancelar, campos: new FormData(formulario) });
            } finally {
                guardar.disabled = false;
                cancelar.disabled = false;
            }
        });

        return { formulario, cancelar, guardar };
    }

    function renderizarFormularioClienteExterno(dados) {
        const conteudo = document.getElementById('admin-cliente-conteudo');
        if (!conteudo) return;
        const cliente = dados.cliente || {};
        const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
        const { formulario } = montarFormularioClienteModal({
            cliente,
            perfis,
            modoCriacao: false,
            onCancelar: () => renderizarFichaClienteAdmin(dados),
            onSubmit: async ({ formulario: form, campos }) => {
                definirStatusFichaCliente('A guardar dados do cliente...');
                const { data, error } = await fichaClient.rpc('atualizar_cliente_externo_admin', {
                    p_cliente_id: cliente.id,
                    p_nome: String(campos.get('nome') || ''),
                    p_email: String(campos.get('email') || ''),
                    p_telefone: String(campos.get('telefone') || ''),
                    p_morada: global.MoradaFormato?.obterMoradaFormulario(form) || String(campos.get('morada') || ''),
                    p_cp: String(campos.get('cp') || ''),
                    p_cidade: String(campos.get('cidade') || ''),
                    p_pais: String(campos.get('pais') || '')
                });
                if (error || data?.sucesso === false) {
                    definirStatusFichaCliente('Erro ao guardar dados: ' + (error?.message || data?.erro || 'sem detalhe'), true);
                    return;
                }
                const resultadoPerfis = await fichaClient.rpc('guardar_perfis_cliente_admin', {
                    p_cliente_id: cliente.id,
                    p_perfis: obterPerfisFormularioCliente(form)
                });
                if (resultadoPerfis.error || resultadoPerfis.data?.sucesso === false) {
                    definirStatusFichaCliente('Dados guardados, mas erro nos links: ' + (resultadoPerfis.error?.message || resultadoPerfis.data?.erro || 'sem detalhe'), true);
                    return;
                }
                const resultadoNotas = await fichaClient.rpc('guardar_notas_cliente_admin', {
                    p_cliente_id: cliente.id,
                    p_notas: String(campos.get('notas') || '')
                });
                if (resultadoNotas.error || resultadoNotas.data?.sucesso === false) {
                    definirStatusFichaCliente('Dados guardados, mas erro nas notas: ' + (resultadoNotas.error?.message || resultadoNotas.data?.erro || 'sem detalhe'), true);
                    return;
                }
                const resultadoRestricoes = await fichaClient.rpc('guardar_restricoes_cliente_admin', {
                    p_cliente_id: cliente.id,
                    p_bloquear_compras: campos.get('bloquear_compras') === 'on',
                    p_bloquear_conta: campos.get('bloquear_conta') === 'on'
                });
                if (resultadoRestricoes.error || resultadoRestricoes.data?.sucesso === false) {
                    definirStatusFichaCliente('Dados guardados, mas erro nas restricoes: ' + (resultadoRestricoes.error?.message || resultadoRestricoes.data?.erro || 'sem detalhe'), true);
                    return;
                }
                dados.cliente = {
                    ...(data.cliente || cliente),
                    notas: String(campos.get('notas') || ''),
                    bloquear_compras: campos.get('bloquear_compras') === 'on',
                    bloquear_conta: campos.get('bloquear_conta') === 'on'
                };
                const fichaAtualizada = await fichaClient.rpc('obter_ficha_cliente_por_id_admin', {
                    p_cliente_id: cliente.id
                });
                renderizarFichaClienteAdmin(fichaAtualizada.data?.sucesso ? fichaAtualizada.data : dados);
                definirStatusFichaCliente('Dados do cliente atualizados.');
            }
        });

        conteudo.replaceChildren(formulario);
        formulario.querySelector('input[name="nome"]')?.focus();
    }

    function renderizarFormularioCriacaoCliente(opcoes = {}) {
        const conteudo = document.getElementById('admin-cliente-conteudo');
        if (!conteudo) return;

        const urlInicial = obterUrlExternoSeguro(opcoes.url || '');
        const nomeInicial = String(opcoes.nome || '').trim();
        const { formulario } = montarFormularioClienteModal({
            cliente: { nome: nomeInicial, pais: 'Portugal' },
            perfis: urlInicial ? [{ url: urlInicial }] : [],
            modoCriacao: true,
            onCancelar: fecharFichaClienteAdmin,
            onSubmit: async ({ formulario: form, campos }) => {
                if (!fichaClient) {
                    definirStatusFichaCliente('Sess\u00e3o indispon\u00edvel para criar a ficha.', true);
                    return;
                }
                definirStatusFichaCliente('A criar ficha de cliente...');
                const { data, error } = await fichaClient.rpc('criar_cliente_externo_admin', {
                    p_nome: String(campos.get('nome') || ''),
                    p_email: String(campos.get('email') || ''),
                    p_telefone: String(campos.get('telefone') || ''),
                    p_morada: global.MoradaFormato?.obterMoradaFormulario(form) || String(campos.get('morada') || ''),
                    p_cp: String(campos.get('cp') || ''),
                    p_cidade: String(campos.get('cidade') || ''),
                    p_pais: String(campos.get('pais') || '')
                });
                if (error || data?.sucesso === false) {
                    definirStatusFichaCliente('Erro ao criar ficha: ' + (error?.message || data?.erro || 'sem detalhe'), true);
                    return;
                }
                const clienteId = data?.cliente?.id;
                if (!clienteId) {
                    definirStatusFichaCliente('Cliente criado sem identificador. Atualize a p\u00e1gina.', true);
                    return;
                }
                const resultadoPerfis = await fichaClient.rpc('guardar_perfis_cliente_admin', {
                    p_cliente_id: clienteId,
                    p_perfis: obterPerfisFormularioCliente(form)
                });
                if (resultadoPerfis.error || resultadoPerfis.data?.sucesso === false) {
                    definirStatusFichaCliente('Cliente criado, mas erro nos links: ' + (resultadoPerfis.error?.message || resultadoPerfis.data?.erro || 'sem detalhe'), true);
                    return;
                }
                const notasTexto = String(campos.get('notas') || '').trim();
                if (notasTexto) {
                    await fichaClient.rpc('guardar_notas_cliente_admin', {
                        p_cliente_id: clienteId,
                        p_notas: notasTexto
                    });
                }
                definirStatusFichaCliente('Ficha criada.');
                const callback = aoCriarCliente;
                aoCriarCliente = null;
                fecharFichaClienteAdmin();
                if (typeof callback === 'function') {
                    try {
                        await callback(clienteId, data.cliente);
                    } catch (erroCallback) {
                        console.error('Callback apos criar ficha falhou:', erroCallback);
                    }
                }
            }
        });

        conteudo.replaceChildren(formulario);
        formulario.querySelector('input[name="nome"]')?.focus();
    }

    function abrirCriacao(opcoes = {}) {
        const modal = document.getElementById('admin-cliente-modal');
        if (!modal || !fichaClient) return false;
        aoCriarCliente = typeof opcoes.onCriado === 'function' ? opcoes.onCriado : null;
        const titulo = document.getElementById('admin-cliente-titulo');
        if (titulo) titulo.textContent = 'Criar ficha de cliente';
        modal.hidden = false;
        document.body.classList.add('admin-cliente-modal-aberto');
        definirStatusFichaCliente('');
        renderizarFormularioCriacaoCliente(opcoes);
        return true;
    }

    function criarCodigoHistoricoEncomenda(item) {
        return criarElemento('strong', '', item.codigo || item.codigo_encomenda || `#${item.id}`);
    }

    function renderizarFichaClienteAdmin(dados) {
        const conteudo = document.getElementById('admin-cliente-conteudo');
        if (!conteudo) return;
        const cliente = dados.cliente || {};
        const resumo = dados.resumo || {};
        const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
        const historico = Array.isArray(dados.historico) ? dados.historico : [];
        conteudo.replaceChildren();

        const dadosPessoais = criarElemento('section', 'admin-cliente-secao');
        const cabecalhoDados = criarElemento('div', 'admin-cliente-secao-cabecalho');
        cabecalhoDados.appendChild(criarElemento('h3', '', 'Dados do cliente'));
        if (!cliente.auth_user_id) {
            const editar = criarElemento('button', 'wallapop-botao admin-cliente-editar', 'Editar dados');
            editar.type = 'button';
            editar.addEventListener('click', () => renderizarFormularioClienteExterno(dados));
            cabecalhoDados.appendChild(editar);
        }
        dadosPessoais.appendChild(cabecalhoDados);
        const grelha = criarElemento('div', 'admin-cliente-grelha');
        grelha.append(
            criarCampoFichaCliente('E-mail', cliente.email),
            criarCampoFichaCliente('Telem\u00f3vel', cliente.telefone),
            criarCampoFichaMorada(cliente)
        );
        dadosPessoais.appendChild(grelha);
        const restricoes = [];
        if (cliente.bloquear_conta) restricoes.push('Login bloqueado no site');
        if (cliente.bloquear_compras) restricoes.push('Compras bloqueadas no site');
        if (restricoes.length) {
            dadosPessoais.appendChild(criarElemento('p', 'admin-cliente-restricoes', restricoes.join(' \u2022 ')));
        }
        if (cliente.auth_user_id) {
            dadosPessoais.appendChild(criarElemento(
                'p',
                'admin-cliente-aviso-conta',
                'Os dados desta conta s\u00e3o geridos pelo pr\u00f3prio cliente no site.'
            ));
        }

        const indicadores = criarElemento('section', 'admin-cliente-resumo');
        indicadores.append(
            criarCampoFichaCliente('Encomendas', String(resumo.encomendas || 0)),
            criarCampoFichaCliente('Total comprado', `${formatarEuro(resumo.total)} \u20ac`),
            criarCampoFichaCliente('\u00daltima compra', resumo.ultima_compra ? formatarData(resumo.ultima_compra) : '\u2014')
        );

        const perfisSecao = criarElemento('section', 'admin-cliente-secao');
        perfisSecao.appendChild(criarElemento('h3', '', 'Perfis externos'));
        const listaPerfis = criarElemento('div', 'admin-cliente-perfis');
        if (!perfis.length) {
            listaPerfis.appendChild(criarElemento('p', 'admin-cliente-vazio', 'Nenhum perfil externo associado.'));
        } else {
            perfis.forEach((perfil) => {
                const link = criarElemento('a', 'admin-cliente-perfil', `${perfil.plataforma}: ${perfil.utilizador}`);
                link.href = obterUrlExternoSeguro(perfil.url) || '#';
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                listaPerfis.appendChild(link);
            });
        }
        perfisSecao.appendChild(listaPerfis);

        const historicoSecao = criarElemento('section', 'admin-cliente-secao');
        historicoSecao.appendChild(criarElemento('h3', '', 'Hist\u00f3rico de encomendas'));
        const listaHistorico = criarElemento('div', 'admin-cliente-historico');
        historico.forEach((item) => {
            const cancelada = String(item.estado || '').trim().toLowerCase() === 'cancelado';
            const linha = criarElemento('div', 'admin-cliente-historico-linha');
            if (cancelada) linha.classList.add('clientes-historico-cancelada');
            const estado = criarElemento('span', cancelada ? 'clientes-historico-estado-cancelada' : '', item.estado || '');
            linha.append(
                criarCodigoHistoricoEncomenda(item),
                criarElemento('span', 'clientes-historico-origem', item.origem || 'Site'),
                estado,
                criarElemento('span', 'clientes-historico-data', formatarData(item.data)),
                criarElemento('strong', 'clientes-historico-total', `${formatarEuro(item.total)} \u20ac`)
            );
            listaHistorico.appendChild(linha);
        });
        if (!historico.length) listaHistorico.appendChild(criarElemento('p', 'admin-cliente-vazio', 'Sem encomendas associadas.'));
        historicoSecao.appendChild(listaHistorico);

        const notasSecao = criarElemento('section', 'admin-cliente-secao');
        notasSecao.appendChild(criarElemento('h3', '', 'Notas internas'));
        const notas = document.createElement('textarea');
        notas.className = 'admin-cliente-notas';
        notas.rows = 5;
        notas.maxLength = 5000;
        notas.value = cliente.notas || '';
        notas.placeholder = 'Prefer\u00eancias, observa\u00e7\u00f5es de entrega ou outra informa\u00e7\u00e3o realmente necess\u00e1ria.';
        const guardar = criarElemento('button', 'wallapop-botao wallapop-botao-destaque', 'Guardar notas');
        guardar.type = 'button';
        guardar.addEventListener('click', async () => {
            guardar.disabled = true;
            definirStatusFichaCliente('A guardar notas...');
            const { data, error } = await fichaClient.rpc('guardar_notas_cliente_admin', {
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

    async function abrirPorId(clienteId) {
        const modal = document.getElementById('admin-cliente-modal');
        if (!modal || !fichaClient || !clienteId) return false;
        modal.hidden = false;
        document.body.classList.add('admin-cliente-modal-aberto');
        document.getElementById('admin-cliente-conteudo')?.replaceChildren(
            criarElemento('p', 'admin-cliente-carregar', 'A carregar ficha do cliente...')
        );
        definirStatusFichaCliente('');
        const { data, error } = await fichaClient.rpc('obter_ficha_cliente_por_id_admin', {
            p_cliente_id: String(clienteId)
        });
        if (error || data?.sucesso === false) {
            document.getElementById('admin-cliente-conteudo')?.replaceChildren();
            definirStatusFichaCliente('Erro ao carregar ficha: ' + (error?.message || data?.erro || 'sem detalhe'), true);
            return false;
        }
        renderizarFichaClienteAdmin(data);
        return true;
    }

    async function abrirPorEncomenda(encomendaId) {
        const modal = document.getElementById('admin-cliente-modal');
        if (!modal || !fichaClient || !encomendaId) return false;
        modal.hidden = false;
        document.body.classList.add('admin-cliente-modal-aberto');
        document.getElementById('admin-cliente-conteudo')?.replaceChildren(
            criarElemento('p', 'admin-cliente-carregar', 'A carregar ficha do cliente...')
        );
        definirStatusFichaCliente('');
        const { data, error } = await fichaClient.rpc('obter_ficha_cliente_admin', {
            p_encomenda_id: String(encomendaId)
        });
        if (error || data?.sucesso === false) {
            document.getElementById('admin-cliente-conteudo')?.replaceChildren();
            definirStatusFichaCliente('Erro ao carregar ficha: ' + (error?.message || data?.erro || 'sem detalhe'), true);
            return false;
        }
        renderizarFichaClienteAdmin(data);
        return true;
    }

    function configurar(opcoes = {}) {
        fichaClient = opcoes.client || fichaClient;
        if (typeof opcoes.formatarEuro === 'function') formatarEuro = opcoes.formatarEuro;
        if (typeof opcoes.formatarData === 'function') formatarData = opcoes.formatarData;
    }

    function ligarFechoPorFundoModal(modal, fechar) {
        let pointerDownNoFundo = false;
        modal.addEventListener('pointerdown', (evento) => {
            pointerDownNoFundo = evento.target === modal;
        });
        modal.addEventListener('pointercancel', () => {
            pointerDownNoFundo = false;
        });
        modal.addEventListener('click', (evento) => {
            if (evento.target === modal && pointerDownNoFundo) fechar();
            pointerDownNoFundo = false;
        });
        const dialogo = modal.querySelector('.admin-cliente-dialogo');
        dialogo?.addEventListener('click', (evento) => evento.stopPropagation());
    }

    function initEventos() {
        if (eventosConfigurados) return;
        const modal = document.getElementById('admin-cliente-modal');
        const fechar = document.getElementById('admin-cliente-fechar');
        if (!modal || !fechar) return;
        fechar.addEventListener('click', fecharFichaClienteAdmin);
        ligarFechoPorFundoModal(modal, fecharFichaClienteAdmin);
        document.addEventListener('keydown', (evento) => {
            if (evento.key === 'Escape' && !modal.hidden) fecharFichaClienteAdmin();
        });
        eventosConfigurados = true;
    }

    global.AdminFichaCliente = {
        configurar,
        initEventos,
        abrirPorId,
        abrirPorEncomenda,
        abrirCriacao,
        renderizar: renderizarFichaClienteAdmin,
        fechar: fecharFichaClienteAdmin
    };
})(typeof window !== 'undefined' ? window : globalThis);
