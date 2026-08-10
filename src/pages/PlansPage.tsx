import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Target } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { PlanCard } from '../components/plans/PlanCard';
import { OpenPlanModal } from '../components/plans/OpenPlanModal';
import { ClosePlanModal } from '../components/plans/ClosePlanModal';
import { openPlanModal } from '../features/ui/uiSlice';
import { setGrade } from '../features/tradeplan/tradePlanSlice';
import { useLazyGetProcessGradeQuery } from '../services/insightsApi';
import { realizedR } from '../lib/planMath';
import type { TradePlan, PlanStatus, ExitReason } from '../types';
import type { RootState, AppDispatch } from '../store';

const EMPTY_COPY: Record<PlanStatus, string> = {
  idea: 'Plans you have written but not entered yet. Write the entry, stop, target and size before the money goes in.',
  open: 'Positions you are currently in with a plan attached. Their stop and target drive the exit advisor.',
  closed: 'Finished trades. Each one gets a process score that ignores profit and judges whether you followed your own plan.',
};

export function PlansPage() {
  const dispatch = useDispatch<AppDispatch>();
  const plans = useSelector((s: RootState) => s.tradePlan.plans);

  const [tab, setTab] = useState<PlanStatus>('idea');
  const [openingPlan, setOpeningPlan] = useState<TradePlan | null>(null);
  const [closingPlan, setClosingPlan] = useState<TradePlan | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const [fetchProcessGrade] = useLazyGetProcessGradeQuery();

  const byStatus = (status: PlanStatus) => plans.filter(p => p.status === status);

  /**
   * Grades a finished trade on process quality. The close has already been
   * committed by this point, so a failure here costs the grade, never the trade.
   */
  const gradePlan = async (
    plan: TradePlan,
    exitPrice = plan.actualExitPrice,
    exitReason = plan.exitReason
  ) => {
    if (
      plan.actualEntryPrice == null ||
      plan.initialStopPrice == null ||
      exitPrice == null ||
      exitReason == null
    ) {
      return;
    }

    setGradingId(plan.id);
    setGradeError(null);
    try {
      const grade = await fetchProcessGrade({
        plan: {
          symbol: plan.symbol,
          name: plan.name,
          setup: plan.setup,
          thesis: plan.thesis,
          invalidation: plan.invalidation,
          entryHigh: plan.entryHigh,
          initialStopPrice: plan.initialStopPrice,
          target1: plan.target1,
          plannedShares: plan.plannedShares,
          conviction: plan.conviction,
        },
        execution: {
          actualEntryPrice: plan.actualEntryPrice,
          actualShares: plan.actualShares ?? plan.plannedShares,
          actualExitPrice: exitPrice,
          exitReason: exitReason as ExitReason,
          daysHeld: Math.round(
            (Date.now() - new Date(plan.openedAt ?? plan.createdAt).getTime()) / 86_400_000
          ),
          realizedR: realizedR(plan.actualEntryPrice, plan.initialStopPrice, exitPrice),
        },
      }).unwrap();

      dispatch(setGrade({ id: plan.id, grade }));
      setTab('closed');
    } catch {
      setGradeError('Grading unavailable. The trade is closed — you can grade it later.');
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Target className="h-6 w-6" />
            Trade Plans
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Decide the exit before the entry. Every closed plan feeds your discipline score.
          </p>
        </div>
        <Button className="gap-2" onClick={() => dispatch(openPlanModal(undefined))}>
          <Plus className="h-4 w-4" />
          New plan
        </Button>
      </div>

      {gradeError && (
        <p className="rounded-md border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          {gradeError}
        </p>
      )}

      <Tabs value={tab} onValueChange={v => setTab(v as PlanStatus)}>
        <TabsList>
          <TabsTrigger value="idea">Ideas ({byStatus('idea').length})</TabsTrigger>
          <TabsTrigger value="open">Open ({byStatus('open').length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({byStatus('closed').length})</TabsTrigger>
        </TabsList>

        {(['idea', 'open', 'closed'] as PlanStatus[]).map(status => (
          <TabsContent key={status} value={status}>
            {byStatus(status).length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {EMPTY_COPY[status]}
              </p>
            ) : (
              <div className="space-y-4">
                {byStatus(status).map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onOpen={setOpeningPlan}
                    onClose={setClosingPlan}
                    onGrade={p => gradePlan(p)}
                    grading={gradingId === plan.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <OpenPlanModal plan={openingPlan} onClose={() => setOpeningPlan(null)} />
      <ClosePlanModal
        plan={closingPlan}
        onClose={() => setClosingPlan(null)}
        onClosed={(plan, exitPrice, exitReason) => gradePlan(plan, exitPrice, exitReason)}
      />
    </div>
  );
}
