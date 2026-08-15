import { generateGeminiContent, isGeminiConfigured } from '../../lib/gemini';
import { supabase } from '../../lib/supabase';
import { NlpExtractionLog } from '../../types/database';

export interface NlpPrExtractedFields {
  product_id?: string;
  product_name?: string;
  quantity?: number;
  unit_of_measure?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority_reason?: string;
  required_date?: string;
  date_confidence?: number;
  date_source_text?: string;
  reason?: string;
  confidence?: number;
  missing_fields?: string[];
  raw_prompt: string;
}

// In-memory or localStorage extraction logger for auditing (Section 35)
const NLP_LOG_KEY = 'supply_sync_nlp_extraction_logs';

export function saveNlpExtractionLog(log: NlpExtractionLog) {
  try {
    const raw = localStorage.getItem(NLP_LOG_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    localStorage.setItem(NLP_LOG_KEY, JSON.stringify([log, ...existing].slice(0, 50)));
  } catch (err) {
    console.warn('Failed to save NLP log:', err);
  }
}

/**
 * Enhanced Date Extraction & Normalization Helper (Sections 31-32 of updates5.md)
 */
export function extractAndNormalizeDate(text: string): {
  normalized_date: string;
  source_text: string;
  confidence: number;
} {
  const textLower = text.toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();

  // Pattern 1: Relative dates like "tomorrow"
  if (textLower.includes('tomorrow')) {
    const d = new Date(now.getTime() + 86400000);
    return {
      normalized_date: d.toISOString().split('T')[0],
      source_text: 'tomorrow',
      confidence: 0.99,
    };
  }

  // Pattern 2: "next week" / "in 7 days"
  if (textLower.includes('next week')) {
    const d = new Date(now.getTime() + 7 * 86400000);
    return {
      normalized_date: d.toISOString().split('T')[0],
      source_text: 'next week',
      confidence: 0.95,
    };
  }

  // Pattern 3: "within X days" / "in X days"
  const withinDaysMatch = textLower.match(/(?:within|in|deliver in|deliver within)\s*(\d+)\s*days/i);
  if (withinDaysMatch) {
    const days = parseInt(withinDaysMatch[1], 10);
    const d = new Date(now.getTime() + days * 86400000);
    return {
      normalized_date: d.toISOString().split('T')[0],
      source_text: withinDaysMatch[0],
      confidence: 0.98,
    };
  }

  // Pattern 4: "next monday" / "next friday" etc.
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < daysOfWeek.length; i++) {
    if (textLower.includes(`next ${daysOfWeek[i]}`)) {
      const todayDay = now.getDay();
      let daysAhead = (i - todayDay + 7) % 7;
      if (daysAhead === 0) daysAhead = 7;
      const d = new Date(now.getTime() + daysAhead * 86400000);
      return {
        normalized_date: d.toISOString().split('T')[0],
        source_text: `next ${daysOfWeek[i]}`,
        confidence: 0.95,
      };
    }
  }

  // Pattern 5: "by 25 August" / "on 25 August" / "25th August" / "August 25"
  const months: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };

  const monthRegex = new RegExp(`(?:by|before|on|needed on|required on|by the)?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(${Object.keys(months).join('|')})(?:\\s*(\\d{4}))?`, 'i');
  const monthMatch = text.match(monthRegex);
  if (monthMatch) {
    const day = parseInt(monthMatch[1], 10);
    const monthKey = monthMatch[2].toLowerCase();
    const month = months[monthKey];
    const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : currentYear;

    const parsed = new Date(year, month, day);
    return {
      normalized_date: parsed.toISOString().split('T')[0],
      source_text: monthMatch[0],
      confidence: 0.98,
    };
  }

  // Pattern 6: DD/MM/YYYY or YYYY-MM-DD
  const slashDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashDateMatch) {
    const day = parseInt(slashDateMatch[1], 10);
    const month = parseInt(slashDateMatch[2], 10) - 1;
    const year = parseInt(slashDateMatch[3], 10);
    const parsed = new Date(year, month, day);
    return {
      normalized_date: parsed.toISOString().split('T')[0],
      source_text: slashDateMatch[0],
      confidence: 0.99,
    };
  }

  // Default: 7 days out
  const fallbackDate = new Date(now.getTime() + 7 * 86400000);
  return {
    normalized_date: fallbackDate.toISOString().split('T')[0],
    source_text: 'default (7-day standard procurement cycle)',
    confidence: 0.7,
  };
}

