import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Report } from '../types/report';
import { createId } from '../utils/id';
import { AppError } from './errors';

interface StoredImage {
  path: string;
  reportId: string;
  blob: Blob;
}

interface ReportsDB extends DBSchema {
  reports: { key: string; value: Report };
  images: { key: string; value: StoredImage; indexes: { byReport: string } };
}

const DB_NAME = 'mystery-visitor-reports';

let dbPromise: Promise<IDBPDatabase<ReportsDB>> | null = null;

/**
 * تخزين محلي داخل متصفح المستخدم: لا يوجد حساب ولا خادم.
 * التقارير والصور تبقى على الجهاز حتى يحذفها المستخدم.
 */
function getDb(): Promise<IDBPDatabase<ReportsDB>> {
  dbPromise ??= openDB<ReportsDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('reports', { keyPath: 'id' });
      db.createObjectStore('images', { keyPath: 'path' }).createIndex('byReport', 'reportId');
    },
  });
  return dbPromise;
}

/** حذف بيانات النسخة القديمة من المنصة (حسابات ورموز دخول) إن وُجدت على الجهاز */
export function cleanUpLegacyData(): void {
  try {
    localStorage.removeItem('tcp.session');
    void deleteDB('ticket-closure-platform').catch(() => undefined);
  } catch {
    // لا يؤثر على عمل التطبيق
  }
}

export async function listReports(): Promise<Report[]> {
  const db = await getDb();
  const reports = await db.getAll('reports');
  return reports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getReport(id: string): Promise<Report> {
  const db = await getDb();
  const report = await db.get('reports', id);
  if (!report) throw new AppError('التقرير غير موجود على هذا الجهاز', 'not_found');
  return report;
}

export async function saveReport(report: Report): Promise<Report> {
  const db = await getDb();
  const saved = { ...report, updatedAt: new Date().toISOString() };
  await db.put('reports', saved);
  return saved;
}

export async function deleteReport(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['reports', 'images'], 'readwrite');
  await tx.objectStore('reports').delete(id);
  const images = tx.objectStore('images');
  const keys = await images.index('byReport').getAllKeys(id);
  await Promise.all(keys.map((key) => images.delete(key)));
  await tx.done;
}

export async function saveImage(reportId: string, blob: Blob, extension: string): Promise<string> {
  const db = await getDb();
  const path = `${reportId}/${createId()}.${extension}`;
  await db.put('images', { path, reportId, blob });
  return path;
}

export async function getImage(path: string): Promise<Blob> {
  const db = await getDb();
  const image = await db.get('images', path);
  if (!image) throw new AppError('تعذر العثور على الصورة', 'not_found');
  return image.blob;
}

export async function deleteImage(path: string): Promise<void> {
  const db = await getDb();
  await db.delete('images', path);
}
