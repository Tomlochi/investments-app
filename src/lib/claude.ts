import Anthropic from '@anthropic-ai/sdk';
import type {
  StockInsightRequest,
  PortfolioInsightRequest,
  AIInsight,
  InsightSentiment,
  DailyBriefResponse,
  ChatMessage,
  PortfolioChatContext,
  RebalancePlan,
  RebalancePlanRequest,
  TradeCheckRequest,
  TradeCheckResult,
  JournalCoachRequest,
  JournalCoachResult,
  ThesisCheckRequest,
  ThesisCheckResult,
} from '../types';

// Strip control characters and limit length to prevent prompt injection
function sanitize(value: string, maxLen = 100): string {
  return value.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen);
}

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

function parseInsightResponse(content: string, type: 'stock' | 'portfolio', symbol?: string): AIInsight {
  const lines = content.split('\n').filter(line => line.trim());

  let sentiment: InsightSentiment = 'neutral';
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('bullish') || lowerContent.includes('positive outlook') || lowerContent.includes('strong buy')) {
    sentiment = 'bullish';
  } else if (lowerContent.includes('bearish') || lowerContent.includes('negative outlook') || lowerContent.includes('sell')) {
    sentiment = 'bearish';
  }

  const keyPoints: string[] = [];
  let inKeyPoints = false;
  for (const line of lines) {
    if (line.toLowerCase().includes('key point') || line.startsWith('- ') || line.startsWith('• ')) {
      inKeyPoints = true;
    }
    if (inKeyPoints && (line.startsWith('- ') || line.startsWith('• ') || line.match(/^\d+\./))) {
      keyPoints.push(line.replace(/^[-•\d.]\s*/, '').trim());
    }
  }

  const confidenceMatch = content.match(/confidence[:\s]*(\d+)/i);
  const confidence = confidenceMatch ? Math.min(100, parseInt(confidenceMatch[1])) / 100 : 0.7;

  return {
    type,
    symbol,
    content,
    sentiment,
    confidence,
    keyPoints: keyPoints.slice(0, 5),
    timestamp: new Date().toISOString(),
  };
}

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

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseInsightResponse(content, 'stock', request.symbol);
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

Return ONLY a JSON object in this exact format with no extra text:
{
  "overallSummary": "One sentence capturing the overall mood across the portfolio today.",
  "stocks": [
    { "symbol": "SYMBOL", "brief": "One or two sentences summarising the key story for this stock today.", "sentiment": "bullish" }
  ]
}

Rules:
- sentiment must be one of: bullish, bearish, neutral
- Each brief must be 1-2 sentences, no more
- Focus on the most market-moving headline per stock
- If no news is available for a stock, say so briefly`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    return {
      overallSummary: parsed.overallSummary ?? '',
      stocks: (parsed.stocks ?? []).map((s: { symbol: string; brief: string; sentiment: string }) => ({
        symbol: s.symbol,
        brief: s.brief,
        sentiment: (['bullish', 'bearish', 'neutral'].includes(s.sentiment) ? s.sentiment : 'neutral') as InsightSentiment,
      })),
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      overallSummary: 'Could not generate brief.',
      stocks: holdings.map((h) => ({ symbol: h.symbol, brief: 'Data unavailable.', sentiment: 'neutral' as InsightSentiment })),
      timestamp: new Date().toISOString(),
    };
  }
}

function buildChatSystemPrompt(context: PortfolioChatContext): string {
  const holdingsSection = context.holdings.length > 0
    ? context.holdings
        .map(h => {
          const value = h.currentPrice != null ? ` (current $${h.currentPrice.toFixed(2)}, value $${(h.currentPrice * h.quantity).toFixed(2)})` : '';
          return `- ${sanitize(h.symbol, 15)}: ${h.quantity} shares at $${h.purchasePrice.toFixed(2)} avg cost${value}`;
        })
        .join('\n')
    : 'No holdings yet.';

  const tradesSection = context.trades.length > 0
    ? context.trades
        .slice(0, 30)
        .map(t => `- ${t.date.slice(0, 10)}: ${t.type.toUpperCase()} ${t.quantity} ${sanitize(t.symbol, 15)} @ $${t.price.toFixed(2)}${t.notes ? ` — "${sanitize(t.notes, 200)}"` : ''}`)
        .join('\n')
    : 'No trades logged.';

  const watchlistSection = context.watchlist.length > 0
    ? context.watchlist.map(s => sanitize(s, 15)).join(', ')
    : 'Empty.';

  return `You are a portfolio assistant inside a personal investment tracking app. Answer the user's questions about their portfolio using the data below. Be direct and specific — reference their actual holdings and numbers. When giving opinions, note that this is not professional financial advice. Keep responses focused and under 250 words unless the user asks for detail.

CURRENT HOLDINGS:
${holdingsSection}

TRADE JOURNAL (most recent first):
${tradesSection}

