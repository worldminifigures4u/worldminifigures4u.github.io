// Painel administrativo da pagina Gestao (carregamento lazy).
let catalogoAdminCarregado = false;
let catalogoAdminAgendado = false;

function paginaPrecisaCatalogoAdmin() {
    return document.body?.classList?.contains('pagina-gestao') || obterVistaPagina() === 'gestao';
}

function paginaPrecisaProdutosLoja() {
    return obterVistaPagina() === 'loja';
}

function carregarCatalogoAdminQuandoDisponivel(opcoes = {}) {
    if (!paginaPrecisaCatalogoAdmin()) return;
    const imediato = opcoes.imediato === true;
    if (catalogoAdminAgendado && !imediato) return;

    const executar = async () => {
        catalogoAdminAgendado = true;
        if (typeof window.garantirGestaoAdmin === 'function') {
            await window.garantirGestaoAdmin();
        }
        if (typeof carregarProdutosAdminDaNuvem === 'function') {
            await carregarProdutosAdminDaNuvem();
        }
    };

    if (imediato) {
        executar().catch((error) => {
            console.error('Erro ao carregar catalogo administrativo:', error);
        });
        return;
    }

    catalogoAdminAgendado = true;
    const agendar = () => {
        executar().catch((error) => {
            catalogoAdminAgendado = false;
            console.error('Erro ao carregar catalogo administrativo:', error);
        });
    };

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(agendar, { timeout: 4500 });
    } else {
        window.setTimeout(agendar, 2000);
    }
}

function aplicarPainelGestaoAdmin(user) {
    const painel = document.getElementById('painel-admin');
    if (!painel) return;

    const adminAtivo = utilizadorAdmin(user);
    const zonaEliminacao = document.getElementById('zona-eliminacao-conta');

    if (adminAtivo) {
        const autenticado = document.getElementById('conteudo-cliente-autenticado');
        const anonimo = document.getElementById('conteudo-cliente-anonimo');
        if (autenticado) autenticado.classList.remove('oculto');
        if (anonimo) anonimo.classList.add('oculto');
    }

    painel.classList.toggle('oculto', !adminAtivo);
    if (zonaEliminacao) zonaEliminacao.classList.toggle('oculto', adminAtivo);

    if (!adminAtivo) {
        catalogoAdminCarregado = false;
        if (typeof cancelarEdicaoProdutoAdmin === 'function') cancelarEdicaoProdutoAdmin();
        return;
    }

    if (painel.querySelector('.gestao-tabs')) {
        return;
    }

    const conteudoConta = document.getElementById('conteudo-cliente-autenticado');
    const dadosPessoais = document.getElementById('form-editar-dados-cliente')?.closest('.historico-encomendas');
    const gestaoProdutos = painel.querySelector('.admin-seccao');
    const tituloAdicionarProduto = painel.querySelector(':scope > h3');
    const formularioAdicionarProduto = document.getElementById('form-admin-produto');

    if (conteudoConta && dadosPessoais) {
        conteudoConta.insertBefore(painel, dadosPessoais);
    }

    if (gestaoProdutos && tituloAdicionarProduto && formularioAdicionarProduto) {
        const primeiraSeccaoAposProdutos = gestaoProdutos.querySelector(':scope > .admin-seccao');
        tituloAdicionarProduto.textContent = 'Adicionar produto';
        tituloAdicionarProduto.classList.add('admin-adicionar-produto-titulo');
        formularioAdicionarProduto.classList.add('admin-adicionar-produto-formulario');
        gestaoProdutos.insertBefore(tituloAdicionarProduto, primeiraSeccaoAposProdutos);
        gestaoProdutos.insertBefore(formularioAdicionarProduto, primeiraSeccaoAposProdutos);
    }

    carregarCatalogoAdminQuandoDisponivel();
}

window.aplicarPainelGestaoAdmin = aplicarPainelGestaoAdmin;
window.carregarCatalogoAdminQuandoDisponivel = carregarCatalogoAdminQuandoDisponivel;
window.paginaPrecisaCatalogoAdmin = paginaPrecisaCatalogoAdmin;
window.paginaPrecisaProdutosLoja = paginaPrecisaProdutosLoja;
window.dispatchEvent(new Event('figures-planet-admin-gestao-pronta'));
