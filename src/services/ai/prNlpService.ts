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

// ─── NLP Extraction Log ────────────────────────────────────────────────────────
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

// ─── Safe JSON parser (handles markdown code fences from Gemini) ───────────────
function safeParseJson(raw: string): any {
  try {
    // Strip markdown code fences if present: ```json ... ```
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(stripped);
  } catch {
    // Second attempt: extract first {...} block
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    throw new Error(`Failed to parse Gemini JSON response: ${raw.slice(0, 200)}`);
  }
}

// ─── Date Extraction & Normalization ──────────────────────────────────────────
export function extractAndNormalizeDate(text: string): {
  normalized_date: string;
  source_text: string;
  confidence: number;
} {
  const textLower = text.toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();

  // Helper: return ISO date string
  const iso = (d: Date) => d.toISOString().split('T')[0];
  const daysAhead = (n: number) => {
    const d = new Date(now.getTime() + n * 86400000);
    return iso(d);
  };

  // 1. "today"
  if (textLower.includes('today') || textLower.includes('same day')) {
    return { normalized_date: iso(now), source_text: 'today', confidence: 1.0 };
  }
  // 2. "tomorrow"
  if (textLower.includes('tomorrow')) {
    return { normalized_date: daysAhead(1), source_text: 'tomorrow', confidence: 0.99 };
  }
  // 3. "end of week" / "this friday"
  if (textLower.includes('end of week') || textLower.includes('this friday')) {
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysToFri = (5 - dayOfWeek + 7) % 7 || 7;
    return { normalized_date: daysAhead(daysToFri), source_text: 'end of week / friday', confidence: 0.93 };
  }
  // 4. "next week"
  if (textLower.match(/\bnext week\b/)) {
    return { normalized_date: daysAhead(7), source_text: 'next week', confidence: 0.95 };
  }
  // 5. "end of month"
  if (textLower.includes('end of month') || textLower.includes('eom')) {
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { normalized_date: iso(eom), source_text: 'end of month', confidence: 0.93 };
  }
  // 6. "asap" / "immediately" / "right now"
  if (textLower.match(/\b(asap|immediately|right now|right away|urgently)\b/)) {
    return { normalized_date: daysAhead(1), source_text: 'asap', confidence: 0.97 };
  }
  // 7. "within X days" / "in X days" / "X days from now"
  const withinDaysMatch = textLower.match(
    /(?:within|in|deliver in|by|deliver within|needs?\s+to\s+arrive\s+in)\s*(\d+)\s*(?:business\s+)?days?/i
  );
  if (withinDaysMatch) {
    const days = parseInt(withinDaysMatch[1], 10);
    return { normalized_date: daysAhead(days), source_text: withinDaysMatch[0], confidence: 0.98 };
  }
  // 8. "X weeks from now" / "in X weeks"
  const weeksMatch = textLower.match(/(?:in|within|by)\s*(\d+)\s*weeks?/i);
  if (weeksMatch) {
    return { normalized_date: daysAhead(parseInt(weeksMatch[1], 10) * 7), source_text: weeksMatch[0], confidence: 0.96 };
  }
  // 9. "next {weekday}"
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < daysOfWeek.length; i++) {
    if (textLower.includes(`next ${daysOfWeek[i]}`)) {
      const todayDay = now.getDay();
      let ahead = (i - todayDay + 7) % 7;
      if (ahead === 0) ahead = 7;
      return { normalized_date: daysAhead(ahead), source_text: `next ${daysOfWeek[i]}`, confidence: 0.95 };
    }
  }

  // 10. Month name dates: "25 August 2026", "Aug 25", "by 25th Aug", "August 25, 2026"
  const months: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
    april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
    august: 7, aug: 7, september: 8, sep: 8, sept: 8,
    october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
  };

  // "Day Month Year" pattern
  const dmy = new RegExp(
    `(?:by|before|on|by\\s+the|required\\s+on|needed\\s+on|due|deliver\\s+by)?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${Object.keys(months).join('|')})(?:[,\\s]+(\\d{4}))?`,
    'i'
  );
  const dmyMatch = text.match(dmy);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = months[dmyMatch[2].toLowerCase()];
    const year = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : currentYear;
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime()) && day >= 1 && day <= 31) {
      return { normalized_date: iso(parsed), source_text: dmyMatch[0].trim(), confidence: 0.98 };
    }
  }

  // "Month Day Year" pattern: "August 25, 2026" or "August 25"
  const mdy = new RegExp(
    `(${Object.keys(months).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[,\\s]+(\\d{4}))?`,
    'i'
  );
  const mdyMatch = text.match(mdy);
  if (mdyMatch) {
    const month = months[mdyMatch[1].toLowerCase()];
    const day = parseInt(mdyMatch[2], 10);
    const year = mdyMatch[3] ? parseInt(mdyMatch[3], 10) : currentYear;
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime()) && day >= 1 && day <= 31) {
      return { normalized_date: iso(parsed), source_text: mdyMatch[0].trim(), confidence: 0.98 };
    }
  }

  // 11. DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const numeric = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (numeric) {
    const parsed = new Date(parseInt(numeric[1]), parseInt(numeric[2]) - 1, parseInt(numeric[3]));
    if (!isNaN(parsed.getTime())) {
      return { normalized_date: iso(parsed), source_text: numeric[0], confidence: 0.99 };
    }
  }
  const dmy2 = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy2) {
    const parsed = new Date(parseInt(dmy2[3]), parseInt(dmy2[2]) - 1, parseInt(dmy2[1]));
    if (!isNaN(parsed.getTime())) {
      return { normalized_date: iso(parsed), source_text: dmy2[0], confidence: 0.99 };
    }
  }

  // Default: 7 business days
  return {
    normalized_date: daysAhead(7),
    source_text: 'default (7-day standard procurement cycle)',
    confidence: 0.7,
  };
}

