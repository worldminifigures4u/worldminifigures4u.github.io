// Gestão -> Todocoleccion: ligar cada lote do todocoleccion a um produto do catálogo.
// Os lotes vêm da tabela todocoleccion_lotes (preenchida pela edge function "todocoleccion").
(function () {
    const FILTROS = [
        { id: 'duvida', rotulo: 'Em dúvida' },
        { id: 'sem', rotulo: 'Sem correspondência' },
        { id: 'duplicados', rotulo: 'Duplicados' },
        { id: 'certo', rotulo: 'Certos' },
        { id: 'confirmado', rotulo: 'Confirmados' },
        { id: 'ignorado', rotulo: 'Ignorados' },
    ];
    const POR_PAGINA = 60;
    const ESTADOS_LOTE = { 0: 'À venda', 1: 'Vendido', 4: 'Retirado', 5: 'Não visível', 6: 'Retirado pelo editor' };

    let lotes = [];
    let carregado = false;
    let filtro = 'duvida';
    let pesquisa = '';
    let mostrar = POR_PAGINA;
    let loteEmTroca = null;
    let temporizadorPesquisaProduto = null;

    const $ = (id) => document.getElementById(id);
    const cliente = () => (typeof gestaoClient !== 'undefined' ? gestaoClient : null);

    function esc(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function euros(valor) {
        const n = Number(valor);
        return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') + ' €' : '';
    }
    function imagemProduto(produto) {
        const primeira = Array.isArray(produto?.imagens) ? produto.imagens[0] : null;
        if (!primeira) return '';
        return typeof primeira === 'string' ? primeira : (primeira.url || primeira.src || '');
    }
    function status(mensagem, tipo = '') {
        const el = $('status-gestao-tc');
        if (typeof mostrarMensagem === 'function') mostrarMensagem(el, mensagem, tipo);
        else if (el) el.textContent = mensagem;
    }

    async function carregar() {
        const db = cliente();
        if (!db) return;
        status('A carregar lotes…');
        const todos = [];
        for (let inicio = 0; ; inicio += 1000) {
            const { data, error } = await db.rpc('listar_lotes_todocoleccion_admin', { p_limite: 1000, p_offset: inicio });
            if (error) { status('Erro ao carregar: ' + error.message, 'erro'); return; }
            const pagina = Array.isArray(data) ? data : [];
            todos.push(...pagina);
            if (pagina.length < 1000) break;
        }
        lotes = todos;
        carregado = true;
        status('');
        desenhar();
    }

    function gruposDuplicados() {
        const mapa = new Map();
        lotes.forEach((l) => {
            // Só contam ligações seguras; as sugestões "em dúvida" não são duplicados.
            if (!l.produto_id || !['certo', 'confirmado'].includes(l.emparelhamento)) return;
            if (!mapa.has(l.produto_id)) mapa.set(l.produto_id, []);
            mapa.get(l.produto_id).push(l);
        });
        return [...mapa.values()].filter((g) => g.length > 1)
            .sort((a, b) => b.filter((l) => l.estado === 0).length - a.filter((l) => l.estado === 0).length);
    }

    function contagens() {
        const c = { duvida: 0, sem: 0, certo: 0, confirmado: 0, ignorado: 0, duplicados: gruposDuplicados().length };
        lotes.forEach((l) => { if (c[l.emparelhamento] !== undefined) c[l.emparelhamento]++; });
        return c;
    }

    function desenharFiltros() {
        const c = contagens();
        $('gestao-tc-filtros').innerHTML = FILTROS.map((f) => `
            <button type="button" class="gestao-tc-filtro${f.id === filtro ? ' ativo' : ''}" data-tc-filtro="${f.id}" aria-pressed="${f.id === filtro}">
                ${esc(f.rotulo)} <span class="gestao-tc-contagem">${c[f.id] ?? 0}</span>
            </button>`).join('');
        const btnCertos = $('btn-gestao-tc-confirmar-certos');
        if (btnCertos) {
            btnCertos.disabled = !c.certo;
            btnCertos.textContent = c.certo ? `Confirmar todos os certos (${c.certo})` : 'Confirmar todos os certos';
        }
    }

    function htmlProduto(p) {
        if (!p) return '<div class="gestao-tc-produto gestao-tc-produto-vazio">Sem produto ligado</div>';
        const img = imagemProduto(p);
        const sub = p.subtema && p.subtema !== 'semsubtema' ? ` · ${esc(p.subtema)}` : '';
        return `<div class="gestao-tc-produto">
            ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="gestao-tc-sem-img"></span>'}
            <div><strong>${esc(p.nome)}</strong><span>${esc(p.tema)}${sub}</span><span>SKU ${esc(p.sku)} · stock ${esc(p.stock ?? 0)}</span></div>
        </div>`;
    }

    function htmlLote(l, comProduto = true, comAcoes = true) {
        const estado = ESTADOS_LOTE[l.estado] || `Estado ${l.estado}`;
        const acoes = [];
        if (l.produto_id && l.emparelhamento !== 'confirmado') acoes.push(`<button type="button" class="wallapop-botao wallapop-botao-destaque" data-tc-acao="confirmar" data-id="${l.id}">Confirmar</button>`);
        acoes.push(`<button type="button" class="wallapop-botao" data-tc-acao="trocar" data-id="${l.id}">${l.produto_id ? 'Trocar' : 'Escolher produto'}</button>`);
        if (l.emparelhamento === 'ignorado') acoes.push(`<button type="button" class="wallapop-botao" data-tc-acao="repor" data-id="${l.id}">Repor</button>`);
        else acoes.push(`<button type="button" class="wallapop-botao" data-tc-acao="ignorar" data-id="${l.id}" title="Não sincronizar este lote">Ignorar</button>`);
        return `<article class="gestao-tc-linha" data-estado-lote="${l.estado}">
            <div class="gestao-tc-lote">
                ${l.imagem ? `<img src="${esc(l.imagem)}" alt="" loading="lazy">` : '<span class="gestao-tc-sem-img"></span>'}
                <div>
                    <strong>${esc(l.titulo || '(sem título)')}</strong>
                    <span>${euros(l.preco)} · <span class="gestao-tc-estado">${esc(estado)}</span> · nº ${l.id}</span>
                    ${l.erro ? `<span class="gestao-tc-erro">${esc(l.erro)}</span>` : ''}
                </div>
            </div>
            ${comProduto ? `<span class="gestao-tc-seta" aria-hidden="true">→</span>${htmlProduto(l.produto)}` : ''}
            ${comAcoes ? `<div class="gestao-tc-acoes">${acoes.join('')}</div>` : ''}
        </article>`;
    }

    function correspondePesquisa(l) {
        if (!pesquisa) return true;
        const alvo = `${l.titulo || ''} ${l.produto?.nome || ''} ${l.produto?.sku || ''} ${l.id}`.toLowerCase();
        return alvo.includes(pesquisa);
    }

    function desenhar() {
        if (!carregado) return;
        desenharFiltros();
        const lista = $('gestao-tc-lista');
        let html = '';
        let total = 0;
        if (filtro === 'duplicados') {
            const grupos = gruposDuplicados().filter((g) => g.some(correspondePesquisa));
            total = grupos.length;
            html = grupos.slice(0, mostrar).map((g) => `
                <section class="gestao-tc-grupo">
                    <header>${htmlProduto(g[0].produto)}<span class="gestao-tc-grupo-info">${g.length} anúncios · ${g.filter((l) => l.estado === 0).length} à venda</span></header>
                    ${g.map((l) => htmlLote(l, false)).join('')}
                </section>`).join('');
            if (!total) html = '<p class="ajuda-admin">Não há produtos com mais do que um anúncio.</p>';
        } else {
            const filtrados = lotes.filter((l) => l.emparelhamento === filtro && correspondePesquisa(l))
                .sort((a, b) => (a.semelhanca ?? 0) - (b.semelhanca ?? 0));
            total = filtrados.length;
            html = filtrados.slice(0, mostrar).map((l) => htmlLote(l)).join('');
            if (!total) html = '<p class="ajuda-admin">Nada nesta lista.</p>';
        }
        if (total > mostrar) html += `<button type="button" class="wallapop-botao gestao-tc-mais" data-tc-acao="mais">Mostrar mais (${total - mostrar})</button>`;
        lista.innerHTML = html;
    }

    async function atualizarLotes(ids, campos) {
        const { error } = await cliente().from('todocoleccion_lotes').update(campos).in('id', ids);
        if (error) { status('Erro ao gravar: ' + error.message, 'erro'); return false; }
        lotes.forEach((l) => { if (ids.includes(l.id)) Object.assign(l, campos); });
        return true;
    }

    async function confirmarCertos() {
        const ids = lotes.filter((l) => l.emparelhamento === 'certo').map((l) => l.id);
        if (!ids.length) return;
        const btn = $('btn-gestao-tc-confirmar-certos');
        btn.disabled = true;
        status(`A confirmar ${ids.length} lotes…`);
        for (let i = 0; i < ids.length; i += 200) {
            if (!(await atualizarLotes(ids.slice(i, i + 200), { emparelhamento: 'confirmado' }))) { desenhar(); return; }
        }
        status(`${ids.length} lotes confirmados.`, 'sucesso');
        desenhar();
    }

    // ---------- Modal "Trocar produto" ----------
    function htmlOpcao(p, semelhanca) {
        const img = imagemProduto(p) || p.imagem || '';
        const sub = p.subtema && p.subtema !== 'semsubtema' ? ` · ${esc(p.subtema)}` : '';
        return `<button type="button" class="gestao-tc-opcao" data-tc-escolher="${p.produto_id ?? p.id}">
            ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="gestao-tc-sem-img"></span>'}
            <span><strong>${esc(p.nome)}</strong><span>${esc(p.tema)}${sub} · SKU ${esc(p.sku)} · stock ${esc(p.stock ?? 0)}</span></span>
            ${semelhanca !== undefined ? `<span class="gestao-tc-semelhanca">${Math.round(Number(semelhanca) * 100)}%</span>` : ''}
        </button>`;
    }

    function abrirTroca(id) {
        loteEmTroca = lotes.find((l) => l.id === id);
        if (!loteEmTroca) return;
        const dlg = $('gestao-tc-dialogo');
        $('gestao-tc-dialogo-lote').innerHTML = htmlLote(loteEmTroca, false, false);
        const sug = Array.isArray(loteEmTroca.sugestoes) ? loteEmTroca.sugestoes : [];
        $('gestao-tc-sugestoes').innerHTML = sug.length ? sug.map((s) => htmlOpcao(s, s.semelhanca)).join('') : '<p class="ajuda-admin">Sem sugestões.</p>';
        $('gestao-tc-pesquisa-produto').value = '';
        $('gestao-tc-resultados').innerHTML = '';
        if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
        $('gestao-tc-pesquisa-produto').focus();
    }

    function fecharTroca() {
        const dlg = $('gestao-tc-dialogo');
        if (dlg.open && typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
        loteEmTroca = null;
    }

    async function pesquisarProdutos(texto) {
        const alvo = $('gestao-tc-resultados');
        const q = texto.trim();
        if (q.length < 2) { alvo.innerHTML = ''; return; }
        const { data, error } = await cliente().rpc('procurar_produtos_todocoleccion_admin', { p_texto: q.replace(/[%_]/g, '') });
        if (error) { alvo.innerHTML = `<p class="gestao-tc-erro">${esc(error.message)}</p>`; return; }
        alvo.innerHTML = (data || []).length ? data.map((p) => htmlOpcao(p)).join('') : '<p class="ajuda-admin">Nenhum produto encontrado.</p>';
        alvo._produtos = data || [];
    }

    async function escolherProduto(produtoId) {
        if (!loteEmTroca) return;
        const id = loteEmTroca.id;
        const { data: encontrados } = await cliente().rpc('procurar_produtos_todocoleccion_admin', { p_id: Number(produtoId) });
        const produto = Array.isArray(encontrados) ? encontrados[0] : null;
        if (await atualizarLotes([id], { produto_id: Number(produtoId), emparelhamento: 'confirmado' })) {
            const l = lotes.find((x) => x.id === id);
            if (l) l.produto = produto || null;
            status('Lote ligado ao produto.', 'sucesso');
        }
        fecharTroca();
        desenhar();
    }

    async function atualizarDoTodocoleccion() {
        const btn = $('btn-gestao-tc-atualizar');
        btn.disabled = true;
        try {
            status('A ler a lista de lotes do Todocoleccion…');
            const r = await cliente().functions.invoke('todocoleccion', { body: { acao: 'listar' } });
            if (r.error || !r.data?.ok) throw new Error(r.data?.erro || r.error?.message || 'falhou');
            const d = await cliente().rpc('todocoleccion_disparar', { p_corpo: { acao: 'ler_detalhes', limite: 120, continuar: true } });
            if (d.error) throw d.error;
            status(`${r.data.total} lotes no Todocoleccion. A ler os novos em segundo plano; volta a carregar daqui a uns minutos.`, 'sucesso');
            const e = await cliente().rpc('todocoleccion_emparelhar');
            if (e.error) throw e.error;
            await carregar();
        } catch (erro) {
            status('Erro: ' + (erro.message || erro), 'erro');
        } finally {
            btn.disabled = false;
        }
    }

    function ligar() {
        const painel = $('gestao-painel-todocoleccion');
        if (!painel || painel.dataset.ligado) return;
        painel.dataset.ligado = '1';

        $('gestao-tc-filtros').addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-tc-filtro]');
            if (!b) return;
            filtro = b.dataset.tcFiltro;
            mostrar = POR_PAGINA;
            desenhar();
        });
        $('gestao-tc-pesquisa').addEventListener('input', (ev) => {
            pesquisa = ev.target.value.trim().toLowerCase();
            mostrar = POR_PAGINA;
            desenhar();
        });
        $('btn-gestao-tc-confirmar-certos').addEventListener('click', () => confirmarCertos().catch(console.error));
        $('btn-gestao-tc-atualizar').addEventListener('click', () => atualizarDoTodocoleccion().catch(console.error));
        $('gestao-tc-lista').addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-tc-acao]');
            if (!b) return;
            const id = Number(b.dataset.id);
            const acao = b.dataset.tcAcao;
            if (acao === 'mais') { mostrar += POR_PAGINA; desenhar(); return; }
            if (acao === 'trocar') { abrirTroca(id); return; }
            const campos = acao === 'confirmar' ? { emparelhamento: 'confirmado' }
                : acao === 'ignorar' ? { emparelhamento: 'ignorado' }
                : acao === 'repor' ? { emparelhamento: lotes.find((l) => l.id === id)?.produto_id ? 'duvida' : 'sem' } : null;
            if (campos) atualizarLotes([id], campos).then(desenhar);
        });

        const dlg = $('gestao-tc-dialogo');
        dlg.addEventListener('click', (ev) => {
            if (ev.target === dlg) { fecharTroca(); return; }
            const op = ev.target.closest('[data-tc-escolher]');
            if (op) escolherProduto(op.dataset.tcEscolher).catch(console.error);
        });
        dlg.addEventListener('cancel', (ev) => { ev.preventDefault(); fecharTroca(); });
        $('gestao-tc-dialogo-fechar').addEventListener('click', fecharTroca);
        $('gestao-tc-pesquisa-produto').addEventListener('input', (ev) => {
            clearTimeout(temporizadorPesquisaProduto);
            const v = ev.target.value;
            temporizadorPesquisaProduto = setTimeout(() => pesquisarProdutos(v).catch(console.error), 250);
        });
    }

    document.addEventListener('gestao:seccao', (ev) => {
        if (ev.detail !== 'todocoleccion') return;
        ligar();
        if (!carregado) carregar().catch(console.error);
    });
})();