WATCHLIST: ${watchlistSection}`;
}

export async function chatWithPortfolio(
  messages: ChatMessage[],
  context: PortfolioChatContext
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: buildChatSystemPrompt(context),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
}

const REBALANCE_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two or three sentence overview of the rebalancing plan.' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          action: { type: 'string', enum: ['buy', 'sell', 'hold'] },
          shares: { type: 'number', description: 'Number of shares to trade; 0 for hold.' },
          estimatedAmount: { type: 'number', description: 'Approximate dollar amount of the trade; 0 for hold.' },
          reason: { type: 'string', description: 'One sentence explaining this action.' },
        },
        required: ['symbol', 'action', 'shares', 'estimatedAmount', 'reason'],
        additionalProperties: false,
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Risks or caveats the investor should consider before executing.',
    },
  },
  required: ['summary', 'actions', 'warnings'],
  additionalProperties: false,
} as const;

export async function getRebalancePlan(request: RebalancePlanRequest): Promise<RebalancePlan> {
  const holdingsSummary = request.holdings
    .map(h => `- ${sanitize(h.symbol, 15)} (${sanitize(h.name)}): ${h.quantity} shares @ $${h.currentPrice.toFixed(2)}, currently ${h.currentPercent.toFixed(1)}% of portfolio, target ${h.targetPercent.toFixed(1)}%`)
    .join('\n');

  const cashPercent = request.totalValue > 0 ? (request.cashBalance / request.totalValue) * 100 : 0;

  const prompt = `You are helping an investor rebalance their portfolio toward their target allocation.

Total portfolio value (holdings + cash): $${request.totalValue.toFixed(2)}
Cash balance: $${request.cashBalance.toFixed(2)} (currently ${cashPercent.toFixed(1)}% of portfolio, target ${request.cashTargetPercent.toFixed(1)}%)

Holdings (current vs target allocation):
${holdingsSummary}

Propose concrete trades (whole or fractional shares) to move the portfolio toward the targets. Buys should be funded from cash and from sell proceeds; make sure the plan's net cash flow leaves the cash balance near its target. Prefer fewer, larger trades over many tiny ones; suggest "hold" when a position is within about 2 percentage points of its target. Include realistic caveats (taxes on realized gains, transaction timing) in warnings.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    output_config: {
      format: { type: 'json_schema', schema: REBALANCE_PLAN_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  const parsed = JSON.parse(text);

  return {
    summary: parsed.summary ?? '',
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    timestamp: new Date().toISOString(),
  };
}

const TRADE_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['proceed', 'caution', 'reconsider'],
      description: 'Overall assessment: proceed = reasonable trade, caution = defensible but has real risks, reconsider = likely a mistake.',
    },
    assessment: { type: 'string', description: 'Two or three sentence evaluation of this trade in the context of the portfolio.' },
    considerations: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 specific points the investor should weigh before executing.',
    },
  },
  required: ['verdict', 'assessment', 'considerations'],
  additionalProperties: false,
} as const;

