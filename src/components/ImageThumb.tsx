import clsx from 'clsx';
import { ImageOff, LoaderCircle } from 'lucide-react';
import { useStoredImageUrl } from '../hooks/useStoredImageUrl';
import type { EvidenceImage } from '../types/observation';

export function ImageThumb({ image, className, fit = 'cover' }: { image: EvidenceImage; className?: string; fit?: 'cover' | 'contain' }) {
  const { url, failed } = useStoredImageUrl(image.storagePath);
  return (
    <div className={clsx('relative overflow-hidden bg-slate-100', className)}>
      {url ? (
        <img
          src={url}
          alt={image.name}
          className={clsx('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
          loading="lazy"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-slate-400">
          {failed ? <ImageOff className="h-5 w-5" /> : <LoaderCircle className="h-5 w-5 animate-spin" />}
        </div>
      )}
    </div>
  );
}
