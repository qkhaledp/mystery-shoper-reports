import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

/** مساحات الأسماء المستخدمة في ملفات OOXML */
export const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
} as const;

export const REL_TYPES = {
  slide: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  thumbnail: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail',
} as const;

export const SLIDE_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
}

export function serializeXml(doc: Document): string {
  const body = new XMLSerializer().serializeToString(doc as never).replace(/^<\?xml[^>]*\?>\s*/, '');
  return XML_DECLARATION + body;
}

export function childElements(el: Element | Document, ns: string, localName: string): Element[] {
  const result: Element[] = [];
  const nodes = el.childNodes;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i] as Element;
    if (node.nodeType === 1 && node.namespaceURI === ns && node.localName === localName) result.push(node);
  }
  return result;
}

export function firstChild(el: Element, ns: string, localName: string): Element | null {
  return childElements(el, ns, localName)[0] ?? null;
}

export function descendants(el: Element | Document, ns: string, localName: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(ns, localName));
}

export function textContentOf(el: Element): string {
  return descendants(el, NS.a, 't')
    .map((t) => t.textContent ?? '')
    .join('');
}

export function removeElement(el: Element): void {
  el.parentNode?.removeChild(el);
}

/** يُنشئ عناصر من نص XML ضمن سياق مساحات أسماء الشريحة ثم يستوردها للمستند */
export function importFragment(doc: Document, xml: string): Element {
  const wrapper = parseXml(
    `<root xmlns:a="${NS.a}" xmlns:p="${NS.p}" xmlns:r="${NS.r}">${xml}</root>`,
  );
  const node = wrapper.documentElement.firstChild as Element;
  return doc.importNode(node, true) as Element;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** توحيد النص العربي لمطابقة العناصر في القالب بغض النظر عن الهمزات والتطويل */
export function normalizeArabic(value: string): string {
  return value
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}
