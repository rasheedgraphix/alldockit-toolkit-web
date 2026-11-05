import React, { useState } from 'react';
import {
  Presentation,
  Download,
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { parsePptxFile, ParsedSlide } from '../../utils/officePackager';

interface PptToPdfViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PptToPdfView: React.FC<PptToPdfViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [slides, setSlides] = useState<ParsedSlide[]>([]);
  const [themeStyle, setThemeStyle] = useState<'light' | 'dark'>('light');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    slideCount: number;
  } | null>(null);

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setResult(null);
    setErrorMessage(null);

    try {
      const parsed = await parsePptxFile(file);
      setSlides(parsed);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not parse PowerPoint (.pptx) file. Ensure it is a valid .pptx presentation.');
    }
  };

  const safeAscii = (str: string) =>
    str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');

  const handleConvert = async () => {
    if (!selectedFile || slides.length === 0) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Rendering widescreen 16:9 PDF slides...');
    setErrorMessage(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // 16:9 Widescreen points: 960 x 540
      const slideW = 960;
      const slideH = 540;

      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        setStatusText(`Rendering Slide ${s.slideNumber} of ${slides.length}...`);

        const page = pdfDoc.addPage([slideW, slideH]);

        // Background
        page.drawRectangle({
          x: 0,
          y: 0,
          width: slideW,
          height: slideH,
          color: themeStyle === 'dark' ? rgb(0.08, 0.1, 0.16) : rgb(1, 1, 1),
        });

        // Top accent bar
        page.drawRectangle({
          x: 0,
          y: slideH - 8,
          width: slideW,
          height: 8,
          color: rgb(0.92, 0.35, 0.08),
        });

        // If the slide has an embedded full-bleed or media image, render it
        let hasRenderedFullImage = false;
        if (s.imageUrls.length > 0) {
          try {
            const resp = await fetch(s.imageUrls[0]);
            const imgBlob = await resp.blob();
            const imgBytes = await imgBlob.arrayBuffer();

            // Render via canvas to normalize to JPEG for safe embedding
            const imgEl = await new Promise<HTMLImageElement>((res, rej) => {
              const el = new Image();
              el.onload = () => res(el);
              el.onerror = rej;
              el.src = s.imageUrls[0];
            });

            const c = document.createElement('canvas');
            c.width = imgEl.naturalWidth || 800;
            c.height = imgEl.naturalHeight || 450;
            const ctx = c.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.drawImage(imgEl, 0, 0);
              const jpgUrl = c.toDataURL('image/jpeg', 0.9);
              const b64 = jpgUrl.split(',')[1];
              const bin = atob(b64);
              const u8 = new Uint8Array(bin.length);
              for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);

              const embeddedImg = await pdfDoc.embedJpg(u8);

              if (s.paragraphs.length === 0) {
                // Full slide image
                const scale = Math.min((slideW - 40) / embeddedImg.width, (slideH - 60) / embeddedImg.height);
                const w = embeddedImg.width * scale;
                const h = embeddedImg.height * scale;
                page.drawImage(embeddedImg, {
                  x: (slideW - w) / 2,
                  y: (slideH - h) / 2,
                  width: w,
                  height: h,
                });
                hasRenderedFullImage = true;
              } else {
                // Draw on right half of slide
                const boxW = 360;
                const boxH = 360;
                const scale = Math.min(boxW / embeddedImg.width, boxH / embeddedImg.height);
                const w = embeddedImg.width * scale;
                const h = embeddedImg.height * scale;
                page.drawImage(embeddedImg, {
                  x: slideW - w - 50,
                  y: (slideH - h) / 2 - 20,
                  width: w,
                  height: h,
                });
              }
            }
          } catch (e) {
            // Ignore image embed failure and render text
          }
        }

        if (!hasRenderedFullImage) {
          // Title
          const titleClean = safeAscii(s.title);
          page.drawText(titleClean.slice(0, 65), {
            x: 56,
            y: slideH - 72,
            size: 26,
            font: boldFont,
            color: themeStyle === 'dark' ? rgb(0.98, 0.98, 1) : rgb(0.1, 0.12, 0.2),
          });

          // Body bullets
          let cursorY = slideH - 125;
          const maxTextW = s.imageUrls.length > 0 ? slideW - 480 : slideW - 112;

          for (const para of s.paragraphs) {
            if (cursorY < 60) break;
            const words = safeAscii(para).split(/\s+/);
            let line = '•  ';
            for (const w of words) {
              const test = line ? `${line} ${w}` : w;
              if (regularFont.widthOfTextAtSize(test, 15) <= maxTextW) {
                line = test;
              } else {
                page.drawText(line, {
                  x: 60,
                  y: cursorY,
                  size: 15,
                  font: regularFont,
                  color: themeStyle === 'dark' ? rgb(0.82, 0.85, 0.9) : rgb(0.22, 0.25, 0.32),
                });
                cursorY -= 24;
                line = '    ' + w;
              }
            }
            if (line.trim()) {
              page.drawText(line, {
                x: 60,
                y: cursorY,
                size: 15,
                font: regularFont,
                color: themeStyle === 'dark' ? rgb(0.82, 0.85, 0.9) : rgb(0.22, 0.25, 0.32),
              });
              cursorY -= 28;
            }
          }
        }

        // Slide number footer
        page.drawText(`Slide ${s.slideNumber} / ${slides.length}`, {
          x: slideW - 105,
          y: 22,
          size: 10,
          font: regularFont,
          color: rgb(0.5, 0.52, 0.58),
        });

        setProgress(Math.round(20 + ((i + 1) / slides.length) * 70));
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_Slides.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        slideCount: slides.length,
      });

      onAddToHistory({
        toolId: 'ppt-to-pdf',
        toolName: 'PowerPoint (.pptx) to PDF',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to convert PowerPoint to PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Presentation className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PowerPoint (.pptx) to PDF Converter
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert Microsoft PowerPoint (.pptx) slide decks into widescreen 16:9 PDF presentations locally.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {!selectedFile ? (
          <div className="mt-6">
            <DropZone
              onFilesSelected={handleFileSelect}
              acceptedFormats={['.pptx']}
              multiple={false}
              title="Drop your PowerPoint (.pptx) presentation here"
              subtitle="Extracts slides, bullet points, and embedded slide visuals into a widescreen PDF"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Presentation className="w-8 h-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {slides.length} Slides Detected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setSlides([]);
                  setResult(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            {slides.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-600" />
                  Presentation Slide Deck Preview ({slides.length} Slides)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto p-1">
                  {slides.slice(0, 8).map((s) => (
                    <div
                      key={s.slideNumber}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                          Slide {s.slideNumber}
                        </span>
                        {s.imageUrls.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                            {s.imageUrls.length} Image(s)
                          </span>
                        )}
                      </div>
                      <h5 className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {s.title}
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {s.paragraphs.join(' • ') || 'Visual Slide'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Slide Theme Background:</span>
              <select
                value={themeStyle}
                onChange={(e) => setThemeStyle(e.target.value as 'light' | 'dark')}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="light">Clean White Studio Theme</option>
                <option value="dark">Executive Dark Slate Theme</option>
              </select>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Presentation className="w-5 h-5" />
                {isProcessing ? 'Rendering Slides to PDF...' : 'Convert PowerPoint (.pptx) to PDF'}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                <ProgressBar progress={progress} statusText={statusText} />
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                        Presentation PDF Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.slideCount} Widescreen Slides • {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>

                <TaskSuccessCard
                  title="PowerPoint Converted to PDF!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.slideCount} Slides`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
