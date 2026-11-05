import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileCode,
  Download,
  Printer,
  Copy,
  Check,
  Upload,
  Sparkles,
  Sliders,
  Eye,
  Trash2,
  ShieldCheck,
  Zap,
  Maximize2,
  Settings2,
  HelpCircle,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface HtmlToPdfViewProps {
  onAddToHistory?: (historyItem: any) => void;
}

export interface PageFormatDef {
  id: string;
  name: string;
  category: 'Smart Auto' | 'Standard ISO A' | 'North American' | 'ISO B' | 'Receipts & Labels' | 'Custom';
  widthMm: number;
  heightMm: number;
}

export const PAGE_FORMATS: PageFormatDef[] = [
  // Smart Auto
  { id: 'auto', name: '🎯 Auto Detect (Smart Fit from Content & CSS)', category: 'Smart Auto', widthMm: 210, heightMm: 297 },

  // Standard ISO A
  { id: 'a4', name: '📄 A4 (210 × 297 mm) - Standard Office', category: 'Standard ISO A', widthMm: 210, heightMm: 297 },
  { id: 'a3', name: '📄 A3 (297 × 420 mm) - Poster / Ledger', category: 'Standard ISO A', widthMm: 297, heightMm: 420 },
  { id: 'a5', name: '📄 A5 (148 × 210 mm) - Booklet / Diary', category: 'Standard ISO A', widthMm: 148, heightMm: 210 },
  { id: 'a6', name: '📄 A6 (105 × 148 mm) - Postcard / Pocket', category: 'Standard ISO A', widthMm: 105, heightMm: 148 },
  { id: 'a2', name: '📄 A2 (420 × 594 mm) - Architecture', category: 'Standard ISO A', widthMm: 420, heightMm: 594 },
  { id: 'a1', name: '📄 A1 (594 × 841 mm) - Engineering Blueprint', category: 'Standard ISO A', widthMm: 594, heightMm: 841 },
  { id: 'a0', name: '📄 A0 (841 × 1189 mm) - Large Wall Poster', category: 'Standard ISO A', widthMm: 841, heightMm: 1189 },

  // North American
  { id: 'letter', name: '📋 US Letter (8.5 × 11 in / 216 × 279 mm)', category: 'North American', widthMm: 215.9, heightMm: 279.4 },
  { id: 'legal', name: '📜 US Legal (8.5 × 14 in / 216 × 356 mm)', category: 'North American', widthMm: 215.9, heightMm: 355.6 },
  { id: 'tabloid', name: '📑 Tabloid (11 × 17 in / 279 × 432 mm)', category: 'North American', widthMm: 279.4, heightMm: 431.8 },
  { id: 'ledger', name: '📑 Ledger (17 × 11 in / 432 × 279 mm)', category: 'North American', widthMm: 431.8, heightMm: 279.4 },
  { id: 'executive', name: '💼 Executive (7.25 × 10.5 in / 184 × 267 mm)', category: 'North American', widthMm: 184.1, heightMm: 266.7 },

  // ISO B
  { id: 'b4', name: '🏷️ B4 (250 × 353 mm) - Books & Files', category: 'ISO B', widthMm: 250, heightMm: 353 },
  { id: 'b5', name: '🏷️ B5 (176 × 250 mm) - Manuals & Textbooks', category: 'ISO B', widthMm: 176, heightMm: 250 },

  // Commercial & Receipts
  { id: 'pos_receipt_80', name: '🧾 Thermal POS Receipt (80 mm roll)', category: 'Receipts & Labels', widthMm: 80, heightMm: 200 },
  { id: 'pos_receipt_58', name: '🧾 Thermal POS Receipt (58 mm roll)', category: 'Receipts & Labels', widthMm: 58, heightMm: 160 },
  { id: 'shipping_4x6', name: '📦 Shipping Label (4 × 6 in / 102 × 152 mm)', category: 'Receipts & Labels', widthMm: 101.6, heightMm: 152.4 },
  { id: 'id_card', name: '💳 Business / ID Card (85 × 54 mm)', category: 'Receipts & Labels', widthMm: 85, heightMm: 54 },
  { id: 'envelope_dl', name: '✉️ DL Envelope (110 × 220 mm)', category: 'Receipts & Labels', widthMm: 110, heightMm: 220 },

  // Custom
  { id: 'custom', name: '📐 Custom Dimensions (User Defined mm)...', category: 'Custom', widthMm: 210, heightMm: 297 },
];

