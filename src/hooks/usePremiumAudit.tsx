import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, startOfYear, isAfter, isWithinInterval, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";

/**
 * FAIL-PROOF PREMIUM CALCULATION STRATEGY
 * 
 * Core Principle: Every dollar of premium is counted EXACTLY ONCE, from ONE source.
 * 
 * PREMIUM CATEGORIES (mutually exclusive):
 * 1. ACTIVE_PUT_PREMIUM - CSPs that are still open (not expired, not assigned)
 * 2. EXPIRED_PUT_PREMIUM - CSPs that expired worthless (not assigned)
 * 3. ASSIGNED_PUT_PREMIUM - CSPs that resulted in stock assignment (from assigned_positions table)
 * 4. ACTIVE_CALL_PREMIUM - Covered calls still open
 * 5. CLOSED_CALL_PREMIUM - Covered calls that expired or were exercised
 * 6. RECONCILIATION_CALL_PREMIUM - Statement calls on non-assignment stock
 * 
 * RULES:
 * - Positions table: count premium for active + expired positions
 * - When a position becomes assigned → its premium moves to assigned_positions.original_put_premium
 * - We EXCLUDE positions that became assigned from the expired count to avoid double-counting
 * - Assignment-backed calls come from covered_calls; statement calls on
 *   purchased/transferred stock come from the latest reconciliation run.
 *   The two sources are kept mutually exclusive by underlying_source.
 */

export type TimePeriod = "all" | "mtd" | "ytd" | "custom";

export interface PremiumBreakdown {
  // Put premiums
  activePutPremium: number;
  activePutCount: number;
  expiredPutPremium: number;
  expiredPutCount: number;
  assignedPutPremium: number;
  assignedPutCount: number;
  
  // Call premiums
  activeCallPremium: number;
  activeCallCount: number;
  closedCallPremium: number;
  closedCallCount: number;
  reconciliationCallPremium: number;
  reconciliationCallCount: number;
  pendingReviewPutPremium: number;
  pendingReviewPutCount: number;
  pendingReviewCallPremium: number;
  pendingReviewCallCount: number;
  statementVerifiedPremium: number | null;
  
  // Totals
  totalPutPremium: number;
  totalCallPremium: number;
  totalPremium: number;
  
  // Audit records
  auditRecords: PremiumRecord[];
}

export interface PremiumRecord {
  id: string;
  source: 'position' | 'assigned_position' | 'covered_call' | 'reconciliation_covered_call';
  category: 'active_put' | 'expired_put' | 'assigned_put' | 'active_call' | 'closed_call';
  symbol: string;
  premium: number;
  contracts: number;
  date: string;
}

interface PremiumAuditOptions {
  timePeriod?: TimePeriod;
  customDateRange?: DateRange;
}

function isDateInPeriod(dateStr: string, timePeriod: TimePeriod, customDateRange?: DateRange): boolean {
  if (timePeriod === "all") return true;
  
  const date = parseISO(dateStr);
  const now = new Date();
  
  switch (timePeriod) {
    case "mtd":
      return isAfter(date, startOfMonth(now)) || date.toDateString() === startOfMonth(now).toDateString();
    case "ytd":
      return isAfter(date, startOfYear(now)) || date.toDateString() === startOfYear(now).toDateString();
    case "custom":
      if (customDateRange?.from && customDateRange?.to) {
        return isWithinInterval(date, {
          start: customDateRange.from,
          end: customDateRange.to,
        });
      }
      return true;
    default:
      return true;
  }
}

