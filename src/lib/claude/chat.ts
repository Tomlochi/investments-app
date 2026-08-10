import Anthropic from '@anthropic-ai/sdk';
import { anthropic, sanitize, MODEL } from './client';
import type { ChatMessage, PortfolioChatContext } from '../../types';

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
    model: MODEL,
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
