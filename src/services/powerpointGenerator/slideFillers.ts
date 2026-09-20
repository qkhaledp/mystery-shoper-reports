import {
  NS,
  childElements,
  descendants,
  escapeXml,
  firstChild,
  importFragment,
  normalizeArabic,
  parseXml,
  removeElement,
  serializeXml,
  textContentOf,
} from './ooxml';
import { nextRelId } from './packageEditor';
import { DATA_FIELD_MARKERS, LAYOUT, OBSERVATION_FIELD_MARKERS } from './templateConfig';
import {
  EMU_PER_PT,
  MULTILINE_CANDIDATES,
  SINGLE_LINE_SIZES,
  estimateHeightPt,
  estimateLines,
  measureTextPt,
  type FitCandidate,
} from './textFitting';
import { layoutImages, type PlacedImage } from './imageLayout';
import { TemplateStructureError, type GeneratorImage, type GeneratorInput, type GeneratorObservation } from './types';

const DEFAULT_INSET = 91_440;

/* ------------------------------------------------------------------ */
/* أدوات عامة للتعامل مع الأشكال والنصوص                              */
/* ------------------------------------------------------------------ */

function shapesOf(doc: Document): Element[] {
  const spTree = descendants(doc, NS.p, 'spTree')[0];
  return childElements(spTree, NS.p, 'sp');
}

function findShape(doc: Document, predicate: (text: string) => boolean, label: string): Element {
  const shape = shapesOf(doc).find((sp) => predicate(normalizeArabic(textContentOf(sp))));
  if (!shape) throw new TemplateStructureError(`لم يتم العثور على عنصر "${label}" في القالب`);
  return shape;
}

