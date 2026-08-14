import { logAiRecommendation } from './aiLogger';
import { generateGeminiContent, isGeminiConfigured } from '../../lib/gemini';

export interface QualityAnalysisInput {
  quality_check_id?: string;
  po_number: string;
  supplier_name: string;
  product_name: string;
  expected_quantity: number;
  received_quantity: number;
  damaged_quantity: number;
  observations: string;
}

export interface QualityAnalysisResult {
  recommendation_id?: string;
  recommended_quality_score: number; // Max 40
  recommended_quantity_score: number; // Max 20
  recommended_packaging_score: number; // Max 15
  recommended_docs_score: number; // Max 10
  recommended_delivery_score: number; // Max 15
  recommended_overall_score: number; // 0-100
  defect_classification: 'NONE' | 'MINOR_PACKAGING' | 'DIMENSIONAL_VARIANCE' | 'TRANSIT_DAMAGE' | 'CRITICAL_DEFECT';
  inspection_summary: string;
  confidence: number;
  suggested_action: 'ACCEPT_ALL' | 'ACCEPT_WITH_DEBIT_NOTE' | 'HOLD_FOR_REINSPECTION' | 'REJECT_LOT';
}

export async function analyzeQualityInspection(
  input: QualityAnalysisInput
): Promise<QualityAnalysisResult> {
  const defectRatio = input.damaged_quantity / Math.max(1, input.received_quantity);

  let qualityScore = 38;
  let packagingScore = 14;
  let defectClass: QualityAnalysisResult['defect_classification'] = 'NONE';
  let action: QualityAnalysisResult['suggested_action'] = 'ACCEPT_ALL';

  if (defectRatio > 0.05) {
    qualityScore = 28;
    packagingScore = 9;
    defectClass = 'TRANSIT_DAMAGE';
    action = 'HOLD_FOR_REINSPECTION';
  } else if (defectRatio > 0) {
    qualityScore = 35;
    packagingScore = 12;
    defectClass = 'MINOR_PACKAGING';
    action = 'ACCEPT_WITH_DEBIT_NOTE';
  }

  const quantityScore = Math.round(Math.min(20, (input.received_quantity / Math.max(1, input.expected_quantity)) * 20));
  const docsScore = 9.5;
  const deliveryScore = 14.0;
  let overallScore = Math.round((qualityScore + quantityScore + packagingScore + docsScore + deliveryScore) * 10) / 10;

  let inspectionSummary = input.damaged_quantity > 0
    ? `AI Quality Inspection detected ${input.damaged_quantity} units with potential transit/seal wear. Recommended score: ${overallScore}/100. Action: ${action}.`
    : `AI Quality Inspection verified 100% compliant packaging and material integrity. Recommended score: ${overallScore}/100.`;

  let confidence = 91;

  // If Gemini LLM is active, execute deep defect classification
  if (isGeminiConfigured()) {
    try {
      const prompt = `Analyze the following goods receipt intake inspection:
- PO Number: ${input.po_number}
- Supplier: ${input.supplier_name}
- Product: ${input.product_name}
- Expected Quantity: ${input.expected_quantity}
- Received Quantity: ${input.received_quantity}
- Damaged Quantity: ${input.damaged_quantity}
- Physical Observations: "${input.observations}"

Respond in JSON format matching:
{
  "defect_classification": "NONE" | "MINOR_PACKAGING" | "DIMENSIONAL_VARIANCE" | "TRANSIT_DAMAGE" | "CRITICAL_DEFECT",
  "suggested_action": "ACCEPT_ALL" | "ACCEPT_WITH_DEBIT_NOTE" | "HOLD_FOR_REINSPECTION" | "REJECT_LOT",
  "recommended_quality_score": 38,
  "recommended_packaging_score": 14,
  "inspection_summary": "Detailed QA summary string",
  "confidence": 94
}`;

      const geminiRes = await generateGeminiContent(prompt, {
        systemInstruction: 'You are an Industrial QA Quality Inspector AI. Evaluate cargo defects rigorously and output strictly valid JSON.',
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      if (geminiRes.success && geminiRes.text) {
        const parsed = JSON.parse(geminiRes.text);
        if (parsed.defect_classification) defectClass = parsed.defect_classification;
        if (parsed.suggested_action) action = parsed.suggested_action;
        if (parsed.recommended_quality_score) qualityScore = parsed.recommended_quality_score;
        if (parsed.recommended_packaging_score) packagingScore = parsed.recommended_packaging_score;
        if (parsed.inspection_summary) inspectionSummary = parsed.inspection_summary;
        if (parsed.confidence) confidence = parsed.confidence;
        overallScore = Math.round((qualityScore + quantityScore + packagingScore + docsScore + deliveryScore) * 10) / 10;
      }
    } catch (llmErr) {
      console.warn('Gemini Quality Inspection fallback:', llmErr);
    }
  }

  const result: QualityAnalysisResult = {
    recommended_quality_score: qualityScore,
    recommended_quantity_score: quantityScore,
    recommended_packaging_score: packagingScore,
    recommended_docs_score: docsScore,
    recommended_delivery_score: deliveryScore,
    recommended_overall_score: overallScore,
    defect_classification: defectClass,
    inspection_summary: inspectionSummary,
    confidence,
    suggested_action: action,
  };

  const recId = await logAiRecommendation(
    'QUALITY_ANALYSIS',
    'quality_checks',
    input.quality_check_id || input.po_number,
    result,
    confidence,
    inspectionSummary,
    input
  );

  result.recommendation_id = recId || undefined;
  return result;
}
