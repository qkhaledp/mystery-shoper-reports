import type { Observation } from './observation';

/** بيانات التذكرة كما يكتبها المستخدم */
export interface TicketInfo {
  facilityName: string;
  ticketNumber: string;
  ticketTitle: string;
  visitNumber: string;
  /** بصيغة ISO: YYYY-MM-DD (يعرض في التقرير DD/MM/YYYY) */
  date: string;
}

/** تقرير محفوظ على هذا الجهاز */
export interface Report extends TicketInfo {
  id: string;
  observations: Observation[];
  createdAt: string;
  updatedAt: string;
}

/** البيانات اللازمة فقط لتوليد ملف PowerPoint */
export type ReportData = TicketInfo & { observations: Observation[] };