// ─── Priority Inference ────────────────────────────────────────────────────────
export function inferPriorityAndReason(
  text: string,
  requiredDateIso: string
): { priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'; priority_reason: string } {
  const t = text.toLowerCase();
  const now = new Date();
  const targetDate = new Date(requiredDateIso);
  const diffHours = (targetDate.getTime() - now.getTime()) / 3600000;

  const isEmergency =
    /\b(urgent|critical|breakdown|emergency|asap|immediately|stop.?line|line.?down|shutdown|downtime)\b/.test(t);
  const isHighKeyword =
    /\b(high.priority|high priority|fast.track|expedite|rush order|shortage|stockout|out.of.stock)\b/.test(t);
  const isLowKeyword = /\b(low.priority|non.urgent|when.possible|backfill|next.quarter|next.month)\b/.test(t);

  if (isEmergency || diffHours <= 24) {
    return {
      priority: 'URGENT',
      priority_reason: isEmergency
        ? `Emergency signal in request: line disruption / immediate procurement required.`
        : `Required delivery within 24 hours — escalated to URGENT.`,
    };
  }
  if (isHighKeyword || diffHours <= 72) {
    return {
      priority: 'HIGH',
      priority_reason: isHighKeyword
        ? 'High-priority keyword detected (expedite / rush / shortage).'
        : `Required within 3 days — elevated to HIGH priority.`,
    };
  }
  if (isLowKeyword || diffHours >= 336) {
    return {
      priority: 'LOW',
      priority_reason: 'Long lead time (>14 days) — standard freight routing applicable.',
    };
  }
  return {
    priority: 'MEDIUM',
    priority_reason: 'Standard weekly replenishment cycle.',
  };
}

// ─── Product Fuzzy Matcher ─────────────────────────────────────────────────────
function matchProduct(text: string, availableProducts: any[]): any | null {
  const t = text.toLowerCase();
  let bestScore = 0;
  let bestProduct: any = null;

  for (const prod of availableProducts) {
    let score = 0;
    const name = (prod.product_name || '').toLowerCase();
    const code = (prod.product_code || '').toLowerCase();
    const cat = (prod.category || '').toLowerCase();

    if (t.includes(name)) score += 100;
    if (t.includes(code)) score += 90;
    if (t.includes(cat)) score += 40;

    // Partial word match — split product name into words
    const words = name.split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && t.includes(word)) score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestProduct = prod;
    }
  }
  return bestScore > 0 ? bestProduct : null;
}

// ─── Warehouse Fuzzy Matcher ───────────────────────────────────────────────────
function matchWarehouse(text: string, availableWarehouses: any[]): any | null {
  const t = text.toLowerCase();
  for (const wh of availableWarehouses) {
    const name = (wh.warehouse_name || '').toLowerCase();
    const code = (wh.warehouse_code || '').toLowerCase();
    const city = (wh.city || '').toLowerCase();
    if (t.includes(name) || t.includes(code) || (city && t.includes(city))) {
      return wh;
    }
  }
  // Partial: "pune" → "Pune DC", "delhi" → "Delhi Hub"
  for (const wh of availableWarehouses) {
    const name = (wh.warehouse_name || '').toLowerCase();
    const city = (wh.city || '').toLowerCase();
    const words = [...name.split(/\s+/), ...city.split(/\s+/)];
    for (const word of words) {
      if (word.length >= 4 && t.includes(word)) return wh;
    }
  }
  return null;
}

