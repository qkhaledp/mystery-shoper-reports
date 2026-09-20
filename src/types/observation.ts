/** صورة إثبات مرفوعة ومخزنة (بعد المعالجة والضغط). */
export interface EvidenceImage {
  id: string;
  /** اسم الملف الأصلي كما رفعه المستخدم */
  name: string;
  /** يتم تحويل كل الصور إلى JPEG أو PNG لضمان توافقها مع PowerPoint */
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  size: number;
  /** مسار الصورة داخل خدمة التخزين (مرتبط بالمستخدم والتقرير) */
  storagePath: string;
}

export interface Observation {
  id: string;
  text: string;
  correctiveAction: string;
  images: EvidenceImage[];
}
