// ==UserScript==
// @name         Wallapop etiqueta - PDF
// @namespace    figuresplanet
// @version      3.1
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
    const chunks = [];
    let size = 0;
    const offsets = [];

    function addText(text) {
      offsets.push(size);
      const bytes = enc.encode(text);
      chunks.push(bytes);
      size += bytes.length;
    }

    function addBytes(bytes) {
      offsets.push(size);
      chunks.push(bytes);
      size += bytes.length;
    }

    addText('%PDF-1.4\n');

    addText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    addText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    addText(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWpt.toFixed(2)} ${pageHpt.toFixed(2)}] ` +
        '/Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n'
    );
    addText(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    addBytes(jpeg);
    addText('\nendstream\nendobj\n');

    const content = `q ${pageWpt.toFixed(2)} 0 0 ${pageHpt.toFixed(2)} 0 0 cm /Im1 Do Q\n`;
    addText(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    const xrefPos = size;
    addText(`xref\n0 6\n0000000000 65535 f \n`);
    for (let i = 1; i <= 5; i++) {
      addText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    }
    addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

    return new Blob(chunks, { type: 'application/pdf' });
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
      alert('Não foi possível criar o PDF. Tenta recarregar a página (F5).');
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
