import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Mic,
  MicOff,
  Copy,
  Check,
  Trash2,
  FileText,
  Download,
  Sliders,
  Sparkles,
  ShieldCheck,
  Languages,
  Clock,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun } from 'docx';

interface TextToSpeechViewProps {
  onProcessComplete?: (historyItem: any) => void;
}

const PRESET_TEXTS = [
  {
    title: 'اردو اقتباس (Urdu Sample)',
    lang: 'ur',
    text: 'علم ایک ایسا نور ہے جو انسان کو اندھیروں سے نکال کر روشنی کی طرف لاتا ہے۔ محنت اور لگن سے ہر ناممکن کام کو ممکن بنایا جا سکتا ہے۔',
  },
  {
    title: 'English Speech Sample',
    lang: 'en',
    text: 'Welcome to AllDocKit Offline Studio. You can convert any written text into natural speech completely offline with zero internet and zero server limits.',
  },
  {
    title: 'عربی اقتباس (Arabic Sample)',
    lang: 'ar',
    text: 'اَلْعِلْمُ فِي الصِّغَرِ كَالنَّقْشِ عَلَى الْحَجَرِ. وَالْوَقْتُ كَالسَّيْفِ إِنْ لَمْ تَقْطَعْهُ قَطَعَكَ.',
  },
];

export const TextToSpeechView: React.FC<TextToSpeechViewProps> = () => {
  const [text, setText] = useState<string>(
    'علم ایک ایسا نور ہے جو انسان کو اندھیروں سے نکال کر روشنی کی طرف لاتا ہے۔'
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [rate, setRate] = useState<number>(1);
  const [pitch, setPitch] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);

  // Playback states
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Speech Recognition (Mic Voice Typing)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micSupported, setMicSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available system voices
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      if (availableVoices.length > 0 && !selectedVoiceURI) {
        // Prefer Urdu, Arabic or default English voice
        const urduVoice = availableVoices.find((v) => v.lang.startsWith('ur'));
        const arabicVoice = availableVoices.find((v) => v.lang.startsWith('ar'));
        const englishVoice = availableVoices.find((v) => v.lang.startsWith('en'));
        const defaultVoice = urduVoice || arabicVoice || englishVoice || availableVoices[0];
        if (defaultVoice) {
          setSelectedVoiceURI(defaultVoice.voiceURI);
        }
      }
    };

    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Initialize Mic Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ur-PK';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setText((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch {
      setMicSupported(false);
    }
  }, []);

  // Handle Playback
  const handleSpeak = () => {
    if (!text.trim()) return;

    if (!window.speechSynthesis) {
      alert('Speech synthesis is not supported on your browser.');
      return;
    }

    // If currently paused, resume
    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    // Stop any current utterance
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    if (selectedVoiceURI) {
      const chosenVoice = voices.find((v) => v.voiceURI === selectedVoiceURI);
      if (chosenVoice) utterance.voice = chosenVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      setStatusMsg('Playing voice reading...');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setStatusMsg('Speech finished.');
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (window.speechSynthesis && isSpeaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setStatusMsg('Paused.');
    }
  };

  const handleStop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      setStatusMsg('Stopped.');
    }
  };

  // Toggle Mic Voice Typing
  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setStatusMsg('Mic stopped.');
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setStatusMsg('Listening to your voice... Speak clearly.');
      } catch {
        setIsListening(false);
      }
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setStatusMsg('Text copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Export as Text (.txt)
  const handleDownloadTxt = () => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AllDocKit_Speech_Text_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as Word (.docx)
  const handleDownloadDocx = async () => {
    if (!text) return;
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  size: 28,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AllDocKit_Speech_Doc_${Date.now()}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helpers
  const wordsCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charsCount = text.length;
  const estMinutes = Math.max(1, Math.ceil(wordsCount / (130 * rate)));
  const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-stone-900/40 border border-emerald-500/20 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Text to Speech & Voice Reader
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
              100% OFFLINE
            </span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 max-w-xl">
            Convert any text into natural voice audio with zero internet and zero server limits.
            Supports Urdu, Arabic, English, voice speed controls, and mic voice dictation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero Data Uploaded</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Voice Controls & Presets */}
        <div className="lg:col-span-4 space-y-4">
          {/* Controls Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              Voice Settings
            </h2>

            {/* Voice Selector */}
            <div>
              <label htmlFor="tts-voice-select" className="text-xs text-stone-600 dark:text-stone-400 font-medium block mb-1">
                Select Voice ({voices.length} Available)
              </label>
              <select
                id="tts-voice-select"
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-stone-900 dark:text-stone-100"
              >
                {voices.length === 0 ? (
                  <option value="">Default System Voice</option>
                ) : (
                  voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Speed / Rate Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-stone-600 dark:text-stone-400 font-medium">Speed (Rate)</span>
                <span className="font-bold text-emerald-600">{rate}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                <span>0.5x Slow</span>
                <span>1.0x Normal</span>
                <span>2.0x Fast</span>
              </div>
            </div>

            {/* Pitch Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-stone-600 dark:text-stone-400 font-medium">Pitch</span>
                <span className="font-bold text-emerald-600">{pitch}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Volume Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-stone-600 dark:text-stone-400 font-medium">Volume</span>
                <span className="font-bold text-emerald-600">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Sample Presets Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              Sample Presets
            </h2>
            <div className="space-y-1.5">
              {PRESET_TEXTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setText(preset.text)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-transparent transition-all text-xs font-medium text-stone-700 dark:text-stone-300 truncate cursor-pointer"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Mic Voice Dictation Card */}
          {micSupported && (
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
              <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 uppercase tracking-wider">
                <Mic className="w-3.5 h-3.5 text-emerald-600" />
                Live Voice Typing (Mic)
              </h2>
              <p className="text-[11px] text-stone-500">
                Speak through your microphone to dictate text in real-time.
              </p>
              <button
                type="button"
                onClick={toggleListening}
                className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-600" />}
                {isListening ? 'Stop Listening' : 'Start Voice Typing'}
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Text Editor & Audio Player */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between min-h-[520px]">
            <div>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    Text Editor
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-stone-500">
                    <span>{wordsCount} words</span>
                    <span>•</span>
                    <span>{charsCount} characters</span>
                    <span>•</span>
                    <span>~{estMinutes} min reading</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <div className="my-3 relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type or paste any Urdu, English, or Arabic text here to read aloud..."
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className={`w-full h-80 sm:h-96 p-4 rounded-xl bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 leading-relaxed ${
                    isRtl ? 'font-serif' : 'font-sans'
                  }`}
                />
              </div>
            </div>

            {/* Bottom Audio Controller Bar */}
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
              {/* Playback Control Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {!isSpeaking || isPaused ? (
                    <button
                      type="button"
                      onClick={handleSpeak}
                      disabled={!text.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isPaused ? 'Resume Speech' : 'Listen Text (Play)'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                      Pause
                    </button>
                  )}

                  {isSpeaking && (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Stop
                    </button>
                  )}
                </div>

                {/* Export Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadDocx}
                    disabled={!text.trim()}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Word (.docx)
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    disabled={!text.trim()}
                    className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white dark:bg-stone-200 dark:text-stone-900 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Text (.txt)
                  </button>
                </div>
              </div>

              {/* Status Indicator */}
              {statusMsg && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
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
