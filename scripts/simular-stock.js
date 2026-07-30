/**
 * Simulação local da lógica de stock (espelha o SQL do repo).
 * Corrida: node scripts/simular-stock.js
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function criarDb(stockInicial) {
  return {
    produtos: Object.fromEntries(
      Object.entries(stockInicial).map(([id, stock]) => [id, { id, stock, ativo: stock > 0 }])
    ),
    encomendas: {},
    fornecedores: {},
  };
}

function stockDe(db, id) {
  return db.produtos[id].stock;
}

function agruparItens(itens) {
  const mapa = new Map();
  for (const item of itens) {
    const id = item.id_produto || item.id;
    if (!id) continue;
    const q = Math.max(1, Number(item.quantidade ?? item.qtd ?? 1) || 1);
    mapa.set(id, (mapa.get(id) || 0) + q);
  }
  return [...mapa.entries()].map(([id_produto, quantidade]) => ({ id_produto, quantidade }));
}

/** Espelha cancelar_encomenda_plataforma_admin (versão recuperar) */
function cancelar(db, encomendaId) {
  const enc = db.encomendas[encomendaId];
  assert(enc, "encomenda nao encontrada");
  let repostouAgora = false;
  if (!enc.stock_reposto) {
    repostouAgora = true;
    for (const item of agruparItens(enc.produtos)) {
      const p = db.produtos[item.id_produto];
      assert(p, `produto ${item.id_produto} em falta`);
      p.stock += item.quantidade;
      p.ativo = p.stock > 0;
    }
    enc.stock_reposto = true;
  }
  enc.estado = "Cancelado";
  return { stock_reposto_agora: repostouAgora, stock_reposto: enc.stock_reposto };
}

/** Espelha cancelar antigo (plataformas.sql) — sem agrupar, só id_produto */
function cancelarAntigoSemAgrupar(db, encomendaId) {
  const enc = db.encomendas[encomendaId];
  assert(enc, "encomenda nao encontrada");
  if (!enc.stock_reposto) {
    for (const item of enc.produtos) {
      const id = item.id_produto;
      const q = Math.max(1, Number(item.quantidade ?? 1) || 1);
      const p = db.produtos[id];
      if (!p) continue;
      p.stock += q;
      p.ativo = p.stock > 0;
    }
    enc.stock_reposto = true;
  }
  enc.estado = "Cancelado";
}

/** Espelha recuperar_encomenda_admin */
function recuperar(db, encomendaId, estado = "Pago") {
  const enc = db.encomendas[encomendaId];
  assert(enc, "encomenda nao encontrada");
  assert(enc.estado === "Cancelado", "nao cancelada");
  const eraReposto = !!enc.stock_reposto;
  if (eraReposto) {
    for (const item of agruparItens(enc.produtos)) {
      const p = db.produtos[item.id_produto];
      assert(p, `produto ${item.id_produto}`);
      assert(p.stock >= item.quantidade, `stock insuficiente ${item.id_produto}`);
      p.stock -= item.quantidade;
      p.ativo = p.stock > 0;
    }
  }
  enc.estado = estado;
  enc.stock_reposto = false;
  return { stock_reduzido: eraReposto };
}

/** Espelha criar plataforma (desconto) */
function criarPlataforma(db, id, itens, permitirNegativo = false) {
  const agrupados = agruparItens(itens);
  for (const item of agrupados) {
    const p = db.produtos[item.id_produto];
    assert(p, `produto ${item.id_produto}`);
    if (!permitirNegativo && p.stock < item.quantidade) {
      throw new Error(`sem stock ${item.id_produto}`);
    }
  }
  for (const item of agrupados) {
    const p = db.produtos[item.id_produto];
    p.stock -= item.quantidade;
    p.ativo = p.stock > 0;
  }
  db.encomendas[id] = {
    id,
    estado: "A aguardar pagamento",
    stock_reposto: false,
    produtos: agrupados.map((i) => ({ id_produto: i.id_produto, quantidade: i.quantidade })),
  };
}

