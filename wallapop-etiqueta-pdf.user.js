// ==UserScript==
// @name         Wallapop etiqueta - PDF
// @namespace    figuresplanet
// @version      3.2
// @description  Guarda etiqueta Wallapop como PDF pronto a imprimir (sem bibliotecas externas)
// @match        https://wallapop-delivery-labels.wallapop.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  const NOME = 'Etiqueta';
  const LARGURA_MM = 100;

  function obterUrlImagem() {
    if (/\.(png|jpg|jpeg|webp)(\?|$)/i.test(location.pathname)) {
      return location.href;
    }
    const img = document.querySelector('img');
    return img ? img.src : location.href;
  }

  async function obterBlobImagem() {
    const url = obterUrlImagem();
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('fetch');
    return res.blob();
  }

  async function blobParaJpeg(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const jpegBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/jpeg', 0.95);
    });

    return {
      jpeg: new Uint8Array(await jpegBlob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height
    };
  }

  function mmParaPt(mm) {
    return (mm * 72) / 25.4;
  }

  function criarPdfComJpeg(jpeg, imgW, imgH, pageWpt, pageHpt) {
    const enc = new TextEncoder();
    const parts = [];
    let len = 0;
    const objOffsets = [];

    function write(str) {
      const bytes = typeof str === 'string' ? enc.encode(str) : str;
      parts.push(bytes);
      len += bytes.length;
    }

    function startObject() {
      objOffsets.push(len);
    }

    const sx = (pageWpt / imgW).toFixed(5);
    const sy = (pageHpt / imgH).toFixed(5);
    const content = `q ${sx} 0 0 ${sy} 0 0 cm /Im1 Do Q\n`;

    write('%PDF-1.4\n');

    startObject();
    write('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    startObject();
    write('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

    startObject();
    write(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWpt.toFixed(2)} ${pageHpt.toFixed(2)}] ` +
        '/Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n'
    );

    startObject();
    write(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    write(jpeg);
    write('\nendstream\nendobj\n');

    startObject();
    write(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    const xrefStart = len;
    write(`xref\n0 ${objOffsets.length + 1}\n`);
    write('0000000000 65535 f \n');
    for (const off of objOffsets) {
      write(`${String(off).padStart(10, '0')} 00000 n \n`);
    }
    write(`trailer\n<< /Size ${objOffsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

    return new Blob(parts, { type: 'application/pdf' });
  }

  async function abrirImpressaoEtiqueta(blob) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const bitmap = await createImageBitmap(blob);
    const alturaMm = LARGURA_MM * (bitmap.height / bitmap.width);
    bitmap.close();

    const janela = window.open('', '_blank');
    if (!janela) throw new Error('popup');

    janela.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${NOME}</title>
<style>
  @page { size: ${LARGURA_MM}mm ${alturaMm.toFixed(1)}mm; margin: 0; }
  html, body { margin: 0; padding: 0; width: ${LARGURA_MM}mm; height: ${alturaMm.toFixed(1)}mm; background: #fff; }
  img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style></head>
<body><img src="${dataUrl}" alt="etiqueta"></body></html>`);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 600);
  }

  function descarregar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function guardarPdf(btn) {
    const textoOriginal = btn.textContent;
    btn.textContent = 'A gerar PDF...';
    btn.disabled = true;

    try {
      const blob = await obterBlobImagem();
      const { jpeg, width, height } = await blobParaJpeg(blob);
      const pageWpt = mmParaPt(LARGURA_MM);
      const pageHpt = mmParaPt(LARGURA_MM * (height / width));
      const pdf = criarPdfComJpeg(jpeg, width, height, pageWpt, pageHpt);
      descarregar(pdf, `${NOME}.pdf`);
    } catch (err) {
      console.error('[Wallapop PDF]', err);
      try {
        const blob = await obterBlobImagem();
        await abrirImpressaoEtiqueta(blob);
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
