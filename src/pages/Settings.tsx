import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";

const Settings = () => {
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
              <Select defaultValue="polygon">
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="polygon">Polygon.io</SelectItem>
                  <SelectItem value="yahoo">Yahoo Finance</SelectItem>
                  <SelectItem value="alpha">Alpha Vantage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="refresh">Refresh Rate (seconds)</Label>
              <Input id="refresh" type="number" defaultValue="60" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input id="api-key" type="password" placeholder="Enter your API key" />
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
              <Input id="safe-threshold" type="number" defaultValue="10" step="0.5" />
              <p className="text-xs text-muted-foreground">Green badge when ≥ this value</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="warning-threshold">Warning Zone (% above strike)</Label>
              <Input id="warning-threshold" type="number" defaultValue="5" step="0.5" />
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
              <Select defaultValue="delta">
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
              <Input id="vol-sensitivity" type="number" defaultValue="0.15" step="0.01" />
              <p className="text-xs text-muted-foreground">
                Used in heuristic model calculations (default: 0.15)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg">Save Settings</Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
