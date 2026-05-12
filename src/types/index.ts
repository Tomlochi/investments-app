export interface Stock {
  symbol: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  currentPrice?: number;
  purchaseDate?: string;
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