/**
 * Urgency & Priority Detection Engine (Section 33 of updates5.md)
 */
export function inferPriorityAndReason(
  text: string,
  requiredDateIso: string
): { priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'; priority_reason: string } {
  const textLower = text.toLowerCase();
  const now = new Date();
  const targetDate = new Date(requiredDateIso);
  const diffHours = (targetDate.getTime() - now.getTime()) / (1000 * 3600);

  // 1. Natural Language Keywords
  const isEmergency = textLower.includes('urgent') || textLower.includes('critical') || textLower.includes('breakdown') || textLower.includes('asap') || textLower.includes('emergency') || textLower.includes('immediately');

  // 2. Date Proximity Checks
  if (isEmergency || diffHours <= 24) {
    return {
      priority: 'URGENT',
      priority_reason: isEmergency
        ? 'Emergency keywords detected in request: line disruption / immediate replenishment required.'
        : 'Required delivery date is within 24 hours.',
    };
  }

  if (diffHours <= 72 || textLower.includes('high') || textLower.includes('fast') || textLower.includes('priority')) {
    return {
      priority: 'HIGH',
      priority_reason: diffHours <= 72
        ? 'Required delivery date is within 3 days.'
        : 'High-priority batch run declared by worker.',
    };
  }

  if (diffHours >= 336 || textLower.includes('low') || textLower.includes('next month')) {
    return {
      priority: 'LOW',
      priority_reason: 'Long lead time window (> 14 days) allows standard economical freight routing.',
    };
  }

  return {
    priority: 'MEDIUM',
    priority_reason: 'Standard weekly replenishment schedule.',
  };
}

/**
 * Main NLP Purchase Requisition Parsing Engine with Gemini LLM + Heuristic Fallback (Sections 31-35)
 */
