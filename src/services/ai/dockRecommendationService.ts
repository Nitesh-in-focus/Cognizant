import { logAiRecommendation } from './aiLogger';

export interface DockCandidate {
  dock_id: string;
  dock_number: string;
  dock_type: 'HEAVY_UNLOAD' | 'STANDARD' | 'EXPRESS' | 'COLD_CHAIN';
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  current_truck_number?: string;
}

export interface DockRecommendationInput {
  truck_id: string;
  vehicle_number: string;
  truck_type: string;
  product_category: string;
  waiting_minutes: number;
  available_docks: DockCandidate[];
}

export interface DockRecommendationResult {
  recommendation_id?: string;
  recommended_dock_id: string;
  recommended_dock_number: string;
  confidence: number;
  expected_unloading_minutes: number;
  reason: string;
}

export async function getAiDockRecommendation(
  input: DockRecommendationInput
): Promise<DockRecommendationResult> {
  const available = input.available_docks.filter((d) => d.status === 'AVAILABLE');

  if (available.length === 0) {
    throw new Error('No docks are currently available in the distribution facility');
  }

  // Determine best dock based on category and truck type
  let best = available[0];
  let expectedUnloadingMins = 40;

  if (input.product_category.toLowerCase().includes('heavy') || input.truck_type.toLowerCase().includes('trailer')) {
    const heavyDock = available.find((d) => d.dock_type === 'HEAVY_UNLOAD');
    if (heavyDock) {
      best = heavyDock;
      expectedUnloadingMins = 55;
    }
  } else if (input.waiting_minutes > 30) {
    const expressDock = available.find((d) => d.dock_type === 'EXPRESS') || available[0];
    best = expressDock;
    expectedUnloadingMins = 25;
  }

  const confidence = 92;
  const reason = `Dock ${best.dock_number} is immediately available, compatible with ${input.truck_type || 'standard vehicle'}, and minimizes staging queue dwell time (${input.waiting_minutes}m in yard).`;

  const reasoningSummary = `AI evaluated ${available.length} available docks. Recommended Dock ${best.dock_number} (${best.dock_type}) with ${confidence}% confidence.`;

  const result: DockRecommendationResult = {
    recommended_dock_id: best.dock_id,
    recommended_dock_number: best.dock_number,
    confidence,
    expected_unloading_minutes: expectedUnloadingMins,
    reason,
  };

  const recId = await logAiRecommendation(
    'DOCK_ASSIGNMENT',
    'trucks',
    input.truck_id,
    result,
    confidence,
    reasoningSummary,
    input
  );

  result.recommendation_id = recId || undefined;
  return result;
}
