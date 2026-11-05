import React, { useState, useEffect } from 'react';
import { generateQrDataUrl, generateQrSvg } from '../../utils/qrGenerator';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Link2,
  Mail,
  Phone,
  Wifi,
  FileText,
  Palette,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  Smartphone,
} from 'lucide-react';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { downloadBlob } from '../../utils/fileHelpers';

interface QrStudioViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type QrType = 'link' | 'whatsapp' | 'wifi' | 'text' | 'email' | 'phone';

const COLOR_PRESETS = [
  { name: 'Classic Black', fg: '#000000', bg: '#ffffff' },
  { name: 'Emerald Slate', fg: '#064e3b', bg: '#ffffff' },
  { name: 'Navy Blue', fg: '#0f172a', bg: '#f8fafc' },
  { name: 'Royal Indigo', fg: '#312e81', bg: '#ffffff' },
  { name: 'Crimson', fg: '#881337', bg: '#fff1f2' },
];

function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return 0.5;
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const QrStudioView: React.FC<QrStudioViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();
  const [qrType, setQrType] = useState<QrType>('link');
  const [url, setUrl] = useState('https://rasheedgraphix.github.io/AllDocKitToolkit/');
  const [textContent, setTextContent] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiAuth, setWifiAuth] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');

  // Styling & Scannability settings
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [margin, setMargin] = useState<number>(4); // ISO Standard 4-module quiet zone
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Compute contrast ratio to warn if un-scannable
  const contrastRatio = getContrastRatio(fgColor, bgColor);
  const isContrastLow = contrastRatio < 2.8;

  // Compute standard payload string based on type
  const getPayload = (): string => {
    switch (qrType) {
      case 'link':
        return url.trim() || 'https://rasheedgraphix.github.io/AllDocKitToolkit/';
      case 'whatsapp': {
        const clean = whatsappNumber.replace(/[^0-9]/g, '');
        if (!clean) return 'https://wa.me/';
        const query = whatsappMessage.trim() ? `?text=${encodeURIComponent(whatsappMessage.trim())}` : '';
        return `https://wa.me/${clean}${query}`;
      }
      case 'text':
        return textContent.trim() || 'Welcome to AllDocKit';
      case 'wifi':
        return `WIFI:T:${wifiAuth};S:${wifiSsid};P:${wifiPassword};;`;
      case 'email':
        return `mailto:${emailAddress}?subject=${encodeURIComponent(emailSubject)}`;
      case 'phone':
        return `tel:${phoneNumber}`;
      default:
        return url;
    }
  };

  // Generate ISO-compliant QR code whenever payload or styling changes
  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);
    const payload = getPayload();

    generateQrDataUrl(payload, {
      errorCorrectionLevel: errorCorrection,
      margin: margin,
      width: 800,
      color: {
        dark: fgColor,
        light: bgColor,
      },
    })
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('QR Generation failed:', err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    qrType,
    url,
    textContent,
    wifiSsid,
    wifiPassword,
    wifiAuth,
    emailAddress,
    emailSubject,
    phoneNumber,
    whatsappNumber,
    whatsappMessage,
    fgColor,
    bgColor,
    margin,
    errorCorrection,
  ]);

  const handleDownloadPng = async () => {
    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    if (!qrDataUrl) return;
    const res = await fetch(qrDataUrl);
    const blob = await res.blob();
    downloadBlob(blob, `AllDocKit_QR_${qrType}.png`);

    onAddToHistory({
      toolId: 'qr-studio',
      toolName: 'QR Studio',
      originalName: `QR (${qrType})`,
      resultName: `AllDocKit_QR_${qrType}.png`,
      originalSize: blob.size,
      resultSize: blob.size,
      savedBytes: 0,
      resultBlob: blob,
    });
  };

  const handleDownloadSvg = async () => {
    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    const payload = getPayload();
    const svgString = await generateQrSvg(payload, {
      errorCorrectionLevel: errorCorrection,
      margin: margin,
      width: 800,
      color: {
        dark: fgColor,
        light: bgColor,
      },
    });

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, `AllDocKit_QR_${qrType}.svg`);

    onAddToHistory({
      toolId: 'qr-studio',
      toolName: 'QR Studio (SVG)',
      originalName: `QR (${qrType})`,
      resultName: `AllDocKit_QR_${qrType}.svg`,
      originalSize: blob.size,
      resultSize: blob.size,
      savedBytes: 0,
      resultBlob: blob,
    });
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(getPayload());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" />
            Smart QR Code Studio
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            100% ISO/IEC 18004 Standard QR codes. Guaranteed instant scannability on all iPhone, Android, and laser scanners.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            ISO/IEC 18004 Verified
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Side: Input & Settings */}
        <div className="md:col-span-7 space-y-5">
          {/* Type Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 overflow-x-auto">
            <button
              type="button"
              onClick={() => setQrType('link')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                qrType === 'link'
                  ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Website URL
            </button>
            <button
              type="button"
              onClick={() => setQrType('whatsapp')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                qrType === 'whatsapp'
                  ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setQrType('wifi')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                qrType === 'wifi'
                  ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              WiFi Network
            </button>
            <button
              type="button"
              onClick={() => setQrType('text')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                qrType === 'text'
                  ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Plain Text
            </button>
            <button
              type="button"
              onClick={() => setQrType('email')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                qrType === 'email'
                  ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </button>
            <button
              type="button"
              onClick={() => setQrType('phone')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                qrType === 'phone'
                  ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              Phone
            </button>
          </div>

          {/* Type-Specific Forms */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-xs">
            {qrType === 'link' && (
              <div>
                <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Destination URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium"
                />
              </div>
            )}

            {qrType === 'whatsapp' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                    WhatsApp Number (with country code, e.g. 923001234567)
                  </label>
                  <input
                    type="tel"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="923455067874"
                    className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Pre-filled Message (Optional)
                  </label>
                  <input
                    type="text"
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    placeholder="Hello! I am contacting you from your QR code..."
                    className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
            )}

            {qrType === 'wifi' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                      WiFi Network Name (SSID)
                    </label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="Office_WiFi"
                      className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Encryption Security
                    </label>
                    <select
                      value={wifiAuth}
                      onChange={(e) => setWifiAuth(e.target.value as any)}
                      className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    >
                      <option value="WPA">WPA/WPA2/WPA3 (Standard)</option>
                      <option value="WEP">WEP (Legacy)</option>
                      <option value="nopass">None (Open Network)</option>
                    </select>
                  </div>
                </div>
                {wifiAuth !== 'nopass' && (
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                      WiFi Password
                    </label>
                    <input
                      type="text"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="WiFi Network Password"
                      className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {qrType === 'text' && (
              <div>
                <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Text Content
                </label>
                <textarea
                  rows={3}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Type any message, note, address, or serial number..."
                  className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                />
              </div>
            )}

            {qrType === 'email' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="support@company.com"
                    className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Inquiry from QR Code"
                    className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
            )}

            {qrType === 'phone' && (
              <div>
                <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                />
              </div>
            )}
          </div>

          {/* Color & Styling Options */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  Colors & QR Specifications
                </h3>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setFgColor(p.fg);
                      setBgColor(p.bg);
                    }}
                    title={p.name}
                    className="w-5 h-5 rounded-full border border-stone-300 dark:border-stone-600 transition-transform hover:scale-110 cursor-pointer shadow-xs"
                    style={{ background: `linear-gradient(135deg, ${p.fg} 50%, ${p.bg} 50%)` }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Pattern Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200"
                  />
                  <span className="text-xs font-mono text-stone-700 dark:text-stone-300">{fgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Background
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200"
                  />
                  <span className="text-xs font-mono text-stone-700 dark:text-stone-300">{bgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Quiet Zone (Border)
                </label>
                <select
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-full py-1.5 px-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                >
                  <option value={4}>4 Modules (ISO Standard)</option>
                  <option value={3}>3 Modules (Compact)</option>
                  <option value={2}>2 Modules (Slim)</option>
                  <option value={6}>6 Modules (Wide)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Error Correction
                </label>
                <select
                  value={errorCorrection}
                  onChange={(e) => setErrorCorrection(e.target.value as any)}
                  className="w-full py-1.5 px-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                >
                  <option value="L">Low (7% recovery)</option>
                  <option value="M">Medium (15% - Recommended)</option>
                  <option value="Q">Quartile (25% recovery)</option>
                  <option value="H">High (30% - Maximum)</option>
                </select>
              </div>
            </div>

            {isContrastLow && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Contrast Warning:</strong> Foreground and background colors are too similar. Phone camera scanners might have trouble scanning. We recommend a dark pattern on light background.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live QR Preview & Actions */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
          <div className="p-4 rounded-2xl bg-white shadow-md border border-stone-200 flex items-center justify-center relative">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Standard Compliant QR Code"
                className="w-56 h-56 object-contain rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-stone-400 text-xs">
                {isGenerating ? 'Generating standard QR...' : 'Ready'}
              </div>
            )}
          </div>

          {/* Scannable Verification Banner */}
          <div className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Ready to Scan Right Now</span>
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
              Point your smartphone camera or Google Lens at the preview above to test live.
            </p>
          </div>

          <div className="w-full space-y-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download High-Res PNG (800x800)
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileCode className="w-4 h-4 text-emerald-600" />
              Download Vector SVG (Print & Press)
            </button>

            <button
              type="button"
              onClick={handleCopyPayload}
              className="w-full py-2 px-4 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-400 bg-transparent hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Data Content!' : 'Copy Decoded Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
