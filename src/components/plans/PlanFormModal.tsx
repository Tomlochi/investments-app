import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';
import { Search, Loader2 } from 'lucide-react';
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
import { SizingCalculator } from './SizingCalculator';
import { DevilsAdvocatePanel } from './DevilsAdvocatePanel';
import { useSearchStocksQuery, useGetQuoteQuery } from '../../services/stockApi';
import { useLazyGetIndicatorsQuery } from '../../services/indicatorsApi';
import { useLazyGetDevilsAdvocateQuery } from '../../services/insightsApi';
import { runPlanChecks } from '../../lib/planChecks';
import { savePlan } from '../../features/tradeplan/tradePlanSlice';
import { closePlanModal } from '../../features/ui/uiSlice';
import type { RootState, AppDispatch } from '../../store';
import type { SetupType, TradePlan } from '../../types';

const SETUPS: { value: SetupType; label: string }[] = [
  { value: 'breakout', label: 'Breakout' },
  { value: 'pullback', label: 'Pullback' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'value', label: 'Value' },
  { value: 'core-add', label: 'Core add' },
  { value: 'other', label: 'Other' },
];

const EMPTY = {
  symbol: '',
  name: '',
  setup: 'breakout' as SetupType,
  entryLow: '',
  entryHigh: '',
  stopPrice: '',
  target1: '',
  target2: '',
  plannedShares: '',
  conviction: '3',
  thesis: '',
  invalidation: '',
};

const textareaClass =
  'flex min-h-[60px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 resize-none';

const selectClass =
  'flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

