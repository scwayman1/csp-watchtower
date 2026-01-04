export interface LearningCoveredCall {
  id: string;
  learning_assigned_position_id: string;
  strike_price: number;
  expiration: string;
  premium_per_contract: number;
  contracts: number;
  opened_at: string;
  closed_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningAssignedPosition {
  id: string;
  user_id: string;
  symbol: string;
  shares: number;
  assignment_date: string;
  assignment_price: number;
  cost_basis: number;
  original_learning_position_id?: string;
  original_put_premium: number;
  is_active: boolean;
  sold_price?: number;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  covered_calls?: LearningCoveredCall[];
}
