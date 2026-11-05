import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Eraser,
  Type,
  Paintbrush,
  Pipette,
  Stamp,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Eye,
  FileDown,
  Upload,
  Move,
  Layers,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Sliders,
  CheckCircle2,
  Square,
  ShieldCheck,
  FileImage,
  Crosshair,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { formatBytes, downloadBlob } from '../../utils/fileHelpers';
import { renderPdfPagesToImages } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { jsPDF } from 'jspdf';

interface CertificateEditorViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type EditorMode = 'select-rect' | 'brush' | 'clone' | 'text' | 'eyedropper';

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
}

export const CertificateEditorView: React.FC<CertificateEditorViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: number; width: number; height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingImageRef = useRef<{ img: HTMLImageElement; blob: Blob; name: string } | null>(null);

  // History Stack for Undo/Redo
  const [historyStack, setHistoryStack] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Editor Tools & Settings
  const [currentMode, setCurrentMode] = useState<EditorMode>('select-rect');
  const [zoom, setZoom] = useState<number>(1);
  const [pickedColor, setPickedColor] = useState<string>('#ffffff');
  const [feather, setFeather] = useState<number>(3); // edge blur
  const [addNoise, setAddNoise] = useState<boolean>(true); // subtle texture matching

  // Brush settings
  const [brushSize, setBrushSize] = useState<number>(24);
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0);
  const [brushSoftness, setBrushSoftness] = useState<number>(50);

  // Clone tool settings
  const [cloneSource, setCloneSource] = useState<{ x: number; y: number } | null>(null);
  const [isSelectingCloneSource, setIsSelectingCloneSource] = useState<boolean>(false);

  // Rectangle selection for patch
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);

  // Text Elements (New name / date)
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [newTextValue, setNewTextValue] = useState<string>('Recipient Name');
  const [textFont, setTextFont] = useState<string>("'Times New Roman', Times, serif");
  const [textSize, setTextSize] = useState<number>(42);
  const [textColor, setTextColor] = useState<string>('#111827');
  const [textBold, setTextBold] = useState<boolean>(true);
  const [textItalic, setTextItalic] = useState<boolean>(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [letterSpacing, setLetterSpacing] = useState<number>(1);

  // View state
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Helper to show temporary notification banner
  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Push current canvas state to history
  const pushState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistoryStack((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        return [...next, imageData].slice(-25); // keep max 25 states
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 24));
    } catch (e) {
      console.warn('Failed to snapshot canvas state:', e);
    }
  }, [historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    const targetState = historyStack[newIndex];
    if (targetState) {
      ctx.putImageData(targetState, 0, 0);
      setHistoryIndex(newIndex);
      notify('Undone last action');
    }
  }, [historyIndex, historyStack]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    const targetState = historyStack[newIndex];
    if (targetState) {
      ctx.putImageData(targetState, 0, 0);
      setHistoryIndex(newIndex);
      notify('Redone action');
    }
  }, [historyIndex, historyStack]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Sample Surrounding Color from area
  const sampleSurroundingColor = useCallback((canvas: HTMLCanvasElement, x: number, y: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      // Sample 3x3 pixel neighborhood for robust average color
      const sample = ctx.getImageData(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3);
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < sample.data.length; i += 4) {
        r += sample.data[i];
        g += sample.data[i + 1];
        b += sample.data[i + 2];
        count++;
      }
      if (count > 0) {
        const hex = `#${Math.round(r / count).toString(16).padStart(2, '0')}${Math.round(g / count).toString(16).padStart(2, '0')}${Math.round(b / count).toString(16).padStart(2, '0')}`;
        setPickedColor(hex);
      }
    } catch (e) {
      // fallback
    }
  }, []);

  // Helper to fit certificate cleanly into screen viewport without being cut off
  const handleFitToScreen = useCallback((targetW?: number, targetH?: number) => {
    if (!containerRef.current) return;
    const w = targetW || fileDetails?.width;
    const h = targetH || fileDetails?.height;
    if (!w || !h) return;
    const availW = Math.max(100, containerRef.current.clientWidth - 48);
    const availH = Math.max(100, containerRef.current.clientHeight - 48);
    const scaleW = availW / w;
    const scaleH = availH / h;
    const fitZoom = Math.min(scaleW, scaleH, 1.0);
    setZoom(Math.max(0.05, Number(fitZoom.toFixed(3))));
  }, [fileDetails]);

  const handleFitToWidth = useCallback((targetW?: number) => {
    if (!containerRef.current) return;
    const w = targetW || fileDetails?.width;
    if (!w) return;
    const availW = Math.max(100, containerRef.current.clientWidth - 48);
    const scaleW = availW / w;
    setZoom(Math.max(0.05, Math.min(3.0, Number(scaleW.toFixed(3)))));
  }, [fileDetails]);

  // Support Ctrl+Wheel or Meta+Wheel to smoothly zoom in / out
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setZoom((prev) => Math.max(0.1, Math.min(3.0, Number((prev + delta).toFixed(2)))));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Effect to initialize canvases when fileDetails is set and canvasRef mounts
  useEffect(() => {
    if (!fileDetails || !pendingImageRef.current) return;
    const { img, name } = pendingImageRef.current;
    const canvas = canvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    if (!canvas || !originalCanvas) return;

    canvas.width = img.width;
    canvas.height = img.height;
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;

    const ctx = canvas.getContext('2d');
    const origCtx = originalCanvas.getContext('2d');
    if (ctx && origCtx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      origCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
      origCtx.drawImage(img, 0, 0);

      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistoryStack([initialData]);
      setHistoryIndex(0);

      // Auto sample background color around center-ish area or default to paper white
      sampleSurroundingColor(canvas, Math.round(img.width / 2), Math.round(img.height / 2));
    }

    // Auto fit zoom to screen (both width and height so entire certificate is 100% visible)
    const applyFit = () => {
      if (containerRef.current) {
        const availW = Math.max(100, containerRef.current.clientWidth - 48);
        const availH = Math.max(100, containerRef.current.clientHeight - 48);
        const scaleW = availW / img.width;
        const scaleH = availH / img.height;
        const fitZoom = Math.min(scaleW, scaleH, 1.0);
        setZoom(Math.max(0.05, Number(fitZoom.toFixed(3))));
      } else {
        setZoom(0.65);
      }
    };
    applyFit();
    const frameId = requestAnimationFrame(applyFit);
    const timerId = setTimeout(applyFit, 80);

    setIsLoading(false);
    notify(`Loaded "${name}" (${img.width}×${img.height}px)`);
    pendingImageRef.current = null;

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
    };
  }, [fileDetails, sampleSurroundingColor]);

  // Load Image onto Canvas
  const loadBlobToCanvas = useCallback((blob: Blob, name: string) => {
    setIsLoading(true);
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      pendingImageRef.current = { img, blob, name };

      // If canvas already exists in DOM (e.g. replacing an already opened file)
      const canvas = canvasRef.current;
      const originalCanvas = originalCanvasRef.current;
      if (canvas && originalCanvas && fileDetails) {
        canvas.width = img.width;
        canvas.height = img.height;
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;

        const ctx = canvas.getContext('2d');
        const origCtx = originalCanvas.getContext('2d');
        if (ctx && origCtx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          origCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
          origCtx.drawImage(img, 0, 0);

          const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setHistoryStack([initialData]);
          setHistoryIndex(0);

          sampleSurroundingColor(canvas, Math.round(img.width / 2), Math.round(img.height / 2));
        }

        const applyFit = () => {
          if (containerRef.current) {
            const availW = Math.max(100, containerRef.current.clientWidth - 48);
            const availH = Math.max(100, containerRef.current.clientHeight - 48);
            const scaleW = availW / img.width;
            const scaleH = availH / img.height;
            const fitZoom = Math.min(scaleW, scaleH, 1.0);
            setZoom(Math.max(0.05, Number(fitZoom.toFixed(3))));
          }
        };
        applyFit();
        requestAnimationFrame(applyFit);
        setIsLoading(false);
        notify(`Loaded "${name}" (${img.width}×${img.height}px)`);
        pendingImageRef.current = null;
      }

      setFileDetails({
        name,
        size: blob.size,
        width: img.width,
        height: img.height,
      });

      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      setIsLoading(false);
      notify('Error loading image file.');
    };

    img.src = url;
  }, [fileDetails, sampleSurroundingColor]);

  // Handle User File Selection (Images & PDF)
  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setIsLoading(true);
      try {
        notify('Rendering certificate PDF page at high resolution...');
        const pages = await renderPdfPagesToImages(file, 'png', 1.0, 2.0); // 2.0 scale for HD crisp rendering
        if (pages.length > 0) {
          loadBlobToCanvas(pages[0].blob, file.name.replace(/\.pdf$/i, '.png'));
        } else {
          notify('Could not render PDF pages.');
        }
      } catch (err) {
        console.error('PDF render error:', err);
        notify('Failed to load PDF. Please try a PNG or JPG certificate.');
      } finally {
        setIsLoading(false);
      }
    } else {
      loadBlobToCanvas(file, file.name);
    }
  };

  // Generate Sample Certificate to try immediately
  const handleLoadSampleCertificate = () => {
    setIsLoading(true);
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 1600;
    sampleCanvas.height = 1130; // Landscape A4 proportions
    const ctx = sampleCanvas.getContext('2d');

    if (!ctx) return;

    // 1. Parchment Background
    const bgGrad = ctx.createLinearGradient(0, 0, sampleCanvas.width, sampleCanvas.height);
    bgGrad.addColorStop(0, '#fdfbf7');
    bgGrad.addColorStop(0.5, '#fbf8ee');
    bgGrad.addColorStop(1, '#f6f1e3');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);

    // Subtle Paper Texture grain
    for (let i = 0; i < 18000; i++) {
      const px = Math.random() * sampleCanvas.width;
      const py = Math.random() * sampleCanvas.height;
      const gray = Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, 0.02)`;
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    // 2. Elegant Border Frame
    ctx.strokeStyle = '#c59b27'; // Gold
    ctx.lineWidth = 14;
    ctx.strokeRect(40, 40, sampleCanvas.width - 80, sampleCanvas.height - 80);

    ctx.strokeStyle = '#1e293b'; // Navy accent inner line
    ctx.lineWidth = 3;
    ctx.strokeRect(58, 58, sampleCanvas.width - 116, sampleCanvas.height - 116);

    ctx.strokeStyle = '#c59b27';
    ctx.lineWidth = 1;
    ctx.strokeRect(66, 66, sampleCanvas.width - 132, sampleCanvas.height - 132);

    // Corner Ornaments
    const drawCorner = (cx: number, cy: number, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = '#c59b27';
      ctx.fillRect(-20, -20, 40, 6);
      ctx.fillRect(-20, -20, 6, 40);
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    drawCorner(85, 85, 0);
    drawCorner(sampleCanvas.width - 85, 85, Math.PI / 2);
    drawCorner(sampleCanvas.width - 85, sampleCanvas.height - 85, Math.PI);
    drawCorner(85, sampleCanvas.height - 85, -Math.PI / 2);

    // 3. Certificate Typography
    ctx.textAlign = 'center';

    // Header
    ctx.font = 'bold 22px "Cinzel", "Times New Roman", serif';
    ctx.fillStyle = '#c59b27';
    ctx.fillText('OFFICIAL CERTIFICATION OF RECOGNITION', sampleCanvas.width / 2, 175);

    ctx.font = 'bold 54px "Cinzel", "Times New Roman", serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('CERTIFICATE OF ACHIEVEMENT', sampleCanvas.width / 2, 255);

    ctx.font = 'italic 20px "Georgia", serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('THIS PRESTIGIOUS HONOR IS PROUDLY PRESENTED TO', sampleCanvas.width / 2, 330);

    // The Name to Remove / Test
    ctx.font = 'bold 64px "Times New Roman", serif';
    ctx.fillStyle = '#1e3a8a'; // Deep Navy
    ctx.fillText('Muhammad Nouman Khan', sampleCanvas.width / 2, 435);

    // Underline below name
    ctx.strokeStyle = '#c59b27';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sampleCanvas.width / 2 - 320, 460);
    ctx.lineTo(sampleCanvas.width / 2 + 320, 460);
    ctx.stroke();

    // Body Text
    ctx.font = '18px "Georgia", serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('For outstanding dedication, professional distinction, and excellence in document engineering', sampleCanvas.width / 2, 530);
    ctx.fillText('and software development, verified under international standards of the executive board.', sampleCanvas.width / 2, 565);

    // Date & ID
    ctx.font = '16px "Times New Roman", serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('ISSUED DATE: October 2026   |   CREDENTIAL ID: ADK-94821-CERT', sampleCanvas.width / 2, 650);

    // Signatures & Gold Seal
    // Gold Seal Circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(sampleCanvas.width / 2, 850, 60, 0, Math.PI * 2);
    ctx.fillStyle = '#fde68a';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#c59b27';
    ctx.stroke();
    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('VERIFIED', sampleCanvas.width / 2, 845);
    ctx.fillText('SEAL', sampleCanvas.width / 2, 865);
    ctx.restore();

    // Left Signature
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(250, 870);
    ctx.lineTo(520, 870);
    ctx.stroke();
    ctx.font = 'italic 28px "Brush Script MT", cursive, serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Hafiz Nouman Rasheed', 385, 850);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('DIRECTOR & CHIEF EXECUTIVE', 385, 900);

    // Right Signature
    ctx.beginPath();
    ctx.moveTo(sampleCanvas.width - 520, 870);
    ctx.lineTo(sampleCanvas.width - 250, 870);
    ctx.stroke();
    ctx.font = 'italic 28px "Brush Script MT", cursive, serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Dr. Arthur Vance, Ph.D.', sampleCanvas.width - 385, 850);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('BOARD OF GOVERNORS', sampleCanvas.width - 385, 900);

    sampleCanvas.toBlob((blob) => {
      if (blob) {
        loadBlobToCanvas(blob, 'Sample-Certificate.png');
      }
    }, 'image/png');
  };

  // Canvas Mouse Coordinates Helper
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  // Apply Rectangle Patch / Box Eraser
  const handleApplyRectPatch = () => {
    if (!selectionRect || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y, width, height } = selectionRect;
    if (width <= 0 || height <= 0) return;

    // Snapshot before change
    pushState();

    ctx.save();

    // 1. Fill with the background color
    ctx.fillStyle = pickedColor;

    if (feather > 0) {
      // Soft feathered blend
      ctx.shadowColor = pickedColor;
      ctx.shadowBlur = feather * 2;
    }

    ctx.fillRect(x, y, width, height);

    // 2. Add subtle texture noise if enabled (makes it seamlessly blend into paper)
    if (addNoise) {
      const patchImg = ctx.getImageData(x, y, width, height);
      const data = patchImg.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 8; // subtle +/- 4 intensity
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(patchImg, x, y);
    }

    ctx.restore();

    // If new text is ready and user is in replacement flow, position text center in this box
    if (newTextValue.trim().length > 0) {
      const newElem: TextElement = {
        id: `text_${Date.now()}`,
        text: newTextValue,
        x: Math.round(x + width / 2),
        y: Math.round(y + height / 2 + textSize * 0.35),
        fontSize: textSize,
        fontFamily: textFont,
        color: textColor,
        bold: textBold,
        italic: textItalic,
        align: textAlign,
        letterSpacing: letterSpacing,
      };
      setTextElements((prev) => [...prev, newElem]);
      setSelectedTextId(newElem.id);
      setCurrentMode('text');
    }

    setSelectionRect(null);
    notify('Cleaned selected area seamlessly!');
  };

  // Auto-Sample color around the current selection box perimeter
  const handleAutoSampleSelectionPerimeter = () => {
    if (!selectionRect || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y, width, height } = selectionRect;
    try {
      // Sample 2px outer border around the box
      const topSample = ctx.getImageData(Math.max(0, x), Math.max(0, y - 4), width, 3);
      const botSample = ctx.getImageData(Math.max(0, x), Math.min(canvas.height - 4, y + height + 1), width, 3);

      let r = 0, g = 0, b = 0, count = 0;
      const processSample = (sample: ImageData) => {
        for (let i = 0; i < sample.data.length; i += 4) {
          r += sample.data[i];
          g += sample.data[i + 1];
          b += sample.data[i + 2];
          count++;
        }
      };
      processSample(topSample);
      processSample(botSample);

      if (count > 0) {
        const hex = `#${Math.round(r / count).toString(16).padStart(2, '0')}${Math.round(g / count).toString(16).padStart(2, '0')}${Math.round(b / count).toString(16).padStart(2, '0')}`;
        setPickedColor(hex);
        notify(`Auto-matched background color: ${hex}`);
      }
    } catch (e) {
      console.warn('Auto sample perimeter error:', e);
    }
  };

  // Mouse Handlers for Drawing / Painting / Eyedropper / Clone
  const isMouseDown = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    isMouseDown.current = true;
    lastPos.current = coords;

    if (currentMode === 'eyedropper') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      sampleSurroundingColor(canvas, coords.x, coords.y);
      setCurrentMode('brush');
      notify(`Color picked: ${pickedColor}`);
      return;
    }

    if (currentMode === 'clone' && isSelectingCloneSource) {
      setCloneSource(coords);
      setIsSelectingCloneSource(false);
      notify(`Clone source set at (${coords.x}, ${coords.y})`);
      return;
    }

    if (currentMode === 'select-rect') {
      setIsDrawingRect(true);
      setRectStart(coords);
      setSelectionRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
    } else if (currentMode === 'brush' || currentMode === 'clone') {
      pushState();
      drawBrushStroke(coords.x, coords.y);
    } else if (currentMode === 'text') {
      // Check if user clicked an existing text or wants to place new text
      const clicked = textElements.find(
        (el) => Math.abs(el.x - coords.x) < 150 && Math.abs(el.y - coords.y) < el.fontSize * 1.5
      );
      if (clicked) {
        setSelectedTextId(clicked.id);
        setNewTextValue(clicked.text);
        setTextSize(clicked.fontSize);
        setTextColor(clicked.color);
        setTextFont(clicked.fontFamily);
      } else {
        // Place new text at click point
        const newElem: TextElement = {
          id: `text_${Date.now()}`,
          text: newTextValue || 'New Name',
          x: coords.x,
          y: coords.y,
          fontSize: textSize,
          fontFamily: textFont,
          color: textColor,
          bold: textBold,
          italic: textItalic,
          align: textAlign,
          letterSpacing: letterSpacing,
        };
        setTextElements((prev) => [...prev, newElem]);
        setSelectedTextId(newElem.id);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDown.current) return;
    const coords = getCanvasCoords(e);

    if (currentMode === 'select-rect' && isDrawingRect && rectStart) {
      const x = Math.min(rectStart.x, coords.x);
      const y = Math.min(rectStart.y, coords.y);
      const width = Math.abs(coords.x - rectStart.x);
      const height = Math.abs(coords.y - rectStart.y);
      setSelectionRect({ x, y, width, height });
    } else if (currentMode === 'brush' || currentMode === 'clone') {
      drawBrushStroke(coords.x, coords.y);
      lastPos.current = coords;
    } else if (currentMode === 'text' && selectedTextId) {
      // Drag text position
      setTextElements((prev) =>
        prev.map((el) => (el.id === selectedTextId ? { ...el, x: coords.x, y: coords.y } : el))
      );
    }
  };

  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
    if (isDrawingRect) {
      setIsDrawingRect(false);
      // If rectangle is big enough, automatically sample color from perimeter
      if (selectionRect && selectionRect.width > 20 && selectionRect.height > 10) {
        handleAutoSampleSelectionPerimeter();
      }
    }
  }, [isDrawingRect, selectionRect]);

  // Window mouseup listener so dragging/painting doesn't get stuck if cursor leaves canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDown.current) {
        handleMouseUp();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp]);

  // Draw brush stroke onto canvas
  const drawBrushStroke = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (currentMode === 'clone' && cloneSource && lastPos.current) {
      // Clone Stamp Mode
      const dx = x - lastPos.current.x;
      const dy = y - lastPos.current.y;
      const origCanvas = originalCanvasRef.current || canvas;
      try {
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          origCanvas,
          cloneSource.x - brushSize / 2,
          cloneSource.y - brushSize / 2,
          brushSize,
          brushSize,
          x - brushSize / 2,
          y - brushSize / 2,
          brushSize,
          brushSize
        );
      } catch (e) {
        // ignore
      }
    } else {
      // Standard Inpaint / Eraser Brush
      ctx.fillStyle = pickedColor;
      ctx.globalAlpha = brushOpacity;
      if (brushSoftness > 0) {
        ctx.shadowColor = pickedColor;
        ctx.shadowBlur = (brushSize * brushSoftness) / 100;
      }
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // Burn / Render Text Elements directly into Canvas before Export or on Demand
  const renderAllToExportCanvas = (): HTMLCanvasElement | null => {
    const baseCanvas = canvasRef.current;
    if (!baseCanvas) return null;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = baseCanvas.width;
    exportCanvas.height = baseCanvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    // Draw base canvas
    ctx.drawImage(baseCanvas, 0, 0);

    // Draw all active text elements with high typography rendering
    textElements.forEach((el) => {
      ctx.save();
      ctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${el.fontSize}px ${el.fontFamily}`;
      ctx.fillStyle = el.color;
      ctx.textAlign = el.align;
      ctx.textBaseline = 'middle';

      if (el.letterSpacing > 0 && (ctx as any).letterSpacing) {
        (ctx as any).letterSpacing = `${el.letterSpacing}px`;
      }

      ctx.fillText(el.text, el.x, el.y);
      ctx.restore();
    });

    return exportCanvas;
  };

  // Export as PNG
  const handleExportPNG = () => {
    const exportCanvas = renderAllToExportCanvas();
    if (!exportCanvas) return;

    exportCanvas.toBlob((blob) => {
      if (blob) {
        const outName = `${fileDetails?.name.replace(/\.[^/.]+$/, '') || 'Certificate'}_Edited.png`;
        downloadBlob(blob, outName);
        onAddToHistory({
          toolId: 'certificate-editor',
          toolName: 'Certificate & Text Eraser',
          originalName: fileDetails?.name || 'Certificate.png',
          resultName: outName,
          originalSize: fileDetails?.size || blob.size,
          resultSize: blob.size,
          savedBytes: 0,
        });
        notify('Downloaded High-Res PNG!');
      }
    }, 'image/png');
  };

  // Export as JPG
  const handleExportJPG = () => {
    const exportCanvas = renderAllToExportCanvas();
    if (!exportCanvas) return;

    exportCanvas.toBlob(
      (blob) => {
        if (blob) {
          const outName = `${fileDetails?.name.replace(/\.[^/.]+$/, '') || 'Certificate'}_Edited.jpg`;
          downloadBlob(blob, outName);
          onAddToHistory({
            toolId: 'certificate-editor',
            toolName: 'Certificate & Text Eraser',
            originalName: fileDetails?.name || 'Certificate.jpg',
            resultName: outName,
            originalSize: fileDetails?.size || blob.size,
            resultSize: blob.size,
            savedBytes: 0,
          });
          notify('Downloaded High-Quality JPG!');
        }
      },
      'image/jpeg',
      0.95
    );
  };

  // Export as PDF (Print-ready)
  const handleExportPDF = () => {
    const exportCanvas = renderAllToExportCanvas();
    if (!exportCanvas) return;

    const imgData = exportCanvas.toDataURL('image/jpeg', 0.96);
    const isLandscape = exportCanvas.width > exportCanvas.height;

    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'px',
      format: [exportCanvas.width, exportCanvas.height],
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, exportCanvas.width, exportCanvas.height);
    const outName = `${fileDetails?.name.replace(/\.[^/.]+$/, '') || 'Certificate'}_Edited.pdf`;
    pdf.save(outName);

    notify('Downloaded Print-Ready PDF Certificate!');
  };

  // Copy to Clipboard
  const handleCopyToClipboard = async () => {
    const exportCanvas = renderAllToExportCanvas();
    if (!exportCanvas) return;

    try {
      exportCanvas.toBlob(async (blob) => {
        if (blob && (window as any).ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2500);
          notify('Copied image to clipboard!');
        } else {
          notify('Clipboard copy not supported in this browser.');
        }
      }, 'image/png');
    } catch (e) {
      notify('Failed to copy to clipboard.');
    }
  };

  // Reset to original
  const handleResetToOriginal = () => {
    const canvas = canvasRef.current;
    const orig = originalCanvasRef.current;
    if (!canvas || !orig) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(orig, 0, 0);
    const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistoryStack([initial]);
    setHistoryIndex(0);
    setTextElements([]);
    setSelectionRect(null);
    notify('Reset to original certificate.');
  };

  return (
    <div className="flex flex-col h-full space-y-4 max-w-7xl mx-auto">
      {/* Top Banner / Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Eraser className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Certificate & Text Eraser
            </h1>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              100% Offline
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Remove names, dates, or signatures from certificates and documents seamlessly. Auto-match background colors and replace with crisp new typography.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {!fileDetails && (
            <button
              onClick={handleLoadSampleCertificate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Try Sample Certificate
            </button>
          )}

          {fileDetails && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFileDetails(null);
                  setSelectedFile(null);
                  setSelectionRect(null);
                  setTextElements([]);
                  setHistoryStack([]);
                  setHistoryIndex(-1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 border border-stone-200 dark:border-stone-800 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                title="Upload or choose a different certificate"
              >
                <Upload className="w-3.5 h-3.5" />
                Change Certificate
              </button>
              <button
                onClick={handleResetToOriginal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 border border-stone-200 dark:border-stone-800 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                title="Reset all modifications back to initial image"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Original
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-16 right-6 z-50 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 px-4 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          {notification}
        </div>
      )}

      {/* Main Working Area */}
      {!fileDetails ? (
        <div className="flex-1 flex flex-col justify-center items-center py-10">
          <div className="w-full max-w-2xl">
            <DropZone
              onFilesSelected={handleFileSelected}
              acceptedFormats={['.png', '.jpg', '.jpeg', '.webp', '.pdf']}
              multiple={false}
              title="Drag & Drop Certificate or Document Image"
              subtitle="Supports PNG, JPG, WEBP, or PDF certificates (Processed 100% locally on your machine)"
            />

            <div className="mt-6 flex flex-col items-center justify-center p-6 bg-stone-50 dark:bg-stone-900/40 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 text-center">
              <span className="text-sm text-stone-600 dark:text-stone-400 font-medium">Don't have a certificate handy right now?</span>
              <p className="text-xs text-stone-500 dark:text-stone-500 mt-1 max-w-md">
                Click below to load an authentic certificate template and test erasing "Muhammad Nouman Khan" with 1-click!
              </p>
              <button
                onClick={handleLoadSampleCertificate}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Load Sample Certificate (Interactive Demo)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Left Toolbar / Settings Panel */}
          <div className="w-full lg:w-80 flex flex-col gap-3 shrink-0 overflow-y-auto">
            {/* Tool Selection Tabs */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-xs">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-2">
                Active Tool
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setCurrentMode('select-rect')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentMode === 'select-rect'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Drag a box over the name to clean it instantly"
                >
                  <Square className="w-3.5 h-3.5" />
                  Rectangle Patch
                </button>

                <button
                  onClick={() => setCurrentMode('brush')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentMode === 'brush'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Freehand brush to erase uneven text or signatures"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  Eraser Brush
                </button>

                <button
                  onClick={() => {
                    setCurrentMode('clone');
                    setIsSelectingCloneSource(true);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentMode === 'clone'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Stamp parchment/texture from another part of certificate"
                >
                  <Stamp className="w-3.5 h-3.5" />
                  Clone Stamp
                </button>

                <button
                  onClick={() => setCurrentMode('text')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentMode === 'text'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                  title="Add new recipient name with custom typography"
                >
                  <Type className="w-3.5 h-3.5" />
                  Add New Name
                </button>
              </div>
            </div>

            {/* Tool Specific Controls */}
            {/* 1. Rectangle Patch Mode Controls */}
            {currentMode === 'select-rect' && (
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Square className="w-3.5 h-3.5 text-emerald-600" />
                    Rectangle Eraser Settings
                  </span>
                  <span className="text-[10px] text-stone-500">Box Cleaner</span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-stone-600 dark:text-stone-400">Step 1: Select Box Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={pickedColor}
                      onChange={(e) => setPickedColor(e.target.value)}
                      className="w-8 h-8 rounded-md border border-stone-300 dark:border-stone-700 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={pickedColor}
                      onChange={(e) => setPickedColor(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs font-mono bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                    />
                    <button
                      onClick={() => setCurrentMode('eyedropper')}
                      className="p-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg text-stone-700 dark:text-stone-300 cursor-pointer"
                      title="Pick exact background color with eyedropper"
                    >
                      <Pipette className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Feathering / Soft Edge */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                    <span>Edge Softness (Feather):</span>
                    <span>{feather}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={feather}
                    onChange={(e) => setFeather(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                {/* Paper texture noise toggle */}
                <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addNoise}
                    onChange={(e) => setAddNoise(e.target.checked)}
                    className="rounded-sm text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Blend subtle paper texture grain</span>
                </label>

                {/* Action Button */}
                {selectionRect && (
                  <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
                    <button
                      onClick={handleAutoSampleSelectionPerimeter}
                      className="w-full py-1.5 px-3 text-xs font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Auto-Match Surrounding Color
                    </button>
                    <button
                      onClick={handleApplyRectPatch}
                      className="w-full py-2 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Erase Name from Box
                    </button>
                  </div>
                )}

                {!selectionRect && (
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 italic">
                    💡 Click and drag a rectangle over the name on the certificate to clean it.
                  </p>
                )}
              </div>
            )}

            {/* 2. Brush Mode Controls */}
            {currentMode === 'brush' && (
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-xs space-y-3">
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Paintbrush className="w-3.5 h-3.5 text-emerald-600" />
                  Brush Eraser Settings
                </span>

                <div className="space-y-1">
                  <span className="text-xs text-stone-600 dark:text-stone-400">Brush Color:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={pickedColor}
                      onChange={(e) => setPickedColor(e.target.value)}
                      className="w-8 h-8 rounded-md border border-stone-300 dark:border-stone-700 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={pickedColor}
                      onChange={(e) => setPickedColor(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs font-mono bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                    />
                    <button
                      onClick={() => setCurrentMode('eyedropper')}
                      className="p-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg text-stone-700 dark:text-stone-300 cursor-pointer"
                      title="Pick exact background color with eyedropper"
                    >
                      <Pipette className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                    <span>Brush Size:</span>
                    <span>{brushSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                    <span>Edge Softness:</span>
                    <span>{brushSoftness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={brushSoftness}
                    onChange={(e) => setBrushSoftness(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* 3. Clone Stamp Controls */}
            {currentMode === 'clone' && (
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Stamp className="w-3.5 h-3.5 text-emerald-600" />
                    Clone Stamp (Texture Copier)
                  </span>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                    Pro Tool
                  </span>
                </div>

                {/* Urdu / Simple explanation box */}
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs space-y-1.5">
                  <p className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    <span>💡 Yeh kya karta hai? (What is it?)</span>
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    Certificate ke kisi <strong>saaf kaghaz/texture</strong> ko copy kar ke puraane naam ke upar chhaap (stamp) deta hai taake koi dhabba na bane.
                  </p>
                </div>

                {/* Step 1 & Step 2 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700 dark:text-stone-300">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Step 1: Saaf jagah select karein</span>
                  </div>

                  <button
                    onClick={() => setIsSelectingCloneSource(true)}
                    className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isSelectingCloneSource
                        ? 'bg-amber-600 text-white animate-pulse shadow-md'
                        : cloneSource
                        ? 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    {isSelectingCloneSource
                      ? '👉 Certificate par click karke sample lein'
                      : cloneSource
                      ? 'Re-pick Sample Point (Change)'
                      : 'Pick Clean Texture Sample'}
                  </button>

                  {cloneSource && (
                    <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                      <span>✓ Sample ready:</span>
                      <span className="font-mono font-semibold">({cloneSource.x}, {cloneSource.y})</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 pt-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Step 2: Puraane naam par mouse pherein</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 pl-6">
                    Puraane text ke upar click aur drag karein—wahan saaf background copy ho kar text gayab ho jayega!
                  </p>
                </div>

                <div className="space-y-1 pt-1 border-t border-stone-200 dark:border-stone-800">
                  <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                    <span>Stamp Size (Brush):</span>
                    <span>{brushSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                {/* Simpler alternative button */}
                <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                  <button
                    onClick={() => setCurrentMode('select-rect')}
                    className="w-full py-1.5 px-2 text-[11px] text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer text-center block"
                  >
                    ⚡ Asaan tareeqa chahiye? Try <strong>Rectangle Patch</strong>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Text Replacement Controls */}
            {currentMode === 'text' && (
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-xs space-y-3">
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-emerald-600" />
                  New Replacement Text / Name
                </span>

                {/* Text Input */}
                <div className="space-y-1">
                  <label className="text-xs text-stone-600 dark:text-stone-400">Recipient Name / Title:</label>
                  <input
                    type="text"
                    value={newTextValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTextValue(val);
                      if (selectedTextId) {
                        setTextElements((prev) =>
                          prev.map((el) => (el.id === selectedTextId ? { ...el, text: val } : el))
                        );
                      }
                    }}
                    placeholder="Enter new recipient name..."
                    className="w-full px-3 py-1.5 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-medium"
                  />
                </div>

                {/* Font Family Picker */}
                <div className="space-y-1">
                  <label className="text-xs text-stone-600 dark:text-stone-400">Certificate Font Style:</label>
                  <select
                    value={textFont}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTextFont(val);
                      if (selectedTextId) {
                        setTextElements((prev) =>
                          prev.map((el) => (el.id === selectedTextId ? { ...el, fontFamily: val } : el))
                        );
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  >
                    <option value="'Times New Roman', Times, serif">Classic Serif (Times New Roman)</option>
                    <option value="'Cinzel', 'Georgia', serif">Academic Formal (Cinzel / Georgia)</option>
                    <option value="'Brush Script MT', cursive, serif">Calligraphy / Script (Brush Script)</option>
                    <option value="'Montserrat', 'Arial', sans-serif">Modern Clean (Montserrat / Sans)</option>
                    <option value="'Courier New', Courier, monospace">Official Registry (Courier)</option>
                  </select>
                </div>

                {/* Font Size & Color */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-xs text-stone-600 dark:text-stone-400">Size: {textSize}px</span>
                    <input
                      type="range"
                      min="16"
                      max="120"
                      value={textSize}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTextSize(val);
                        if (selectedTextId) {
                          setTextElements((prev) =>
                            prev.map((el) => (el.id === selectedTextId ? { ...el, fontSize: val } : el))
                          );
                        }
                      }}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-stone-600 dark:text-stone-400">Text Color</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTextColor(val);
                          if (selectedTextId) {
                            setTextElements((prev) =>
                              prev.map((el) => (el.id === selectedTextId ? { ...el, color: val } : el))
                            );
                          }
                        }}
                        className="w-7 h-7 rounded border border-stone-300 dark:border-stone-700 cursor-pointer p-0"
                      />
                      <button
                        onClick={() => {
                          const gold = '#c59b27';
                          setTextColor(gold);
                          if (selectedTextId) {
                            setTextElements((prev) =>
                              prev.map((el) => (el.id === selectedTextId ? { ...el, color: gold } : el))
                            );
                          }
                        }}
                        className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-semibold cursor-pointer"
                        title="Certificate Gold Color"
                      >
                        Gold
                      </button>
                      <button
                        onClick={() => {
                          const navy = '#1e3a8a';
                          setTextColor(navy);
                          if (selectedTextId) {
                            setTextElements((prev) =>
                              prev.map((el) => (el.id === selectedTextId ? { ...el, color: navy } : el))
                            );
                          }
                        }}
                        className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded font-semibold cursor-pointer"
                        title="Executive Navy Color"
                      >
                        Navy
                      </button>
                    </div>
                  </div>
                </div>

                {/* Formatting Toggles */}
                <div className="flex items-center justify-between border-t border-stone-200 dark:border-stone-800 pt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setTextBold(!textBold);
                        if (selectedTextId) {
                          setTextElements((prev) =>
                            prev.map((el) => (el.id === selectedTextId ? { ...el, bold: !textBold } : el))
                          );
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                        textBold
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                      }`}
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setTextItalic(!textItalic);
                        if (selectedTextId) {
                          setTextElements((prev) =>
                            prev.map((el) => (el.id === selectedTextId ? { ...el, italic: !textItalic } : el))
                          );
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                        textItalic
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                      }`}
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setTextAlign('left');
                        if (selectedTextId) {
                          setTextElements((prev) =>
                            prev.map((el) => (el.id === selectedTextId ? { ...el, align: 'left' } : el))
                          );
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                        textAlign === 'left'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setTextAlign('center');
                        if (selectedTextId) {
                          setTextElements((prev) =>
                            prev.map((el) => (el.id === selectedTextId ? { ...el, align: 'center' } : el))
                          );
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                        textAlign === 'center'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setTextAlign('right');
                        if (selectedTextId) {
                          setTextElements((prev) =>
                            prev.map((el) => (el.id === selectedTextId ? { ...el, align: 'right' } : el))
                          );
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                        textAlign === 'right'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  👆 Drag the text on the certificate to place it exactly where you want.
                </p>
              </div>
            )}

            {/* Export & Actions Section */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-xs space-y-2">
              <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Download Clean Certificate
              </span>

              <button
                onClick={handleExportPNG}
                className="w-full py-2 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download High-Res PNG (Lossless)
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={handleExportJPG}
                  className="py-1.5 px-2.5 text-xs font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  JPG (Photo)
                </button>

                <button
                  onClick={handleExportPDF}
                  className="py-1.5 px-2.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-900 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Print PDF
                </button>
              </div>

              <button
                onClick={handleCopyToClipboard}
                className="w-full py-1.5 px-3 text-xs font-medium border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {isCopied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>

          {/* Right Main Canvas Canvas Viewer */}
          <div className="flex-1 flex flex-col bg-stone-100 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-inner">
            {/* Canvas Header Control Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 text-xs">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-700 dark:text-stone-300 cursor-pointer"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= historyStack.length - 1}
                  className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed text-stone-700 dark:text-stone-300 cursor-pointer"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
                <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-1" />
                <span className="text-[11px] text-stone-500 font-mono">
                  {fileDetails ? `${fileDetails.width}×${fileDetails.height}px` : ''}
                </span>
              </div>

              {/* Zoom & View Controls */}
              <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-lg border border-stone-200 dark:border-stone-700/60 shadow-xs">
                {/* Hold to Compare Original */}
                <button
                  onMouseDown={() => setIsHoldingOriginal(true)}
                  onMouseUp={() => setIsHoldingOriginal(false)}
                  onTouchStart={() => setIsHoldingOriginal(true)}
                  onTouchEnd={() => setIsHoldingOriginal(false)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white dark:bg-stone-700 hover:bg-stone-50 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 rounded select-none cursor-pointer border border-stone-200/60 dark:border-stone-600 shadow-2xs"
                  title="Press and hold to see the original unmodified certificate"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  <span className="hidden sm:inline">Compare</span>
                </button>

                <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5" />

                {/* Fit Entire Screen */}
                <button
                  onClick={() => handleFitToScreen()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded cursor-pointer border border-emerald-200 dark:border-emerald-800/50 transition-colors shadow-2xs"
                  title="Fit entire certificate into screen so all edges are visible"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Fit Screen</span>
                </button>

                {/* Fit Width */}
                <button
                  onClick={() => handleFitToWidth()}
                  className="px-2 py-1 text-[11px] font-medium hover:bg-white dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded cursor-pointer transition-colors"
                  title="Fit certificate width to window"
                >
                  Fit Width
                </button>

                {/* 100% Original Size */}
                <button
                  onClick={() => setZoom(1.0)}
                  className="px-1.5 py-1 text-[11px] font-medium hover:bg-white dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 rounded cursor-pointer transition-colors"
                  title="View at 100% original size"
                >
                  100%
                </button>

                <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5" />

                <button
                  onClick={() => setZoom((z) => Math.max(0.1, Number((z - 0.1).toFixed(2))))}
                  className="p-1 hover:bg-white dark:hover:bg-stone-700 rounded text-stone-600 dark:text-stone-400 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-stone-700 dark:text-stone-300 w-11 text-center font-semibold">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
                  className="p-1 hover:bg-white dark:hover:bg-stone-700 rounded text-stone-600 dark:text-stone-400 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas Container with Non-Clipping Center Wrapper */}
            <div
              ref={containerRef}
              className="flex-1 overflow-auto p-4 md:p-6 relative select-none bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] flex min-h-0"
            >
              {/* Floating Clone Mode Quick Guide Banner */}
              {currentMode === 'clone' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-stone-900/95 dark:bg-stone-950/95 text-white text-xs px-4 py-2 rounded-full shadow-2xl border border-stone-700/80 flex items-center gap-2.5 backdrop-blur-md transition-all">
                  {isSelectingCloneSource ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                      <span className="font-semibold text-amber-300">Step 1:</span>
                      <span className="text-stone-200">Certificate ke kisi saaf kaghaz/hissay par click karein (Sample lena)</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="font-semibold text-emerald-300">Step 2:</span>
                      <span className="text-stone-200">Ab puraane naam ke upar mouse drag karein (Clean Texture chhaap jayega)</span>
                      <button
                        onClick={() => setIsSelectingCloneSource(true)}
                        className="ml-2 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-medium border border-stone-700 cursor-pointer"
                      >
                        Change Sample
                      </button>
                    </>
                  )}
                </div>
              )}

              {fileDetails && (
                <div
                  className="m-auto relative"
                  style={{
                    width: `${Math.round(fileDetails.width * zoom)}px`,
                    height: `${Math.round(fileDetails.height * zoom)}px`,
                    minWidth: `${Math.round(fileDetails.width * zoom)}px`,
                    minHeight: `${Math.round(fileDetails.height * zoom)}px`,
                  }}
                >
                  <div
                    className="relative shadow-2xl rounded-sm overflow-hidden"
                    style={{
                      width: `${fileDetails.width}px`,
                      height: `${fileDetails.height}px`,
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left',
                      cursor:
                        currentMode === 'select-rect'
                          ? 'crosshair'
                          : currentMode === 'eyedropper'
                          ? 'copy'
                          : currentMode === 'brush'
                          ? 'crosshair'
                          : currentMode === 'clone'
                          ? 'crosshair'
                          : currentMode === 'text'
                          ? 'text'
                          : 'default',
                    }}
                  >
                    {/* Active Working Canvas */}
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      className={`block max-w-none ${isHoldingOriginal ? 'hidden' : 'block'}`}
                    />

                    {/* Original Canvas (shown when comparing) */}
                    <canvas
                      ref={originalCanvasRef}
                      className={`block max-w-none ${isHoldingOriginal ? 'block' : 'hidden'}`}
                    />

                    {/* Clone Stamp Source Crosshair Pin */}
                    {currentMode === 'clone' && cloneSource && !isHoldingOriginal && (
                      <div
                        className="absolute pointer-events-none z-20 flex items-center justify-center"
                        style={{
                          left: `${cloneSource.x}px`,
                          top: `${cloneSource.y}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <div className="w-6 h-6 rounded-full border-2 border-amber-500 bg-amber-500/20 animate-ping absolute" />
                        <div className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center bg-black/40">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        </div>
                        <span className="absolute top-6 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow font-semibold whitespace-nowrap">
                          🎯 Texture Source
                        </span>
                      </div>
                    )}

                    {/* Overlay Selection Rectangle when dragging */}
                    {selectionRect && currentMode === 'select-rect' && !isHoldingOriginal && (
                      <div
                        className="absolute border-2 border-emerald-500 bg-emerald-500/20 pointer-events-none"
                        style={{
                          left: `${selectionRect.x}px`,
                          top: `${selectionRect.y}px`,
                          width: `${selectionRect.width}px`,
                          height: `${selectionRect.height}px`,
                        }}
                      >
                        <span className="absolute -top-6 left-0 bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow">
                          {selectionRect.width} × {selectionRect.height}px
                        </span>

                        {/* Interactive Floating Quick Action Bar */}
                        {!isDrawingRect && selectionRect.width > 20 && selectionRect.height > 10 && (
                          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded-full shadow-2xl pointer-events-auto z-30 whitespace-nowrap transition-all">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoSampleSelectionPerimeter();
                              }}
                              className="hover:underline flex items-center gap-1 cursor-pointer pr-1.5 border-r border-emerald-500 text-[11px]"
                              title="Auto sample background color around this box"
                            >
                              <Pipette className="w-3 h-3" />
                              <span>Match Color</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApplyRectPatch();
                              }}
                              className="font-bold flex items-center gap-1 cursor-pointer text-xs"
                              title="Erase the selected name or text"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>Erase Name ✨</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Elements Live Overlay on Canvas */}
                    {!isHoldingOriginal &&
                      textElements.map((el) => (
                        <div
                          key={el.id}
                          onClick={() => {
                            setSelectedTextId(el.id);
                            setNewTextValue(el.text);
                            setTextSize(el.fontSize);
                            setTextColor(el.color);
                            setTextFont(el.fontFamily);
                          }}
                          className={`absolute select-none cursor-move transition-shadow ${
                            selectedTextId === el.id
                              ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-transparent'
                              : 'hover:ring-1 hover:ring-blue-400'
                          }`}
                          style={{
                            left: `${el.x}px`,
                            top: `${el.y}px`,
                            transform: `translate(${el.align === 'center' ? '-50%' : el.align === 'right' ? '-100%' : '0'}, -50%)`,
                            fontFamily: el.fontFamily,
                            fontSize: `${el.fontSize}px`,
                            color: el.color,
                            fontWeight: el.bold ? 'bold' : 'normal',
                            fontStyle: el.italic ? 'italic' : 'normal',
                            letterSpacing: `${el.letterSpacing}px`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {el.text}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
