import type { TooltipProps } from "recharts";

type ValueType = number | string;
type NameType = number | string;

interface ReadableTooltipContentProps extends TooltipProps<ValueType, NameType> {
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
}

export function ReadableTooltipContent({
  active,
  payload,
  label,
  valueFormatter = (v) => v.toLocaleString(),
  labelFormatter,
}: ReadableTooltipContentProps) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const name = String(item.name ?? label ?? "");
  const valueNum = typeof item.value === "number" ? item.value : Number(item.value);
  const value = Number.isFinite(valueNum) ? valueFormatter(valueNum) : String(item.value ?? "");

  return (
    <div
      style={{
        backgroundColor: "hsl(var(--popover))",
        color: "hsl(var(--popover-foreground))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 10,
        padding: "8px 10px",
        boxShadow: "0 16px 40px -18px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
        {labelFormatter ? labelFormatter(name) : name}
      </div>
      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{value}</div>
    </div>
  );
}
