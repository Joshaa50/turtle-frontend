import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Loader2, AlertCircle, ImageOff } from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { downscaleImage } from '../lib/downscaleImage';
import { Button, ErrorMessage } from './UIComponents';

/**
 * Photographs of a nest, as opposed to the triangulation shots that exist to
 * find it again: a cage in place, predation damage, an excavation.
 */

interface NestPhotoMeta {
  id: number;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
  size_bytes: number;
}

interface NestPhotosProps {
  nestId: number | string;
  /** Reviewers may delete; removing the photo of a predated nest is evidence. */
  canDelete?: boolean;
  canAdd?: boolean;
}

/** Loads one photo through the authenticated endpoint and cleans up after itself. */
const Thumb: React.FC<{ photo: NestPhotoMeta; onDelete?: () => void; canDelete?: boolean }> = ({ photo, onDelete, canDelete }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    DatabaseConnection.fetchNestPhotoObjectUrl(photo.id)
      .then((u) => {
        if (revoked) { URL.revokeObjectURL(u); return; }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setFailed(true));
    // Without this every nest opened leaks a blob for the life of the tab.
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id]);

  return (
    <figure className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 group">
      <div className="aspect-[4/3] flex items-center justify-center">
        {failed ? (
          <ImageOff className="size-6 text-slate-400" />
        ) : url ? (
          <img src={url} alt={photo.caption || 'Nest photograph'} className="w-full h-full object-cover" />
        ) : (
          <Loader2 className="size-5 animate-spin text-slate-400" />
        )}
      </div>
      <figcaption className="p-2">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
          {photo.caption || 'No caption'}
        </p>
        <p className="text-[10px] text-slate-400 truncate">
          {new Date(photo.created_at).toLocaleDateString()}
          {photo.uploaded_by ? ` · ${photo.uploaded_by}` : ''}
        </p>
      </figcaption>
      {canDelete && (
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-rose-600"
          title="Delete this photo"
          aria-label={`Delete photo${photo.caption ? `: ${photo.caption}` : ''}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </figure>
  );
};

const NestPhotos: React.FC<NestPhotosProps> = ({ nestId, canDelete = false, canAdd = true }) => {
  const [photos, setPhotos] = useState<NestPhotoMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setPhotos(await DatabaseConnection.getNestPhotos(nestId));
    setIsLoading(false);
  }, [nestId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      // Shrunk here, not on the server: an unmodified phone photo can exceed
      // the API's whole body limit, and a 6MB upload over dawn mobile data is
      // the one most likely to time out halfway.
      const shrunk = await downscaleImage(file);
      await DatabaseConnection.addNestPhoto(nestId, {
        image: shrunk.base64,
        mime_type: shrunk.mimeType,
        caption: caption.trim() || undefined,
      });
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not add that photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const remove = async (photo: NestPhotoMeta) => {
    if (!window.confirm(`Delete this photo${photo.caption ? ` ("${photo.caption}")` : ''}? This cannot be undone.`)) return;
    setError(null);
    try {
      await DatabaseConnection.deleteNestPhoto(photo.id);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not delete that photo.');
    }
  };

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3 text-primary">
        <Camera className="size-5" />
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
          Field Photographs{photos.length > 0 ? ` (${photos.length})` : ''}
        </h3>
      </div>

      {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}

      {canAdd && (
        <div className="mb-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional) — e.g. cage in place, predation damage"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm outline-none focus:border-primary"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            // capture prompts the camera directly on a phone, which is where
            // these are taken.
            capture="environment"
            disabled={isUploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-white"
          />
          {isUploading && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Resizing and uploading…
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading photos…</p>
      ) : photos.length === 0 ? (
        <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <AlertCircle className="size-5 mx-auto mb-2 text-slate-400" />
          <p className="text-xs text-slate-500">
            No photographs of this nest yet. These are for documenting it — a cage in place,
            damage, an excavation — not for relocating it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p) => (
            <Thumb key={p.id} photo={p} canDelete={canDelete} onDelete={() => remove(p)} />
          ))}
        </div>
      )}
    </section>
  );
};

export default NestPhotos;
