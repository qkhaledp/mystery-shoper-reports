import JSZip from 'jszip';
import {
  NS,
  REL_TYPES,
  SLIDE_CONTENT_TYPE,
  childElements,
  descendants,
  firstChild,
  parseXml,
  removeElement,
  serializeXml,
} from './ooxml';

export interface SlideRef {
  path: string;
  xml: string;
  relsXml: string;
}

const EMPTY_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS.rel}"></Relationships>`;

export function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf('/');
  return `${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels`;
}

/** يحول مسار Target النسبي إلى مسار داخل الحزمة */
export function resolveTarget(sourcePart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = sourcePart.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

export function nextRelId(relsDoc: Document): number {
  const ids = descendants(relsDoc, NS.rel, 'Relationship').map((r) =>
    Number((r.getAttribute('Id') ?? '').replace(/\D/g, '')) || 0,
  );
  return Math.max(0, ...ids) + 1;
}

/** طبقة تعامل منخفضة المستوى مع حزمة PPTX (ملف ZIP) */
export class PptxPackage {
  private constructor(private readonly zip: JSZip) {}

  static async load(data: ArrayBuffer | Uint8Array): Promise<PptxPackage> {
    return new PptxPackage(await JSZip.loadAsync(data));
  }

  has(path: string): boolean {
    return this.zip.file(path) !== null;
  }

  async readText(path: string): Promise<string> {
    const file = this.zip.file(path);
    if (!file) throw new Error(`Template part not found: ${path}`);
    return file.async('string');
  }

  writeText(path: string, content: string): void {
    this.zip.file(path, content);
  }

  writeBinary(path: string, data: Uint8Array): void {
    this.zip.file(path, data, { binary: true });
  }

  remove(path: string): void {
    this.zip.remove(path);
  }

  files(prefix = ''): string[] {
    return Object.keys(this.zip.files).filter((p) => p.startsWith(prefix) && !this.zip.files[p].dir);
  }

  /** قراءة الشرائح بترتيب العرض كما في presentation.xml */
  async readSlides(): Promise<SlideRef[]> {
    const presentation = parseXml(await this.readText('ppt/presentation.xml'));
    const rels = parseXml(await this.readText('ppt/_rels/presentation.xml.rels'));
    const targets = new Map(
      descendants(rels, NS.rel, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target') ?? '']),
    );
    const slides: SlideRef[] = [];
    for (const sldId of descendants(presentation, NS.p, 'sldId')) {
      const target = targets.get(sldId.getAttributeNS(NS.r, 'id'));
      if (!target) continue;
      const path = resolveTarget('ppt/presentation.xml', target);
      const relsPath = relsPathFor(path);
      slides.push({
        path,
        xml: await this.readText(path),
        relsXml: this.has(relsPath) ? await this.readText(relsPath) : EMPTY_RELS,
      });
    }
    return slides;
  }

  /** حذف جميع الشرائح من الحزمة مع كل المراجع الخاصة بها */
  async removeAllSlides(): Promise<void> {
    for (const path of this.files('ppt/slides/')) this.remove(path);

    const presentation = parseXml(await this.readText('ppt/presentation.xml'));
    const sldIdLst = descendants(presentation, NS.p, 'sldIdLst')[0];
    if (sldIdLst) childElements(sldIdLst, NS.p, 'sldId').forEach(removeElement);
    this.writeText('ppt/presentation.xml', serializeXml(presentation));

    const rels = parseXml(await this.readText('ppt/_rels/presentation.xml.rels'));
    descendants(rels, NS.rel, 'Relationship')
      .filter((r) => r.getAttribute('Type') === REL_TYPES.slide)
      .forEach(removeElement);
    this.writeText('ppt/_rels/presentation.xml.rels', serializeXml(rels));

    const types = parseXml(await this.readText('[Content_Types].xml'));
    descendants(types, NS.ct, 'Override')
      .filter((o) => (o.getAttribute('PartName') ?? '').startsWith('/ppt/slides/'))
      .forEach(removeElement);
    this.writeText('[Content_Types].xml', serializeXml(types));
  }

  /** إضافة الشرائح بالترتيب وتسجيلها في presentation.xml والعلاقات وأنواع المحتوى */
  async appendSlides(slides: { xml: string; relsXml: string }[]): Promise<void> {
    const presentation = parseXml(await this.readText('ppt/presentation.xml'));
    const rels = parseXml(await this.readText('ppt/_rels/presentation.xml.rels'));
    const types = parseXml(await this.readText('[Content_Types].xml'));

    let sldIdLst = descendants(presentation, NS.p, 'sldIdLst')[0];
    if (!sldIdLst) {
      sldIdLst = presentation.createElementNS(NS.p, 'p:sldIdLst');
      const masters = descendants(presentation, NS.p, 'sldMasterIdLst')[0];
      presentation.documentElement.insertBefore(sldIdLst, masters?.nextSibling ?? null);
    }

    let relId = nextRelId(rels);
    slides.forEach((slide, index) => {
      const number = index + 1;
      const partName = `ppt/slides/slide${number}.xml`;
      this.writeText(partName, slide.xml);
      this.writeText(relsPathFor(partName), slide.relsXml);

      const id = `rId${relId++}`;
      const rel = rels.createElementNS(NS.rel, 'Relationship');
      rel.setAttribute('Id', id);
      rel.setAttribute('Type', REL_TYPES.slide);
      rel.setAttribute('Target', `slides/slide${number}.xml`);
      rels.documentElement.appendChild(rel);

      const sldId = presentation.createElementNS(NS.p, 'p:sldId');
      sldId.setAttribute('id', String(256 + index));
      sldId.setAttributeNS(NS.r, 'r:id', id);
      sldIdLst.appendChild(sldId);

      const override = types.createElementNS(NS.ct, 'Override');
      override.setAttribute('PartName', `/${partName}`);
      override.setAttribute('ContentType', SLIDE_CONTENT_TYPE);
      types.documentElement.appendChild(override);
    });

    this.ensureDefaultContentType(types, 'jpg', 'image/jpeg');
    this.ensureDefaultContentType(types, 'jpeg', 'image/jpeg');
    this.ensureDefaultContentType(types, 'png', 'image/png');

    this.writeText('ppt/presentation.xml', serializeXml(presentation));
    this.writeText('ppt/_rels/presentation.xml.rels', serializeXml(rels));
    this.writeText('[Content_Types].xml', serializeXml(types));
  }

  private ensureDefaultContentType(types: Document, extension: string, contentType: string): void {
    const exists = descendants(types, NS.ct, 'Default').some(
      (d) => (d.getAttribute('Extension') ?? '').toLowerCase() === extension,
    );
    if (exists) return;
    const el = types.createElementNS(NS.ct, 'Default');
    el.setAttribute('Extension', extension);
    el.setAttribute('ContentType', contentType);
    const firstOverride = descendants(types, NS.ct, 'Override')[0] ?? null;
    types.documentElement.insertBefore(el, firstOverride);
  }

  /** حذف الوسائط والكائنات المضمنة التي لم تعد مستخدمة (مثل ملف الخط في شريحة التعليمات) */
  async removeUnreferencedParts(): Promise<void> {
    const referenced = new Set<string>();
    for (const relsPath of this.files().filter((p) => p.endsWith('.rels'))) {
      const source = relsPath.replace('_rels/', '').replace(/\.rels$/, '');
      const doc = parseXml(await this.readText(relsPath));
      for (const rel of descendants(doc, NS.rel, 'Relationship')) {
        if (rel.getAttribute('TargetMode') === 'External') continue;
        referenced.add(resolveTarget(source, rel.getAttribute('Target') ?? ''));
      }
    }
    for (const path of [...this.files('ppt/media/'), ...this.files('ppt/embeddings/')]) {
      if (!referenced.has(path)) this.remove(path);
    }
  }

  /** تحديث خصائص المستند: عدد الشرائح وإزالة الصورة المصغرة القديمة لشريحة التعليمات */
  async updateDocumentProperties(slideCount: number, title: string): Promise<void> {
    if (this.has('docProps/app.xml')) {
      const app = parseXml(await this.readText('docProps/app.xml'));
      const ep = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
      const slides = descendants(app, ep, 'Slides')[0];
      if (slides) slides.textContent = String(slideCount);
      // قوائم عناوين الأجزاء تصبح غير دقيقة بعد تغيير الشرائح، وهي اختيارية
      for (const name of ['HeadingPairs', 'TitlesOfParts', 'Words', 'Paragraphs']) {
        descendants(app, ep, name).forEach(removeElement);
      }
      this.writeText('docProps/app.xml', serializeXml(app));
    }

    if (this.has('docProps/core.xml')) {
      const core = parseXml(await this.readText('docProps/core.xml'));
      const dc = 'http://purl.org/dc/elements/1.1/';
      const cp = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
      let titleEl = descendants(core, dc, 'title')[0];
      if (!titleEl) {
        titleEl = core.createElementNS(dc, 'dc:title');
        core.documentElement.insertBefore(titleEl, core.documentElement.firstChild);
      }
      titleEl.textContent = title;
      const modified = descendants(core, 'http://purl.org/dc/terms/', 'modified')[0];
      if (modified) modified.textContent = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      descendants(core, cp, 'revision').forEach((r) => (r.textContent = '1'));
      this.writeText('docProps/core.xml', serializeXml(core));
    }

    const rootRels = parseXml(await this.readText('_rels/.rels'));
    const thumb = descendants(rootRels, NS.rel, 'Relationship').find(
      (r) => r.getAttribute('Type') === REL_TYPES.thumbnail,
    );
    if (thumb) {
      this.remove(resolveTarget('', thumb.getAttribute('Target') ?? ''));
      removeElement(thumb);
      this.writeText('_rels/.rels', serializeXml(rootRels));
    }
  }

  async generate(): Promise<Uint8Array> {
    return this.zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
  }
}

export { firstChild };
