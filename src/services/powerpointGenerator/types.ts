/** صورة جاهزة للإدراج في الشريحة */
export interface GeneratorImage {
  data: Uint8Array;
  width: number;
  height: number;
  extension: 'jpg' | 'png';
}

export interface GeneratorObservation {
  text: string;
  correctiveAction: string;
  images: GeneratorImage[];
}

export interface GeneratorInput {
  facilityName: string;
  ticketNumber: string;
  ticketTitle: string;
  visitNumber: string;
  /** بصيغة العرض النهائية DD/MM/YYYY */
  displayDate: string;
  observations: GeneratorObservation[];
}

export class TemplateStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateStructureError';
  }
}
