import { FilePlus2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const BRAND_ICON = `${import.meta.env.BASE_URL}brand/mystery-visitor-icon.png`;
export const BRAND_LOGO = `${import.meta.env.BASE_URL}brand/mystery-visitor-logo.jpg`;

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src={BRAND_ICON} alt="" className="h-9 w-auto shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-brand-700">منصة إغلاق التذاكر</div>
            <div className="hidden truncate text-xs text-ink-muted sm:block">الزائر السري · تجمع الرياض الصحي الثالث</div>
          </div>
        </Link>

        <Link to="/reports/new" className="btn-primary ms-auto px-3 sm:px-5">
          <FilePlus2 className="h-4 w-4" />
          <span className="hidden sm:inline">تقرير جديد</span>
          <span className="sm:hidden">جديد</span>
        </Link>
      </div>
    </header>
  );
}
