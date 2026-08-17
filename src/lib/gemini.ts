import { GoogleGenerativeAI } from '@google/generative-ai';

// Retrieve Gemini API key from Vite environment
const getApiKey = (): string => {
  return (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
};

let genAIInstance: GoogleGenerativeAI | null = null;

export function isGeminiConfigured(): boolean {
  const key = getApiKey();
  // Valid Google AI API keys start with "AIza" and are ~39 chars long
  // OR can be OAuth tokens — accept any non-empty key > 10 chars that isn't a placeholder
  return Boolean(key && key.length > 10 && !key.includes('your_api_key') && !key.includes('YOUR_'));
}

export function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = getApiKey();
  if (!apiKey || !isGeminiConfigured()) return null;
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

export interface GeminiGenerateOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'text/plain' | 'application/json';
}

// Model fallback order — try newer models first
const MODEL_FALLBACK_ORDER = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-pro',
];

/**
 * Executes a prompt against Google Gemini LLM with model-fallback support.
 * Tries models in order until one succeeds.
 */
export async function generateGeminiContent(
  prompt: string,
  options: GeminiGenerateOptions = {}
): Promise<{ text: string; success: boolean; error?: string; modelUsed?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      text: '',
      success: false,
      error: 'Gemini API Key is not configured in .env (VITE_GEMINI_API_KEY)',
    };
  }

  // Build model list — try requested model first, then fallbacks
  const requestedModel = options.model;
  const modelsToTry = requestedModel
    ? [requestedModel, ...MODEL_FALLBACK_ORDER.filter((m) => m !== requestedModel)]
    : MODEL_FALLBACK_ORDER;

  let lastError = '';

  for (const modelName of modelsToTry) {
    try {
      const model = ai.getGenerativeModel({
        model: modelName,
        systemInstruction: options.systemInstruction,
        generationConfig: {
          temperature: options.temperature ?? 0.1,
          maxOutputTokens: options.maxOutputTokens ?? 2048,
          responseMimeType: options.responseMimeType,
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (text && text.trim()) {
        console.info(`[Gemini] Success with model: ${modelName}`);
        return { text, success: true, modelUsed: modelName };
      }
    } catch (err: any) {
      lastError = err.message || String(err);
      // If it's an auth error (invalid key), don't try other models
      if (
        lastError.includes('API_KEY_INVALID') ||
        lastError.includes('PERMISSION_DENIED') ||
        lastError.includes('401')
      ) {
        console.warn(`[Gemini] Auth error — API key appears invalid:`, lastError);
        return {
          text: '',
          success: false,
          error: `Gemini API Key is invalid or expired. Please update VITE_GEMINI_API_KEY in your .env file. Error: ${lastError}`,
        };
      }
      console.warn(`[Gemini] Model ${modelName} failed:`, lastError);
      // Try next model
    }
  }

  return {
    text: '',
    success: false,
    error: `All Gemini models failed. Last error: ${lastError}`,
  };
}
