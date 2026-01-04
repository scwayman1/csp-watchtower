export interface LearningPosition {
  id: string;
  user_id: string;
  symbol: string;
  strike_price: number;
  expiration: string;
  contracts: number;
  premium_per_contract: number;
  opened_at: string;
  closed_at?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface NewLearningPosition {
  symbol: string;
  strike_price: number;
  expiration: string;
  contracts: number;
  premium_per_contract: number;
  notes?: string;
}
