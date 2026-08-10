import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import YahooFinance from 'yahoo-finance2';
import { sma, rsi14, atr14, fiftyTwoWeekPosition } from './server/indicators.js';
const yahooFinance = new YahooFinance();

const app = express();
const PORT = 3001;

// Only accept requests from the local Vite dev server
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Valid stock symbol: 1–15 uppercase letters, digits, dots, hyphens, or ^ (for indices)
const SYMBOL_RE = /^[A-Z0-9.\-^]{1,15}$/i;

function validateSymbol(symbol) {
  return typeof symbol === 'string' && SYMBOL_RE.test(symbol);
}

// Get stock quote
app.get('/api/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;
  if (!validateSymbol(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol.' });
  }
  try {
    const quote = await yahooFinance.quote(symbol);
    res.json({
      symbol: quote.symbol,
      shortName: quote.shortName || quote.symbol,
      longName: quote.longName,
      regularMarketPrice: quote.regularMarketPrice || 0,
      regularMarketChange: quote.regularMarketChange || 0,
      regularMarketChangePercent: quote.regularMarketChangePercent || 0,
      regularMarketVolume: quote.regularMarketVolume || 0,
      marketCap: quote.marketCap,
      regularMarketDayHigh: quote.regularMarketDayHigh,
      regularMarketDayLow: quote.regularMarketDayLow,
      regularMarketOpen: quote.regularMarketOpen,
      regularMarketPreviousClose: quote.regularMarketPreviousClose,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
    });
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({ error: 'Failed to fetch quote.' });
  }
});

// Get historical data
app.get('/api/historical/:symbol', async (req, res) => {
  const { symbol } = req.params;
  if (!validateSymbol(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol.' });
  }
  try {
    const { range = '1mo' } = req.query;

    const periodMap = {
      '1d': { period1: new Date(Date.now() - 24 * 60 * 60 * 1000), interval: '5m' },
      '5d': { period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), interval: '1h' },
      '1mo': { period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), interval: '1d' },
      '3mo': { period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), interval: '1d' },
      '6mo': { period1: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), interval: '1d' },
      '1y': { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), interval: '1d' },
      '5y': { period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), interval: '1d' },
    };

    const { period1, interval } = periodMap[range] || periodMap['1mo'];
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2: new Date(),
      interval,
    });

    const data = result.quotes.map((q) => ({
      date: q.date.toISOString(),
      open: q.open || 0,
      high: q.high || 0,
      low: q.low || 0,
      close: q.close || 0,
      volume: q.volume || 0,
    }));

    res.json(data);
  } catch (error) {
    console.error('Historical error:', error);
    res.status(500).json({ error: 'Failed to fetch historical data.' });
  }
});

