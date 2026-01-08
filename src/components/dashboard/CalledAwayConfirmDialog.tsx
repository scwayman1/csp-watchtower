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
import type { AssignedPosition, CoveredCall } from "@/hooks/assigned/types";

export interface PendingCalledAway {
  position: AssignedPosition;
  coveredCall: CoveredCall;
  realizedGain: number;
}

interface CalledAwayConfirmDialogProps {
  pendingEvents: PendingCalledAway[];
  onConfirm: (event: PendingCalledAway) => void;
  onDismiss: (callId: string) => void;
}

export function CalledAwayConfirmDialog({
  pendingEvents,
  onConfirm,
  onDismiss,
}: CalledAwayConfirmDialogProps) {
  const currentEvent = pendingEvents[0];
  
  if (!currentEvent) return null;

  const { position, coveredCall, realizedGain } = currentEvent;
  const sharesCalledAway = coveredCall.contracts * 100;

  return (
    <AlertDialog open={!!currentEvent}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            📞 Confirm Called Away - {position.symbol}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                The covered call on <strong>{position.symbol}</strong> expired in-the-money. 
                Would you like to mark these shares as called away?
              </p>
              
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares to sell:</span>
                  <span className="font-medium">{sharesCalledAway}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Strike price:</span>
                  <span className="font-medium">${coveredCall.strike_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Call premium:</span>
                  <span className="font-medium">
                    ${(coveredCall.premium_per_contract * 100 * coveredCall.contracts).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost basis:</span>
                  <span className="font-medium">${position.cost_basis.toFixed(2)}/share</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between text-base">
                  <span className="font-medium">Realized Gain:</span>
                  <span className={`font-bold ${realizedGain >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ${realizedGain.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Expiration: {coveredCall.expiration}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onDismiss(coveredCall.id)}>
            Not Yet
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(currentEvent)}>
            Confirm Called Away
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
