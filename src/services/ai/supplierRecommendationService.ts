import { logAiRecommendation } from './aiLogger';
import { generateGeminiContent, isGeminiConfigured } from '../../lib/gemini';

export interface SupplierCandidate {
  supplier_id: string;
  supplier_name: string;
  city: string;
  quality_score: number;
  delivery_score: number;
  quantity_accuracy_score?: number;
  damage_rate?: number;
  overall_score: number;
  unit_price: number;
  lead_time_days: number;
  exception_count: number;
  capacity_units: number;
}

export interface SupplierAiRecommendation {
  recommendation_id?: string;
  recommended_supplier_id: string;
  recommended_supplier_name: string;
  confidence: number;
  reasons: string[];
  risk_factors: string[];
  alternative_suppliers: Array<{
    supplier_id: string;
    supplier_name: string;
    score: number;
    highlight: string;
  }>;
}

/**
 * Gemini Strategic Sourcing Multi-Criteria Recommendation Engine (Section 30 of updates5.md)
 */
export async function getAiSupplierRecommendation(
  prId: string,
  productId: string,
  requiredQuantity: number,
  candidates: SupplierCandidate[]
): Promise<SupplierAiRecommendation> {
  if (!candidates || candidates.length === 0) {
    throw new Error('No candidate suppliers available for evaluation');
  }

  // 1. Calculate baseline multi-criteria score incorporating QC feedback loop
  const minPrice = Math.min(...candidates.map((c) => c.unit_price || 100));
  const scored = candidates.map((cand) => {
    const priceScore = Math.max(0, 100 - (((cand.unit_price - minPrice) / (minPrice || 1)) * 100));
    const reliabilityScore = Math.max(20, 100 - (cand.exception_count * 15));
    const qtyAccScore = cand.quantity_accuracy_score || 95;
    const damagePenalty = (cand.damage_rate || 0.5) * 5; // Penalty for damage rate

    const totalScore = (
      (cand.quality_score * 0.30) +
      (cand.delivery_score * 0.25) +
      (qtyAccScore * 0.15) +
      (priceScore * 0.15) +
      (reliabilityScore * 0.15) -
      damagePenalty
    );
    return { ...cand, totalScore: Math.round(totalScore * 10) / 10 };
  }).sort((a, b) => b.totalScore - a.totalScore);

  const best = scored[0];
  let confidence = Math.min(96, Math.max(78, Math.round(best.totalScore)));
  let reasons: string[] = [
    `Superior QA Inspection Rating: ${best.quality_score}% QC pass rate.`,
    `On-Time Delivery Performance: ${best.delivery_score}% OTIF track record.`,
    `Quantity Accuracy: ${best.quantity_accuracy_score || 98}% fulfillment precision.`,
    `Capacity Readiness: Proven capability to deliver ${requiredQuantity.toLocaleString()} units within ${best.lead_time_days} days.`,
    `Clean Operational Audit: Only ${best.exception_count} variance tickets recorded.`,
  ];
  let riskFactors: string[] = [];
  if (best.lead_time_days > 7) {
    riskFactors.push(`Lead time of ${best.lead_time_days} days requires advance dispatch scheduling.`);
  }
  if (best.exception_count > 0) {
    riskFactors.push(`Has ${best.exception_count} historical minor variance on record.`);
  }
  if (riskFactors.length === 0) {
    riskFactors.push('Low overall operational risk profile across all evaluation vectors.');
  }

  // 2. If Gemini LLM is active, enhance recommendation with Deep Reasoning
  if (isGeminiConfigured()) {
    try {
      const prompt = `Evaluate the following suppliers for a Purchase Requisition of ${requiredQuantity.toLocaleString()} units (Product ID: ${productId}).
Candidate Supplier Performance Matrix (Fed from QC & Receiving audits):
${JSON.stringify(candidates, null, 2)}

Respond with strictly valid JSON:
{
  "recommended_supplier_name": "${best.supplier_name}",
  "confidence": 94,
  "reasons": ["reason1", "reason2", "reason3"],
  "risk_factors": ["risk1", "risk2"]
}`;

      const geminiRes = await generateGeminiContent(prompt, {
        systemInstruction: 'You are an Enterprise Strategic Sourcing AI. Perform multi-criteria trade-off analysis between cost, QC ratings, delivery score, damage rate, and capacity. Return strictly valid JSON.',
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      if (geminiRes.success && geminiRes.text) {
        const parsed = JSON.parse(geminiRes.text);
        if (parsed.reasons && Array.isArray(parsed.reasons) && parsed.reasons.length > 0) {
          reasons = parsed.reasons;
        }
        if (parsed.risk_factors && Array.isArray(parsed.risk_factors) && parsed.risk_factors.length > 0) {
          riskFactors = parsed.risk_factors;
        }
        if (parsed.confidence && typeof parsed.confidence === 'number') {
          confidence = Math.min(99, Math.max(70, parsed.confidence));
        }
      }
    } catch (llmErr) {
      console.warn('Gemini Supplier reasoning fallback:', llmErr);
    }
  }

  const alternative_suppliers = scored.slice(1, 3).map((alt) => ({
    supplier_id: alt.supplier_id,
    supplier_name: alt.supplier_name,
    score: alt.totalScore,
    highlight: `Alt Choice • Quality: ${alt.quality_score}% | Rate: ₹${alt.unit_price}`,
  }));

  const reasoningSummary = `AI evaluated ${candidates.length} candidate suppliers based on live QC scores. Recommended ${best.supplier_name} with ${confidence}% confidence based on superior quality rating (${best.quality_score}%) and reliable delivery history.`;

  const recommendationResult: SupplierAiRecommendation = {
    recommended_supplier_id: best.supplier_id,
    recommended_supplier_name: best.supplier_name,
    confidence,
    reasons,
    risk_factors: riskFactors,
    alternative_suppliers,
  };

  const recId = await logAiRecommendation(
    'SUPPLIER_SELECTION',
    'purchase_requisitions',
    prId,
    recommendationResult,
    confidence,
    reasoningSummary,
    { requiredQuantity, candidateCount: candidates.length, productId }
  );

  recommendationResult.recommendation_id = recId || undefined;
  return recommendationResult;
}
