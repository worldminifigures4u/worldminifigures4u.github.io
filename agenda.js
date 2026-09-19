let agendaClient = null;
let agendaAlarmes = [];
let agendaMesAtual = null;
let agendaDiaSelecionado = '';
let agendaFiltroAtual = 'pendentes';

const agendaMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function agendaElemento(id) {
    return document.getElementById(id);
}

function criarElementoAgenda(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined && texto !== null) elemento.textContent = texto;
    return elemento;
}

function agendaHojeData() {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

function chaveDataAgenda(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function dataLocalAgenda(valor) {
    const partes = String(valor || '').split('-').map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) return agendaHojeData();
    return new Date(partes[0], partes[1] - 1, partes[2]);
}

function formatarDataAgenda(valor) {
    const data = dataLocalAgenda(valor);
    return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarHoraAgenda(valor) {
    return String(valor || '').slice(0, 5);
}

function textoPrioridadeAgenda(valor) {
    if (valor === 'alta') return 'Alta';
    if (valor === 'baixa') return 'Baixa';
    return 'Normal';
}

function textoContextoAgenda(alarme) {
    const tipo = String(alarme.contexto_tipo || '').trim();
    const ref = String(alarme.contexto_ref || '').trim();
    if (!tipo && !ref) return '';
    const nomes = {
        cliente: 'Cliente',
        encomenda: 'Encomenda',
        produto: 'Produto',
        fornecedor: 'Fornecedor',
        outro: 'Outro'
    };
    return [nomes[tipo] || tipo, ref].filter(Boolean).join(': ');
}

function normalizarAlarmeAgenda(item) {
    return {
        id: item.id,
        titulo: String(item.titulo || '').trim(),
        descricao: String(item.descricao || '').trim(),
        data_alarme: String(item.data_alarme || '').slice(0, 10),
        hora_alarme: item.hora_alarme ? String(item.hora_alarme).slice(0, 5) : '',
        estado: item.estado === 'feito' ? 'feito' : 'pendente',
        prioridade: ['baixa', 'normal', 'alta'].includes(item.prioridade) ? item.prioridade : 'normal',
        contexto_tipo: String(item.contexto_tipo || '').trim(),
        contexto_ref: String(item.contexto_ref || '').trim()
    };
}

function alarmeEhHojeAgenda(alarme) {
    return alarme.data_alarme === chaveDataAgenda(agendaHojeData());
}

function alarmeEstaVencidoAgenda(alarme) {
    if (alarme.estado === 'feito') return false;
    return dataLocalAgenda(alarme.data_alarme) < agendaHojeData();
}

function ordenarAlarmesAgenda(a, b) {
    const dataA = `${a.data_alarme} ${a.hora_alarme || '99:99'}`;
    const dataB = `${b.data_alarme} ${b.hora_alarme || '99:99'}`;
    return dataA.localeCompare(dataB) || a.titulo.localeCompare(b.titulo);
}

function mostrarEstadoAgenda(mensagem, tipo = '') {
    const alvo = agendaElemento('agenda-estado-texto');
    if (!alvo) return;
    alvo.textContent = mensagem || '';
    alvo.className = `agenda-estado-texto ${tipo}`.trim();
}

function erroAgenda(error) {
    const mensagem = error?.message || String(error || 'Erro desconhecido.');
    if (mensagem.includes('Could not find the function') || mensagem.includes('listar_agenda_admin')) {
        return 'A Agenda ainda precisa do SQL. Corre o ficheiro supabase-agenda.sql no Supabase.';
    }
    return mensagem;
}

async function chamarRpcAgenda(nome, parametros = {}) {
    const { data, error } = await agendaClient.rpc(nome, parametros);
    if (error) throw error;
    return data;
}

async function carregarAgenda() {
    mostrarEstadoAgenda('A carregar agenda...');
    try {
        const dados = await chamarRpcAgenda('listar_agenda_admin');
        agendaAlarmes = Array.isArray(dados) ? dados.map(normalizarAlarmeAgenda) : [];
        renderizarAgenda();
        mostrarEstadoAgenda('');
    } catch (error) {
        console.error('Erro ao carregar agenda.', error);
        mostrarEstadoAgenda(erroAgenda(error), 'erro');
        agendaAlarmes = [];
        renderizarAgenda();
    }
}

function renderizarMetricasAgenda() {
    const hoje = agendaAlarmes.filter(alarme => alarme.estado !== 'feito' && alarmeEhHojeAgenda(alarme)).length;
    const vencidos = agendaAlarmes.filter(alarmeEstaVencidoAgenda).length;
    const pendentes = agendaAlarmes.filter(alarme => alarme.estado !== 'feito').length;
    const feitos = agendaAlarmes.filter(alarme => alarme.estado === 'feito').length;

    agendaElemento('agenda-metrica-hoje').textContent = String(hoje);
    agendaElemento('agenda-metrica-vencidos').textContent = String(vencidos);
    agendaElemento('agenda-metrica-pendentes').textContent = String(pendentes);
    agendaElemento('agenda-metrica-feitos').textContent = String(feitos);

    const alerta = agendaElemento('agenda-alertas');
    if (!alerta) return;
    if (hoje || vencidos) {
        const partes = [];
        if (vencidos) partes.push(`${vencidos} vencido(s)`);
        if (hoje) partes.push(`${hoje} para hoje`);
        alerta.textContent = `Atenção: ${partes.join(' e ')}.`;
        alerta.hidden = false;
    } else {
        alerta.hidden = true;
        alerta.textContent = '';
    }
}

function alarmesDoDiaAgenda(chave) {
    return agendaAlarmes
        .filter(alarme => alarme.data_alarme === chave)
        .sort(ordenarAlarmesAgenda);
}

function renderizarCalendarioAgenda() {
    const calendario = agendaElemento('agenda-calendario');
    const titulo = agendaElemento('agenda-mes-titulo');
    if (!calendario || !titulo || !agendaMesAtual) return;

    calendario.replaceChildren();
    titulo.textContent = `${agendaMeses[agendaMesAtual.getMonth()]} ${agendaMesAtual.getFullYear()}`;

    const primeiroDia = new Date(agendaMesAtual.getFullYear(), agendaMesAtual.getMonth(), 1);
    const inicioOffset = (primeiroDia.getDay() + 6) % 7;
    const inicio = new Date(primeiroDia);
    inicio.setDate(primeiroDia.getDate() - inicioOffset);
    const hojeChave = chaveDataAgenda(agendaHojeData());

    for (let i = 0; i < 42; i += 1) {
        const data = new Date(inicio);
        data.setDate(inicio.getDate() + i);
        const chave = chaveDataAgenda(data);
        const alarmes = alarmesDoDiaAgenda(chave);
        const botao = criarElementoAgenda('button', 'agenda-dia');
        botao.type = 'button';
        botao.dataset.agendaDia = chave;
        if (data.getMonth() !== agendaMesAtual.getMonth()) botao.classList.add('fora-mes');
        if (chave === hojeChave) botao.classList.add('hoje');
        if (chave === agendaDiaSelecionado) botao.classList.add('selecionado');

        const topo = criarElementoAgenda('div', 'agenda-dia-numero');
        topo.appendChild(criarElementoAgenda('span', '', String(data.getDate())));
        if (alarmes.length) topo.appendChild(criarElementoAgenda('span', 'agenda-dia-contador', String(alarmes.length)));
        botao.appendChild(topo);

        const lista = criarElementoAgenda('div', 'agenda-dia-itens');
        alarmes.slice(0, 3).forEach(alarme => {
            const chip = criarElementoAgenda('span', 'agenda-chip', `${formatarHoraAgenda(alarme.hora_alarme) ? `${formatarHoraAgenda(alarme.hora_alarme)} ` : ''}${alarme.titulo}`);
            if (alarme.estado === 'feito') chip.classList.add('feito');
            if (alarmeEstaVencidoAgenda(alarme)) chip.classList.add('vencido');
            lista.appendChild(chip);
        });
        if (alarmes.length > 3) lista.appendChild(criarElementoAgenda('span', 'agenda-chip', `+${alarmes.length - 3}`));
        botao.appendChild(lista);
        botao.addEventListener('click', () => {
            agendaDiaSelecionado = chave;
            agendaFiltroAtual = 'todos';
            atualizarFiltrosAgenda();
            renderizarAgenda();
        });
        calendario.appendChild(botao);
    }
}

function alarmesFiltradosAgenda() {
    const base = agendaAlarmes.slice().sort(ordenarAlarmesAgenda);
    if (agendaFiltroAtual === 'hoje') return base.filter(alarme => alarme.estado !== 'feito' && alarmeEhHojeAgenda(alarme));
    if (agendaFiltroAtual === 'vencidos') return base.filter(alarmeEstaVencidoAgenda);
    if (agendaFiltroAtual === 'feitos') return base.filter(alarme => alarme.estado === 'feito');
    if (agendaFiltroAtual === 'todos' && agendaDiaSelecionado) return base.filter(alarme => alarme.data_alarme === agendaDiaSelecionado);
    if (agendaFiltroAtual === 'todos') return base;
    return base.filter(alarme => alarme.estado !== 'feito');
}

function criarBotaoAcaoAlarme(texto, classe, acao) {
    const botao = criarElementoAgenda('button', `wallapop-botao ${classe || ''}`.trim(), texto);
    botao.type = 'button';
    botao.addEventListener('click', acao);
    return botao;
}

function renderizarListaAgenda() {
    const lista = agendaElemento('agenda-lista');
    if (!lista) return;
    lista.replaceChildren();

    const alarmes = alarmesFiltradosAgenda();
    if (!alarmes.length) {
        lista.appendChild(criarElementoAgenda('p', 'agenda-vazio', 'Sem alarmes para mostrar.'));
        return;
    }

    alarmes.forEach(alarme => {
        const artigo = criarElementoAgenda('article', `agenda-alarme prioridade-${alarme.prioridade}`);
        if (alarme.estado === 'feito') artigo.classList.add('feito');

        const conteudo = criarElementoAgenda('div');
        conteudo.appendChild(criarElementoAgenda('h3', '', alarme.titulo));
        const meta = [
            formatarDataAgenda(alarme.data_alarme),
            formatarHoraAgenda(alarme.hora_alarme),
            textoPrioridadeAgenda(alarme.prioridade),
            alarme.estado === 'feito' ? 'Feito' : (alarmeEstaVencidoAgenda(alarme) ? 'Vencido' : 'Pendente')
        ].filter(Boolean).join(' · ');
        conteudo.appendChild(criarElementoAgenda('p', 'agenda-alarme-meta', meta));
        if (alarme.descricao) conteudo.appendChild(criarElementoAgenda('p', 'agenda-alarme-descricao', alarme.descricao));
        const contexto = textoContextoAgenda(alarme);
        if (contexto) conteudo.appendChild(criarElementoAgenda('p', 'agenda-alarme-contexto', contexto));
        artigo.appendChild(conteudo);

        const acoes = criarElementoAgenda('div', 'agenda-alarme-acoes');
        acoes.appendChild(criarBotaoAcaoAlarme('Editar', '', () => preencherFormularioAgenda(alarme)));
        if (alarme.estado === 'feito') {
            acoes.appendChild(criarBotaoAcaoAlarme('Reabrir', '', () => alterarEstadoAgenda(alarme.id, 'pendente')));
        } else {
            acoes.appendChild(criarBotaoAcaoAlarme('Feito', 'wallapop-botao-destaque', () => alterarEstadoAgenda(alarme.id, 'feito')));
            acoes.appendChild(criarBotaoAcaoAlarme('Adiar', '', () => adiarAlarmeAgenda(alarme)));
        }
        acoes.appendChild(criarBotaoAcaoAlarme('Apagar', 'wallapop-botao-perigo', () => apagarAlarmeAgenda(alarme)));
        artigo.appendChild(acoes);
        lista.appendChild(artigo);
    });
}

function renderizarAgenda() {
    renderizarMetricasAgenda();
    renderizarCalendarioAgenda();
    renderizarListaAgenda();
}

function atualizarFiltrosAgenda() {
    document.querySelectorAll('.agenda-filtro').forEach(botao => {
        botao.classList.toggle('ativo', botao.dataset.agendaFiltro === agendaFiltroAtual);
    });
}

function limparFormularioAgenda(dataPreferida = '') {
    agendaElemento('agenda-id').value = '';
    agendaElemento('agenda-titulo').value = '';
    agendaElemento('agenda-descricao').value = '';
    agendaElemento('agenda-data').value = dataPreferida || agendaDiaSelecionado || chaveDataAgenda(agendaHojeData());
    agendaElemento('agenda-hora').value = '';
    agendaElemento('agenda-prioridade').value = 'normal';
    agendaElemento('agenda-estado').value = 'pendente';
    agendaElemento('agenda-contexto-tipo').value = '';
    agendaElemento('agenda-contexto-ref').value = '';
    agendaElemento('agenda-formulario-titulo').textContent = 'Novo alarme';
    mostrarEstadoAgenda('');
}

function preencherFormularioAgenda(alarme) {
    agendaElemento('agenda-id').value = alarme.id;
    agendaElemento('agenda-titulo').value = alarme.titulo;
    agendaElemento('agenda-descricao').value = alarme.descricao;
    agendaElemento('agenda-data').value = alarme.data_alarme;
    agendaElemento('agenda-hora').value = formatarHoraAgenda(alarme.hora_alarme);
    agendaElemento('agenda-prioridade').value = alarme.prioridade;
    agendaElemento('agenda-estado').value = alarme.estado;
    agendaElemento('agenda-contexto-tipo').value = alarme.contexto_tipo;
    agendaElemento('agenda-contexto-ref').value = alarme.contexto_ref;
    agendaElemento('agenda-formulario-titulo').textContent = 'Editar alarme';
    agendaDiaSelecionado = alarme.data_alarme;
    agendaMesAtual = dataLocalAgenda(alarme.data_alarme);
    agendaMesAtual.setDate(1);
    agendaElemento('agenda-titulo')?.focus();
    renderizarAgenda();
}

async function guardarFormularioAgenda(evento) {
    evento.preventDefault();
    const titulo = agendaElemento('agenda-titulo').value.trim();
    const dataAlarme = agendaElemento('agenda-data').value;
    if (!titulo || !dataAlarme) {
        mostrarEstadoAgenda('Indica pelo menos o título e a data.', 'erro');
        return;
    }

    const parametros = {
        p_id: agendaElemento('agenda-id').value || null,
        p_titulo: titulo,
        p_descricao: agendaElemento('agenda-descricao').value.trim(),
        p_data_alarme: dataAlarme,
        p_hora_alarme: agendaElemento('agenda-hora').value || null,
        p_estado: agendaElemento('agenda-estado').value,
        p_prioridade: agendaElemento('agenda-prioridade').value,
        p_contexto_tipo: agendaElemento('agenda-contexto-tipo').value,
        p_contexto_ref: agendaElemento('agenda-contexto-ref').value.trim()
    };

    mostrarEstadoAgenda('A guardar alarme...');
    try {
        await chamarRpcAgenda('guardar_alarme_agenda_admin', parametros);
        agendaDiaSelecionado = dataAlarme;
        agendaMesAtual = dataLocalAgenda(dataAlarme);
        agendaMesAtual.setDate(1);
        limparFormularioAgenda(dataAlarme);
        await carregarAgenda();
        mostrarEstadoAgenda('Alarme guardado.', 'sucesso');
    } catch (error) {
        console.error('Erro ao guardar alarme.', error);
        mostrarEstadoAgenda(erroAgenda(error), 'erro');
    }
}

async function alterarEstadoAgenda(id, estado) {
    try {
        await chamarRpcAgenda('alterar_estado_alarme_agenda_admin', { p_id: id, p_estado: estado });
        await carregarAgenda();
        mostrarEstadoAgenda(estado === 'feito' ? 'Alarme marcado como feito.' : 'Alarme reaberto.', 'sucesso');
    } catch (error) {
        console.error('Erro ao alterar estado do alarme.', error);
        mostrarEstadoAgenda(erroAgenda(error), 'erro');
    }
}

async function adiarAlarmeAgenda(alarme) {
    const novaData = dataLocalAgenda(alarme.data_alarme);
    novaData.setDate(novaData.getDate() + 1);
    try {
        await chamarRpcAgenda('guardar_alarme_agenda_admin', {
            p_id: alarme.id,
            p_titulo: alarme.titulo,
            p_descricao: alarme.descricao,
            p_data_alarme: chaveDataAgenda(novaData),
            p_hora_alarme: alarme.hora_alarme || null,
            p_estado: 'pendente',
            p_prioridade: alarme.prioridade,
            p_contexto_tipo: alarme.contexto_tipo,
            p_contexto_ref: alarme.contexto_ref
        });
        agendaDiaSelecionado = chaveDataAgenda(novaData);
        await carregarAgenda();
        mostrarEstadoAgenda('Alarme adiado um dia.', 'sucesso');
    } catch (error) {
        console.error('Erro ao adiar alarme.', error);
        mostrarEstadoAgenda(erroAgenda(error), 'erro');
    }
}

async function apagarAlarmeAgenda(alarme) {
    const confirmado = await mostrarConfirmacaoSite(`Apagar o alarme "${alarme.titulo}"?`, {
        titulo: 'Apagar alarme',
        textoConfirmar: 'Apagar'
    });
    if (!confirmado) return;

    try {
        await chamarRpcAgenda('apagar_alarme_agenda_admin', { p_id: alarme.id });
        await carregarAgenda();
        mostrarEstadoAgenda('Alarme apagado.', 'sucesso');
    } catch (error) {
        console.error('Erro ao apagar alarme.', error);
        mostrarEstadoAgenda(erroAgenda(error), 'erro');
    }
}

function configurarEventosAgenda() {
    agendaElemento('agenda-formulario')?.addEventListener('submit', guardarFormularioAgenda);
    agendaElemento('agenda-limpar-formulario')?.addEventListener('click', () => limparFormularioAgenda());
    agendaElemento('agenda-btn-novo')?.addEventListener('click', () => {
        limparFormularioAgenda(chaveDataAgenda(agendaHojeData()));
        agendaElemento('agenda-titulo')?.focus();
    });
    agendaElemento('agenda-mes-anterior')?.addEventListener('click', () => {
        agendaMesAtual.setMonth(agendaMesAtual.getMonth() - 1);
        renderizarCalendarioAgenda();
    });
    agendaElemento('agenda-mes-seguinte')?.addEventListener('click', () => {
        agendaMesAtual.setMonth(agendaMesAtual.getMonth() + 1);
        renderizarCalendarioAgenda();
    });
    agendaElemento('agenda-hoje')?.addEventListener('click', () => {
        const hoje = agendaHojeData();
        agendaMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        agendaDiaSelecionado = chaveDataAgenda(hoje);
        agendaFiltroAtual = 'hoje';
        atualizarFiltrosAgenda();
        renderizarAgenda();
    });
    document.querySelectorAll('.agenda-filtro').forEach(botao => {
        botao.addEventListener('click', () => {
            agendaFiltroAtual = botao.dataset.agendaFiltro || 'pendentes';
            atualizarFiltrosAgenda();
            renderizarListaAgenda();
        });
    });
}

async function iniciarAgenda() {
    const bloqueio = agendaElemento('agenda-bloqueio');
    const aplicacao = agendaElemento('agenda-aplicacao');
    try {
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase não carregou.');
        agendaClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const admin = await validarAdminRapido(agendaClient, bloqueio);
        if (!admin) return;
        if (bloqueio) bloqueio.hidden = true;
        if (aplicacao) aplicacao.hidden = false;
        const hoje = agendaHojeData();
        agendaMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        agendaDiaSelecionado = chaveDataAgenda(hoje);
        limparFormularioAgenda(agendaDiaSelecionado);
        configurarEventosAgenda();
        atualizarFiltrosAgenda();
        await carregarAgenda();
    } catch (error) {
        console.error('Erro ao iniciar agenda.', error);
        if (bloqueio) bloqueio.textContent = erroAgenda(error);
    }
}

window.addEventListener('load', iniciarAgenda);
