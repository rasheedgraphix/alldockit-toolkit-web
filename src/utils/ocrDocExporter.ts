import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Preprocess image on canvas to boost OCR accuracy for scanned book pages,
 * photos with shadows, faint ink, or yellowed pages.
 */
export async function preprocessImageForOcr(
  imageSource: string | HTMLImageElement | HTMLCanvasElement,
  options: {
    grayscale?: boolean;
    contrast?: number; // -100 to 100
    brightness?: number; // -100 to 100
    binarize?: boolean; // black & white thresholding
    threshold?: number; // 0 to 255
  } = {}
): Promise<string> {
  const {
    grayscale = true,
    contrast = 30,
    brightness = 10,
    binarize = false,
    threshold = 128,
  } = options;

  let img: HTMLImageElement;
  if (typeof imageSource === 'string') {
    img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = (e) => reject(e);
      el.src = imageSource;
    });
  } else if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else {
    // Canvas element
    return imageSource.toDataURL('image/png');
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return typeof imageSource === 'string' ? imageSource : img.src;

  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Factor for contrast
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness
    r += brightness;
    g += brightness;
    b += brightness;

    // Contrast
    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    // Grayscale
    if (grayscale || binarize) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      if (binarize) {
        const bw = gray >= threshold ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      } else {
        data[i] = Math.min(255, Math.max(0, gray));
        data[i + 1] = Math.min(255, Math.max(0, gray));
        data[i + 2] = Math.min(255, Math.max(0, gray));
      }
    } else {
      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Generate Microsoft Word (.docx) File Blob
 */
export async function exportToDocx(
  text: string,
  docTitle: string = 'Scanned Document'
): Promise<Blob> {
  const paragraphs: Paragraph[] = [];

  // Title heading
  paragraphs.push(
    new Paragraph({
      text: docTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // Split content by double newlines or single newlines
  const rawParagraphs = text.split(/\n\s*\n/);

  for (const p of rawParagraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    // Check if it looks like a subheader (# Header or short uppercase line)
    if (trimmed.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace(/^#\s*/, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace(/^##\s*/, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 100 },
        })
      );
    } else {
      // Regular paragraph
      const lines = trimmed.split('\n');
      const textRuns: TextRun[] = [];

      lines.forEach((line, idx) => {
        textRuns.push(new TextRun({ text: line, size: 24 }));
        if (idx < lines.length - 1) {
          textRuns.push(new TextRun({ break: 1 }));
        }
      });

      paragraphs.push(
        new Paragraph({
          children: textRuns,
          spacing: { after: 160, line: 276 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Export to Rich Text Format (.rtf)
 */
export function exportToRtf(text: string, docTitle: string = 'Scanned Document'): Blob {
  const cleanText = text
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\par\n');

  const rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}}
{\\colortbl;\\red0\\green0\\blue0;\\red30\\green41\\blue59;}
\\viewkind4\\uc1\\pard\\cf2\\lang1033\\f0\\fs32\\b ${docTitle}\\b0\\par\\fs22\\par
${cleanText}
}`;

  return new Blob([rtfContent], { type: 'application/rtf;charset=utf-8' });
}

/**
 * Export to Clean Markdown (.md)
 */
export function exportToMarkdown(text: string, docTitle: string = 'Scanned Document'): Blob {
  const content = `# ${docTitle}\n\n*Extracted via AllDocKit OCR Studio*\n\n---\n\n${text}\n`;
  return new Blob([content], { type: 'text/markdown;charset=utf-8' });
}

/**
 * Export to Clean HTML (.html)
 */
export function exportToHtml(text: string, docTitle: string = 'Scanned Document'): Blob {
  const formattedBody = text
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin-bottom: 1rem; line-height: 1.7;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      color: #1e293b;
      background: #f8fafc;
    }
    .paper {
      background: white;
      padding: 48px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    h1 { color: #0f172a; margin-top: 0; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      background: #e0e7ff;
      color: #3730a3;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="paper">
    <span class="badge">AllDocKit Extracted Document</span>
    <h1>${docTitle}</h1>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;"/>
    <div>
      ${formattedBody}
    </div>
  </div>
</body>
</html>`;

  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

/**
 * Export to Formatted PDF using pdf-lib
 */
export async function exportToPdf(text: string, docTitle: string = 'Scanned Document'): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 11;
  const lineHeight = 16;
  const margin = 50;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89; // A4
  const maxLineWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  page.drawText(docTitle, {
    x: margin,
    y: y,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.15),
  });
  y -= 30;

  // Subtitle
  page.drawText('Extracted and formatted with AllDocKit Toolkit', {
    x: margin,
    y: y,
    size: 9,
    font: font,
    color: rgb(0.4, 0.45, 0.5),
  });
  y -= 25;

  // Horizontal separator line
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: pageWidth - margin, y: y },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });
  y -= 20;

  // Helper word wrapper
  const lines: string[] = [];
  const rawParagraphs = text.split('\n');

  for (const rawP of rawParagraphs) {
    if (!rawP.trim()) {
      lines.push(''); // Empty paragraph spacer
      continue;
    }

    const words = rawP.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (textWidth <= maxLineWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  // Draw lines with pagination
  for (const line of lines) {
    if (y < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    if (line === '') {
      y -= lineHeight * 0.8;
      continue;
    }

    page.drawText(line, {
      x: margin,
      y: y,
      size: fontSize,
      font: font,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Text-to-Speech playback helper
 */
export function playTextToSpeech(
  text: string,
  rate: number = 1.0,
  pitch: number = 1.0,
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return null;
  }

  window.speechSynthesis.cancel(); // Stop any active speech

  const clean = text.trim();
  if (!clean) return null;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = rate;
  utterance.pitch = pitch;

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopTextToSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Intelligent Book OCR Text Cleaner & De-Noiser
 * Eliminates stray border/frame symbols, fixes line breaks, and retains real text (Urdu, Arabic, English).
 */
export function cleanBookOcrText(rawText: string): string {
  if (!rawText) return '';

  const lines = rawText.split('\n');
  const cleanedLines: string[] = [];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) {
      cleanedLines.push('');
      continue;
    }

    // Keep Page Header lines
    if (trimmed.startsWith('=== [ Page') && trimmed.endsWith('] ===')) {
      cleanedLines.push('\n' + trimmed + '\n');
      continue;
    }

    // Check if line is purely noise from ornate decorative borders (e.g. "8 9", "0 7", "02 > 7 1", "٠. ٠. 7 3", "00,,7")
    const words = trimmed.split(/\s+/);
    const alphaOrArabicChars = trimmed.replace(/[\d\s.,;:!?_|\-~`'"()[\]{}<>+=/*\\^%$#@!&]/g, '');

    // If line has fewer than 2 meaningful letters and is mostly numbers/symbols, filter it out as border noise
    if (alphaOrArabicChars.length < 2 && words.length <= 4 && !/^(باب|فصل|مفرد|مرکب|درس|سبق|\d+)/i.test(trimmed)) {
      continue;
    }

    // Clean up excessive repeated symbols (e.g., "________", "........")
    trimmed = trimmed.replace(/_{4,}/g, ' _____ ');
    trimmed = trimmed.replace(/\.{4,}/g, ' ... ');
    trimmed = trimmed.replace(/\s{2,}/g, ' ');

    cleanedLines.push(trimmed);
  }

  return cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
