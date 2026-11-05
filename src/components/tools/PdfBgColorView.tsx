import React, { useState } from 'react';
import {
  Palette,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  Moon,
  Sun,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { getPdfJs } from '../../utils/pdfOperations';

interface PdfBgColorViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type PresetTint = 'sepia' | 'dark-night' | 'mint' | 'sky' | 'custom';

export const PdfBgColorView: React.FC<PdfBgColorViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [preset, setPreset] = useState<PresetTint>('sepia');
  const [customHex, setCustomHex] = useState('#FFF8E7');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pages: number;
  } | null>(null);

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file.');
      return;
    }

    setSelectedFile(file);
    setResult(null);
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      setPageCount(doc.getPageCount());
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not load PDF file.');
    }
  };

  const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };

  const handleApplyTint = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Rendering PDF pages with selected background color / eye-care theme...');
    setErrorMessage(null);

    try {
      const pdfjs = await getPdfJs();
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const totalPages = pdf.numPages;

      const outDoc = await PDFDocument.create();

      let targetHex = customHex;
      if (preset === 'sepia') targetHex = '#FDF5E6';
      if (preset === 'mint') targetHex = '#EDF7ED';
      if (preset === 'sky') targetHex = '#EAF4FC';

      const tintRgb = hexToRgb(targetHex);

      for (let i = 1; i <= totalPages; i++) {
        setStatusText(`Applying background theme to page ${i} of ${totalPages}...`);
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 2.0 });
        const origVp = page.getViewport({ scale: 1.0 });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        if (preset === 'dark-night') {
          // Smart Dark Mode inversion
          for (let p = 0; p < data.length; p += 4) {
            data[p] = Math.max(18, 255 - data[p]);
            data[p + 1] = Math.max(22, 255 - data[p + 1]);
            data[p + 2] = Math.max(32, 255 - data[p + 2]);
          }
        } else {
          // Multiply pixel colors with target paper tint so white background becomes the exact tint color while dark text stays sharp
          for (let p = 0; p < data.length; p += 4) {
            data[p] = Math.round((data[p] * tintRgb.r) / 255);
            data[p + 1] = Math.round((data[p + 1] * tintRgb.g) / 255);
            data[p + 2] = Math.round((data[p + 2] * tintRgb.b) / 255);
          }
        }

        ctx.putImageData(imgData, 0, 0);

        const jpgUrl = canvas.toDataURL('image/jpeg', 0.9);
        const b64 = jpgUrl.split(',')[1];
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);

        const embImg = await outDoc.embedJpg(u8);
        const outPage = outDoc.addPage([origVp.width, origVp.height]);
        outPage.drawImage(embImg, {
          x: 0,
          y: 0,
          width: origVp.width,
          height: origVp.height,
        });

        setProgress(Math.round(15 + (i / totalPages) * 75));
      }

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const fileName = `${baseName}_${preset.toUpperCase()}_Theme.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        pages: totalPages,
      });

      onAddToHistory({
        toolId: 'pdf-bg-color',
        toolName: 'PDF Background Color & Dark Mode',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to change PDF background color.');
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
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF Page Background Color & Dark Mode Reader
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert harsh white PDF backgrounds into soothing Eye-Care Sepia Cream, Night Dark Mode, Pastel Mint, or any custom paper color.
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
              acceptedFormats={['.pdf']}
              multiple={false}
              title="Drop your PDF book, notes, or document here"
              subtitle="Changes paper background color while keeping text sharp and readable"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {pageCount !== null ? `${pageCount} Pages` : 'Reading...'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setResult(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { id: 'sepia', label: 'Warm Sepia Cream', bg: '#FDF5E6', text: '#1E293B' },
                { id: 'dark-night', label: 'Night Dark Mode', bg: '#121620', text: '#F8FAFC' },
                { id: 'mint', label: 'Eye-Care Mint', bg: '#EDF7ED', text: '#1E293B' },
                { id: 'sky', label: 'Soft Sky Blue', bg: '#EAF4FC', text: '#1E293B' },
                { id: 'custom', label: 'Custom Color', bg: customHex, text: '#1E293B' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPreset(item.id as PresetTint)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between h-20 ${
                    preset === item.id
                      ? 'border-amber-500 ring-2 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full border border-slate-300 shadow-inner"
                    style={{ backgroundColor: item.bg }}
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pick Custom Paper Background Color:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border border-slate-300"
                  />
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{customHex}</span>
                </div>
              </div>
            )}

            {!result && (
              <button
                type="button"
                onClick={handleApplyTint}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Palette className="w-5 h-5" />
                {isProcessing ? 'Applying Page Theme...' : 'Apply Background Color to PDF'}
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
                        Themed PDF Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pages} Pages Styled • {formatBytes(result.size)}
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
                  title="Themed Background PDF Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.pages} Pages`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