// Search stocks
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json([]);
    }
    if (q.length > 50) {
      return res.status(400).json({ error: 'Query too long.' });
    }

    const results = await yahooFinance.search(q, {}, { validateResult: false });
    const quotes = results.quotes
      .filter((quote) => quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF')
      .slice(0, 10)
      .map((quote) => ({
        symbol: quote.symbol,
        shortname: quote.shortname,
        longname: quote.longname,
        exchange: quote.exchange || '',
        quoteType: quote.quoteType || '',
      }));

    res.json(quotes);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// Sector/industry/beta per symbol; cached 24h since profiles rarely change
const profileCache = new Map();
const PROFILE_TTL = 24 * 60 * 60 * 1000;

const indicatorCache = new Map();
const INDICATOR_TTL = 24 * 60 * 60 * 1000;

app.get('/api/profile-batch', async (req, res) => {
  const { symbols } = req.query;
  if (!symbols || typeof symbols !== 'string') {
    return res.status(400).json({ error: 'symbols parameter required.' });
  }

  const symbolList = [...new Set(symbols.split(',').map(s => s.trim()).filter(validateSymbol))].slice(0, 25);
  if (symbolList.length === 0) {
    return res.status(400).json({ error: 'No valid symbols provided.' });
  }

  try {
    const entries = [];
    for (const symbol of symbolList) {
      const cached = profileCache.get(symbol);
      if (cached && Date.now() - cached.at < PROFILE_TTL) {
        entries.push([symbol, cached.profile]);
        continue;
      }
      try {
        const qs = await yahooFinance.quoteSummary(symbol, {
          modules: ['assetProfile', 'summaryDetail'],
        });
        const profile = {
          symbol,
          sector: qs.assetProfile?.sector,
          industry: qs.assetProfile?.industry,
          beta: qs.summaryDetail?.beta,
        };
        profileCache.set(symbol, { profile, at: Date.now() });
        entries.push([symbol, profile]);
      } catch (err) {
        console.error(`Profile error for ${symbol}:`, err.message);
        entries.push([symbol, { symbol }]);
      }
      if (entries.length < symbolList.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    res.json(Object.fromEntries(entries));
  } catch (error) {
    console.error('Profile batch error:', error);
    res.status(500).json({ error: 'Failed to fetch profiles.' });
  }
});

// Get daily close history for a comma-separated list of symbols (portfolio history chart)
app.get('/api/history-batch', async (req, res) => {
  const { symbols, range = '1y' } = req.query;
  if (!symbols || typeof symbols !== 'string') {
    return res.status(400).json({ error: 'symbols parameter required.' });
  }

  const symbolList = [...new Set(symbols.split(',').map(s => s.trim()).filter(validateSymbol))].slice(0, 25);
  if (symbolList.length === 0) {
    return res.status(400).json({ error: 'No valid symbols provided.' });
  }

  const periodMap = {
    '1mo': 30,
    '3mo': 90,
    '6mo': 180,
    '1y': 365,
    '5y': 5 * 365,
  };
  const days = periodMap[range] || periodMap['1y'];
  const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const entries = await Promise.all(
      symbolList.map(async (symbol) => {
        try {
          const result = await yahooFinance.chart(symbol, {
            period1,
            period2: new Date(),
            interval: '1d',
          });
          const points = result.quotes
            .filter((q) => q.close != null)
            .map((q) => ({ date: q.date.toISOString().slice(0, 10), close: q.close }));
          return [symbol, points];
        } catch (err) {
          console.error(`History error for ${symbol}:`, err.message);
          return [symbol, []];
        }
      })
    );
    res.json(Object.fromEntries(entries));
  } catch (error) {
    console.error('History batch error:', error);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

// Technical indicators for one symbol, derived from one year of daily bars.
app.get('/api/indicators/:symbol', async (req, res) => {
  const { symbol } = req.params;
  if (!validateSymbol(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol.' });
  }

  const cached = indicatorCache.get(symbol);
  if (cached && Date.now() - cached.at < INDICATOR_TTL) {
    return res.json(cached.indicators);
  }

  try {
    const period1 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2: new Date(),
      interval: '1d',
    });

    const bars = result.quotes.filter(
      (q) => q.close != null && q.high != null && q.low != null
    );
    const closes = bars.map((b) => b.close);

    const indicators = {
      atr14: atr14(bars),
      sma20: sma(closes, 20),
      sma50: sma(closes, 50),
      sma200: sma(closes, 200),
      rsi14: rsi14(closes),
      fiftyTwoWeekPosition: fiftyTwoWeekPosition(closes),
    };

    indicatorCache.set(symbol, { indicators, at: Date.now() });
    res.json(indicators);
  } catch (error) {
    console.error(`Indicators error for ${symbol}:`, error.message);
    res.status(500).json({ error: 'Failed to compute indicators.' });
  }
});

// Get news headlines for a comma-separated list of symbols
app.get('/api/news', async (req, res) => {
  const { symbols } = req.query;
  if (!symbols || typeof symbols !== 'string') {
    return res.status(400).json({ error: 'symbols parameter required.' });
  }

  const symbolList = symbols.split(',').map(s => s.trim()).filter(validateSymbol).slice(0, 20);
  if (symbolList.length === 0) {
    return res.status(400).json({ error: 'No valid symbols provided.' });
  }

  try {
    const entries = [];
    for (const symbol of symbolList) {
      const result = await yahooFinance.search(symbol, {}, { validateResult: false });
      const headlines = (result.news || [])
        .slice(0, 5)
        .map((n) => ({ title: n.title, publisher: n.publisher || '' }));
      entries.push([symbol, headlines]);
      // small pause between requests to avoid Yahoo Finance rate-limiting
      if (entries.length < symbolList.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    res.json(Object.fromEntries(entries));
  } catch (error) {
    console.error('News error:', error);
    res.status(500).json({ error: 'Failed to fetch news.' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
