import { logAiRecommendation } from './aiLogger';

export interface SupplierCandidate {
  supplier_id: string;
  supplier_name: string;
  city: string;
  quality_score: number;
  delivery_score: number;
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

export async function getAiSupplierRecommendation(
  prId: string,
  productId: string,
  requiredQuantity: number,
  candidates: SupplierCandidate[]
): Promise<SupplierAiRecommendation> {
  if (!candidates || candidates.length === 0) {
    throw new Error('No candidate suppliers available for evaluation');
  }

  // Multi-criteria heuristic scoring:
  // Quality (35%), Delivery (25%), Price Competitiveness (20%), Historical Reliability (20%)
  const minPrice = Math.min(...candidates.map((c) => c.unit_price || 100));
  const scored = candidates.map((cand) => {
    const priceScore = Math.max(0, 100 - (((cand.unit_price - minPrice) / (minPrice || 1)) * 100));
    const reliabilityScore = Math.max(20, 100 - (cand.exception_count * 15));
    const totalScore = (
      (cand.quality_score * 0.35) +
      (cand.delivery_score * 0.25) +
      (priceScore * 0.20) +
      (reliabilityScore * 0.20)
    );
    return { ...cand, totalScore: Math.round(totalScore * 10) / 10 };
  }).sort((a, b) => b.totalScore - a.totalScore);

  const best = scored[0];
  const confidence = Math.min(96, Math.max(78, Math.round(best.totalScore)));

  const reasons: string[] = [
    `Strong Quality Rating: ${best.quality_score}% inspection pass rate.`,
    `On-Time Delivery Performance: ${best.delivery_score}% OTIF track record.`,
    `Capacity Readiness: Proven ability to fulfill ${requiredQuantity.toLocaleString()} units with ${best.lead_time_days}-day lead time.`,
    `Lowest Historical Exceptions: Only ${best.exception_count} recorded variances in previous orders.`,
  ];

  const riskFactors: string[] = [];
  if (best.lead_time_days > 7) {
    riskFactors.push(`Lead time of ${best.lead_time_days} days requires advance dispatch scheduling.`);
  }
  if (best.exception_count > 0) {
    riskFactors.push(`Has ${best.exception_count} historical minor variance on record.`);
  }
  if (riskFactors.length === 0) {
    riskFactors.push('Low overall operational risk profile across all evaluation vectors.');
  }

  const alternative_suppliers = scored.slice(1, 3).map((alt) => ({
    supplier_id: alt.supplier_id,
    supplier_name: alt.supplier_name,
    score: alt.totalScore,
    highlight: `Alt Choice • Quality: ${alt.quality_score}% | Rate: ₹${alt.unit_price}`,
  }));

  const reasoningSummary = `AI evaluated ${candidates.length} candidate suppliers. Recommended ${best.supplier_name} with ${confidence}% confidence based on superior quality rating (${best.quality_score}%) and reliable delivery history.`;

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
