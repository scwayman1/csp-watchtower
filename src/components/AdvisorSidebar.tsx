import { LayoutDashboard, Users, FileSpreadsheet, TrendingUp, Activity, MessageSquare, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const advisorMenuItems = [
  {
    title: "Dashboard",
    url: "/advisor",
    icon: LayoutDashboard,
  },
  {
    title: "Clients",
    url: "/advisor/clients",
    icon: Users,
  },
  {
    title: "CycleSheet",
    url: "/advisor/cyclesheet",
    icon: FileSpreadsheet,
  },
  {
    title: "Model Trades",
    url: "/advisor/trades",
    icon: TrendingUp,
  },
  {
    title: "Orders & Activity",
    url: "/advisor/orders",
    icon: Activity,
  },
  {
    title: "Messages",
    url: "/advisor/messages",
    icon: MessageSquare,
  },
  {
    title: "Settings",
    url: "/advisor/settings",
    icon: Settings,
  },
];

export function AdvisorSidebar() {
  return (
    <Sidebar className="w-60" collapsible="icon">
      <SidebarHeader className="p-6 border-b border-border/50">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            The Wheel Terminal
          </h2>
          <p className="text-xs text-muted-foreground">Advisor Console</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {advisorMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/advisor"}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