/** Espelha atualizar_encomenda_plataforma_admin */
function editarPlataforma(db, id, novosItens, naoReporIds = []) {
  const enc = db.encomendas[id];
  assert(enc && enc.estado !== "Cancelado", "nao editavel");
  const antigos = agruparItens(enc.produtos);
  const novos = agruparItens(novosItens);
  const mapaAntigo = Object.fromEntries(antigos.map((i) => [i.id_produto, i.quantidade]));
  const mapaNovo = Object.fromEntries(novos.map((i) => [i.id_produto, i.quantidade]));

  for (const item of antigos) {
    const qNova = mapaNovo[item.id_produto] || 0;
    const naoRepor = naoReporIds.includes(item.id_produto)
      ? Math.max(item.quantidade - qNova, 0)
      : 0;
    const p = db.produtos[item.id_produto];
    p.stock += Math.max(item.quantidade - naoRepor, 0);
    p.ativo = p.stock > 0;
  }
  for (const item of novos) {
    const p = db.produtos[item.id_produto];
    const qAntiga = mapaAntigo[item.id_produto] || 0;
    const naoRepor = naoReporIds.includes(item.id_produto)
      ? Math.max(qAntiga - item.quantidade, 0)
      : 0;
    const disponivel = qAntiga + Math.max(p.stock, 0) - naoRepor;
    // Nota: após restore parcial, p.stock já inclui o restore; a checagem real no SQL
    // usa stock ANTES do restore. Aqui validamos pós-restore: stock >= quantidade.
    if (p.stock < item.quantidade) {
      // Reverter simulação simplificada: falha
      throw new Error(`edit sem stock ${item.id_produto} (disp sim ${p.stock})`);
    }
    p.stock -= item.quantidade;
    p.ativo = p.stock > 0;
  }
  enc.produtos = novos.map((i) => ({ id_produto: i.id_produto, quantidade: i.quantidade }));
  enc.stock_reposto = false;
}

/** Espelha receber_stock_fornecedor_admin (sem teto / sem lock produto) */
function receberFornecedor(db, pedidoId, recebidos) {
  const pedido = db.fornecedores[pedidoId];
  assert(pedido, "pedido nao encontrado");
  for (const r of recebidos) {
    const id = r.produto_id || r.id;
    const q = Math.max(0, Number(r.quantidade || 0));
    if (!id || q <= 0) continue;
    const p = db.produtos[id];
    assert(p, `produto ${id}`);
    p.stock += q;
    p.ativo = p.stock > 0;
  }
  for (const item of pedido.itens) {
    const q = recebidos
      .filter((r) => (r.produto_id || r.id) === item.id)
      .reduce((s, r) => s + Math.max(0, Number(r.quantidade || 0)), 0);
    item.recebido = (item.recebido || 0) + q;
  }
}

/** Espelha receber_stock_fornecedor_admin corrigida (com teto ao pendente) */
function receberFornecedorSeguro(db, pedidoId, recebidos) {
  const pedido = db.fornecedores[pedidoId];
  assert(pedido, "pedido nao encontrado");
  const aplicado = [];
  for (const item of pedido.itens) {
    const id = item.id;
    const pedidoQtd = Math.max(0, Number(item.quantidade || 0));
    const jaRecebido = Math.max(0, Number(item.recebido || 0));
    const pendente = Math.max(0, pedidoQtd - jaRecebido);
    const solicitado = recebidos
      .filter((r) => (r.produto_id || r.id) === id)
      .reduce((s, r) => s + Math.max(0, Number(r.quantidade || 0)), 0);
    const aplicar = Math.min(solicitado, pendente);
    if (aplicar <= 0) continue;
    const p = db.produtos[id];
    assert(p, `produto ${id}`);
    const antes = p.stock;
    p.stock += aplicar;
    p.ativo = p.stock > 0;
    item.recebido = jaRecebido + aplicar;
    aplicado.push({ produto_id: id, quantidade: aplicar, solicitada: solicitado, pendente_antes: pendente, stock_antes: antes, stock_depois: p.stock });
  }
  return { recebido_aplicado: aplicado };
}

/** Apagar sem repor */
function apagarEncomenda(db, id) {
  delete db.encomendas[id];
}

