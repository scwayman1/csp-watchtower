import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, startOfYear, subMonths } from "date-fns";

export interface PremiumBreakdown {
  puts: number;
  assignedPuts: number;
  coveredCalls: number;
}

export interface AdvisorMetrics {
  // Client counts
  totalClients: number;
  activeClients: number;
  activeCycles: number;
  
  // Aggregated AUM (from real data)
  totalAUM: number;
  
  // Premium metrics - calculated from raw position data
  totalPremiumAllTime: number;
  totalPremiumYTD: number;
  totalPremiumMTD: number;
  totalPremiumLastMonth: number;
  
  // Premium breakdown by type
  premiumBreakdown: PremiumBreakdown;
  
  // Growth metrics
  momGrowthPct: number | null;  // Month over month premium growth
  ytdGrowthPct: number | null;  // YTD return on AUM
  
  // Loading state
  isLoading: boolean;
}

export function useAdvisorMetrics(): AdvisorMetrics {
  const now = new Date();
  const yearStart = startOfYear(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
  const lastMonthEnd = startOfMonth(now).toISOString();

  // Get current advisor's clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["advisor-clients-for-metrics"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("clients")
        .select("id, user_id, name, portfolio_value")
        .eq("advisor_id", user.id);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get active cycles count
  const { data: cycles, isLoading: cyclesLoading } = useQuery({
    queryKey: ["advisor-active-cycles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("cycles")
        .select("id")
        .eq("advisor_id", user.id)
        .in("status", ["DRAFT", "PUBLISHED"]);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get user IDs of linked clients
  const clientUserIds = (clients || [])
    .map(c => c.user_id)
    .filter((id): id is string => id !== null);

  // Fetch all positions for all clients
  const { data: allPositions, isLoading: positionsLoading } = useQuery({
    queryKey: ["advisor-all-client-positions", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("positions")
        .select("user_id, premium_per_contract, contracts, is_active, opened_at")
        .in("user_id", clientUserIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // Fetch all assigned positions for all clients
  const { data: allAssignedPositions, isLoading: assignedLoading } = useQuery({
    queryKey: ["advisor-all-client-assigned", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("assigned_positions")
        .select("user_id, original_put_premium, assignment_date, id")
        .in("user_id", clientUserIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // Get assigned position IDs for covered calls query
  const assignedPosIds = (allAssignedPositions || []).map(ap => ap.id);

  // Fetch all covered calls for all clients
  const { data: allCoveredCalls, isLoading: callsLoading } = useQuery({
    queryKey: ["advisor-all-client-covered-calls", assignedPosIds],
    queryFn: async () => {
      if (assignedPosIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("covered_calls")
        .select("assigned_position_id, premium_per_contract, contracts, opened_at")
        .in("assigned_position_id", assignedPosIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: assignedPosIds.length > 0,
  });

  // Fetch user settings for AUM calculation
  const { data: allUserSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["advisor-all-client-settings", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("user_settings")
        .select("user_id, cash_balance, other_holdings_value")
        .in("user_id", clientUserIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // ========== CALCULATIONS ==========
  
  // Total clients and active clients (has open positions)
  const totalClients = clients?.length || 0;
  
  const clientsWithOpenPositions = new Set(
    (allPositions || [])
      .filter(p => p.is_active)
      .map(p => p.user_id)
  );
  const activeClients = clientsWithOpenPositions.size;
  const activeCycles = cycles?.length || 0;

  // Calculate AUM from user settings (cash + other holdings + premiums)
  const calculateAUM = () => {
    let totalAUM = 0;
    
    for (const userId of clientUserIds) {
      const settings = (allUserSettings || []).find(s => s.user_id === userId);
      const cashBalance = parseFloat(String(settings?.cash_balance || 0));
      const otherHoldings = parseFloat(String(settings?.other_holdings_value || 0));
      
      // Add position premiums for this user
      const userPositionPremium = (allPositions || [])
        .filter(p => p.user_id === userId)
        .reduce((sum, p) => sum + parseFloat(String(p.premium_per_contract)) * parseFloat(String(p.contracts)) * 100, 0);
      
      const userAssignedPremium = (allAssignedPositions || [])
        .filter(ap => ap.user_id === userId)
        .reduce((sum, ap) => sum + parseFloat(String(ap.original_put_premium)), 0);
      
      totalAUM += cashBalance + otherHoldings + userPositionPremium + userAssignedPremium;
    }
    
    return totalAUM;
  };

  // Calculate premiums with time filters and breakdown by type
  const calculatePremiums = () => {
    let allTime = 0;
    let ytd = 0;
    let mtd = 0;
    let lastMonth = 0;
    
    // Breakdown by type (all-time)
    let putsPremium = 0;
    let assignedPutsPremium = 0;
    let coveredCallsPremium = 0;

    // Position premiums (active puts)
    for (const pos of (allPositions || [])) {
      const premium = parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
      allTime += premium;
      putsPremium += premium;
      
      if (pos.opened_at >= yearStart) ytd += premium;
      if (pos.opened_at >= monthStart) mtd += premium;
      if (pos.opened_at >= lastMonthStart && pos.opened_at < lastMonthEnd) lastMonth += premium;
    }

    // Assigned position premiums (puts that got assigned)
    for (const ap of (allAssignedPositions || [])) {
      const premium = parseFloat(String(ap.original_put_premium));
      allTime += premium;
      assignedPutsPremium += premium;
      
      if (ap.assignment_date >= yearStart) ytd += premium;
      if (ap.assignment_date >= monthStart) mtd += premium;
      if (ap.assignment_date >= lastMonthStart && ap.assignment_date < lastMonthEnd) lastMonth += premium;
    }

    // Covered call premiums
    for (const cc of (allCoveredCalls || [])) {
      const premium = parseFloat(String(cc.premium_per_contract)) * parseFloat(String(cc.contracts)) * 100;
      allTime += premium;
      coveredCallsPremium += premium;
      
      if (cc.opened_at >= yearStart) ytd += premium;
      if (cc.opened_at >= monthStart) mtd += premium;
      if (cc.opened_at >= lastMonthStart && cc.opened_at < lastMonthEnd) lastMonth += premium;
    }

    return { 
      allTime, 
      ytd, 
      mtd, 
      lastMonth,
      breakdown: {
        puts: putsPremium,
        assignedPuts: assignedPutsPremium,
        coveredCalls: coveredCallsPremium,
      }
    };
  };

  const totalAUM = calculateAUM();
  const premiums = calculatePremiums();

  // Calculate growth metrics
  const momGrowthPct = premiums.lastMonth > 0 
    ? ((premiums.mtd - premiums.lastMonth) / premiums.lastMonth) * 100 
    : null;
  
  const ytdGrowthPct = totalAUM > 0 
    ? (premiums.ytd / totalAUM) * 100 
    : null;

  const isLoading = clientsLoading || cyclesLoading || positionsLoading || 
    assignedLoading || callsLoading || settingsLoading;

  return {
    totalClients,
    activeClients,
    activeCycles,
    totalAUM,
    totalPremiumAllTime: premiums.allTime,
    totalPremiumYTD: premiums.ytd,
    totalPremiumMTD: premiums.mtd,
    totalPremiumLastMonth: premiums.lastMonth,
    premiumBreakdown: premiums.breakdown,
    momGrowthPct,
    ytdGrowthPct,
    isLoading,
  };
}
