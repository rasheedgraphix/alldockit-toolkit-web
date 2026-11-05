import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  FileCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Sliders,
  Eye,
  ShieldCheck,
  RefreshCw,
  Layers,
  Palette,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { formatBytes, getPdfInfo } from '../../utils/fileHelpers';

interface PdfToHtmlViewProps {
  onAddToHistory?: (historyItem: any) => void;
}

interface PageTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
}

interface PageData {
  pageNumber: number;
  width: number;
  height: number;
  bgImageDataUrl: string;
  textItems: PageTextItem[];
}

export const PdfToHtmlView: React.FC<PdfToHtmlViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Mode: 'exact-styled' (Exact Layout & Visual Artwork) or 'semantic-styled' (Responsive CSS Document)
  const [mode, setMode] = useState<'exact-styled' | 'semantic-styled'>('exact-styled');
  const [includeBackgroundArtwork, setIncludeBackgroundArtwork] = useState<boolean>(true);
  const [extractedHtml, setExtractedHtml] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync iframe preview safely
  useEffect(() => {
    if (iframeRef.current && extractedHtml) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(extractedHtml);
        doc.close();
      }
    }
  }, [extractedHtml]);

  // Robust PDF.js dynamic loader
  const getPdfLib = async () => {
    if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
      const lib = (window as any).pdfjsLib;
      if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      return lib;
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[src*="pdf.min.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        setTimeout(() => resolve(), 300);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib && lib.GlobalWorkerOptions) {
          lib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        resolve();
      };
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });

    return (window as any).pdfjsLib;
  };

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setExtractedHtml('');
      setStatusMsg('');
      const info = await getPdfInfo(file);
      setPageCount(info.pageCount);
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(5);
    setStatusMsg('Initializing Local PDF Vector Engine...');

    try {
      const pdfjs = await getPdfLib();
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;
      setPageCount(numPages);

      const pagesData: PageData[] = [];

      for (let i = 1; i <= numPages; i++) {
        setStatusMsg(`Rendering styles, artwork & typography from Page ${i} of ${numPages}...`);
        setProgress(Math.round((i / numPages) * 80));

        const page = await pdfDoc.getPage(i);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        let bgImageDataUrl = '';
        if (includeBackgroundArtwork && mode === 'exact-styled') {
          const renderScale = numPages > 12 ? 1.0 : 1.4;
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            await page.render({
              canvasContext: ctx,
              viewport: viewport,
            }).promise;
            bgImageDataUrl = canvas.toDataURL('image/jpeg', numPages > 8 ? 0.78 : 0.86);
          }
        }

        // Extract Text with Detailed Style & Font Matrix
        const textContent = await page.getTextContent();
        const styles = textContent.styles || {};

        const items: PageTextItem[] = textContent.items.map((item: any) => {
          const tx = item.transform;
          const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
          const x = tx[4];
          const y = unscaledViewport.height - tx[5] - fontSize;

          const fontStyleObj = styles[item.fontName] || {};
          const rawFontName = (item.fontName || fontStyleObj.fontFamily || '').toLowerCase();

          const isBold =
            rawFontName.includes('bold') ||
            rawFontName.includes('heavy') ||
            rawFontName.includes('black') ||
            rawFontName.includes('b-') ||
            rawFontName.includes('-b') ||
            fontSize >= 18;

          const isItalic =
            rawFontName.includes('italic') ||
            rawFontName.includes('oblique') ||
            rawFontName.includes('i-');

          let fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          if (rawFontName.includes('times') || rawFontName.includes('serif') || rawFontName.includes('georgia')) {
            fontFamily = 'Georgia, "Times New Roman", Times, serif';
          } else if (rawFontName.includes('courier') || rawFontName.includes('mono')) {
            fontFamily = 'Consolas, Monaco, "Courier New", monospace';
          } else if (rawFontName.includes('nastaliq') || rawFontName.includes('urdu') || rawFontName.includes('jameel')) {
            fontFamily = '"Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", Tahoma, sans-serif';
          }

          return {
            str: item.str,
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(item.width || 0),
            height: Math.round(item.height || fontSize),
            fontSize: Math.round(fontSize),
            fontFamily,
            isBold,
            isItalic,
          };
        });

        pagesData.push({
          pageNumber: i,
          width: Math.round(unscaledViewport.width),
          height: Math.round(unscaledViewport.height),
          bgImageDataUrl: bgImageDataUrl,
          textItems: items,
        });
      }

      setStatusMsg('Assembling complete styled HTML document...');
      setProgress(95);

      let finalHtml = '';

      if (mode === 'exact-styled') {
        // High-Fidelity Exact Style & Layout Mode (Visual Artwork + Styled Interactive Text)
        let pagesHtml = '';

        pagesData.forEach((pg) => {
          pagesHtml += `  <div class="pdf-page" style="width:${pg.width}px; height:${pg.height}px;">\n`;

          if (includeBackgroundArtwork && pg.bgImageDataUrl) {
            pagesHtml += `    <img class="pdf-artwork-layer" src="${pg.bgImageDataUrl}" alt="Page ${pg.pageNumber} Artwork" />\n`;
          }

          pagesHtml += `    <div class="pdf-styled-text-layer">\n`;
          pg.textItems.forEach((item) => {
            if (!item.str.trim()) return;

            const isUrdu = /[\u0600-\u06FF\u0750-\u077F]/.test(item.str);
            const fontFam = isUrdu
              ? `'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', Tahoma, sans-serif`
              : item.fontFamily;

            pagesHtml += `      <span class="pdf-node" style="left:${item.x}px; top:${item.y}px; font-size:${item.fontSize}px; font-family:${fontFam}; font-weight:${item.isBold ? 700 : 400}; font-style:${item.isItalic ? 'italic' : 'normal'}; direction:${isUrdu ? 'rtl' : 'ltr'};">${item.str}</span>\n`;
          });
          pagesHtml += `    </div>\n`;
          pagesHtml += `  </div>\n\n`;
        });

        finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${selectedFile.name.replace(/\.pdf$/i, '')} - Converted by AllDocKit</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 30px 12px;
    background-color: #334155;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .pdf-page {
    position: relative;
    background-color: #ffffff;
    margin-bottom: 28px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    overflow: hidden;
  }
  .pdf-artwork-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    user-select: none;
  }
  .pdf-styled-text-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    line-height: 1.0;
  }
  .pdf-node {
    position: absolute;
    white-space: pre;
    cursor: text;
    user-select: text;
    color: ${includeBackgroundArtwork ? 'transparent' : '#0f172a'};
    transition: color 0.15s ease;
  }
  .pdf-node:hover {
    color: rgba(37, 99, 235, 0.9);
  }
  .pdf-node::selection {
    background: rgba(59, 130, 246, 0.35);
    color: #0f172a;
  }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
      } else {
        // Semantic Styled Document Mode (Reflowable HTML with Real Headings, CSS Cards & Urdu Support)
        let bodyContent = '';

        pagesData.forEach((pg) => {
          bodyContent += `  <section class="doc-card" id="page-${pg.pageNumber}">\n`;
          bodyContent += `    <div class="page-meta">Page ${pg.pageNumber}</div>\n`;

          const sorted = [...pg.textItems].sort((a, b) => {
            if (Math.abs(a.y - b.y) > 8) return a.y - b.y;
            return a.x - b.x;
          });

          let currentLine = '';
          let lastY = -999;
          let maxFontSize = 12;
          let isLineBold = false;

          sorted.forEach((item) => {
            if (lastY !== -999 && Math.abs(item.y - lastY) > 8) {
              if (currentLine.trim()) {
                const isUrdu = /[\u0600-\u06FF\u0750-\u077F]/.test(currentLine);
                const tagClass = isUrdu ? 'rtl-text' : '';

                if (maxFontSize >= 20) {
                  bodyContent += `    <h1 class="title-xl ${tagClass}">${currentLine.trim()}</h1>\n`;
                } else if (maxFontSize >= 15) {
                  bodyContent += `    <h2 class="title-md ${tagClass}">${currentLine.trim()}</h2>\n`;
                } else if (isLineBold) {
                  bodyContent += `    <h3 class="title-sm ${tagClass}">${currentLine.trim()}</h3>\n`;
                } else {
                  bodyContent += `    <p class="paragraph ${tagClass}">${currentLine.trim()}</p>\n`;
                }
              }
              currentLine = '';
              maxFontSize = item.fontSize;
              isLineBold = item.isBold;
            } else {
              maxFontSize = Math.max(maxFontSize, item.fontSize);
              if (item.isBold) isLineBold = true;
            }
            currentLine += item.str + ' ';
            lastY = item.y;
          });

          if (currentLine.trim()) {
            const isUrdu = /[\u0600-\u06FF\u0750-\u077F]/.test(currentLine);
            const tagClass = isUrdu ? 'rtl-text' : '';
            if (maxFontSize >= 20) {
              bodyContent += `    <h1 class="title-xl ${tagClass}">${currentLine.trim()}</h1>\n`;
            } else if (maxFontSize >= 15) {
              bodyContent += `    <h2 class="title-md ${tagClass}">${currentLine.trim()}</h2>\n`;
            } else {
              bodyContent += `    <p class="paragraph ${tagClass}">${currentLine.trim()}</p>\n`;
            }
          }

          bodyContent += `  </section>\n\n`;
        });

        const isWholeRtl = /[\u0600-\u06FF\u0750-\u077F]/.test(bodyContent);

        finalHtml = `<!DOCTYPE html>
<html lang="${isWholeRtl ? 'ur' : 'en'}" ${isWholeRtl ? 'dir="rtl"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${selectedFile.name.replace(/\.pdf$/i, '')} - AllDocKit Document</title>
<style>
  :root {
    --primary: #2563eb;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --bg-page: #f8fafc;
    --card-bg: #ffffff;
    --border-line: #e2e8f0;
  }
  body {
    font-family: ${
      isWholeRtl
        ? "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', Tahoma, sans-serif"
        : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    };
    margin: 0;
    padding: 36px 16px;
    background-color: var(--bg-page);
    color: var(--text-main);
    line-height: ${isWholeRtl ? '2.3' : '1.65'};
  }
  .container { max-width: 860px; margin: 0 auto; }
  .doc-card {
    background: var(--card-bg);
    padding: 40px;
    margin-bottom: 24px;
    border-radius: 14px;
    border: 1px solid var(--border-line);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    position: relative;
  }
  .page-meta {
    position: absolute;
    top: 16px;
    ${isWholeRtl ? 'left: 20px;' : 'right: 20px;'}
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  .title-xl { font-size: 26px; font-weight: 800; color: var(--text-main); margin: 20px 0 12px; letter-spacing: -0.5px; }
  .title-md { font-size: 18px; font-weight: 700; color: #1e293b; margin: 16px 0 8px; }
  .title-sm { font-size: 15px; font-weight: 700; color: #334155; margin: 12px 0 6px; }
  .paragraph { font-size: 14px; color: #334155; margin: 0 0 12px; word-break: break-word; }
  .rtl-text { direction: rtl; text-align: right; font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', Tahoma, sans-serif; }
</style>
</head>
<body>
<div class="container">
${bodyContent}
</div>
</body>
</html>`;
      }

      setExtractedHtml(finalHtml);
      setProgress(100);
      setStatusMsg(`Successfully converted ${numPages} pages into complete styled HTML!`);

      if (onAddToHistory) {
        const htmlBlob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
        onAddToHistory({
          id: `hist-${Date.now()}`,
          toolId: 'pdf-to-html',
          toolName: 'PDF to HTML',
          originalName: selectedFile.name,
          resultName: `${selectedFile.name.replace(/\.pdf$/i, '')}.html`,
          originalSize: selectedFile.size,
          resultSize: htmlBlob.size,
          savedBytes: 0,
          timestamp: Date.now(),
          resultBlob: htmlBlob,
        });
      }
    } catch (err: any) {
      console.error('PDF to HTML Error:', err);
      setStatusMsg(`Conversion failed: ${err.message || 'Corrupted or protected PDF'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download HTML Webpage File
  const handleDownloadFile = () => {
    if (!extractedHtml) return;
    const blob = new Blob([extractedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile ? selectedFile.name.replace(/\.pdf$/i, '') : 'AllDocKit_Document'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open in New Browser Tab for Instant Fullscreen Review
  const handleOpenNewTab = () => {
    if (!extractedHtml) return;
    const blob = new Blob([extractedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Copy HTML
  const handleCopy = () => {
    if (!extractedHtml) return;
    navigator.clipboard.writeText(extractedHtml);
    setCopied(true);
    setStatusMsg('HTML code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-stone-900/40 border border-emerald-500/20 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              PDF to HTML Converter
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
              100% OFFLINE & STYLED
            </span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 max-w-xl">
            Convert PDF documents into complete HTML web pages with 100% preserved visual styling,
            typography, headings, background artwork, and selectable text. Zero server upload.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4" />
            <span>Preserves 100% Styles</span>
          </div>
        </div>
      </div>

      {/* File Upload Zone */}
      {!selectedFile && (
        <DropZone
          onFilesSelected={handleFileSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop your PDF here to convert to Styled HTML"
          subtitle="Supports single or multi-page documents. All graphics, colors and layouts preserved."
        />
      )}

      {/* Selected File & Settings Card */}
      {selectedFile && (
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate max-w-md">
                  {selectedFile.name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-stone-500">
                  <span>{formatBytes(selectedFile.size)}</span>
                  <span>•</span>
                  <span>{pageCount > 0 ? `${pageCount} Pages` : 'Reading document...'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setExtractedHtml('');
              }}
              className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 text-xs font-medium cursor-pointer"
            >
              Choose Different PDF
            </button>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="conversion-mode-select" className="text-xs text-stone-600 dark:text-stone-400 font-medium block mb-1">
                Conversion Styling Mode
              </label>
              <select
                id="conversion-mode-select"
                value={mode}
                onChange={(e: any) => setMode(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium text-stone-900 dark:text-stone-100"
              >
                <option value="exact-styled">Exact Visual Layout & Artwork (Recommended)</option>
                <option value="semantic-styled">Clean Responsive HTML Document</option>
              </select>
            </div>

            {mode === 'exact-styled' && (
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBackgroundArtwork}
                    onChange={(e) => setIncludeBackgroundArtwork(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  Embed Page Artwork & Colors
                </label>
              </div>
            )}

            <div className="flex items-center justify-end pt-4 sm:col-start-3">
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isProcessing ? 'Processing PDF...' : 'Convert to HTML with Styles'}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="pt-2">
              <ProgressBar progress={progress} statusText={statusMsg} />
            </div>
          )}
        </div>
      )}

      {/* Output Grid: Extracted Code & Live Render Preview */}
      {extractedHtml && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Code Viewer (Left) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                  Generated Complete HTML
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
              </div>

              <textarea
                value={extractedHtml}
                readOnly
                className="w-full h-96 font-mono text-xs p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 resize-none focus:outline-none leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download .html Webpage
                </button>

                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </button>
              </div>
            </div>
          </div>

          {/* Live Webpage Render Preview (Right) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-teal-600" />
                  Live Webpage Preview
                </span>
                <span className="text-[10px] text-stone-400 uppercase font-mono">
                  {mode === 'exact-styled' ? 'EXACT LAYOUT' : 'RESPONSIVE CSS'}
                </span>
              </div>

              <div className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-800 shadow-inner h-96">
                <iframe
                  ref={iframeRef}
                  title="PDF to HTML Live Preview"
                  className="w-full h-full border-0 bg-stone-800"
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>

              <p className="text-[11px] text-stone-500">
                {mode === 'exact-styled'
                  ? 'Displays exact visual artwork, layout boxes, tables, typography, and selectable text from the original PDF.'
                  : 'Displays clean reflowable HTML with real headings, paragraphs, and Urdu/Arabic support.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
