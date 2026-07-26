import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Database, Download, Upload, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { addHolding } from '../features/portfolio/portfolioSlice';
import { addTrade } from '../features/journal/journalSlice';
import { toCsv, parseCsv, downloadFile } from '../lib/csv';
import type { RootState, AppDispatch } from '../store';

const BACKUP_KEYS = [
  'portfolio-holdings',
  'journal-entries',
  'watchlist-items',
  'rebalance-targets',
  'cash-state',
  'price-alerts',
  'theme',
] as const;

type ImportStatus = { kind: 'success' | 'error'; message: string } | null;

export function DataPage() {
  const dispatch = useDispatch<AppDispatch>();
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const trades = useSelector((state: RootState) => state.journal.entries);

  const holdingsFileRef = useRef<HTMLInputElement>(null);
  const tradesFileRef = useRef<HTMLInputElement>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus>(null);

  const exportHoldings = () => {
    const csv = toCsv(
      ['symbol', 'name', 'quantity', 'purchasePrice', 'currentPrice', 'thesis'],
      holdings.map(h => [h.symbol, h.name, h.quantity, h.purchasePrice, h.currentPrice, h.thesis])
    );
    downloadFile('holdings.csv', csv, 'text/csv');
  };

  const exportTrades = () => {
    const csv = toCsv(
      ['type', 'symbol', 'name', 'quantity', 'price', 'entryPrice', 'date', 'notes', 'gainLoss', 'gainLossPercent'],
      trades.map(t => [t.type, t.symbol, t.name, t.quantity, t.price, t.entryPrice, t.date, t.notes, t.gainLoss, t.gainLossPercent])
    );
    downloadFile('trades.csv', csv, 'text/csv');
  };

  const exportBackup = () => {
    const data: Record<string, unknown> = {};
    for (const key of BACKUP_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        try {
          data[key] = key === 'theme' ? raw : JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }
    const backup = { app: 'investments-app', version: 1, exportedAt: new Date().toISOString(), data };
    downloadFile(`investments-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
  };

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const importHoldingsCsv = async (file: File) => {
    try {
      const rows = parseCsv(await readFile(file));
      let imported = 0;
      for (const row of rows) {
        const symbol = (row.symbol ?? row.ticker ?? '').toUpperCase();
        const quantity = parseFloat(row.quantity ?? row.shares ?? '');
        const purchasePrice = parseFloat(row.purchaseprice ?? row.avgcost ?? row.costbasis ?? row.price ?? '');
        if (!symbol || !(quantity > 0) || !(purchasePrice > 0)) continue;
        dispatch(addHolding({
          symbol,
          name: row.name ?? symbol,
          quantity,
          purchasePrice,
          thesis: row.thesis || undefined,
        }));
        imported++;
      }
      setStatus(imported > 0
        ? { kind: 'success', message: `Imported ${imported} holding${imported === 1 ? '' : 's'} (merged with existing positions).` }
        : { kind: 'error', message: 'No valid rows found. Expected columns: symbol, quantity, purchasePrice (name, thesis optional).' });
    } catch (e) {
      console.error('Holdings import error:', e);
      setStatus({ kind: 'error', message: 'Could not read that file.' });
    }
  };

  const importTradesCsv = async (file: File) => {
    try {
      const rows = parseCsv(await readFile(file));
      let imported = 0;
      for (const row of rows) {
        const type = (row.type ?? '').toLowerCase();
        const symbol = (row.symbol ?? row.ticker ?? '').toUpperCase();
        const quantity = parseFloat(row.quantity ?? row.shares ?? '');
        const price = parseFloat(row.price ?? '');
        const date = row.date ?? '';
        if ((type !== 'buy' && type !== 'sell') || !symbol || !(quantity > 0) || !(price > 0) || !date) continue;
        const entryPrice = parseFloat(row.entryprice ?? '') || price;
        const gainLoss = type === 'sell' ? (price - entryPrice) * quantity : undefined;
        dispatch(addTrade({
          type,
          symbol,
          name: row.name ?? symbol,
          quantity,
          price,
          entryPrice,
          date,
          notes: row.notes || undefined,
          gainLoss,
          gainLossPercent: gainLoss != null && entryPrice > 0 ? ((price - entryPrice) / entryPrice) * 100 : undefined,
        }));
        imported++;
      }
      setStatus(imported > 0
        ? { kind: 'success', message: `Imported ${imported} trade${imported === 1 ? '' : 's'} into the journal. Holdings were not changed.` }
        : { kind: 'error', message: 'No valid rows found. Expected columns: type (buy/sell), symbol, quantity, price, date (name, entryPrice, notes optional).' });
    } catch (e) {
      console.error('Trades import error:', e);
      setStatus({ kind: 'error', message: 'Could not read that file.' });
    }
  };

  const restoreBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await readFile(file));
      if (parsed?.app !== 'investments-app' || typeof parsed?.data !== 'object') {
        setStatus({ kind: 'error', message: 'Not a valid backup file from this app.' });
        return;
      }
      const confirmed = window.confirm(
        'Restoring a backup replaces ALL current data (holdings, journal, watchlist, targets, cash, alerts). Continue?'
      );
      if (!confirmed) return;
      for (const key of BACKUP_KEYS) {
        if (key in parsed.data) {
          const value = parsed.data[key];
          localStorage.setItem(key, key === 'theme' ? String(value) : JSON.stringify(value));
        }
      }
      window.location.reload();
    } catch (e) {
      console.error('Backup restore error:', e);
      setStatus({ kind: 'error', message: 'Could not read that backup file.' });
    }
  };

  const handleFile = (handler: (f: File) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handler(file);
      e.target.value = '';
    };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data</h1>
      </div>

      {status && (
        <p className={`text-sm ${status.kind === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {status.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportHoldings} disabled={holdings.length === 0}>
              Holdings CSV ({holdings.length})
            </Button>
            <Button variant="outline" size="sm" onClick={exportTrades} disabled={trades.length === 0}>
              Trades CSV ({trades.length})
            </Button>
            <Button size="sm" onClick={exportBackup}>
              Full backup (JSON)
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            All your data lives in this browser's localStorage — download a backup regularly. The JSON backup includes holdings, journal, watchlist, rebalance targets, cash, and alerts.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input ref={holdingsFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile(importHoldingsCsv)} />
            <input ref={tradesFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile(importTradesCsv)} />
            <input ref={backupFileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile(restoreBackup)} />
            <Button variant="outline" size="sm" onClick={() => holdingsFileRef.current?.click()}>
              Import holdings CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => tradesFileRef.current?.click()}>
              Import trades CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => backupFileRef.current?.click()}>
              Restore backup JSON
            </Button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>Holdings CSV needs columns: <code className="text-gray-700 dark:text-gray-300">symbol, quantity, purchasePrice</code> (optional: name, thesis). Imported positions merge with existing ones.</p>
            <p>Trades CSV needs: <code className="text-gray-700 dark:text-gray-300">type, symbol, quantity, price, date</code> (optional: name, entryPrice, notes). Rows go into the journal only.</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
            <FileWarning className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Restoring a backup replaces everything currently in the app. Export a backup of the current state first if you're not sure.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
