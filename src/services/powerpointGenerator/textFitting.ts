export const EMU_PER_PT = 12_700;

/**
 * تقديرات قياس النص لخط "A Jannat LT" العريض.
 * متوسط عرض الحرف نسبةً لحجم الخط، وارتفاع السطر عند تباعد 100%.
 * القيم محسوبة من القالب (سطر واحد 20pt بتباعد 200% = 48.5pt) مع هامش أمان.
 */
const CHAR_WIDTH_FACTOR = 0.5;
const SPACE_WIDTH_FACTOR = 0.28;
const LINE_HEIGHT_FACTOR = 1.22;

export interface FitCandidate {
  sizePt: number;
  lineSpacingPct: number;
}

/** خطوات التصغير التدريجي: الأولوية لقابلية القراءة ثم عدم خروج النص */
export const MULTILINE_CANDIDATES: FitCandidate[] = [
  { sizePt: 20, lineSpacingPct: 200 },
  { sizePt: 20, lineSpacingPct: 150 },
  { sizePt: 18, lineSpacingPct: 150 },
  { sizePt: 16, lineSpacingPct: 140 },
  { sizePt: 16, lineSpacingPct: 120 },
  { sizePt: 14, lineSpacingPct: 120 },
  { sizePt: 13, lineSpacingPct: 110 },
  { sizePt: 12, lineSpacingPct: 100 },
  { sizePt: 11, lineSpacingPct: 100 },
  { sizePt: 10, lineSpacingPct: 100 },
];

export const SINGLE_LINE_SIZES = [18, 17, 16, 15, 14, 13, 12];

function charWidth(char: string, sizePt: number): number {
  if (char === ' ') return sizePt * SPACE_WIDTH_FACTOR;
  // الحروف اللاتينية الصغيرة والأرقام أضيق قليلًا
  if (/[a-z0-9.,:;()\-/]/.test(char)) return sizePt * 0.47;
  return sizePt * CHAR_WIDTH_FACTOR;
}

export function measureTextPt(text: string, sizePt: number): number {
  let width = 0;
  for (const char of text) width += charWidth(char, sizePt);
  return width;
}

/** تقدير عدد الأسطر مع محاكاة التفاف الكلمات */
export function estimateLines(paragraphs: string[], sizePt: number, widthPt: number): number {
  let lines = 0;
  const spaceWidth = sizePt * SPACE_WIDTH_FACTOR;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let lineCount = 1;
    let current = 0;
    for (const word of words) {
      const w = measureTextPt(word, sizePt);
      if (w > widthPt) {
        // كلمة أطول من السطر تُكسر على عدة أسطر
        if (current > 0) lineCount++;
        lineCount += Math.ceil(w / widthPt) - 1;
        current = w % widthPt;
        continue;
      }
      const needed = current === 0 ? w : current + spaceWidth + w;
      if (needed > widthPt) {
        lineCount++;
        current = w;
      } else {
        current = needed;
      }
    }
    lines += lineCount;
  }
  return Math.max(lines, 1);
}

export function estimateHeightPt(lines: number, candidate: FitCandidate): number {
  return lines * candidate.sizePt * LINE_HEIGHT_FACTOR * (candidate.lineSpacingPct / 100);
}
