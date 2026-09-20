import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';
import type { EvidenceImage } from '../types/observation';
import { ImageThumb } from './ImageThumb';

export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: EvidenceImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const open = index !== null && !!images[index];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // في الواجهة العربية: السهم الأيسر = التالي
      if (e.key === 'ArrowLeft') onIndexChange(Math.min(index! + 1, images.length - 1));
      if (e.key === 'ArrowRight') onIndexChange(Math.max(index! - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!open) return null;
  const image = images[index!];

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-slate-950/90" role="dialog" aria-modal="true" aria-label="معاينة الصورة">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="truncate text-sm">
          {image.name} · {index! + 1} / {images.length}
        </span>
        <button className="rounded-lg p-2 hover:bg-white/10" onClick={onClose} aria-label="إغلاق">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6" onClick={onClose}>
        <div className="h-full w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
          <ImageThumb image={image} fit="contain" className="h-full w-full !bg-transparent" />
        </div>
        {images.length > 1 && (
          <>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(Math.max(index! - 1, 0));
              }}
              disabled={index === 0}
              aria-label="السابق"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(Math.min(index! + 1, images.length - 1));
              }}
              disabled={index === images.length - 1}
              aria-label="التالي"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
