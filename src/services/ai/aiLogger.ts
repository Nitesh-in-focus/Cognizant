import { supabase } from '../../lib/supabase';
import { AiRecommendation } from '../../types/database';

export async function logAiRecommendation(
  type: AiRecommendation['recommendation_type'],
  entityType: string,
  entityId: string,
  recommendation: any,
  confidence: number,
  reasoningSummary: string,
  inputSnapshot?: any
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('ai_recommendations')
      .insert([
        {
          recommendation_type: type,
          entity_type: entityType,
          entity_id: entityId,
          model_name: 'gemini-1.5-pro',
          recommendation,
          confidence,
          reasoning_summary: reasoningSummary,
          input_snapshot: inputSnapshot || null,
          human_decision: 'PENDING',
          created_at: new Date().toISOString(),
        },
      ])
      .select('ai_recommendation_id')
      .single();

    if (error) {
      console.warn('AI recommendation logging error:', error);
      return null;
    }
    return data?.ai_recommendation_id || null;
  } catch (err) {
    console.warn('AI logger error:', err);
    return null;
  }
}

export async function recordAiHumanDecision(
  recommendationId: string,
  decision: 'ACCEPTED' | 'OVERRIDDEN' | 'REJECTED',
  decidedByUserId?: string
) {
  try {
    await supabase
      .from('ai_recommendations')
      .update({
        human_decision: decision,
        decided_by: decidedByUserId || null,
        decided_at: new Date().toISOString(),
      })
      .eq('ai_recommendation_id', recommendationId);
  } catch (err) {
    console.warn('Record AI decision error:', err);
  }
}
