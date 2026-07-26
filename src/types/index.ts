export interface Stock {
  symbol: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  currentPrice?: number;
  purchaseDate?: string;
  thesis?: string;
}

export interface Portfolio {
  stocks: Stock[];
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
}

export interface StockQuote {
  symbol: string;
  shortName: string;
  longName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketCap?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange: string;
  quoteType: string;
}

export type InsightSentiment = 'bullish' | 'bearish' | 'neutral';

export interface AIInsight {
  type: 'stock' | 'portfolio';
  symbol?: string;
  content: string;
  sentiment: InsightSentiment;
  confidence: number;
  keyPoints: string[];
  timestamp: string;
}

export interface StockBriefItem {
  symbol: string;
  brief: string;
  sentiment: InsightSentiment;
}

export interface DailyBriefResponse {
  overallSummary: string;
  stocks: StockBriefItem[];
  timestamp: string;
}

export interface TradeEntry {
  id: string;
  type: 'buy' | 'sell';
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  entryPrice: number;
  date: string;
  notes?: string;
  gainLoss?: number;
  gainLossPercent?: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PortfolioChatContext {
  holdings: {
    symbol: string;
    name: string;
    quantity: number;
    purchasePrice: number;
    currentPrice?: number;
  }[];
  trades: {
    type: 'buy' | 'sell';
    symbol: string;
    quantity: number;
    price: number;
    date: string;
    notes?: string;
  }[];
  watchlist: string[];
}

export interface RebalanceTarget {
  symbol: string;
  targetPercent: number;
}

export interface RebalanceAction {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  shares: number;
  estimatedAmount: number;
  reason: string;
}

export interface RebalancePlan {
  summary: string;
  actions: RebalanceAction[];
  warnings: string[];
  timestamp: string;
}

export interface RebalancePlanRequest {
  holdings: {
    symbol: string;
    name: string;
    quantity: number;
    currentPrice: number;
    currentPercent: number;
    targetPercent: number;
  }[];
  totalValue: number;
  cashBalance: number;
  cashTargetPercent: number;
}

export interface CashTransaction {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  date: string;
  note?: string;
}

export type AlertCondition = 'above' | 'below';

export interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  condition: AlertCondition;
  targetPrice: number;
  createdAt: string;
  triggeredAt: string | null;
  triggeredPrice?: number;
}

export type TradeCheckVerdict = 'proceed' | 'caution' | 'reconsider';

export interface TradeCheckRequest {
  trade: {
    type: 'buy' | 'sell';
    symbol: string;
    name: string;
    quantity: number;
    price: number;
    notes?: string;
  };
  holdings: {
    symbol: string;
    quantity: number;
    purchasePrice: number;
    currentPrice?: number;
  }[];
  recentTrades: {
    type: 'buy' | 'sell';
    symbol: string;
    quantity: number;
    price: number;
    date: string;
    notes?: string;
  }[];
  cashBalance: number;
}

export interface TradeCheckResult {
  verdict: TradeCheckVerdict;
  assessment: string;
  considerations: string[];
  timestamp: string;
}

export interface HistoryPoint {
  date: string;
  close: number;
}

export type HistoryBatchResponse = Record<string, HistoryPoint[]>;

export interface StockProfile {
  symbol: string;
  sector?: string;
  industry?: string;
  beta?: number;
}

export type ProfileBatchResponse = Record<string, StockProfile>;

export interface JournalCoachRequest {
  trades: {
    type: 'buy' | 'sell';
    symbol: string;
    quantity: number;
    price: number;
    date: string;
    notes?: string;
    gainLoss?: number;
    gainLossPercent?: number;
  }[];
  holdings: {
    symbol: string;
    quantity: number;
    purchasePrice: number;
    currentPrice?: number;
  }[];
}

export interface JournalCoachResult {
  summary: string;
  patterns: {
    title: string;
    evidence: string;
    advice: string;
  }[];
  strengths: string[];
  timestamp: string;
}

export type ThesisStatus = 'intact' | 'watch' | 'broken';

export interface ThesisCheckRequest {
  symbol: string;
  name: string;
  thesis: string;
  currentPrice: number;
  purchasePrice: number;
  headlines: { title: string; publisher: string }[];
}

export interface ThesisCheckResult {
  status: ThesisStatus;
  assessment: string;
  developments: string[];
  timestamp: string;
}

export interface StockInsightRequest {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  quantity?: number;
  purchasePrice?: number;
}

export interface PortfolioInsightRequest {
  holdings: {
    symbol: string;
    name: string;
    quantity: number;
    purchasePrice: number;
    currentPrice: number;
    weight: number;
  }[];
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
}
