import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, PlayCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { formatCurrency, cn } from '../../lib/utils';
import { plannedR, realizedR } from '../../lib/planMath';
import { deletePlan } from '../../features/tradeplan/tradePlanSlice';
import { openPlanModal } from '../../features/ui/uiSlice';
import type { TradePlan } from '../../types';
import type { AppDispatch } from '../../store';

interface Props {
  plan: TradePlan;
  onOpen?: (plan: TradePlan) => void;
  onClose?: (plan: TradePlan) => void;
  onGrade?: (plan: TradePlan) => void;
  grading?: boolean;
}

const STATUS_STYLE: Record<TradePlan['status'], string> = {
  idea: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function PlanCard({ plan, onOpen, onClose, onGrade, grading }: Props) {
  const dispatch = useDispatch<AppDispatch>();

  const rr = plannedR(plan.entryHigh, plan.stopPrice, plan.target1);
  const outcomeR =
    plan.status === 'closed' &&
    plan.actualEntryPrice != null &&
    plan.initialStopPrice != null &&
    plan.actualExitPrice != null
      ? realizedR(plan.actualEntryPrice, plan.initialStopPrice, plan.actualExitPrice)
      : null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/stock/${plan.symbol}`}
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {plan.symbol}
            </Link>
            <span className="truncate text-sm text-gray-600 dark:text-gray-400">{plan.name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge className={STATUS_STYLE[plan.status]}>{plan.status}</Badge>
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
              {plan.setup}
            </Badge>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              conviction {plan.conviction}/5
            </span>
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" title="Edit" onClick={() => dispatch(openPlanModal(plan.id))}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            onClick={() => dispatch(deletePlan(plan.id))}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Figure label="Entry" value={`${formatCurrency(plan.entryLow)}–${formatCurrency(plan.entryHigh)}`} />
        <Figure label="Stop" value={formatCurrency(plan.stopPrice)} />
        <Figure label="Target" value={formatCurrency(plan.target1)} />
        <Figure label="Planned R:R" value={rr === null ? '—' : rr.toFixed(2)} />
        {plan.status !== 'idea' && (
          <>
            <Figure label="Filled at" value={plan.actualEntryPrice != null ? formatCurrency(plan.actualEntryPrice) : '—'} />
            <Figure label="Shares" value={plan.actualShares != null ? String(plan.actualShares) : String(plan.plannedShares)} />
          </>
        )}
        {plan.status === 'closed' && (
          <>
            <Figure label="Exit" value={plan.actualExitPrice != null ? formatCurrency(plan.actualExitPrice) : '—'} />
            <Figure
              label="Result"
              value={outcomeR === null ? '—' : `${outcomeR > 0 ? '+' : ''}${outcomeR.toFixed(2)}R`}
              className={cn(outcomeR != null && (outcomeR > 0 ? 'text-green-500' : 'text-red-500'))}
            />
          </>
        )}
      </div>

      {plan.thesis && (
        <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Thesis: </span>
          {plan.thesis}
        </p>
      )}

      {plan.status === 'closed' && plan.exitReason && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Exited: {plan.exitReason.replace('-', ' ')}
        </p>
      )}

      {plan.grade && (
        <div className="rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Process score {plan.grade.score}/100</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">(ignores profit)</span>
          </div>
          <p className="mt-1 text-gray-700 dark:text-gray-300">{plan.grade.lesson}</p>
          {plan.grade.brokePlan.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-600 dark:text-red-400">
              {plan.grade.brokePlan.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {plan.status === 'idea' && onOpen && (
          <Button size="sm" onClick={() => onOpen(plan)}>
            <PlayCircle className="mr-1 h-4 w-4" />
            Mark opened
          </Button>
        )}
        {plan.status === 'open' && onClose && (
          <Button size="sm" variant="outline" onClick={() => onClose(plan)}>
            <XCircle className="mr-1 h-4 w-4" />
            Close plan
          </Button>
        )}
        {plan.status === 'closed' && !plan.grade && onGrade && (
          <Button size="sm" variant="outline" disabled={grading} onClick={() => onGrade(plan)}>
            {grading ? 'Grading…' : 'Grade now'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', className)}>{children}</span>
  );
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn('font-semibold', className)}>{value}</div>
    </div>
  );
}
