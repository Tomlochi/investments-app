import Anthropic from '@anthropic-ai/sdk';

/** Every call in this directory uses this model. */
export const MODEL = 'claude-opus-5';

/** Strip control characters and limit length to prevent prompt injection. */
export function sanitize(value: string, maxLen = 100): string {
  return value.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen);
}

export const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

/** Concatenates the text blocks of a response and parses them as JSON. */
export function parseJsonResponse<T>(response: Anthropic.Message): T {
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  return JSON.parse(text) as T;
}
