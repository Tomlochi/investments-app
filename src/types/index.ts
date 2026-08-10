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

export type PlanStatus = 'idea' | 'open' | 'closed';
export type SetupType = 'breakout' | 'pullback' | 'earnings' | 'value' | 'core-add' | 'other';
export type ExitReason = 'stop-hit' | 'target-hit' | 'thesis-broken' | 'discretionary';

export interface ProcessGrade {
  score: number;
  followedPlan: string[];
  brokePlan: string[];
  lesson: string;
  timestamp: string;
}

export interface TradePlan {
  id: string;
  symbol: string;
  name: string;
  status: PlanStatus;
  setup: SetupType;
  thesis: string;
  invalidation: string;
  entryLow: number;
  entryHigh: number;
  /** Live stop. May be raised while the plan is open. */
  stopPrice: number;
  target1: number;
  target2?: number;
  plannedShares: number;
  riskPercent: number;
  conviction: 1 | 2 | 3 | 4 | 5;
  createdAt: string;

  actualEntryPrice?: number;
  actualShares?: number;
  /** Snapshot of stopPrice at open. Never mutated. All R math uses this. */
  initialStopPrice?: number;
  openedAt?: string;

  actualExitPrice?: number;
  closedAt?: string;
  exitReason?: ExitReason;
  grade?: ProcessGrade;
}

export interface TradeSettings {
  riskPerTradePercent: number;
  maxPositionPercent: number;
}

export interface Indicators {
  atr14: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  fiftyTwoWeekPosition: number | null;
}

export interface DevilsAdvocateRequest {
  plan: {
    symbol: string;
    name: string;
    setup: string;
    thesis: string;
    invalidation: string;
    entryHigh: number;
    stopPrice: number;
    target1: number;
    shares: number;
    conviction: number;
  };
  checkFlags: string[];
  holdings: { symbol: string; quantity: number; purchasePrice: number; currentPrice?: number }[];
  cashBalance: number;
  openPlans: { symbol: string; setup: string; thesis: string }[];
  /** Most recent graded closes, newest first. Feeds repeatedMistakes. */
  pastLessons: { symbol: string; date: string; setup: string; score: number; lesson: string }[];
  indicators: Indicators | null;
  headlines: { title: string; publisher: string }[];
}

export interface DevilsAdvocateResult {
  verdict: TradeCheckVerdict;
  bearCase: string[];
  planCritique: string[];
  repeatedMistakes: string[];
  timestamp: string;
}

export type ExitAction = 'hold' | 'trim' | 'exit' | 'raise-stop';

export interface ExitAdviceRequest {
  plan: {
    symbol: string;
    name: string;
    setup: string;
    thesis: string;
    invalidation: string;
    entryPrice: number;
    initialStopPrice: number;
    currentStopPrice: number;
    target1: number;
    shares: number;
    openedAt: string;
  };
  currentPrice: number;
  currentR: number | null;
  daysHeld: number;
  indicators: Indicators | null;
  headlines: { title: string; publisher: string }[];
}

export interface ExitAdviceResult {
  action: ExitAction;
  reasoning: string;
  suggestedStop?: number;
  timestamp: string;
}

export interface ProcessGradeRequest {
  plan: {
    symbol: string;
    name: string;
    setup: string;
    thesis: string;
    invalidation: string;
    entryHigh: number;
    initialStopPrice: number;
    target1: number;
    plannedShares: number;
    conviction: number;
  };
  execution: {
    actualEntryPrice: number;
    actualShares: number;
    actualExitPrice: number;
    exitReason: ExitReason;
    daysHeld: number;
    realizedR: number | null;
  };
}
