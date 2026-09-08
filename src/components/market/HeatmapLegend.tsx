import { useSelector } from 'react-redux';
import { bucketColor, BUCKET_ORDER, BUCKET_LABELS } from '../../lib/heatmapColors';
import type { RootState } from '../../store';

/** Always present: the scale is what makes the colors readable without memorising them. */
export function HeatmapLegend() {
  const theme = useSelector((state: RootState) => state.ui.theme);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {BUCKET_ORDER.map(bucket => (
        <div key={bucket} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: bucketColor(bucket, theme) }}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {BUCKET_LABELS[bucket]}
          </span>
        </div>
      ))}
    </div>
  );
}
