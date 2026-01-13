import { TrendingUp, Shield, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onContinue: () => void;
  onSignIn: () => void;
  userType?: "investor" | "advisor";
}

export function WelcomeStep({ onContinue, onSignIn, userType = "investor" }: WelcomeStepProps) {
  const features = userType === "investor" ? [
    { icon: TrendingUp, title: "Track Positions", description: "Monitor your CSP and covered call positions in real-time" },
    { icon: Shield, title: "Risk Analysis", description: "Get AI-powered insights on premium quality and assignment risk" },
    { icon: BarChart3, title: "Performance Metrics", description: "Analyze returns, premiums collected, and portfolio growth" },
  ] : [
    { icon: Users, title: "Client Management", description: "Manage multiple client portfolios from one dashboard" },
    { icon: TrendingUp, title: "Model Trades", description: "Create and allocate trades across client accounts" },
    { icon: Shield, title: "Communication Hub", description: "Message clients via app, SMS, and track engagement" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Welcome to The Wheel Terminal</h2>
        <p className="text-muted-foreground">
          {userType === "investor" 
            ? "Your professional options trading dashboard for the wheel strategy"
            : "Your command center for managing client portfolios and communications"}
        </p>
      </div>

      <div className="grid gap-4">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border/50 animate-in slide-in-from-left-4 duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <feature.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Button onClick={onContinue} className="w-full" size="lg">
          Create Account
        </Button>
        <Button onClick={onSignIn} variant="outline" className="w-full" size="lg">
          Sign In
        </Button>
      </div>
    </div>
  );
}
