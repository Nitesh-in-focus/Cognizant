import { logAiRecommendation } from './aiLogger';

export interface ShipmentPriorityInput {
  shipment_id: string;
  shipment_number: string;
  po_number: string;
  product_name: string;
  is_production_critical: boolean;
  delay_minutes: number;
  remaining_travel_minutes: number;
  warehouse_dock_congestion: 'HIGH' | 'NORMAL' | 'LOW';
}

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ShipmentPriorityResult {
  recommendation_id?: string;
  priority_level: PriorityLevel;
  urgency_score: number; // 0-100
  reason: string;
  recommended_dock_priority: 'FAST_TRACK' | 'STANDARD' | 'BUFFER_QUEUE';
}

export async function calculateShipmentPriority(
  input: ShipmentPriorityInput
): Promise<ShipmentPriorityResult> {
  let score = 30; // base score

  if (input.is_production_critical) score += 35;
  if (input.delay_minutes > 45) score += 25;
  else if (input.delay_minutes > 15) score += 15;
  if (input.remaining_travel_minutes < 60) score += 10;
  if (input.warehouse_dock_congestion === 'HIGH') score -= 5;

  let priority_level: PriorityLevel = 'LOW';
  let dockPriority: 'FAST_TRACK' | 'STANDARD' | 'BUFFER_QUEUE' = 'STANDARD';

  if (score >= 75) {
    priority_level = 'CRITICAL';
    dockPriority = 'FAST_TRACK';
  } else if (score >= 55) {
    priority_level = 'HIGH';
    dockPriority = 'FAST_TRACK';
  } else if (score >= 40) {
    priority_level = 'MEDIUM';
    dockPriority = 'STANDARD';
  } else {
    priority_level = 'LOW';
    dockPriority = 'BUFFER_QUEUE';
  }

  const reason = input.is_production_critical && input.delay_minutes > 20
    ? `Shipment #${input.shipment_number} contains critical component (${input.product_name}) and is delayed by ${input.delay_minutes} mins.`
    : input.is_production_critical
    ? `Production-essential materials for manufacturing line schedule.`
    : input.delay_minutes > 30
    ? `Corridor delay of ${input.delay_minutes} mins requires expedited gate check-in.`
    : `Routine scheduled inbound shipment under nominal SLA parameters.`;

  const reasoningSummary = `AI assigned priority ${priority_level} (Urgency: ${score}/100) to shipment #${input.shipment_number}. Recommendation: ${dockPriority}.`;

  const result: ShipmentPriorityResult = {
    priority_level,
    urgency_score: score,
    reason,
    recommended_dock_priority: dockPriority,
  };

  const recId = await logAiRecommendation(
    'SHIPMENT_PRIORITY',
    'shipments',
    input.shipment_id,
    result,
    88,
    reasoningSummary,
    input
  );

  result.recommendation_id = recId || undefined;
  return result;
}
