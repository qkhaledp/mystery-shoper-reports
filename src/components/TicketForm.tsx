import { useState } from 'react';
import { TICKET_TITLES, getTicketTitleOption } from '../config/ticketTitles';
import type { TicketInfo } from '../types/report';
import { formatDisplayDate } from '../utils/date';
import type { TicketErrors } from '../utils/validation';
import { FieldError } from './FieldError';

const CUSTOM_TITLE = '__custom__';

export function TicketForm({
  value,
  onChange,
  errors,
}: {
  value: TicketInfo;
  onChange: (patch: Partial<TicketInfo>) => void;
  errors: TicketErrors;
}) {
  const [customTitle, setCustomTitle] = useState(() => !!value.ticketTitle && !getTicketTitleOption(value.ticketTitle));

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold text-ink">بيانات التذكرة</h2>
      <p className="mt-1 text-sm text-ink-muted">ستظهر هذه البيانات في شريحة بيانات التقرير باللون الأسود.</p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="field-label" htmlFor="facilityName">
            اسم المنشأة <span className="text-rose-500">*</span>
          </label>
          <input
            id="facilityName"
            className="field-input"
            value={value.facilityName}
            aria-invalid={!!errors.facilityName}
            onChange={(e) => onChange({ facilityName: e.target.value })}
            placeholder="مثال: مركز صحي الدوادمي الشمالي"
            autoComplete="organization"
          />
          <FieldError message={errors.facilityName} />
        </div>

        <div>
          <label className="field-label" htmlFor="ticketNumber">
            رقم التذكرة <span className="text-rose-500">*</span>
          </label>
          <input
            id="ticketNumber"
            dir="auto"
            className="field-input"
            value={value.ticketNumber}
            aria-invalid={!!errors.ticketNumber}
            onChange={(e) => onChange({ ticketNumber: e.target.value })}
            placeholder="مثال: 482193"
          />
          <FieldError message={errors.ticketNumber} />
        </div>

        <div>
          <label className="field-label" htmlFor="visitNumber">
            رقم الزيارة <span className="text-rose-500">*</span>
          </label>
          <input
            id="visitNumber"
            className="field-input"
            value={value.visitNumber}
            aria-invalid={!!errors.visitNumber}
            onChange={(e) => onChange({ visitNumber: e.target.value })}
            placeholder="مثال: الثانية"
          />
          <FieldError message={errors.visitNumber} />
        </div>

        <div className="md:col-span-2">
          <label className="field-label" htmlFor="ticketTitle">
            عنوان التذكرة <span className="text-rose-500">*</span>
          </label>
          <select
            id="ticketTitle"
            className="field-input"
            aria-invalid={!!errors.ticketTitle}
            value={customTitle ? CUSTOM_TITLE : value.ticketTitle}
            onChange={(e) => {
              if (e.target.value === CUSTOM_TITLE) {
                setCustomTitle(true);
                onChange({ ticketTitle: '' });
              } else {
                setCustomTitle(false);
                onChange({ ticketTitle: e.target.value });
              }
            }}
          >
            <option value="">اختر عنوان التذكرة</option>
            {TICKET_TITLES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.value}
              </option>
            ))}
            <option value={CUSTOM_TITLE}>عنوان آخر…</option>
          </select>
          {customTitle && (
            <input
              dir="auto"
              className="field-input mt-2"
              value={value.ticketTitle}
              aria-invalid={!!errors.ticketTitle}
              onChange={(e) => onChange({ ticketTitle: e.target.value })}
              placeholder="اكتب عنوان التذكرة"
              autoFocus
            />
          )}
          <FieldError message={errors.ticketTitle} />
        </div>

        <div>
          <label className="field-label" htmlFor="date">
            التاريخ <span className="text-rose-500">*</span>
          </label>
          <input
            id="date"
            type="date"
            className="field-input"
            value={value.date}
            aria-invalid={!!errors.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
          {value.date && !errors.date && (
            <p className="mt-1.5 text-xs text-ink-muted">
              سيظهر في التقرير: <span dir="ltr" className="font-bold text-ink">{formatDisplayDate(value.date)}</span>
            </p>
          )}
          <FieldError message={errors.date} />
        </div>
      </div>
    </div>
  );
}
