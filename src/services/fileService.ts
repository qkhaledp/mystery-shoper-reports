import type { ReportData } from '../types/report';
import { validateReport } from '../utils/validation';
import { AppError } from './errors';
import { generateReport } from './powerpointGenerator';
import { getImage } from './store';

export const GENERATION_ERROR_MESSAGE = 'تعذر إنشاء التقرير حاليًا. يرجى المحاولة مرة أخرى.';

/** توليد ملف PowerPoint من القالب الرسمي وبيانات التقرير */
export async function createReportPowerPoint(report: ReportData): Promise<{ blob: Blob; fileName: string }> {
  const validation = validateReport(report);
  if (!validation.isValid) throw new AppError(validation.messages[0], 'invalid');
  try {
    return await generateReport(report, { loadImage: (image) => getImage(image.storagePath) });
  } catch (error) {
    // تفاصيل الخطأ للمطور فقط
    console.error('[powerpointGenerator] generation failed', error);
    throw new AppError(GENERATION_ERROR_MESSAGE, 'generation', { cause: error });
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadReportPowerPoint(report: ReportData): Promise<void> {
  const { blob, fileName } = await createReportPowerPoint(report);
  downloadBlob(blob, fileName);
}
