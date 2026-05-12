import Anthropic from '@anthropic-ai/sdk';
import type { StockInsightRequest, PortfolioInsightRequest, AIInsight, InsightSentiment } from '../types';

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
