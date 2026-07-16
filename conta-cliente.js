// Codigo da pagina Conta / area de cliente.
// Separado de app.js para as paginas publicas carregarem menos codigo.

function mudarAba(tipo) {
    const btnLogin = document.querySelectorAll('.tab-btn')[0];
    const btnRegisto = document.querySelectorAll('.tab-btn')[1];
    const formLogin = document.getElementById('form-login');
    const formRegisto = document.getElementById('form-registo');
    const formRecuperar = document.getElementById('form-recuperar-password');
    const statusDiv = document.getElementById('status-cliente');

    statusDiv.innerText = '';
    if(formRecuperar) formRecuperar.classList.add('oculto');

    if (tipo === 'login') {
        btnLogin.classList.add('ativa');
        btnRegisto.classList.remove('ativa');
        formLogin.classList.remove('oculto');
        formRegisto.classList.add('oculto');
    } else {
        btnLogin.classList.remove('ativa');
        btnRegisto.classList.add('ativa');
        formLogin.classList.add('oculto');
        formRegisto.classList.remove('oculto');
    }
}

async function sincronizarFichaClienteSite() {
    if (!dbClient) return;
    try {
        const { data: { session } } = await dbClient.auth.getSession();
        if (!session?.user) return;
        await dbClient.rpc('sincronizar_ficha_cliente_site');
    } catch (erro) {
        console.warn('Ficha cliente site nao sincronizada:', erro);
    }
}

window.sincronizarFichaClienteSite = sincronizarFichaClienteSite;

function mostrarFormularioRecuperacaoPassword() {
    if (!existeAreaClientePagina()) {
        window.location.href = 'conta.html' + (window.location.hash || '');
        return;
    }
    document.getElementById('conteudo-cliente-autenticado').classList.add('oculto');
    document.getElementById('conteudo-cliente-anonimo').classList.remove('oculto');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('ativa'));
    document.getElementById('form-login').classList.add('oculto');
    document.getElementById('form-registo').classList.add('oculto');
    document.getElementById('form-recuperar-password').classList.remove('oculto');
    mostrarMensagem(
        document.getElementById('status-cliente'),
        'Defina a nova palavra-passe para concluir a recuperação da conta.',
        'msg-sucesso'
    );
}

async function pedirRecuperacaoPassword() {
    const statusDiv = document.getElementById('status-cliente');
    const emailInput = document.getElementById('login-email');
    const email = String(emailInput?.value || '').trim();

    if (!email) {
        mostrarMensagem(statusDiv, 'Introduza primeiro o seu endereço de email.', 'msg-erro');
        emailInput?.focus();
        return;
    }

    try {
        mostrarMensagem(statusDiv, 'A enviar o email de recuperação...');
        const redirectTo = new URL('conta.html', obterUrlPublicoAtual()).href;
        const { error } = await dbClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;

        mostrarMensagem(
            statusDiv,
            'Enviámos um email com o link para definir uma nova palavra-passe. Verifique também a pasta de spam.',
            'msg-sucesso'
        );
    } catch (error) {
        console.error('Erro ao pedir recuperação de password:', error);
        mostrarMensagem(
            statusDiv,
            'Erro: ' + (error.message || 'Não foi possível enviar o email de recuperação.'),
            'msg-erro'
        );
    }
}

