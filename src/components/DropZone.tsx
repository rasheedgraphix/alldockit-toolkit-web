import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FilePlus, AlertCircle } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedFormats: string[]; // e.g. ['.pdf'] or ['.jpg', '.png', '.webp', '.jpeg', '.heic']
  multiple?: boolean;
  title?: string;
  subtitle?: string;
  hint?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  acceptedFormats,
  multiple = true,
  title = 'Drag & drop your files here',
  subtitle,
  hint,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      filterAndEmit(files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      filterAndEmit(files);
      // Reset input value so re-selecting the same file works
      e.target.value = '';
    }
  };

  const filterAndEmit = (files: File[]) => {
    // If acceptedFormats specified, filter by extension or mime
    const validFiles = files.filter((file) => {
      if (acceptedFormats.length === 0) return true;
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return acceptedFormats.some(
        (fmt) =>
          fmt.toLowerCase() === ext ||
          file.type.toLowerCase().includes(fmt.replace('.', '').toLowerCase())
      );
    });

    if (validFiles.length > 0) {
      onFilesSelected(multiple ? validFiles : [validFiles[0]]);
    }
  };

  // Clipboard paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files);
        filterAndEmit(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [acceptedFormats, multiple]);

  return (
    <div
      id="drop-zone-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group ${
        isDragOver
          ? 'border-stone-900 bg-stone-100/90 dark:border-stone-100 dark:bg-stone-800/80 scale-[1.005]'
          : 'border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-600 bg-stone-50/50 dark:bg-stone-900/30'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptedFormats.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center space-y-4">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${
            isDragOver
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950'
              : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
          }`}
        >
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="space-y-1.5 max-w-md">
          <p className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {title}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {subtitle || (
              <>
                or click to browse from your computer <span className="hidden sm:inline">· Paste from clipboard</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            id="browse-files-button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 shadow-sm transition-opacity"
          >
            <FilePlus className="w-3.5 h-3.5" />
            Select Files
          </button>
        </div>

        {hint && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 pt-1">
            <AlertCircle className="w-3 h-3 text-stone-400" />
            <span>{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
};
