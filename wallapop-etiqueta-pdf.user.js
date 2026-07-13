// ==UserScript==
// @name         Wallapop etiqueta - PDF
// @namespace    figuresplanet
// @version      4.4
// @description  Guarda etiqueta Wallapop em PDF A4 (25% altura, topo com margem)
// @match        https://wallapop-delivery-labels.wallapop.com/*
// @run-at       document-idle
// @connect      wallapop-delivery-labels.wallapop.com
// @require      https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js
// ==/UserScript==

(function () {
  'use strict';

  const NOME = 'Etiqueta';
  const A4_LARGURA_MM = 210;
  const A4_ALTURA_MM = 297;
  const FRACAO_ALTURA_ETIQUETA = 0.25;
  const MARGEM_TOPO_MM = 30;

  function mmParaPt(mm) {
    return (mm * 72) / 25.4;
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

  function obterUrlImagem() {
    if (/\.(png|jpg|jpeg|webp)(\?|$)/i.test(location.pathname)) {
      return location.href.split('#')[0];
    }
    const img = document.querySelector('img');
    return img ? img.src : location.href;
  }

  async function obterBytesImagem() {
    const url = obterUrlImagem();
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('fetch');
    return { bytes: await res.arrayBuffer(), url };
  }

  async function bytesComFundoBranco(bytes, url) {
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

  function descarregar(bytes, nome) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function imprimirEtiqueta(bytes, url) {
    const pngBytes = await bytesComFundoBranco(bytes, url);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const janela = window.open('', '_blank');
    if (!janela) throw new Error('popup');

    janela.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${NOME}</title>
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
      const { bytes, url } = await obterBytesImagem();
      const pngBytes = await bytesComFundoBranco(bytes, url);
      const pdfBytes = await criarPdf(pngBytes);
      descarregar(pdfBytes, `${NOME}.pdf`);
    } catch (err) {
      console.error('[Wallapop PDF]', err);
      try {
        const { bytes, url } = await obterBytesImagem();
        await imprimirEtiqueta(bytes, url);
        alert('PDF automático falhou. Use «Guardar como PDF» na janela que abriu (nome: Etiqueta).');
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

  document.title = 'etiqueta';
  criarBotao();
})();
