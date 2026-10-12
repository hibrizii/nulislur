// Utilitas Ekspor Dokumen Naskah (PDF & Word DOCX) dengan Preservasi Format Penuh & Footnote Akurat

interface ExportDocumentOptions {
  title: string;
  author: string;
  className?: string;
  date?: string;
  htmlContent: string;
}

export interface ExtractedFootnote {
  index: number;
  id: string;
  text: string;
}

/**
 * Membersihkan format HTML menjadi kutipan teks bersih tanpa entity &nbsp; atau spasi berulang
 */
export function cleanSnippet(html: string): string {
  if (!html) return 'Belum ada isi tulisan...';
  if (typeof document !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = temp.innerText || temp.textContent || '';
    const clean = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/[\u00a0\s]+/g, ' ')
      .trim();
    return clean || 'Belum ada isi tulisan...';
  }
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();
  return text || 'Belum ada isi tulisan...';
}

/**
 * Memformat dan menstandardisasi HTML naskah untuk diekspor ke Word (.doc) dan PDF:
 * 1. Menghapus tag mark feedback guru tapi mempertahankan isi teksnya.
 * 2. Mengubah list berurutan (<ol> / <li>) bertingkat menjadi nomor subbab eksplisit (1., 1.1, 1.1.1)
 *    dengan margin indentasi yang proporsional sehingga MS Word & PDF TIDAK AKAN PERNAH
 *    mereset nomor subbab kembali ke tingkat 1.
 * 3. Menstandardisasi data-indent="X" dan style marginLeft menjadi satuan pt eksplisit (18pt, 36pt, dst).
 * 4. Mengekstraksi seluruh footnote dan menyusunnya dalam format Word native mso-element:footnote
 *    sehingga Word otomatis menempatkan footnote pada halaman yang tepat di mana kutipan berada.
 */
