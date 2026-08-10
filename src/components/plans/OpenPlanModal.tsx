import { useState } from 'react';
import { useDispatch } from 'react-redux';
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
import { openPlan } from '../../features/tradeplan/tradePlanSlice';
import { addHolding } from '../../features/portfolio/portfolioSlice';
import { addTrade } from '../../features/journal/journalSlice';
import type { TradePlan } from '../../types';
import type { AppDispatch } from '../../store';

interface Props {
  plan: TradePlan | null;
  onClose: () => void;
}

export function OpenPlanModal({ plan, onClose }: Props) {
  return (
    <Dialog open={plan !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        {/* Keyed on the plan so form state initialises on mount rather than
            being synced back in by an effect. */}
        {plan && <OpenPlanForm key={plan.id} plan={plan} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function OpenPlanForm({ plan, onClose }: { plan: TradePlan; onClose: () => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const [price, setPrice] = useState(String(plan.entryHigh));
  const [shares, setShares] = useState(String(plan.plannedShares));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const fillPrice = Number(price);
    const fillShares = Number(shares);
    if (!(fillPrice > 0) || !(fillShares > 0)) {
      setError('Fill price and share count must both be greater than zero.');
      return;
    }

    // These three dispatches are one transaction: they are what keeps the plan,
    // the holding and the journal from drifting apart.
    dispatch(openPlan({ id: plan.id, actualEntryPrice: fillPrice, actualShares: fillShares }));
    dispatch(
      addHolding({
        symbol: plan.symbol,
        name: plan.name,
        quantity: fillShares,
        purchasePrice: fillPrice,
        purchaseDate: new Date().toISOString(),
        thesis: plan.thesis || undefined,
      })
    );
    dispatch(
      addTrade({
        type: 'buy',
        symbol: plan.symbol,
        name: plan.name,
        quantity: fillShares,
        price: fillPrice,
        entryPrice: fillPrice,
        date: new Date().toISOString(),
        notes: `Plan (${plan.setup}): ${plan.thesis}`.slice(0, 500),
      })
    );

    onClose();
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>Open {plan.symbol}</DialogTitle>
          <DialogDescription>
            Record the actual fill. This creates the holding and a buy entry in your journal, and
            locks the stop as this trade's risk baseline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fill-price">Fill price</Label>
                <Input
                  id="fill-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fill-shares">Shares</Label>
                <Input
                  id="fill-shares"
                  type="number"
                  step="1"
                  min="0"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                />
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Stop locks at ${plan.stopPrice.toFixed(2)}. Raising it later will not change how this
              trade's R is measured.
            </p>

            {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Open position</Button>
          </DialogFooter>
        </form>
    </>
  );
}
