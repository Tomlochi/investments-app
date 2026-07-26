import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Sparkles, Loader2, Lightbulb, ThumbsUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { getJournalCoach } from '../../lib/claude';
import type { RootState } from '../../store';
import type { JournalCoachResult } from '../../types';

const MIN_TRADES = 3;

export function JournalCoach() {
  const entries = useSelector((state: RootState) => state.journal.entries);
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const [result, setResult] = useState<JournalCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(false);
    try {
      const coach = await getJournalCoach({
        trades: entries.slice(0, 50).map(t => ({
          type: t.type,
          symbol: t.symbol,
          quantity: t.quantity,
          price: t.price,
          date: t.date,
          notes: t.notes,
          gainLoss: t.gainLoss,
          gainLossPercent: t.gainLossPercent,
        })),
        holdings: holdings.map(h => ({
          symbol: h.symbol,
          quantity: h.quantity,
          purchasePrice: h.purchasePrice,
          currentPrice: h.currentPrice,
        })),
      });
      setResult(coach);
    } catch (e) {
      console.error('Journal coach error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (entries.length < MIN_TRADES) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          AI Trading Coach
        </CardTitle>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleAnalyze} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? 'Analyzing...' : result ? 'Re-analyze' : 'Analyze my trading'}
        </Button>
      </CardHeader>
      <CardContent>
        {!result && !loading && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Claude reviews your {entries.length} logged trades for behavioral patterns — what you tend to get right, and habits that may be costing you money.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">Analysis failed. Check your API key and try again.</p>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">{result.summary}</p>

            {result.patterns.length > 0 && (
              <div className="space-y-3">
                {result.patterns.map((p, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-900/15">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">{p.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.evidence}</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1.5">
                      <span className="font-medium">Try this: </span>{p.advice}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {result.strengths.length > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50/60 p-3 dark:border-green-900/50 dark:bg-green-900/15">
                <div className="flex items-center gap-1.5 mb-1">
                  <ThumbsUp className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                  <span className="text-sm font-semibold text-green-800 dark:text-green-300">Keep doing</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500">
              AI-generated observations from your journal, not professional financial advice.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
