import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

interface LineItem {
  label: string;
  value: number;
  type?: "add" | "subtract" | "result";
  indent?: boolean;
}

interface MetricBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  formula?: string;
  items: LineItem[];
}

const formatCurrency = (value: number) => {
  const formatted = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2 });
  if (value < 0) return `-$${formatted}`;
  return `$${formatted}`;
};

export function MetricBreakdownDialog({
  open,
  onOpenChange,
  title,
  description,
  formula,
  items,
}: MetricBreakdownDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={description ? undefined : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {formula ? (
          <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs">{formula}</div>
        ) : null}

        <Separator />

        <Table>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index} className={item.type === "result" ? "border-t-2 font-bold" : ""}>
                <TableCell className={`${item.indent ? "pl-6" : ""} ${item.type === "result" ? "font-semibold" : ""}`}>
                  {item.type === "add" ? <span className="text-success mr-1">+</span> : null}
                  {item.type === "subtract" ? <span className="text-destructive mr-1">−</span> : null}
                  {item.label}
                </TableCell>
                <TableCell
                  className={`text-right ${
                    item.type === "result" ? (item.value >= 0 ? "text-success" : "text-destructive") : ""
                  }`}
                >
                  {formatCurrency(item.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

