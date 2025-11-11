import { Line, LineChart, ResponsiveContainer } from "recharts";

interface TrendSparklineProps {
  data: number[];
  isPositive: boolean;
}

export function TrendSparkline({ data, isPositive }: TrendSparklineProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((value, index) => ({
    index,
    value,
  }));

  return (
    <ResponsiveContainer width={60} height={24}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