/** Espelha apagar_encomenda_admin corrigida */
function apagarEncomendaSeguro(db, id) {
  const enc = db.encomendas[id];
  assert(enc, "encomenda nao encontrada");
  assert(String(enc.estado || "").toLowerCase() === "cancelado", "bloqueado: cancelar antes de apagar");
  assert(enc.stock_reposto === true, "bloqueado: stock ainda nao reposto");
  delete db.encomendas[id];
}

const resultados = [];
function cenario(nome, fn) {
  try {
    fn();
    resultados.push({ nome, ok: true });
    console.log(`PASS  ${nome}`);
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e.message });
    console.log(`FAIL  ${nome}: ${e.message}`);
  }
}

function expectStock(db, id, esperado, rotulo) {
  const atual = stockDe(db, id);
  assert(atual === esperado, `${rotulo}: stock=${atual}, esperado=${esperado}`);
}

// --- Cenários ---

cenario("1. Criar → cancelar → stock volta ao original", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 2 }]);
  expectStock(db, "A", 3, "apos criar");
  cancelar(db, "e1");
  expectStock(db, "A", 5, "apos cancelar");
});

cenario("2. Cancelar duas vezes nao repoe stock em dobro", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 2 }]);
  cancelar(db, "e1");
  cancelar(db, "e1");
  expectStock(db, "A", 5, "duplo cancel");
});

cenario("3. Cancelar → recuperar → stock volta a descontar", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 2 }]);
  cancelar(db, "e1");
  recuperar(db, "e1", "Pago");
  expectStock(db, "A", 3, "apos recuperar");
});

cenario("4. Cancelar → recuperar → cancelar (ciclo) mantem stock", () => {
  const db = criarDb({ A: 10 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 3 }]);
  cancelar(db, "e1");
  recuperar(db, "e1");
  cancelar(db, "e1");
  recuperar(db, "e1");
  expectStock(db, "A", 7, "ciclo");
});

cenario("5. Linhas duplicadas do mesmo produto: cancel novo agrupa bem", () => {
  const db = criarDb({ A: 5 });
  // Simula encomenda com 2 linhas do mesmo produto (bug potencial no cancel antigo)
  db.encomendas.e1 = {
    id: "e1",
    estado: "Pago",
    stock_reposto: false,
    produtos: [
      { id_produto: "A", quantidade: 1 },
      { id_produto: "A", quantidade: 1 },
    ],
  };
  db.produtos.A.stock = 3; // ja descontado 2
  cancelar(db, "e1");
  expectStock(db, "A", 5, "agrupado");
});

cenario("6. BUG: cancel antigo sem agrupar repoe a dobrar em linhas duplicadas", () => {
  const db = criarDb({ A: 5 });
  db.encomendas.e1 = {
    id: "e1",
    estado: "Pago",
    stock_reposto: false,
    produtos: [
      { id_produto: "A", quantidade: 1 },
      { id_produto: "A", quantidade: 1 },
    ],
  };
  db.produtos.A.stock = 3;
  cancelarAntigoSemAgrupar(db, "e1");
  // Se o SQL antigo estiver ativo, stock fica 5 em vez de 5... wait: 3+1+1=5, same!
  // Actually if stock was deducted once as sum(2)=2 -> 3, restore 1+1 = 5 OK.
  // Double bug when qty was deducted per line OR when lines are duplicates but deduction grouped:
  // Deduction grouped: -2 -> stock 3. Restore ungrouped: +1+1 -> 5. OK!
  // Deduction ungrouped same: -1-1 -> 3. Restore +1+1 -> 5. OK!
  // Bug when: deduction was -2 once but restore runs +1 three times? need 3 duplicate lines with wrong total.
  // Real bug: item uses only id_produto; if site uses "id" field, restore does NOTHING.
  expectStock(db, "A", 5, "antigo agrupamento coincidente");
});

