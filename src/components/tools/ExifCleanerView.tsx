import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Camera,
  Calendar,
  Smartphone,
  ExternalLink,
  Copy,
  CheckCircle2,
  Lock,
  Trash2,
  Download,
  Info,
  Search,
  Share2,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { formatBytes } from '../../utils/fileHelpers';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { shareViaWhatsApp, trackActionAndCheckRatePrompt } from '../../utils/share';
import ExifReader from 'exifreader';

interface ExifCleanerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

interface PhotoDeviceDetails {
  make?: string;
  model?: string;
  software?: string;
  lens?: string;
}

interface PhotoGpsDetails {
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  formattedCoords?: string;
  googleMapsUrl?: string;
}

interface PhotoCameraSettings {
  dateTaken?: string;
  fNumber?: string;
  exposureTime?: string;
  iso?: string;
  focalLength?: string;
  flash?: string;
}

export const ExifCleanerView: React.FC<ExifCleanerViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Extracted Metadata State
  const [deviceInfo, setDeviceInfo] = useState<PhotoDeviceDetails | null>(null);
  const [gpsInfo, setGpsInfo] = useState<PhotoGpsDetails | null>(null);
  const [cameraSettings, setCameraSettings] = useState<PhotoCameraSettings | null>(null);
  const [rawTags, setRawTags] = useState<{ tag: string; value: string }[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState<string>('');
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);

  // Sanitizing / Cleaning Settings
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [quality, setQuality] = useState<number>(95);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  // Parse EXIF, Device, and GPS details using ExifReader
  const handleInspectPhoto = async (file: File) => {
    setSelectedFile(file);
    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const tags = ExifReader.load(buffer, { expanded: true });

      // 1. Device Info
      const make = tags.exif?.Make?.description || (tags as any).file?.Make?.description;
      const model = tags.exif?.Model?.description || (tags as any).file?.Model?.description;
      const software = tags.exif?.Software?.description;
      const lens = tags.exif?.LensModel?.description;

      setDeviceInfo({
        make: make ? String(make) : undefined,
        model: model ? String(model) : undefined,
        software: software ? String(software) : undefined,
        lens: lens ? String(lens) : undefined,
      });

      // 2. GPS Location Info
      if (tags.gps && typeof tags.gps.Latitude === 'number' && typeof tags.gps.Longitude === 'number') {
        const lat = tags.gps.Latitude;
        const lng = tags.gps.Longitude;
        const alt = typeof tags.gps.Altitude === 'number' ? Math.round(tags.gps.Altitude) : undefined;

        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        const formatted = `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

        setGpsInfo({
          hasGps: true,
          latitude: lat,
          longitude: lng,
          altitude: alt,
          formattedCoords: formatted,
          googleMapsUrl: mapsUrl,
        });
      } else {
        setGpsInfo({
          hasGps: false,
        });
      }

      // 3. Camera Shot Settings & Date
      const dateTaken =
        tags.exif?.DateTimeOriginal?.description ||
        tags.exif?.DateTimeDigitized?.description ||
        tags.exif?.DateTime?.description;
      const fNumber = tags.exif?.FNumber?.description;
      const exposure = tags.exif?.ExposureTime?.description;
      const iso = tags.exif?.ISOSpeedRatings?.description || (tags.exif as any)?.ISO?.description;
      const focalLength = tags.exif?.FocalLength?.description;
      const flash = tags.exif?.Flash?.description;

      setCameraSettings({
        dateTaken: dateTaken ? String(dateTaken) : undefined,
        fNumber: fNumber ? `f/${fNumber}` : undefined,
        exposureTime: exposure ? `${exposure}s` : undefined,
        iso: iso ? `ISO ${iso}` : undefined,
        focalLength: focalLength ? `${focalLength}` : undefined,
        flash: flash ? String(flash) : undefined,
      });

      // 4. Raw Tags List
      const tagList: { tag: string; value: string }[] = [];
      const flattenTags = (obj: any, prefix = '') => {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
          if (v && typeof v === 'object' && 'description' in v) {
            tagList.push({
              tag: prefix ? `${prefix}.${k}` : k,
              value: String((v as any).description),
            });
          } else if (v && typeof v === 'object' && !Array.isArray(v)) {
            flattenTags(v, k);
          }
        }
      };

      flattenTags(tags);
      setRawTags(tagList);
    } catch (err) {
      console.warn('Exif inspection fallback:', err);
      setDeviceInfo(null);
      setGpsInfo({ hasGps: false });
      setCameraSettings(null);
      setRawTags([]);
    }
  };

  const handleCopyCoords = () => {
    if (gpsInfo?.formattedCoords) {
      navigator.clipboard.writeText(gpsInfo.formattedCoords);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    }
  };

  // Strip EXIF by re-rendering raw pixels into clean Canvas
  const handleCleanExif = async () => {
    if (!selectedFile || !previewUrl) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(20);
    setStatusText('Reading raw pixel data...');

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = previewUrl;
      });

      setProgress(50);
      setStatusText('Rebuilding image on clean canvas (stripping all GPS & Device tags)...');

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d')!;

      // Draw pure pixels with zero metadata overhead
      ctx.drawImage(img, 0, 0);

      setProgress(80);
      setStatusText('Exporting sanitized image...');

      const mimeType = `image/${outputFormat}`;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create clean image blob'));
          },
          mimeType,
          quality / 100
        );
      });

      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
      const fileName = `${baseName}_privacy_cleaned.${ext}`;

      setProgress(100);
      setStatusText('Metadata completely removed!');

      setResult({
        blob,
        fileName,
        size: blob.size,
      });

      onAddToHistory({
        toolId: 'exif-cleaner',
        toolName: 'Photo Info & GPS Finder',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
        resultBlob: blob,
      });

      trackActionAndCheckRatePrompt();
    } catch (err: any) {
      console.error('EXIF cleaning error:', err);
      alert(err?.message || 'Failed to clean image metadata.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareReport = () => {
    if (!selectedFile) return;
    const deviceText = deviceInfo?.model ? `${deviceInfo.make || ''} ${deviceInfo.model}`.trim() : 'Unknown';
    const gpsText = gpsInfo?.hasGps ? `${gpsInfo.formattedCoords} (${gpsInfo.googleMapsUrl})` : 'No GPS embedded';
    const dateText = cameraSettings?.dateTaken || 'Unknown';

    shareViaWhatsApp({
      title: `Photo Metadata Report (${selectedFile.name})`,
      message: `📱 Device: ${deviceText}\n📍 Location: ${gpsText}\n📅 Date: ${dateText}\n⚖️ Size: ${formatBytes(selectedFile.size)}`,
      toolName: 'Photo Info & GPS Inspector',
    });
    trackActionAndCheckRatePrompt();
  };

  const filteredRawTags = rawTags.filter(
    (t) =>
      t.tag.toLowerCase().includes(tagSearchQuery.toLowerCase()) ||
      t.value.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-500" />
            <span>Photo Device Info, Date & GPS Location Finder</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Detect which mobile phone took the photo, exact GPS address coordinates with Google Maps link, and sanitize with 1-click.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% Offline & Private</span>
        </div>
      </div>

      {/* Upload Zone */}
      {!selectedFile && (
        <DropZone
          onFilesSelected={(files) => {
            if (files.length > 0) handleInspectPhoto(files[0]);
          }}
          acceptedFormats={['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tiff', '.bmp']}
          multiple={false}
          title="Drop any photo here to inspect Device & Location"
          subtitle="Supports original camera photos, phone gallery uploads, and images"
        />
      )}

      {/* Active Inspector Workspace */}
      {selectedFile && (
        <div className="space-y-6">
          {/* Main Inspection Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Image Preview & File Meta */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
                <div className="h-60 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-center overflow-hidden p-2">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Inspected File"
                      className="max-h-full max-w-full object-contain rounded"
                    />
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-bold text-stone-900 dark:text-stone-100 truncate">
                    {selectedFile.name}
                  </div>
                  <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                    <span>{formatBytes(selectedFile.size)}</span>
                    <span className="uppercase">{selectedFile.type || 'image/jpeg'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setDeviceInfo(null);
                      setGpsInfo(null);
                      setCameraSettings(null);
                      setResult(null);
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Change Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareReport}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20ba59] rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Key Extracted Cards */}
            <div className="lg:col-span-8 space-y-4">
              {/* 1. Mobile Phone / Camera Model Card */}
              <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Smartphone className="w-5 h-5 shrink-0" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">
                      Device & Camera Model
                    </h3>
                  </div>
                  {deviceInfo?.model ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      Identified
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-500">
                      Not Recorded
                    </span>
                  )}
                </div>

                {deviceInfo?.model ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                      <span className="text-[11px] text-stone-500 block mb-0.5">Phone / Device</span>
                      <strong className="text-stone-900 dark:text-stone-100 text-sm">
                        {deviceInfo.make ? `${deviceInfo.make} ` : ''}
                        {deviceInfo.model}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                      <span className="text-[11px] text-stone-500 block mb-0.5">Operating System / Software</span>
                      <strong className="text-stone-900 dark:text-stone-100">
                        {deviceInfo.software || 'Camera Firmware'}
                      </strong>
                    </div>

                    {deviceInfo.lens && (
                      <div className="sm:col-span-2 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                        <span className="text-[11px] text-stone-500 block mb-0.5">Lens Hardware</span>
                        <span className="font-mono text-stone-800 dark:text-stone-200">{deviceInfo.lens}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    No camera or mobile phone model found. (Common if the photo was downloaded from social media or shared via standard WhatsApp compression).
                  </p>
                )}
              </div>

              {/* 2. GPS Location & Google Maps Card */}
              <div
                className={`p-5 rounded-2xl border shadow-sm space-y-3 transition-colors ${
                  gpsInfo?.hasGps
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin
                      className={`w-5 h-5 shrink-0 ${
                        gpsInfo?.hasGps ? 'text-amber-600 dark:text-amber-400 animate-bounce' : 'text-stone-400'
                      }`}
                    />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-stone-900 dark:text-stone-100">
                      GPS Physical Location Coordinates
                    </h3>
                  </div>

                  {gpsInfo?.hasGps ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Location Found</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Safe (No GPS)
                    </span>
                  )}
                </div>

                {gpsInfo?.hasGps ? (
                  <div className="space-y-3 pt-1">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800/40 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100">
                          {gpsInfo.formattedCoords}
                        </span>
                        {gpsInfo.altitude !== undefined && (
                          <span className="text-[11px] text-stone-500">
                            Altitude: {gpsInfo.altitude} meters
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        ⚠️ <strong>Privacy Warning:</strong> Anyone who receives this original file can view your exact home or photo capture location on a satellite map.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={gpsInfo.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Exact Spot in Google Maps</span>
                      </a>

                      <button
                        type="button"
                        onClick={handleCopyCoords}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedCoords ? 'Coordinates Copied!' : 'Copy GPS'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    No GPS location found in this image. Your location privacy is secure for this photo.
                  </p>
                )}
              </div>

              {/* 3. Date, Time & Camera Settings */}
              {cameraSettings && (
                <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                    <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">
                      Date & Camera Settings
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                      <span className="text-[10px] text-stone-500 block">Date & Time</span>
                      <strong className="text-stone-900 dark:text-stone-100 text-[11px] truncate block">
                        {cameraSettings.dateTaken || 'Unknown'}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                      <span className="text-[10px] text-stone-500 block">Aperture</span>
                      <strong className="text-stone-900 dark:text-stone-100">
                        {cameraSettings.fNumber || 'Auto'}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                      <span className="text-[10px] text-stone-500 block">Shutter Speed</span>
                      <strong className="text-stone-900 dark:text-stone-100">
                        {cameraSettings.exposureTime || 'Auto'}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                      <span className="text-[10px] text-stone-500 block">ISO Speed</span>
                      <strong className="text-stone-900 dark:text-stone-100">
                        {cameraSettings.iso || 'Auto'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Privacy Cleaner Action Banner */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Sanitize & Remove All GPS, Mobile & Date Metadata</span>
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                  Strip 100% of location, mobile serials, and timestamp tags so you can share your photo safely without privacy risk.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
                >
                  <option value="jpeg">Clean JPG</option>
                  <option value="png">Clean PNG</option>
                  <option value="webp">Clean WebP</option>
                </select>

                <button
                  type="button"
                  onClick={handleCleanExif}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  <Lock className="w-4 h-4" />
                  <span>Clean & Download Safe Photo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Searchable Raw EXIF Table */}
          {rawTags.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  All Detected Metadata Tags ({rawTags.length})
                </h4>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="Search tags..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {filteredRawTags.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3 font-mono text-[11px]"
                  >
                    <span className="text-stone-500 font-bold shrink-0">{t.tag}</span>
                    <span className="text-stone-800 dark:text-stone-200 text-right truncate">
                      {t.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="Photo Privacy Secured!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          originalSize={selectedFile?.size}
          toolName="Photo Info & GPS Finder"
          infoBadge="100% EXIF & GPS Stripped"
        />
      )}
    </div>
  );
};
