import type { Observation } from '../types/observation';
import type { ReportData, TicketInfo } from '../types/report';

export type TicketField = keyof TicketInfo;
export type TicketErrors = Partial<Record<TicketField, string>>;

export interface ObservationErrors {
  text?: string;
  correctiveAction?: string;
  images?: string;
}

export interface ReportValidation {
  ticket: TicketErrors;
  observations: Record<string, ObservationErrors>;
  /** رسائل عامة مرتبة للعرض في ملخص الأخطاء */
  messages: string[];
  isValid: boolean;
}

const hasText = (value: string | undefined) => Boolean(value && value.trim());

export function validateTicketInfo(info: Partial<TicketInfo>): TicketErrors {
  const errors: TicketErrors = {};
  if (!hasText(info.facilityName)) errors.facilityName = 'اسم المنشأة مطلوب';
  if (!hasText(info.ticketNumber)) errors.ticketNumber = 'رقم التذكرة مطلوب';
  if (!hasText(info.ticketTitle)) errors.ticketTitle = 'عنوان التذكرة مطلوب';
  if (!hasText(info.visitNumber)) errors.visitNumber = 'رقم الزيارة مطلوب';
  if (!hasText(info.date)) errors.date = 'التاريخ مطلوب';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(info.date!)) errors.date = 'صيغة التاريخ غير صحيحة';
  return errors;
}

export function validateObservation(observation: Observation, index: number): ObservationErrors {
  const n = index + 1;
  const errors: ObservationErrors = {};
  if (!hasText(observation.text)) errors.text = `يرجى كتابة الملاحظة رقم ${n}`;
  if (!hasText(observation.correctiveAction)) errors.correctiveAction = `يرجى كتابة الإجراء التصحيحي للملاحظة رقم ${n}`;
  if (observation.images.length === 0) errors.images = `يرجى إضافة إثبات للملاحظة رقم ${n}`;
  return errors;
}

export function validateObservations(observations: Observation[]): Pick<ReportValidation, 'observations' | 'messages'> {
  const result: Record<string, ObservationErrors> = {};
  const messages: string[] = [];
  if (observations.length === 0) messages.push('يجب إضافة ملاحظة واحدة على الأقل');
  observations.forEach((observation, index) => {
    const errors = validateObservation(observation, index);
    if (Object.keys(errors).length) {
      result[observation.id] = errors;
      messages.push(...Object.values(errors));
    }
  });
  return { observations: result, messages };
}

export function validateReport(report: ReportData): ReportValidation {
  const ticket = validateTicketInfo(report);
  const obs = validateObservations(report.observations);
  const messages = [...Object.values(ticket), ...obs.messages];
  return { ticket, observations: obs.observations, messages, isValid: messages.length === 0 };
}
