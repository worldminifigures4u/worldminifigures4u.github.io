(function () {
    "use strict";

    const STORAGE_KEY = "figures-planet-avisos-stock";
    let avisosClient = null;
    let statusCallback = null;

    function configurar(opcoes = {}) {
        avisosClient = opcoes.client || avisosClient || null;
        statusCallback = typeof opcoes.status === "function" ? opcoes.status : statusCallback;
    }

    function normalizarTexto(valor) {
        return String(valor || "").trim();
    }

    function normalizarAviso(aviso = {}) {
        const agora = new Date().toISOString();
        return {
            id: normalizarTexto(aviso.id) || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            cliente_id: normalizarTexto(aviso.cliente_id),
            cliente_nome: normalizarTexto(aviso.cliente_nome),
            produto_id: normalizarTexto(aviso.produto_id),
            produto_nome: normalizarTexto(aviso.produto_nome),
            produto_sku: normalizarTexto(aviso.produto_sku || aviso.sku),
            produto_referencia: normalizarTexto(aviso.produto_referencia || aviso.referencia),
            plataforma: normalizarTexto(aviso.plataforma),
            estado: normalizarTexto(aviso.estado) || "Por avisar",
            nota: normalizarTexto(aviso.nota),
            origem: normalizarTexto(aviso.origem) || "admin",
            created_at: aviso.created_at || aviso.criado_em || agora,
            updated_at: aviso.updated_at || aviso.atualizado_em || aviso.created_at || agora
        };
    }

    function carregarLocais() {
        try {
            const dados = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(dados) ? dados.map(normalizarAviso) : [];
        } catch (_) {
            return [];
        }
    }

    function guardarLocais(avisos) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify((avisos || []).map(normalizarAviso)));
    }

    function avisoCorrespondeProduto(aviso, produto) {
        const produtoId = normalizarTexto(produto?.id || produto?.produto_id);
        const sku = normalizarTexto(produto?.sku || produto?.produto_sku).toUpperCase();
        const referencia = normalizarTexto(produto?.referencia || produto?.produto_referencia).toUpperCase();
        return Boolean(
            (produtoId && normalizarTexto(aviso.produto_id) === produtoId) ||
            (sku && normalizarTexto(aviso.produto_sku).toUpperCase() === sku) ||
            (referencia && normalizarTexto(aviso.produto_referencia).toUpperCase() === referencia)
        );
    }

    function avisoCorrespondeCliente(aviso, clienteId) {
        return normalizarTexto(aviso.cliente_id) === normalizarTexto(clienteId);
    }

    async function chamarRpc(nome, parametros) {
        if (!avisosClient) throw new Error("Supabase indisponível.");
        const { data, error } = await avisosClient.rpc(nome, parametros);
        if (error) throw error;
        return data;
    }

    async function criarAviso(dados) {
        const aviso = normalizarAviso(dados);
        if (!aviso.cliente_id) throw new Error("Escolha ou crie primeiro a ficha do cliente.");
        if (!aviso.produto_id && !aviso.produto_sku && !aviso.produto_referencia) {
            throw new Error("Produto sem identificação para criar aviso.");
        }

        try {
            const data = await chamarRpc("guardar_aviso_stock_admin", {
                p_cliente_id: aviso.cliente_id,
                p_produto_id: aviso.produto_id || null,
                p_produto_nome: aviso.produto_nome || null,
                p_produto_sku: aviso.produto_sku || null,
                p_produto_referencia: aviso.produto_referencia || null,
                p_plataforma: aviso.plataforma || null,
                p_nota: aviso.nota || null,
                p_origem: aviso.origem || "admin"
            });
            return normalizarAviso(data);
        } catch (erro) {
            console.warn("Aviso de stock guardado localmente.", erro);
            const locais = carregarLocais();
            const existente = locais.find(item =>
                avisoCorrespondeCliente(item, aviso.cliente_id) &&
                avisoCorrespondeProduto(item, aviso) &&
                normalizarTexto(item.estado).toLowerCase() === "por avisar"
            );
            const guardado = normalizarAviso({ ...aviso, id: existente?.id });
            guardarLocais(existente
                ? locais.map(item => item.id === existente.id ? guardado : item)
                : [guardado, ...locais]
            );
            if (statusCallback) statusCallback("Aviso guardado neste navegador. Execute o SQL dos avisos de stock para guardar no Supabase.", true);
            return guardado;
        }
    }

    async function listarPorCliente(clienteId) {
        if (!clienteId) return [];
        try {
            const data = await chamarRpc("listar_avisos_stock_cliente_admin", {
                p_cliente_id: String(clienteId)
            });
            return Array.isArray(data) ? data.map(normalizarAviso) : [];
        } catch (erro) {
            console.warn("Avisos de stock por cliente via localStorage.", erro);
            return carregarLocais().filter(item => avisoCorrespondeCliente(item, clienteId));
        }
    }

    async function listarPorProduto(produto) {
        if (!produto) return [];
        try {
            const data = await chamarRpc("listar_avisos_stock_produto_admin", {
                p_produto_id: normalizarTexto(produto.id) || null,
                p_produto_sku: normalizarTexto(produto.sku) || null,
                p_produto_referencia: normalizarTexto(produto.referencia) || null
            });
            return Array.isArray(data) ? data.map(normalizarAviso) : [];
        } catch (erro) {
            console.warn("Avisos de stock por produto via localStorage.", erro);
            return carregarLocais().filter(item => avisoCorrespondeProduto(item, produto));
        }
    }

    async function atualizarEstado(id, estado) {
        const estadoNovo = normalizarTexto(estado) || "Por avisar";
        try {
            const data = await chamarRpc("atualizar_estado_aviso_stock_admin", {
                p_id: String(id),
                p_estado: estadoNovo
            });
            return normalizarAviso(data);
        } catch (erro) {
            console.warn("Estado do aviso de stock atualizado localmente.", erro);
            const locais = carregarLocais();
            const atualizados = locais.map(item => String(item.id) === String(id)
                ? normalizarAviso({ ...item, estado: estadoNovo, updated_at: new Date().toISOString() })
                : item
            );
            guardarLocais(atualizados);
            if (statusCallback) statusCallback("Estado do aviso atualizado neste navegador.", true);
            return atualizados.find(item => String(item.id) === String(id)) || null;
        }
    }

    window.AvisosStockAdmin = {
        configurar,
        criarAviso,
        listarPorCliente,
        listarPorProduto,
        atualizarEstado
    };
})();
