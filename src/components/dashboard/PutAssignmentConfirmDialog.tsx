import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PendingPutAssignment } from "@/hooks/usePutAssignmentDetection";

interface PutAssignmentConfirmDialogProps {
  pendingAssignments: PendingPutAssignment[];
  onConfirm: (event: PendingPutAssignment) => void;
  onDismiss: (positionId: string) => void;
}

export function PutAssignmentConfirmDialog({
  pendingAssignments,
  onConfirm,
  onDismiss,
}: PutAssignmentConfirmDialogProps) {
  const currentEvent = pendingAssignments[0];

  if (!currentEvent) return null;

  const { position, assignmentPrice, shares, costBasis } = currentEvent;
  const pctBelowStrike = ((position.strikePrice - position.underlyingPrice) / position.strikePrice) * 100;

  return (
    <AlertDialog open={!!currentEvent}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Put Assignment Detected - {position.symbol}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Your put on <strong>{position.symbol}</strong> expired in-the-money
                ({pctBelowStrike.toFixed(1)}% below strike).
                Would you like to record this assignment?
              </p>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contracts:</span>
                  <span className="font-medium">{position.contracts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares to receive:</span>
                  <span className="font-medium">{shares}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Strike (assignment) price:</span>
                  <span className="font-medium">${assignmentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Final underlying price:</span>
                  <span className="font-medium text-destructive">${position.underlyingPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Premium collected:</span>
                  <span className="font-medium text-success">+${position.totalPremium.toFixed(2)}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between text-base">
                  <span className="font-medium">Cost basis per share:</span>
                  <span className="font-bold">${costBasis.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="font-medium">Total capital required:</span>
                  <span className="font-bold">${(costBasis * shares).toFixed(2)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Expiration: {position.expiration}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onDismiss(position.id)}>
            Not Assigned
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(currentEvent)}>
            Confirm Assignment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
