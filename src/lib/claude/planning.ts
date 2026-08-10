import Anthropic from '@anthropic-ai/sdk';
import { anthropic, sanitize, MODEL, parseJsonResponse } from './client';
import { REBALANCE_PLAN_SCHEMA, TRADE_CHECK_SCHEMA, DEVILS_ADVOCATE_SCHEMA } from './schemas';
import type {
  RebalancePlan,
  RebalancePlanRequest,
  TradeCheckRequest,
  TradeCheckResult,
  DevilsAdvocateRequest,
  DevilsAdvocateResult,
} from '../../types';

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
    model: MODEL,
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
    model: MODEL,
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

export async function getDevilsAdvocate(
  request: DevilsAdvocateRequest
): Promise<DevilsAdvocateResult> {
  const { plan } = request;

  const lessonsSummary = request.pastLessons.length > 0
    ? request.pastLessons
        .map(l => `- ${l.date.slice(0, 10)} ${sanitize(l.symbol, 15)} (${sanitize(l.setup, 20)}, process score ${l.score}): ${sanitize(l.lesson, 300)}`)
        .join('\n')
    : 'No graded trades yet.';

  const holdingsSummary = request.holdings.length > 0
    ? request.holdings
        .map(h => `- ${sanitize(h.symbol, 15)}: ${h.quantity} shares @ $${h.purchasePrice.toFixed(2)}`)
        .join('\n')
    : 'No holdings.';

  const openPlansSummary = request.openPlans.length > 0
    ? request.openPlans
        .map(p => `- ${sanitize(p.symbol, 15)} (${sanitize(p.setup, 20)}): ${sanitize(p.thesis, 200)}`)
        .join('\n')
    : 'No other open plans.';

  const flagsSummary = request.checkFlags.length > 0
    ? request.checkFlags.map(f => `- ${f}`).join('\n')
    : 'None — the plan is within all configured risk limits.';

  const indicatorsSummary = request.indicators
    ? `ATR(14): ${request.indicators.atr14?.toFixed(2) ?? 'n/a'}, RSI(14): ${request.indicators.rsi14?.toFixed(1) ?? 'n/a'}, SMA50: ${request.indicators.sma50?.toFixed(2) ?? 'n/a'}, SMA200: ${request.indicators.sma200?.toFixed(2) ?? 'n/a'}`
    : 'Unavailable.';

  const headlinesSummary = request.headlines.length > 0
    ? request.headlines.map(h => `- ${sanitize(h.title, 200)} (${sanitize(h.publisher, 50)})`).join('\n')
    : 'No recent headlines.';

  const prompt = `An investor has written this trade plan and wants it attacked before they commit money. Your job is to argue the other side, not to encourage them.

PROPOSED PLAN
Symbol: ${sanitize(plan.name)} (${sanitize(plan.symbol, 15)})
Setup: ${sanitize(plan.setup, 20)}
Entry: $${plan.entryHigh.toFixed(2)} | Stop: $${plan.stopPrice.toFixed(2)} | Target: $${plan.target1.toFixed(2)}
Size: ${plan.shares} shares | Conviction: ${plan.conviction}/5
Thesis: "${sanitize(plan.thesis, 600)}"
What would invalidate it: "${sanitize(plan.invalidation, 400)}"

AUTOMATED RISK CHECKS (already computed — do not recalculate, but do interpret):
${flagsSummary}

CURRENT PORTFOLIO:
${holdingsSummary}
Cash: $${request.cashBalance.toFixed(2)}

OTHER OPEN PLANS:
${openPlansSummary}

TECHNICALS: ${indicatorsSummary}

RECENT HEADLINES:
${headlinesSummary}

THIS INVESTOR'S PAST GRADED TRADES AND LESSONS:
${lessonsSummary}

Build the strongest bear case against this trade. Critique the plan's construction — is the stop arbitrary, is the invalidation actually falsifiable, does the size match the stated conviction. Then check the past lessons above: if this trade repeats a mistake they have already made and been graded on, say so and cite the symbol and date. Be direct. If the plan is genuinely sound, say proceed and keep the critique short.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    output_config: {
      format: { type: 'json_schema', schema: DEVILS_ADVOCATE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<DevilsAdvocateResult, 'timestamp'>>(response);
  return { ...parsed, timestamp: new Date().toISOString() };
}
