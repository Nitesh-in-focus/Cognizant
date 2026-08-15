import { generateGeminiContent, isGeminiConfigured } from '../../lib/gemini';

export interface NlpGrnExtractedFields {
  po_id?: string;
  po_number?: string;
  received_quantity: number;
  accepted_quantity: number;
  damaged_quantity: number;
  missing_quantity: number;
  remarks: string;
  confidence: number;
  raw_prompt: string;
}

export async function parseNlpGoodsReceipt(
  naturalPrompt: string,
  availablePOs: any[] = []
): Promise<NlpGrnExtractedFields> {
  const cleanPrompt = naturalPrompt.trim();

  // If Gemini LLM is active, extract with deep NLP reasoning
  if (isGeminiConfigured()) {
    try {
      const poCatalog = availablePOs.map((p) => ({
        po_id: p.po_id,
        po_number: p.po_number,
        supplier_name: p.suppliers?.supplier_name,
        ordered_quantity: p.po_items?.[0]?.ordered_quantity || 1000,
        product_name: p.po_items?.[0]?.products?.product_name || 'Component',
      }));

      const prompt = `Extract structured Goods Receipt Note (GRN) inspection fields from this dock worker/inspector intake report:
"${cleanPrompt}"

Available Purchase Orders (POs) at this Facility:
${JSON.stringify(poCatalog, null, 2)}

Instructions:
1. Match the mentioned PO Number (e.g. PO-2026-8001 or 8001) from the list.
2. Extract total received quantity (received_quantity).
3. Extract damaged quantity (damaged_quantity, default 0).
4. Extract missing/shortage quantity (missing_quantity, default 0).
5. Calculate accepted_quantity = received_quantity - damaged_quantity.
6. Extract clean remarks describing the delivery condition, packaging state, or defects.
7. Return confidence score (0 to 100).

Respond strictly in valid JSON format:
{
  "po_id": "matched uuid or null",
  "po_number": "PO-2026-8001",
  "received_quantity": 950,
  "accepted_quantity": 930,
  "damaged_quantity": 20,
  "missing_quantity": 50,
  "remarks": "20 units damaged with broken seals in Box 3",
  "confidence": 96
}`;

      const geminiRes = await generateGeminiContent(prompt, {
        systemInstruction: 'You are an Enterprise Goods Receipt (GRN) Inspector NLP Assistant. Extract physical delivery metrics and defect counts from natural language reports. Return valid JSON only.',
        responseMimeType: 'application/json',
        temperature: 0.1,
      });

      if (geminiRes.success && geminiRes.text) {
        const parsed = JSON.parse(geminiRes.text);
        const matchedPo = availablePOs.find(p => p.po_id === parsed.po_id || p.po_number?.toLowerCase() === parsed.po_number?.toLowerCase()) || availablePOs[0];
        
        const recQty = Number(parsed.received_quantity) || 100;
        const damQty = Number(parsed.damaged_quantity) || 0;
        const missQty = Number(parsed.missing_quantity) || 0;
        const accQty = parsed.accepted_quantity !== undefined ? Number(parsed.accepted_quantity) : Math.max(0, recQty - damQty);

        return {
          po_id: matchedPo?.po_id || availablePOs[0]?.po_id,
          po_number: matchedPo?.po_number || availablePOs[0]?.po_number || parsed.po_number,
          received_quantity: recQty,
          accepted_quantity: accQty,
          damaged_quantity: damQty,
          missing_quantity: missQty,
          remarks: parsed.remarks || cleanPrompt,
          confidence: parsed.confidence || 94,
          raw_prompt: cleanPrompt,
        };
      }
    } catch (llmErr) {
      console.warn('Gemini GRN NLP extraction fallback:', llmErr);
    }
  }

  // Heuristic rule-based regex fallback parser
  const textLower = cleanPrompt.toLowerCase();

  // Find PO match
  let matchedPo = availablePOs[0];
  for (const p of availablePOs) {
    const cleanNum = p.po_number?.toLowerCase().replace(/\D/g, '');
    if (textLower.includes(p.po_number?.toLowerCase()) || (cleanNum && textLower.includes(cleanNum))) {
      matchedPo = p;
      break;
    }
  }

  // Extract counts
  let receivedQty = 100;
  let damagedQty = 0;
  let missingQty = 0;

  const recMatch = textLower.match(/received\s*(\d+)/) || textLower.match(/(\d+)\s*(?:units|qty|pcs|boxes|items|parts)/);
  if (recMatch) {
    receivedQty = parseInt(recMatch[1], 10);
  }

  const damMatch = textLower.match(/(\d+)\s*(?:damaged|defect|broken|crushed|leaking)/) || textLower.match(/damaged\s*(?:of\s*)?(\d+)/);
  if (damMatch) {
    damagedQty = parseInt(damMatch[1], 10);
  }

  const missMatch = textLower.match(/(\d+)\s*(?:missing|short|shortage|lost)/) || textLower.match(/missing\s*(?:of\s*)?(\d+)/);
  if (missMatch) {
    missingQty = parseInt(missMatch[1], 10);
  }

  const acceptedQty = Math.max(0, receivedQty - damagedQty);

  return {
    po_id: matchedPo?.po_id,
    po_number: matchedPo?.po_number,
    received_quantity: receivedQty,
    accepted_quantity: acceptedQty,
    damaged_quantity: damagedQty,
    missing_quantity: missingQty,
    remarks: cleanPrompt,
    confidence: 85,
    raw_prompt: cleanPrompt,
  };
}
