import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Printer,
  Sparkles,
  Share2,
  CheckCircle2,
  Building,
  User,
} from 'lucide-react';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { shareViaWhatsApp, trackActionAndCheckRatePrompt } from '../../utils/share';

interface InvoiceMakerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export const InvoiceMakerView: React.FC<InvoiceMakerViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  // Business Details
  const [businessName, setBusinessName] = useState<string>('Rasheed Graphix & Digital Studio');
  const [businessContact, setBusinessContact] = useState<string>('0345-5067874 | rasheedgraphix@gmail.com');
  const [businessAddress, setBusinessAddress] = useState<string>('Office #4, Commercial Market, Rawalpindi');

  // Client Details
  const [clientName, setClientName] = useState<string>('Mr. Nouman Ali');
  const [clientContact, setClientContact] = useState<string>('0300-1234567');

  // Invoice Meta
  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-2026-101');
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [currency, setCurrency] = useState<string>('Rs.');

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: 'Brochure & Certificate Graphic Designing', quantity: 1, rate: 3500 },
    { id: '2', description: 'Document Scanning & High-Res PDF Conversion', quantity: 25, rate: 60 },
  ]);

  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('Thank you for choosing RasheedGraphix! 100% satisfaction guaranteed.');

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        description: 'New Service / Item',
        quantity: 1,
        rate: 500,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const grandTotal = Math.max(0, subtotal + taxAmount - discount);

  // Generate PDF Invoice via pdf-lib
  const handleGeneratePdf = async () => {
    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    try {
      const pdfDoc = await PDFDocument.create();
      // Standard A4 dimensions: 595.28 x 841.89
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Top Header Bar
      page.drawRectangle({
        x: 0,
        y: height - 90,
        width: width,
        height: 90,
        color: rgb(0.06, 0.09, 0.16),
      });

      page.drawText(businessName.toUpperCase(), {
        x: 40,
        y: height - 45,
        size: 16,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText(businessContact, {
        x: 40,
        y: height - 65,
        size: 9,
        font: fontRegular,
        color: rgb(0.8, 0.8, 0.8),
      });

      page.drawText('INVOICE', {
        x: width - 150,
        y: height - 45,
        size: 20,
        font: fontBold,
        color: rgb(0.95, 0.77, 0.2), // Gold
      });

      page.drawText(`#${invoiceNumber}`, {
        x: width - 150,
        y: height - 65,
        size: 11,
        font: fontRegular,
        color: rgb(1, 1, 1),
      });

      // Bill To & Invoice Info Box
      const topInfoY = height - 125;

      page.drawText('BILLED TO:', {
        x: 40,
        y: topInfoY,
        size: 9,
        font: fontBold,
        color: rgb(0.4, 0.4, 0.4),
      });

      page.drawText(clientName, {
        x: 40,
        y: topInfoY - 16,
        size: 12,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      if (clientContact) {
        page.drawText(clientContact, {
          x: 40,
          y: topInfoY - 30,
          size: 9,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      page.drawText(`Date: ${invoiceDate}`, {
        x: width - 170,
        y: topInfoY,
        size: 9,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Table Header
      const tableY = topInfoY - 60;
      page.drawRectangle({
        x: 40,
        y: tableY - 18,
        width: width - 80,
        height: 24,
        color: rgb(0.94, 0.95, 0.96),
      });

      page.drawText('DESCRIPTION', { x: 50, y: tableY - 12, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText('QTY', { x: 330, y: tableY - 12, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText('RATE', { x: 390, y: tableY - 12, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText('AMOUNT', { x: 470, y: tableY - 12, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });

      // Table Rows
      let currentY = tableY - 38;
      items.forEach((item) => {
        const itemTotal = item.quantity * item.rate;

        page.drawText(item.description.slice(0, 48), {
          x: 50,
          y: currentY,
          size: 9,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15),
        });

        page.drawText(item.quantity.toString(), {
          x: 335,
          y: currentY,
          size: 9,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15),
        });

        page.drawText(`${currency} ${item.rate.toLocaleString()}`, {
          x: 390,
          y: currentY,
          size: 9,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15),
        });

        page.drawText(`${currency} ${itemTotal.toLocaleString()}`, {
          x: 470,
          y: currentY,
          size: 9,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // divider line
        page.drawLine({
          start: { x: 40, y: currentY - 6 },
          end: { x: width - 40, y: currentY - 6 },
          thickness: 0.5,
          color: rgb(0.9, 0.9, 0.9),
        });

        currentY -= 22;
      });

      // Totals Box
      const totalsY = currentY - 20;

      page.drawText(`Subtotal:`, { x: 370, y: totalsY, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(`${currency} ${subtotal.toLocaleString()}`, { x: 470, y: totalsY, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

      if (discount > 0) {
        page.drawText(`Discount:`, { x: 370, y: totalsY - 16, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
        page.drawText(`- ${currency} ${discount.toLocaleString()}`, { x: 470, y: totalsY - 16, size: 9, font: fontRegular, color: rgb(0.8, 0.2, 0.2) });
      }

      // Grand Total Bar
      const grandY = totalsY - (discount > 0 ? 36 : 22);
      page.drawRectangle({
        x: 360,
        y: grandY - 8,
        width: width - 400,
        height: 24,
        color: rgb(0.06, 0.09, 0.16),
      });

      page.drawText(`TOTAL DUE:`, { x: 370, y: grandY, size: 9, font: fontBold, color: rgb(1, 1, 1) });
      page.drawText(`${currency} ${grandTotal.toLocaleString()}`, {
        x: 460,
        y: grandY,
        size: 11,
        font: fontBold,
        color: rgb(0.95, 0.77, 0.2),
      });

      // Notes Footer
      if (notes.trim()) {
        page.drawText('Notes / Terms:', { x: 40, y: grandY - 30, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText(notes.trim(), { x: 40, y: grandY - 44, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
      }

      // Bottom Branding
      page.drawText('Generated with AllDocKit Suite (RasheedGraphix)', {
        x: 40,
        y: 30,
        size: 7,
        font: fontRegular,
        color: rgb(0.6, 0.6, 0.6),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = `Invoice_${invoiceNumber}.pdf`;

      setResult({ blob, fileName, size: blob.size });

      onAddToHistory({
        toolId: 'invoice-maker',
        toolName: 'Instant Invoice & Receipt Maker',
        originalName: `${clientName} (${currency} ${grandTotal.toLocaleString()})`,
        resultName: fileName,
        originalSize: 0,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });

      trackActionAndCheckRatePrompt();
    } catch (err: any) {
      console.error('Invoice error:', err);
      alert('Failed to generate invoice PDF.');
    }
  };

  const handleWhatsAppSend = () => {
    shareViaWhatsApp({
      title: `Invoice #${invoiceNumber} from ${businessName}`,
      message: `Dear ${clientName},\n\nHere is your invoice #${invoiceNumber} for ${currency} ${grandTotal.toLocaleString()}.\n\nItems: ${items.map((i) => i.description).join(', ')}.\n\nThank you!`,
      toolName: 'Invoice Maker',
    });
    trackActionAndCheckRatePrompt();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            <span>Instant Invoice & Cash Receipt Maker</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Create clean, professional PDF invoices and bills with automated totals, currency, and WhatsApp sharing.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20">
          <span>🧾 100% Offline Billing</span>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-5 shadow-sm">
        {/* Business & Client Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-4 border-b border-stone-200 dark:border-stone-800">
          {/* Business Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-500" />
              <span>Your Business Details</span>
            </h3>
            <div>
              <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                Business / Freelancer Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                Phone & Email
              </label>
              <input
                type="text"
                value={businessContact}
                onChange={(e) => setBusinessContact(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Client Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-500" />
              <span>Client / Customer Info</span>
            </h3>
            <div>
              <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Invoice #
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Invoice Items / Services
            </h3>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-2 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-950 items-center text-xs"
              >
                <div className="col-span-6">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                    placeholder="Qty"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-center"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))}
                    placeholder="Rate"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-right"
                  />
                </div>
                <div className="col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length <= 1}
                    className="p-1 text-stone-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calculation & Summary Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
          <div className="text-xs space-y-1">
            <div className="text-stone-500">
              Subtotal: <strong>{currency} {subtotal.toLocaleString()}</strong>
            </div>
            {discount > 0 && (
              <div className="text-red-500">
                Discount: <strong>- {currency} {discount.toLocaleString()}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Grand Total:</span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {currency} {grandTotal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleGeneratePdf}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Generate PDF Invoice</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppSend}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Send Details on WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="Professional PDF Invoice Generated!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="Instant Invoice Maker"
          infoBadge={`Total: ${currency} ${grandTotal.toLocaleString()}`}
        />
      )}
    </div>
  );
};
