import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { chatWithPortfolio } from '../lib/claude';
import type { RootState } from '../store';
import type { ChatMessage, PortfolioChatContext } from '../types';

const STARTER_QUESTIONS = [
  'How is my portfolio doing overall?',
  'Am I too concentrated in any one stock?',
  'What patterns do you see in my trade journal?',
  'What should I consider buying next?',
];

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const trades = useSelector((state: RootState) => state.journal.entries);
  const watchlist = useSelector((state: RootState) => state.watchlist.items);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setIsLoading(true);

    const context: PortfolioChatContext = {
      holdings: holdings.map(h => ({
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        purchasePrice: h.purchasePrice,
        currentPrice: h.currentPrice,
      })),
      trades: trades.map(t => ({
        type: t.type,
        symbol: t.symbol,
        quantity: t.quantity,
        price: t.price,
        date: t.date,
        notes: t.notes,
      })),
      watchlist: watchlist.map(w => w.symbol),
    };

    try {
      const reply = await chatWithPortfolio(nextMessages, context);
      setMessages(prev => [
        ...prev,
        { id: nanoid(), role: 'assistant', content: reply, timestamp: new Date().toISOString() },
      ]);
    } catch (e) {
      console.error('Chat error:', e);
      setError('Failed to get a response. Check your API key and try again.');
      // Roll back the user message so it can be resent
      setMessages(messages);
      setInput(trimmed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-7.5rem)]">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ask Your Portfolio</h1>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Chat with Claude about your holdings, trades, and watchlist. Try one of these:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STARTER_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-sm rounded-lg border border-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-gray-100 dark:bg-gray-800">
              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your portfolio..."
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()} className="gap-2 shrink-0">
          <Send className="h-4 w-4" />
          Send
        </Button>
      </form>
      <p className="text-xs text-gray-400 dark:text-gray-500 pt-2">
        AI-generated commentary, not professional financial advice.
      </p>
    </div>
  );
}