async function fazerLogin(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-cliente');
    const botaoLogin = document.querySelector('#form-login button[type="submit"]');
    statusDiv.className = "msg-status";
    statusDiv.innerText = "A entrar...";

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if(!dbClient){
        if (typeof garantirDbClient === 'function') {
            try {
                await garantirDbClient();
            } catch (erro) {
                console.error(erro);
            }
        }
        if (window.dbClient && typeof dbClient !== 'undefined') {
            dbClient = window.dbClient;
        }
    }

    if(!dbClient && !window.dbClient){
        mostrarMensagem(statusDiv, "Erro: ligação ao Supabase indisponível. Verifique a internet e recarregue a página.", "msg-erro");
        return;
    }

    if(!email || !password){
        mostrarMensagem(statusDiv, "Preencha o e-mail e a palavra-passe.", "msg-erro");
        return;
    }

    botaoLogin.disabled = true;
    botaoLogin.innerText = "A entrar...";

    try {
        const { data, error } = await executarComTimeout(
            dbClient.auth.signInWithPassword({
                email: email,
                password: password
            }),
            30000,
            "A ligação ao serviço de login demorou demasiado. Tente novamente."
        );

        if (error) throw error;

        if (data && data.user) {
            if (data.user.email_confirmed_at === null) {
                await dbClient.auth.signOut();
                mostrarMensagem(statusDiv, "E-mail não confirmado!\nPor favor, aceda à sua caixa de correio e clique no link de validação enviado para poder iniciar sessão.", "msg-erro");
                return;
            }
            if (typeof utilizadorAdmin === 'function' && utilizadorAdmin(data.user)) {
                window.location.replace('plataforma.html');
                return;
            }
            await executarComTimeout(
                obterDadosPerfilDaTabela(data.user.id, data.user),
                15000,
                "Sessão iniciada, mas os dados do perfil demoraram demasiado a carregar."
            );
            const { data: { session } } = await dbClient.auth.getSession();
            if (!session) {
                mostrarMensagem(statusDiv, MENSAGEM_CONTA_SUSPENSA, "msg-erro");
                return;
            }
            if (document.body.classList.contains('pagina-gestao') && typeof atualizarVisibilidadeAdmin === 'function') {
                if (typeof window.garantirAdminGestao === 'function') {
                    await window.garantirAdminGestao();
                }
                atualizarVisibilidadeAdmin(data.user);
            }
            statusDiv.innerText = "";
        }
    } catch (erro) {
        console.error(erro);
        mostrarMensagem(statusDiv, obterMensagemErroAuth(erro, 'login'), "msg-erro");
    } finally {
        botaoLogin.disabled = false;
        botaoLogin.innerText = "Entrar na Conta";
    }
}

async function registarCliente(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-cliente');
    statusDiv.className = "msg-status";
    statusDiv.innerText = "A processar registo de segurança...";

    const nome = document.getElementById('registo-nome').value.trim();
    const email = document.getElementById('registo-email').value.trim();
    const password = document.getElementById('registo-password').value;
    const telemovel = document.getElementById('registo-telemovel').value.trim();
    const morada = document.getElementById('registo-morada').value.trim();
    const cp = document.getElementById('registo-cp').value.trim();
    const cidade = document.getElementById('registo-cidade').value.trim();
    const pais = document.getElementById('registo-pais').value.trim();

    try {
       const { data, error } = await dbClient.auth.signUp({
    email: email,
    password: password,
    options: {
        emailRedirectTo: obterUrlPublicoAtual(),
        data: {
            nome: nome,
            telemovel: telemovel,
            morada: morada,
            cp: cp,
            cidade: cidade,
            pais: pais
        }
    }
});

        if (error) throw error;

        if (data && data.user) {
            await sincronizarFichaClienteSite();
            await dbClient.auth.signOut();

            mostrarMensagem(statusDiv, " Registo efetuado!\nEnviámos um link de confirmação para o seu e-mail. Ative a conta antes de tentar fazer login.", "msg-sucesso");
            
            document.getElementById('form-registo').reset();
            setTimeout(() => { mudarAba('login'); }, 5000);
        }
    } catch (erro) {
        console.error("Erro completo:", erro);
        statusDiv.className = "msg-status msg-erro";
        statusDiv.innerText = "Erro ao registar: " + (erro.message || "Verifique os dados informados.");
    }
}

async function atualizarPasswordRecuperacao(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-cliente');
    const novaPassword = document.getElementById('nova-password').value;
    const confirmarPassword = document.getElementById('confirmar-nova-password').value;

    if(novaPassword.length < 8) {
        mostrarMensagem(statusDiv, 'A nova password deve ter pelo menos 8 caracteres.', 'msg-erro');
        return;
    }

    if(novaPassword !== confirmarPassword) {
        mostrarMensagem(statusDiv, 'As passwords não coincidem.', 'msg-erro');
        return;
    }

    try {
        mostrarMensagem(statusDiv, 'A atualizar password...');
        const { error } = await dbClient.auth.updateUser({ password: novaPassword });
        if(error) throw error;

        document.getElementById('form-recuperar-password').reset();
        mostrarMensagem(statusDiv, 'Password atualizada com sucesso. Já pode iniciar sessão.', 'msg-sucesso');
        emRecuperacaoPassword = false;
        if(window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, obterUrlPublicoAtual());
        }
        await dbClient.auth.signOut();
        setTimeout(() => { mudarAba('login'); }, 1500);
    } catch(error) {
        console.error('Erro ao atualizar password:', error);
        mostrarMensagem(statusDiv, 'Erro: ' + (error.message || 'Não foi possível atualizar a password.'), 'msg-erro');
    }
}

