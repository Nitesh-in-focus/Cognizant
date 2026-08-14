import { generateGeminiContent, isGeminiConfigured } from '../../lib/gemini';
import { supabase } from '../../lib/supabase';

export interface NlpPrExtractedFields {
  product_id?: string;
  product_name?: string;
  quantity?: number;
  warehouse_id?: string;
  warehouse_name?: string;
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  required_date?: string;
  reason?: string;
  confidence?: number;
  raw_prompt: string;
}

export async function parseNlpPurchaseRequisition(
  naturalPrompt: string,
  availableProducts: any[] = [],
  availableWarehouses: any[] = []
): Promise<NlpPrExtractedFields> {
  const cleanPrompt = naturalPrompt.trim();

  // If Gemini LLM is active, extract with deep NLP reasoning
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

      const prompt = `Extract structured Purchase Requisition (PR) fields from this Worker request:
"${cleanPrompt}"

Available Product SKU Catalog:
${JSON.stringify(productCatalog, null, 2)}

Available Delivery Facilities / Warehouses:
${JSON.stringify(warehouseCatalog, null, 2)}

Instructions:
1. Match the closest product from the catalog (if mentioned).
2. Match the closest warehouse/facility (if mentioned, default to Pune Central DC).
3. Extract exact requested quantity as a number.
4. Extract required delivery date in YYYY-MM-DD format (if relative like "by next Friday", resolve to August 2026 dates).
5. Extract priority: "URGENT", "HIGH", "MEDIUM", or "LOW".
6. Extract clean business justification reason.

Respond strictly in JSON format:
{
  "product_id": "matched uuid or null",
  "product_name": "product name string",
  "quantity": 500,
  "warehouse_id": "matched uuid or null",
  "warehouse_name": "warehouse name string",
  "priority": "HIGH",
  "required_date": "2026-08-25",
  "reason": "Replenishment for assembly line production batch",
  "confidence": 95
}`;

      const geminiRes = await generateGeminiContent(prompt, {
        systemInstruction: 'You are an Enterprise Procurement NLP Assistant. Extract structured PR data from informal worker language. Return valid JSON only.',
        responseMimeType: 'application/json',
        temperature: 0.1,
      });

      if (geminiRes.success && geminiRes.text) {
        const parsed = JSON.parse(geminiRes.text);
        return {
          product_id: parsed.product_id || availableProducts[0]?.product_id,
          product_name: parsed.product_name || availableProducts[0]?.product_name,
          quantity: parsed.quantity || 100,
          warehouse_id: parsed.warehouse_id || availableWarehouses[0]?.warehouse_id,
          warehouse_name: parsed.warehouse_name || availableWarehouses[0]?.warehouse_name,
          priority: (parsed.priority?.toUpperCase() as any) || 'HIGH',
          required_date: parsed.required_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          reason: parsed.reason || cleanPrompt,
          confidence: parsed.confidence || 92,
          raw_prompt: cleanPrompt,
        };
      }
    } catch (llmErr) {
      console.warn('Gemini NLP extraction fallback:', llmErr);
    }
  }

  // Heuristic rule-based regex fallback parser
  const textLower = cleanPrompt.toLowerCase();

  // Extract quantity
  const qtyMatch = cleanPrompt.match(/(\d+)\s*(units|pcs|pieces|boxes|sets|qty|kg)?/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 250;

  // Extract priority
  let priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (textLower.includes('urgent') || textLower.includes('critical') || textLower.includes('asap') || textLower.includes('emergency')) {
    priority = 'URGENT';
  } else if (textLower.includes('high') || textLower.includes('priority')) {
    priority = 'HIGH';
  } else if (textLower.includes('low')) {
    priority = 'LOW';
  }

  // Match product
  let matchedProduct = availableProducts[0];
  for (const prod of availableProducts) {
    if (
      textLower.includes(prod.product_name.toLowerCase()) ||
      textLower.includes(prod.product_code.toLowerCase()) ||
      textLower.includes(prod.category.toLowerCase())
    ) {
      matchedProduct = prod;
      break;
    }
  }

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

  // Generate required date ~7 days out
  const reqDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  return {
    product_id: matchedProduct?.product_id,
    product_name: matchedProduct?.product_name,
    quantity,
    warehouse_id: matchedWarehouse?.warehouse_id,
    warehouse_name: matchedWarehouse?.warehouse_name,
    priority,
    required_date: reqDate,
    reason: cleanPrompt,
    confidence: 88,
    raw_prompt: cleanPrompt,
  };
}
