import React, { useState, useRef, useEffect } from 'react';
import {
  Barcode,
  Download,
  Copy,
  Printer,
  Sparkles,
  CheckCircle2,
  Share2,
  FileCode,
} from 'lucide-react';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { trackActionAndCheckRatePrompt } from '../../utils/share';

interface BarcodeStudioViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

// Code 128B Patterns (Standard 107 symbols, each 11 modules of 1s and 0s)
const CODE128_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '11000111010' // Stop pattern: 1100011101011
];

function encodeCode128B(text: string): string {
  // Start B code index is 104
  const startCode = 104;
  let checksum = startCode;
  let binaryString = CODE128_PATTERNS[startCode];

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const value = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    checksum += value * (i + 1);
    binaryString += CODE128_PATTERNS[value] || CODE128_PATTERNS[0];
  }

  // Checksum modulo 103
  const checkDigitValue = checksum % 103;
  binaryString += CODE128_PATTERNS[checkDigitValue] || CODE128_PATTERNS[0];

  // Stop character (index 106 + 2 terminating bars)
  binaryString += '1100011101011';

  return binaryString;
}

export const BarcodeStudioView: React.FC<BarcodeStudioViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [barcodeText, setBarcodeText] = useState<string>('RD-2026-STORE');
  const [barHeight, setBarHeight] = useState<number>(70);
  const [barWidth, setBarWidth] = useState<number>(2);
  const [showText, setShowText] = useState<boolean>(true);
  const [barColor, setBarColor] = useState<string>('#000000');
  const [copied, setCopied] = useState<boolean>(false);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Barcode onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const safeText = barcodeText.trim() || 'SAMPLE';
    const binary = encodeCode128B(safeText);

    const quietZone = 20; // margins
    const totalModules = binary.length;
    const canvasWidth = totalModules * barWidth + quietZone * 2;
    const textHeight = showText ? 24 : 0;
    const canvasHeight = barHeight + textHeight + quietZone * 2;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw Bars
    ctx.fillStyle = barColor;
    let currentX = quietZone;

    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === '1') {
        ctx.fillRect(currentX, quietZone, barWidth, barHeight);
      }
      currentX += barWidth;
    }

    // Draw Text
    if (showText) {
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(safeText, canvasWidth / 2, barHeight + quietZone + 18);
    }
  }, [barcodeText, barHeight, barWidth, showText, barColor]);

  // Download Single Barcode PNG
  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `barcode_${barcodeText.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      setResult({ blob, fileName, size: blob.size });

      onAddToHistory({
        toolId: 'barcode-studio',
        toolName: '1D Barcode Studio',
        originalName: barcodeText,
        resultName: fileName,
        originalSize: 0,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });

      trackActionAndCheckRatePrompt();
    }, 'image/png');
  };

  // Generate 24-Label Sticker Sheet (PDF) on A4
  const handleGenerateStickerSheet = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const commaIdx = dataUrl.indexOf(',');
      const rawBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      const binary = atob(rawBase64);
      const imgBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        imgBytes[i] = binary.charCodeAt(i);
      }

      const pdfDoc = await PDFDocument.create();
      // A4: 595.28 x 841.89 pt
      const page = pdfDoc.addPage([595.28, 841.89]);
      const barcodeImg = await pdfDoc.embedPng(imgBytes);

      // 3 columns x 8 rows = 24 barcode stickers
      const cols = 3;
      const rows = 8;
      const stickerWidth = 170;
      const stickerHeight = (canvas.height / canvas.width) * stickerWidth;
      const gapX = 18;
      const gapY = 22;

      const totalW = cols * stickerWidth + (cols - 1) * gapX;
      const startX = (595.28 - totalW) / 2;
      const startY = 841.89 - 50;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (stickerWidth + gapX);
          const y = startY - r * (stickerHeight + gapY) - stickerHeight;

          page.drawImage(barcodeImg, {
            x,
            y,
            width: stickerWidth,
            height: stickerHeight,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = `Barcode_Labels_Sheet_24x_${barcodeText.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      setResult({ blob, fileName, size: blob.size });

      onAddToHistory({
        toolId: 'barcode-studio',
        toolName: '1D Barcode Studio',
        originalName: `${barcodeText} (24 Labels)`,
        resultName: fileName,
        originalSize: 0,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });

      trackActionAndCheckRatePrompt();
    } catch (err: any) {
      console.error('Barcode sheet error:', err);
      alert('Failed to generate sticker sheet.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Barcode className="w-5 h-5 text-indigo-500" />
            <span>1D Barcode Studio (Code 128 / Retail)</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Create standard retail, shipping, and inventory barcodes with custom height, labels, and printable A4 label sticker sheets.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-500/20">
          <span>⚡ Universal Code 128 Standard</span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="md:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Barcode Parameters
            </h3>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                Data / Product Code / SKU
              </label>
              <input
                type="text"
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                placeholder="e.g. PROD-99281-A"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                <span>Bar Height</span>
                <span>{barHeight} px</span>
              </div>
              <input
                type="range"
                min="40"
                max="140"
                value={barHeight}
                onChange={(e) => setBarHeight(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                <span>Bar Width Density</span>
                <span>{barWidth}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                value={barWidth}
                onChange={(e) => setBarWidth(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={showText}
                  onChange={(e) => setShowText(e.target.checked)}
                  className="rounded border-stone-300 text-indigo-600"
                />
                <span>Show text label below barcode</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download High-Res Barcode (PNG)</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateStickerSheet}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Printable Sticker Sheet (24 on A4 PDF)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Preview Column */}
        <div className="md:col-span-7 flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
          <span className="text-xs font-bold text-stone-500 mb-3">
            Real-Time Code 128 Preview
          </span>

          <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-md max-w-full overflow-x-auto flex items-center justify-center">
            <canvas ref={canvasRef} className="max-w-full h-auto" />
          </div>

          <p className="text-[11px] text-stone-400 mt-3 text-center">
            💡 Compatible with standard handheld laser barcode scanners, warehouse POS, and mobile scanning apps.
          </p>
        </div>
      </div>

      {/* Result Card with WhatsApp, Download, and Companion App Spotlight */}
      {result && (
        <TaskSuccessCard
          title="Barcode Successfully Generated!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="1D Barcode Studio"
          infoBadge="Code 128 Standard"
        />
      )}
    </div>
  );
};
