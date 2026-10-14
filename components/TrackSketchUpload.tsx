import React, { useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { downscaleImage } from '../lib/downscaleImage';

interface TrackSketchUploadProps {
  id: string;
  /** Whether the record already has a sketch attached (its image is not sent to the form). */
  hasSketch: boolean;
  /** The newly chosen sketch as a data URL, or null when none has been chosen. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

/**
 * Minimal track-sketch capture for correction forms: pick an image, see it,
 * send it. Mirrors the sketch the Emergence Entry screen stores (a data URL),
 * but without the drawing pad.
 */
const TrackSketchUpload: React.FC<TrackSketchUploadProps> = ({ id, hasSketch, value, onChange, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const shrunk = await downscaleImage(file);
      onChange(`data:${shrunk.mimeType};base64,${shrunk.base64}`);
    } catch (err: any) {
      setError(err?.message || 'That file could not be read as an image.');
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[7rem_1fr] gap-x-4 gap-y-1 items-start">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500 pt-2">Track sketch</span>
      <div className="space-y-2">
        {value ? (
          <div className="relative rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-white">
            <img src={value} alt="New track sketch" className="w-full max-h-48 object-contain" />
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              title="Remove new sketch"
              className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white shadow disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {hasSketch ? 'Attached. Upload a new sketch to replace it.' : 'None attached.'}
          </p>
        )}
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-500/10 disabled:opacity-50"
        >
          <Pencil className="size-4" />
          {value ? 'Choose another image' : 'Upload track sketch'}
        </button>
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </div>
  );
};

export default TrackSketchUpload;
