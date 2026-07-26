import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Sparkles, Loader2, NotebookPen, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { getThesisCheck } from '../../lib/claude';
import { openEditHoldingModal } from '../../features/ui/uiSlice';
import type { AppDispatch } from '../../store';
import type { Stock, ThesisCheckResult } from '../../types';

const STATUS_STYLES = {
  intact: {
    icon: CheckCircle2,
    label: 'Thesis intact',
    box: 'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-300',
  },
  watch: {
    icon: AlertCircle,
    label: 'Worth watching',
    box: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20',
    text: 'text-amber-800 dark:text-amber-300',
  },
  broken: {
    icon: XCircle,
    label: 'Thesis may be broken',
    box: 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-300',
  },
} as const;

export function ThesisCard({ holding, currentPrice }: { holding: Stock; currentPrice: number }) {
  const dispatch = useDispatch<AppDispatch>();
  const [result, setResult] = useState<ThesisCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleCheck = async () => {
    if (!holding.thesis) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/news?symbols=${encodeURIComponent(holding.symbol)}`);
      const newsMap = res.ok ? await res.json() : {};
      const headlines = newsMap[holding.symbol] ?? [];

      const check = await getThesisCheck({
        symbol: holding.symbol,
        name: holding.name,
        thesis: holding.thesis,
        currentPrice,
        purchasePrice: holding.purchasePrice,
        headlines,
      });
      setResult(check);
    } catch (e) {
      console.error('Thesis check error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-blue-500" />
          Your Thesis
        </CardTitle>
        {holding.thesis && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCheck} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? 'Checking...' : 'Check against news'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {holding.thesis ? (
          <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{holding.thesis}"</p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No thesis recorded. Write down why you own {holding.symbol} — the AI can then flag when your reasoning stops holding up.
            </p>
            <Button size="sm" variant="outline" onClick={() => dispatch(openEditHoldingModal(holding.symbol))}>
              Add thesis
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">Check failed. Try again in a moment.</p>
        )}

        {result && !loading && (() => {
          const style = STATUS_STYLES[result.status];
          return (
            <div className={`rounded-lg border p-3 ${style.box}`}>
              <div className={`flex items-center gap-1.5 font-semibold text-sm mb-1 ${style.text}`}>
                <style.icon className="h-4 w-4" />
                {style.label}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{result.assessment}</p>
              {result.developments.length > 0 && (
                <ul className="list-disc pl-5 mt-2 space-y-0.5">
                  {result.developments.map((d, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400">{d}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
