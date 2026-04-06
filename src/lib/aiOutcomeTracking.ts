import { supabase } from "@/integrations/supabase/client";

interface RecordOutcomeArgs {
  positionId: string;
  actualPnL: number;
  wasAssigned: boolean;
  closedAt: string;
}

/**
 * Map a quality rating to an "expected quality score" used to compute
 * how accurate the AI's prediction was vs the actual outcome.
 */
const qualityScoreMap: Record<string, number> = {
  excellent: 0.9,
  fair: 0.6,
  poor: 0.3,
};

function computePredictionAccuracy(qualityRating: string | null, actualPnL: number): number {
  const expected = qualityScoreMap[(qualityRating || "").toLowerCase()] ?? 0.5;
  const actual = actualPnL > 0 ? 0.9 : 0.3;
  return 1 - Math.abs(expected - actual);
}

function deriveActualOutcome(actualPnL: number, wasAssigned: boolean): string {
  if (wasAssigned) return actualPnL > 0 ? "assigned_profitable" : "assigned_loss";
  return actualPnL > 0 ? "expired_otm" : "expired_loss";
}

/**
 * Record an AI recommendation outcome for a position that just closed.
 * No-ops if the position has no recommendation or already has an outcome.
 */
export async function recordPositionOutcome({
  positionId,
  actualPnL,
  wasAssigned,
  closedAt,
}: RecordOutcomeArgs): Promise<void> {
  try {
    // Find the latest recommendation for this position
    const { data: recommendation, error: recError } = await supabase
      .from("ai_recommendations")
      .select("id, quality_rating")
      .eq("position_id", positionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recError || !recommendation) return;

    // Skip if an outcome already exists for this recommendation
    const { data: existing } = await supabase
      .from("ai_recommendation_outcomes")
      .select("id")
      .eq("recommendation_id", recommendation.id)
      .limit(1)
      .maybeSingle();

    if (existing) return;

    const actualOutcome = deriveActualOutcome(actualPnL, wasAssigned);
    const predictionAccuracy = computePredictionAccuracy(recommendation.quality_rating, actualPnL);

    await supabase.from("ai_recommendation_outcomes").insert({
      recommendation_id: recommendation.id,
      position_id: positionId,
      actual_outcome: actualOutcome,
      actual_pnl: actualPnL,
      was_assigned: wasAssigned,
      closed_at: closedAt,
      prediction_accuracy: predictionAccuracy,
    });
  } catch (err) {
    // Outcome tracking is best-effort — don't surface errors to the close flow
    console.error("Failed to record AI outcome:", err);
  }
}

/**
 * Backfill outcomes for all already-closed positions belonging to the user
 * that have a recommendation but no recorded outcome. Idempotent and cheap.
 */
export async function backfillAIOutcomes(userId: string): Promise<number> {
  try {
    // Get all closed positions for this user that have a recommendation
    const { data: recs, error } = await supabase
      .from("ai_recommendations")
      .select(`
        id,
        position_id,
        quality_rating,
        positions!inner(
          id,
          is_active,
          closed_at,
          total_premium,
          strike_price,
          underlying_price,
          contracts
        ),
        ai_recommendation_outcomes(id)
      `)
      .eq("user_id", userId);

    if (error || !recs) return 0;

    let inserted = 0;
    for (const rec of recs as any[]) {
      const pos = rec.positions;
      if (!pos || pos.is_active) continue;
      if (rec.ai_recommendation_outcomes && rec.ai_recommendation_outcomes.length > 0) continue;

      const totalPremium = Number(pos.total_premium) || 0;
      const strike = Number(pos.strike_price) || 0;
      const underlying = Number(pos.underlying_price) || 0;
      const contracts = Number(pos.contracts) || 0;

      // Heuristic: ITM at close → assigned, OTM → expired worthless
      const wasAssigned = underlying > 0 && underlying < strike;
      const assignmentLoss = wasAssigned ? Math.max(0, strike - underlying) * contracts * 100 : 0;
      const actualPnL = totalPremium - assignmentLoss;

      const actualOutcome = deriveActualOutcome(actualPnL, wasAssigned);
      const predictionAccuracy = computePredictionAccuracy(rec.quality_rating, actualPnL);

      const { error: insertError } = await supabase.from("ai_recommendation_outcomes").insert({
        recommendation_id: rec.id,
        position_id: pos.id,
        actual_outcome: actualOutcome,
        actual_pnl: actualPnL,
        was_assigned: wasAssigned,
        closed_at: pos.closed_at || new Date().toISOString(),
        prediction_accuracy: predictionAccuracy,
      });
      if (!insertError) inserted++;
    }
    return inserted;
  } catch (err) {
    console.error("Failed to backfill AI outcomes:", err);
    return 0;
  }
}
