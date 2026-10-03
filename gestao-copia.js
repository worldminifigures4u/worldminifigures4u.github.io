// Gestão -> Cópia de segurança: descarrega todas as tabelas do Supabase num .zip
// (um JSON por tabela + CSV de produtos e encomendas) e marca na Agenda a próxima cópia.
(function () {
    const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    const TAMANHO_PAGINA_COPIA = 1000;
    const DIAS_PROXIMA_COPIA = 7;
    const REF_AGENDA_COPIA = 'copia-seguranca';
    let promessaJsZip = null;

    function cliente() {
        return typeof gestaoClient !== 'undefined' ? gestaoClient : null;
    }

    function status(mensagem, tipo = '') {
        const elemento = document.getElementById('status-gestao-copia');
        if (typeof mostrarMensagem === 'function') mostrarMensagem(elemento, mensagem, tipo);
        else if (elemento) elemento.textContent = mensagem;
    }

    function carregarJsZip() {
        if (window.JSZip) return Promise.resolve(window.JSZip);
        if (!promessaJsZip) {
            promessaJsZip = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = JSZIP_URL;
                script.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error('A biblioteca de compressão não carregou.'));
                script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca de compressão.'));
                document.head.appendChild(script);
            }).catch(erro => {
                promessaJsZip = null;
                throw erro;
            });
        }
        return promessaJsZip;
    }

    function dataLocal(data = new Date()) {
        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    }

    function dataHoraNome(data = new Date()) {
        return `${dataLocal(data)}_${String(data.getHours()).padStart(2, '0')}${String(data.getMinutes()).padStart(2, '0')}`;
    }

    function formatarDataPt(texto) {
        const partes = String(texto || '').slice(0, 10).split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(texto || '');
    }

    function valorCsv(valor) {
        if (valor === null || valor === undefined) return '';
        const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
        return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    }

    function criarCsv(linhas) {
        const colunas = [];
        linhas.forEach(linha => Object.keys(linha || {}).forEach(chave => {
            if (!colunas.includes(chave)) colunas.push(chave);
        }));
        const corpo = linhas.map(linha => colunas.map(coluna => valorCsv(linha?.[coluna])).join(';'));
        return '﻿' + [colunas.join(';'), ...corpo].join('\r\n');
    }

    async function exportarTabela(nome, aoProgresso) {
        const linhas = [];
        for (let offset = 0; ; offset += TAMANHO_PAGINA_COPIA) {
            const { data, error } = await cliente().rpc('exportar_tabela_copia_admin', {
                p_tabela: nome,
                p_limite: TAMANHO_PAGINA_COPIA,
                p_offset: offset
            });
            if (error) throw error;
            const pagina = Array.isArray(data) ? data : [];
            linhas.push(...pagina);
            aoProgresso?.(linhas.length);
            if (pagina.length < TAMANHO_PAGINA_COPIA) break;
        }
        return linhas;
    }

    async function obterAlarmeCopia() {
        try {
            const { data, error } = await cliente().rpc('listar_agenda_admin');
            if (error || !Array.isArray(data)) return null;
            return data.find(alarme => alarme?.contexto_ref === REF_AGENDA_COPIA) || null;
        } catch (_) {
            return null;
        }
    }

    async function marcarProximaCopiaNaAgenda(alarmeAtual) {
        const proxima = new Date();
        proxima.setDate(proxima.getDate() + DIAS_PROXIMA_COPIA);
        const hoje = dataLocal();
        const { error } = await cliente().rpc('guardar_alarme_agenda_admin', {
            p_id: alarmeAtual?.id || null,
            p_titulo: 'Fazer cópia de segurança',
            p_descricao: `Gestão → Cópia de segurança. Última cópia feita em ${formatarDataPt(hoje)}.`,
            p_data_alarme: dataLocal(proxima),
            p_hora_alarme: null,
            p_estado: 'pendente',
            p_prioridade: 'normal',
            p_contexto_tipo: 'outro',
            p_contexto_ref: REF_AGENDA_COPIA
        });
        if (error) throw error;
        return dataLocal(proxima);
    }

    async function mostrarUltimaCopia() {
        const elemento = document.getElementById('gestao-copia-ultima');
        if (!elemento || !cliente()) return;
        const alarme = await obterAlarmeCopia();
        const ultima = String(alarme?.descricao || '').match(/(\d{2}\/\d{2}\/\d{4})/);
        elemento.textContent = alarme
            ? `${ultima ? `Última cópia: ${ultima[1]}. ` : ''}Próxima marcada na Agenda para ${formatarDataPt(alarme.data_alarme)}.`
            : 'Ainda não há nenhuma cópia registada.';
    }

    function descarregar(blob, nome) {
        const url = URL.createObjectURL(blob);
        const ligacao = document.createElement('a');
        ligacao.href = url;
        ligacao.download = nome;
        document.body.appendChild(ligacao);
        ligacao.click();
        ligacao.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async function fazerCopiaSeguranca() {
        const botao = document.getElementById('btn-gestao-copia-seguranca');
        if (!cliente()) {
            status('A ligação ao Supabase ainda não está pronta. Tenta outra vez.', 'msg-erro');
            return;
        }
        try {
            if (botao) botao.disabled = true;
            status('A preparar a cópia...');
            const [JSZip, respostaTabelas] = await Promise.all([
                carregarJsZip(),
                cliente().rpc('listar_tabelas_copia_admin')
            ]);
            if (respostaTabelas.error) {
                const mensagem = String(respostaTabelas.error.message || '');
                if (/listar_tabelas_copia_admin|function|schema cache/i.test(mensagem)) {
                    throw new Error('Falta correr o SQL supabase-copia-seguranca.sql no Supabase.');
                }
                throw respostaTabelas.error;
            }
            const tabelas = (Array.isArray(respostaTabelas.data) ? respostaTabelas.data : [])
                .map(item => String(item?.tabela || '').trim())
                .filter(Boolean);
            if (!tabelas.length) throw new Error('Não foram encontradas tabelas para copiar.');

            const agora = new Date();
            const zip = new JSZip();
            const resumo = [];
            for (let indice = 0; indice < tabelas.length; indice += 1) {
                const nome = tabelas[indice];
                status(`A copiar ${nome} (${indice + 1}/${tabelas.length})...`);
                const linhas = await exportarTabela(nome, total => status(`A copiar ${nome} (${indice + 1}/${tabelas.length}): ${total} linhas...`));
                zip.file(`json/${nome}.json`, JSON.stringify(linhas, null, 1));
                if (nome === 'produtos' || nome === 'encomendas') zip.file(`csv/${nome}.csv`, criarCsv(linhas));
                resumo.push({ tabela: nome, linhas: linhas.length });
            }
            zip.file('LEIA-ME.txt', [
                'Cópia de segurança Figures Planet',
                `Data: ${agora.toLocaleString('pt-PT')}`,
                '',
                'json/ - uma tabela do Supabase por ficheiro (todas as colunas).',
                'csv/  - produtos e encomendas para abrir no Excel (separador ;).',
                '',
                'Tabelas:',
                ...resumo.map(item => `  ${item.tabela}: ${item.linhas} linhas`),
                '',
                'Nota: as contas de cliente do site (login) ficam na autenticação do Supabase e não estão incluídas.'
            ].join('\r\n'));

            status('A comprimir...');
            const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const nomeFicheiro = `figuresplanet-copia-${dataHoraNome(agora)}.zip`;
            descarregar(blob, nomeFicheiro);

            let avisoAgenda = '';
            try {
                const proxima = await marcarProximaCopiaNaAgenda(await obterAlarmeCopia());
                avisoAgenda = ` Próxima cópia marcada na Agenda para ${formatarDataPt(proxima)}.`;
            } catch (erro) {
                console.warn('Não foi possível marcar a próxima cópia na Agenda.', erro);
                avisoAgenda = ' (Não foi possível marcar a próxima cópia na Agenda.)';
            }
            const totalLinhas = resumo.reduce((soma, item) => soma + item.linhas, 0);
            status(`Cópia descarregada: ${nomeFicheiro} · ${resumo.length} tabelas · ${totalLinhas} linhas.${avisoAgenda}`, 'msg-sucesso');
            mostrarUltimaCopia();
        } catch (erro) {
            console.error(erro);
            status('Erro ao fazer a cópia: ' + (erro?.message || 'sem detalhe'), 'msg-erro');
        } finally {
            if (botao) botao.disabled = false;
        }
    }

    function iniciar() {
        document.getElementById('btn-gestao-copia-seguranca')?.addEventListener('click', fazerCopiaSeguranca);
        document.querySelector('[data-gestao-seccao="copia"]')?.addEventListener('click', mostrarUltimaCopia);
        const esperar = setInterval(() => {
            if (!cliente()) return;
            clearInterval(esperar);
            mostrarUltimaCopia();
        }, 500);
        setTimeout(() => clearInterval(esperar), 30000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
