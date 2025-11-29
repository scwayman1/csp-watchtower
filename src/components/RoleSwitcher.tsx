import { User2, Briefcase } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RoleSwitcher() {
  const { roles, activeRole, switchRole } = useUserRole();

  // Don't show switcher if user only has one role
  if (roles.length <= 1) return null;

  const roleLabels = {
    investor: "Investor View",
    advisor: "Advisor View",
    admin: "Admin View",
  };

  const roleIcons = {
    investor: User2,
    advisor: Briefcase,
    admin: Briefcase,
  };

  return (
    <Select value={activeRole} onValueChange={switchRole}>
      <SelectTrigger className="w-[180px] bg-card/50 border-border/50 hover:bg-card/80">
        <SelectValue>
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = roleIcons[activeRole];
              return <Icon className="h-4 w-4" />;
            })()}
            <span className="text-sm">{roleLabels[activeRole]}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => {
          const Icon = roleIcons[role];
          return (
            <SelectItem key={role} value={role}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{roleLabels[role]}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
