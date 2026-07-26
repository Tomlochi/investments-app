import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ShieldAlert, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useGetProfileBatchQuery } from '../../services/stockApi';
import { cn } from '../../lib/utils';
import type { RootState } from '../../store';

const CONCENTRATION_LIMIT = 25; // single position, % of holdings value
const SECTOR_LIMIT = 50; // single sector, % of holdings value

export function RiskPanel() {
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const theme = useSelector((state: RootState) => state.ui.theme);

  const symbols = useMemo(() => holdings.map(h => h.symbol).sort(), [holdings]);
  const { data: profiles, isLoading } = useGetProfileBatchQuery(symbols, { skip: symbols.length === 0 });

  const analysis = useMemo(() => {
    if (!profiles || holdings.length === 0) return null;

    const totalValue = holdings.reduce((sum, h) => sum + h.quantity * (h.currentPrice ?? h.purchasePrice), 0);
    if (totalValue <= 0) return null;

    const positions = holdings.map(h => ({
      symbol: h.symbol,
      weight: (h.quantity * (h.currentPrice ?? h.purchasePrice)) / totalValue,
      sector: profiles[h.symbol]?.sector,
      beta: profiles[h.symbol]?.beta,
    }));

    const sectorMap = new Map<string, number>();
    for (const p of positions) {
      const sector = p.sector ?? 'Unknown';
      sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + p.weight);
    }
    const sectors = [...sectorMap.entries()]
      .map(([name, weight]) => ({ name, percent: weight * 100 }))
      .sort((a, b) => b.percent - a.percent);

    // Weighted beta over the positions that have one, rescaled to their combined weight
    const withBeta = positions.filter(p => p.beta != null);
    const betaWeight = withBeta.reduce((sum, p) => sum + p.weight, 0);
    const portfolioBeta = betaWeight > 0
      ? withBeta.reduce((sum, p) => sum + p.weight * (p.beta as number), 0) / betaWeight
      : null;

    const warnings: string[] = [];
    for (const p of positions) {
      if (p.weight * 100 > CONCENTRATION_LIMIT) {
        warnings.push(`${p.symbol} is ${(p.weight * 100).toFixed(0)}% of your holdings — a single-stock event moves your whole portfolio.`);
      }
    }
    const topSector = sectors[0];
    if (topSector && topSector.name !== 'Unknown' && topSector.percent > SECTOR_LIMIT) {
      warnings.push(`${topSector.name} is ${topSector.percent.toFixed(0)}% of your holdings — you're heavily exposed to one sector.`);
    }
    if (holdings.length > 0 && holdings.length < 5) {
      warnings.push(`Only ${holdings.length} ${holdings.length === 1 ? 'position' : 'positions'} — broad diversification usually starts around 10+.`);
    }

    return { sectors, portfolioBeta, warnings };
  }, [profiles, holdings]);

  if (holdings.length === 0) return null;

  const barColor = theme === 'dark' ? '#3987e5' : '#2a78d6';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          Risk &amp; Diversification
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !analysis ? (
          <div className="h-24 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Sector allocation</p>
              <div className="space-y-2">
                {analysis.sectors.map(s => (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-0.5">
                      <span className="text-gray-700 dark:text-gray-300">{s.name}</span>
                      <span className="text-gray-500 dark:text-gray-400">{s.percent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.min(100, s.percent)}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Portfolio beta (vs market)</p>
                {analysis.portfolioBeta != null ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analysis.portfolioBeta.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {analysis.portfolioBeta > 1.2
                        ? 'More volatile than the market — expect bigger swings both ways.'
                        : analysis.portfolioBeta < 0.8
                          ? 'More defensive than the market.'
                          : 'Roughly moves with the market.'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Not enough data.</p>
                )}
              </div>

              {analysis.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-400">Concentration warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {analysis.warnings.map((w, i) => (
                      <li key={i} className="text-sm text-amber-800 dark:text-amber-300">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.warnings.length === 0 && (
                <p className={cn('text-sm', 'text-green-700 dark:text-green-400')}>
                  No concentration flags — position and sector sizes look balanced.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
