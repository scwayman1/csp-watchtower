import { useState } from "react";
import { LayoutDashboard, Target, Building2, BarChart3, History, Settings, ChevronDown } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const dashboardSections = [
  { title: "Overview", id: "dashboard", icon: LayoutDashboard },
  { title: "Positions", id: "positions", icon: Target },
  { title: "Assignments", id: "assignments", icon: Building2 },
  { title: "Analytics", id: "analytics", icon: BarChart3 },
  { title: "History", id: "history", icon: History },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboardOpen, setDashboardOpen] = useState(true);

  const isDashboardRoute = location.pathname === "/";

  const scrollToSection = (sectionId: string) => {
    if (!isDashboardRoute) {
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        {/* Logo / Brand */}
        <div className="p-4 border-b border-sidebar-border">
          {open ? (
            <>
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                The Wheel Terminal
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Professional CSP Tracker</p>
            </>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">WT</span>
            </div>
          )}
        </div>

        {/* Dashboard Sections (Collapsible Group) */}
        <SidebarGroup>
          <Collapsible open={dashboardOpen} onOpenChange={setDashboardOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent">
                <div className="flex items-center justify-between w-full">
                  <span>Dashboard</span>
                  {open && (
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        dashboardOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </div>
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {dashboardSections.map((section) => (
                    <SidebarMenuItem key={section.id}>
                      <SidebarMenuButton
                        onClick={() => scrollToSection(section.id)}
                        tooltip={section.title}
                      >
                        <section.icon className="h-4 w-4" />
                        {open && <span>{section.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Settings (Always Visible) */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings">
                  <NavLink
                    to="/settings"
                    className="flex items-center gap-2"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Settings className="h-4 w-4" />
                    {open && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
