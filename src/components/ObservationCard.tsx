import { Trash2 } from 'lucide-react';
import type { EvidenceImage, Observation } from '../types/observation';
import type { ObservationErrors } from '../utils/validation';
import { FieldError } from './FieldError';
import { ImageUploader } from './ImageUploader';

const LONG_TEXT = 350;

/** بطاقة ملاحظة واحدة: نص الملاحظة، الإجراء التصحيحي، وصور الإثبات */
export function ObservationCard({
  index,
  observation,
  errors = {},
  reportId,
  onUpdate,
  onRemove,
  onUploadingChange,
}: {
  index: number;
  observation: Observation;
  errors?: ObservationErrors;
  reportId: string;
  onUpdate: (id: string, update: (o: Observation) => Observation) => void;
  onRemove?: (id: string) => void;
  onUploadingChange: (id: string, uploading: boolean) => void;
}) {
  const n = index + 1;
  const textId = `obs-${observation.id}-text`;
  const actionId = `obs-${observation.id}-action`;
  const longText = observation.text.length + observation.correctiveAction.length > LONG_TEXT * 2;

  return (
    <section id={`observation-${observation.id}`} className="card scroll-mt-24 p-5 sm:p-6" aria-labelledby={`${textId}-title`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${textId}-title`} className="flex items-center gap-2 text-lg font-bold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-sm text-white">{n}</span>
          الملاحظة رقم {n}
        </h3>
        {onRemove && (
          <button type="button" className="btn-ghost px-2.5 py-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onRemove(observation.id)}>
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">حذف الملاحظة</span>
          </button>
        )}
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor={textId} className="field-label">
            نص الملاحظة <span className="text-rose-500">*</span>
          </label>
          <textarea
            id={textId}
            rows={4}
            className="field-input resize-y leading-7"
            placeholder="انسخ نص الملاحظة كما ورد في تقرير الزائر السري"
            value={observation.text}
            aria-invalid={!!errors.text}
            onChange={(e) => {
              const text = e.target.value;
              onUpdate(observation.id, (o) => ({ ...o, text }));
            }}
          />
          <FieldError message={errors.text} />
        </div>

        <div>
          <label htmlFor={actionId} className="field-label">
            الإجراء التصحيحي <span className="text-rose-500">*</span>
          </label>
          <textarea
            id={actionId}
            rows={4}
            className="field-input resize-y leading-7"
            placeholder="اكتب الإجراء التصحيحي الذي تم اتخاذه أو سيتم اتخاذه"
            value={observation.correctiveAction}
            aria-invalid={!!errors.correctiveAction}
            onChange={(e) => {
              const correctiveAction = e.target.value;
              onUpdate(observation.id, (o) => ({ ...o, correctiveAction }));
            }}
          />
          <FieldError message={errors.correctiveAction} />
          {longText && (
            <p className="mt-1.5 text-xs text-amber-700">النص طويل؛ سيتم تصغير حجم الخط تلقائيًا داخل الشريحة ليبقى ضمن حدودها.</p>
          )}
        </div>

        <div>
          <span className="field-label">
            إثبات الملاحظة <span className="text-rose-500">*</span>
          </span>
          <ImageUploader
            images={observation.images}
            reportId={reportId}
            error={errors.images}
            onAdd={(image: EvidenceImage) => onUpdate(observation.id, (o) => ({ ...o, images: [...o.images, image] }))}
            onRemove={(imageId) =>
              onUpdate(observation.id, (o) => ({ ...o, images: o.images.filter((img) => img.id !== imageId) }))
            }
            onUploadingChange={(uploading) => onUploadingChange(observation.id, uploading)}
          />
          <FieldError message={errors.images} />
        </div>
      </div>
    </section>
  );
}