export function prepareContentForExport(html: string): {
  cleanHtml: string;
  wordHtml: string;
  footnotes: ExtractedFootnote[];
} {
  if (!html) return { cleanHtml: '<p></p>', wordHtml: '<p></p>', footnotes: [] };
  // Hapus tag mark feedback tapi pertahankan teks aslinya
  const clean = html.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '$1');
  const footnotes: ExtractedFootnote[] = [];

  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = clean;

    // 1. Ratakan list <ol> bertingkat menjadi nomor subbab teks eksplisit (1., 1.1, 1.1.1)
    const processOrderedList = (olElement: HTMLElement, prefixArray: number[] = []) => {
      const directChildren = Array.from(olElement.children).filter(
        (c) => c.tagName.toLowerCase() === 'li'
      ) as HTMLElement[];

      const replacementNodes: HTMLElement[] = [];

      directChildren.forEach((li, idx) => {
        const currentNumbers = [...prefixArray, idx + 1];
        const depth = currentNumbers.length - 1; // 0 untuk level 1, 1 untuk level 2 (subbab), dst.
        const marginPt = depth * 18;
        const numString = currentNumbers.join('.') + (currentNumbers.length === 1 ? '. ' : ' ');

        // Ambil dan hapus sub-list <ol> di dalam <li> ini untuk diproses rekursif
        const childOls = Array.from(li.querySelectorAll(':scope > ol')) as HTMLElement[];
        childOls.forEach((cOl) => cOl.remove());

        const liInnerHtml = li.innerHTML.trim();

        // Buat paragraf pengganti dengan nomor eksplisit dan margin pas
        const p = document.createElement('p');
        p.style.marginLeft = `${marginPt}pt`;
        p.style.marginTop = '2pt';
        p.style.marginBottom = '6pt';
        p.style.lineHeight = '1.6';
        p.style.textAlign = 'justify';

        const strong = document.createElement('strong');
        strong.style.fontWeight = '700';
        strong.style.color = '#1c1917';
        strong.textContent = numString;
        p.appendChild(strong);

        const span = document.createElement('span');
        if (liInnerHtml.startsWith('<p>') && liInnerHtml.endsWith('</p>')) {
          span.innerHTML = liInnerHtml.slice(3, -4);
        } else {
          span.innerHTML = liInnerHtml;
        }
        p.appendChild(span);
        replacementNodes.push(p);

        // Proses sub-list <ol> di dalamnya
        childOls.forEach((childOl) => {
          const childReplacements = processOrderedList(childOl, currentNumbers);
          replacementNodes.push(...childReplacements);
        });
      });

      return replacementNodes;
    };

    // Cari seluruh <ol> terluar
    const topOls = Array.from(container.querySelectorAll('ol')).filter(
      (ol) => !ol.parentElement?.closest('ol')
    );

    topOls.forEach((topOl) => {
      const replacements = processOrderedList(topOl, []);
      replacements.forEach((rep) => {
        topOl.parentNode?.insertBefore(rep, topOl);
      });
      topOl.remove();
    });

    // 2. Standardisasi seluruh paragraf berindentasi hierarki (data-indent) dan indentasi gantung daftar pustaka
    const paragraphs = container.querySelectorAll('p');
    paragraphs.forEach((p) => {
      let indent = 0;
      const dataIndent = p.getAttribute('data-indent');
      if (dataIndent) {
        indent = parseInt(dataIndent, 10) || 0;
      } else if (p.style.marginLeft) {
        if (p.style.marginLeft.includes('rem')) {
          indent = Math.round(parseFloat(p.style.marginLeft) / 1.25);
        } else if (p.style.marginLeft.includes('px')) {
          indent = Math.round(parseFloat(p.style.marginLeft) / 20);
        } else if (p.style.marginLeft.includes('pt')) {
          indent = Math.round(parseFloat(p.style.marginLeft) / 18);
        }
      }

      const isHanging =
        p.getAttribute('data-hanging-indent') === 'true' ||
        p.classList.contains('nulis-hanging-indent') ||
        (p.style.textIndent && parseFloat(p.style.textIndent) < 0);

      if (isHanging) {
        p.style.marginLeft = `${(indent * 18) + 36}pt`;
        p.style.textIndent = '-36pt';
        p.style.paddingLeft = '0pt';
      } else if (indent > 0) {
        p.style.marginLeft = `${indent * 18}pt`;
        p.style.textIndent = '0pt';
      }
      p.style.marginTop = p.style.marginTop || '0pt';
      p.style.marginBottom = p.style.marginBottom || '8pt';
      p.style.lineHeight = p.style.lineHeight || '1.6';
      p.style.textAlign = p.style.textAlign || 'justify';
    });

    // 3. Ekstraksi Catatan Kaki (Footnotes)
    const fnRefs = container.querySelectorAll('.nulis-footnote-ref, [data-footnote-id]');
    fnRefs.forEach((node, idx) => {
      const fnNum = idx + 1;
      const fnId = node.getAttribute('data-footnote-id') || `fn${fnNum}`;
      const fnText =
        node.getAttribute('data-footnote-text') ||
        node.getAttribute('title') ||
        node.textContent?.replace(/[^\w\s.,;:()—'"]/g, '').trim() ||
        'Catatan kaki';
      footnotes.push({ index: fnNum, id: fnId, text: fnText });
    });

    // Buat versi PDF: ganti penanda footnote dengan angka superscript elegan polos
    const pdfContainer = container.cloneNode(true) as HTMLElement;
    const pdfFnRefs = pdfContainer.querySelectorAll('.nulis-footnote-ref, [data-footnote-id]');
    pdfFnRefs.forEach((node, idx) => {
      const fnNum = idx + 1;
      const sup = document.createElement('sup');
      sup.style.fontWeight = '600';
      sup.style.color = '#1c1917';
      sup.style.fontSize = '8pt';
      sup.textContent = `${fnNum}`;
      node.parentNode?.replaceChild(sup, node);
    });

    // Buat versi Word: ganti penanda footnote dengan standar native Word mso-element:footnote-ref
    const wordContainer = container.cloneNode(true) as HTMLElement;
    const wordFnRefs = wordContainer.querySelectorAll('.nulis-footnote-ref, [data-footnote-id]');
    wordFnRefs.forEach((node, idx) => {
      const fnNum = idx + 1;
      const fnId = `ftn${fnNum}`;
      const span = document.createElement('span');
      span.setAttribute('style', 'mso-element:footnote-ref');
      span.innerHTML = `<a style='mso-footnote-id:${fnId}' href='#_${fnId}' name='_ftnref${fnNum}' title=''><span class='MsoFootnoteReference'><sup>${fnNum}</sup></span></a>`;
      node.parentNode?.replaceChild(span, node);
    });

    // 4. Konversi pembatas lembar halaman (.nulis-page-break / hr[data-page-break] / div[data-page-break]) ke native PDF & Word break
    const pdfPageBreaks = pdfContainer.querySelectorAll('hr[data-page-break], div[data-page-break], .nulis-page-break');
    pdfPageBreaks.forEach((el) => {
      const div = document.createElement('div');
      div.setAttribute('style', 'page-break-after:always;break-after:page;height:0;line-height:0;margin:0;padding:0;');
      el.parentNode?.replaceChild(div, el);
    });

    const wordPageBreaks = wordContainer.querySelectorAll('hr[data-page-break], div[data-page-break], .nulis-page-break');
    wordPageBreaks.forEach((el) => {
      const br = document.createElement('br');
      br.setAttribute('clear', 'all');
      br.setAttribute('style', 'page-break-before:always; mso-break-type:section-break');
      el.parentNode?.replaceChild(br, el);
    });

    // 5. Preservasi dan standardisasi Daftar Isi (docToc) untuk PDF & Word
    const docTocs = container.querySelectorAll('.nulis-doc-toc, [data-doc-toc], .nulis-doc-toc-wrapper');
    docTocs.forEach((docTocEl) => {
      let headingRows: Array<{ level: number; text: string; page: string | number }> = [];
      const dataHeadingsAttr = docTocEl.getAttribute('data-headings');
      if (dataHeadingsAttr) {
        try {
          const parsed = JSON.parse(dataHeadingsAttr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            headingRows = parsed.map((h: any) => ({
              level: Number(h.level) || 1,
              text: String(h.text || ''),
              page: h.page || 1,
            }));
          }
        } catch {}
      }

      if (headingRows.length === 0) {
        const rowEls = docTocEl.querySelectorAll('.nulis-doc-toc-row');
        if (rowEls.length > 0) {
          rowEls.forEach((r) => {
            const level = Number(r.getAttribute('data-level')) || 1;
            const textEl = r.querySelector('.nulis-doc-toc-text') || r.firstElementChild;
            const numEl = r.querySelector('.nulis-doc-toc-num') || r.lastElementChild;
            const text = textEl?.textContent?.trim() || '';
            const page = numEl?.textContent?.trim() || '1';
            if (text) headingRows.push({ level, text, page });
          });
        }
      }

      if (headingRows.length === 0) {
        const headings = container.querySelectorAll('h1, h2, h3');
        headings.forEach((h) => {
          const level = h.tagName.toLowerCase() === 'h1' ? 1 : h.tagName.toLowerCase() === 'h2' ? 2 : 3;
          const text = h.textContent?.trim() || '';
          if (text) {
            headingRows.push({ level, text, page: 1 });
          }
        });
      }

      // Bangun elemen HTML bersih untuk PDF
      const pdfToc = document.createElement('div');
      pdfToc.className = 'nulis-doc-toc';
      pdfToc.setAttribute('style', 'margin: 16pt 0 24pt 0;');
      pdfToc.innerHTML = `
        <div class="nulis-doc-toc-title" style="text-align: center; font-size: 14pt; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; padding-bottom: 6pt; margin-bottom: 14pt; border-bottom: 1.5pt solid #1c1917;">
          DAFTAR ISI
        </div>
        <div class="nulis-doc-toc-content">
          ${headingRows
            .map((h) => {
              const indent = (h.level - 1) * 16;
              const bold = h.level === 1 ? 'font-weight: 700;' : 'font-weight: 400;';
              return `
              <div class="nulis-doc-toc-row level-${h.level}" data-level="${h.level}" style="display: flex; align-items: baseline; justify-content: space-between; padding: 2.5pt 0; padding-left: ${indent}pt; ${bold} font-size: 10.5pt;">
                <span class="nulis-doc-toc-text" style="flex-shrink: 1; padding-right: 6pt;">${h.text}</span>
                <span class="nulis-doc-toc-dots" style="flex: 1; border-bottom: 1.5pt dotted #777777; margin: 0 4pt; min-width: 20pt;"></span>
                <span class="nulis-doc-toc-num" style="flex-shrink: 0; text-align: right; min-width: 16pt;">${h.page}</span>
              </div>
            `;
            })
            .join('')}
        </div>
      `;

      // Bangun format native Microsoft Word Table of Contents (MsoToc), bukan tabel!
      const wordToc = document.createElement('div');
      wordToc.className = 'nulis-doc-toc-word';
      wordToc.setAttribute('style', 'margin-top: 16pt; margin-bottom: 24pt;');
      wordToc.innerHTML = `
        <p class="MsoTocTitle" style="text-align: center; font-family: 'Times New Roman', serif; font-size: 14pt; font-weight: bold; letter-spacing: 2pt; margin-top: 12pt; margin-bottom: 16pt; border-bottom: 1.5pt solid #000000; padding-bottom: 4pt;">
          <b>DAFTAR ISI</b>
        </p>
        <!--[if supportFields]>
        <span style='mso-element:field-begin'></span>
        TOC \\o "1-3" \\h \\z \\u
        <span style='mso-element:field-separator'></span>
        <![endif]-->
        ${headingRows
          .map((h) => {
            const levelClass = h.level === 1 ? 'MsoToc1' : h.level === 2 ? 'MsoToc2' : 'MsoToc3';
            const indentPt = (h.level - 1) * 18;
            const boldStyle = h.level === 1 ? 'font-weight: bold;' : 'font-weight: normal;';
            return `
            <p class="${levelClass}" style="margin-top: 3pt; margin-bottom: 3pt; margin-left: ${indentPt}pt; font-family: 'Times New Roman', serif; font-size: 11pt; ${boldStyle} tab-stops: right dotted 453.6pt;">
              <span style="mso-fareast-font-family: 'Times New Roman'">${h.text}</span>
              <span style="mso-tab-count: 1">&#9;</span>
              <!--[if supportFields]><span style='mso-element:field-begin'></span> PAGEREF _Toc_${h.page} <span style='mso-element:field-separator'></span><![endif]-->
              <span style="mso-no-proof: yes">${h.page}</span>
              <!--[if supportFields]><span style='mso-element:field-end'></span><![endif]-->
            </p>
            `;
          })
          .join('')}
        <!--[if supportFields]>
        <span style='mso-element:field-end'></span>
        <![endif]-->
      `;

      const targetPdfEl = pdfContainer.querySelector('.nulis-doc-toc, [data-doc-toc], .nulis-doc-toc-wrapper');
      if (targetPdfEl) {
        targetPdfEl.parentNode?.replaceChild(pdfToc, targetPdfEl);
      }
      const targetWordEl = wordContainer.querySelector('.nulis-doc-toc, [data-doc-toc], .nulis-doc-toc-wrapper');
      if (targetWordEl) {
        targetWordEl.parentNode?.replaceChild(wordToc, targetWordEl);
      }
    });

    return {
      cleanHtml: pdfContainer.innerHTML,
      wordHtml: wordContainer.innerHTML,
      footnotes,
    };
  }

  return { cleanHtml: clean, wordHtml: clean, footnotes: [] };
}

