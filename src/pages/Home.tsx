import { CircleAlert, Download, FilePlus2, FileText, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ConfirmDialog } from '../components/Modal';
import { getTicketTitleOption } from '../config/ticketTitles';
import { useToast } from '../context/ToastContext';
import { toUserMessage } from '../services/errors';
import { downloadReportPowerPoint } from '../services/fileService';
import { deleteReport, listReports } from '../services/store';
import type { Report } from '../types/report';
import { formatDisplayDate } from '../utils/date';

function ReportCard({
  report,
  onDelete,
}: {
  report: Report;
  onDelete: (report: Report) => void;
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const title = getTicketTitleOption(report.ticketTitle)?.label ?? report.ticketTitle;

  async function download() {
    setDownloading(true);
    try {
      await downloadReportPowerPoint(report);
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <li className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-bold text-ink">{report.facilityName || 'تقرير بدون اسم منشأة'}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          {title && <span>{title}</span>}
          {report.ticketNumber && (
            <span>
              التذكرة: <span dir="ltr" className="font-bold text-ink">{report.ticketNumber}</span>
            </span>
          )}
          {report.date && (
            <span dir="ltr" className="tabular-nums">
              {formatDisplayDate(report.date)}
            </span>
          )}
          <span>{report.observations.length} ملاحظة</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link to={`/reports/${report.id}`} className="btn-secondary">
          <Pencil className="h-4 w-4" /> فتح
        </Link>
        <button type="button" className="btn-secondary" onClick={() => void download()} disabled={downloading}>
          {downloading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          تنزيل
        </button>
        <button
          type="button"
          className="btn-ghost px-2.5 py-2 text-rose-600 hover:bg-rose-50"
          onClick={() => onDelete(report)}
          aria-label="حذف التقرير"
          title="حذف التقرير"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

export function HomePage() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    listReports()
      .then(setReports)
      .catch((e) => setError(toUserMessage(e)));
  }, []);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteReport(pendingDelete.id);
      setReports((list) => (list ?? []).filter((r) => r.id !== pendingDelete.id));
      setPendingDelete(null);
      toast.success('تم حذف التقرير');
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-700 sm:text-3xl">إغلاق تذاكر الزائر السري</h1>
        <p className="mt-1 leading-7 text-ink-muted">
          اكتب بيانات التذكرة والملاحظات وأرفق الإثباتات، وسيتم إنشاء ملف PowerPoint جاهز بالهوية البصرية الرسمية.
        </p>
      </div>

      <Link
        to="/reports/new"
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-white py-5 text-lg font-bold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50"
      >
        <FilePlus2 className="h-6 w-6" /> إنشاء تقرير جديد
      </Link>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700" role="alert">
          <CircleAlert className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {reports === null ? (
        <LoadingState label="جاري التحميل…" />
      ) : reports.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title="لا توجد تقارير بعد"
            description="ابدأ بإنشاء تقرير جديد. التقارير التي تنشئها تُحفظ على هذا الجهاز حتى تنتهي منها."
          />
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-ink">تقاريري المحفوظة ({reports.length})</h2>
          <ul className="space-y-3">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} onDelete={setPendingDelete} />
            ))}
          </ul>
          <p className="text-xs leading-6 text-ink-muted">
            التقارير والصور محفوظة داخل متصفح هذا الجهاز فقط ولا تُرسل إلى أي خادم. احرص على تنزيل ملف PowerPoint بعد
            إنشائه.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="حذف التقرير"
        message={`سيتم حذف تقرير «${pendingDelete?.facilityName || 'بدون اسم'}» وصوره من هذا الجهاز نهائيًا.`}
        confirmLabel="حذف"
        danger
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
