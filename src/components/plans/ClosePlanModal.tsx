import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { realizedR } from '../../lib/planMath';
import { cn } from '../../lib/utils';
import { closePlan } from '../../features/tradeplan/tradePlanSlice';
import { updateHolding, removeHolding } from '../../features/portfolio/portfolioSlice';
import { addTrade } from '../../features/journal/journalSlice';
import type { TradePlan, ExitReason } from '../../types';
import type { RootState, AppDispatch } from '../../store';

interface Props {
  plan: TradePlan | null;
  onClose: () => void;
  /** Fired after the close is committed, so the caller can request a process grade. */
  onClosed?: (plan: TradePlan, exitPrice: number, exitReason: ExitReason) => void;
}

const REASONS: { value: ExitReason; label: string; note?: string }[] = [
  { value: 'stop-hit', label: 'Stop was hit' },
  { value: 'target-hit', label: 'Target was reached' },
  { value: 'thesis-broken', label: 'Thesis was invalidated' },
  { value: 'discretionary', label: 'I changed my mind', note: 'Counts against adherence' },
];

const selectClass =
  'flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

export function ClosePlanModal({ plan, onClose, onClosed }: Props) {
  return (
    <Dialog open={plan !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        {/* Keyed on the plan so form state initialises on mount rather than
            being synced back in by an effect. */}
        {plan && <ClosePlanForm key={plan.id} plan={plan} onClose={onClose} onClosed={onClosed} />}
      </DialogContent>
    </Dialog>
  );
}

function ClosePlanForm({
  plan,
  onClose,
  onClosed,
}: {
  plan: TradePlan;
  onClose: () => void;
  onClosed?: (plan: TradePlan, exitPrice: number, exitReason: ExitReason) => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const holdings = useSelector((s: RootState) => s.portfolio.holdings);

  const livePrice = holdings.find(h => h.symbol === plan.symbol)?.currentPrice;
  const [exitPrice, setExitPrice] = useState(String(livePrice ?? plan.target1));
  const [exitReason, setExitReason] = useState<ExitReason>('target-hit');
  const [error, setError] = useState<string | null>(null);

  const price = Number(exitPrice);
  const liveR =
    plan.actualEntryPrice != null && plan.initialStopPrice != null && price > 0
      ? realizedR(plan.actualEntryPrice, plan.initialStopPrice, price)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(price > 0)) {
      setError('Exit price must be greater than zero.');
      return;
    }

    const shares = plan.actualShares ?? 0;
    const entry = plan.actualEntryPrice ?? 0;

    dispatch(closePlan({ id: plan.id, actualExitPrice: price, exitReason }));

    const holding = holdings.find(h => h.symbol === plan.symbol);
    if (holding) {
      const remaining = holding.quantity - shares;
      if (remaining > 0) {
        dispatch(
          updateHolding({
            symbol: plan.symbol,
            quantity: remaining,
            purchasePrice: holding.purchasePrice,
          })
        );
      } else {
        dispatch(removeHolding(plan.symbol));
      }
    }

    dispatch(
      addTrade({
        type: 'sell',
        symbol: plan.symbol,
        name: plan.name,
        quantity: shares,
        price,
        entryPrice: entry,
        date: new Date().toISOString(),
        notes: `Closed: ${exitReason}`,
        gainLoss: (price - entry) * shares,
        gainLossPercent: entry > 0 ? ((price - entry) / entry) * 100 : 0,
      })
    );

    onClosed?.(plan, price, exitReason);
    onClose();
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>Close {plan.symbol}</DialogTitle>
          <DialogDescription>
            The exit reason is what the adherence metric is built from — answer it honestly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="exit-price">Exit price</Label>
              <Input
                id="exit-price"
                type="number"
                step="0.01"
                min="0"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
              />
            </div>

            {liveR !== null && (
              <div className="rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
                Result:{' '}
                <span
                  className={cn(
                    'font-semibold',
                    liveR > 0 ? 'text-green-500' : liveR < 0 ? 'text-red-500' : ''
                  )}
                >
                  {liveR > 0 ? '+' : ''}{liveR.toFixed(2)}R
                </span>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="exit-reason">Why are you exiting?</Label>
              <select
                id="exit-reason"
                className={selectClass}
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value as ExitReason)}
              >
                {REASONS.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}{r.note ? ` — ${r.note}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Close position</Button>
          </DialogFooter>
        </form>
    </>
  );
}