export function usePremiumAudit(userId?: string, options?: PremiumAuditOptions) {
  const [breakdown, setBreakdown] = useState<PremiumBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const timePeriod = options?.timePeriod ?? "all";
  const customDateRange = options?.customDateRange;

  const calculatePremiums = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const auditRecords: PremiumRecord[] = [];
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Get ALL positions for this user
      const { data: positions, error: posError } = await supabase
        .from('positions')
        .select('id, symbol, premium_per_contract, contracts, expiration, is_active, opened_at, reconciliation_status')
        .eq('user_id', userId);
      
      if (posError) throw posError;
      
      // 2. Get ALL assigned positions (to know which position IDs were assigned)
      const { data: assignedPositions, error: apError } = await supabase
        .from('assigned_positions')
        .select('id, symbol, original_put_premium, original_position_id, is_active, assignment_date, shares, reconciliation_status')
        .eq('user_id', userId);
      
      if (apError) throw apError;
      
      // 3. Get ALL covered calls
      const { data: coveredCalls, error: ccError } = await supabase
        .from('covered_calls')
        .select(`
          id, 
          premium_per_contract, 
          contracts, 
          ingestion_key,
          is_active, 
          opened_at,
          expiration,
          strike_price,
          reconciliation_status,
          assigned_position_id,
          assigned_positions!inner(symbol, user_id)
        `)
        .eq('assigned_positions.user_id', userId);
      
      if (ccError) throw ccError;

      // Calls on purchased/transferred stock are intentionally stored in the
      // reconciliation snapshot, not in the assignment-only covered_calls
      // ledger. Read only the latest applied run and tolerate older databases
      // before the additive migration is deployed.
      let reconciliationCoveredCalls: Array<{
        id: string;
        symbol: string;
        premium_per_contract: number;
        contracts: number;
        ingestion_key: string | null;
        is_active: boolean;
        opened_at: string | null;
        expiration: string;
        strike_price: number;
        status: string;
        underlying_source: string;
        source_document?: string | null;
        source_page?: number | null;
      }> = [];
      const { data: reconciliationRun, error: reconciliationRunError } = await supabase
        .from('current_account_reconciliation_rollup')
        .select('run_id, cumulative_premium_to_date')
        .eq('user_id', userId)
        .maybeSingle();

      const isMissingReconciliationRelation = (error: { code?: string } | null) =>
        error?.code === '42P01' || error?.code === 'PGRST205';

      if (reconciliationRunError && !isMissingReconciliationRelation(reconciliationRunError)) {
        throw reconciliationRunError;
      }

      const statementVerifiedPremium = reconciliationRun?.cumulative_premium_to_date == null
        ? null
        : Number(reconciliationRun.cumulative_premium_to_date);

      if (reconciliationRun?.run_id) {
        const { data: reconciliationCalls, error: reconciliationCallError } = await supabase
          .from('account_reconciliation_covered_calls')
          .select('id, symbol, premium_per_contract, contracts, opened_at, expiration, strike_price, status, underlying_source, source_event_key, metadata')
          .eq('run_id', reconciliationRun.run_id)
          .neq('underlying_source', 'assigned_position');

        // This is an additive compatibility path: an older deployment simply
        // has no table yet, and should continue using the core ledger.
        if (reconciliationCallError && !isMissingReconciliationRelation(reconciliationCallError)) {
          throw reconciliationCallError;
        }
        reconciliationCoveredCalls = (reconciliationCalls || []).map((call) => ({
          ...call,
          ingestion_key: call.source_event_key,
          is_active: call.status === 'open',
          source_document: typeof call.metadata?.source_document === 'string' ? call.metadata.source_document : null,
          source_page: typeof call.metadata?.source_page === 'number' ? call.metadata.source_page : null,
        }));
      }

      // An economic signature is not an identity: repeated executions can
      // legitimately share it. Suppress a core row only when its staged
      // ingestion key carries the same statement source location as a
      // reconciliation row, consuming matches one-for-one.
      const reconciliationSourcesBySignature = new Map<string, Array<{ document: string | null; page: number | null }>>();
      for (const call of reconciliationCoveredCalls) {
        const signature = `${call.symbol}|${call.expiration}|${Number(call.strike_price)}|${Number(call.contracts)}`;
        const sources = reconciliationSourcesBySignature.get(signature) || [];
        sources.push({ document: call.source_document || null, page: call.source_page || null });
        reconciliationSourcesBySignature.set(signature, sources);
      }
      const parseStatementSourceLocation = (ingestionKey: string | null | undefined) => {
        const match = ingestionKey?.match(/^stmt:canonical:option_open:([^:]+):([^:]+):/);
        return match ? { document: match[1], page: Number(match[2]) } : null;
      };
      const isSourceLinkedReconciliationOverlap = (call: { symbol: string; expiration: string; strike_price: number; contracts: number; ingestion_key?: string | null }) => {
        const source = parseStatementSourceLocation(call.ingestion_key);
        if (!source) return false;
        const signature = `${call.symbol}|${call.expiration}|${Number(call.strike_price)}|${Number(call.contracts)}`;
        const candidates = reconciliationSourcesBySignature.get(signature) || [];
        const matchIndex = candidates.findIndex((candidate) => candidate.document === source.document && candidate.page === source.page);
        if (matchIndex < 0) return false;
        candidates.splice(matchIndex, 1);
        return true;
      };
      
      // Create set of position IDs that became assigned (to exclude from expired count)
      const assignedPositionIds = new Set(
        (assignedPositions || [])
          .map(ap => ap.original_position_id)
          .filter(Boolean)
      );
      
      // CATEGORY 1 & 2: Active and Expired PUT premiums from positions table
      let activePutPremium = 0;
      let activePutCount = 0;
      let expiredPutPremium = 0;
      let expiredPutCount = 0;
      let pendingReviewPutPremium = 0;
      let pendingReviewPutCount = 0;
      
      for (const pos of positions || []) {
        // Use opened_at for time filtering, fallback to expiration
        const relevantDate = pos.opened_at || pos.expiration;
        if (!isDateInPeriod(relevantDate, timePeriod, customDateRange)) continue;
        
        const premium = parseFloat(String(pos.premium_per_contract)) * pos.contracts * 100;
        const isVerified = pos.reconciliation_status === 'confirmed' || pos.reconciliation_status === 'auto_applied';
        if (!isVerified) {
          pendingReviewPutPremium += premium;
          pendingReviewPutCount += pos.contracts;
          continue;
        }
        const isExpired = pos.expiration < today;
        const wasAssigned = assignedPositionIds.has(pos.id);
        
        if (!isExpired) {
          // Active position
          activePutPremium += premium;
          activePutCount += pos.contracts;
          auditRecords.push({
            id: pos.id,
            source: 'position',
            category: 'active_put',
            symbol: pos.symbol,
            premium,
            contracts: pos.contracts,
            date: pos.expiration,
          });
        } else if (!wasAssigned) {
          // Expired but NOT assigned (expired worthless)
          expiredPutPremium += premium;
          expiredPutCount += pos.contracts;
          auditRecords.push({
            id: pos.id,
            source: 'position',
            category: 'expired_put',
            symbol: pos.symbol,
            premium,
            contracts: pos.contracts,
            date: pos.expiration,
          });
        }
        // If expired AND assigned, we skip it here - premium counted in assigned_positions
      }
      
      // CATEGORY 3: Assigned PUT premiums from assigned_positions table
      let assignedPutPremium = 0;
      let assignedPutCount = 0;
      
      for (const ap of assignedPositions || []) {
        if (!isDateInPeriod(ap.assignment_date, timePeriod, customDateRange)) continue;
        
        const premium = parseFloat(String(ap.original_put_premium)) || 0;
        const contracts = Math.floor(ap.shares / 100); // Convert shares back to contracts
        const isVerified = ap.reconciliation_status === 'confirmed' || ap.reconciliation_status === 'auto_applied';
        if (!isVerified) {
          pendingReviewPutPremium += premium;
          pendingReviewPutCount += contracts;
          continue;
        }
        assignedPutPremium += premium;
        assignedPutCount += contracts;
        auditRecords.push({
          id: ap.id,
          source: 'assigned_position',
          category: 'assigned_put',
          symbol: ap.symbol,
          premium: ap.original_put_premium,
          contracts: Math.floor(ap.shares / 100),
          date: ap.assignment_date,
        });
      }
      
      // CATEGORY 4 & 5: Active and Closed CALL premiums from covered_calls table
      let activeCallPremium = 0;
      let activeCallCount = 0;
      let closedCallPremium = 0;
      let closedCallCount = 0;
      let reconciliationCallPremium = 0;
      let reconciliationCallCount = 0;
      let pendingReviewCallPremium = 0;
      let pendingReviewCallCount = 0;
      
      for (const cc of coveredCalls || []) {
        // Use opened_at for time filtering
        if (!isDateInPeriod(cc.opened_at, timePeriod, customDateRange)) continue;
        
        const premium = parseFloat(String(cc.premium_per_contract)) * cc.contracts * 100;
        const symbol = (cc.assigned_positions as any)?.symbol || 'UNKNOWN';

        if (isSourceLinkedReconciliationOverlap({
          symbol,
          expiration: cc.expiration,
          strike_price: cc.strike_price,
          contracts: cc.contracts,
          ingestion_key: cc.ingestion_key,
        })) continue;

        const isVerified = cc.reconciliation_status === 'confirmed' || cc.reconciliation_status === 'auto_applied';
        if (!isVerified) {
          pendingReviewCallPremium += premium;
          pendingReviewCallCount += cc.contracts;
          continue;
        }
        
        // A call is truly active only if is_active=true AND not expired
        // (handles stale is_active flags when expiration passed)
        const isExpired = cc.expiration < today;
        const isTrulyActive = cc.is_active && !isExpired;
        
        if (isTrulyActive) {
          activeCallPremium += premium;
          activeCallCount += cc.contracts;
          auditRecords.push({
            id: cc.id,
            source: 'covered_call',
            category: 'active_call',
            symbol,
            premium,
            contracts: cc.contracts,
            date: cc.opened_at,
          });
        } else {
          closedCallPremium += premium;
          closedCallCount += cc.contracts;
          auditRecords.push({
            id: cc.id,
            source: 'covered_call',
            category: 'closed_call',
            symbol,
            premium,
            contracts: cc.contracts,
            date: cc.opened_at,
          });
        }
      }

      for (const cc of reconciliationCoveredCalls) {
        if (!cc.opened_at || !isDateInPeriod(cc.opened_at, timePeriod, customDateRange)) continue;

        const premium = parseFloat(String(cc.premium_per_contract)) * cc.contracts * 100;
        const isExpired = cc.expiration < today;
        const isTrulyActive = cc.is_active && !isExpired;
        reconciliationCallPremium += premium;
        reconciliationCallCount += cc.contracts;
        if (isTrulyActive) {
          activeCallPremium += premium;
          activeCallCount += cc.contracts;
        } else {
          closedCallPremium += premium;
          closedCallCount += cc.contracts;
        }
        auditRecords.push({
          id: cc.id,
          source: 'reconciliation_covered_call',
          category: isTrulyActive ? 'active_call' : 'closed_call',
          symbol: cc.symbol,
          premium,
          contracts: cc.contracts,
          date: cc.opened_at,
        });
      }
      
      // Calculate totals
      const totalPutPremium = activePutPremium + expiredPutPremium + assignedPutPremium;
      const totalCallPremium = activeCallPremium + closedCallPremium;
      const computedPremium = totalPutPremium + totalCallPremium;
      // Once the reconciled statement run is present, its canonical opening
      // ledger is the verified whole-account control. Assignment rows and
      // board mirrors remain available for lifecycle review but cannot add a
      // second copy of the same opening premium.
      const totalPremium = statementVerifiedPremium ?? computedPremium;
      
      setBreakdown({
        activePutPremium,
        activePutCount,
        expiredPutPremium,
        expiredPutCount,
        assignedPutPremium,
        assignedPutCount,
        activeCallPremium,
        activeCallCount,
        closedCallPremium,
        closedCallCount,
        reconciliationCallPremium,
        reconciliationCallCount,
        pendingReviewPutPremium,
        pendingReviewPutCount,
        pendingReviewCallPremium,
        pendingReviewCallCount,
        statementVerifiedPremium,
        totalPutPremium,
        totalCallPremium,
        totalPremium,
        auditRecords,
      });
      
      // Log for debugging
      console.log('[PremiumAudit] Breakdown:', {
        timePeriod,
        activePutPremium: activePutPremium.toFixed(2),
        expiredPutPremium: expiredPutPremium.toFixed(2),
        assignedPutPremium: assignedPutPremium.toFixed(2),
        activeCallPremium: activeCallPremium.toFixed(2),
        closedCallPremium: closedCallPremium.toFixed(2),
        totalPremium: totalPremium.toFixed(2),
        recordCount: auditRecords.length,
      });
      
    } catch (err: any) {
      console.error('[PremiumAudit] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, timePeriod, customDateRange]);

  useEffect(() => {
    calculatePremiums();
  }, [calculatePremiums]);

  return { breakdown, loading, error, refetch: calculatePremiums };
}
