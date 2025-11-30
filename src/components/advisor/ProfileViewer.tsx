import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  avatar_url: string | null;
  full_name: string | null;
  bio: string | null;
  investment_experience: string | null;
  risk_tolerance: string | null;
  investment_goals: string | null;
  years_trading: number | null;
  preferred_strategies: string[] | null;
}

export function ProfileViewer() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading profile...</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No profile found. Please complete your profile in Settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle>Investor Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback>
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{profile.full_name || "Name not set"}</h3>
            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Experience</p>
            <p className="text-sm capitalize">{profile.investment_experience || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Risk Tolerance</p>
            <p className="text-sm capitalize">{profile.risk_tolerance || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Years Trading Options</p>
            <p className="text-sm">{profile.years_trading || "Not set"}</p>
          </div>
        </div>

        {profile.investment_goals && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Investment Goals</p>
            <p className="text-sm">{profile.investment_goals}</p>
          </div>
        )}

        {profile.preferred_strategies && profile.preferred_strategies.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Preferred Strategies</p>
            <div className="flex flex-wrap gap-2">
              {profile.preferred_strategies.map((strategy) => (
                <Badge key={strategy} variant="secondary">
                  {strategy}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
