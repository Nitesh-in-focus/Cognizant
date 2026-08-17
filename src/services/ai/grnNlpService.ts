import { generateGeminiContent, isGeminiConfigured } from '../../lib/gemini';

export interface NlpGrnExtractedFields {
  po_id?: string;
  po_number?: string;
  received_quantity: number;
  accepted_quantity: number;
  damaged_quantity: number;
  missing_quantity: number;
  remarks: string;
  defect_type?: string;
  inspection_status?: 'PASS' | 'PARTIAL' | 'FAIL';
  confidence: number;
  raw_prompt: string;
}

// ─── Safe JSON parser (handles markdown code fences from Gemini) ────────────
function safeParseJson(raw: string): any {
  try {
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(stripped);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    throw new Error(`Could not parse Gemini GRN JSON: ${raw.slice(0, 200)}`);
  }
}

// ─── Number extractor with context-label pairing ───────────────────────────
function extractLabeledQuantity(text: string, labels: string[]): number | null {
  const t = text.toLowerCase();
  // Pattern: "X units/pcs... [label]" or "[label]... X"
  for (const label of labels) {
    const after = new RegExp(`(\\d[\\d,]*)\\s*(?:units?|pcs?|pieces?|nos?|items?)?\\s*(?:were?)?\\s*${label}`, 'i');
    const before = new RegExp(`${label}\\s*(?:of)?\\s*(\\d[\\d,]*)`, 'i');
    const m = t.match(after) || t.match(before);
    if (m) {
      const v = parseInt(m[1].replace(/,/g, ''), 10);
      if (!isNaN(v) && v >= 0) return v;
    }
  }
  return null;
}

// ─── PO number matcher ──────────────────────────────────────────────────────
function findMatchingPo(text: string, availablePOs: any[]): any | null {
  const t = text.toLowerCase();
  // Try full PO number match
  for (const po of availablePOs) {
    const num = (po.po_number || '').toLowerCase();
    if (t.includes(num)) return po;
  }
  // Try numeric suffix match: "8001" from "PO-2026-8001"
  for (const po of availablePOs) {
    const digits = (po.po_number || '').replace(/\D/g, '');
    if (digits && digits.length >= 4 && t.includes(digits)) return po;
  }
  return null;
}

