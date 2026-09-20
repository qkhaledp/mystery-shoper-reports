import { normalizeArabic, parseXml, textContentOf } from './ooxml';
import { PptxPackage } from './packageEditor';
import { fillDataSlide, fillObservationSlide } from './slideFillers';
import { SLIDE_MARKERS } from './templateConfig';
import { TemplateStructureError, type GeneratorInput } from './types';

function slideText(xml: string): string {
  return normalizeArabic(textContentOf(parseXml(xml).documentElement));
}

const matchesAll = (text: string, markers: readonly string[]) => markers.every((m) => text.includes(m));

/**
 * الدالة الأساسية لتوليد التقرير (مستقلة تمامًا عن React ويمكن تشغيلها في المتصفح أو Node):
 * 1. تحميل القالب  2. قراءة الشرائح  3. حذف شريحة التعليمات  4. تعبئة شريحة البيانات
 * 5. نسخ شريحة الملاحظة لكل ملاحظة  6-9. النصوص والصور وأحجامها  10. إنشاء ملف PPTX
 */
export async function buildPresentation(input: GeneratorInput, template: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const pkg = await PptxPackage.load(template);
  const slides = (await pkg.readSlides()).map((slide) => ({ ...slide, text: slideText(slide.xml) }));

  const content = slides.filter((s) => !matchesAll(s.text, SLIDE_MARKERS.instructions));
  const dataSlide = content.find((s) => matchesAll(s.text, SLIDE_MARKERS.data));
  const observationTemplate = content.find(
    (s) => s !== dataSlide && matchesAll(s.text, SLIDE_MARKERS.observation),
  );
  if (!dataSlide) throw new TemplateStructureError('لم يتم العثور على شريحة بيانات التقرير في القالب');
  if (!observationTemplate) throw new TemplateStructureError('لم يتم العثور على شريحة الملاحظة في القالب');
  if (input.observations.length === 0) throw new TemplateStructureError('لا توجد ملاحظات لإنشاء التقرير');

  const output: { xml: string; relsXml: string }[] = [
    { xml: fillDataSlide(dataSlide.xml, input), relsXml: dataSlide.relsXml },
  ];

  input.observations.forEach((observation, index) => {
    const slideNumber = index + 2;
    const filled = fillObservationSlide(observationTemplate.xml, observationTemplate.relsXml, observation, slideNumber);
    filled.media.forEach((m) => pkg.writeBinary(m.path, m.data));
    output.push({ xml: filled.xml, relsXml: filled.relsXml });
  });

  await pkg.removeAllSlides();
  await pkg.appendSlides(output);
  await pkg.removeUnreferencedParts();
  await pkg.updateDocumentProperties(output.length, `${input.facilityName} – ${input.ticketTitle}`);

  return pkg.generate();
}