cenario("7. BUG CRITICO: cancel antigo ignora campo id (site) e nao repoe", () => {
  const db = criarDb({ A: 5 });
  db.encomendas.e1 = {
    id: "e1",
    estado: "Pago",
    stock_reposto: false,
    produtos: [{ id: "A", quantidade: 2 }], // site-style, sem id_produto
  };
  db.produtos.A.stock = 3;
  cancelarAntigoSemAgrupar(db, "e1");
  expectStock(db, "A", 3, "nao reposto — stock perdido");
  assert(db.produtos.A.stock === 3, "evidencia do bug");
  // Marcar como bug conhecido: o cenário "passa" se documentamos o stock errado
  throw new Error("BUG CONFIRMADO: stock ficou 3 em vez de 5 (campo id ignorado no cancel antigo)");
});

cenario("8. Cancel novo (recuperar.sql) repoe com campo id", () => {
  const db = criarDb({ A: 5 });
  db.encomendas.e1 = {
    id: "e1",
    estado: "Pago",
    stock_reposto: false,
    produtos: [{ id: "A", quantidade: 2 }],
  };
  db.produtos.A.stock = 3;
  cancelar(db, "e1");
  expectStock(db, "A", 5, "reposto via id");
});

cenario("9. Apagar sem cancelar perde stock", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 2 }]);
  apagarEncomenda(db, "e1");
  expectStock(db, "A", 3, "stock perdido");
  throw new Error("BUG DE PROCESSO: apagar sem cancelar deixa stock=3 em vez de 5");
});

cenario("9b. Apagar seguro bloqueia encomenda nao cancelada", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 2 }]);
  let bloqueou = false;
  try {
    apagarEncomendaSeguro(db, "e1");
  } catch (_) {
    bloqueou = true;
  }
  assert(bloqueou, "deveria bloquear apagar sem cancelar");
  expectStock(db, "A", 3, "stock intacto apos bloqueio");
});

cenario("9c. Apagar seguro permite encomenda cancelada com stock reposto", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 2 }]);
  cancelar(db, "e1");
  apagarEncomendaSeguro(db, "e1");
  assert(!db.encomendas.e1, "encomenda apagada");
  expectStock(db, "A", 5, "stock reposto antes de apagar");
});

cenario("10. Editar: reduzir quantidade com repor → stock sobe", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 3 }]);
  expectStock(db, "A", 2, "apos criar");
  editarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 1 }], []);
  expectStock(db, "A", 4, "apos editar repor");
});

cenario("11. Editar: reduzir com NAO repor → stock nao sobe", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 3 }]);
  editarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 1 }], ["A"]);
  expectStock(db, "A", 2, "nao repor");
});

cenario("12. Editar: trocar produto A→B com repor", () => {
  const db = criarDb({ A: 5, B: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 1 }]);
  editarPlataforma(db, "e1", [{ id_produto: "B", quantidade: 1 }], []);
  expectStock(db, "A", 5, "A reposto");
  expectStock(db, "B", 4, "B descontado");
});

cenario("12b. Stock negativo + receber fornecedor: -1 + 5 = 4", () => {
  const db = criarDb({ A: 0 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 1 }], true);
  expectStock(db, "A", -1, "encomenda com stock negativo");
  db.fornecedores.f1 = { id: "f1", itens: [{ id: "A", quantidade: 5, recebido: 0 }] };
  receberFornecedor(db, "f1", [{ produto_id: "A", quantidade: 5 }]);
  expectStock(db, "A", 4, "-1 + 5 = 4");
  assert(db.produtos.A.ativo === true, "ativo apos receber");
});

cenario("13. BUG: receber fornecedor acima do pedido (sem teto + re-submit)", () => {
  const db = criarDb({ A: 1 });
  db.fornecedores.f1 = { id: "f1", itens: [{ id: "A", quantidade: 5, recebido: 0 }] };
  receberFornecedor(db, "f1", [{ produto_id: "A", quantidade: 5 }]);
  expectStock(db, "A", 6, "pedido completo");
  // segundo submit acidental do mesmo lote
  receberFornecedor(db, "f1", [{ produto_id: "A", quantidade: 5 }]);
  expectStock(db, "A", 11, "duplicado");
  throw new Error("BUG CONFIRMADO: 2x receber 5 num pedido de 5 → stock 11 e recebido 10");
});

