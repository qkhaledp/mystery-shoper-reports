import type { EvidenceImage } from '../../types/observation';
import type { ReportData } from '../../types/report';
import { formatDisplayDate } from '../../utils/date';
import { buildReportFileName } from '../../utils/fileName';
import { buildPresentation } from './buildPresentation';
import { TEMPLATE_URL } from './templateConfig';
import type { GeneratorImage } from './types';

export { buildPresentation } from './buildPresentation';
export { TemplateStructureError } from './types';
export type { GeneratorImage, GeneratorInput, GeneratorObservation } from './types';

export interface GeneratorDependencies {
  /** تحميل ملف القالب الرسمي */
  loadTemplate?: () => Promise<ArrayBuffer>;
  /** تحميل بيانات صورة الإثبات من خدمة التخزين */
  loadImage: (image: EvidenceImage) => Promise<Blob>;
}

export interface GeneratedReport {
  blob: Blob;
  fileName: string;
}

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

let templateCache: Promise<ArrayBuffer> | null = null;

async function defaultLoadTemplate(): Promise<ArrayBuffer> {
  templateCache ??= fetch(TEMPLATE_URL).then((res) => {
    if (!res.ok) throw new Error(`Template request failed: ${res.status}`);
    return res.arrayBuffer();
  });
  try {
    return (await templateCache).slice(0);
  } catch (error) {
    templateCache = null;
    throw error;
  }
}

async function toGeneratorImage(image: EvidenceImage, blob: Blob): Promise<GeneratorImage> {
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    width: image.width,
    height: image.height,
    extension: image.mimeType === 'image/png' ? 'png' : 'jpg',
  };
}

/**
 * توليد تقرير PowerPoint من القالب الرسمي.
 * لا يعتمد على React؛ يستقبل بيانات التقرير ودوال التحميل فقط.
 */
export async function generateReport(reportData: ReportData, deps: GeneratorDependencies): Promise<GeneratedReport> {
  const template = await (deps.loadTemplate ?? defaultLoadTemplate)();

  const observations = await Promise.all(
    reportData.observations.map(async (observation) => ({
      text: observation.text,
      correctiveAction: observation.correctiveAction,
      images: await Promise.all(
        observation.images.map(async (image) => toGeneratorImage(image, await deps.loadImage(image))),
      ),
    })),
  );

  const bytes = await buildPresentation(
    {
      facilityName: reportData.facilityName,
      ticketNumber: reportData.ticketNumber,
      ticketTitle: reportData.ticketTitle,
      visitNumber: reportData.visitNumber,
      displayDate: formatDisplayDate(reportData.date),
      observations,
    },
    template,
  );

  return {
    blob: new Blob([bytes as BlobPart], { type: PPTX_MIME }),
    fileName: buildReportFileName(reportData.facilityName, reportData.ticketTitle),
  };
}
