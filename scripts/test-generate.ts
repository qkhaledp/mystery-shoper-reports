/**
 * اختبار سيناريو كامل لتوليد PowerPoint من القالب الرسمي (بدون متصفح):
 * تذكرة واحدة + 3 ملاحظات + صور لكل ملاحظة.
 * التشغيل: npm run test:pptx -- [مسار الإخراج]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import JSZip from 'jszip';
import { buildPresentation } from '../src/services/powerpointGenerator/buildPresentation';
import type { GeneratorImage } from '../src/services/powerpointGenerator/types';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** صورة PNG اختبارية ملونة بأبعاد محددة */
function makePng(width: number, height: number, hue: [number, number, number]): GeneratorImage {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const stripe = (Math.floor(x / 80) + Math.floor(y / 80)) % 2 === 0 ? 1 : 0.75;
      const i = row + 1 + x * 3;
      raw[i] = Math.round(hue[0] * stripe);
      raw[i + 1] = Math.round(hue[1] * stripe * (0.6 + (0.4 * y) / height));
      raw[i + 2] = Math.round(hue[2] * stripe);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return { data: new Uint8Array(png), width, height, extension: 'png' };
}

async function main() {
  const out = process.argv[2] ?? 'test-output.pptx';
  const template = readFileSync('public/templates/ticket-closure-template.pptx');

  const result = await buildPresentation(
    {
      facilityName: 'مركز صحي عبد المنعم الراشد',
      ticketNumber: 'TCK-2026-00482',
      ticketTitle: 'MV team - Beneficiary Experience',
      visitNumber: 'الخامسة',
      displayDate: '15/09/2026',
      observations: [
        {
          text: 'عدم وجود لوحات إرشادية واضحة لمواقع العيادات',
          correctiveAction: 'تم تركيب لوحات إرشادية جديدة عند المدخل الرئيسي',
          images: [makePng(1600, 900, [1, 135, 85])],
        },
        {
          text: 'طول مدة انتظار المستفيدين في منطقة الاستقبال وعدم تفعيل نظام الأرقام',
          correctiveAction:
            'تم تفعيل نظام الدور الإلكتروني وإضافة موظف استقبال في فترة الذروة الصباحية، مع متابعة مؤشر مدة الانتظار أسبوعيًا من قبل مشرف الجودة',
          images: [makePng(900, 1600, [168, 154, 107]), makePng(1200, 1200, [60, 140, 200])],
        },
        {
          text:
            'لوحظ عدم توفر معقمات الأيدي عند مداخل العيادات وغرف الانتظار، إضافة إلى عدم تحديث سجل النظافة اليومي لدورات المياه، وعدم وجود ملصقات توعوية بطريقة غسل الأيدي الصحيحة في الممرات الرئيسية للمركز',
          correctiveAction:
            'تم توفير معقمات أيدي ثابتة عند جميع مداخل العيادات وغرف الانتظار.\nتم إلزام شركة النظافة بتحديث السجل اليومي كل ساعتين مع توقيع المشرف.\nتم طباعة وتعليق ملصقات توعوية معتمدة من إدارة مكافحة العدوى في جميع الممرات.\nسيتم تنفيذ جولة تفتيشية أسبوعية للتأكد من الاستمرارية.',
          images: [
            makePng(1400, 1000, [220, 90, 60]),
            makePng(1000, 1400, [90, 60, 200]),
            makePng(1600, 900, [30, 160, 160]),
            makePng(1200, 900, [200, 170, 40]),
          ],
        },
      ],
    },
    template,
  );

  writeFileSync(out, result);

  // تحقق هيكلي سريع
  const zip = await JSZip.loadAsync(result);
  const slides = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort();
  const texts = await Promise.all(
    slides.map(async (p) => (await zip.file(p)!.async('string')).match(/<a:t>([^<]*)<\/a:t>/g)?.join('').replace(/<\/?a:t>/g, '')),
  );
  console.log(`✓ ${out} (${(result.length / 1024).toFixed(0)} KB)`);
  console.log(`slides: ${slides.length}`);
  texts.forEach((t, i) => console.log(`  [${i + 1}] ${t?.slice(0, 140)}`));
  const leftovers = texts.join('|').match(/للتعليمات|باللون الأسود|يضاف|DD\/MM|يتم إضافة اثبات/g);
  if (slides.length !== 4 || leftovers) {
    console.error('✗ FAILED', { slides: slides.length, leftovers });
    process.exit(1);
  }
  console.log('✓ no instruction slide, no leftover placeholders');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
