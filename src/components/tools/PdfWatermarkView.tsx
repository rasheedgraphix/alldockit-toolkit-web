import React, { useState } from 'react';
import {
  Stamp,
  Download,
  CheckCircle2,
  Sparkles,
  Hash,
  Type,
  Sliders,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { formatBytes, downloadBlob, getPdfInfo } from '../../utils/fileHelpers';
import { addWatermarkAndPageNumbers, WatermarkOptions } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface PdfWatermarkViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfWatermarkView: React.FC<PdfWatermarkViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.25);
  const [rotation, setRotation] = useState(45);
  const [colorHex, setColorHex] = useState('#64748b');

  const [addPageNumbers, setAddPageNumbers] = useState(true);
  const [pageNumberPosition, setPageNumberPosition] = useState<
    'bottom-center' | 'bottom-right' | 'top-right' | 'bottom-left'
  >('bottom-center');
  const [pageNumberFormat, setPageNumberFormat] = useState<'page-of-total' | 'page-only'>(
    'page-of-total'
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [resultPdf, setResultPdf] = useState<{ blob: Blob; pageCount: number } | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      const info = await getPdfInfo(file);
      setPageCount(info.pageCount);
      setResultPdf(null);
    }
  };

  const handleApply = async () => {
    if (!selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Applying watermark stamps and numbering...');

    try {
      const options: WatermarkOptions = {
        text: watermarkText,
        fontSize,
        opacity,
        rotation,
        colorHex,
        addPageNumbers,
        pageNumberPosition,
        pageNumberFormat,
      };

      const result = await addWatermarkAndPageNumbers(selectedFile, options, (p, text) => {
        setProgress(p);
        setStatusText(text);
      });

      setResultPdf(result);

      onAddToHistory({
        toolId: 'pdf-watermark',
        toolName: 'PDF Watermark & Numbers',
        originalName: selectedFile.name,
        resultName: `${selectedFile.name.replace('.pdf', '')}_stamped.pdf`,
        originalSize: selectedFile.size,
        resultSize: result.blob.size,
        savedBytes: 0,
        resultBlob: result.blob,
      });
    } catch (err: any) {
      console.error('Error applying watermark:', err);
      alert(err.message || 'Failed to apply watermark.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!selectedFile || !resultPdf) return;
    downloadBlob(
      resultPdf.blob,
      `${selectedFile.name.replace('.pdf', '')}_watermarked.pdf`
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Stamp className="w-5 h-5 text-amber-500" />
            PDF Watermark & Page Numbers
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Add custom diagonal watermark text, logos, and professional page numbering to all pages.
          </p>
        </div>
      </div>

      {!selectedFile ? (
        <DropZone
          onFilesSelected={handleFileSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop your PDF here to watermark"
          subtitle="Stamp 'DRAFT', 'CONFIDENTIAL', your company name, or page numbers."
        />
      ) : (
        <div className="space-y-6">
          {/* File summary */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800">
            <div>
              <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {formatBytes(selectedFile.size)} • {pageCount} pages
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setResultPdf(null);
              }}
              className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 font-medium px-3 py-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            >
              Change File
            </button>
          </div>

          {/* Options Grid */}
          {!resultPdf && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Watermark Text Card */}
              <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-stone-800">
                  <Type className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Text Watermark
                  </h3>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Watermark Text
                  </label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="CONFIDENTIAL, DRAFT, RASHEED GRAPHIX..."
                    className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Font Size ({fontSize}pt)
                    </label>
                    <input
                      type="range"
                      min="18"
                      max="90"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Opacity ({Math.round(opacity * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={opacity * 100}
                      onChange={(e) => setOpacity(parseInt(e.target.value, 10) / 100)}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Angle ({rotation}°)
                    </label>
                    <select
                      value={rotation}
                      onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                      className="w-full py-1.5 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    >
                      <option value="0">Horizontal (0°)</option>
                      <option value="45">Diagonal (45° Standard)</option>
                      <option value="-45">Reverse Diagonal (-45°)</option>
                      <option value="90">Vertical (90°)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorHex}
                        onChange={(e) => setColorHex(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200"
                      />
                      <span className="text-xs text-stone-600 dark:text-stone-400 font-mono">
                        {colorHex}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Page Numbers Card */}
              <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                      Page Numbering
                    </h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addPageNumbers}
                      onChange={(e) => setAddPageNumbers(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {addPageNumbers ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Format Style
                      </label>
                      <select
                        value={pageNumberFormat}
                        onChange={(e) => setPageNumberFormat(e.target.value as any)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                      >
                        <option value="page-of-total">Page 1 of {pageCount || 10}</option>
                        <option value="page-only">Page 1</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Position
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPageNumberPosition('bottom-center')}
                          className={`py-2 px-3 text-xs rounded-xl border ${
                            pageNumberPosition === 'bottom-center'
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold'
                              : 'border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          Bottom Center
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageNumberPosition('bottom-right')}
                          className={`py-2 px-3 text-xs rounded-xl border ${
                            pageNumberPosition === 'bottom-right'
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold'
                              : 'border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          Bottom Right
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageNumberPosition('bottom-left')}
                          className={`py-2 px-3 text-xs rounded-xl border ${
                            pageNumberPosition === 'bottom-left'
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold'
                              : 'border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          Bottom Left
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageNumberPosition('top-right')}
                          className={`py-2 px-3 text-xs rounded-xl border ${
                            pageNumberPosition === 'top-right'
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold'
                              : 'border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          Top Right
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic py-4 text-center">
                    Page numbering is disabled.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Button */}
          {!resultPdf && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleApply}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                {isProcessing ? 'Stamping Document...' : `Apply Watermark to All ${pageCount} Pages`}
              </button>
            </div>
          )}

          {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

          {/* Success Card */}
          {resultPdf && (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    Watermark Applied Successfully!
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Document stamped with {watermarkText || 'Page Numbers'} • Size:{' '}
                    {formatBytes(resultPdf.blob.size)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Watermarked PDF
                </button>
                <button
                  type="button"
                  onClick={() => setResultPdf(null)}
                  className="py-2.5 px-4 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50"
                >
                  Edit Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
