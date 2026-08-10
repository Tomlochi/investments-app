export const REBALANCE_PLAN_SCHEMA = {
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

export const TRADE_CHECK_SCHEMA = {
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

export const JOURNAL_COACH_SCHEMA = {
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

export const THESIS_CHECK_SCHEMA = {
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

export const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    content: { type: 'string', description: 'The analysis, under 300 words.' },
    sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
    confidence: { type: 'number', description: 'Confidence from 0 to 1.' },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 specific, actionable points.',
    },
  },
  required: ['content', 'sentiment', 'confidence', 'keyPoints'],
  additionalProperties: false,
} as const;

export const DAILY_BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    overallSummary: { type: 'string', description: 'Two or three sentences on the portfolio today.' },
    stocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          brief: { type: 'string', description: 'One or two sentences on this holding today.' },
          sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
        },
        required: ['symbol', 'brief', 'sentiment'],
        additionalProperties: false,
      },
    },
  },
  required: ['overallSummary', 'stocks'],
  additionalProperties: false,
} as const;

export const DEVILS_ADVOCATE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['proceed', 'caution', 'reconsider'] },
    bearCase: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 concrete reasons this trade could fail. Specific to this company and setup, not generic market risk.',
    },
    planCritique: {
      type: 'array',
      items: { type: 'string' },
      description: 'Problems with the plan itself: arbitrary stop, vague invalidation, size inconsistent with conviction. Empty if the plan is sound.',
    },
    repeatedMistakes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ways this trade repeats a mistake from the past lessons provided. Cite the symbol and date. Empty if none apply.',
    },
  },
  required: ['verdict', 'bearCase', 'planCritique', 'repeatedMistakes'],
  additionalProperties: false,
} as const;

export const EXIT_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['hold', 'trim', 'exit', 'raise-stop'] },
    reasoning: { type: 'string', description: 'Two to four sentences. Reference the plan as written.' },
    suggestedStop: { type: 'number', description: 'New stop price. Only meaningful when action is raise-stop.' },
  },
  required: ['action', 'reasoning'],
  additionalProperties: false,
} as const;

export const PROCESS_GRADE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', description: 'Process quality from 0 to 100. Ignores whether the trade made money.' },
    followedPlan: { type: 'array', items: { type: 'string' }, description: 'Specific things the investor did as planned.' },
    brokePlan: { type: 'array', items: { type: 'string' }, description: 'Specific deviations from the written plan. Empty if there were none.' },
    lesson: { type: 'string', description: 'One sentence, phrased so it is useful before a similar future trade.' },
  },
  required: ['score', 'followedPlan', 'brokePlan', 'lesson'],
  additionalProperties: false,
} as const;