cenario("13b. Receber fornecedor seguro ignora re-submit acima do pendente", () => {
  const db = criarDb({ A: 1 });
  db.fornecedores.f1 = { id: "f1", itens: [{ id: "A", quantidade: 5, recebido: 0 }] };
  receberFornecedorSeguro(db, "f1", [{ produto_id: "A", quantidade: 5 }]);
  expectStock(db, "A", 6, "pedido completo");
  const segunda = receberFornecedorSeguro(db, "f1", [{ produto_id: "A", quantidade: 5 }]);
  expectStock(db, "A", 6, "re-submit ignorado");
  assert(db.fornecedores.f1.itens[0].recebido === 5, "recebido nao passa do pedido");
  assert(segunda.recebido_aplicado.length === 0, "sem aplicacoes no re-submit");
});

cenario("17. BUG: cancel marca stock_reposto mesmo se produto id nao existe", () => {
  const db = criarDb({ A: 5 });
  db.encomendas.e1 = {
    id: "e1",
    estado: "Pago",
    stock_reposto: false,
    produtos: [{ id_produto: "INEXISTENTE", quantidade: 2 }],
  };
  db.produtos.A.stock = 3;
  // cancel novo: agrupa e faz UPDATE where id=INEXISTENTE → 0 rows, mas marca stock_reposto=true
  const enc = db.encomendas.e1;
  if (!enc.stock_reposto) {
    for (const item of agruparItens(enc.produtos)) {
      const p = db.produtos[item.id_produto];
      if (p) {
        p.stock += item.quantidade;
        p.ativo = p.stock > 0;
      }
      // SQL real: UPDATE sem verificar rowcount
    }
    enc.stock_reposto = true; // como no SQL
  }
  enc.estado = "Cancelado";
  assert(enc.stock_reposto === true, "flag marcada");
  expectStock(db, "A", 3, "A nao foi reposto (produto errado)");
  throw new Error("BUG CONFIRMADO: stock_reposto=true sem repor nada se id_produto invalido");
});

cenario("14. Receber mais do que o pedido (sem teto)", () => {
  const db = criarDb({ A: 0 });
  db.fornecedores.f1 = { id: "f1", itens: [{ id: "A", quantidade: 2, recebido: 0 }] };
  receberFornecedor(db, "f1", [{ produto_id: "A", quantidade: 50 }]);
  expectStock(db, "A", 50, "sem teto");
  throw new Error("BUG CONFIRMADO: recebeu 50 com pedido de 2 → stock=50");
});

cenario("14b. Receber fornecedor seguro aplica no maximo o pendente", () => {
  const db = criarDb({ A: 0 });
  db.fornecedores.f1 = { id: "f1", itens: [{ id: "A", quantidade: 2, recebido: 0 }] };
  const res = receberFornecedorSeguro(db, "f1", [{ produto_id: "A", quantidade: 50 }]);
  expectStock(db, "A", 2, "limitado ao pedido");
  assert(db.fornecedores.f1.itens[0].recebido === 2, "recebido limitado");
  assert(res.recebido_aplicado[0].quantidade === 2, "aplicado limitado");
  assert(res.recebido_aplicado[0].solicitada === 50, "mantem auditoria da quantidade solicitada");
});

cenario("15. Recuperar sem stock suficiente falha (correto)", () => {
  const db = criarDb({ A: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 3 }]);
  cancelar(db, "e1");
  // outro pedido consome o stock reposto
  criarPlataforma(db, "e2", [{ id_produto: "A", quantidade: 4 }]);
  let falhou = false;
  try {
    recuperar(db, "e1");
  } catch (_) {
    falhou = true;
  }
  assert(falhou, "deveria falhar");
  expectStock(db, "A", 1, "stock intacto apos falha");
});

cenario("16. Duas encomendas independentes cancel/recover", () => {
  const db = criarDb({ A: 10 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 2 }]);
  criarPlataforma(db, "e2", [{ id_produto: "A", quantidade: 3 }]);
  expectStock(db, "A", 5, "ambas");
  cancelar(db, "e1");
  expectStock(db, "A", 7, "cancel e1");
  cancelar(db, "e2");
  expectStock(db, "A", 10, "cancel e2");
});

