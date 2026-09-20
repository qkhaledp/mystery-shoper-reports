/** أخطاء برسائل عربية آمنة للعرض للمستخدم */
export class AppError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly code: 'forbidden' | 'not_found' | 'invalid' | 'unauthenticated' | 'generation' | 'unknown' = 'unknown',
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = 'AppError';
  }
}

export const forbidden = () => new AppError('ليس لديك صلاحية للقيام بهذا الإجراء', 'forbidden');
export const notFound = () => new AppError('التقرير غير موجود أو لا تملك صلاحية الوصول إليه', 'not_found');
export const unauthenticated = () => new AppError('يرجى تسجيل الدخول أولًا', 'unauthenticated');

export function toUserMessage(error: unknown, fallback = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'): string {
  if (error instanceof AppError) return error.userMessage;
  console.error(error);
  return fallback;
}