export function formatContentForExport(html: string): string {
  return prepareContentForExport(html).cleanHtml;
}

function normalizeOptions(
  arg1: ExportDocumentOptions | string,
  arg2?: string,
  arg3?: string,
  arg4?: string
): ExportDocumentOptions {
  if (typeof arg1 === 'string') {
    return {
      title: arg1,
      author: arg2 || 'Penulis',
      htmlContent: arg3 || '',
      className: arg4,
    };
  }
  return arg1;
}

/**
 * Ekspor ke PDF dengan tata letak halaman standar A4 multi-halaman & Catatan Kaki Akurat
 */
export function exportToPdf(
  optionsOrTitle: ExportDocumentOptions | string,
  author?: string,
  htmlContent?: string,
  className?: string
) {
  const options = normalizeOptions(optionsOrTitle, author, htmlContent, className);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Harap izinkan popup di peramban untuk membuka pratinjau cetak / simpan PDF.');
    return;
  }

  const { cleanHtml, footnotes } = prepareContentForExport(options.htmlContent);
  const docTitle = options.title || 'Naskah Tulisan';

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..800;1,8..60,400..800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 25mm 20mm 25mm 20mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: 'Source Serif 4', 'Lora', Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.75;
      color: #1c1917;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-variant-numeric: lining-nums proportional-nums;
      -webkit-font-feature-settings: "lnum" 1, "pnum" 1;
      font-feature-settings: "lnum" 1, "pnum" 1;
    }
    .page-header {
      border-bottom: 2px solid #1c1917;
      padding-bottom: 12pt;
      margin-bottom: 22pt;
      page-break-after: avoid;
      break-after: avoid;
    }
    .doc-title {
      font-size: 22pt;
      font-weight: 700;
      line-height: 1.25;
      color: #0c0a09;
      margin: 0 0 10pt 0;
    }
    .doc-meta {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 9.5pt;
      color: #57534e;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .content h1 {
      font-size: 16pt;
      font-weight: 700;
      line-height: 1.3;
      margin-top: 18pt;
      margin-bottom: 6pt;
      color: #1c1917;
      page-break-after: avoid;
      break-after: avoid;
    }
    .content h2 {
      font-size: 13.5pt;
      font-weight: 700;
      line-height: 1.35;
      margin-top: 14pt;
      margin-bottom: 5pt;
      color: #292524;
      page-break-after: avoid;
      break-after: avoid;
    }
    .content h3 {
      font-size: 12pt;
      font-weight: 600;
      line-height: 1.4;
      margin-top: 12pt;
      margin-bottom: 4pt;
      color: #44403c;
      page-break-after: avoid;
      break-after: avoid;
    }
    .content p {
      margin-top: 0;
      margin-bottom: 8pt;
      line-height: 1.75;
      text-align: justify;
    }
    .content blockquote {
      border-left: 3pt solid #b45309;
      background-color: #fffbeb;
      padding: 8pt 14pt;
      margin: 12pt 0;
      font-style: italic;
      color: #78350f;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .content ul, .content ol {
      margin-top: 0;
      margin-bottom: 8pt;
      padding-left: 20pt;
    }
    .content li {
      margin-bottom: 3.5pt;
      line-height: 1.65;
    }
    .content hr {
      border: none;
      border-top: 1px solid #d6d3d1;
      margin: 18pt 0;
    }
    .content table {
      border-collapse: collapse;
      width: 100%;
      margin: 14pt 0;
      page-break-inside: auto;
      break-inside: auto;
      font-size: 10pt;
      border: 1pt solid #1c1917;
    }
    .content tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .content thead {
      display: table-header-group;
    }
    .content th, .content td {
      border: 1pt solid #1c1917;
      padding: 6pt 8pt;
      text-align: left;
      vertical-align: top;
    }
    .content th {
      background-color: transparent;
      font-weight: 700;
      border: 1pt solid #1c1917;
      color: #1c1917;
    }
    .content table p {
      margin: 0 !important;
      line-height: 1.4 !important;
      text-align: left !important;
    }

    /* Daftar Isi (Table of Contents) PDF */
    .nulis-doc-toc {
      margin: 18pt 0 24pt 0;
      page-break-after: avoid;
    }
    .nulis-doc-toc-title {
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding-bottom: 6pt;
      margin-bottom: 14pt;
      border-bottom: 1.5pt solid #1c1917;
      color: #1c1917;
    }
    .nulis-doc-toc-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: 3pt 0;
      font-size: 10.5pt;
    }
    .nulis-doc-toc-row.level-1 {
      font-weight: 700;
      padding-left: 0;
    }
    .nulis-doc-toc-row.level-2 {
      font-weight: 500;
      padding-left: 16pt;
    }
    .nulis-doc-toc-row.level-3 {
      font-weight: 400;
      padding-left: 32pt;
    }
    .nulis-doc-toc-text {
      flex-shrink: 1;
      padding-right: 6pt;
    }
    .nulis-doc-toc-dots {
      flex: 1;
      border-bottom: 1.5pt dotted #78716c;
      margin: 0 4pt;
      min-width: 20pt;
    }
    .nulis-doc-toc-num {
      flex-shrink: 0;
      text-align: right;
      min-width: 16pt;
      font-weight: 600;
    }

    /* Catatan Kaki (Footnotes) PDF */
    .pdf-footnotes-container {
      margin-top: 36pt;
      padding-top: 12pt;
      border-top: 1.5pt solid #1c1917;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pdf-footnotes-title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #78716c;
      margin-bottom: 8pt;
    }
    .pdf-footnote-item {
      font-size: 9pt;
      line-height: 1.55;
      color: #292524;
      margin-bottom: 4.5pt;
      display: flex;
      align-items: flex-start;
      gap: 6pt;
    }
    .pdf-footnote-index {
      font-weight: 700;
      color: #b45309;
      font-size: 9pt;
      flex-shrink: 0;
    }
    .pdf-footnote-text {
      flex: 1;
      text-align: justify;
    }

    .page-footer {
      margin-top: 36pt;
      padding-top: 8pt;
      border-top: 1px solid #e7e5e4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 8.5pt;
      color: #a8a29e;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1 class="doc-title">${docTitle}</h1>
    <div class="doc-meta">
      <span>Penulis: <strong>${options.author}</strong> ${options.className ? `(${options.className})` : ''}</span>
      <span>${options.date || new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </div>
  </div>

  <div class="content">
    ${cleanHtml}
  </div>

  ${footnotes.length > 0 ? `
    <div class="pdf-footnotes-container">
      <div class="pdf-footnotes-title">Catatan Kaki (Footnotes)</div>
      ${footnotes.map((fn) => `
        <div class="pdf-footnote-item">
          <span class="pdf-footnote-index">[${fn.index}]</span>
          <span class="pdf-footnote-text">${fn.text}</span>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <div class="page-footer">
    <span>NulisLur</span>
    <span>Dokumen Naskah</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Ekspor ke file Microsoft Word (.doc) berformat lengkap dengan Catatan Kaki Native MS Word (mso-element:footnote)
 * Format ini secara otomatis menempatkan setiap catatan kaki pada dasar halaman yang tepat tempat kutipan berada!
 */
export function exportToWord(
  optionsOrTitle: ExportDocumentOptions | string,
  author?: string,
  htmlContent?: string,
  className?: string
) {
  const options = normalizeOptions(optionsOrTitle, author, htmlContent, className);
  const { wordHtml, footnotes } = prepareContentForExport(options.htmlContent);
  const cleanFilename = (options.title || 'naskah')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  const fileContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${options.title || 'Naskah'}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
      <w:FootnoteProperties>
        <w:FootnotePosition>BeneathText</w:FootnotePosition>
        <w:FootnoteNumberFormat>Arabic</w:FootnoteNumberFormat>
      </w:FootnoteProperties>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 595.3pt 841.9pt; /* A4 */
      margin: 70.85pt 70.85pt 70.85pt 70.85pt;
      mso-header-margin: 35.4pt;
      mso-footer-margin: 35.4pt;
      mso-footer: f1;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #111111;
    }
    p.MsoFooter {
      margin: 0pt;
      font-size: 10pt;
      font-family: 'Times New Roman', serif;
      text-align: right;
      color: #777777;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #000000;
      margin-top: 0;
      margin-bottom: 6pt;
    }
    h2 {
      font-size: 15pt;
      font-weight: bold;
      margin-top: 14pt;
      margin-bottom: 5pt;
    }
    h3 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 12pt;
      margin-bottom: 4pt;
    }
    .meta {
      font-family: Arial, sans-serif;
      font-size: 9.5pt;
      color: #666666;
      margin-bottom: 18pt;
      border-bottom: 1pt solid #cccccc;
      padding-bottom: 8pt;
    }
    p {
      margin-top: 0;
      margin-bottom: 8pt;
      line-height: 1.5;
      text-align: justify;
    }
    p[data-indent="1"], .indent-1 {
      margin-left: 18pt !important;
    }
    p[data-indent="2"], .indent-2 {
      margin-left: 36pt !important;
    }
    p[data-indent="3"], .indent-3 {
      margin-left: 54pt !important;
    }
    p[data-indent="4"], .indent-4 {
      margin-left: 72pt !important;
    }
    blockquote {
      margin-left: 20pt;
      margin-right: 20pt;
      font-style: italic;
      color: #444444;
      border-left: 3pt solid #888888;
      padding-left: 8pt;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 8pt;
    }
    li {
      margin-bottom: 3pt;
    }
    hr {
      border: none;
      border-top: 1pt solid #cccccc;
      margin: 14pt 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 10pt;
      margin-bottom: 14pt;
      border: 1pt solid #000000;
      page-break-inside: auto;
      mso-padding-alt: 0pt 5.4pt 0pt 5.4pt;
    }
    tr {
      page-break-inside: avoid;
      mso-cant-split: true;
    }
    th, td {
      border: 1pt solid #000000;
      padding: 6pt 8pt;
      text-align: left;
      vertical-align: top;
      font-size: 10pt;
    }
    th {
      background-color: transparent;
      font-weight: bold;
      border: 1pt solid #000000;
    }

    /* MSO Footnote Styles */
    p.MsoFootnoteText, li.MsoFootnoteText, div.MsoFootnoteText {
      margin-top: 0;
      margin-bottom: 3pt;
      font-size: 10pt;
      font-family: 'Times New Roman', serif;
      line-height: 1.4;
      text-align: justify;
    }
    span.MsoFootnoteReference {
      vertical-align: super;
      font-size: 9pt;
      font-weight: bold;
    }

    /* Native Microsoft Word Table of Contents (MsoToc) Styles */
    p.MsoTocTitle {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      letter-spacing: 2pt;
      margin-top: 12pt;
      margin-bottom: 16pt;
      border-bottom: 1.5pt solid #000000;
      padding-bottom: 4pt;
    }
    p.MsoToc1, li.MsoToc1, div.MsoToc1 {
      margin-top: 4pt;
      margin-bottom: 2pt;
      font-size: 11pt;
      font-family: 'Times New Roman', serif;
      font-weight: bold;
      tab-stops: right dotted 453.6pt;
    }
    p.MsoToc2, li.MsoToc2, div.MsoToc2 {
      margin-top: 2pt;
      margin-bottom: 2pt;
      margin-left: 18pt;
      font-size: 10.5pt;
      font-family: 'Times New Roman', serif;
      font-weight: normal;
      tab-stops: right dotted 453.6pt;
    }
    p.MsoToc3, li.MsoToc3, div.MsoToc3 {
      margin-top: 2pt;
      margin-bottom: 2pt;
      margin-left: 36pt;
      font-size: 10pt;
      font-family: 'Times New Roman', serif;
      font-weight: normal;
      tab-stops: right dotted 453.6pt;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <h1>${options.title || 'Tanpa Judul'}</h1>
    <div class="meta">
      Penulis: <strong>${options.author}</strong> ${options.className ? `(${options.className})` : ''} | Tanggal: ${options.date || new Date().toLocaleDateString('id-ID')} | NulisLur
    </div>
    ${wordHtml}

    ${footnotes.length > 0 ? `
      <!-- Microsoft Word Native Footnote Block: Word otomatis menautkannya ke dasar halaman yang relevan -->
      <div style='mso-element:footnote-list'>
        ${footnotes.map((fn) => `
          <div style='mso-element:footnote' id='ftn${fn.index}'>
            <p class='MsoFootnoteText'>
              <a style='mso-footnote-id:ftn${fn.index}' href='#_ftnref${fn.index}' name='_ftn${fn.index}' title=''><span class='MsoFootnoteReference'><b>[${fn.index}]</b></span></a>
              &nbsp;${fn.text}
            </p>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Footer Nomor Halaman Otomatis MS Word (angka saja) -->
    <div style='mso-element:footer' id='f1'>
      <p class='MsoFooter'>
        <span style='mso-field-code:" PAGE "'></span>
      </p>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob(['\ufeff' + fileContent], {
    type: 'application/msword;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cleanFilename || 'naskah'}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
