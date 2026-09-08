import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetQuoteQuery } from '../../services/stockApi';
import { markStopBreached } from '../../features/portfolio/portfolioSlice';
import { findBreachedHoldings } from '../../lib/stopRisk';
import { formatCurrency } from '../../lib/utils';
import type { RootState, AppDispatch } from '../../store';
import type { Stock } from '../../types';

function notifyBreach(holding: Stock, price: number) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification(`${holding.symbol} broke your stop`, {
    body: `${formatCurrency(price)} — your stop is ${formatCurrency(holding.stopPrice ?? 0)}.`,
  });
}

function SymbolStopWatcher({ holding }: { holding: Stock }) {
  const dispatch = useDispatch<AppDispatch>();
  const { data: quote } = useGetQuoteQuery(holding.symbol, { pollingInterval: 60000 });

  useEffect(() => {
    const price = quote?.regularMarketPrice;
    if (price == null) return;

    // One-element call: the shared helper keeps the at-or-below rule in a single tested place.
    const breaches = findBreachedHoldings([holding], { [holding.symbol]: price });
    if (breaches.length === 0) return;

    // The reducer ignores a repeat breach, so this stays a no-op until the stop changes.
    if (!holding.stopBreachedAt) {
      notifyBreach(holding, price);
    }
    dispatch(markStopBreached({ symbol: holding.symbol, price }));
  }, [quote, holding, dispatch]);

  return null;
}

// Mounted once in App: polls quotes for every holding with a stop and flags breaches.
export function StopWatcher() {
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const watched = useMemo(() => holdings.filter(h => h.stopPrice != null), [holdings]);

  // Ask for notification permission once there is something to watch
  useEffect(() => {
    if (watched.length > 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [watched.length]);

  return (
    <>
      {watched.map(h => (
        <SymbolStopWatcher key={h.symbol} holding={h} />
      ))}
    </>
  );
}
