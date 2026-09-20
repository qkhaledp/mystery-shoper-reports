import clsx from 'clsx';
import { CircleAlert, Eye, ImagePlus, LoaderCircle, Trash2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { useToast } from '../context/ToastContext';
import { primeImageUrl } from '../hooks/useStoredImageUrl';
import { toUserMessage } from '../services/errors';
import { deleteImage, saveImage } from '../services/store';
import type { EvidenceImage } from '../types/observation';
import { createId } from '../utils/id';
import { ACCEPT_ATTRIBUTE, describeFileProblem, processImage } from '../utils/imageProcessing';
import { ImageLightbox } from './ImageLightbox';
import { ImageThumb } from './ImageThumb';

interface UploadItem {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

export function ImageUploader({
  images,
  reportId,
  error,
  onAdd,
  onRemove,
  onUploadingChange,
}: {
  images: EvidenceImage[];
  reportId: string;
  error?: string;
  onAdd: (image: EvidenceImage) => void;
  onRemove: (imageId: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [preview, setPreview] = useState<number | null>(null);

  const activeUploads = uploads.filter((u) => !u.error).length;
  useEffect(() => {
    onUploadingChange?.(activeUploads > 0);
  }, [activeUploads, onUploadingChange]);

  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  async function uploadOne(file: File) {
    const id = createId();
    setUploads((list) => [...list, { id, name: file.name, progress: 5 }]);
    try {
      patchUpload(id, { progress: 20 });
      const processed = await processImage(file);
      patchUpload(id, { progress: 50 });
      const extension = processed.mimeType === 'image/png' ? 'png' : 'jpg';
      const path = await saveImage(reportId, processed.blob, extension);
      patchUpload(id, { progress: 100 });
      primeImageUrl(path, processed.blob);
      onAdd({
        id,
        name: file.name,
        mimeType: processed.mimeType,
        width: processed.width,
        height: processed.height,
        size: processed.blob.size,
        storagePath: path,
      });
      setUploads((list) => list.filter((u) => u.id !== id));
    } catch (e) {
      patchUpload(id, { error: toUserMessage(e, `تعذر رفع الصورة "${file.name}"`) });
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    for (const file of Array.from(fileList)) {
      const problem = describeFileProblem(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      void uploadOne(file);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition',
          dragging
            ? 'border-brand-500 bg-brand-50'
            : error
              ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400'
              : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/40',
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
          <ImagePlus className="h-6 w-6" />
        </span>
        <span className="font-bold text-ink">اسحب الصور هنا أو اضغط لرفع الصور</span>
        <span className="text-xs text-ink-muted">JPG · JPEG · PNG · WEBP — يمكن رفع أكثر من صورة</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.map((u) => (
            <li key={u.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {u.error ? (
                  <CircleAlert className="h-4 w-4 shrink-0 text-rose-500" />
                ) : (
                  <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-brand-500" />
                )}
                <span className="min-w-0 flex-1 truncate">{u.error ?? u.name}</span>
                {u.error ? (
                  <button
                    type="button"
                    className="text-slate-400 hover:text-ink"
                    onClick={() => setUploads((list) => list.filter((x) => x.id !== u.id))}
                    aria-label="إخفاء"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-xs tabular-nums text-ink-muted">{Math.round(u.progress)}%</span>
                )}
              </div>
              {!u.error && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {images.map((image, index) => (
            <li key={image.id} className="group relative">
              <button
                type="button"
                onClick={() => setPreview(index)}
                className="block w-full overflow-hidden rounded-xl ring-1 ring-slate-200"
                aria-label={`معاينة ${image.name}`}
              >
                <ImageThumb image={image} className="aspect-square w-full" />
              </button>
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => setPreview(index)}
                  className="rounded-lg bg-white/95 p-1.5 text-ink shadow hover:bg-white"
                  aria-label="معاينة"
                  title="معاينة"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemove(image.id);
                    void deleteImage(image.storagePath).catch(() => undefined);
                  }}
                  className="rounded-lg bg-white/95 p-1.5 text-rose-600 shadow hover:bg-white"
                  aria-label="حذف الصورة"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ImageLightbox images={images} index={preview} onClose={() => setPreview(null)} onIndexChange={setPreview} />
    </div>
  );
}
