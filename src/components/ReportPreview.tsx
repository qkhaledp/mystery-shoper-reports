import { Presentation } from 'lucide-react';
import { useState } from 'react';
import type { EvidenceImage } from '../types/observation';
import type { ReportData } from '../types/report';
import { formatDisplayDate } from '../utils/date';
import { ImageLightbox } from './ImageLightbox';
import { ImageThumb } from './ImageThumb';

type PreviewData = ReportData;

function Field({ label, children, ltr }: { label: string; children: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-sm font-bold text-ink-muted">{label}:</dt>
      <dd className="mt-1 whitespace-pre-line break-words text-right text-[15px] font-bold leading-7 text-slate-900" dir={ltr ? 'auto' : undefined}>
        {children || '—'}
      </dd>
    </div>
  );
}

export function ReportPreview({ report, showSlideHint = false }: { report: PreviewData; showSlideHint?: boolean }) {
  const [lightbox, setLightbox] = useState<{ images: EvidenceImage[]; index: number } | null>(null);

  return (
    <div className="space-y-4">
      {showSlideHint && (
        <div className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <Presentation className="h-5 w-5 shrink-0" />
          <span>
            سيحتوي ملف PowerPoint على <strong>{report.observations.length + 1}</strong> شرائح: شريحة بيانات التقرير + شريحة
            مستقلة لكل ملاحظة، بتصميم القالب الرسمي.
          </span>
        </div>
      )}

      <section className="card p-5 sm:p-6">
        <h3 className="mb-4 text-lg font-bold text-brand-700">بيانات التقرير</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم المنشأة">{report.facilityName}</Field>
          <Field label="رقم التذكرة" ltr>
            {report.ticketNumber}
          </Field>
          <Field label="عنوان التذكرة" ltr>
            {report.ticketTitle}
          </Field>
          <Field label="رقم الزيارة">{report.visitNumber}</Field>
          <Field label="التاريخ" ltr>
            {formatDisplayDate(report.date)}
          </Field>
        </dl>
      </section>

      {report.observations.map((observation, index) => (
        <section key={observation.id} className="card p-5 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-brand-700">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-xs text-white">{index + 1}</span>
            الملاحظة {index + 1}
          </h3>
          <dl className="space-y-4">
            <Field label="الملاحظة">{observation.text}</Field>
            <Field label="الإجراء التصحيحي">{observation.correctiveAction}</Field>
            <div>
              <dt className="text-sm font-bold text-ink-muted">الصور ({observation.images.length}):</dt>
              <dd className="mt-2">
                {observation.images.length === 0 ? (
                  <span className="text-sm text-rose-600">لا توجد صور</span>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {observation.images.map((image, i) => (
                      <li key={image.id}>
                        <button
                          type="button"
                          className="block w-full overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-brand-400"
                          onClick={() => setLightbox({ images: observation.images, index: i })}
                          aria-label={`معاينة ${image.name}`}
                        >
                          <ImageThumb image={image} className="aspect-[4/3] w-full" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>
        </section>
      ))}

      <ImageLightbox
        images={lightbox?.images ?? []}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
        onIndexChange={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
      />
    </div>
  );
}
