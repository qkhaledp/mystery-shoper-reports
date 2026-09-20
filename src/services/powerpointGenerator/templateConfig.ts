/**
 * خريطة القالب الرسمي.
 * يتم التعرف على الشرائح والعناصر من خلال النصوص الموجودة في القالب نفسه
 * (وليس بترتيبها أو أرقامها) حتى يستمر النظام بالعمل إذا عُدّل القالب مستقبلًا.
 * جميع النصوص تُطابق بعد توحيد الهمزات (انظر normalizeArabic).
 */
export const TEMPLATE_URL = `${import.meta.env?.BASE_URL ?? '/'}templates/ticket-closure-template.pptx`;

export const SLIDE_MARKERS = {
  /** شريحة التعليمات: تُحذف من التقرير النهائي */
  instructions: ['للتعليمات'],
  /** شريحة بيانات التقرير */
  data: ['اسم المنشاة', 'رقم التذكرة'],
  /** شريحة الملاحظة: تُنسخ لكل ملاحظة */
  observation: ['الملاحظة', 'الاجراء التصحيحي'],
} as const;

export const DATA_FIELD_MARKERS = {
  header: 'خطة العمل التصحيحية',
  facilityName: 'اسم المنشاة',
  ticketNumber: 'رقم التذكرة',
  ticketTitle: 'عنوان التذكرة',
  date: 'التاريخ',
} as const;

export const OBSERVATION_FIELD_MARKERS = {
  /** يبدأ نص العنصر بهذه الكلمة */
  observationPrefix: 'الملاحظة',
  correctiveAction: 'الاجراء التصحيحي',
  evidence: 'اثبات',
} as const;

/** وحدات EMU: 914400 = بوصة واحدة، 12700 = نقطة واحدة */
export const LAYOUT = {
  /** أدنى حد للمحتوى حتى لا يتداخل مع شعار التجمع أسفل خلفية الشريحة */
  contentBottom: 5_750_000,
  /** منطقة صور الإثبات (الجانب الأيسر من شريحة الملاحظة) */
  evidenceRegion: { x: 420_000, y: 1_169_439, w: 5_280_000, h: 4_530_000 },
  evidenceGap: 90_000,
  /** المسافة بين صندوق الملاحظة وصندوق الإجراء التصحيحي */
  textBoxGap: 50_800,
  /** أقصى يسار يمكن توسيع حقول شريحة البيانات إليه عند طول النص */
  dataFieldMinX: 409_135,
} as const;
