import { Gauge } from 'lucide-react';
import { ScorecardPanel } from '../components/performance/ScorecardPanel';
import { SetupBreakdown } from '../components/performance/SetupBreakdown';
import { GradeTrend } from '../components/performance/GradeTrend';

export function PerformancePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <Gauge className="h-6 w-6" />
          Performance
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Measured in R, so a big position and a small one count the same. What is being judged here
          is your process, not your luck.
        </p>
      </div>

      <ScorecardPanel />
      <SetupBreakdown />
      <GradeTrend />
    </div>
  );
}
