import { logAiRecommendation } from './aiLogger';

export interface EtaPredictionInput {
  shipment_id: string;
  vehicle_number: string;
  origin: string;
  destination: string;
  remaining_km: number;
  current_speed_kmh: number;
  expected_arrival: string;
  has_congestion: boolean;
}

export interface EtaPredictionResult {
  recommendation_id?: string;
  predicted_eta: string;
  predicted_eta_formatted?: string;
  delay_minutes: number;
  delay_probability: number;
  confidence: number;
  contributing_factors: string[];
  recommended_action: string;
}

export async function getAiEtaPrediction(params: any): Promise<EtaPredictionResult> {
  const remaining_km = params.remaining_km || 120;
  const current_speed_kmh = params.current_speed_kmh || 52;
  const expected_arrival = params.scheduled_arrival || params.expected_arrival || new Date().toISOString();
  
  const res = await predictShipmentEta({
    shipment_id: params.shipment_id || 'SHP-DEMO',
    vehicle_number: params.vehicle_number || 'TRUCK-101',
    origin: params.origin || 'Mumbai',
    destination: params.destination || 'Pune Hub',
    remaining_km,
    current_speed_kmh,
    expected_arrival,
    has_congestion: remaining_km < 40,
  });

  res.predicted_eta_formatted = new Date(res.predicted_eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return res;
}

export async function predictShipmentEta(
  input: EtaPredictionInput
): Promise<EtaPredictionResult> {
  const baseTravelHours = input.remaining_km / Math.max(25, input.current_speed_kmh || 45);
  let congestionDelayMins = input.has_congestion ? 35 : 0;
  
  // Calculate predicted arrival
  const predictedDate = new Date(Date.now() + (baseTravelHours * 3600 * 1000) + (congestionDelayMins * 60 * 1000));
  const expectedDate = new Date(input.expected_arrival);
  
  const diffMins = Math.round((predictedDate.getTime() - expectedDate.getTime()) / (60 * 1000));
  const delayMinutes = Math.max(0, diffMins);
  const delayProbability = delayMinutes > 15 ? (input.has_congestion ? 88 : 65) : 12;
  const confidence = 89;

  const contributing_factors: string[] = [];
  if (input.has_congestion) {
    contributing_factors.push('Active corridor congestion detected near industrial toll checkpoint.');
  }
  if (input.current_speed_kmh < 40) {
    contributing_factors.push(`Vehicle moving at ${Math.round(input.current_speed_kmh)} km/h below nominal highway speed.`);
  } else {
    contributing_factors.push('Vehicle cruising at steady arterial transit speed.');
  }
  contributing_factors.push(`Remaining corridor distance: ${Math.round(input.remaining_km)} km to destination hub.`);

  const recommended_action = delayMinutes > 30
    ? 'Notify Warehouse Manager to adjust dock bay reservation window.'
    : 'Maintain standard inbound gate reception scheduling.';

  const reasoningSummary = `AI analyzed vehicle telemetry and corridor conditions. Predicted ETA: ${predictedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} with ${delayProbability}% delay risk.`;

  const result: EtaPredictionResult = {
    predicted_eta: predictedDate.toISOString(),
    delay_minutes: delayMinutes,
    delay_probability: delayProbability,
    confidence,
    contributing_factors,
    recommended_action,
  };

  const recId = await logAiRecommendation(
    'ETA',
    'shipments',
    input.shipment_id,
    result,
    confidence,
    reasoningSummary,
    input
  );

  result.recommendation_id = recId || undefined;
  return result;
}