export async function parseNlpPurchaseRequisition(
  naturalPrompt: string,
  availableProducts: any[] = [],
  availableWarehouses: any[] = []
): Promise<NlpPrExtractedFields> {
  const cleanPrompt = naturalPrompt.trim();
  const missingFields: string[] = [];

  // 1. Try Gemini Deep Extraction
  if (isGeminiConfigured()) {
    try {
      const productCatalog = availableProducts.map((p) => ({
        product_id: p.product_id,
        product_code: p.product_code,
        product_name: p.product_name,
        category: p.category,
      }));

      const warehouseCatalog = availableWarehouses.map((w) => ({
        warehouse_id: w.warehouse_id,
        warehouse_code: w.warehouse_code,
        warehouse_name: w.warehouse_name,
        city: w.city,
      }));

      const prompt = `Extract structured Purchase Requisition (PR) fields from this Shop Floor Worker prompt:
"${cleanPrompt}"

Available Product Catalog:
${JSON.stringify(productCatalog, null, 2)}

Available Delivery DC Facilities:
${JSON.stringify(warehouseCatalog, null, 2)}

Current Date: ${new Date().toISOString().split('T')[0]} (August 2026)

Rules:
1. Extract required delivery date and normalize strictly to "YYYY-MM-DD". Extract source text ("by 25 August", "tomorrow", "next Monday", "in 10 days").
2. Infer priority: "URGENT", "HIGH", "MEDIUM", "LOW" based on required date and urgency keywords, plus clear priority_reason string.
3. Extract exact quantity as integer number.
4. Match closest product SKU from catalog.
5. Match destination warehouse DC.
6. Extract clean business justification reason.
7. If critical fields (quantity, product) cannot be found, list them in missing_fields array.

Respond strictly in JSON format:
{
  "product_id": "matched uuid or null",
  "product_name": "product name string",
  "quantity": 500,
  "unit_of_measure": "Units",
  "warehouse_id": "matched uuid or null",
  "warehouse_name": "warehouse name string",
  "priority": "URGENT",
  "priority_reason": "Required date is within 24 hours and emergency breakdown keyword found",
  "required_date": "2026-08-25",
  "date_confidence": 0.98,
  "date_source_text": "by 25 August",
  "reason": "Assembly line bearing replacement batch",
  "missing_fields": [],
  "confidence": 96
}`;

      const geminiRes = await generateGeminiContent(prompt, {
        systemInstruction: 'You are an Enterprise Procurement NLP Specialist. Extract structured PR data with high date accuracy and urgency inference. Return valid JSON only.',
        responseMimeType: 'application/json',
        temperature: 0.1,
      });

      if (geminiRes.success && geminiRes.text) {
        const parsed = JSON.parse(geminiRes.text);

        const extractedDate = parsed.required_date || extractAndNormalizeDate(cleanPrompt).normalized_date;
        const priorityData = inferPriorityAndReason(cleanPrompt, extractedDate);

        const result: NlpPrExtractedFields = {
          product_id: parsed.product_id || availableProducts[0]?.product_id,
          product_name: parsed.product_name || availableProducts[0]?.product_name,
          quantity: parsed.quantity || 250,
          unit_of_measure: parsed.unit_of_measure || 'Units',
          warehouse_id: parsed.warehouse_id || availableWarehouses[0]?.warehouse_id,
          warehouse_name: parsed.warehouse_name || availableWarehouses[0]?.warehouse_name,
          priority: parsed.priority || priorityData.priority,
          priority_reason: parsed.priority_reason || priorityData.priority_reason,
          required_date: extractedDate,
          date_confidence: parsed.date_confidence || 0.95,
          date_source_text: parsed.date_source_text || cleanPrompt,
          reason: parsed.reason || cleanPrompt,
          confidence: parsed.confidence || 94,
          missing_fields: parsed.missing_fields || [],
          raw_prompt: cleanPrompt,
        };

        // Log extraction (Section 35)
        saveNlpExtractionLog({
          log_id: `nlp-${Date.now()}`,
          raw_prompt: cleanPrompt,
          extracted_product_name: result.product_name,
          extracted_quantity: result.quantity,
          extracted_required_date: result.required_date,
          extracted_priority: result.priority,
          priority_reason: result.priority_reason,
          confidence: result.confidence || 94,
          created_at: new Date().toISOString(),
        });

        return result;
      }
    } catch (llmErr) {
      console.warn('Gemini NLP extraction fallback:', llmErr);
    }
  }

  // 2. Deterministic Rule-Based Fallback Engine
  const textLower = cleanPrompt.toLowerCase();

  // Extract quantity
  const qtyMatch = cleanPrompt.match(/(\d+)\s*(units|pcs|pieces|boxes|sets|qty|kg)?/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 250;
  if (!qtyMatch) missingFields.push('quantity');

  // Extract & normalize date
  const dateResult = extractAndNormalizeDate(cleanPrompt);

  // Infer priority & reason
  const priorityResult = inferPriorityAndReason(cleanPrompt, dateResult.normalized_date);

  // Match product
  let matchedProduct = availableProducts[0];
  let foundProduct = false;
  for (const prod of availableProducts) {
    if (
      textLower.includes(prod.product_name.toLowerCase()) ||
      textLower.includes(prod.product_code.toLowerCase()) ||
      textLower.includes(prod.category.toLowerCase())
    ) {
      matchedProduct = prod;
      foundProduct = true;
      break;
    }
  }
  if (!foundProduct) missingFields.push('product');

  // Match warehouse
  let matchedWarehouse = availableWarehouses[0];
  for (const wh of availableWarehouses) {
    if (
      textLower.includes(wh.warehouse_name.toLowerCase()) ||
      textLower.includes(wh.city.toLowerCase()) ||
      textLower.includes(wh.warehouse_code.toLowerCase())
    ) {
      matchedWarehouse = wh;
      break;
    }
  }

  const fallbackResult: NlpPrExtractedFields = {
    product_id: matchedProduct?.product_id,
    product_name: matchedProduct?.product_name,
    quantity,
    unit_of_measure: matchedProduct?.unit_of_measure || 'Units',
    warehouse_id: matchedWarehouse?.warehouse_id,
    warehouse_name: matchedWarehouse?.warehouse_name,
    priority: priorityResult.priority,
    priority_reason: priorityResult.priority_reason,
    required_date: dateResult.normalized_date,
    date_confidence: dateResult.confidence,
    date_source_text: dateResult.source_text,
    reason: cleanPrompt,
    confidence: 88,
    missing_fields: missingFields,
    raw_prompt: cleanPrompt,
  };

  saveNlpExtractionLog({
    log_id: `nlp-${Date.now()}`,
    raw_prompt: cleanPrompt,
    extracted_product_name: fallbackResult.product_name,
    extracted_quantity: fallbackResult.quantity,
    extracted_required_date: fallbackResult.required_date,
    extracted_priority: fallbackResult.priority,
    priority_reason: fallbackResult.priority_reason,
    confidence: fallbackResult.confidence || 88,
    created_at: new Date().toISOString(),
  });

  return fallbackResult;
}
