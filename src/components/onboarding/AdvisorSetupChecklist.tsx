import { useState, useEffect } from "react";
import { Check, Circle, ArrowRight, Settings, Users, MessageSquare, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SetupTask {
  id: string;
  title: string;
  description: string;
  icon: any;
  path: string;
  checkComplete: () => Promise<boolean>;
}

export function AdvisorSetupChecklist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const tasks: SetupTask[] = [
    {
      id: "profile",
      title: "Complete your profile",
      description: "Add your firm name and contact details",
      icon: Settings,
      path: "/settings",
      checkComplete: async () => {
        if (!user) return false;
        const { data } = await supabase
          .from("profiles")
          .select("full_name, bio")
          .eq("user_id", user.id)
          .single();
        return !!(data?.full_name && data?.bio);
      },
    },
    {
      id: "client",
      title: "Add your first client",
      description: "Invite a client to the platform",
      icon: Users,
      path: "/advisor/clients",
      checkComplete: async () => {
        if (!user) return false;
        const { count } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("advisor_id", user.id);
        return (count || 0) > 0;
      },
    },
    {
      id: "cycle",
      title: "Create a trading cycle",
      description: "Set up your first model trade cycle",
      icon: FileText,
      path: "/advisor/cycle-sheet",
      checkComplete: async () => {
        if (!user) return false;
        const { count } = await supabase
          .from("cycles")
          .select("*", { count: "exact", head: true })
          .eq("advisor_id", user.id);
        return (count || 0) > 0;
      },
    },
    {
      id: "message",
      title: "Send a message",
      description: "Start communicating with clients",
      icon: MessageSquare,
      path: "/advisor/messages",
      checkComplete: async () => {
        if (!user) return false;
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("sender_id", user.id);
        return (count || 0) > 0;
      },
    },
  ];

  useEffect(() => {
    checkCompletedTasks();
  }, [user]);

  const checkCompletedTasks = async () => {
    if (!user) return;
    
    setLoading(true);
    const completed = new Set<string>();
    
    for (const task of tasks) {
      const isComplete = await task.checkComplete();
      if (isComplete) {
        completed.add(task.id);
      }
    }
    
    setCompletedTasks(completed);
    setLoading(false);

    // Auto-dismiss if all tasks are complete
    if (completed.size === tasks.length) {
      setDismissed(true);
    }
  };

  if (dismissed || loading) return null;
  if (completedTasks.size === tasks.length) return null;

  const progress = (completedTasks.size / tasks.length) * 100;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Getting Started</CardTitle>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground">
            {completedTasks.size}/{tasks.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-2">
          {tasks.map((task) => {
            const isComplete = completedTasks.has(task.id);
            return (
              <button
                key={task.id}
                onClick={() => navigate(task.path)}
                disabled={isComplete}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                  isComplete
                    ? "bg-muted/30 cursor-default"
                    : "hover:bg-background/50 cursor-pointer"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  isComplete ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <task.icon className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    isComplete && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.description}
                  </p>
                </div>
                {!isComplete && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
