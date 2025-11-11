import { useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { ImportBar } from "@/components/dashboard/ImportBar";
import { FiltersToolbar } from "@/components/dashboard/FiltersToolbar";
import { PositionsTable } from "@/components/dashboard/PositionsTable";
import { mockPositions } from "@/lib/mockData";
import { DollarSign, FileText, Calendar, AlertTriangle } from "lucide-react";

const Dashboard = () => {
  const [positions] = useState(mockPositions);
  
  // Calculate portfolio stats
  const totalPremium = positions.reduce((sum, p) => sum + p.totalPremium, 0);
  const activeContracts = positions.reduce((sum, p) => sum + p.contracts, 0);
  const atRiskCount = positions.filter(p => p.pctAboveStrike < 5).length;
  
  // Find next expiration
  const sortedByExp = [...positions].sort((a, b) => a.daysToExp - b.daysToExp);
  const nextExp = sortedByExp[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Cash-Secured Put Tracker</h1>
          <p className="text-muted-foreground">
            Monitor your positions with real-time risk metrics and assignment probabilities
          </p>
        </div>

        {/* Portfolio Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Premium Collected"
            value={`$${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Across all positions"
            icon={DollarSign}
          />
          <StatCard
            title="Active Contracts"
            value={activeContracts.toString()}
            subtitle={`${positions.length} positions`}
            icon={FileText}
          />
          <StatCard
            title="Next Expiration"
            value={nextExp ? `${nextExp.daysToExp} days` : "—"}
            subtitle={nextExp?.expiration}
            icon={Calendar}
          />
          <StatCard
            title="At-Risk Positions"
            value={atRiskCount.toString()}
            subtitle="< 5% above strike"
            icon={AlertTriangle}
            badgeVariant={atRiskCount > 0 ? "destructive" : "success"}
            badgeLabel={atRiskCount > 0 ? "ALERT" : "SAFE"}
          />
        </div>

        {/* Import Bar */}
        <ImportBar />

        {/* Filters */}
        <FiltersToolbar
          onSearchChange={() => {}}
          onRiskBandChange={() => {}}
          onExpirationChange={() => {}}
        />

        {/* Positions Table */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Active Positions</h2>
          <PositionsTable positions={positions} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
