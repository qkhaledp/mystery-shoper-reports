export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_IMAGE_EXTENSIONS].join(',');
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** أقصى بُعد للصورة داخل التقرير: كافٍ للوضوح ويبقي حجم ملف PowerPoint معقولًا */
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

export interface ProcessedImage {
  blob: Blob;
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
}

export function isAcceptedImage(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_IMAGE_TYPES.includes(file.type) || ACCEPTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function describeFileProblem(file: File): string | null {
  if (!isAcceptedImage(file)) return `الملف "${file.name}" غير مدعوم. الصيغ المسموحة: JPG, JPEG, PNG, WEBP`;
  if (file.size > MAX_UPLOAD_BYTES) return `حجم الصورة "${file.name}" أكبر من 25 ميجابايت`;
  return null;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // نكمل بالطريقة البديلة
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), type, quality),
  );
}

/**
 * تجهيز صورة الإثبات: تصحيح الاتجاه، تصغير الأبعاد مع الحفاظ على النسبة،
 * وتحويل WEBP إلى JPEG لضمان عملها في جميع إصدارات PowerPoint.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  const decoded = await decode(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (isPng) {
      ctx.drawImage(decoded.source, 0, 0, width, height);
      const png = await canvasToBlob(canvas, 'image/png');
      if (png.size <= 3 * 1024 * 1024) return { blob: png, mimeType: 'image/png', width, height };
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    return { blob: jpeg, mimeType: 'image/jpeg', width, height };
  } finally {
    decoded.close();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
