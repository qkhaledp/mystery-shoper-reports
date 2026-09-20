import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheckBig,
  Download,
  FilePlus2,
  House,
  LoaderCircle,
  Plus,
  Presentation,
  Save,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ObservationCard } from '../components/ObservationCard';
import { ReportPreview } from '../components/ReportPreview';
import { Stepper } from '../components/Stepper';
import { TicketForm } from '../components/TicketForm';
import { useToast } from '../context/ToastContext';
import { toUserMessage } from '../services/errors';
import { createReportPowerPoint, downloadBlob } from '../services/fileService';
import { getReport, saveReport } from '../services/store';
import type { Observation } from '../types/observation';
import type { Report, TicketInfo } from '../types/report';
import { todayIso } from '../utils/date';
import { createId } from '../utils/id';
import {
  validateObservations,
  validateReport,
  validateTicketInfo,
  type ObservationErrors,
  type TicketErrors,
} from '../utils/validation';

const STEPS = [
  { key: 'ticket', label: 'بيانات التذكرة' },
  { key: 'observations', label: 'الملاحظات والصور' },
  { key: 'preview', label: 'المعاينة' },
  { key: 'done', label: 'التحميل' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const emptyObservation = (): Observation => ({ id: createId(), text: '', correctiveAction: '', images: [] });

function createEmptyReport(): Report {
  const timestamp = new Date().toISOString();
  return {
    id: createId(),
    facilityName: '',
    ticketNumber: '',
    ticketTitle: '',
    visitNumber: '',
    date: todayIso(),
    observations: [emptyObservation()],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** إنشاء تقرير جديد أو متابعة تقرير محفوظ على الجهاز */
export function ReportEditorPage({ reportId }: { reportId?: string }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [report, setReport] = useState<Report | null>(() => (reportId ? null : createEmptyReport()));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [ticketErrors, setTicketErrors] = useState<TicketErrors>({});
  const [observationErrors, setObservationErrors] = useState<Record<string, ObservationErrors>>({});
  const [summaryErrors, setSummaryErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const topRef = useRef<HTMLDivElement>(null);

  const stepKey: StepKey = STEPS[stepIndex].key;
  const isUploading = Object.values(uploading).some(Boolean);

  useEffect(() => {
    if (!reportId) return;
    getReport(reportId)
      .then(setReport)
      .catch((e) => setLoadError(toUserMessage(e)));
  }, [reportId]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const updateTicket = (patch: Partial<TicketInfo>) => {
    setReport((r) => (r ? { ...r, ...patch } : r));
    setTicketErrors((errors) => {
      const next = { ...errors };
      for (const key of Object.keys(patch)) delete next[key as keyof TicketErrors];
      return next;
    });
  };

  const updateObservation = useCallback((id: string, update: (o: Observation) => Observation) => {
    setReport((r) => (r ? { ...r, observations: r.observations.map((o) => (o.id === id ? update(o) : o)) } : r));
    setObservationErrors((errors) => {
      if (!errors[id]) return errors;
      const next = { ...errors };
      delete next[id];
      return next;
    });
  }, []);

  const setObservationUploading = useCallback(
    (id: string, value: boolean) => setUploading((u) => (u[id] === value ? u : { ...u, [id]: value })),
    [],
  );

  function addObservation() {
    const observation = emptyObservation();
    setReport((r) => (r ? { ...r, observations: [...r.observations, observation] } : r));
    setTimeout(() => {
      document.getElementById(`observation-${observation.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function removeObservation(id: string) {
    setReport((r) => (r && r.observations.length > 1 ? { ...r, observations: r.observations.filter((o) => o.id !== id) } : r));
  }

  async function save(current: Report, quiet = true): Promise<boolean> {
    setSaving(true);
    try {
      const saved = await saveReport(current);
      setReport((r) => (r ? { ...r, updatedAt: saved.updatedAt } : r));
      if (!quiet) toast.success('تم حفظ التقرير على هذا الجهاز');
      return true;
    } catch (e) {
      toast.error(toUserMessage(e, 'تعذر حفظ التقرير. يرجى المحاولة مرة أخرى.'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    if (!report) return;
    if (stepKey === 'ticket') {
      const errors = validateTicketInfo(report);
      setTicketErrors(errors);
      if (Object.keys(errors).length) {
        setSummaryErrors(Object.values(errors));
        return;
      }
    }
    if (stepKey === 'observations') {
      const { observations, messages } = validateObservations(report.observations);
      setObservationErrors(observations);
      if (messages.length) {
        setSummaryErrors(messages);
        const firstInvalid = report.observations.find((o) => observations[o.id]);
        if (firstInvalid) document.getElementById(`observation-${firstInvalid.id}`)?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    setSummaryErrors([]);
    if (await save(report)) {
      setStepIndex((i) => i + 1);
      scrollTop();
    }
  }

  function goBack() {
    setSummaryErrors([]);
    setGenerationError(null);
    setStepIndex((i) => Math.max(0, i - 1));
    scrollTop();
  }

  async function generate() {
    if (!report) return;
    const validation = validateReport(report);
    if (!validation.isValid) {
      setTicketErrors(validation.ticket);
      setObservationErrors(validation.observations);
      setSummaryErrors(validation.messages);
      setStepIndex(Object.keys(validation.ticket).length ? 0 : 1);
      return;
    }
    setGenerating(true);
    setGenerationError(null);
    try {
      await save(report);
      const generated = await createReportPowerPoint(report);
      setResult(generated);
      downloadBlob(generated.blob, generated.fileName);
      setStepIndex(STEPS.length - 1);
      scrollTop();
    } catch (e) {
      setGenerationError(toUserMessage(e, 'تعذر إنشاء التقرير حاليًا. يرجى المحاولة مرة أخرى.'));
    } finally {
      setGenerating(false);
    }
  }

  if (loadError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="تعذر فتح التقرير"
        description={loadError}
        action={
          <Link to="/" className="btn-secondary">
            العودة للرئيسية
          </Link>
        }
      />
    );
  }
  if (!report) return <LoadingState label="جاري تحميل التقرير…" />;

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">{reportId ? 'تعديل التقرير' : 'إنشاء تقرير جديد'}</h1>
          <p className="mt-1 text-sm text-ink-muted">{report.facilityName || 'اكتب بيانات التذكرة ثم الملاحظات والإثباتات'}</p>
        </div>
        {stepKey !== 'done' && (
          <button type="button" className="btn-secondary" onClick={() => void save(report, false)} disabled={saving || isUploading}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ
          </button>
        )}
      </div>

      <div className="card px-4 py-4 sm:px-6">
        <Stepper steps={STEPS.map((s) => s.label)} current={stepIndex} />
      </div>

      {summaryErrors.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <div className="mb-1 flex items-center gap-2 font-bold">
            <CircleAlert className="h-4 w-4" /> يرجى استكمال البيانات التالية:
          </div>
          <ul className="list-inside list-disc space-y-0.5 leading-6">
            {summaryErrors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {stepKey === 'ticket' && <TicketForm value={report} onChange={updateTicket} errors={ticketErrors} />}

      {stepKey === 'observations' && (
        <div className="space-y-4">
          {report.observations.map((observation, index) => (
            <ObservationCard
              key={observation.id}
              index={index}
              observation={observation}
              errors={observationErrors[observation.id]}
              reportId={report.id}
              onUpdate={updateObservation}
              onRemove={report.observations.length > 1 ? removeObservation : undefined}
              onUploadingChange={setObservationUploading}
            />
          ))}
          <button
            type="button"
            onClick={addObservation}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-white py-4 font-bold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50"
          >
            <Plus className="h-5 w-5" /> إضافة ملاحظة
          </button>
        </div>
      )}

      {stepKey === 'preview' &&
        (generating ? (
          <div className="card">
            <LoadingState label="جاري إنشاء التقرير…" description="يتم تجهيز ملف PowerPoint من القالب الرسمي وإدراج الملاحظات والصور." />
          </div>
        ) : (
          <>
            {generationError && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700" role="alert">
                <CircleAlert className="h-4 w-4 shrink-0" /> {generationError}
              </div>
            )}
            <ReportPreview report={report} showSlideHint />
          </>
        ))}

      {stepKey === 'done' && result && (
        <div className="card p-6 text-center sm:p-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
            <CircleCheckBig className="h-9 w-9" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-brand-700">تم إنشاء التقرير بنجاح</h2>
          <p className="mt-2 text-sm text-ink-muted">بدأ تنزيل الملف تلقائيًا. إن لم يبدأ التنزيل اضغط الزر بالأسفل.</p>
          <div className="mx-auto mt-5 max-w-lg rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-bold text-ink-muted">اسم الملف:</div>
            <div className="mt-1 flex items-center justify-center gap-2 break-all font-bold text-slate-900">
              <Presentation className="h-5 w-5 shrink-0 text-[#c43e1c]" />
              {result.fileName}
            </div>
            <div className="mt-1 text-xs text-ink-muted">{report.observations.length + 1} شرائح</div>
          </div>

          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
            <button className="btn-primary px-6 py-3 text-base" onClick={() => downloadBlob(result.blob, result.fileName)}>
              <Download className="h-5 w-5" /> تحميل PowerPoint
            </button>
            <button className="btn-secondary px-6 py-3" onClick={() => setStepIndex(1)}>
              <ArrowRight className="h-4 w-4" /> تعديل التقرير
            </button>
          </div>
          <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
            <button className="btn-ghost" onClick={() => navigate('/reports/new')}>
              <FilePlus2 className="h-4 w-4" /> إنشاء تقرير جديد
            </button>
            <Link to="/" className="btn-ghost">
              <House className="h-4 w-4" /> العودة للرئيسية
            </Link>
          </div>
        </div>
      )}

      {stepKey !== 'done' && !generating && (
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:shadow-card">
          <div className="flex items-center justify-between gap-3">
            {stepIndex === 0 ? (
              <Link to="/" className="btn-ghost">
                إلغاء
              </Link>
            ) : (
              <button type="button" className="btn-secondary" onClick={goBack}>
                <ArrowRight className="h-4 w-4" /> {stepKey === 'preview' ? 'تعديل' : 'السابق'}
              </button>
            )}

            {stepKey === 'preview' ? (
              <button type="button" className="btn-primary px-6 py-3" onClick={() => void generate()}>
                <Presentation className="h-5 w-5" /> إنشاء PowerPoint
              </button>
            ) : (
              <button type="button" className="btn-primary px-6" onClick={() => void goNext()} disabled={saving || isUploading}>
                {saving || isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isUploading ? 'جاري رفع الصور…' : stepKey === 'observations' ? 'مراجعة التقرير' : 'التالي'}
                {!saving && !isUploading && <ArrowLeft className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