interface Box {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

function xfrmOf(el: Element): { off: Element; ext: Element } {
  const xfrm = descendants(el, NS.a, 'xfrm')[0];
  const off = xfrm && firstChild(xfrm, NS.a, 'off');
  const ext = xfrm && firstChild(xfrm, NS.a, 'ext');
  if (!off || !ext) throw new TemplateStructureError('عنصر بدون أبعاد في القالب');
  return { off, ext };
}

function boxOf(el: Element): Box {
  const { off, ext } = xfrmOf(el);
  return {
    x: Number(off.getAttribute('x')),
    y: Number(off.getAttribute('y')),
    cx: Number(ext.getAttribute('cx')),
    cy: Number(ext.getAttribute('cy')),
  };
}

function setBox(el: Element, box: Partial<Box>): void {
  const { off, ext } = xfrmOf(el);
  if (box.x !== undefined) off.setAttribute('x', String(Math.round(box.x)));
  if (box.y !== undefined) off.setAttribute('y', String(Math.round(box.y)));
  if (box.cx !== undefined) ext.setAttribute('cx', String(Math.round(box.cx)));
  if (box.cy !== undefined) ext.setAttribute('cy', String(Math.round(box.cy)));
}

function bodyPrOf(shape: Element): Element {
  const bodyPr = descendants(shape, NS.a, 'bodyPr')[0];
  if (!bodyPr) throw new TemplateStructureError('عنصر نصي بدون bodyPr');
  return bodyPr;
}

function insets(shape: Element): { l: number; r: number; t: number; b: number } {
  const bodyPr = bodyPrOf(shape);
  const read = (name: string) => {
    const v = bodyPr.getAttribute(name);
    return v === null || v === '' ? DEFAULT_INSET * (name === 'tIns' || name === 'bIns' ? 0.5 : 1) : Number(v);
  };
  return { l: read('lIns'), r: read('rIns'), t: read('tIns'), b: read('bIns') };
}

const isLatin = (text: string) => /[A-Za-z]/.test(text) && !/[؀-ۿ]/.test(text);

/** ينسخ تنسيق الحرف من القالب ويجعل لون القيمة أسود كما يشترط القالب */
function valueRunProperties(doc: Document, source: Element | null, text: string): Element {
  const rPr = source
    ? (source.cloneNode(true) as Element)
    : doc.createElementNS(NS.a, 'a:rPr');
  rPr.setAttribute('lang', isLatin(text) ? 'en-US' : 'ar-SA');
  rPr.setAttribute('dirty', '0');
  rPr.removeAttribute('err');
  for (const fill of ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill']) {
    childElements(rPr, NS.a, fill).forEach(removeElement);
  }
  const solidFill = importFragment(doc, '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>');
  const ln = firstChild(rPr, NS.a, 'ln');
  rPr.insertBefore(solidFill, ln ? ln.nextSibling : rPr.firstChild);
  return rPr;
}

function createRun(doc: Document, rPr: Element, text: string): Element {
  const run = doc.createElementNS(NS.a, 'a:r');
  run.appendChild(rPr);
  const t = doc.createElementNS(NS.a, 'a:t');
  t.appendChild(doc.createTextNode(text));
  run.appendChild(t);
  return run;
}

/**
 * يملأ حقلًا بصيغة "العنوان : القيمة".
 * يحافظ على مقاطع العنوان كما هي في القالب، ويستبدل النص الإرشادي بعد النقطتين بالقيمة.
 */
function fillLabeledField(doc: Document, shape: Element, lines: string[]): void {
  const txBody = firstChild(shape, NS.p, 'txBody');
  if (!txBody) throw new TemplateStructureError('عنصر نصي بدون محتوى');
  const paragraphs = childElements(txBody, NS.a, 'p');
  const first = paragraphs[0];
  paragraphs.slice(1).forEach(removeElement);

  const runs = childElements(first, NS.a, 'r');
  let labelEnd = -1;
  runs.forEach((run, index) => {
    if (textContentOf(run).includes(':')) labelEnd = index;
  });
  // مسافة زائدة في بداية بعض العناوين تزيح السطر عن حافة بقية الأسطر
  const firstRunText = runs[0] && firstChild(runs[0], NS.a, 't');
  if (firstRunText?.textContent) firstRunText.textContent = firstRunText.textContent.replace(/^\s+/, '');

  const placeholderRun = runs[runs.length - 1] ?? null;
  const styleSource = placeholderRun ? firstChild(placeholderRun, NS.a, 'rPr') : null;
  const labelRun = runs[labelEnd];
  runs.slice(labelEnd + 1).forEach(removeElement);

  // النقطتان في بعض حقول القالب مقطع لاتيني؛ نصلحه ليبقى الترتيب صحيحًا مع النص العربي
  if (labelRun) {
    const labelRPr = firstChild(labelRun, NS.a, 'rPr');
    const t = firstChild(labelRun, NS.a, 't');
    if (labelRPr?.getAttribute('lang')?.startsWith('en') && t && /^\s*:\s*$/.test(t.textContent ?? '')) {
      labelRPr.setAttribute('lang', 'ar-SA');
      t.textContent = ': ';
    }
  }

  const endParaRPr = firstChild(first, NS.a, 'endParaRPr');
  const [firstLine, ...rest] = lines.length ? lines : [''];
  const labelEndsWithSpace = /\s$/.test(labelRun ? textContentOf(labelRun) : ' ');
  const firstText = labelEndsWithSpace ? firstLine : ` ${firstLine}`;
  first.insertBefore(createRun(doc, valueRunProperties(doc, styleSource, firstLine), firstText), endParaRPr);

  let previous = first;
  for (const line of rest) {
    const paragraph = doc.createElementNS(NS.a, 'a:p');
    const pPr = firstChild(first, NS.a, 'pPr');
    if (pPr) paragraph.appendChild(pPr.cloneNode(true));
    paragraph.appendChild(createRun(doc, valueRunProperties(doc, styleSource, line), line));
    if (endParaRPr) paragraph.appendChild(endParaRPr.cloneNode(true));
    txBody.insertBefore(paragraph, previous.nextSibling);
    previous = paragraph;
  }
}

function ensurePPr(doc: Document, paragraph: Element): Element {
  let pPr = firstChild(paragraph, NS.a, 'pPr');
  if (!pPr) {
    pPr = doc.createElementNS(NS.a, 'a:pPr');
    paragraph.insertBefore(pPr, paragraph.firstChild);
  }
  return pPr;
}

/** تطبيق حجم الخط وتباعد الأسطر على كامل النص داخل العنصر */
function applyTypography(doc: Document, shape: Element, candidate: FitCandidate): void {
  for (const tag of ['rPr', 'endParaRPr']) {
    descendants(shape, NS.a, tag).forEach((rPr) => rPr.setAttribute('sz', String(candidate.sizePt * 100)));
  }
  for (const paragraph of descendants(shape, NS.a, 'p')) {
    const pPr = ensurePPr(doc, paragraph);
    childElements(pPr, NS.a, 'lnSpc').forEach(removeElement);
    const lnSpc = importFragment(doc, `<a:lnSpc><a:spcPct val="${candidate.lineSpacingPct * 1000}"/></a:lnSpc>`);
    pPr.insertBefore(lnSpc, pPr.firstChild);
  }
}

/** استبدال الملاءمة التلقائية بحجم ثابت محسوب مع إبقاء التصغير التلقائي في PowerPoint كاحتياط */
function setAutofit(doc: Document, shape: Element, kind: 'normAutofit' | 'spAutoFit'): void {
  const bodyPr = bodyPrOf(shape);
  for (const tag of ['spAutoFit', 'normAutofit', 'noAutofit']) childElements(bodyPr, NS.a, tag).forEach(removeElement);
  bodyPr.appendChild(doc.createElementNS(NS.a, `a:${kind}`));
}

function paragraphsText(shape: Element): string[] {
  return descendants(shape, NS.a, 'p').map((p) => textContentOf(p));
}

function cleanSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanMultiline(value: string): string[] {
  const lines = value
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
  return lines.length ? lines : [''];
}

/* ------------------------------------------------------------------ */
/* شريحة بيانات التقرير                                                */
/* ------------------------------------------------------------------ */

/** حقل بسطر واحد: يُصغر الخط تدريجيًا، وإن لزم يوسع الصندوق يسارًا مع تثبيت الحافة اليمنى */
function fitSingleLineField(doc: Document, shape: Element): void {
  const text = paragraphsText(shape).join(' ');
  const box = boxOf(shape);
  const ins = insets(shape);
  const fits = (width: number, size: number) =>
    measureTextPt(text, size) <= (width - ins.l - ins.r) / EMU_PER_PT;

  if (fits(box.cx, 18)) return; // يبقى كما هو في القالب

  for (const size of SINGLE_LINE_SIZES) {
    if (fits(box.cx, size)) {
      applyTypography(doc, shape, { sizePt: size, lineSpacingPct: currentLineSpacing(shape) });
      return;
    }
  }

  const right = box.x + box.cx;
  const widened = right - LAYOUT.dataFieldMinX;
  setBox(shape, { x: LAYOUT.dataFieldMinX, cx: widened });
  for (const paragraph of descendants(shape, NS.a, 'p')) {
    const pPr = ensurePPr(doc, paragraph);
    if (pPr.getAttribute('algn') === 'ctr') pPr.setAttribute('algn', 'r');
  }
  const size = SINGLE_LINE_SIZES.find((s) => fits(widened, s)) ?? SINGLE_LINE_SIZES[SINGLE_LINE_SIZES.length - 1];
  applyTypography(doc, shape, { sizePt: size, lineSpacingPct: currentLineSpacing(shape) });
}

/** محاذاة كل أسطر العنصر إلى اليمين (بعض عناصر القالب محاذاتها وسط) */
function alignRight(doc: Document, shape: Element): void {
  for (const paragraph of descendants(shape, NS.a, 'p')) {
    ensurePPr(doc, paragraph).setAttribute('algn', 'r');
  }
}

/**
 * توحيد محاذاة حقل في شريحة البيانات: النص إلى اليمين وحافته اليمنى بمحاذاة بقية الحقول.
 * (حقل اسم المنشأة في القالب محاذاته وسط، فيظهر مزاحًا عن بقية الأسطر).
 */
function alignFieldRight(doc: Document, shape: Element, rightEdge: number): void {
  alignRight(doc, shape);
  const box = boxOf(shape);
  if (Math.abs(box.x + box.cx - rightEdge) < 1000) return;
  const x = Math.max(LAYOUT.dataFieldMinX, rightEdge - box.cx);
  setBox(shape, { x, cx: rightEdge - x });
}

function currentLineSpacing(shape: Element): number {
  const spcPct = descendants(shape, NS.a, 'lnSpc')
    .map((l) => firstChild(l, NS.a, 'spcPct'))
    .find(Boolean);
  return spcPct ? Number(spcPct.getAttribute('val')) / 1000 : 100;
}

export function fillDataSlide(slideXml: string, input: GeneratorInput): string {
  const doc = parseXml(slideXml);
  const has = (marker: string) => (text: string) => text.includes(marker);

  const header = findShape(doc, has(DATA_FIELD_MARKERS.header), 'عنوان خطة العمل');
  fillLabeledField(doc, header, [cleanSingleLine(input.visitNumber)]);

  const fields: [keyof typeof DATA_FIELD_MARKERS, string][] = [
    ['facilityName', input.facilityName],
    ['ticketNumber', input.ticketNumber],
    ['ticketTitle', input.ticketTitle],
    ['date', input.displayDate],
  ];
  const shapes = fields.map(([key]) => findShape(doc, has(DATA_FIELD_MARKERS[key]), DATA_FIELD_MARKERS[key]));

  // الحافة اليمنى المشتركة لأسطر البيانات: الوسيط حتى لا يؤثر حقل واحد مختلف في القالب
  const edges = shapes.map((shape) => boxOf(shape).x + boxOf(shape).cx).sort((a, b) => a - b);
  const rightEdge = Math.round((edges[Math.floor((edges.length - 1) / 2)] + edges[Math.ceil((edges.length - 1) / 2)]) / 2);

  shapes.forEach((shape, index) => {
    fillLabeledField(doc, shape, [cleanSingleLine(fields[index][1])]);
    alignFieldRight(doc, shape, rightEdge);
    fitSingleLineField(doc, shape);
  });

  return serializeXml(doc);
}

/* ------------------------------------------------------------------ */
/* شريحة الملاحظة                                                      */
/* ------------------------------------------------------------------ */

interface TextRegion {
  shape: Element;
  box: Box;
  availableHeight: number;
  paragraphs: string[];
  /** إزاحة يمنى إضافية لتفادي أيقونة القالب عند التفاف النص */
  iconInset: number;
}

function iconOverlapInset(doc: Document, box: Box, rightInset: number): number {
  const spTree = descendants(doc, NS.p, 'spTree')[0];
  let inset = rightInset;
  for (const pic of childElements(spTree, NS.p, 'pic')) {
    const icon = boxOf(pic);
    const verticalOverlap = icon.y < box.y + box.cy && icon.y + icon.cy > box.y;
    const insideRightSide = icon.x > box.x + box.cx / 2 && icon.x < box.x + box.cx;
    if (verticalOverlap && insideRightSide) {
      inset = Math.max(inset, box.x + box.cx - icon.x + 45_720);
    }
  }
  return inset;
}

function regionFits(region: TextRegion, candidate: FitCandidate, multiline: boolean): boolean {
  const ins = insets(region.shape);
  const rightInset = multiline ? region.iconInset : ins.r;
  const widthPt = (region.box.cx - ins.l - rightInset) / EMU_PER_PT;
  const heightPt = (region.availableHeight - ins.t - ins.b) / EMU_PER_PT;
  const lines = estimateLines(region.paragraphs, candidate.sizePt, widthPt);
  return estimateHeightPt(lines, candidate) <= heightPt;
}

function isMultiline(region: TextRegion, candidate: FitCandidate): boolean {
  const ins = insets(region.shape);
  const widthPt = (region.box.cx - ins.l - ins.r) / EMU_PER_PT;
  return estimateLines(region.paragraphs, candidate.sizePt, widthPt) > 1;
}

function finalizeRegion(doc: Document, region: TextRegion, candidate: FitCandidate): void {
  applyTypography(doc, region.shape, candidate);
  const multiline = isMultiline(region, candidate);
  const bodyPr = bodyPrOf(region.shape);
  if (multiline && region.iconInset > insets(region.shape).r) {
    bodyPr.setAttribute('rIns', String(Math.round(region.iconInset)));
  }
  bodyPr.setAttribute('anchor', 't');
  setBox(region.shape, { cy: region.availableHeight });
  setAutofit(doc, region.shape, 'normAutofit');
}

function buildPictureXml(id: number, relId: string, name: string, rect: PlacedImage): string {
  const srcRect = rect.crop
    ? `<a:srcRect l="${rect.crop.l}" t="${rect.crop.t}" r="${rect.crop.r}" b="${rect.crop.b}"/>`
    : '';
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${escapeXml(name)}" descr="${escapeXml(name)}"/>` +
    `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${relId}"/>${srcRect}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.w}" cy="${rect.h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `<a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></p:spPr></p:pic>`
  );
}

export interface FilledObservationSlide {
  xml: string;
  relsXml: string;
  media: { path: string; data: Uint8Array }[];
}

export function fillObservationSlide(
  templateXml: string,
  templateRelsXml: string,
  observation: GeneratorObservation,
  slideNumber: number,
): FilledObservationSlide {
  const doc = parseXml(templateXml);
  const rels = parseXml(templateRelsXml);

  const observationShape = findShape(
    doc,
    (t) => t.startsWith(OBSERVATION_FIELD_MARKERS.observationPrefix),
    'الملاحظة',
  );
  const actionShape = findShape(
    doc,
    (t) => t.includes(OBSERVATION_FIELD_MARKERS.correctiveAction),
    'الإجراء التصحيحي',
  );
  const evidenceShape = findShape(doc, (t) => t.includes(OBSERVATION_FIELD_MARKERS.evidence), 'إثبات الملاحظة');

  fillLabeledField(doc, observationShape, cleanMultiline(observation.text));
  fillLabeledField(doc, actionShape, cleanMultiline(observation.correctiveAction));

  // --- توحيد المحاذاة: النصان إلى اليمين وبنفس الحافتين اليمنى واليسرى
  // (صندوق الإجراء التصحيحي في القالب محاذاته وسط وحافته تختلف عن صندوق الملاحظة)
  const textShapes = [observationShape, actionShape];
  const textBoxes = textShapes.map(boxOf);
  const textRight = Math.min(...textBoxes.map((box) => box.x + box.cx));
  const textLeft = Math.min(...textBoxes.map((box) => box.x));
  for (const shape of textShapes) {
    alignRight(doc, shape);
    setBox(shape, { x: textLeft, cx: textRight - textLeft });
  }

  // --- ملاءمة النصوص: نفس الحجم للعنصرين للحفاظ على تناسق الشريحة
  const obsBox = boxOf(observationShape);
  const actBox = boxOf(actionShape);
  const regions: TextRegion[] = [
    {
      shape: observationShape,
      box: obsBox,
      availableHeight: actBox.y - obsBox.y - LAYOUT.textBoxGap,
      paragraphs: paragraphsText(observationShape),
      iconInset: 0,
    },
    {
      shape: actionShape,
      box: actBox,
      availableHeight: LAYOUT.contentBottom - actBox.y,
      paragraphs: paragraphsText(actionShape),
      iconInset: 0,
    },
  ];
  for (const region of regions) {
    region.iconInset = iconOverlapInset(doc, region.box, insets(region.shape).r);
  }

  const candidate =
    MULTILINE_CANDIDATES.find((c) =>
      regions.every((region) => regionFits(region, c, isMultiline(region, c))),
    ) ?? MULTILINE_CANDIDATES[MULTILINE_CANDIDATES.length - 1];
  regions.forEach((region) => finalizeRegion(doc, region, candidate));

  // --- صور الإثبات: تستبدل النص الإرشادي
  removeElement(evidenceShape);
  const spTree = descendants(doc, NS.p, 'spTree')[0];
  let shapeId = Math.max(0, ...descendants(doc, NS.p, 'cNvPr').map((c) => Number(c.getAttribute('id')) || 0)) + 1;
  let relId = nextRelId(rels);
  const media: FilledObservationSlide['media'] = [];

  const rects = layoutImages(
    observation.images.map((img) => ({ width: img.width, height: img.height })),
    LAYOUT.evidenceRegion,
    LAYOUT.evidenceGap,
  );
  observation.images.forEach((image: GeneratorImage, index) => {
    const fileName = `evidence-${slideNumber}-${index + 1}.${image.extension}`;
    const rId = `rId${relId++}`;
    media.push({ path: `ppt/media/${fileName}`, data: image.data });

    const rel = rels.createElementNS(NS.rel, 'Relationship');
    rel.setAttribute('Id', rId);
    rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
    rel.setAttribute('Target', `../media/${fileName}`);
    rels.documentElement.appendChild(rel);

    spTree.appendChild(importFragment(doc, buildPictureXml(shapeId++, rId, `إثبات ${index + 1}`, rects[index])));
  });

  // معرّف فريد لكل شريحة منسوخة
  descendants(doc, 'http://schemas.microsoft.com/office/powerpoint/2010/main', 'creationId').forEach((el) =>
    el.setAttribute('val', String(Math.floor(Math.random() * 2_000_000_000) + 1)),
  );

  return { xml: serializeXml(doc), relsXml: serializeXml(rels), media };
}
