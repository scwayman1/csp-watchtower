-- Create table to store AI recommendations and predictions
CREATE TABLE public.ai_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quality_rating TEXT NOT NULL,
  recommended_action TEXT,
  predicted_outcome TEXT,
  confidence_level NUMERIC,
  analysis_summary TEXT,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track actual outcomes
CREATE TABLE public.ai_recommendation_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID NOT NULL REFERENCES public.ai_recommendations(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  actual_outcome TEXT NOT NULL,
  actual_pnl NUMERIC,
  was_assigned BOOLEAN,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  prediction_accuracy NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendation_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_recommendations
CREATE POLICY "Users can view their own AI recommendations"
  ON public.ai_recommendations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI recommendations"
  ON public.ai_recommendations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage AI recommendations"
  ON public.ai_recommendations
  FOR ALL
  USING (true);

-- RLS policies for ai_recommendation_outcomes
CREATE POLICY "Users can view outcomes for their recommendations"
  ON public.ai_recommendation_outcomes
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_recommendations
    WHERE ai_recommendations.id = ai_recommendation_outcomes.recommendation_id
    AND ai_recommendations.user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage AI recommendation outcomes"
  ON public.ai_recommendation_outcomes
  FOR ALL
  USING (true);

-- Create indexes
CREATE INDEX idx_ai_recommendations_position_id ON public.ai_recommendations(position_id);
CREATE INDEX idx_ai_recommendations_user_id ON public.ai_recommendations(user_id);
CREATE INDEX idx_ai_recommendations_created_at ON public.ai_recommendations(created_at DESC);
CREATE INDEX idx_ai_recommendation_outcomes_recommendation_id ON public.ai_recommendation_outcomes(recommendation_id);
CREATE INDEX idx_ai_recommendation_outcomes_closed_at ON public.ai_recommendation_outcomes(closed_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_ai_recommendations_updated_at
  BEFORE UPDATE ON public.ai_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();