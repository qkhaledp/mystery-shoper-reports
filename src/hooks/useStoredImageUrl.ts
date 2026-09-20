import { useEffect, useState } from 'react';
import { getImage } from '../services/store';

const cache = new Map<string, Promise<string>>();

/** يحفظ رابط المعاينة مباشرة بعد الحفظ لتجنب إعادة قراءة الصورة */
export function primeImageUrl(path: string, blob: Blob): void {
  cache.set(path, Promise.resolve(URL.createObjectURL(blob)));
}

/** رابط عرض مؤقت لصورة محفوظة على الجهاز */
export function useStoredImageUrl(path: string | undefined): { url?: string; failed: boolean } {
  const [state, setState] = useState<{ url?: string; failed: boolean }>({ failed: false });

  useEffect(() => {
    if (!path) return;
    let active = true;
    let promise = cache.get(path);
    if (!promise) {
      promise = getImage(path).then((blob) => URL.createObjectURL(blob));
      cache.set(path, promise);
      promise.catch(() => cache.delete(path));
    }
    promise
      .then((url) => active && setState({ url, failed: false }))
      .catch(() => active && setState({ failed: true }));
    return () => {
      active = false;
    };
  }, [path]);

  return state;
}
