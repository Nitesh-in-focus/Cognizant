import { GoogleGenerativeAI } from '@google/generative-ai';

// Retrieve Gemini API key from Vite environment
const getApiKey = (): string => {
  return (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
};

let genAIInstance: GoogleGenerativeAI | null = null;

export function isGeminiConfigured(): boolean {
  const key = getApiKey();
  return Boolean(key && key.length > 5 && !key.includes('your_api_key'));
}

export function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = getApiKey();
  if (!apiKey || !isGeminiConfigured()) {
    return null;
  }
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

/**
 * Executes a prompt against Google Gemini LLM with error handling and fallback support.
 */
export async function generateGeminiContent(
  prompt: string,
  options: GeminiGenerateOptions = {}
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return {
        text: '',
        success: false,
        error: 'Gemini API Key is not configured in .env (VITE_GEMINI_API_KEY)',
      };
    }

    const modelName = options.model || 'gemini-flash-latest';
    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction: options.systemInstruction,
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.maxOutputTokens ?? 1500,
        responseMimeType: options.responseMimeType,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return {
      text,
      success: true,
    };
  } catch (err: any) {
    console.warn('[Gemini Client Error]', err);
    return {
      text: '',
      success: false,
      error: err.message || 'Unknown error while communicating with Gemini API',
    };
  }
}
