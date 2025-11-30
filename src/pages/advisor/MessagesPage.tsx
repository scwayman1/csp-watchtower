import { MessagingPanel } from "@/components/advisor/MessagingPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MessagesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
          Client Messages
        </h1>
        <p className="text-muted-foreground mt-1">
          Communicate with your clients
        </p>
      </div>

      <MessagingPanel />
    </div>
  );
}
