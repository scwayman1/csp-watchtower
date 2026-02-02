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
import { Badge } from "@/components/ui/badge";
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

  const { position, assignmentPrice, shares, costBasis, isCurrentlyITM } = currentEvent;
  const pctFromStrike = ((position.strikePrice - position.underlyingPrice) / position.strikePrice) * 100;
  const remainingCount = pendingAssignments.length - 1;

  return (
    <AlertDialog open={!!currentEvent}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Expired Put Review - {position.symbol}
            {remainingCount > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                +{remainingCount} more
              </Badge>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Your put on <strong>{position.symbol}</strong> has expired.
                Was this position assigned by your broker?
              </p>

              <div className={`rounded-lg p-3 space-y-2 ${isCurrentlyITM ? 'bg-warning/10 border border-warning/30' : 'bg-muted/50'}`}>
                {isCurrentlyITM ? (
                  <p className="text-warning font-medium text-xs mb-2">
                    Current price is below strike - likely assigned
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs mb-2">
                    Current price is above strike - check your broker statement
                  </p>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contracts:</span>
                  <span className="font-medium">{position.contracts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares if assigned:</span>
                  <span className="font-medium">{shares}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Strike price:</span>
                  <span className="font-medium">${assignmentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current underlying:</span>
                  <span className={`font-medium ${isCurrentlyITM ? 'text-warning' : 'text-success'}`}>
                    ${position.underlyingPrice.toFixed(2)}
                    <span className="text-xs ml-1">
                      ({pctFromStrike >= 0 ? '+' : ''}{(-pctFromStrike).toFixed(1)}% vs strike)
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Premium collected:</span>
                  <span className="font-medium text-success">+${position.totalPremium.toFixed(2)}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between text-base">
                  <span className="font-medium">Cost basis (if assigned):</span>
                  <span className="font-bold">${costBasis.toFixed(2)}/share</span>
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
            Expired Worthless
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(currentEvent)}>
            Yes, Was Assigned
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
