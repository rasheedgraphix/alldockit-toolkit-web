import React, { useState, useEffect, useRef } from 'react';
import {
  BadgeCheck,
  Download,
  CheckCircle2,
  Printer,
  Upload,
} from 'lucide-react';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface IdCardMakerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const IdCardMakerView: React.FC<IdCardMakerViewProps> = ({ onAddToHistory }) => {
  const [orgName, setOrgName] = useState('RASHEED GRAPHIX ACADEMY');
  const [orgSubtitle, setOrgSubtitle] = useState('Official Staff / Student Identity Card');
  const [fullName, setFullName] = useState('Hafiz Nouman Rasheed');
  const [designation, setDesignation] = useState('Senior Graphic & Software Engineer');
  const [idNumber, setIdNumber] = useState('RG-2026-089');
  const [department, setDepartment] = useState('IT & Digital Media');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [phone, setPhone] = useState('+92 300 1234567');
  const [validThru, setValidThru] = useState('DEC 2028');
  const [address, setAddress] = useState('If found, please return to main administration office.');
  const [themeColor, setThemeColor] = useState('#1E40AF');

  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.onload = () => setPhotoImg(el);
    el.src = url;
  };

  useEffect(() => {
    let active = true;
    const renderCards = async () => {
      const fCanvas = frontCanvasRef.current;
      const bCanvas = backCanvasRef.current;
      if (!fCanvas || !bCanvas) return;

      // CR80 Portrait High-Res Canvas (638 x 1012 px @ 300 DPI)
      const W = 638;
      const H = 1012;
      fCanvas.width = W;
      fCanvas.height = H;
      bCanvas.width = W;
      bCanvas.height = H;

      const fCtx = fCanvas.getContext('2d');
      const bCtx = bCanvas.getContext('2d');
      if (!fCtx || !bCtx) return;

      // --- DRAW FRONT CARD ---
      fCtx.fillStyle = '#FFFFFF';
      fCtx.fillRect(0, 0, W, H);

      // Header Banner
      fCtx.fillStyle = themeColor;
      fCtx.fillRect(0, 0, W, 240);

      // Accent gold/light stripe
      fCtx.fillStyle = '#F59E0B';
      fCtx.fillRect(0, 240, W, 14);

      // Org Name
      fCtx.fillStyle = '#FFFFFF';
      fCtx.textAlign = 'center';
      fCtx.font = 'bold 30px sans-serif';
      fCtx.fillText(orgName.slice(0, 32), W / 2, 95);

      fCtx.font = '20px sans-serif';
      fCtx.fillStyle = '#E2E8F0';
      fCtx.fillText(orgSubtitle.slice(0, 42), W / 2, 135);

      // Photo Circle / Rounded Box
      const photoSize = 240;
      const photoX = (W - photoSize) / 2;
      const photoY = 170;

      fCtx.fillStyle = '#FFFFFF';
      fCtx.fillRect(photoX - 10, photoY - 10, photoSize + 20, photoSize + 20);

      fCtx.strokeStyle = themeColor;
      fCtx.lineWidth = 6;
      fCtx.strokeRect(photoX - 10, photoY - 10, photoSize + 20, photoSize + 20);

      if (photoImg) {
        fCtx.drawImage(photoImg, photoX, photoY, photoSize, photoSize);
      } else {
        fCtx.fillStyle = '#F1F5F9';
        fCtx.fillRect(photoX, photoY, photoSize, photoSize);
        fCtx.fillStyle = '#64748B';
        fCtx.font = 'bold 22px sans-serif';
        fCtx.fillText('UPLOAD PHOTO', W / 2, photoY + photoSize / 2);
      }

      // Person Name & Role
      fCtx.fillStyle = '#0F172A';
      fCtx.font = 'bold 36px sans-serif';
      fCtx.fillText(fullName.slice(0, 28), W / 2, 485);

      fCtx.fillStyle = themeColor;
      fCtx.font = 'bold 24px sans-serif';
      fCtx.fillText(designation.slice(0, 36), W / 2, 528);

      // Info Table on Front
      fCtx.textAlign = 'left';
      const rows = [
        ['ID NUMBER:', idNumber],
        ['DEPARTMENT:', department],
        ['BLOOD GROUP:', bloodGroup],
        ['PHONE:', phone],
        ['VALID THRU:', validThru],
      ];

      let startY = 605;
      for (const [label, val] of rows) {
        fCtx.fillStyle = '#64748B';
        fCtx.font = 'bold 22px sans-serif';
        fCtx.fillText(label, 75, startY);

        fCtx.fillStyle = '#0F172A';
        fCtx.font = 'bold 24px sans-serif';
        fCtx.fillText(val, 275, startY);
        startY += 56;
      }

      // Bottom Footer bar
      fCtx.fillStyle = themeColor;
      fCtx.fillRect(0, H - 65, W, 65);
      fCtx.fillStyle = '#FFFFFF';
      fCtx.textAlign = 'center';
      fCtx.font = 'bold 20px sans-serif';
      fCtx.fillText(`ID: ${idNumber}  •  AUTHORIZED HOLDER`, W / 2, H - 25);

      // --- DRAW BACK CARD ---
      bCtx.fillStyle = '#FFFFFF';
      bCtx.fillRect(0, 0, W, H);

      // Top magnetic-style bar
      bCtx.fillStyle = '#0F172A';
      bCtx.fillRect(0, 50, W, 90);

      bCtx.fillStyle = '#0F172A';
      bCtx.textAlign = 'center';
      bCtx.font = 'bold 28px sans-serif';
      bCtx.fillText('VERIFICATION & TERMS', W / 2, 220);

      // Generate QR code with full card verification payload
      try {
        const qrPayload = `ORG:${orgName}|NAME:${fullName}|ID:${idNumber}|DEPT:${department}|VALID:${validThru}`;
        const qrUrl = await QRCode.toDataURL(qrPayload, { width: 300, margin: 1 });
        if (!active) return;
        const qrImg = await new Promise<HTMLImageElement>((res) => {
          const el = new Image();
          el.onload = () => res(el);
          el.src = qrUrl;
        });
        bCtx.drawImage(qrImg, (W - 280) / 2, 260, 280, 280);
      } catch {
        // Ignore QR fallback
      }

      bCtx.fillStyle = '#334155';
      bCtx.font = '21px sans-serif';
      bCtx.fillText('Scan QR Code to verify holder identity.', W / 2, 585);
      bCtx.fillText(address.slice(0, 48), W / 2, 650);
      bCtx.fillText(`Emergency Contact: ${phone}`, W / 2, 700);

      // Signature Line
      bCtx.strokeStyle = '#94A3B8';
      bCtx.lineWidth = 3;
      bCtx.beginPath();
      bCtx.moveTo(140, 840);
      bCtx.lineTo(W - 140, 840);
      bCtx.stroke();

      bCtx.fillStyle = '#475569';
      bCtx.font = 'bold 20px sans-serif';
      bCtx.fillText('Authorized Issuing Authority Signature', W / 2, 875);

      bCtx.fillStyle = themeColor;
      bCtx.fillRect(0, H - 65, W, 65);
      bCtx.fillStyle = '#FFFFFF';
      bCtx.font = 'bold 20px sans-serif';
      bCtx.fillText(orgName.slice(0, 35), W / 2, H - 25);
    };

    renderCards();
    return () => {
      active = false;
    };
  }, [
    orgName,
    orgSubtitle,
    fullName,
    designation,
    idNumber,
    department,
    bloodGroup,
    phone,
    validThru,
    address,
    themeColor,
    photoImg,
  ]);

  const handleExportPdf = async () => {
    const fCanvas = frontCanvasRef.current;
    const bCanvas = backCanvasRef.current;
    if (!fCanvas || !bCanvas) return;

    const pdfDoc = await PDFDocument.create();
    // A4 Portrait page (595.28 x 841.89 pt) with Front & Back side-by-side at exact CR80 size (153 x 243 pt = 2.125" x 3.375")
    const page = pdfDoc.addPage([595.28, 841.89]);

    const toBytes = (c: HTMLCanvasElement) => {
      const url = c.toDataURL('image/jpeg', 0.95);
      const b64 = url.split(',')[1];
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    };

    const embFront = await pdfDoc.embedJpg(toBytes(fCanvas));
    const embBack = await pdfDoc.embedJpg(toBytes(bCanvas));

    const cardW = 153.07; // 54mm in points
    const cardH = 242.65; // 85.6mm in points

    // Place Front and Back side by side on top half of A4 for easy folding/lamination
    page.drawImage(embFront, { x: 120, y: 520, width: cardW, height: cardH });
    page.drawImage(embBack, { x: 310, y: 520, width: cardW, height: cardH });

    const outBytes = await pdfDoc.save();
    const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
    const fileName = `ID_Card_${idNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_PrintReady.pdf`;

    setResult({
      blob,
      fileName,
      size: blob.size,
    });

    onAddToHistory({
      toolId: 'id-card-maker',
      toolName: 'Employee & Student ID Card Maker',
      originalName: fullName,
      resultName: fileName,
      originalSize: blob.size,
      resultSize: blob.size,
      savedBytes: 0,
    });
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <BadgeCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Employee & Student ID Card Studio (Front & Back + QR)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Design instant CR80 PVC / Lamination ID cards with photo, blood group, and QR verification code ready to print on A4.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Controls (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Organization / School Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Card Subtitle
                </label>
                <input
                  type="text"
                  value={orgSubtitle}
                  onChange={(e) => setOrgSubtitle(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Designation / Class
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ID / Roll No
                </label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Blood Group
                </label>
                <input
                  type="text"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phone / Emergency
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Valid Thru Date
                </label>
                <input
                  type="text"
                  value={validThru}
                  onChange={(e) => setValidThru(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Upload Holder Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Brand Theme Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-500">{themeColor}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportPdf}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Generate Print-Ready A4 ID Card PDF
            </button>
          </div>

          {/* Live Front & Back Preview (6 cols) */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-3 bg-slate-100 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-slate-500 mb-1.5">FRONT SIDE</span>
              <canvas
                ref={frontCanvasRef}
                className="w-full max-w-[210px] rounded-xl shadow-md border border-slate-300 bg-white"
              />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-slate-500 mb-1.5">BACK SIDE (QR)</span>
              <canvas
                ref={backCanvasRef}
                className="w-full max-w-[210px] rounded-xl shadow-md border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                    Print-Ready ID Card Sheet Ready: {result.fileName}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Exact CR80 Lamination / PVC Size on A4 • {formatBytes(result.size)}
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
              title="ID Card Front & Back PDF Ready!"
              blob={result.blob}
              fileName={result.fileName}
              fileSize={result.size}
              infoBadge="Front + Back CR80"
            />
          </div>
        )}
      </div>
    </div>
  );
};
