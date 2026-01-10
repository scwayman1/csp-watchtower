import { useState } from "react";
import { LayoutDashboard, Target, Building2, BarChart3, History, MessageSquare, Settings, ChevronDown, DollarSign } from "lucide-react";
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UnreadBadge } from "@/components/messaging/UnreadBadge";

const dashboardSections = [
  { title: "Overview", id: "dashboard", icon: LayoutDashboard },
  { title: "Positions", id: "positions", icon: Target },
  { title: "Assignments", id: "assignments", icon: Building2 },
  { title: "Analytics", id: "analytics", icon: BarChart3 },
  { title: "History", id: "history", icon: History },
];

export function AppSidebar() {
  const { open, state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboardOpen, setDashboardOpen] = useState(true);

  const isDashboardRoute = location.pathname === "/";
  const isCollapsed = state === "collapsed";

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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border transition-all duration-300">
      <SidebarContent>
        {/* Collapse Trigger */}
        <div className="p-2 border-b border-sidebar-border flex items-center justify-end">
          <SidebarTrigger className="hover:bg-sidebar-accent" />
        </div>

        {/* Logo / Brand */}
        <div className="p-4 border-b border-sidebar-border">
          {!isCollapsed ? (
            <>
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                The Wheel Terminal
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Professional CSP Tracker</p>
            </>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">WT</span>
            </div>
          )}
        </div>

        {/* Dashboard Sections (Collapsible Group) */}
        <SidebarGroup>
          <Collapsible 
            open={!isCollapsed && dashboardOpen} 
            onOpenChange={setDashboardOpen}
            disabled={isCollapsed}
          >
            {!isCollapsed && (
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent">
                  <div className="flex items-center justify-between w-full">
                    <span>Dashboard</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        dashboardOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </SidebarGroupLabel>
              </CollapsibleTrigger>
            )}
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
                        {!isCollapsed && <span>{section.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Show icons only when collapsed */}
          {isCollapsed && (
            <SidebarGroupContent>
              <SidebarMenu>
                {dashboardSections.map((section) => (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      onClick={() => scrollToSection(section.id)}
                      tooltip={section.title}
                    >
                      <section.icon className="h-4 w-4" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Premium Analytics, Messages & Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Analytics">
                  <NavLink
                    to="/analytics"
                    className="flex items-center gap-2"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <BarChart3 className="h-4 w-4" />
                    {!isCollapsed && <span>Analytics</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Messages">
                  <NavLink
                    to="/messages"
                    className="flex items-center gap-2"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {!isCollapsed && (
                      <>
                        <span>Messages</span>
                        <UnreadBadge />
                      </>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings">
                  <NavLink
                    to="/settings"
                    className="flex items-center gap-2"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Settings className="h-4 w-4" />
                    {!isCollapsed && <span>Settings</span>}
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