// ─── Quantity Extractor (context-aware) ────────────────────────────────────────
function extractQuantity(text: string): number | null {
  // Priority: "[number] units/pcs/boxes/sets/kg..." patterns
  const patterns = [
    /(\d[\d,]*)\s*(?:units?|pcs?|pieces?|boxes?|sets?|kg|kgs|nos?|items?|numbers?|qty)/i,
    /(?:quantity|qty|order|need|require|want|procure)\s*(?:of|:)?\s*(\d[\d,]*)/i,
    /(?:purchase|buy)\s*(\d[\d,]*)/i,
    /(\d[\d,]*)\s*(?:of|more|additional)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const num = parseInt(m[1].replace(/,/g, ''), 10);
      if (num > 0 && num < 10000000) return num; // sanity bound
    }
  }
  // Last resort: first standalone number > 1 that isn't a year
  const nums = [...text.matchAll(/\b(\d{1,6})\b/g)];
  for (const n of nums) {
    const v = parseInt(n[1], 10);
    if (v >= 2 && v < 100000 && !(v >= 2020 && v <= 2030)) return v;
  }
  return null;
}

// ─── Main PR NLP Parser ────────────────────────────────────────────────────────
export async function parseNlpPurchaseRequisition(
  naturalPrompt: string,
  availableProducts: any[] = [],
  availableWarehouses: any[] = []
): Promise<NlpPrExtractedFields> {
  const cleanPrompt = naturalPrompt.trim();
  const missingFields: string[] = [];

  // ── 1. Try Gemini deep extraction ─────────────────────────────────────────
  if (isGeminiConfigured()) {
    try {
      const productCatalog = availableProducts.slice(0, 30).map((p) => ({
        product_id: p.product_id,
        product_code: p.product_code || '',
        product_name: p.product_name || '',
        category: p.category || '',
        unit_of_measure: p.unit_of_measure || 'Units',
      }));

      const warehouseCatalog = availableWarehouses.map((w) => ({
        warehouse_id: w.warehouse_id,
        warehouse_code: w.warehouse_code || '',
        warehouse_name: w.warehouse_name || '',
        city: w.city || '',
      }));

      const today = new Date().toISOString().split('T')[0];

      const prompt = `You are an Enterprise Procurement NLP AI. Extract structured Purchase Requisition (PR) fields from this worker's natural language request.

WORKER REQUEST:
"${cleanPrompt}"

TODAY'S DATE: ${today}

AVAILABLE PRODUCTS (match the BEST one from catalog):
${JSON.stringify(productCatalog, null, 2)}

AVAILABLE WAREHOUSES / DELIVERY CENTERS:
${JSON.stringify(warehouseCatalog, null, 2)}

EXTRACTION RULES:
1. required_date: Parse any date expression and convert to YYYY-MM-DD. Examples: "by 25 August 2026" → "2026-08-25", "next Friday" → calculate from today, "in 10 days" → today + 10 days, "ASAP" → tomorrow.
2. priority: "URGENT" if date ≤ 24h or emergency keywords (asap, breakdown, line down, critical). "HIGH" if ≤ 3 days or high-priority language. "LOW" if > 14 days. Otherwise "MEDIUM".
3. quantity: Extract the integer number of units requested. No commas needed.
4. product_id & product_name: Match best product from the catalog above. Use exact product_id UUID from catalog.
5. warehouse_id & warehouse_name: Match delivery destination from catalog. Use exact warehouse_id UUID from catalog.
6. reason: Write a concise, professional business justification (1-2 sentences).
7. missing_fields: List field names that genuinely cannot be determined (e.g. ["product"] if no product mentioned).
8. confidence: Overall extraction accuracy as integer 0-100.

RESPOND IN VALID JSON ONLY — no extra text, no markdown code fences:
{
  "product_id": "<exact UUID from catalog or null>",
  "product_name": "<matched product name>",
  "quantity": <integer>,
  "unit_of_measure": "<Units/Kg/Boxes etc>",
  "warehouse_id": "<exact UUID from catalog or null>",
  "warehouse_name": "<matched warehouse name>",
  "priority": "<URGENT|HIGH|MEDIUM|LOW>",
  "priority_reason": "<why this priority was assigned>",
  "required_date": "<YYYY-MM-DD>",
  "date_confidence": <0.0-1.0>,
  "date_source_text": "<exact text that gave you the date>",
  "reason": "<professional business justification>",
  "missing_fields": [],
  "confidence": <0-100>
}`;

      const geminiRes = await generateGeminiContent(prompt, {
        model: 'gemini-1.5-flash',
        systemInstruction:
          'You are an Enterprise Procurement NLP Specialist. Return ONLY valid JSON with no markdown, no explanation, no code fences. Be precise with UUIDs from the provided catalog.',
        responseMimeType: 'application/json',
        temperature: 0.05,
        maxOutputTokens: 1024,
      });

      if (geminiRes.success && geminiRes.text) {
        const parsed = safeParseJson(geminiRes.text);

        // Validate + enrich extracted values
        const extractedDate =
          parsed.required_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.required_date)
            ? parsed.required_date
            : extractAndNormalizeDate(cleanPrompt).normalized_date;

        const priorityData = inferPriorityAndReason(cleanPrompt, extractedDate);

        // If Gemini gave us a UUID — verify it exists in our catalog
        let resolvedProductId = parsed.product_id || null;
        let resolvedProductName = parsed.product_name || null;
        if (resolvedProductId) {
          const verify = availableProducts.find((p) => p.product_id === resolvedProductId);
          if (!verify) {
            // Gemini hallucinated a UUID — try fuzzy match on the name it gave
            const fuzzy = matchProduct(parsed.product_name || cleanPrompt, availableProducts);
            resolvedProductId = fuzzy?.product_id || availableProducts[0]?.product_id;
            resolvedProductName = fuzzy?.product_name || availableProducts[0]?.product_name;
          }
        }

        let resolvedWarehouseId = parsed.warehouse_id || null;
        let resolvedWarehouseName = parsed.warehouse_name || null;
        if (resolvedWarehouseId) {
          const verify = availableWarehouses.find((w) => w.warehouse_id === resolvedWarehouseId);
          if (!verify) {
            const fuzzy = matchWarehouse(parsed.warehouse_name || cleanPrompt, availableWarehouses);
            resolvedWarehouseId = fuzzy?.warehouse_id || availableWarehouses[0]?.warehouse_id;
            resolvedWarehouseName = fuzzy?.warehouse_name || availableWarehouses[0]?.warehouse_name;
          }
        }

        const qty = parsed.quantity ? Number(parsed.quantity) : null;
        const finalQty = qty && qty > 0 ? qty : extractQuantity(cleanPrompt) || 100;

        const result: NlpPrExtractedFields = {
          product_id: resolvedProductId || availableProducts[0]?.product_id,
          product_name: resolvedProductName || availableProducts[0]?.product_name,
          quantity: finalQty,
          unit_of_measure: parsed.unit_of_measure || 'Units',
          warehouse_id: resolvedWarehouseId || availableWarehouses[0]?.warehouse_id,
          warehouse_name: resolvedWarehouseName || availableWarehouses[0]?.warehouse_name,
          priority: parsed.priority || priorityData.priority,
          priority_reason: parsed.priority_reason || priorityData.priority_reason,
          required_date: extractedDate,
          date_confidence: Number(parsed.date_confidence) || 0.95,
          date_source_text: parsed.date_source_text || 'AI extracted',
          reason: parsed.reason || cleanPrompt,
          confidence: Number(parsed.confidence) || 92,
          missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
          raw_prompt: cleanPrompt,
        };

        saveNlpExtractionLog({
          log_id: `nlp-${Date.now()}`,
          raw_prompt: cleanPrompt,
          extracted_product_name: result.product_name,
          extracted_quantity: result.quantity,
          extracted_required_date: result.required_date,
          extracted_priority: result.priority,
          priority_reason: result.priority_reason,
          confidence: result.confidence || 92,
          created_at: new Date().toISOString(),
        });

        return result;
      }
    } catch (llmErr) {
      console.warn('[PR NLP] Gemini extraction error, using heuristic fallback:', llmErr);
    }
  }

  // ── 2. Deterministic Heuristic Fallback ───────────────────────────────────
  const dateResult = extractAndNormalizeDate(cleanPrompt);
  const priorityResult = inferPriorityAndReason(cleanPrompt, dateResult.normalized_date);
  const quantity = extractQuantity(cleanPrompt);
  if (!quantity) missingFields.push('quantity');

  const matchedProduct = matchProduct(cleanPrompt, availableProducts);
  if (!matchedProduct) missingFields.push('product');

  const matchedWarehouse = matchWarehouse(cleanPrompt, availableWarehouses);

  const fallbackResult: NlpPrExtractedFields = {
    product_id: matchedProduct?.product_id || availableProducts[0]?.product_id,
    product_name: matchedProduct?.product_name || availableProducts[0]?.product_name,
    quantity: quantity || 100,
    unit_of_measure: matchedProduct?.unit_of_measure || 'Units',
    warehouse_id: matchedWarehouse?.warehouse_id || availableWarehouses[0]?.warehouse_id,
    warehouse_name: matchedWarehouse?.warehouse_name || availableWarehouses[0]?.warehouse_name,
    priority: priorityResult.priority,
    priority_reason: priorityResult.priority_reason,
    required_date: dateResult.normalized_date,
    date_confidence: dateResult.confidence,
    date_source_text: dateResult.source_text,
    reason: cleanPrompt,
    confidence: 78,
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
    confidence: fallbackResult.confidence || 78,
    created_at: new Date().toISOString(),
  });

  return fallbackResult;
}
