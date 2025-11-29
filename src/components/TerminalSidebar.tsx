import { LayoutDashboard, Target, Building2, BarChart3, History, Settings, Bell, User } from "lucide-react";
import { NavLink } from "./NavLink";

export function TerminalSidebar() {
  return (
    <div className="w-64 h-screen bg-sidebar-background border-r border-sidebar-border flex flex-col">
      {/* Logo / Brand */}
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          The Wheel Terminal
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Professional CSP Tracker</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavLink 
          to="/" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-sidebar-accent"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </NavLink>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground cursor-not-allowed">
          <Target className="w-4 h-4" />
          Positions
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground cursor-not-allowed">
          <Building2 className="w-4 h-4" />
          Assignments
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground cursor-not-allowed">
          <BarChart3 className="w-4 h-4" />
          Analytics
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground cursor-not-allowed">
          <History className="w-4 h-4" />
          History
        </div>
        <NavLink 
          to="/settings" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-sidebar-accent"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <Settings className="w-4 h-4" />
          Settings
        </NavLink>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">User</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <button className="p-1 hover:bg-sidebar-accent rounded">
            <Bell className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
