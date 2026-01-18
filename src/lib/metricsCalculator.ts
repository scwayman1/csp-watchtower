// Client-side metrics calculator - moved from edge function to avoid network overhead

interface UserSettings {
  safe_threshold: number;
  warning_threshold: number;
  probability_model: 'delta' | 'black-scholes' | 'heuristic';
  volatility_sensitivity: number;
}

interface Position {
  strike_price: number;
  expiration: string;
  premium_per_contract: number;
  contracts: number;
  open_fees?: number;
}

interface MetricsResult {
  daysToExp: number;
  pctAboveStrike: number;
  statusBand: 'success' | 'warning' | 'destructive';
  contractValue: number;
  totalPremium: number;
  unrealizedPnL: number;
  probAssignment: number;
}

// Black-Scholes approximation for put option pricing
function blackScholesPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(K - S, 0);
  
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  const normCDF = (x: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  };
  
  return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
}

// Heuristic assignment probability using sigmoid
function heuristicProbability(underlyingPrice: number, strikePrice: number, daysToExp: number, volSensitivity: number): number {
  const pctDiff = (underlyingPrice - strikePrice) / strikePrice;
  const timeDecay = Math.max(0.1, daysToExp / 365);
  
  const z = -(pctDiff / (volSensitivity * Math.sqrt(timeDecay)));
  const prob = 1 / (1 + Math.exp(-z * 5));
  
  return Math.max(0, Math.min(100, prob * 100));
}

// Black-Scholes delta for put option
function blackScholesDelta(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return S < K ? 100 : 0;
  
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  
  const normCDF = (x: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  };
  
  const delta = normCDF(d1) - 1;
  return Math.abs(delta) * 100;
}

const DEFAULT_SETTINGS: UserSettings = {
  safe_threshold: 10,
  warning_threshold: 5,
  probability_model: 'delta',
  volatility_sensitivity: 0.15,
};

export function calculateMetrics(
  position: Position,
  underlyingPrice: number,
  markPrice?: number | null,
  settings: Partial<UserSettings> = {}
): MetricsResult {
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  
  const today = new Date();
  const expiration = new Date(position.expiration);
  const daysToExp = Math.max(0, Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  const pctAboveStrike = ((underlyingPrice - position.strike_price) / position.strike_price) * 100;
  
  // Determine status band
  let statusBand: 'success' | 'warning' | 'destructive';
  if (pctAboveStrike >= mergedSettings.safe_threshold) {
    statusBand = 'success';
  } else if (pctAboveStrike >= mergedSettings.warning_threshold) {
    statusBand = 'warning';
  } else {
    statusBand = 'destructive';
  }

  const totalPremium = position.premium_per_contract * 100 * position.contracts;
  
  // Calculate contract value
  let contractValue: number;
  if (markPrice && markPrice > 0) {
    contractValue = markPrice * 100 * position.contracts;
  } else {
    const T = daysToExp / 365;
    if (T > 0) {
      const r = 0.05;
      const sigma = 0.30;
      const bsPrice = blackScholesPut(underlyingPrice, position.strike_price, T, r, sigma);
      contractValue = bsPrice * 100 * position.contracts;
    } else {
      const intrinsicValue = Math.max(0, position.strike_price - underlyingPrice);
      contractValue = intrinsicValue * 100 * position.contracts;
    }
  }

  const unrealizedPnL = totalPremium - contractValue - (position.open_fees || 0);

  // Calculate probability of assignment
  let probAssignment: number;
  const T = daysToExp / 365;
  const r = 0.05;
  
  switch (mergedSettings.probability_model) {
    case 'black-scholes':
      probAssignment = blackScholesDelta(
        underlyingPrice, 
        position.strike_price, 
        T, 
        r, 
        mergedSettings.volatility_sensitivity * 2
      );
      break;
    case 'heuristic':
      probAssignment = heuristicProbability(
        underlyingPrice, 
        position.strike_price, 
        daysToExp,
        mergedSettings.volatility_sensitivity
      );
      break;
    case 'delta':
    default:
      probAssignment = blackScholesDelta(
        underlyingPrice, 
        position.strike_price, 
        T, 
        r, 
        mergedSettings.volatility_sensitivity * 2
      );
      break;
  }

  return {
    daysToExp,
    pctAboveStrike: parseFloat(pctAboveStrike.toFixed(2)),
    statusBand,
    contractValue: parseFloat(contractValue.toFixed(2)),
    totalPremium: parseFloat(totalPremium.toFixed(2)),
    unrealizedPnL: parseFloat(unrealizedPnL.toFixed(2)),
    probAssignment: parseFloat(probAssignment.toFixed(1)),
  };
}
