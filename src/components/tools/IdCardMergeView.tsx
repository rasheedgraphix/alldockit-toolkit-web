import React, { useState } from 'react';
import {
  CreditCard,
  RotateCw,
  Trash2,
  CheckCircle2,
  Printer,
  Sparkles,
  Download,
  FileType,
  Layers,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { imageSourceToPngBytes } from '../../utils/fileHelpers';

interface IdCardMergeViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const IdCardMergeView: React.FC<IdCardMergeViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  const [frontRotation, setFrontRotation] = useState<number>(0);
  const [backRotation, setBackRotation] = useState<number>(0);

  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [cardScale, setCardScale] = useState<'standard' | 'large'>('standard');
  const [headerNote, setHeaderNote] = useState<string>('COPY OF ORIGINAL IDENTIFICATION DOCUMENT');
  const [includeCutLine, setIncludeCutLine] = useState<boolean>(true);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  const handleFrontSelected = (files: File[]) => {
    if (files.length > 0) {
      setFrontFile(files[0]);
      setFrontPreview(URL.createObjectURL(files[0]));
      setResult(null);
    }
  };

  const handleBackSelected = (files: File[]) => {
    if (files.length > 0) {
      setBackFile(files[0]);
      setBackPreview(URL.createObjectURL(files[0]));
      setResult(null);
    }
  };

  const handleMergeIdCard = async () => {
    if (!frontPreview || !backPreview) {
      alert('Please upload both Front and Back sides of the ID card.');
      return;
    }

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Rotating and preparing card sides...');

    try {
      const frontBytes = await imageSourceToPngBytes(frontPreview, frontRotation);
      const backBytes = await imageSourceToPngBytes(backPreview, backRotation);

      setProgress(45);
      setStatusText('Generating printable A4 page...');

      // Standard A4 dimensions in points: 595.28 x 841.89
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width: pageWidth, height: pageHeight } = page.getSize();

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Embed PNG bytes directly
      const frontImg = await pdfDoc.embedPng(frontBytes);
      const backImg = await pdfDoc.embedPng(backBytes);

      // Standard ID card is ~85.6mm x 54mm (ratio ~1.585)
      // In points: 1mm = 2.83465pt -> standard is ~242pt x 153pt
      const cardWidth = cardScale === 'standard' ? 245 : 310;
      const cardHeight = cardScale === 'standard' ? 155 : 195;

      // Header Text
      if (headerNote.trim()) {
        const textWidth = font.widthOfTextAtSize(headerNote.trim(), 11);
        page.drawText(headerNote.trim(), {
          x: (pageWidth - textWidth) / 2,
          y: pageHeight - 50,
          size: 11,
          font: font,
          color: rgb(0.2, 0.2, 0.2),
        });

        // Small subtext
        const dateStr = `Printed via AllDocKit - ${new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}`;
        const subWidth = fontRegular.widthOfTextAtSize(dateStr, 8);
        page.drawText(dateStr, {
          x: (pageWidth - subWidth) / 2,
          y: pageHeight - 65,
          size: 8,
          font: fontRegular,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      setProgress(70);
      setStatusText('Placing ID cards on A4 template...');

      if (layout === 'vertical') {
        // Stacked vertically in center of page
        const spacing = 40;
        const totalHeight = cardHeight * 2 + spacing;
        const startY = (pageHeight - totalHeight) / 2 + cardHeight + spacing;
        const startX = (pageWidth - cardWidth) / 2;

        // Front Card
        page.drawImage(frontImg, {
          x: startX,
          y: startY,
          width: cardWidth,
          height: cardHeight,
        });

        // Label: Front Side
        page.drawText('FRONT SIDE', {
          x: startX,
          y: startY + cardHeight + 6,
          size: 9,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });

        // Back Card
        const backY = startY - cardHeight - spacing;
        page.drawImage(backImg, {
          x: startX,
          y: backY,
          width: cardWidth,
          height: cardHeight,
        });

        // Label: Back Side
        page.drawText('BACK SIDE', {
          x: startX,
          y: backY + cardHeight + 6,
          size: 9,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
      } else {
        // Horizontal side by side
        const spacing = 30;
        const totalWidth = cardWidth * 2 + spacing;
        const startX = (pageWidth - totalWidth) / 2;
        const startY = (pageHeight - cardHeight) / 2;

        page.drawImage(frontImg, {
          x: startX,
          y: startY,
          width: cardWidth,
          height: cardHeight,
        });

        page.drawText('FRONT SIDE', {
          x: startX,
          y: startY + cardHeight + 6,
          size: 9,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });

        const secondX = startX + cardWidth + spacing;
        page.drawImage(backImg, {
          x: secondX,
          y: startY,
          width: cardWidth,
          height: cardHeight,
        });

        page.drawText('BACK SIDE', {
          x: secondX,
          y: startY + cardHeight + 6,
          size: 9,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      setProgress(90);
      setStatusText('Finalizing printable document...');

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = 'ID_Card_Front_Back_A4.pdf';

      setResult({
        blob,
        fileName,
        size: blob.size,
      });

      onAddToHistory({
        toolId: 'id-card-merge',
        toolName: 'CNIC / ID Card 2-in-1 Merge',
        originalName: `${frontFile?.name || 'Front'} + ${backFile?.name || 'Back'}`,
        resultName: fileName,
        originalSize: (frontFile?.size || 0) + (backFile?.size || 0),
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });
    } catch (err: any) {
      console.error('ID Card merge failed:', err);
      alert(err?.message || 'Failed to merge ID card photos.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            <span>CNIC & ID Card 2-in-1 Side Merge (A4 Ready)</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Place Front & Back sides of your ID Card, Driving License, or Smart Card onto a single standard A4 page ready for official printing.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20">
          <Printer className="w-3.5 h-3.5" />
          <span>A4 1-Click Print Ready</span>
        </div>
      </div>

      {/* Upload Boxes: Front and Back */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Front Side */}
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              1. Front Side
            </span>
            {frontPreview && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFrontRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs flex items-center gap-1"
                  title="Rotate 90 degrees"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{frontRotation}°</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFrontFile(null);
                    setFrontPreview(null);
                    setFrontRotation(0);
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {!frontPreview ? (
            <DropZone
              onFilesSelected={handleFrontSelected}
              acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
              multiple={false}
              title="Upload ID Card Front"
              subtitle="PNG, JPG, or WEBP photo"
            />
          ) : (
            <div className="h-44 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-center overflow-hidden p-2">
              <img
                src={frontPreview}
                alt="Front Preview"
                style={{ transform: `rotate(${frontRotation}deg)` }}
                className="max-h-full max-w-full object-contain transition-transform duration-200"
              />
            </div>
          )}
        </div>

        {/* Back Side */}
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              2. Back Side
            </span>
            {backPreview && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBackRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs flex items-center gap-1"
                  title="Rotate 90 degrees"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{backRotation}°</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBackFile(null);
                    setBackPreview(null);
                    setBackRotation(0);
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {!backPreview ? (
            <DropZone
              onFilesSelected={handleBackSelected}
              acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
              multiple={false}
              title="Upload ID Card Back"
              subtitle="PNG, JPG, or WEBP photo"
            />
          ) : (
            <div className="h-44 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-center overflow-hidden p-2">
              <img
                src={backPreview}
                alt="Back Preview"
                style={{ transform: `rotate(${backRotation}deg)` }}
                className="max-h-full max-w-full object-contain transition-transform duration-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* Options & Template Controls */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Page Layout & Options
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
              Alignment Layout
            </label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="vertical">Vertical (Stacked Top & Bottom)</option>
              <option value="horizontal">Horizontal (Side-by-Side)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
              Card Scale
            </label>
            <select
              value={cardScale}
              onChange={(e) => setCardScale(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="standard">Standard Official ID (85.6 × 54 mm)</option>
              <option value="large">Large / Zoomed (110 × 70 mm)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
              Top Header Title
            </label>
            <input
              type="text"
              value={headerNote}
              onChange={(e) => setHeaderNote(e.target.value)}
              placeholder="e.g. COPY OF ORIGINAL"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleMergeIdCard}
            disabled={!frontPreview || !backPreview || isProcessing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Generate 2-in-1 Printable A4 Document</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="CNIC / ID Card 2-in-1 Document Ready!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="CNIC 2-in-1 Merge"
          infoBadge="A4 Printable PDF"
        />
      )}
    </div>
  );
};