export async function getTradeCheck(request: TradeCheckRequest): Promise<TradeCheckResult> {
  const { trade } = request;
  const tradeValue = trade.quantity * trade.price;

  const holdingsSummary = request.holdings.length > 0
    ? request.holdings
        .map(h => `- ${sanitize(h.symbol, 15)}: ${h.quantity} shares @ $${h.purchasePrice.toFixed(2)} avg cost${h.currentPrice != null ? `, now $${h.currentPrice.toFixed(2)}` : ''}`)
        .join('\n')
    : 'No holdings.';

  const tradesSummary = request.recentTrades.length > 0
    ? request.recentTrades
        .map(t => `- ${t.date.slice(0, 10)}: ${t.type.toUpperCase()} ${t.quantity} ${sanitize(t.symbol, 15)} @ $${t.price.toFixed(2)}${t.notes ? ` — "${sanitize(t.notes, 200)}"` : ''}`)
        .join('\n')
    : 'No prior trades.';

  const prompt = `An investor is about to execute this trade and wants a quick second opinion before committing:

PROPOSED TRADE: ${trade.type.toUpperCase()} ${trade.quantity} shares of ${sanitize(trade.name)} (${sanitize(trade.symbol, 15)}) @ $${trade.price.toFixed(2)} (total ~$${tradeValue.toFixed(2)})
${trade.notes ? `Their stated reason: "${sanitize(trade.notes, 300)}"` : 'No reason given.'}

CURRENT PORTFOLIO:
${holdingsSummary}
Cash balance: $${request.cashBalance.toFixed(2)}

RECENT TRADES (most recent first):
${tradesSummary}

Evaluate the trade for: concentration risk, whether it contradicts their own recent trades or notes, position sizing relative to portfolio and cash, and anything about the timing or reasoning that stands out. Be direct — if it looks fine, say so; if it looks like a mistake, say why.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: {
      format: { type: 'json_schema', schema: TRADE_CHECK_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  const parsed = JSON.parse(text);

  return {
    verdict: ['proceed', 'caution', 'reconsider'].includes(parsed.verdict) ? parsed.verdict : 'caution',
    assessment: parsed.assessment ?? '',
    considerations: Array.isArray(parsed.considerations) ? parsed.considerations : [],
    timestamp: new Date().toISOString(),
  };
}

const JOURNAL_COACH_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two or three sentence overall read on this investor\'s trading behavior.' },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name for the behavioral pattern, e.g. "Selling winners too early".' },
          evidence: { type: 'string', description: 'The specific trades or numbers from the journal that show this pattern.' },
          advice: { type: 'string', description: 'One concrete, actionable suggestion.' },
        },
        required: ['title', 'evidence', 'advice'],
        additionalProperties: false,
      },
      description: '2-4 behavioral patterns worth the investor\'s attention, most important first.',
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: '1-3 things this investor is doing well and should keep doing.',
    },
  },
  required: ['summary', 'patterns', 'strengths'],
  additionalProperties: false,
} as const;

export async function getJournalCoach(request: JournalCoachRequest): Promise<JournalCoachResult> {
  const tradesSummary = request.trades
    .map(t => {
      const pnl = t.gainLoss != null ? `, realized ${t.gainLoss >= 0 ? '+' : ''}$${t.gainLoss.toFixed(2)} (${t.gainLossPercent?.toFixed(1)}%)` : '';
      return `- ${t.date.slice(0, 10)}: ${t.type.toUpperCase()} ${t.quantity} ${sanitize(t.symbol, 15)} @ $${t.price.toFixed(2)}${pnl}${t.notes ? ` — note: "${sanitize(t.notes, 300)}"` : ' — no note'}`;
    })
    .join('\n');

  const holdingsSummary = request.holdings.length > 0
    ? request.holdings
        .map(h => `- ${sanitize(h.symbol, 15)}: ${h.quantity} shares @ $${h.purchasePrice.toFixed(2)} avg cost${h.currentPrice != null ? `, now $${h.currentPrice.toFixed(2)}` : ''}`)
        .join('\n')
    : 'No current holdings.';

  const prompt = `You are a trading coach reviewing an investor's journal to identify behavioral patterns. Look for classic biases with actual evidence in the data: selling winners early while holding losers (disposition effect), position sizes creeping up after wins, trades without a written reason, chasing recent movers, over-concentration, panic sells, and anything else the record supports. Only report patterns the data genuinely shows — do not invent findings to fill space. Also note what they do well.

TRADE JOURNAL (most recent first):
${tradesSummary}

CURRENT HOLDINGS:
${holdingsSummary}`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    output_config: {
      format: { type: 'json_schema', schema: JOURNAL_COACH_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  const parsed = JSON.parse(text);

  return {
    summary: parsed.summary ?? '',
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    timestamp: new Date().toISOString(),
  };
}

const THESIS_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['intact', 'watch', 'broken'],
      description: 'intact = thesis still holds, watch = developments worth monitoring, broken = the original reasoning likely no longer applies.',
    },
    assessment: { type: 'string', description: 'Two or three sentences on how the thesis holds up against recent news and the price action.' },
    developments: {
      type: 'array',
      items: { type: 'string' },
      description: 'Up to 3 recent developments most relevant to the thesis (or an empty array if news is thin).',
    },
  },
  required: ['status', 'assessment', 'developments'],
  additionalProperties: false,
} as const;

export async function getThesisCheck(request: ThesisCheckRequest): Promise<ThesisCheckResult> {
  const headlines = request.headlines.length > 0
    ? request.headlines.map(n => `- "${sanitize(n.title, 200)}" (${sanitize(n.publisher, 60)})`).join('\n')
    : 'No recent news available.';

  const priceMove = request.purchasePrice > 0
    ? ((request.currentPrice - request.purchasePrice) / request.purchasePrice) * 100
    : 0;

  const prompt = `An investor wrote down why they bought a stock. Evaluate whether that thesis still holds.

Stock: ${sanitize(request.name)} (${sanitize(request.symbol, 15)})
Bought at $${request.purchasePrice.toFixed(2)}, now $${request.currentPrice.toFixed(2)} (${priceMove >= 0 ? '+' : ''}${priceMove.toFixed(1)}% since purchase)

THEIR THESIS:
"${sanitize(request.thesis, 1000)}"

RECENT HEADLINES:
${headlines}

Judge the thesis against the news and price action. Focus on whether the *reasoning* still applies, not just whether the price went up — a thesis can be intact while the stock is down, or broken while it's up.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: {
      format: { type: 'json_schema', schema: THESIS_CHECK_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  const parsed = JSON.parse(text);

  return {
    status: ['intact', 'watch', 'broken'].includes(parsed.status) ? parsed.status : 'watch',
    assessment: parsed.assessment ?? '',
    developments: Array.isArray(parsed.developments) ? parsed.developments : [],
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

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseInsightResponse(content, 'portfolio');
}
