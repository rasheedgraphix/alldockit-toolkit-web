import { GoogleGenAI } from '@google/genai';

/**
 * Universal AI Service for AllDocKit
 * Handles Audio Transcription & Book/Document OCR both via backend server proxy (/api/*)
 * and directly on client-side (e.g. for GitHub Pages static hosting).
 */

export function getClientApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY || '';
  if (envKey) return envKey;
  try {
    const customKey = localStorage.getItem('alldockit_gemini_key') || localStorage.getItem('pixdoc_gemini_key');
    if (customKey) return customKey.trim();
  } catch {}
  return '';
}

export function setClientApiKey(key: string): void {
  try {
    localStorage.setItem('alldockit_gemini_key', key.trim());
    localStorage.setItem('pixdoc_gemini_key', key.trim());
  } catch {}
}

/**
 * Transcribe Audio File (Urdu, Arabic, English, etc.)
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  languagePrompt: string = 'Urdu, Arabic, or English'
): Promise<string> {
  const clientKey = getClientApiKey();

  // Method 1: Try server-side proxy route first
  try {
    const res = await fetch('/api/transcribe-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType,
        languagePrompt,
        apiKey: clientKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.transcript && data.transcript.trim()) {
        return data.transcript.trim();
      }
    }
  } catch (serverErr) {
    console.warn('Server proxy unavailable, checking client AI fallback:', serverErr);
  }

  // Method 2: Client-side Gemini SDK fallback (works on GitHub Pages)
  if (clientKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: clientKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: audioBase64,
                  mimeType: mimeType || 'audio/mp3',
                },
              },
              {
                text: `Transcribe this audio file accurately into verbatim text.
Language context: ${languagePrompt}.
Instructions:
- Write out the exact words spoken, recited, or sung in proper script (Urdu in Nastaliq/Urdu, Arabic in Arabic, English in English).
- Provide ONLY the direct transcript text without conversational preamble or markdown code blocks.`,
              },
            ],
          },
        ],
      });

      const text = response.text ? response.text.trim() : '';
      if (text) return text;
    } catch (clientErr: any) {
      console.error('Client-side Gemini transcription error:', clientErr);
      throw clientErr;
    }
  }

  throw new Error(
    'Transcription service could not process the audio. If using GitHub Pages, please provide a free Gemini API key in Settings or run locally.'
  );
}

/**
 * High-Precision Book & Document OCR
 */
export async function performAiOcr(
  imageBase64: string,
  mimeType: string = 'image/png',
  language: string = 'Urdu + Arabic'
): Promise<string> {
  const clientKey = getClientApiKey();

  // Method 1: Server proxy
  try {
    const res = await fetch('/api/ocr-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        language,
        apiKey: clientKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text && data.text.trim()) {
        return data.text.trim();
      }
    }
  } catch (serverErr) {
    console.warn('Server OCR proxy unavailable, checking client fallback:', serverErr);
  }

  // Method 2: Client Gemini fallback
  if (clientKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: clientKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: mimeType || 'image/png',
                },
              },
              {
                text: `Perform high-precision OCR on this book page / document.
Target Language: ${language}.
Strict Instructions:
1. Extract ALL actual book content, headings, lesson titles, vocabulary, grammar rules, exercises, and Urdu explanations verbatim in proper script.
2. Ignore decorative page borders, floral frames, scanner artifacts, and website watermark links.
3. Output ONLY the extracted text without commentary.`,
              },
            ],
          },
        ],
      });

      const text = response.text ? response.text.trim() : '';
      if (text) return text;
    } catch (clientErr: any) {
      console.error('Client-side Gemini OCR error:', clientErr);
      throw clientErr;
    }
  }

  throw new Error('OCR service could not process the page via AI.');
}

/**
 * Reconstruct & Clean Broken Urdu / Arabic OCR Text
 */
export async function cleanAndReconstructText(rawText: string, language: string = 'Urdu'): Promise<string> {
  const clientKey = getClientApiKey();

  // Method 1: Server proxy
  try {
    const res = await fetch('/api/clean-ocr-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, language, apiKey: clientKey }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.cleanedText) return data.cleanedText.trim();
    }
  } catch {}

  // Method 2: Client SDK
  if (clientKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: clientKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Proofread and reconstruct the following OCR text into 100% crystal-clear standard Urdu & Arabic textbook formatting. Fix broken Nastaliq letters, typos, and fragmented words. Return only the cleaned text:

${rawText}`,
              },
            ],
          },
        ],
      });
      if (response.text) return response.text.trim();
    } catch {}
  }

  return rawText;
}
