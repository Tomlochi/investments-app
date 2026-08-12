import Anthropic from '@anthropic-ai/sdk';
import { anthropic, sanitize, MODEL, parseJsonResponse } from './client';
import { JOURNAL_COACH_SCHEMA, THESIS_CHECK_SCHEMA, EXIT_ADVICE_SCHEMA, PROCESS_GRADE_SCHEMA, STOP_ADVICE_SCHEMA } from './schemas';
import type {
  JournalCoachRequest,
  JournalCoachResult,
  ThesisCheckRequest,
  ThesisCheckResult,
  ExitAdviceRequest,
  ExitAdviceResult,
  ProcessGradeRequest,
  ProcessGrade,
  StopAdviceRequest,
  StopAdviceResult,
} from '../../types';

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
    model: MODEL,
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
    model: MODEL,
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

export async function getExitAdvice(request: ExitAdviceRequest): Promise<ExitAdviceResult> {
  const { plan } = request;
  const riskPerShare = plan.entryPrice - plan.initialStopPrice;
  const distanceToStop = request.currentPrice - plan.currentStopPrice;
  const distanceToTarget = plan.target1 - request.currentPrice;

  const headlinesSummary = request.headlines.length > 0
    ? request.headlines.map(h => `- ${sanitize(h.title, 200)} (${sanitize(h.publisher, 50)})`).join('\n')
    : 'No recent headlines.';

  const indicatorsSummary = request.indicators
    ? `ATR(14): ${request.indicators.atr14?.toFixed(2) ?? 'n/a'}, RSI(14): ${request.indicators.rsi14?.toFixed(1) ?? 'n/a'}, SMA50: ${request.indicators.sma50?.toFixed(2) ?? 'n/a'}`
    : 'Unavailable.';

  const prompt = `An investor holds this position and wants help deciding whether to stay in it. They struggle with exits specifically: they hold losers too long and cut winners too early. Judge against the plan they wrote, not against what looks good now.

THE PLAN AS WRITTEN
Symbol: ${sanitize(plan.name)} (${sanitize(plan.symbol, 15)})
Setup: ${sanitize(plan.setup, 20)}
Thesis: "${sanitize(plan.thesis, 600)}"
What would invalidate it: "${sanitize(plan.invalidation, 400)}"
Entry: $${plan.entryPrice.toFixed(2)} | Original stop: $${plan.initialStopPrice.toFixed(2)} | Target: $${plan.target1.toFixed(2)}

WHERE IT STANDS NOW
Current price: $${request.currentPrice.toFixed(2)}
Current stop: $${plan.currentStopPrice.toFixed(2)}
Open result: ${request.currentR === null ? 'unknown' : `${request.currentR.toFixed(2)}R`}
Distance to stop: $${distanceToStop.toFixed(2)} (${riskPerShare > 0 ? (distanceToStop / riskPerShare).toFixed(2) : 'n/a'}R)
Distance to target: $${distanceToTarget.toFixed(2)}
Held for ${request.daysHeld} days.

TECHNICALS: ${indicatorsSummary}

RECENT HEADLINES:
${headlinesSummary}

Recommend one action: hold, trim, exit, or raise-stop.

Two things you must call out explicitly if they are true:
1. The price is already below their stop and they are still holding. That is a broken exit, and they need to hear it plainly.
2. The thesis is intact and the target has not been reached, meaning an exit now would be cutting a winner early.

If the thesis is invalidated by the invalidation condition they wrote, say exit regardless of the price. If you recommend raise-stop, give the specific price.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3072,
    output_config: {
      format: { type: 'json_schema', schema: EXIT_ADVICE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<ExitAdviceResult, 'timestamp'>>(response);
  return { ...parsed, timestamp: new Date().toISOString() };
}

export async function getStopAdvice(request: StopAdviceRequest): Promise<StopAdviceResult> {
  const i = request.indicators;
  const indicatorsSummary = i
    ? [
        `ATR(14): ${i.atr14?.toFixed(2) ?? 'n/a'}`,
        `RSI(14): ${i.rsi14?.toFixed(1) ?? 'n/a'}`,
        `SMA20: ${i.sma20?.toFixed(2) ?? 'n/a'}`,
        `SMA50: ${i.sma50?.toFixed(2) ?? 'n/a'}`,
        `SMA200: ${i.sma200?.toFixed(2) ?? 'n/a'}`,
        `52-week position: ${i.fiftyTwoWeekPosition != null ? `${(i.fiftyTwoWeekPosition * 100).toFixed(0)}% of the range (0% = 52-week low, 100% = 52-week high)` : 'n/a'}`,
      ].join('\n')
    : 'Unavailable — no indicator data could be loaded for this symbol.';

  const openPnlPercent = request.purchasePrice > 0
    ? ((request.currentPrice - request.purchasePrice) / request.purchasePrice) * 100
    : null;

  const prompt = `An investor holds a long position and wants a second opinion on where to place the protective stop-loss order in their broker app. They will read your answer and then set the order by hand, so the number has to be one they can actually type in.

THE POSITION
Symbol: ${sanitize(request.name)} (${sanitize(request.symbol, 15)})
Current price: $${request.currentPrice.toFixed(2)}
Average cost: $${request.purchasePrice.toFixed(2)}${openPnlPercent !== null ? ` (open position is ${openPnlPercent >= 0 ? 'up' : 'down'} ${Math.abs(openPnlPercent).toFixed(1)}%)` : ''}
Stop currently set: ${request.currentStop !== null ? `$${request.currentStop.toFixed(2)}` : 'none'}

TECHNICALS
${indicatorsSummary}

Recommend one stop price. Ground it in the technicals above — name a support level, a moving average, an ATR multiple below the price, or a recent swing low. Do not give a round percentage with no technical justification behind it.

The stop must sit below the current price of $${request.currentPrice.toFixed(2)}; a stop at or above it would trigger the moment it is placed.

${request.currentStop !== null
  ? `They already have a stop at $${request.currentStop.toFixed(2)}. State plainly whether your recommendation raises it, leaves it where it is, or loosens it — and if you are loosening a stop, justify why that is not just giving a loser more room.`
  : 'They have no stop set yet, so this is the first one.'}

If the technicals are unavailable, say so in your reasoning and base the level on the price and cost basis alone rather than inventing indicator values.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      format: { type: 'json_schema', schema: STOP_ADVICE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<StopAdviceResult, 'timestamp'>>(response);
  return { ...parsed, timestamp: new Date().toISOString() };
}

export async function getProcessGrade(request: ProcessGradeRequest): Promise<ProcessGrade> {
  const { plan, execution } = request;
  const sizeDelta = execution.actualShares - plan.plannedShares;

  const prompt = `Grade how well an investor executed their own trade plan. Grade the PROCESS ONLY. Whether the trade made money is irrelevant to the score, and you must not let it influence you.

Apply these rules literally:
- A trade that lost money but was entered on plan and stopped out exactly where planned is a HIGH score. That is a well-executed losing trade, which is a normal and necessary part of a working process.
- A trade that made money but was entered outside the planned zone, sized differently than planned, or exited on impulse is a LOW score. Profit from a broken process is luck, and rewarding it teaches the wrong lesson.

THE PLAN AS WRITTEN
Symbol: ${sanitize(plan.name)} (${sanitize(plan.symbol, 15)})
Setup: ${sanitize(plan.setup, 20)}
Thesis: "${sanitize(plan.thesis, 600)}"
Invalidation condition: "${sanitize(plan.invalidation, 400)}"
Planned entry: $${plan.entryHigh.toFixed(2)} | Planned stop: $${plan.initialStopPrice.toFixed(2)} | Planned target: $${plan.target1.toFixed(2)}
Planned size: ${plan.plannedShares} shares | Conviction: ${plan.conviction}/5

WHAT ACTUALLY HAPPENED
Entered at $${execution.actualEntryPrice.toFixed(2)} with ${execution.actualShares} shares (${sizeDelta === 0 ? 'exactly as planned' : `${Math.abs(sizeDelta)} shares ${sizeDelta > 0 ? 'more' : 'fewer'} than planned`}).
Exited at $${execution.actualExitPrice.toFixed(2)} after ${execution.daysHeld} days.
Stated exit reason: ${execution.exitReason}
Result: ${execution.realizedR === null ? 'unknown' : `${execution.realizedR.toFixed(2)}R`}

Score the process from 0 to 100. List what they followed and what they broke, citing the specific numbers. Then give one lesson, written so it is useful to them the next time they are about to take a similar trade.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3072,
    output_config: {
      format: { type: 'json_schema', schema: PROCESS_GRADE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<ProcessGrade, 'timestamp'>>(response);
  return {
    ...parsed,
    score: Math.max(0, Math.min(100, parsed.score)),
    timestamp: new Date().toISOString(),
  };
}