async function alterarPasswordConta(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-alterar-password');
    const passwordAtual = document.getElementById('conta-password-atual')?.value || '';
    const novaPassword = document.getElementById('conta-nova-password').value;
    const confirmarPassword = document.getElementById('conta-confirmar-password').value;

    if(!passwordAtual) {
        mostrarMensagem(statusDiv, 'Introduza a password atual.', 'msg-erro');
        return;
    }

    if(novaPassword.length < 8) {
        mostrarMensagem(statusDiv, 'A nova password deve ter pelo menos 8 caracteres.', 'msg-erro');
        return;
    }

    if(novaPassword !== confirmarPassword) {
        mostrarMensagem(statusDiv, 'As passwords não coincidem.', 'msg-erro');
        return;
    }

    try {
        mostrarMensagem(statusDiv, 'A atualizar password...');
        let { error } = await dbClient.auth.updateUser({
            password: novaPassword,
            current_password: passwordAtual
        });

        if(error && /current password required/i.test(error.message || '')) {
            const tentativaAlternativa = await dbClient.auth.updateUser({
                password: novaPassword,
                currentPassword: passwordAtual
            });
            error = tentativaAlternativa.error;
        }

        if(error) throw error;

        document.getElementById('form-alterar-password').reset();
        mostrarMensagem(statusDiv, 'Password atualizada com sucesso.', 'msg-sucesso');
    } catch(error) {
        console.error('Erro ao alterar password:', error);
        mostrarMensagem(statusDiv, 'Erro: ' + (error.message || 'Não foi possível atualizar a password.'), 'msg-erro');
    }
}

