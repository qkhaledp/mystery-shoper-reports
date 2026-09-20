import { LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'جاري التحميل…', description }: { label?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="status">
      <LoaderCircle className="h-8 w-8 animate-spin text-brand-500" />
      <div className="font-bold text-ink">{label}</div>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