// ─── Main GRN NLP Parser ────────────────────────────────────────────────────
export async function parseNlpGoodsReceipt(
  naturalPrompt: string,
  availablePOs: any[] = []
): Promise<NlpGrnExtractedFields> {
  const cleanPrompt = naturalPrompt.trim();

  // ── 1. Gemini deep extraction ──────────────────────────────────────────────
  if (isGeminiConfigured()) {
    try {
      const poCatalog = availablePOs.slice(0, 20).map((p) => ({
        po_id: p.po_id,
        po_number: p.po_number,
        supplier_name: p.suppliers?.supplier_name || 'Unknown',
        ordered_quantity: p.po_items?.[0]?.ordered_quantity || 'N/A',
        product_name: p.po_items?.[0]?.products?.product_name || 'General Component',
      }));

      const prompt = `You are an Enterprise Goods Receipt (GRN) Inspector NLP AI. Extract structured delivery inspection data from this dock worker's natural language intake report.

WORKER INTAKE REPORT:
"${cleanPrompt}"

PENDING PURCHASE ORDERS AT THIS FACILITY:
${JSON.stringify(poCatalog, null, 2)}

EXTRACTION RULES:
1. po_number: Match the PO mentioned in the report (e.g., "PO-2026-8001", "8001", "the order"). Match to catalog above. Return exact po_id UUID and po_number.
2. received_quantity: Total units/items physically received at the dock gate.
3. damaged_quantity: Units damaged, defective, broken, crushed, wet, or leaking. Default 0 if not mentioned.
4. missing_quantity: Units short-shipped, not in the truck, or missing from delivery. Default 0 if not mentioned.
5. accepted_quantity: received_quantity - damaged_quantity - missing_quantity (never negative).
6. remarks: Concise professional delivery condition note (1-3 sentences). Mention defect type and location if specified.
7. defect_type: Classify damage: "Physical Damage" | "Packaging Damage" | "Quantity Shortage" | "Specification Mismatch" | "None"
8. inspection_status: "PASS" if no issues, "PARTIAL" if minor issues, "FAIL" if major damage or large shortage.
9. confidence: Integer 0-100.

RESPOND IN VALID JSON ONLY — no markdown, no explanation, no code fences:
{
  "po_id": "<exact UUID from catalog or null>",
  "po_number": "<PO number string>",
  "received_quantity": <integer>,
  "accepted_quantity": <integer>,
  "damaged_quantity": <integer>,
  "missing_quantity": <integer>,
  "remarks": "<professional delivery condition note>",
  "defect_type": "<Physical Damage|Packaging Damage|Quantity Shortage|Specification Mismatch|None>",
  "inspection_status": "<PASS|PARTIAL|FAIL>",
  "confidence": <0-100>
}`;

      const geminiRes = await generateGeminiContent(prompt, {
        model: 'gemini-1.5-flash',
        systemInstruction:
          'You are an Enterprise GRN Inspector NLP AI. Return ONLY valid JSON with no markdown, no explanation. Calculate accepted_quantity = received - damaged - missing (min 0).',
        responseMimeType: 'application/json',
        temperature: 0.05,
        maxOutputTokens: 512,
      });

      if (geminiRes.success && geminiRes.text) {
        const parsed = safeParseJson(geminiRes.text);

        // Resolve PO — verify UUID exists
        let resolvedPo = availablePOs.find((p) => p.po_id === parsed.po_id);
        if (!resolvedPo) {
          // Try matching by po_number from Gemini's response
          resolvedPo = availablePOs.find(
            (p) => p.po_number?.toLowerCase() === (parsed.po_number || '').toLowerCase()
          );
        }
        if (!resolvedPo) {
          resolvedPo = findMatchingPo(cleanPrompt, availablePOs);
        }

        const recQty = Math.max(0, Number(parsed.received_quantity) || 0);
        const damQty = Math.max(0, Number(parsed.damaged_quantity) || 0);
        const missQty = Math.max(0, Number(parsed.missing_quantity) || 0);
        const accQty =
          parsed.accepted_quantity !== undefined
            ? Math.max(0, Number(parsed.accepted_quantity))
            : Math.max(0, recQty - damQty - missQty);

        return {
          po_id: resolvedPo?.po_id || availablePOs[0]?.po_id,
          po_number: resolvedPo?.po_number || parsed.po_number || availablePOs[0]?.po_number,
          received_quantity: recQty,
          accepted_quantity: accQty,
          damaged_quantity: damQty,
          missing_quantity: missQty,
          remarks: parsed.remarks || cleanPrompt,
          defect_type: parsed.defect_type || 'None',
          inspection_status: parsed.inspection_status || (damQty > 0 || missQty > 0 ? 'PARTIAL' : 'PASS'),
          confidence: Number(parsed.confidence) || 91,
          raw_prompt: cleanPrompt,
        };
      }
    } catch (llmErr) {
      console.warn('[GRN NLP] Gemini extraction error, using heuristic fallback:', llmErr);
    }
  }

  // ── 2. Heuristic Rule-Based Fallback ─────────────────────────────────────
  const t = cleanPrompt.toLowerCase();

  // PO match
  const matchedPo = findMatchingPo(cleanPrompt, availablePOs) || availablePOs[0];

  // Received quantity
  const recQty =
    extractLabeledQuantity(cleanPrompt, ['received', 'delivered', 'arrived', 'came in', 'unloaded']) ||
    extractLabeledQuantity(cleanPrompt, ['units', 'pcs', 'pieces', 'boxes', 'items', 'nos']) ||
    100;

  // Damaged quantity
  const damQty =
    extractLabeledQuantity(cleanPrompt, ['damaged', 'defective', 'broken', 'crushed', 'leaking', 'wet', 'defect']) ||
    0;

  // Missing / shortage quantity
  const missQty =
    extractLabeledQuantity(cleanPrompt, ['missing', 'short', 'shortage', 'not received', 'absent', 'lost']) ||
    0;

  const accQty = Math.max(0, recQty - damQty - missQty);

  // Remarks
  const hasIssues = damQty > 0 || missQty > 0;
  const defectType = damQty > 0
    ? (t.includes('packag') ? 'Packaging Damage' : 'Physical Damage')
    : missQty > 0 ? 'Quantity Shortage' : 'None';

  const inspectionStatus: 'PASS' | 'PARTIAL' | 'FAIL' =
    !hasIssues ? 'PASS' :
    (damQty + missQty) > recQty * 0.1 ? 'FAIL' : 'PARTIAL';

  return {
    po_id: matchedPo?.po_id,
    po_number: matchedPo?.po_number,
    received_quantity: recQty,
    accepted_quantity: accQty,
    damaged_quantity: damQty,
    missing_quantity: missQty,
    remarks: cleanPrompt,
    defect_type: defectType,
    inspection_status: inspectionStatus,
    confidence: 80,
    raw_prompt: cleanPrompt,
  };
}