async function eliminarContaUtilizador(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-eliminacao-conta');
    const passwordInput = document.getElementById('eliminar-conta-password');
    const confirmacaoInput = document.getElementById('eliminar-conta-confirmacao');
    const submitButton = event.currentTarget?.querySelector('button[type="submit"]');

    try {
        const password = String(passwordInput?.value || '');
        const confirmacao = String(confirmacaoInput?.value || '').trim().toUpperCase();

        if (!password) throw new Error('Introduza a sua palavra-passe atual.');
        if (confirmacao !== 'ELIMINAR') throw new Error('Escreva ELIMINAR exatamente como indicado.');

        const confirmou = window.confirm('Eliminar definitivamente a sua conta? Esta ação não pode ser anulada.');
        if (!confirmou) return;

        const { data: { session }, error: sessionError } = await dbClient.auth.getSession();
        if (sessionError || !session?.access_token) {
            throw new Error('A sessão terminou. Inicie sessão novamente antes de eliminar a conta.');
        }

        if (submitButton) submitButton.disabled = true;
        mostrarMensagem(statusDiv, 'A eliminar a conta...');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        let response;
        try {
            response = await fetch(`${SUPABASE_URL}/functions/v1/eliminar-conta`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({ password, confirmacao }),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        const resultado = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(resultado.error || 'Não foi possível eliminar a conta.');

        localStorage.removeItem('carrinho');
        await dbClient.auth.signOut().catch(() => {});
        mostrarMensagem(statusDiv, 'A sua conta foi eliminada com sucesso.', 'msg-sucesso');
        setTimeout(() => window.location.replace('index.html'), 1200);
    } catch (error) {
        console.error('Erro ao eliminar conta:', error);
        const mensagem = error?.name === 'AbortError'
            ? 'A eliminação demorou demasiado. Tente novamente.'
            : (error.message || 'Não foi possível eliminar a conta.');
        mostrarMensagem(statusDiv, 'Erro: ' + mensagem, 'msg-erro');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

window.eliminarContaUtilizador = eliminarContaUtilizador;


function preencherFormularioDadosCliente(data = {}, user = null) {
    const nome = data.nome || user?.user_metadata?.nome || '';
    const email = data.email || user?.email || '';
    const morada = data.morada || '';
    const cp = data.cp || '';
    const cidade = data.cidade || '';
    const pais = data.pais || user?.user_metadata?.pais || '';

    const nomePerfilLogado = document.getElementById('nome-perfil-logado');
    if (nomePerfilLogado) nomePerfilLogado.innerText = nome || 'Cliente Autenticado';
    const nomeSessaoConta = document.getElementById('sessao-conta-nome');
    const emailSessaoConta = document.getElementById('sessao-conta-email');
    if (nomeSessaoConta) nomeSessaoConta.innerText = nome || 'Cliente Autenticado';
    if (emailSessaoConta) emailSessaoConta.innerText = email || '';
    atualizarCabecalhoCliente(nome || 'Cliente');
    const emailPerfilLogado = document.getElementById('email-perfil-logado');
    if (emailPerfilLogado) emailPerfilLogado.innerText = '';
    const moradaResumo = [morada, [cp, cidade].filter(Boolean).join(' '), pais].filter(Boolean).join(', ');
    const cpPerfilLogado = document.getElementById('cp-perfil-logado');
    if (cpPerfilLogado) cpPerfilLogado.innerText = '';

    const campoNome = document.getElementById('editar-nome');
    const campoEmail = document.getElementById('editar-email');
    const campoTelemovel = document.getElementById('editar-telemovel');
    const campoMorada = document.getElementById('editar-morada');
    const campoCp = document.getElementById('editar-cp');
    const campoCidade = document.getElementById('editar-cidade');
    const campoPais = document.getElementById('editar-pais');

    if (campoNome) campoNome.value = nome;
    if (campoEmail) campoEmail.value = email;
    if (campoTelemovel) campoTelemovel.value = data.telemovel || '';
    if (campoMorada) campoMorada.value = morada;
    if (campoCp) campoCp.value = cp;
    if (campoCidade) campoCidade.value = cidade;
    if (campoPais) campoPais.value = pais || 'Portugal';
}

async function guardarDadosCliente(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-dados-cliente');
    const nome = document.getElementById('editar-nome').value.trim();
    const email = document.getElementById('editar-email').value.trim();
    const telemovel = document.getElementById('editar-telemovel').value.trim();
    const morada = document.getElementById('editar-morada').value.trim();
    const cp = document.getElementById('editar-cp').value.trim();
    const cidade = document.getElementById('editar-cidade').value.trim();
    const pais = document.getElementById('editar-pais').value.trim();

    if (!nome) {
        mostrarMensagem(statusDiv, 'Indique o nome.', 'msg-erro');
        return;
    }

    if (!email) {
        mostrarMensagem(statusDiv, 'Indique o e-mail.', 'msg-erro');
        return;
    }

    try {
        mostrarMensagem(statusDiv, 'A guardar dados...');
        const { data: { user }, error: userError } = await dbClient.auth.getUser();
        if (userError || !user) throw userError || new Error('Sessão não encontrada.');
        const emailAtual = String(user.email || '').toLowerCase();
        const emailNovo = email.toLowerCase();
        const emailAlterado = emailNovo !== emailAtual;

        if (emailAlterado) {
            const { error: emailError } = await dbClient.auth.updateUser(
                { email },
                { emailRedirectTo: obterUrlPublicoAtual() }
            );
            if (emailError) throw emailError;
        }

        const perfilAtualizado = {
            id: user.id,
            nome,
            email,
            telemovel,
            morada,
            cp,
            cidade,
            pais
        };

        const { error } = await dbClient
            .from('clientes')
            .upsert(perfilAtualizado, { onConflict: 'id' });

        if (error) throw error;

        await sincronizarFichaClienteSite();

        preencherFormularioDadosCliente(perfilAtualizado, user);
        mostrarMensagem(
            statusDiv,
            emailAlterado
                ? 'Dados guardados. Confirme o novo e-mail através do link enviado pelo Supabase.'
                : 'Dados guardados com sucesso.',
            'msg-sucesso'
        );
    } catch(error) {
        console.error('Erro ao guardar dados do cliente:', error);
        mostrarMensagem(statusDiv, 'Erro: ' + (error.message || 'Não foi possível guardar os dados.'), 'msg-erro');
    }
}


async function fazerLogout() {
    await dbClient.auth.signOut();
    restaurarCarrinhoSeDisponivel();
    carregarFavoritosUtilizador();
    atualizarVisibilidadeAdmin(null);
    mostrarContaAnonimaSeExistir();
    const statusCliente = document.getElementById('status-cliente');
    if (statusCliente) statusCliente.innerText = '';
    atualizarCabecalhoCliente();
    definirHistoricoVazio('Entre na conta para carregar o histórico.');
    if (existeAreaClientePagina()) mudarAba('login');
    if (paginaPrecisaProdutosLoja()) {
        await carregarProdutosDaNuvem();
    }
}


function definirHistoricoVazio(mensagem) {
    const lista = document.getElementById('lista-historico-encomendas');
    if(!lista) return;
    lista.replaceChildren();
    const vazio = document.createElement('p');
    vazio.className = 'historico-vazio';
    vazio.textContent = mensagem;
    lista.appendChild(vazio);
}

function resumirProdutosEncomenda(produtos) {
    if(!Array.isArray(produtos) || produtos.length === 0) return 'Sem artigos registados';
    const totalArtigos = produtos.reduce((total, item) => total + Number(item.quantidade || item.qtd || 1), 0);
    const primeiro = produtos[0];
    const primeiroNome = primeiro ? (primeiro.nome || primeiro.produto || 'Artigo') : 'Artigo';
    if(produtos.length === 1) return `${totalArtigos}x ${primeiroNome}`;
    return `${totalArtigos} artigos - clique para ver detalhes`;
}

function criarListaCompletaProdutos(produtos) {
    const lista = document.createElement('ul');
    lista.className = 'lista-artigos-encomenda';

    if(!Array.isArray(produtos) || produtos.length === 0) {
        const item = document.createElement('li');
        item.textContent = 'Sem artigos registados';
        lista.appendChild(item);
        return lista;
    }

    produtos.forEach(produto => {
        const item = document.createElement('li');
        const quantidade = Number(produto.quantidade || produto.qtd || 1);
        const nome = produto.nome || produto.produto || 'Artigo';
        const preco = produto.preco_unitario || produto.preco;
        item.textContent = preco !== undefined
            ? `${quantidade}x ${nome} - ${formatarEuro(preco)} €`
            : `${quantidade}x ${nome}`;
        lista.appendChild(item);
    });

    return lista;
}

function renderizarHistoricoEncomendas(encomendas) {
    const lista = document.getElementById('lista-historico-encomendas');
    if(!lista) return;
    lista.replaceChildren();

    if(!encomendas || encomendas.length === 0) {
        definirHistoricoVazio('Ainda não existem encomendas nesta conta.');
        return;
    }

    encomendas.forEach(encomenda => {
        const card = document.createElement('div');
        card.className = 'encomenda-card';

        const topo = document.createElement('div');
        topo.className = 'encomenda-topo';

        const id = document.createElement('span');
        id.className = 'encomenda-id';
        id.textContent = encomenda.codigo_encomenda || ('#' + (encomenda.id || 'sem-id'));

        const estadoAtual = String(encomenda.estado || 'Pendente');
        const estadoCliente = ['concluido', 'concluído'].includes(estadoAtual.trim().toLowerCase())
            ? 'Enviado'
            : estadoAtual;

        topo.appendChild(id);
        const estado = document.createElement('span');
        estado.className = 'encomenda-estado';
        estado.textContent = estadoCliente;
        topo.appendChild(estado);

        const data = document.createElement('div');
        const dataValor = encomenda.created_at || encomenda.data || encomenda.inserted_at;
        data.textContent = dataValor ? new Date(dataValor).toLocaleDateString('pt-PT') : 'Data indisponível';

        const produtosDaEncomenda = encomenda.produtos || encomenda.artigos;

        const produtos = document.createElement('div');
        produtos.className = 'encomenda-produtos-resumo';
        produtos.textContent = resumirProdutosEncomenda(produtosDaEncomenda);

        const listaCompleta = criarListaCompletaProdutos(produtosDaEncomenda);

        const botaoArtigos = document.createElement('button');
        botaoArtigos.className = 'btn-ver-artigos';
        botaoArtigos.type = 'button';
        botaoArtigos.textContent = 'Ver artigos';
        botaoArtigos.onclick = function(){
            const aberta = listaCompleta.classList.toggle('aberta');
            botaoArtigos.textContent = aberta ? 'Ocultar artigos' : 'Ver artigos';
        };

        const total = document.createElement('div');
        total.className = 'encomenda-total';
        total.textContent = formatarEuro(encomenda.total || 0) + ' €';

        card.appendChild(topo);
        card.appendChild(data);
        card.appendChild(produtos);
        card.appendChild(botaoArtigos);
        card.appendChild(listaCompleta);
        card.appendChild(total);
        lista.appendChild(card);
    });
}

async function carregarHistoricoEncomendas(userId) {
    definirHistoricoVazio('A carregar histórico...');
    try {
        let { data, error } = await dbClient
            .from('encomendas')
            .select('id, codigo_encomenda, produtos, total, metodo_pagamento, estado, created_at')
            .eq('id_cliente', userId)
            .order('created_at', { ascending:false })
            .limit(10);

        if(error && /created_at|column/i.test(error.message || '')) {
            const fallback = await dbClient
                .from('encomendas')
                .select('id, codigo_encomenda, produtos, total, metodo_pagamento, estado')
                .eq('id_cliente', userId)
                .limit(10);
            data = fallback.data;
            error = fallback.error;
        }

        if(error) throw error;
        renderizarHistoricoEncomendas(data);
    } catch(e) {
        console.error('Erro ao carregar histórico:', e);
        definirHistoricoVazio('Não foi possível carregar o histórico de encomendas.');
    }
}

function ligarElementoConta(id, evento, handler) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.addEventListener(evento, handler);
}

function ligarContaCliente() {
    ligarElementoConta('form-editar-dados-cliente', 'submit', function (evento) {
        if (typeof guardarDadosCliente === 'function') guardarDadosCliente(evento);
    });
    ligarElementoConta('form-alterar-password', 'submit', function (evento) {
        if (typeof alterarPasswordConta === 'function') alterarPasswordConta(evento);
    });
    ligarElementoConta('form-login', 'submit', function (evento) {
        if (typeof fazerLogin === 'function') fazerLogin(evento);
    });
    ligarElementoConta('form-registo', 'submit', function (evento) {
        if (typeof registarCliente === 'function') registarCliente(evento);
    });
    ligarElementoConta('form-recuperar-password', 'submit', function (evento) {
        if (typeof atualizarPasswordRecuperacao === 'function') atualizarPasswordRecuperacao(evento);
    });

    document.querySelectorAll('.form-eliminar-conta').forEach(function (form) {
        form.addEventListener('submit', function (evento) {
            if (typeof eliminarContaUtilizador === 'function') eliminarContaUtilizador(evento);
        });
    });

    document.querySelectorAll('[data-aba-cliente]').forEach(function (botao) {
        botao.addEventListener('click', function () {
            if (typeof mudarAba === 'function') mudarAba(botao.dataset.abaCliente);
        });
    });

    document.querySelectorAll('[data-seccao-conta]').forEach(function (botao) {
        botao.addEventListener('click', function () {
            const destino = botao.dataset.seccaoConta;
            document.querySelectorAll('[data-seccao-conta]').forEach(function (item) {
                item.classList.toggle('ativa', item === botao);
            });
            document.querySelectorAll('[data-conta-seccao]').forEach(function (secao) {
                secao.classList.toggle('ativa', secao.dataset.contaSeccao === destino);
            });
        });
    });

    document.querySelectorAll('[data-acao-cliente="recuperar-password"]').forEach(function (botao) {
        botao.addEventListener('click', function () {
            if (typeof pedirRecuperacaoPassword === 'function') pedirRecuperacaoPassword();
        });
    });

    document.querySelectorAll('[data-acao-cliente="logout"]').forEach(function (botao) {
        botao.addEventListener('click', function () {
            if (typeof fazerLogout === 'function') fazerLogout();
        });
    });
}

(function iniciarContaCliente() {
    function quandoPronto(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    quandoPronto(function () {
        if (document.getElementById('form-login') || document.querySelector('[data-aba-cliente]') || document.getElementById('form-editar-dados-cliente')) {
            ligarContaCliente();
        }
    });
})();
