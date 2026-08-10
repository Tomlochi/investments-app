import { Loader2, ShieldAlert, CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DevilsAdvocateResult, TradeCheckVerdict } from '../../types';

interface Props {
  loading: boolean;
  result?: DevilsAdvocateResult;
  error: string | null;
}

const VERDICT: Record<TradeCheckVerdict, { label: string; className: string; Icon: React.ElementType }> = {
  proceed: {
    label: 'Proceed',
    className: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900',
    Icon: CheckCircle2,
  },
  caution: {
    label: 'Caution',
    className: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
    Icon: AlertTriangle,
  },
  reconsider: {
    label: 'Reconsider',
    className: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
    Icon: XOctagon,
  },
};

export function DevilsAdvocatePanel({ loading, result, error }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Plan saved. Arguing the other side…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        {error}
      </div>
    );
  }

  if (!result) return null;

  const { label, className, Icon } = VERDICT[result.verdict] ?? VERDICT.caution;

  return (
    <div className={cn('space-y-3 rounded-md border p-3 text-sm', className)}>
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4" />
        {label}
        <span className="ml-auto flex items-center gap-1 text-xs font-normal opacity-80">
          <ShieldAlert className="h-3 w-3" />
          Devil's advocate
        </span>
      </div>

      <Section title="Bear case" items={result.bearCase} />
      <Section title="Plan critique" items={result.planCritique} />
      <Section title="Mistakes you have made before" items={result.repeatedMistakes} emphasise />

      <p className="text-xs opacity-70">
        Saved either way — this is a second opinion, not a gate.
      </p>
    </div>
  );
}

function Section({
  title, items, emphasise,
}: { title: string; items: string[]; emphasise?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className={cn('text-xs font-semibold uppercase tracking-wide opacity-70', emphasise && 'opacity-100')}>
        {title}
      </div>
      <ul className="mt-1 list-inside list-disc space-y-1">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}
