import { User, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleSelectionStepProps {
  selectedRole: "investor" | "advisor" | null;
  onSelectRole: (role: "investor" | "advisor") => void;
}

export function RoleSelectionStep({ selectedRole, onSelectRole }: RoleSelectionStepProps) {
  const roles = [
    {
      id: "investor" as const,
      icon: User,
      title: "Individual Investor",
      description: "Track your personal options portfolio with the wheel strategy",
      features: ["Portfolio tracking", "Position monitoring", "Performance analytics", "AI-powered insights"],
    },
    {
      id: "advisor" as const,
      icon: Briefcase,
      title: "Financial Advisor",
      description: "Manage multiple client portfolios and communications",
      features: ["Client management", "Model trade allocation", "Multi-channel messaging", "Portfolio oversight"],
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">How will you use The Wheel Terminal?</h2>
        <p className="text-muted-foreground">
          Select your primary role to customize your experience
        </p>
      </div>

      <div className="grid gap-4">
        {roles.map((role, index) => (
          <button
            key={role.id}
            onClick={() => onSelectRole(role.id)}
            className={cn(
              "relative p-6 rounded-xl border-2 text-left transition-all duration-200 animate-in slide-in-from-bottom-4",
              selectedRole === role.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {selectedRole === role.id && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                selectedRole === role.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <role.icon className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{role.title}</h3>
                <p className="text-sm text-muted-foreground">{role.description}</p>
                <ul className="flex flex-wrap gap-2 pt-2">
                  {role.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        selectedRole === role.id
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
