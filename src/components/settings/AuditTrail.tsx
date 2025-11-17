import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Shield, User, Clock, Activity } from "lucide-react";

interface AuthLog {
  id: string;
  timestamp: number;
  event_message: string;
  level: string;
  msg: string;
  status?: number;
  path?: string;
}

interface ActivitySummary {
  totalLogins: number;
  uniqueUsers: number;
  lastLogin: number | null;
  failedAttempts: number;
}

export const AuditTrail = () => {
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    totalLogins: 0,
    uniqueUsers: 0,
    lastLogin: null,
    failedAttempts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-auth-logs');

      if (error) {
        console.error('Error loading audit logs:', error);
        return;
      }

      const logs = data?.logs || [];
      
      const parsedLogs = logs.map((log: any) => ({
        id: log.id,
        timestamp: log.timestamp / 1000, // Convert microseconds to milliseconds
        event_message: log.event_message,
        level: 'info',
        msg: log.event_message.includes('Login') ? 'Login' : 
             log.event_message.includes('Signup') ? 'Signup' : 'Logout',
        status: 200,
      }));

      setLogs(parsedLogs);
      calculateSummary(parsedLogs);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (logs: AuthLog[]) => {
    const loginLogs = logs.filter(log => log.msg === 'Login');
    const uniqueUserIds = new Set(
      loginLogs.map(log => {
        try {
          const parsed = JSON.parse(log.event_message);
          return parsed.user_id;
        } catch {
          return null;
        }
      }).filter(Boolean)
    );

    const failedLogs = logs.filter(log => log.status && log.status >= 400);

    setSummary({
      totalLogins: loginLogs.length,
      uniqueUsers: uniqueUserIds.size,
      lastLogin: loginLogs.length > 0 ? loginLogs[0].timestamp : null,
      failedAttempts: failedLogs.length,
    });
  };

  const parseEventMessage = (message: string) => {
    try {
      const parsed = JSON.parse(message);
      return {
        action: parsed.msg || parsed.action || 'Unknown',
        user: parsed.actor_username || parsed.user_id?.substring(0, 8) || 'Unknown',
        method: parsed.login_method || parsed.method || '-',
      };
    } catch {
      return { action: 'Unknown', user: 'Unknown', method: '-' };
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading audit logs...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Activity Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logins</p>
                <p className="text-2xl font-bold">{summary.totalLogins}</p>
              </div>
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unique Users</p>
                <p className="text-2xl font-bold">{summary.uniqueUsers}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Login</p>
                <p className="text-sm font-medium">
                  {summary.lastLogin 
                    ? format(new Date(summary.lastLogin), 'MMM d, h:mm a')
                    : 'N/A'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed Attempts</p>
                <p className="text-2xl font-bold">{summary.failedAttempts}</p>
              </div>
              <Shield className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication Activity
          </CardTitle>
          <CardDescription>
            Recent login, signup, and logout events (last 50)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No audit logs available
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const parsed = parseEventMessage(log.event_message);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.timestamp), 'MMM d, yyyy h:mm:ss a')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={parsed.action === 'Login' ? 'default' : 'secondary'}>
                            {parsed.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{parsed.user}</TableCell>
                        <TableCell className="text-xs">{parsed.method}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={log.status && log.status >= 400 ? 'destructive' : 'success'}
                          >
                            {log.status || 200}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
