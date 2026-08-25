// ==UserScript==
// @name         Wallapop etiqueta - PDF
// @namespace    figuresplanet
// @version      5.8
// @description  Guarda etiqueta Wallapop em PDF A4 com nome da encomenda em tamanho compacto
// @match        https://*.wallapop.com/*
// @match        https://wallapop-delivery-labels.wallapop.com/*
// @match        https://figuresplanet.com/plataforma.html*
// @run-at       document-idle
// @connect      wallapop-delivery-labels.wallapop.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @require      https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_NOME = 'fp_wallapop_cliente';
  const STORAGE_TS = 'fp_wallapop_cliente_ts';
  const EXPIRACAO_MS = 30 * 60 * 1000;

  const A4_LARGURA_MM = 210;
  const A4_ALTURA_MM = 297;
  const FRACAO_ALTURA_ETIQUETA = 0.16;
  const FRACAO_TAMANHO_PDF_ETIQUETA = 0.7;
  const MARGEM_TOPO_MM = 30;
  const MARGEM_PDF_IMPRESSAO_MM = 5;

  function mmParaPt(mm) {
    return (mm * 72) / 25.4;
  }

  function nomeFicheiroSeguro(nome) {
    return nome
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  function extrairNomeCliente() {
    const texto = document.body?.innerText || '';
    const idx = texto.search(/Comprado por/i);
    if (idx >= 0) {
      const linhas = texto
        .slice(idx, idx + 300)
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const rotulo = linhas.findIndex((l) => /^Comprado por\s*:?$/i.test(l));
      if (rotulo >= 0 && linhas[rotulo + 1]) {
        const nome = nomeFicheiroSeguro(linhas[rotulo + 1]);
        if (nome && !/^(produto|preço|mostrar)/i.test(nome)) return nome;
      }
      const inline = texto.slice(idx).match(/Comprado por\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .'\-]{0,60})/i);
      if (inline?.[1]) {
        const nome = nomeFicheiroSeguro(inline[1]);
        if (nome) return nome;
      }
    }
    return null;
  }

  function guardarNomeCliente() {
    const nome = extrairNomeCliente();
    if (!nome) return;
    GM_setValue(STORAGE_NOME, nome);
    GM_setValue(STORAGE_TS, Date.now());
  }

  function guardarNomeEtiqueta(nome) {
    const seguro = nomeFicheiroSeguro(String(nome || ''));
    if (!seguro) return;
    GM_setValue(STORAGE_NOME, seguro);
    GM_setValue(STORAGE_TS, Date.now());
  }

  function obterNomeEncomendaFiguresPlanet() {
    const nomePorFuncao = typeof unsafeWindow !== 'undefined'
      ? unsafeWindow.obterNomeParaFicheirosPlataforma?.()
      : window.obterNomeParaFicheirosPlataforma?.();
    return nomePorFuncao || document.getElementById('wallapop-nome-encomenda')?.value || '';
  }

  function guardarNomeEncomendaFiguresPlanet() {
    guardarNomeEtiqueta(obterNomeEncomendaFiguresPlanet());
  }

  function obterNomeEtiqueta() {
    const nome = GM_getValue(STORAGE_NOME, '');
    const ts = GM_getValue(STORAGE_TS, 0);
    if (!nome || Date.now() - ts > EXPIRACAO_MS) return 'Etiqueta';
    return `Etiqueta - ${nome}`;
  }

  function obterNomePdf() {
    return `${obterNomeEtiqueta()}.pdf`;
  }

  function iniciarCapturaCliente() {
    guardarNomeCliente();

    document.addEventListener(
      'click',
      (e) => {
        const alvo = e.target.closest('button, a, [role="button"]');
        if (alvo && /mostrar etiqueta/i.test(alvo.textContent || '')) {
          guardarNomeCliente();
        }
      },
      true
    );

    const obs = new MutationObserver(guardarNomeCliente);
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => obs.disconnect(), 120000);
    }
  }

  function iniciarCapturaFiguresPlanet() {
    guardarNomeEncomendaFiguresPlanet();

    document.addEventListener(
      'input',
      (e) => {
        if (e.target?.matches?.('#wallapop-nome-encomenda, #wallapop-nome-cliente')) {
          guardarNomeEncomendaFiguresPlanet();
        }
      },
      true
    );

    document.addEventListener('click', guardarNomeEncomendaFiguresPlanet, true);
    window.addEventListener('beforeunload', guardarNomeEncomendaFiguresPlanet);
    setInterval(guardarNomeEncomendaFiguresPlanet, 3000);
  }

  function calcularTamanhoEtiqueta(pageW, pageH, imgW, imgH) {
    let altura = pageH * FRACAO_ALTURA_ETIQUETA;
    let largura = altura * (imgW / imgH);
    const maxLargura = pageW * 0.9;
    if (largura > maxLargura) {
      largura = maxLargura;
      altura = largura * (imgH / imgW);
    }
    return { largura, altura };
  }

  function detetarTipoBytes(bytes) {
    const u8 = new Uint8Array(bytes);
    if (u8.length >= 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) {
      return 'pdf';
    }
    return 'imagem';
  }

  function detetarTipoEtiqueta(url, contentType, bytes) {
    if (/\.pdf(\?|$)/i.test(url) || /application\/pdf/i.test(contentType || '')) return 'pdf';
    if (/\.(png|jpg|jpeg|webp)(\?|$)/i.test(url) || /^image\//i.test(contentType || '')) return 'imagem';
    return detetarTipoBytes(bytes);
  }

  function obterUrlEtiqueta() {
    if (/\.(png|jpg|jpeg|webp|pdf)(\?|$)/i.test(location.pathname)) {
      return location.href.split('#')[0];
    }
    const embed = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]');
    if (embed?.src) return embed.src.split('#')[0];
    const img = document.querySelector('img');
    return img ? (img.currentSrc || img.src).split('#')[0] : location.href.split('#')[0];
  }

  async function obterBytesEtiqueta() {
    const url = obterUrlEtiqueta();
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('fetch');
    const bytes = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || '';
    return { bytes, url, tipo: detetarTipoEtiqueta(url, contentType, bytes) };
  }

  async function bytesComFundoBranco(bytes) {
    const blob = new Blob([bytes]);
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const pngBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png');
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  }

  async function criarPdf(pngBytes) {
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const image = await pdfDoc.embedPng(pngBytes);

    const pageW = mmParaPt(A4_LARGURA_MM);
    const pageH = mmParaPt(A4_ALTURA_MM);
    const { largura, altura } = calcularTamanhoEtiqueta(pageW, pageH, image.width, image.height);
    const x = (pageW - largura) / 2;
    const y = pageH - altura - mmParaPt(MARGEM_TOPO_MM);

    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(image, { x, y, width: largura, height: altura });

    return pdfDoc.save();
  }

  async function criarPdfAPartirDePdf(pdfBytes) {
    const { PDFDocument } = PDFLib;
    const origem = await PDFDocument.load(pdfBytes);
    const [paginaOrigem] = origem.getPages();
    if (!paginaOrigem) throw new Error('pdf-sem-paginas');

    const { width: srcW, height: srcH } = paginaOrigem.getSize();
    const largura = srcW * FRACAO_TAMANHO_PDF_ETIQUETA;
    const altura = srcH * FRACAO_TAMANHO_PDF_ETIQUETA;

    const pdfDoc = await PDFDocument.create();
    const pageW = mmParaPt(A4_LARGURA_MM);
    const pageH = mmParaPt(A4_ALTURA_MM);
    const margem = mmParaPt(MARGEM_PDF_IMPRESSAO_MM);
    const x = margem;
    const y = pageH - altura - margem;

    const paginaEmbutida = await pdfDoc.embedPage(paginaOrigem);
    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawPage(paginaEmbutida, { x, y, width: largura, height: altura });

    return pdfDoc.save();
  }

  async function processarEtiqueta(bytes, tipo) {
    if (tipo === 'pdf') return criarPdfAPartirDePdf(bytes);
    const pngBytes = await bytesComFundoBranco(bytes);
    return criarPdf(pngBytes);
  }

  function descarregar(bytes, nome) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function imprimirEtiqueta(bytes) {
    const pngBytes = await bytesComFundoBranco(bytes);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const titulo = obterNomeEtiqueta();
    const janela = window.open('', '_blank');
    if (!janela) throw new Error('popup');

    janela.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body {
    margin: 0; padding: 0; width: ${A4_LARGURA_MM}mm; height: ${A4_ALTURA_MM}mm;
    background: #fff; display: flex; align-items: flex-start; justify-content: center;
    padding-top: ${MARGEM_TOPO_MM}mm; box-sizing: border-box;
  }
  img {
    height: ${FRACAO_ALTURA_ETIQUETA * 100}%;
    width: auto;
    max-width: 90%;
    object-fit: contain;
    display: block;
  }
</style></head>
<body><img src="${dataUrl}" alt="etiqueta"></body></html>`);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 600);
  }

  async function guardarPdf(btn) {
    const textoOriginal = btn.textContent;
    btn.textContent = 'A gerar PDF...';
    btn.disabled = true;

    try {
      const { bytes, tipo } = await obterBytesEtiqueta();
      const pdfBytes = await processarEtiqueta(bytes, tipo);
      descarregar(pdfBytes, obterNomePdf());
    } catch (err) {
      console.error('[Wallapop PDF]', err);
      try {
        const { bytes, tipo } = await obterBytesEtiqueta();
        if (tipo === 'pdf') {
          const pdfBytes = await criarPdfAPartirDePdf(bytes).catch(() => null);
          if (pdfBytes) {
            descarregar(pdfBytes, obterNomePdf());
            return;
          }
          descarregar(new Uint8Array(bytes), obterNomePdf());
          return;
        }
        await imprimirEtiqueta(bytes);
        alert(`PDF automático falhou. Use «Guardar como PDF» na janela que abriu (nome: ${obterNomeEtiqueta()}).`);
      } catch (err2) {
        console.error('[Wallapop PDF fallback]', err2);
        alert('Não foi possível criar o PDF. Tenta recarregar a página (F5).');
      }
    } finally {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }
  }

  function criarBotao() {
    if (document.getElementById('fp-guardar-etiqueta')) return;

    const btn = document.createElement('button');
    btn.id = 'fp-guardar-etiqueta';
    btn.textContent = '⬇ Guardar PDF Etiqueta';
    btn.type = 'button';
    Object.assign(btn.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '999999',
      padding: '12px 18px',
      fontSize: '15px',
      fontWeight: '600',
      fontFamily: 'system-ui, sans-serif',
      color: '#000',
      background: '#ffc107',
      border: '2px solid #000',
      borderRadius: '8px',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.35)'
    });
    btn.addEventListener('click', () => guardarPdf(btn));
    (document.body || document.documentElement).appendChild(btn);
  }

  function iniciarEtiqueta() {
    document.title = obterNomeEtiqueta();
    criarBotao();
  }

  if (location.hostname === 'figuresplanet.com') {
    iniciarCapturaFiguresPlanet();
  } else if (location.hostname === 'wallapop-delivery-labels.wallapop.com') {
    iniciarEtiqueta();
  } else {
    iniciarCapturaCliente();
  }
})();
