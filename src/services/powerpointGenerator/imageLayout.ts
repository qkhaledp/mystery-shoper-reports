export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

/** قص نسبي بوحدات OOXML (100000 = 100%) */
export interface Crop {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface PlacedImage extends Rect {
  crop?: Crop;
}

/** أقل نسبة يجب أن تبقى ظاهرة من الصورة حتى يُسمح بقصها لملء الخلية */
const MIN_VISIBLE_FRACTION_FOR_CROP = 0.72;

function containedArea(size: ImageSize, cellW: number, cellH: number): number {
  const scale = Math.min(cellW / size.width, cellH / size.height);
  return size.width * scale * size.height * scale;
}

function place(size: ImageSize, cell: Rect, allowCrop: boolean): PlacedImage {
  const imageRatio = size.width / size.height;
  const cellRatio = cell.w / cell.h;
  const visible = imageRatio > cellRatio ? cellRatio / imageRatio : imageRatio / cellRatio;

  if (allowCrop && visible >= MIN_VISIBLE_FRACTION_FOR_CROP && visible < 0.999) {
    const cut = Math.round(((1 - visible) / 2) * 100_000);
    const crop: Crop = imageRatio > cellRatio ? { l: cut, r: cut, t: 0, b: 0 } : { l: 0, r: 0, t: cut, b: cut };
    return { ...roundRect(cell), crop };
  }

  const scale = Math.min(cell.w / size.width, cell.h / size.height);
  const w = size.width * scale;
  const h = size.height * scale;
  return roundRect({ x: cell.x + (cell.w - w) / 2, y: cell.y + (cell.h - h) / 2, w, h });
}

function roundRect(r: Rect): Rect {
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
}

/**
 * توزيع الصور داخل منطقة الإثبات:
 * - يجرب كل عدد أعمدة ممكن ويختار الشبكة التي تعطي أكبر مساحة عرض فعلية للصور.
 * - صورة واحدة: تُحتوى كاملة مع الحفاظ على نسبة الأبعاد.
 * - أكثر من صورة: تُملأ الخلايا بقص بسيط متوازن إذا كان الجزء المقصوص صغيرًا،
 *   وإلا تُحتوى الصورة كاملة داخل خليتها (بدون تشويه في جميع الحالات).
 * - الترتيب من اليمين لليسار، وآخر صف غير مكتمل يُوسّط.
 */
export function layoutImages(sizes: ImageSize[], region: Rect, gap: number): PlacedImage[] {
  const count = sizes.length;
  if (count === 0) return [];

  let best = { cols: 1, rows: count, area: -1 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = (region.w - gap * (cols - 1)) / cols;
    const cellH = (region.h - gap * (rows - 1)) / rows;
    if (cellW <= 0 || cellH <= 0) continue;
    const area = sizes.reduce((sum, s) => sum + containedArea(s, cellW, cellH), 0);
    if (area > best.area * 1.02) best = { cols, rows, area };
  }

  const { cols, rows } = best;
  const cellW = (region.w - gap * (cols - 1)) / cols;
  const cellH = (region.h - gap * (rows - 1)) / rows;

  return sizes.map((size, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const itemsInRow = Math.min(cols, count - row * cols);
    const rowOffset = ((cols - itemsInRow) * (cellW + gap)) / 2;
    const cellRight = region.x + region.w - rowOffset - col * (cellW + gap);
    const cell = { x: cellRight - cellW, y: region.y + row * (cellH + gap), w: cellW, h: cellH };
    return place(size, cell, count > 1);
  });
}
