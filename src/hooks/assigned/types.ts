export interface CoveredCall {
  id: string;
  strike_price: number;
  expiration: string;
  premium_per_contract: number;
  contracts: number;
  opened_at: string;
  is_active: boolean;
  closed_at?: string | null;
}

export interface AssignedPosition {
  id: string;
  symbol: string;
  shares: number;
  assignment_date: string;
  assignment_price: number;
  original_put_premium: number;
  original_position_id?: string | null;
  cost_basis: number;
  is_active: boolean;
  sold_price?: number | null;
  closed_at?: string | null;
  current_price?: number;
  day_change_pct?: number;
  unrealized_pnl?: number;
  realized_pnl?: number;
  total_call_premiums?: number;
  net_position?: number;
  covered_calls?: CoveredCall[];
}
