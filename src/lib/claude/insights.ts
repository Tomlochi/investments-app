import { anthropic, sanitize, MODEL, parseJsonResponse } from './client';
import { INSIGHT_SCHEMA, DAILY_BRIEF_SCHEMA } from './schemas';
import type {
  StockInsightRequest,
  PortfolioInsightRequest,
  AIInsight,
  InsightSentiment,
  DailyBriefResponse,
} from '../../types';

interface InsightPayload {
  content: string;
  sentiment: InsightSentiment;
  confidence: number;
  keyPoints: string[];
}

/** max_tokens covers thinking and response together, so it sits well above the prose length. */
const INSIGHT_MAX_TOKENS = 2048;

export async function getStockInsight(request: StockInsightRequest): Promise<AIInsight> {
  const name = sanitize(request.name);
  const symbol = sanitize(request.symbol, 15);
  const prompt = `Analyze this stock for an investor:

Stock: ${name} (${symbol})
Current Price: $${request.currentPrice.toFixed(2)}
Daily Change: ${request.changePercent >= 0 ? '+' : ''}${request.changePercent.toFixed(2)}%
${request.quantity ? `Holdings: ${request.quantity} shares at $${request.purchasePrice?.toFixed(2)} avg cost` : ''}

Provide a concise investment analysis including:
1. Brief market sentiment assessment (bullish/bearish/neutral)
2. Key factors affecting this stock currently
3. Risk considerations
4. 3-5 key points for investors

Keep the response under 300 words. Be specific and actionable.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: INSIGHT_MAX_TOKENS,
    output_config: {
      format: { type: 'json_schema', schema: INSIGHT_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<InsightPayload>(response);

  return {
    type: 'stock',
    symbol: request.symbol,
    content: parsed.content,
    sentiment: parsed.sentiment,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    keyPoints: parsed.keyPoints.slice(0, 5),
    timestamp: new Date().toISOString(),
  };
}

export async function getPortfolioInsight(request: PortfolioInsightRequest): Promise<AIInsight> {
  const holdingsSummary = request.holdings
    .map(h => `- ${sanitize(h.symbol, 15)}: ${h.quantity} shares, ${(h.weight * 100).toFixed(1)}% of portfolio, ${((h.currentPrice - h.purchasePrice) / h.purchasePrice * 100).toFixed(1)}% gain/loss`)
    .join('\n');

  const prompt = `Analyze this investment portfolio:

Portfolio Summary:
Total Value: $${request.totalValue.toFixed(2)}
Total Gain/Loss: $${request.totalGain.toFixed(2)} (${request.totalGainPercent >= 0 ? '+' : ''}${request.totalGainPercent.toFixed(2)}%)

Holdings:
${holdingsSummary}

Provide a portfolio analysis including:
1. Overall portfolio health assessment
2. Diversification analysis
3. Risk assessment
4. Rebalancing suggestions if applicable
5. 3-5 key recommendations

Keep the response under 400 words. Be specific and actionable.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: INSIGHT_MAX_TOKENS,
    output_config: {
      format: { type: 'json_schema', schema: INSIGHT_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<InsightPayload>(response);

  return {
    type: 'portfolio',
    content: parsed.content,
    sentiment: parsed.sentiment,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    keyPoints: parsed.keyPoints.slice(0, 5),
    timestamp: new Date().toISOString(),
  };
}

export async function getDailyBrief(
  holdings: { symbol: string; name: string }[],
  newsMap: Record<string, { title: string; publisher: string }[]>
): Promise<DailyBriefResponse> {
  const stocksSection = holdings
    .map((h) => {
      const sym = sanitize(h.symbol, 15);
      const name = sanitize(h.name);
      const headlines = (newsMap[h.symbol] ?? []);
      const lines = headlines.length > 0
        ? headlines.map((n) => `  - "${sanitize(n.title, 200)}" (${sanitize(n.publisher, 60)})`).join('\n')
        : '  - No recent news available';
      return `[${sym}] ${name}\n${lines}`;
    })
    .join('\n\n');

  const prompt = `You are a financial news analyst producing a quick daily brief for an investor.

Portfolio stocks and their latest news headlines:
${stocksSection}

Give one brief per stock, focused on the most market-moving headline for it. Where a stock has no news, say so briefly. Then summarise the overall mood across the portfolio today.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    output_config: {
      format: { type: 'json_schema', schema: DAILY_BRIEF_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<DailyBriefResponse, 'timestamp'>>(response);

  return { ...parsed, timestamp: new Date().toISOString() };
}
