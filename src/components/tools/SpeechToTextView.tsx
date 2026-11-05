import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Copy,
  Check,
  Download,
  Trash2,
  FileText,
  Volume2,
  Sparkles,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';

interface SpeechToTextViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'ur-PK', name: 'Urdu (Pakistan)', flag: '🇵🇰' },
  { code: 'en-US', name: 'English (United States)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (United Kingdom)', flag: '🇬🇧' },
  { code: 'hi-IN', name: 'Hindi (India)', flag: '🇮🇳' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', flag: '🇸🇦' },
];

export const SpeechToTextView: React.FC<SpeechToTextViewProps> = ({ onAddToHistory }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('ur-PK');
  const [isSupported, setIsSupported] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setErrorMessage(
        'Speech Recognition is not supported directly in this browser. Please use Google Chrome, Edge, or Safari.'
      );
    }
  }, []);

  const startListening = () => {
    setErrorMessage(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Speech Recognition is not supported by your browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalSegment = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalSegment += item[0].transcript + ' ';
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (finalSegment) {
          setTranscript((prev) => prev + finalSegment);
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser.');
        } else if (event.error !== 'no-speech') {
          setErrorMessage(`Speech recognition notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start microphone recording.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleCopy = () => {
    const textToCopy = (transcript + ' ' + interimTranscript).trim();
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    stopListening();
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
  };

  const handleDownloadTxt = () => {
    const textToDownload = (transcript + ' ' + interimTranscript).trim();
    if (!textToDownload) return;

    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const fileName = `Transcribed_Notes_${Date.now()}.txt`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onAddToHistory({
      toolId: 'speech-to-text',
      toolName: 'Speech to Text Transcriber (TXT)',
      originalName: 'Voice Audio Notes',
      resultName: fileName,
      originalSize: textToDownload.length,
      resultSize: blob.size,
      savedBytes: 0,
    });
  };

  const handleDownloadPdf = async () => {
    const textToDownload = (transcript + ' ' + interimTranscript).trim();
    if (!textToDownload) return;

    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      page.drawText('Voice Transcription & Meeting Notes', {
        x: 50,
        y: 800,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      page.drawText(`Generated on: ${new Date().toLocaleString()} • Language: ${selectedLanguage}`, {
        x: 50,
        y: 780,
        size: 10,
        font,
        color: rgb(0.5, 0.55, 0.6),
      });

      // Simple word-wrap for PDF text rendering
      const words = textToDownload.split(/\s+/);
      let line = '';
      let yPos = 740;
      const margin = 50;
      const maxWidth = 495;

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const textWidth = font.widthOfTextAtSize(testLine, 11);
        if (textWidth > maxWidth && line.length > 0) {
          page.drawText(line, { x: margin, y: yPos, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
          line = words[i] + ' ';
          yPos -= 18;
          if (yPos < 60) break; // Limit to single sheet preview
        } else {
          line = testLine;
        }
      }
      if (line.length > 0 && yPos >= 60) {
        page.drawText(line, { x: margin, y: yPos, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = `Transcribed_Voice_${Date.now()}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onAddToHistory({
        toolId: 'speech-to-text',
        toolName: 'Speech to Text (Printable PDF)',
        originalName: 'Voice Audio Notes',
        resultName: fileName,
        originalSize: textToDownload.length,
        resultSize: blob.size,
        savedBytes: 0,
      });
    } catch (err: any) {
      setErrorMessage('Could not generate PDF from voice transcript.');
    }
  };

  const wordCount = (transcript + ' ' + interimTranscript).trim().split(/\s+/).filter(Boolean).length;
  const charCount = (transcript + ' ' + interimTranscript).trim().length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Voice to Text & Speech Transcriber
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 font-medium">
                100% Free & Unlimited
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Speak into your microphone in Urdu, English, Hindi, or Arabic — words are typed out live in real-time.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {/* Toolbar & Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Voice Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                if (isListening) stopListening();
                setSelectedLanguage(e.target.value);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono">
              {wordCount} Words • {charCount} Chars
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={!transcript && !interimTranscript}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
              title="Clear All Text"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Mic Button & Visualizer */}
        <div className="my-8 flex flex-col items-center justify-center space-y-4">
          <button
            type="button"
            onClick={toggleListening}
            className={`relative p-8 rounded-full transition-all duration-300 shadow-xl flex items-center justify-center ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse ring-8 ring-rose-300 dark:ring-rose-950 scale-105'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/60'
            }`}
          >
            {isListening ? <Mic className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          </button>

          <div className="text-center">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 block">
              {isListening ? 'Listening... Speak now' : 'Click microphone to start transcribing'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isListening ? 'Continuous recording active. Speak naturally.' : 'Supports continuous dictation, meetings & notes'}
            </span>
          </div>
        </div>

        {/* Real-time Transcription Text Area */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Transcribed Notes</span>
            {isListening && (
              <span className="flex items-center gap-1.5 text-rose-600 text-[11px] normal-case font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
                Live recording
              </span>
            )}
          </label>
          <div className="relative">
            <textarea
              value={transcript + (interimTranscript ? ` (${interimTranscript})` : '')}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your spoken words will appear here in real-time... You can also edit or type directly into this box."
              rows={8}
              className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 text-base leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
            />
          </div>
        </div>

        {/* Actions Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!transcript && !interimTranscript}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition flex items-center gap-2 disabled:opacity-40"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Text'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTxt}
              disabled={!transcript && !interimTranscript}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Download .TXT
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!transcript && !interimTranscript}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-40"
            >
              <FileText className="w-4 h-4" />
              Export A4 PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
