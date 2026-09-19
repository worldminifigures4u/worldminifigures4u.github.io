(function () {
'use strict';

let agendaAlertasClient = null;
let agendaAlertasTemporizador = null;
let agendaAlertasAIniciar = false;

function emailAgendaEhAdmin(email) {
    const normalizado = String(email || '').toLowerCase();
    const emailsAdmin = typeof ADMIN_EMAILS !== 'undefined' ? ADMIN_EMAILS : [];
    return emailsAdmin.map(item => String(item).toLowerCase()).includes(normalizado);
}

function chaveAvisoAgenda(alarme) {
    return `figures-planet-agenda-aviso-${alarme.id}-${alarme.data_alarme || ''}-${alarme.hora_alarme || 'sem-hora'}`;
}

function dataHoraAlarmeAgenda(alarme) {
    const partesData = String(alarme?.data_alarme || '').slice(0, 10).split('-').map(Number);
    const partesHora = String(alarme?.hora_alarme || '').slice(0, 5).split(':').map(Number);
    if (partesData.length !== 3 || partesData.some(Number.isNaN)) return new Date();
    return new Date(partesData[0], partesData[1] - 1, partesData[2], partesHora[0] || 0, partesHora[1] || 0, 0, 0);
}

function alarmeAgendaEstaNaHora(alarme) {
    if (!alarme || alarme.estado === 'feito' || !alarme.hora_alarme || !alarme.data_alarme) return false;
    return dataHoraAlarmeAgenda(alarme) <= new Date();
}

function formatarDataAgenda(valor) {
    const partes = String(valor || '').slice(0, 10).split('-').map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) return '';
    return new Date(partes[0], partes[1] - 1, partes[2]).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarChaveDataAgenda(data) {
    return [
        data.getFullYear(),
        String(data.getMonth() + 1).padStart(2, '0'),
        String(data.getDate()).padStart(2, '0')
    ].join('-');
}

function formatarHoraAgenda(data) {
    return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

function abrirDialogoAlarmeAgenda(alarme, detalhes) {
    return new Promise(resolve => {
        document.getElementById('fp-dialogo-site')?.remove();

        const modal = document.createElement('div');
        modal.id = 'fp-dialogo-site';
        modal.className = 'fp-dialogo-site';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'fp-dialogo-site-titulo');

        const caixa = document.createElement('div');
        caixa.className = 'fp-dialogo-site-caixa';

        const titulo = document.createElement('h2');
        titulo.id = 'fp-dialogo-site-titulo';
        titulo.textContent = 'Alarme da Agenda';
        caixa.appendChild(titulo);

        const mensagem = document.createElement('p');
        mensagem.className = 'fp-dialogo-site-mensagem';
        mensagem.textContent = `${alarme.titulo || 'Alarme'}${detalhes ? `\n${detalhes}` : ''}`;
        caixa.appendChild(mensagem);

        const acoes = document.createElement('div');
        acoes.className = 'fp-dialogo-site-acoes';

        const fechar = valor => {
            modal.remove();
            document.body.classList.remove('fp-dialogo-site-aberto');
            resolve(valor);
        };

        [
            ['Adiar 1 dia', 'fp-dialogo-site-botao fp-dialogo-site-botao-secundario', 'adiar-dia'],
            ['Adiar 5 min', 'fp-dialogo-site-botao fp-dialogo-site-botao-secundario', 'adiar-5-min'],
            ['OK', 'fp-dialogo-site-botao fp-dialogo-site-botao-principal', 'ok']
        ].forEach(([texto, classe, valor]) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = classe;
            botao.textContent = texto;
            botao.addEventListener('click', () => fechar(valor));
            acoes.appendChild(botao);
        });

        caixa.appendChild(acoes);
        modal.appendChild(caixa);
        document.body.appendChild(modal);
        document.body.classList.add('fp-dialogo-site-aberto');

        modal.addEventListener('click', evento => {
            if (evento.target === modal) fechar('ok');
        });
        modal.addEventListener('keydown', evento => {
            if (evento.key === 'Escape') fechar('ok');
        });
        acoes.querySelector('.fp-dialogo-site-botao-principal')?.focus();
    });
}

async function garantirClientAgendaAlertas() {
    if (agendaAlertasClient) return agendaAlertasClient;
    if (typeof window.carregarScriptSupabase === 'function') {
        await window.carregarScriptSupabase();
    }
    if (typeof supabase === 'undefined' || typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
        return null;
    }
    agendaAlertasClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return agendaAlertasClient;
}

async function utilizadorPodeVerAgenda(client) {
    try {
        const { data: { user } } = await client.auth.getUser();
        return emailAgendaEhAdmin(user?.email);
    } catch (erro) {
        return false;
    }
}

async function adiarAlarmeAgenda(alarme, tipo) {
    const client = await garantirClientAgendaAlertas();
    if (!client || !alarme?.id) return;
    const novaData = tipo === 'adiar-5-min' ? new Date() : dataHoraAlarmeAgenda(alarme);
    if (tipo === 'adiar-5-min') novaData.setMinutes(novaData.getMinutes() + 5);
    else novaData.setDate(novaData.getDate() + 1);

    const { error } = await client.rpc('guardar_alarme_agenda_admin', {
        p_id: alarme.id,
        p_titulo: alarme.titulo || 'Alarme',
        p_descricao: alarme.descricao || '',
        p_data_alarme: formatarChaveDataAgenda(novaData),
        p_hora_alarme: formatarHoraAgenda(novaData),
        p_estado: 'pendente',
        p_prioridade: alarme.prioridade || 'normal',
        p_contexto_tipo: alarme.contexto_tipo || '',
        p_contexto_ref: alarme.contexto_ref || ''
    });
    if (error) throw error;
    window.dispatchEvent(new CustomEvent('figures-planet-agenda-atualizada', {
        detail: { id: alarme.id, acao: tipo }
    }));
}

async function verificarAvisosAgenda() {
    if (document.getElementById('fp-dialogo-site')) return;
    try {
        const client = await garantirClientAgendaAlertas();
        if (!client || !(await utilizadorPodeVerAgenda(client))) return;
        const { data, error } = await client.rpc('listar_agenda_admin');
        if (error || !Array.isArray(data)) return;
        const alarmes = data
            .filter(alarmeAgendaEstaNaHora)
            .filter(alarme => sessionStorage.getItem(chaveAvisoAgenda(alarme)) !== '1')
            .sort((a, b) => `${a.data_alarme || ''} ${a.hora_alarme || ''}`.localeCompare(`${b.data_alarme || ''} ${b.hora_alarme || ''}`));
        if (!alarmes.length) return;

        const alarme = alarmes[0];
        sessionStorage.setItem(chaveAvisoAgenda(alarme), '1');
        const hora = String(alarme.hora_alarme || '').slice(0, 5);
        const dataFormatada = formatarDataAgenda(alarme.data_alarme);
        const detalhes = [hora, dataFormatada].filter(Boolean).join(' · ');
        const acao = await abrirDialogoAlarmeAgenda(alarme, detalhes);
        if (acao === 'adiar-5-min' || acao === 'adiar-dia') {
            try {
                await adiarAlarmeAgenda(alarme, acao);
            } catch (erro) {
                sessionStorage.removeItem(chaveAvisoAgenda(alarme));
                throw erro;
            }
        }
    } catch (erro) {
        console.warn('Avisos da agenda nao verificados:', erro);
    }
}

async function iniciarAgendaAlertas() {
    if (agendaAlertasAIniciar || agendaAlertasTemporizador) return;
    agendaAlertasAIniciar = true;
    try {
        const client = await garantirClientAgendaAlertas();
        if (!client || !(await utilizadorPodeVerAgenda(client))) return;
        await verificarAvisosAgenda();
        agendaAlertasTemporizador = setInterval(verificarAvisosAgenda, 60000);
    } finally {
        agendaAlertasAIniciar = false;
    }
}

window.addEventListener('load', iniciarAgendaAlertas);
window.FiguresPlanetAgendaAlertas = {
    verificar: verificarAvisosAgenda,
    iniciar: iniciarAgendaAlertas
};
})();
