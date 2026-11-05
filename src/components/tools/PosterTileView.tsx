import React, { useState } from 'react';
import {
  LayoutGrid,
  Download,
  AlertCircle,
  CheckCircle2,
  Printer,
  Image as ImageIcon,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PosterTileViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type GridPreset = '2x2' | '3x3' | '4x4';

export const PosterTileView: React.FC<PosterTileViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gridPreset, setGridPreset] = useState<GridPreset>('2x2');
  const [addGlueGuides, setAddGlueGuides] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    sheetCount: number;
  } | null>(null);

  const handleFileSelect = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setSelectedFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setErrorMessage(null);
  };

  const handleGeneratePoster = async () => {
    if (!selectedFile || !previewUrl) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Splitting image into high-resolution A4 poster tiles...');
    setErrorMessage(null);

    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = rej;
        el.src = previewUrl;
      });

      const dim = gridPreset === '2x2' ? 2 : gridPreset === '3x3' ? 3 : 4;
      const totalSheets = dim * dim;

      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      const tileW = srcW / dim;
      const tileH = srcH / dim;

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const isLandscape = tileW > tileH;
      const pageW = isLandscape ? 841.89 : 595.28;
      const pageH = isLandscape ? 595.28 : 841.89;
      const margin = 24;

      let sheetIdx = 0;

      for (let r = 0; r < dim; r++) {
        for (let c = 0; c < dim; c++) {
          sheetIdx++;
          setStatusText(`Rendering Tile [Row ${r + 1}, Col ${c + 1}] (${sheetIdx} of ${totalSheets})...`);

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(400, Math.round(tileW));
          canvas.height = Math.max(400, Math.round(tileH));
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable');

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(
            img,
            c * tileW,
            r * tileH,
            tileW,
            tileH,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const jpgUrl = canvas.toDataURL('image/jpeg', 0.92);
          const b64 = jpgUrl.split(',')[1];
          const bin = atob(b64);
          const u8 = new Uint8Array(bin.length);
          for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);

          const embImg = await pdfDoc.embedJpg(u8);
          const page = pdfDoc.addPage([pageW, pageH]);

          const boxW = pageW - margin * 2;
          const boxH = pageH - margin * 2 - 14;

          page.drawImage(embImg, {
            x: margin,
            y: margin + 14,
            width: boxW,
            height: boxH,
          });

          if (addGlueGuides) {
            page.drawRectangle({
              x: margin,
              y: margin + 14,
              width: boxW,
              height: boxH,
              borderColor: rgb(0.75, 0.78, 0.82),
              borderWidth: 0.5,
              borderDashArray: [4, 4],
            });

            page.drawText(
              `Poster Tile: Row ${r + 1} of ${dim}, Column ${c + 1} of ${dim}  —  Trim along dashed line & join adjacent sheets`,
              {
                x: margin,
                y: 12,
                size: 8.5,
                font,
                color: rgb(0.45, 0.48, 0.52),
              }
            );
          }

          setProgress(Math.round(20 + (sheetIdx / totalSheets) * 75));
        }
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_Poster_${gridPreset}_${totalSheets}Sheets.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        sheetCount: totalSheets,
      });

      onAddToHistory({
        toolId: 'poster-tile',
        toolName: `Poster Tile Printer (${gridPreset})`,
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to generate multi-page poster PDF.');
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
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Poster & Banner Multi-Page A4 Tile Printer
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Split 1 large photo, map, or chart across 4 (2×2), 9 (3×3), or 16 (4×4) A4 sheets to print a giant wall poster on any standard home printer!
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
              acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
              multiple={false}
              title="Drop your poster, map, or high-res image here"
              subtitle="Divides your image into printable A4 tiles with assembly row/column guides"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {previewUrl && (
                  <img src={previewUrl} alt="Poster" className="w-12 h-12 object-cover rounded border" />
                )}
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setResult(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change Image
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: '2x2', title: '2 × 2 Grid (4 A4 Sheets)', desc: 'Approx. 42 × 59 cm (A2 Wall Size)' },
                { id: '3x3', title: '3 × 3 Grid (9 A4 Sheets)', desc: 'Approx. 63 × 89 cm (Large Banner)' },
                { id: '4x4', title: '4 × 4 Grid (16 A4 Sheets)', desc: 'Approx. 84 × 118 cm (Giant Poster)' },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGridPreset(g.id as GridPreset)}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    gridPreset === g.id
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{g.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>

            <label className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={addGlueGuides}
                onChange={(e) => setAddGlueGuides(e.target.checked)}
                className="rounded text-emerald-600 w-4 h-4"
              />
              Print dashed trim borders & Row/Column assembly numbers on each sheet margin
            </label>

            {!result && (
              <button
                type="button"
                onClick={handleGeneratePoster}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                {isProcessing
                  ? 'Creating Poster Tiles...'
                  : `Create ${gridPreset} Multi-Page Poster PDF`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
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
                        Poster Tiles Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.sheetCount} Printable A4 Sheets • {formatBytes(result.size)}
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
                  title="Multi-Page Poster PDF Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.sheetCount} A4 Tiles`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
