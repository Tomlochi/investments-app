import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetQuoteQuery } from '../../services/stockApi';
import { markTriggered } from '../../features/alerts/alertsSlice';
import { formatCurrency } from '../../lib/utils';
import type { RootState, AppDispatch } from '../../store';
import type { PriceAlert } from '../../types';

function notifyBrowser(alert: PriceAlert, price: number) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification(`${alert.symbol} price alert`, {
    body: `${alert.symbol} is ${formatCurrency(price)} — ${alert.condition} your ${formatCurrency(alert.targetPrice)} target.`,
  });
}

function SymbolWatcher({ symbol, alerts }: { symbol: string; alerts: PriceAlert[] }) {
  const dispatch = useDispatch<AppDispatch>();
  const { data: quote } = useGetQuoteQuery(symbol, { pollingInterval: 60000 });

  useEffect(() => {
    const price = quote?.regularMarketPrice;
    if (!price) return;
    for (const alert of alerts) {
      const hit = alert.condition === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
      if (hit) {
        dispatch(markTriggered({ id: alert.id, price }));
        notifyBrowser(alert, price);
      }
    }
  }, [quote, alerts, dispatch]);

  return null;
}

// Mounted once in App: polls quotes for symbols with active alerts and fires notifications
export function AlertWatcher() {
  const alerts = useSelector((state: RootState) => state.alerts.alerts);

  const activeBySymbol = useMemo(() => {
    const map = new Map<string, PriceAlert[]>();
    for (const alert of alerts) {
      if (alert.triggeredAt) continue;
      map.set(alert.symbol, [...(map.get(alert.symbol) ?? []), alert]);
    }
    return map;
  }, [alerts]);

  // Ask for notification permission once there is something to watch
  useEffect(() => {
    if (activeBySymbol.size > 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [activeBySymbol.size]);

  return (
    <>
      {[...activeBySymbol.entries()].map(([symbol, symbolAlerts]) => (
        <SymbolWatcher key={symbol} symbol={symbol} alerts={symbolAlerts} />
      ))}
    </>
  );
}
