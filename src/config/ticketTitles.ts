export interface TicketTitleOption {
  /** النص الذي يظهر داخل التقرير كما في نظام التذاكر */
  value: string;
  /** وصف عربي يظهر في القائمة */
  label: string;
  /** الاسم المختصر المستخدم في تسمية الملف */
  fileLabel: string;
  /** كلمات تُستخدم لاستنتاج العنوان من اسم ملف الملاحظات */
  keywords: string[];
}

/**
 * عناوين التذاكر المعتمدة (كما تصل في ملف البلاغات).
 * لإضافة عنوان جديد مستقبلًا يكفي إضافة عنصر هنا.
 */
export const TICKET_TITLES: TicketTitleOption[] = [
  {
    value: 'MV team - Beneficiary Experience',
    label: 'تجربة المستفيد',
    fileLabel: 'تجربة المستفيد',
    keywords: ['تجربه المستفيد', 'تجربه المريض', 'المستفيد', 'beneficiary', 'experience'],
  },
  {
    value: 'MV team - Safety and Security',
    label: 'الأمن والسلامة',
    fileLabel: 'الأمن والسلامة',
    keywords: ['الامن والسلامه', 'السلامه', 'الامن', 'safety', 'security'],
  },
  {
    value: 'MV team - Infection Control',
    label: 'مكافحة العدوى',
    fileLabel: 'مكافحة العدوى',
    keywords: ['مكافحه العدوي', 'العدوي', 'infection'],
  },
];

/** مفتاح مقارنة يتجاهل الشرطات والمسافات وحالة الأحرف ("MV team Infection Control" = "MV team - Infection Control") */
export function ticketTitleKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z؀-ۿ]/g, '');
}

export function getTicketTitleOption(value: string): TicketTitleOption | undefined {
  const key = ticketTitleKey(value ?? '');
  return TICKET_TITLES.find((t) => ticketTitleKey(t.value) === key);
}

/** استنتاج عنوان التذكرة من نص (مثل اسم الملف "ملاحظات مكافحة العدوى.xlsx") */
export function inferTicketTitle(text: string): TicketTitleOption | undefined {
  const normalized = text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
  return TICKET_TITLES.find((t) => t.keywords.some((k) => normalized.includes(k)));
}