const PRESET_TEMPLATES = [
  {
    id: 'invoice',
    name: '🧾 Business Invoice',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #1e293b; background: #ffffff; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px; }
  .title { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
  .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }
  .invoice-meta { text-align: right; font-size: 13px; color: #475569; }
  .details-grid { display: flex; gap: 20px; margin-bottom: 28px; }
  .box { flex: 1; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; }
  .box-title { font-weight: 700; color: #0f172a; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th { background: #0f172a; color: #ffffff; text-align: left; padding: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
  td { padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
  .text-right { text-align: right; }
  .total-card { margin-left: auto; width: 280px; background: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 13px; border: 1px solid #e2e8f0; }
  .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; color: #475569; }
  .grand-total { font-weight: 800; font-size: 18px; color: #0f172a; border-top: 2px solid #cbd5e1; padding-top: 10px; margin-top: 6px; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">ALLDOCKIT ENTERPRISE</h1>
      <div class="subtitle">Official Service Invoice & Statement</div>
    </div>
    <div class="invoice-meta">
      <div><strong>Invoice #:</strong> INV-2026-0982</div>
      <div><strong>Date:</strong> September 24, 2026</div>
      <div><strong>Payment Status:</strong> <span style="color:#16a34a; font-weight:bold;">PAID</span></div>
    </div>
  </div>

  <div class="details-grid">
    <div class="box">
      <div class="box-title">Billed To:</div>
      <div style="font-weight: bold; color: #0f172a;">Hafiz Nouman Rasheed</div>
      <div>Senior Technology Lead</div>
      <div>Global Media Solutions Ltd</div>
      <div>Email: client@example.com</div>
    </div>
    <div class="box">
      <div class="box-title">Payment Account:</div>
      <div><strong>Bank:</strong> Standard Chartered</div>
      <div><strong>IBAN:</strong> PK78-SCBL-0001-9876-5432</div>
      <div><strong>Transaction Ref:</strong> TXN-994821</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Rate</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Document Automation Suite:</strong> Offline PDF & HTML conversion pipelines</td>
        <td class="text-right">1</td>
        <td class="text-right">$250.00</td>
        <td class="text-right">$250.00</td>
      </tr>
      <tr>
        <td><strong>High-Resolution Engine Optimization:</strong> Vector rendering and typography layout</td>
        <td class="text-right">1</td>
        <td class="text-right">$150.00</td>
        <td class="text-right">$150.00</td>
      </tr>
    </tbody>
  </table>

  <div class="total-card">
    <div class="total-row"><span>Subtotal:</span> <span>$400.00</span></div>
    <div class="total-row"><span>Sales Tax (0%):</span> <span>$0.00</span></div>
    <div class="total-row grand-total"><span>Total Amount:</span> <span>$400.00</span></div>
  </div>

  <div class="footer">
    Thank you for choosing AllDocKit Toolkit. 100% Client-Side Private Document Processing.
  </div>
</body>
</html>`,
  },
  {
    id: 'receipt',
    name: '🧾 POS 80mm Cash Receipt',
    html: `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  body { width: 72mm; margin: 0 auto; padding: 10px 4px; font-family: monospace; font-size: 11px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .title { font-size: 14px; font-weight: bold; text-align: center; }
  .total { font-size: 13px; font-weight: bold; }
</style>
</head>
<body>
  <div class="title">ALLDOCKIT SUPER MART</div>
  <div class="center">Main Boulevard, Lahore, Pakistan</div>
  <div class="center">Tel: 042-35889900</div>
  <div class="line"></div>
  <div class="row"><span>Date: 24/09/2026</span><span>Time: 14:32</span></div>
  <div class="row"><span>Cashier: Ali</span><span>Bill #: 00982</span></div>
  <div class="line"></div>
  <div class="row bold"><span>Item</span><span>Qty</span><span>Total</span></div>
  <div class="row"><span>A4 Printing Paper</span><span>2</span><span>Rs 1,600</span></div>
  <div class="row"><span>Document Laminate</span><span>5</span><span>Rs 250</span></div>
  <div class="row"><span>Gel Pen 0.7mm</span><span>3</span><span>Rs 150</span></div>
  <div class="line"></div>
  <div class="row total"><span>GRAND TOTAL</span><span>Rs 2,000</span></div>
  <div class="row"><span>Cash Paid</span><span>Rs 2,000</span></div>
  <div class="row"><span>Change</span><span>Rs 0</span></div>
  <div class="line"></div>
  <div class="center bold">THANK YOU FOR YOUR VISIT!</div>
  <div class="center">Software by AllDocKit Toolkit</div>
</body>
</html>`,
  },
  {
    id: 'urdu_doc',
    name: '📜 اردو سرٹیفکیٹ / تصدیق نامہ',
    html: `<!DOCTYPE html>
<html lang="ur" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Scheherazade New', Tahoma, sans-serif; margin: 0; padding: 40px; color: #1e293b; background: #ffffff; text-align: right; }
  .cert-container { border: 6px double #065f46; padding: 32px; border-radius: 16px; background: #f0fdf4; }
  .bismillah { text-align: center; font-size: 26px; color: #047857; margin-bottom: 20px; font-weight: bold; }
  .cert-title { text-align: center; font-size: 32px; font-weight: bold; color: #064e3b; margin-bottom: 24px; border-bottom: 2px solid #a7f3d0; padding-bottom: 12px; }
  .content { font-size: 20px; line-height: 2.4; color: #1f2937; margin-bottom: 40px; text-align: justify; }
  .sign-area { display: flex; justify-content: space-between; margin-top: 50px; font-size: 18px; }
  .sign-box { text-align: center; width: 220px; border-top: 2px solid #065f46; padding-top: 8px; font-weight: bold; color: #064e3b; }
</style>
</head>
<body>
  <div class="cert-container">
    <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
    <div class="cert-title">سندِ حسنِ کارکردگی و امتیاز</div>
    <div class="content">
      تصدیق کی جاتی ہے کہ محترم <strong>حافظ نعمان رشید</strong> نے اپنی غیر معمولی محنت، لگن اور فنی مہارت سے پکس ڈاک سٹوڈیو کو مکمل طور پر آف لائن اور جدید ترین معیار پر استوار کیا ہے۔ ادارہ ان کی ان گرانقدر خدمات کو قدر کی نگاہ سے دیکھتا ہے اور ان کے روشن مستقبل کے لیے دعا گو ہے۔
    </div>
    <div class="sign-area">
      <div class="sign-box">دستخط ڈائریکٹر جنرل</div>
      <div class="sign-box">بتاریخ: ۲۴ ستمبر ۲۰۲۶ء</div>
    </div>
  </div>
</body>
</html>`,
  },
];

export const HtmlToPdfView: React.FC<HtmlToPdfViewProps> = ({ onAddToHistory }) => {
  const [htmlCode, setHtmlCode] = useState<string>(PRESET_TEMPLATES[0].html);
  const [pageSize, setPageSize] = useState<string>('auto');
  const [customWidth, setCustomWidth] = useState<number>(210);
  const [customHeight, setCustomHeight] = useState<number>(297);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [marginSize, setMarginSize] = useState<'none' | 'compact' | 'normal' | 'wide'>('normal');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [autoDetectedInfo, setAutoDetectedInfo] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync iframe preview safely
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlCode);
        doc.close();
      }
    }
  }, [htmlCode]);

  // Smart Auto-Detect Engine: measures content and inspects CSS @page rules
  const runAutoDetect = () => {
    // 1. Look for @page size in CSS
    const pageMatch = htmlCode.match(/@page\s*\{[^}]*size:\s*([^;}\n]+)/i);
    if (pageMatch) {
      const sizeVal = pageMatch[1].trim().toLowerCase();
      if (sizeVal.includes('landscape')) setOrientation('landscape');
      if (sizeVal.includes('portrait')) setOrientation('portrait');

      // Check for mm dimensions e.g., 80mm
      const mmMatch = sizeVal.match(/([\d.]+)\s*mm/);
      if (mmMatch) {
        const detectedMm = parseFloat(mmMatch[1]);
        if (detectedMm <= 85) {
          setPageSize('pos_receipt_80');
          setAutoDetectedInfo(`CSS @page detected: POS 80mm Thermal Receipt (${detectedMm}mm)`);
          return;
        }
      }

      for (const fmt of PAGE_FORMATS) {
        if (fmt.id !== 'auto' && fmt.id !== 'custom' && sizeVal.includes(fmt.id)) {
          setPageSize(fmt.id);
          setAutoDetectedInfo(`CSS @page detected: ${fmt.name}`);
          return;
        }
      }
    }

    // 2. Measure from rendered DOM inside iframe
    if (iframeRef.current && iframeRef.current.contentDocument) {
      const doc = iframeRef.current.contentDocument;
      const body = doc.body;
      const root = doc.documentElement;
      if (body) {
        const scrollW = Math.max(body.scrollWidth, root.scrollWidth, 200);
        const scrollH = Math.max(body.scrollHeight, root.scrollHeight, 200);

        // Convert px to mm (standard 96 DPI: 1px = 25.4 / 96 = 0.264583 mm)
        const docWidthMm = Math.round(scrollW * (25.4 / 96));
        const docHeightMm = Math.round(scrollH * (25.4 / 96));

        if (scrollW > scrollH * 1.05) {
          setOrientation('landscape');
        } else {
          setOrientation('portrait');
        }

        // Small width (POS receipt or Label)
        if (docWidthMm <= 85) {
          setPageSize('pos_receipt_80');
          setAutoDetectedInfo(`Auto-detected: POS Thermal Receipt (Width: ${docWidthMm}mm)`);
          return;
        } else if (docWidthMm <= 105 && docHeightMm <= 160) {
          setPageSize('shipping_4x6');
          setAutoDetectedInfo(`Auto-detected: Shipping Label (${docWidthMm} × ${docHeightMm} mm)`);
          return;
        }

        // Closest standard matching
        const aspect = scrollW / scrollH;
        if (Math.abs(aspect - 297 / 210) < 0.2 || Math.abs(aspect - 210 / 297) < 0.2) {
          setPageSize('a4');
          setAutoDetectedInfo(`Auto-detected: Standard A4 (${docWidthMm} × ${docHeightMm} mm)`);
          return;
        }

        // Fit custom document size
        setPageSize('custom');
        setCustomWidth(Math.max(docWidthMm, 50));
        setCustomHeight(Math.max(docHeightMm, 50));
        setAutoDetectedInfo(`Auto-fitted Custom Page: ${docWidthMm} × ${docHeightMm} mm`);
        return;
      }
    }

    setPageSize('a4');
    setAutoDetectedInfo('Auto-detected: Standard A4 (210 × 297 mm)');
  };

  // Run auto-detect whenever code changes if mode is auto
  useEffect(() => {
    if (pageSize === 'auto') {
      const timer = setTimeout(runAutoDetect, 400);
      return () => clearTimeout(timer);
    }
  }, [htmlCode, pageSize]);

  // Handle HTML File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setHtmlCode(content);
        setStatusMsg(`Loaded file: ${file.name}`);
        setTimeout(runAutoDetect, 300);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Get active millimeter dimensions based on current selection
  const getActiveDimensions = (): { widthMm: number; heightMm: number; label: string } => {
    if (pageSize === 'custom') {
      return {
        widthMm: orientation === 'landscape' ? Math.max(customHeight, customWidth) : Math.min(customHeight, customWidth),
        heightMm: orientation === 'landscape' ? Math.min(customHeight, customWidth) : Math.max(customHeight, customWidth),
        label: `Custom (${customWidth} × ${customHeight} mm)`,
      };
    }

    const found = PAGE_FORMATS.find((f) => f.id === pageSize);
    if (!found || pageSize === 'auto') {
      // Default A4
      return {
        widthMm: orientation === 'landscape' ? 297 : 210,
        heightMm: orientation === 'landscape' ? 210 : 297,
        label: 'A4 (210 × 297 mm)',
      };
    }

    return {
      widthMm: orientation === 'landscape' ? Math.max(found.heightMm, found.widthMm) : Math.min(found.heightMm, found.widthMm),
      heightMm: orientation === 'landscape' ? Math.min(found.heightMm, found.widthMm) : Math.max(found.heightMm, found.widthMm),
      label: found.name,
    };
  };

  // Instant Offline PDF Download (Bulletproof with Zero Scale Errors)
  const handleDownloadPdf = async () => {
    if (!htmlCode.trim()) return;

    setIsGenerating(true);
    setStatusMsg('Rendering high-resolution document...');

    const dims = getActiveDimensions();
    // Convert mm to screen pixels (at 96 DPI: 1mm = 3.7795px)
    const targetWidth = Math.round(dims.widthMm * 3.7795);

    // Overlay to provide smooth user experience while in-viewport capture occurs
    const overlay = document.createElement('div');
    overlay.id = 'pixdoc-render-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(4px)';

    const modalBox = document.createElement('div');
    modalBox.style.background = '#ffffff';
    modalBox.style.padding = '24px 36px';
    modalBox.style.borderRadius = '16px';
    modalBox.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.3)';
    modalBox.style.textAlign = 'center';
    modalBox.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    modalBox.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">Generating PDF...</div>
      <div style="font-size: 12px; color: #64748b;">Target Size: ${dims.label}</div>
    `;
    overlay.appendChild(modalBox);

    // Staging container directly in-viewport at top:0, left:0 with explicit width and min-height
    const stage = document.createElement('div');
    stage.id = 'pixdoc-render-stage';
    stage.style.position = 'fixed';
    stage.style.top = '0';
    stage.style.left = '0';
    stage.style.width = `${targetWidth}px`;
    stage.style.minHeight = '600px';
    stage.style.background = '#ffffff';
    stage.style.color = '#1e293b';
    stage.style.zIndex = '999998';
    stage.style.overflow = 'visible';

    // Parse htmlCode cleanly using DOMParser
    try {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(htmlCode, 'text/html');

      let stylesHtml = '';
      parsedDoc.querySelectorAll('style').forEach((s) => {
        const css = s.innerHTML.replace(/(\s|^)(body|html)(\s*\{)/gi, '$1#pixdoc-render-stage$3');
        stylesHtml += `<style>${css}</style>\n`;
      });

      let linksHtml = '';
      parsedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
        linksHtml += l.outerHTML + '\n';
      });

      const bodyHtml = parsedDoc.body ? parsedDoc.body.innerHTML : htmlCode;
      stage.innerHTML = `${linksHtml}${stylesHtml}<div style="width:100%; min-height:100%;">${bodyHtml}</div>`;
    } catch {
      stage.innerHTML = htmlCode;
    }

    document.body.appendChild(stage);
    document.body.appendChild(overlay);

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 300));

      const captureWidth = Math.max(stage.scrollWidth, stage.offsetWidth, targetWidth);
      const captureHeight = Math.max(stage.scrollHeight, stage.offsetHeight, 400);

      const canvas = await html2canvas(stage, {
        x: 0,
        y: 0,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
        scale: 2, // 2x Crisp HD
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      if (document.body.contains(stage)) document.body.removeChild(stage);
      if (document.body.contains(overlay)) document.body.removeChild(overlay);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      // Create PDF using explicit millimeter format array [width, height] to eliminate jsPDF scale crashes
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: [dims.widthMm, dims.heightMm],
      });

      const pdfPageWidth = dims.widthMm;
      const pdfPageHeight = dims.heightMm;

      const marginMap: Record<string, number> = {
        none: 0,
        compact: 4,
        normal: 10,
        wide: 18,
      };

      const safeMargin = typeof marginMap[marginSize] === 'number' ? marginMap[marginSize] : 10;
      const usableWidth = Math.max(pdfPageWidth - safeMargin * 2, 10);
      const usableHeight = Math.max(pdfPageHeight - safeMargin * 2, 10);

      const cWidth = canvas.width > 0 ? canvas.width : targetWidth;
      const cHeight = canvas.height > 0 ? canvas.height : 600;

      const renderedImgHeight = Math.max((cHeight * usableWidth) / cWidth, 10);

      let heightLeft = renderedImgHeight;
      const position = safeMargin;

      // First Page
      pdf.addImage(imgData, 'JPEG', safeMargin, position, usableWidth, renderedImgHeight, undefined, 'FAST');
      heightLeft -= usableHeight;

      // Multi-page pagination
      let pageOffset = 1;
      while (heightLeft > 4 && pageOffset < 100) {
        pdf.addPage([dims.widthMm, dims.heightMm], orientation);
        const yOffset = safeMargin - pageOffset * usableHeight;
        pdf.addImage(imgData, 'JPEG', safeMargin, yOffset, usableWidth, renderedImgHeight, undefined, 'FAST');
        heightLeft -= usableHeight;
        pageOffset++;
      }

      const fileName = `AllDocKit_Document_${Date.now()}.pdf`;
      const pdfBlob = pdf.output('blob');
      pdf.save(fileName);

      if (onAddToHistory) {
        onAddToHistory({
          id: `hist-${Date.now()}`,
          toolId: 'html-to-pdf',
          toolName: 'HTML to PDF',
          originalName: 'custom_document.html',
          resultName: fileName,
          originalSize: htmlCode.length,
          resultSize: pdfBlob.size,
          savedBytes: 0,
          timestamp: Date.now(),
          resultBlob: pdfBlob,
        });
      }

      setStatusMsg('PDF generated and downloaded successfully!');
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      if (document.body.contains(stage)) document.body.removeChild(stage);
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      setStatusMsg(`Error generating PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 100% Reliable Native Browser Print (Unblocked by iframe sandbox)
  const handlePrint = () => {
    setStatusMsg('Opening system print dialog...');

    const dims = getActiveDimensions();
    const marginCss = marginSize === 'none' ? '0' : marginSize === 'compact' ? '5mm' : marginSize === 'normal' ? '10mm' : '18mm';
    const pageCss = pageSize === 'auto' ? 'auto' : `${dims.widthMm}mm ${dims.heightMm}mm`;

    // Create an un-sandboxed hidden iframe in document body so Chrome/Firefox NEVER block print()
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      setStatusMsg('Print frame could not be initialized.');
      return;
    }

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>AllDocKit Print Document</title>
          <style>
            @page {
              size: ${pageCss};
              margin: ${marginCss};
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          ${htmlCode}
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print caught error, trying fallback:', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 4000);
      }
    }, 400);
  };

  // Copy HTML
  const handleCopyCode = () => {
    navigator.clipboard.writeText(htmlCode);
    setCopied(true);
    setStatusMsg('HTML code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Grouped Page Formats for clean dropdown UI
  const formatCategories = useMemo(() => {
    const cats: Record<string, PageFormatDef[]> = {};
    PAGE_FORMATS.forEach((fmt) => {
      if (!cats[fmt.category]) cats[fmt.category] = [];
      cats[fmt.category].push(fmt);
    });
    return cats;
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-stone-900/40 border border-blue-500/20 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              HTML to PDF Converter & Printer
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
              100% OFFLINE & AUTO-SIZE
            </span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 max-w-xl">
            Convert HTML/CSS code, invoices, receipts, Urdu certificates, and web pages into clean,
            high-resolution PDF documents with 20+ page sizes, smart auto-detect, and instant browser printing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".html,.htm,.txt"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            Upload HTML File
          </button>
        </div>
      </div>

      {/* Main Grid: Code Editor on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Code Editor & Presets */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-blue-600" />
                HTML / CSS Source Code
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => setHtmlCode('')}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* Code Textarea */}
            <textarea
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              placeholder="Paste your HTML & CSS code here..."
              className="w-full h-72 font-mono text-xs p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed"
              spellCheck={false}
            />

            {/* Presets */}
            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                Professional Presets:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRESET_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setHtmlCode(tpl.html);
                      setTimeout(runAutoDetect, 200);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-500/30 border border-stone-200 dark:border-stone-700 text-[11px] font-semibold text-stone-700 dark:text-stone-300 transition-all text-left truncate cursor-pointer"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PDF Page Size, Auto-Detect & Margins */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                Page Format & Dimensions ({PAGE_FORMATS.length} Options)
              </h2>

              <button
                type="button"
                onClick={runAutoDetect}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1 border border-blue-200 dark:border-blue-800/60 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                ⚡ Auto-Detect Size Now
              </button>
            </div>

            {/* Auto-detect badge */}
            {autoDetectedInfo && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{autoDetectedInfo}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="page-size-select" className="text-[11px] text-stone-500 font-medium block mb-1">
                  Page Size / Document Type
                </label>
                <select
                  id="page-size-select"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value)}
                  className="w-full px-2.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100"
                >
                  {Object.entries(formatCategories).map(([category, items]) => (
                    <optgroup key={category} label={`── ${category} ──`}>
                      {items.map((fmt) => (
                        <option key={fmt.id} value={fmt.id}>
                          {fmt.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="orientation-select" className="text-[11px] text-stone-500 font-medium block mb-1">
                  Orientation
                </label>
                <select
                  id="orientation-select"
                  value={orientation}
                  onChange={(e: any) => setOrientation(e.target.value)}
                  className="w-full px-2.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100"
                >
                  <option value="portrait">Portrait (Vertical)</option>
                  <option value="landscape">Landscape (Horizontal)</option>
                </select>
              </div>
            </div>

            {/* Custom Dimensions Input Row (Appears when Custom is selected) */}
            {pageSize === 'custom' && (
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-stone-600 dark:text-stone-400 font-medium block mb-1">
                    Custom Width (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="1500"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Math.max(20, parseInt(e.target.value) || 20))}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-mono font-medium text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-stone-600 dark:text-stone-400 font-medium block mb-1">
                    Custom Height (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="2000"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Math.max(20, parseInt(e.target.value) || 20))}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-mono font-medium text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="margin-select" className="text-[11px] text-stone-500 font-medium block mb-1">
                  Margins
                </label>
                <select
                  id="margin-select"
                  value={marginSize}
                  onChange={(e: any) => setMarginSize(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100"
                >
                  <option value="none">Zero Margins (0mm) - Full Edge</option>
                  <option value="compact">Compact (4mm) - Receipts & Tickets</option>
                  <option value="normal">Normal (10mm) - Standard Documents</option>
                  <option value="wide">Wide (18mm) - Formal Letters</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <span className="text-[11px] text-stone-500 font-mono">
                  Active Page: {getActiveDimensions().widthMm} × {getActiveDimensions().heightMm} mm
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Rendered Web Preview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between min-h-[540px]">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  Live Visual Document Preview
                </span>
                <span className="text-[10px] text-stone-400 font-mono">
                  {getActiveDimensions().label} • {orientation}
                </span>
              </div>

              {/* Iframe Preview Container (With allow-modals so native printing works seamlessly) */}
              <div className="my-3 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-white shadow-inner h-[380px]">
                <iframe
                  ref={iframeRef}
                  title="HTML Live Preview"
                  className="w-full h-full border-0 bg-white"
                  sandbox="allow-same-origin allow-scripts allow-modals"
                />
              </div>
            </div>

            {/* Download & Print Actions */}
            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGenerating || !htmlCode.trim()}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Download className="w-4 h-4" />
                    {isGenerating ? 'Generating PDF...' : 'Download PDF (Offline)'}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={isGenerating || !htmlCode.trim()}
                    className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Direct browser high-resolution vector print"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    Print / Save PDF
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>100% Local & Private</span>
                </div>
              </div>

              {statusMsg && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  {statusMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
