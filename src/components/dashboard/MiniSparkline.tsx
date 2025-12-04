import { Line, LineChart, ResponsiveContainer } from "recharts";

interface MiniSparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function MiniSparkline({ data, color = "hsl(var(--primary))", height = 32 }: MiniSparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));
  
  if (data.length < 2) {
    return (
      <div className="h-8 flex items-center justify-center text-xs text-muted-foreground">
        Not enough data
      </div>
    );
  }

  const isPositive = data[data.length - 1] >= data[0];
  const lineColor = color === "auto" 
    ? isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"
    : color;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
