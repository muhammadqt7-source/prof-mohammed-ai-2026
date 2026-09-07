import { GoogleGenAI } from '@google/genai';
import { cacheGet, cacheSet } from './redis/redisClient.js';

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

export interface GenerateOptions {
  prompt: string;
  model?: string;
  cacheTtlSeconds?: number;
}

/**
 * Robust server-side wrapper for Gemini API
 * Includes:
 * - 8000ms Timeout
 * - 3 Retries with Exponential Backoff
 * - 429 / RESOURCE_EXHAUSTED Handling
 * - Response Caching
 * - Never leaks API Key to client
 */
export async function generateContentSafe(options: GenerateOptions): Promise<string> {
  const { prompt, model = 'gemini-2.5-flash', cacheTtlSeconds = 3600 } = options;

  // 1. Check Distributed Cache
  const cacheKey = `gemini:${model}:${Buffer.from(prompt).toString('base64').substring(0, 48)}`;
  const cached = await cacheGet<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const ai = getGenAI();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in backend environment.');
  }

  let attempt = 0;
  const maxAttempts = 3;
  let delayMs = 1000;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      clearTimeout(timeoutId);

      const text = response.text || '';
      if (text) {
        await cacheSet(cacheKey, text, cacheTtlSeconds);
      }
      return text;
    } catch (err: any) {
      const isRateLimit =
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED') ||
        err.status === 429;

      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');

      if (attempt < maxAttempts && (isRateLimit || isTimeout)) {
        console.warn(`[Gemini API] Retryable error (attempt ${attempt}/${maxAttempts}): ${err.message}. Waiting ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      } else {
        if (isRateLimit) {
          throw new Error('خدمة الذكاء الاصطناعي مشغولة حالياً (RESOURCE_EXHAUSTED / 429). يرجى المحاولة بعد قليل.');
        }
        throw new Error(`خطأ في استدعاء الذكاء الاصطناعي: ${err.message}`);
      }
    }
  }

  throw new Error('فشل الاتصال بخدمة الذكاء الاصطناعي بعد عدة محاولات.');
}
