import clsx from 'clsx';
import { Check } from 'lucide-react';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="خطوات إنشاء التقرير">
      <p className="mb-2 text-sm font-bold text-ink-muted sm:hidden">
        الخطوة {current + 1} من {steps.length}: <span className="text-brand-700">{steps[current]}</span>
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
              <span
                className={clsx(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition',
                  done && 'bg-brand-500 text-white',
                  active && 'bg-brand-500 text-white ring-4 ring-brand-500/20',
                  !done && !active && 'bg-slate-200 text-slate-500',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={clsx(
                  'hidden whitespace-nowrap text-sm font-bold sm:inline',
                  active ? 'text-brand-700' : done ? 'text-ink' : 'text-slate-400',
                )}
              >
                {label}
              </span>
              {index < steps.length - 1 && (
                <span className={clsx('h-0.5 flex-1 rounded-full', done ? 'bg-brand-500' : 'bg-slate-200')} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