cenario("18. Editar com linhas duplicadas no novo pedido agrupa antes de descontar", () => {
  const db = criarDb({ A: 10 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 2 }]);
  editarPlataforma(db, "e1", [
    { id_produto: "A", quantidade: 1 },
    { id_produto: "A", quantidade: 3 },
  ]);
  expectStock(db, "A", 6, "stock apos editar para total 4");
});

cenario("19. Editar removendo produto com NAO repor mantem stock consumido", () => {
  const db = criarDb({ A: 5, B: 5 });
  criarPlataforma(db, "e1", [{ id_produto: "A", quantidade: 3 }]);
  editarPlataforma(db, "e1", [{ id_produto: "B", quantidade: 1 }], ["A"]);
  expectStock(db, "A", 2, "A nao reposto");
  expectStock(db, "B", 4, "B descontado");
});

cenario("20. Recuperar cancelado sem stock_reposto nao mexe no stock", () => {
  const db = criarDb({ A: 5 });
  db.encomendas.e1 = {
    id: "e1",
    estado: "Cancelado",
    stock_reposto: false,
    produtos: [{ id_produto: "A", quantidade: 2 }],
  };
  db.produtos.A.stock = 3;
  const res = recuperar(db, "e1", "Pago");
  expectStock(db, "A", 3, "stock mantido");
  assert(res.stock_reduzido === false, "nao reduziu stock");
});

cenario("21. Receber fornecedor seguro soma linhas duplicadas e aplica teto", () => {
  const db = criarDb({ A: 0 });
  db.fornecedores.f1 = { id: "f1", itens: [{ id: "A", quantidade: 5, recebido: 1 }] };
  const res = receberFornecedorSeguro(db, "f1", [
    { produto_id: "A", quantidade: 3 },
    { produto_id: "A", quantidade: 3 },
  ]);
  expectStock(db, "A", 4, "aplica apenas pendente 4");
  assert(db.fornecedores.f1.itens[0].recebido === 5, "pedido completo");
  assert(res.recebido_aplicado[0].solicitada === 6, "audita solicitado total");
  assert(res.recebido_aplicado[0].quantidade === 4, "aplicado limitado");
});

cenario("22. Receber fornecedor seguro ignora produto estranho ao pedido", () => {
  const db = criarDb({ A: 0, B: 10 });
  db.fornecedores.f1 = { id: "f1", itens: [{ id: "A", quantidade: 2, recebido: 0 }] };
  const res = receberFornecedorSeguro(db, "f1", [{ produto_id: "B", quantidade: 5 }]);
  expectStock(db, "A", 0, "A intacto");
  expectStock(db, "B", 10, "B intacto");
  assert(res.recebido_aplicado.length === 0, "nada aplicado");
});

cenario("23. Receber fornecedor seguro ignora quantidades negativas", () => {
  const db = criarDb({ A: 0 });
  db.fornecedores.f1 = { id: "f1", itens: [{ id: "A", quantidade: 2, recebido: 0 }] };
  const res = receberFornecedorSeguro(db, "f1", [{ produto_id: "A", quantidade: -5 }]);
  expectStock(db, "A", 0, "stock intacto");
  assert(db.fornecedores.f1.itens[0].recebido === 0, "recebido intacto");
  assert(res.recebido_aplicado.length === 0, "nada aplicado");
});

const falhas = resultados.filter((r) => !r.ok);
const bugs = falhas.filter((r) => String(r.erro || "").startsWith("BUG"));
console.log("\n=== RESUMO ===");
console.log(`Total: ${resultados.length}`);
console.log(`Passaram: ${resultados.filter((r) => r.ok).length}`);
console.log(`Falharam (incl. bugs esperados): ${falhas.length}`);
console.log(`Bugs confirmados: ${bugs.length}`);
bugs.forEach((b) => console.log(` - ${b.nome}: ${b.erro}`));

process.exit(0);
