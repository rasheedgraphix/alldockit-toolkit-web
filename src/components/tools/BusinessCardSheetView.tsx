import React, { useState } from 'react';
import {
  CreditCard,
  Download,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Settings2,
  Copy,
  Printer,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface BusinessCardSheetViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const BusinessCardSheetView: React.FC<BusinessCardSheetViewProps> = ({ onAddToHistory }) => {
  const [frontImage, setFrontImage] = useState<{ file: File; dataUrl: string } | null>(null);
  const [backImage, setBackImage] = useState<{ file: File; dataUrl: string } | null>(null);

  const [drawCutMarks, setDrawCutMarks] = useState(true);
  const [drawFaintBorders, setDrawFaintBorders] = useState(true);
  const [copies, setCopies] = useState<number>(1); // sheets (1 sheet = 10 cards)
  const [cardStandard, setCardStandard] = useState<'standard' | 'euro'>('standard');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    totalCards: number;
    sheets: number;
  } | null>(null);

  const handleFrontUpload = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setFrontImage({ file, dataUrl: e.target?.result as string });
      setResult(null);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleBackUpload = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setBackImage({ file, dataUrl: e.target?.result as string });
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateSheet = async () => {
    if (!frontImage) {
      setErrorMessage('Please upload the front design of your business card.');
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Preparing A4 print canvas (300 DPI high precision)...');
    setErrorMessage(null);

    try {
      const doc = await PDFDocument.create();

      // Card dimensions in points (72 pt per inch)
      // Standard US/Asia: 3.5" x 2.0" = 252 x 144 pt (88.9 x 50.8 mm)
      // Euro standard: 85 x 55 mm = 240.94 x 155.9 pt
      const cardWidth = cardStandard === 'standard' ? 252 : 240.94;
      const cardHeight = cardStandard === 'standard' ? 144 : 155.9;

      // A4 portrait: 595.28 x 841.89 pt
      const a4Width = 595.28;
      const a4Height = 841.89;

      const cols = 2;
      const rows = 5;

      const totalGridW = cols * cardWidth;
      const totalGridH = rows * cardHeight;

      const startX = (a4Width - totalGridW) / 2;
      const startY = (a4Height - totalGridH) / 2;

      // Load front image bytes
      const frontBytes = await frontImage.file.arrayBuffer();
      const isFrontPng =
        frontImage.file.type === 'image/png' || frontImage.file.name.toLowerCase().endsWith('.png');
      const embeddedFront = isFrontPng
        ? await doc.embedPng(frontBytes)
        : await doc.embedJpg(frontBytes);

      let embeddedBack: any = null;
      if (backImage) {
        const backBytes = await backImage.file.arrayBuffer();
        const isBackPng =
          backImage.file.type === 'image/png' || backImage.file.name.toLowerCase().endsWith('.png');
        embeddedBack = isBackPng
          ? await doc.embedPng(backBytes)
          : await doc.embedJpg(backBytes);
      }

      const totalSheetsToRender = copies;

      for (let s = 0; s < totalSheetsToRender; s++) {
        // --- PAGE 1: FRONT SIDES ---
        const pageFront = doc.addPage([a4Width, a4Height]);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = startX + c * cardWidth;
            // PDF origin is bottom-left
            const y = a4Height - startY - (r + 1) * cardHeight;

            // Draw card image
            pageFront.drawImage(embeddedFront, {
              x,
              y,
              width: cardWidth,
              height: cardHeight,
            });

            // Draw faint border if enabled
            if (drawFaintBorders) {
              pageFront.drawRectangle({
                x,
                y,
                width: cardWidth,
                height: cardHeight,
                borderColor: rgb(0.85, 0.85, 0.85),
                borderWidth: 0.5,
              });
            }
          }
        }

        // Draw crop marks around cards on front page
        if (drawCutMarks) {
          drawSheetCutMarks(pageFront, startX, startY, cardWidth, cardHeight, cols, rows, a4Width, a4Height);
        }

        // --- PAGE 2: BACK SIDES (IF PROVIDED) ---
        if (embeddedBack) {
          const pageBack = doc.addPage([a4Width, a4Height]);

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              // When paper is flipped along the long edge (duplex standard),
              // column 0 on the front corresponds to column 1 on the back!
              const mirroredC = cols - 1 - c;
              const x = startX + mirroredC * cardWidth;
              const y = a4Height - startY - (r + 1) * cardHeight;

              pageBack.drawImage(embeddedBack, {
                x,
                y,
                width: cardWidth,
                height: cardHeight,
              });

              if (drawFaintBorders) {
                pageBack.drawRectangle({
                  x,
                  y,
                  width: cardWidth,
                  height: cardHeight,
                  borderColor: rgb(0.85, 0.85, 0.85),
                  borderWidth: 0.5,
                });
              }
            }
          }

          if (drawCutMarks) {
            drawSheetCutMarks(pageBack, startX, startY, cardWidth, cardHeight, cols, rows, a4Width, a4Height);
          }
        }

        setProgress(Math.round(((s + 1) / totalSheetsToRender) * 85));
        setStatusText(`Generating sheet ${s + 1} of ${totalSheetsToRender}...`);
      }

      setProgress(95);
      setStatusText('Assembling PDF document...');
      const outBytes = await doc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = `Visiting_Cards_10_on_A4_${copies * 10}_Cards.pdf`;

      const totalCards = copies * 10;
      setResult({
        blob,
        fileName,
        size: blob.size,
        totalCards,
        sheets: backImage ? copies * 2 : copies,
      });

      onAddToHistory({
        toolId: 'business-card-sheet',
        toolName: 'Visiting Card 10-on-A4 Studio',
        originalName: frontImage.file.name,
        resultName: fileName,
        originalSize: frontImage.file.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, frontImage.file.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to render 10-on-A4 business card sheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  const drawSheetCutMarks = (
    page: any,
    startX: number,
    startY: number,
    cardW: number,
    cardH: number,
    cols: number,
    rows: number,
    pageW: number,
    pageH: number
  ) => {
    const markLen = 12; // length of crop mark
    const markColor = rgb(0.4, 0.4, 0.4);

    // Vertical cut marks at card column edges (top and bottom margins)
    for (let c = 0; c <= cols; c++) {
      const x = startX + c * cardW;
      // Top margin mark
      page.drawLine({
        start: { x, y: pageH - startY + 2 },
        end: { x, y: pageH - startY + markLen + 2 },
        thickness: 0.5,
        color: markColor,
      });
      // Bottom margin mark
      page.drawLine({
        start: { x, y: startY - 2 },
        end: { x, y: startY - markLen - 2 },
        thickness: 0.5,
        color: markColor,
      });
    }

    // Horizontal cut marks at card row edges (left and right margins)
    for (let r = 0; r <= rows; r++) {
      const y = pageH - startY - r * cardH;
      // Left margin mark
      page.drawLine({
        start: { x: startX - markLen - 2, y },
        end: { x: startX - 2, y },
        thickness: 0.5,
        color: markColor,
      });
      // Right margin mark
      page.drawLine({
        start: { x: pageW - startX + 2, y },
        end: { x: pageW - startX + markLen + 2, y },
        thickness: 0.5,
        color: markColor,
      });
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
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Visiting / Business Card 10-on-A4 Studio
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Unlimited
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Impose 10 standard business cards per A4 sheet with precision scissor/cutter crop marks. Supports 2-sided duplex printing!
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {/* Upload Section */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Front */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-600" />
                1. Card Front Design <span className="text-rose-500">*</span>
              </span>
              {frontImage && (
                <button
                  type="button"
                  onClick={() => setFrontImage(null)}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            {!frontImage ? (
              <DropZone
                onFilesSelected={handleFrontUpload}
                acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
                multiple={false}
                title="Upload Front Card Image"
                subtitle="PNG, JPG, or WebP (3.5 × 2 inch recommended)"
              />
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900/10 flex items-center justify-center p-2">
                <img
                  src={frontImage.dataUrl}
                  alt="Card Front"
                  className="max-h-36 object-contain rounded shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Card Back (Optional) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-500" />
                2. Card Back Design (Optional)
              </span>
              {backImage && (
                <button
                  type="button"
                  onClick={() => setBackImage(null)}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            {!backImage ? (
              <DropZone
                onFilesSelected={handleBackUpload}
                acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
                multiple={false}
                title="Upload Back Card Image"
                subtitle="Leave empty for single-sided cards"
              />
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900/10 flex items-center justify-center p-2">
                <img
                  src={backImage.dataUrl}
                  alt="Card Back"
                  className="max-h-36 object-contain rounded shadow-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Configuration */}
        {frontImage && (
          <div className="space-y-4 pt-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-amber-600" />
              Print & Layout Options
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Card Standard Size
                </label>
                <select
                  value={cardStandard}
                  onChange={(e) => setCardStandard(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="standard">Standard (3.5 × 2.0 inches / 88.9 × 50.8 mm)</option>
                  <option value="euro">European Size (85 × 55 mm)</option>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Fits 10 cards per A4 page in a 2-column by 5-row grid.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Total Print Quantity
                </label>
                <select
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value={1}>1 Sheet (10 Visiting Cards)</option>
                  <option value={2}>2 Sheets (20 Visiting Cards)</option>
                  <option value={5}>5 Sheets (50 Visiting Cards)</option>
                  <option value={10}>10 Sheets (100 Visiting Cards)</option>
                  <option value={20}>20 Sheets (200 Visiting Cards)</option>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {backImage
                    ? `Generates ${copies * 2} pages (Front & Back duplex aligned).`
                    : `Generates ${copies} print-ready page(s).`}
                </p>
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={drawCutMarks}
                  onChange={(e) => setDrawCutMarks(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                Draw outer crop / cut guide marks for precision guillotine or scissor cutting
              </label>

              <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={drawFaintBorders}
                  onChange={(e) => setDrawFaintBorders(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                Draw faint card outline (ideal for cards with white backgrounds)
              </label>
            </div>

            {/* Process Button */}
            {!result && (
              <button
                type="button"
                onClick={handleGenerateSheet}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                {isProcessing
                  ? 'Generating Print Sheet...'
                  : `Generate Print-Ready 10-on-A4 PDF (${copies * 10} Cards)`}
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
                        Sheet Created: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Total {result.totalCards} Visiting Cards ({result.sheets} Pages) • {formatBytes(result.size)}
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
                  title="Visiting Card 10-on-A4 Sheet Ready to Print!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={frontImage.file.size}
                  infoBadge={`${result.totalCards} Cards Ready`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
