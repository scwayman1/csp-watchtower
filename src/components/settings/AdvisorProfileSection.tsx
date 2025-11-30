import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Briefcase, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdvisorProfileSectionProps {
  userId: string;
}

export function AdvisorProfileSection({ userId }: AdvisorProfileSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [firmLogoUrl, setFirmLogoUrl] = useState<string>("");
  const [firmName, setFirmName] = useState("");
  const [advisorName, setAdvisorName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFirmLogoUrl(data.avatar_url || "");
        setAdvisorName(data.full_name || "");
        setBio(data.bio || "");
        // Use investment_goals field to store firm name for advisors
        setFirmName(data.investment_goals || "");
      }

      // Get email from auth user
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = async () => {
    try {
      const profile = {
        user_id: userId,
        avatar_url: firmLogoUrl,
        full_name: advisorName,
        bio,
        investment_goals: firmName, // Store firm name in this field
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(profile, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Profile saved",
        description: "Your advisor profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/firm-logo-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFirmLogoUrl(data.publicUrl);

      toast({
        title: "Logo uploaded",
        description: "Your firm logo has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advisor Profile</CardTitle>
        <CardDescription>
          Your firm information and professional profile visible to clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Firm Logo Upload */}
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24 rounded-lg">
            <AvatarImage src={firmLogoUrl} />
            <AvatarFallback className="rounded-lg">
              <Briefcase className="h-12 w-12" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Label htmlFor="logo-upload">Firm Logo</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => document.getElementById('logo-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Logo"}
              </Button>
              {firmLogoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFirmLogoUrl("")}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <p className="text-xs text-muted-foreground">
              Recommended: Square or horizontal logo, at least 200x200px
            </p>
          </div>
        </div>

        {/* Firm Name */}
        <div className="grid gap-2">
          <Label htmlFor="firm-name">Firm Name</Label>
          <Input
            id="firm-name"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Your Advisory Firm LLC"
          />
        </div>

        {/* Advisor Name */}
        <div className="grid gap-2">
          <Label htmlFor="advisor-name">Your Name</Label>
          <Input
            id="advisor-name"
            value={advisorName}
            onChange={(e) => setAdvisorName(e.target.value)}
            placeholder="John Smith, CFP®"
          />
        </div>

        {/* Bio */}
        <div className="grid gap-2">
          <Label htmlFor="bio">Professional Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Brief professional background and investment philosophy..."
            rows={4}
          />
        </div>

        {/* Email (read-only) */}
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Email cannot be changed here. Contact support to update.
          </p>
        </div>

        {/* Phone */}
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone (Optional)</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={saveProfile}>
            Save Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