export function PlanFormModal() {
  const dispatch = useDispatch<AppDispatch>();
  const isOpen = useSelector((s: RootState) => s.ui.planModalOpen);
  const editingPlanId = useSelector((s: RootState) => s.ui.editingPlanId);

  const handleClose = () => dispatch(closePlanModal());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {/* Keyed so a fresh form mounts per plan instead of an effect syncing
            props back into state. */}
        {isOpen && <PlanForm key={editingPlanId ?? 'new'} onClose={handleClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PlanForm({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const editingPlanId = useSelector((s: RootState) => s.ui.editingPlanId);
  const plans = useSelector((s: RootState) => s.tradePlan.plans);
  const holdings = useSelector((s: RootState) => s.portfolio.holdings);
  const cash = useSelector((s: RootState) => s.cash.balance);

  const editingPlan = editingPlanId ? plans.find(p => p.id === editingPlanId) ?? null : null;

  const settings = useSelector((s: RootState) => s.settings);

  const [form, setForm] = useState(() => (editingPlan ? formFromPlan(editingPlan) : EMPTY));
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(() =>
    editingPlan ? `${editingPlan.symbol} - ${editingPlan.name}` : ''
  );
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedPlan, setSavedPlan] = useState<TradePlan | null>(null);

  const [fetchIndicators] = useLazyGetIndicatorsQuery();
  const [runDevilsAdvocate, devilsAdvocate] = useLazyGetDevilsAdvocateQuery();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 1 && !form.symbol) setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, form.symbol]);

  const { data: searchResults, isFetching: isSearching } = useSearchStocksQuery(debouncedSearch, {
    skip: debouncedSearch.length < 1,
  });

  const { data: quote } = useGetQuoteQuery(form.symbol, { skip: !form.symbol });

  const set = (patch: Partial<typeof EMPTY>) => setForm(f => ({ ...f, ...patch }));

  const handleSelectStock = (symbol: string, name: string) => {
    set({ symbol, name });
    setSearchQuery(`${symbol} - ${name}`);
    setShowResults(false);
    setDebouncedSearch('');
  };

  const handleClose = () => onClose();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entryHigh = Number(form.entryHigh);
    const stopPrice = Number(form.stopPrice);
    const target1 = Number(form.target1);

    if (!form.symbol) {
      setError('Pick a stock first.');
      return;
    }
    // The only hard validation in the feature: without positive risk per share,
    // sizing divides by zero or goes negative.
    if (!(stopPrice < entryHigh)) {
      setError('Stop price must be below the entry price.');
      return;
    }
    if (!(target1 > entryHigh)) {
      setError('Target must be above the entry price.');
      return;
    }

    const shares = Number(form.plannedShares);
    const equity =
      holdings.reduce((sum, h) => sum + h.quantity * (h.currentPrice ?? h.purchasePrice), 0) + cash;

    const plan: TradePlan = {
        id: editingPlan?.id ?? nanoid(),
        symbol: form.symbol.toUpperCase(),
        name: form.name || quote?.longName || quote?.shortName || form.symbol,
        status: editingPlan?.status ?? 'idea',
        setup: form.setup,
        thesis: form.thesis,
        invalidation: form.invalidation,
        entryLow: Number(form.entryLow) || entryHigh,
        entryHigh,
        stopPrice,
        target1,
        target2: form.target2 ? Number(form.target2) : undefined,
        plannedShares: shares,
        riskPercent: equity > 0 ? ((shares * (entryHigh - stopPrice)) / equity) * 100 : 0,
        conviction: Number(form.conviction) as 1 | 2 | 3 | 4 | 5,
        createdAt: editingPlan?.createdAt ?? new Date().toISOString(),
        // Preserve the open-state fields. Losing initialStopPrice would break
        // every R calculation for this plan.
        actualEntryPrice: editingPlan?.actualEntryPrice,
        actualShares: editingPlan?.actualShares,
        initialStopPrice: editingPlan?.initialStopPrice,
        openedAt: editingPlan?.openedAt,
        actualExitPrice: editingPlan?.actualExitPrice,
        closedAt: editingPlan?.closedAt,
        exitReason: editingPlan?.exitReason,
        grade: editingPlan?.grade,
    };

    // The plan is saved first and unconditionally. The AI review that follows is
    // advisory — a failure there must never cost the user their written plan.
    dispatch(savePlan(plan));
    setSavedPlan(plan);
    setAiError(null);

    try {
      const indicators = await fetchIndicators(plan.symbol).unwrap().catch(() => null);

      let headlines: { title: string; publisher: string }[] = [];
      try {
        const res = await fetch(`/api/news?symbols=${encodeURIComponent(plan.symbol)}`);
        if (res.ok) headlines = (await res.json())[plan.symbol] ?? [];
      } catch {
        // headlines are optional context
      }

      const checkFlags = runPlanChecks({
        equity,
        riskPerTradePercent: settings.riskPerTradePercent,
        maxPositionPercent: settings.maxPositionPercent,
        entryHigh,
        stopPrice,
        target1,
        shares,
        atr14: indicators?.atr14 ?? null,
        sameSectorPercent: null,
      });

      await runDevilsAdvocate({
        plan: {
          symbol: plan.symbol,
          name: plan.name,
          setup: plan.setup,
          thesis: plan.thesis,
          invalidation: plan.invalidation,
          entryHigh,
          stopPrice,
          target1,
          shares,
          conviction: plan.conviction,
        },
        checkFlags,
        holdings: holdings.map(h => ({
          symbol: h.symbol,
          quantity: h.quantity,
          purchasePrice: h.purchasePrice,
          currentPrice: h.currentPrice,
        })),
        cashBalance: cash,
        openPlans: plans
          .filter(p => p.status === 'open' && p.id !== plan.id)
          .map(p => ({ symbol: p.symbol, setup: p.setup, thesis: p.thesis })),
        pastLessons: plans
          .filter(p => p.status === 'closed' && p.grade)
          .slice(0, 10)
          .map(p => ({
            symbol: p.symbol,
            date: p.closedAt ?? p.createdAt,
            setup: p.setup,
            score: p.grade!.score,
            lesson: p.grade!.lesson,
          })),
        indicators: indicators ?? null,
        headlines,
      }).unwrap();
    } catch {
      setAiError('AI review unavailable. Your plan was saved.');
    }
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>{editingPlan ? 'Edit trade plan' : 'New trade plan'}</DialogTitle>
          <DialogDescription>
            Write the plan before the money goes in. Entry, stop, target and size decided up front.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="plan-stock">Stock</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="plan-stock"
                  placeholder="Search by symbol or name..."
                  value={searchQuery}
                  autoComplete="off"
                  className="pl-9"
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    set({ symbol: '', name: '' });
                    setShowResults(e.target.value.length >= 1);
                  }}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
                )}
                {showResults && searchResults && searchResults.length > 0 && (
                  <div className="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {searchResults.map((r) => (
                      <button
                        key={r.symbol}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 dark:text-gray-100 dark:hover:bg-gray-700"
                        onClick={() => handleSelectStock(r.symbol, r.shortname || r.longname || r.symbol)}
                      >
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{r.symbol}</span>
                        <span className="ml-2 truncate text-xs text-gray-600 dark:text-gray-400">
                          {r.shortname || r.longname}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {quote && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-900/30">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {quote.longName || quote.shortName}
                </div>
                <div className="font-semibold text-blue-600 dark:text-blue-400">
                  Current price: ${quote.regularMarketPrice.toFixed(2)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="plan-setup">Setup</Label>
                <select
                  id="plan-setup"
                  className={selectClass}
                  value={form.setup}
                  onChange={(e) => set({ setup: e.target.value as SetupType })}
                >
                  {SETUPS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-conviction">Conviction</Label>
                <select
                  id="plan-conviction"
                  className={selectClass}
                  value={form.conviction}
                  onChange={(e) => set({ conviction: e.target.value })}
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n} / 5</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumField id="plan-entry-low" label="Entry zone low" value={form.entryLow} onChange={v => set({ entryLow: v })} />
              <NumField id="plan-entry-high" label="Entry zone high" value={form.entryHigh} onChange={v => set({ entryHigh: v })} />
              <NumField id="plan-stop" label="Stop" value={form.stopPrice} onChange={v => set({ stopPrice: v })} />
              <NumField id="plan-target1" label="Target" value={form.target1} onChange={v => set({ target1: v })} />
              <NumField id="plan-target2" label="Second target (optional)" value={form.target2} onChange={v => set({ target2: v })} />
              <NumField id="plan-shares" label="Shares" step="1" value={form.plannedShares} onChange={v => set({ plannedShares: v })} />
            </div>

            <SizingCalculator
              symbol={form.symbol}
              entryHigh={Number(form.entryHigh) || 0}
              stopPrice={Number(form.stopPrice) || 0}
              target1={Number(form.target1) || 0}
              shares={Number(form.plannedShares) || 0}
              onSuggestShares={(n) => set({ plannedShares: String(n) })}
              onSuggestStop={(p) => set({ stopPrice: String(p) })}
            />

            <div className="grid gap-2">
              <Label htmlFor="plan-thesis">Thesis — why enter</Label>
              <textarea
                id="plan-thesis"
                rows={2}
                className={textareaClass}
                placeholder="What makes this worth the risk?"
                value={form.thesis}
                onChange={(e) => set({ thesis: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="plan-invalidation">Invalidation — what proves you wrong</Label>
              <textarea
                id="plan-invalidation"
                rows={2}
                className={textareaClass}
                placeholder="Not the stop price — the condition that kills the thesis."
                value={form.invalidation}
                onChange={(e) => set({ invalidation: e.target.value })}
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            )}

            {savedPlan && (
              <DevilsAdvocatePanel
                loading={devilsAdvocate.isFetching}
                result={devilsAdvocate.data}
                error={aiError}
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {savedPlan ? 'Done' : 'Cancel'}
            </Button>
            <Button type="submit">
              {savedPlan ? 'Save again' : editingPlan ? 'Save changes' : 'Save plan'}
            </Button>
          </DialogFooter>
        </form>
    </>
  );
}

function formFromPlan(plan: TradePlan): typeof EMPTY {
  return {
    symbol: plan.symbol,
    name: plan.name,
    setup: plan.setup,
    entryLow: String(plan.entryLow),
    entryHigh: String(plan.entryHigh),
    stopPrice: String(plan.stopPrice),
    target1: String(plan.target1),
    target2: plan.target2 != null ? String(plan.target2) : '',
    plannedShares: String(plan.plannedShares),
    conviction: String(plan.conviction),
    thesis: plan.thesis,
    invalidation: plan.invalidation,
  };
}

function NumField({
  id, label, value, onChange, step = '0.01',
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; step?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step={step}
        min="0"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
