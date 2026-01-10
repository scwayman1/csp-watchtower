import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, TrendingUp, DollarSign, Activity } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface AssignedOverviewSectionProps {
  totalAssignedEver: number;
  currentlyAssigned: number;
  totalRealizedFromAssignments: number;
  calledAwayCount: number;
  underwaterCount: number;
  profitableCount: number;
}

export function AssignedOverviewSection({
  totalAssignedEver,
  currentlyAssigned,
  totalRealizedFromAssignments,
  calledAwayCount,
  underwaterCount,
  profitableCount,
}: AssignedOverviewSectionProps) {
  const formatCurrency = (value: number) =>
    `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const statusDistribution = [
    { name: 'Called Away', value: calledAwayCount, color: 'hsl(var(--success))' },
    { name: 'Profitable', value: profitableCount, color: 'hsl(var(--chart-2))' },
    { name: 'Underwater', value: underwaterCount, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              Total Assigned Ever
            </CardDescription>
            <CardTitle className="text-2xl">{totalAssignedEver}</CardTitle>
            <p className="text-xs text-muted-foreground">positions through the wheel</p>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-chart-2">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" />
              Currently Assigned
            </CardDescription>
            <CardTitle className="text-2xl">{currentlyAssigned}</CardTitle>
            <p className="text-xs text-muted-foreground">active stock holdings</p>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Total Realized
            </CardDescription>
            <CardTitle className="text-2xl text-success">
              +{formatCurrency(totalRealizedFromAssignments)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">from called away positions</p>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Completion Rate
            </CardDescription>
            <CardTitle className="text-2xl">
              {totalAssignedEver > 0 
                ? ((calledAwayCount / totalAssignedEver) * 100).toFixed(0) 
                : 0}%
            </CardTitle>
            <p className="text-xs text-muted-foreground">wheel cycles completed</p>
          </CardHeader>
        </Card>
      </div>

      {/* Status Distribution */}
      {statusDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Position Status Distribution
            </CardTitle>
            <CardDescription>Current state of all assigned positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, 'Positions']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center gap-6">
              <div className="text-center">
                <div className="w-3 h-3 rounded-full bg-success mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Called Away</p>
                <p className="font-bold">{calledAwayCount}</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 rounded-full bg-chart-2 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Profitable</p>
                <p className="font-bold">{profitableCount}</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 rounded-full bg-destructive mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Underwater</p>
                <p className="font-bold">{underwaterCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
