import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShareManagement } from "@/components/settings/ShareManagement";
import { AuditTrail } from "@/components/settings/AuditTrail";
import { PortfolioIngestion } from "@/components/settings/PortfolioIngestion";
import { StatementReconciliation } from "@/components/dashboard/StatementReconciliation";
import { RoleManager } from "@/components/RoleManager";
import { Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [provider, setProvider] = useState("yahoo");
  const [refreshRate, setRefreshRate] = useState("60");
  const [safeThreshold, setSafeThreshold] = useState("10");
  const [warningThreshold, setWarningThreshold] = useState("5");
  const [probabilityModel, setProbabilityModel] = useState("delta");
  const [volSensitivity, setVolSensitivity] = useState("0.15");
  const [cashBalance, setCashBalance] = useState("0");
  const [otherHoldingsValue, setOtherHoldingsValue] = useState("0");

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProvider(data.market_data_provider || "yahoo");
        setRefreshRate(String(data.refresh_rate_seconds || 60));
        setSafeThreshold(String(data.safe_threshold || 10));
        setWarningThreshold(String(data.warning_threshold || 5));
        setProbabilityModel(data.probability_model || "delta");
        setVolSensitivity(String(data.volatility_sensitivity || 0.15));
        setCashBalance(String(data.cash_balance || 0));
        setOtherHoldingsValue(String(data.other_holdings_value || 0));
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const settings = {
        user_id: user.id,
        market_data_provider: provider,
        refresh_rate_seconds: parseInt(refreshRate),
        safe_threshold: parseFloat(safeThreshold),
        warning_threshold: parseFloat(warningThreshold),
        probability_model: probabilityModel,
        volatility_sensitivity: parseFloat(volSensitivity),
        cash_balance: parseFloat(cashBalance),
        other_holdings_value: parseFloat(otherHoldingsValue),
      };

      const { error } = await supabase
        .from('user_settings')
        .upsert(settings, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Configure market data, risk bands, and probability models
            </p>
          </div>
        </div>

        {/* Role Management */}
        <RoleManager />

        {/* Market Data Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Market Data Configuration</CardTitle>
            <CardDescription>
              Set your preferred market data provider and refresh rate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="provider">Market Data Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yahoo">Yahoo Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="refresh">Refresh Rate (seconds)</Label>
              <Input 
                id="refresh" 
                type="number" 
                value={refreshRate} 
                onChange={(e) => setRefreshRate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Risk Bands Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Band Thresholds</CardTitle>
            <CardDescription>
              Define percentage thresholds for color-coded risk indicators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="safe-threshold">Safe Zone (% above strike)</Label>
              <Input 
                id="safe-threshold" 
                type="number" 
                value={safeThreshold} 
                onChange={(e) => setSafeThreshold(e.target.value)}
                step="0.5" 
              />
              <p className="text-xs text-muted-foreground">Green badge when ≥ this value</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="warning-threshold">Warning Zone (% above strike)</Label>
              <Input 
                id="warning-threshold" 
                type="number" 
                value={warningThreshold} 
                onChange={(e) => setWarningThreshold(e.target.value)}
                step="0.5" 
              />
              <p className="text-xs text-muted-foreground">Amber badge between this and safe zone</p>
            </div>
            <div className="grid gap-2">
              <Label>Risk Zone</Label>
              <p className="text-sm text-muted-foreground">
                Red badge when below warning threshold
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Probability Model Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Probability Model</CardTitle>
            <CardDescription>
              Configure how assignment probability is calculated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="model">Probability Model</Label>
              <Select value={probabilityModel} onValueChange={setProbabilityModel}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delta">Use Option Delta (Recommended)</SelectItem>
                  <SelectItem value="heuristic">Heuristic Model</SelectItem>
                  <SelectItem value="black-scholes">Black-Scholes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vol-sensitivity">Volatility Sensitivity</Label>
              <Input 
                id="vol-sensitivity" 
                type="number" 
                value={volSensitivity} 
                onChange={(e) => setVolSensitivity(e.target.value)}
                step="0.01" 
              />
              <p className="text-xs text-muted-foreground">
                Used in heuristic and Black-Scholes calculations (default: 0.15)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Portfolio Import */}
        <PortfolioIngestion 
          onParsed={(cash, otherHoldings) => {
            setCashBalance(String(cash));
            setOtherHoldingsValue(String(otherHoldings));
          }}
        />

        {/* Statement Reconciliation */}
        <StatementReconciliation onBaselineUpdate={loadSettings} />

        {/* Portfolio Value Tracking */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Value Tracking</CardTitle>
            <CardDescription>
              Manual entry or use Quick Portfolio Import above
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="cash-balance">Cash Balance (including money market)</Label>
              <Input 
                id="cash-balance" 
                type="number" 
                value={cashBalance} 
                onChange={(e) => setCashBalance(e.target.value)}
                step="0.01"
                placeholder="e.g., 722294.82 (includes FDRXX)"
              />
              <p className="text-xs text-muted-foreground">
                Your available cash including money market funds like FDRXX
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="other-holdings">Other Holdings Value</Label>
              <Input 
                id="other-holdings" 
                type="number" 
                value={otherHoldingsValue} 
                onChange={(e) => setOtherHoldingsValue(e.target.value)}
                step="0.01"
                placeholder="e.g., 124936.02 (OWSCX, CEDIX, etc.)"
              />
              <p className="text-xs text-muted-foreground">
                Total value of mutual funds, bonds, and other holdings not tracked as positions
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Share Management */}
        {user && <ShareManagement userId={user.id} />}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg" onClick={saveSettings} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {/* Audit Trail */}
        <AuditTrail />
      </div>
    </div>
  );
};

export default Settings;
