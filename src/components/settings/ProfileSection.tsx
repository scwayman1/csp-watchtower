import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { User, Upload, X, Phone, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProfileSectionProps {
  userId: string;
}

export function ProfileSection({ userId }: ProfileSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [investmentExperience, setInvestmentExperience] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("");
  const [investmentGoals, setInvestmentGoals] = useState("");
  const [yearsTrading, setYearsTrading] = useState("");
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  
  // SMS settings from clients table
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [hasClientRecord, setHasClientRecord] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  const strategies = [
    "Cash-Secured Puts",
    "Covered Calls",
    "The Wheel",
    "Iron Condor",
    "Credit Spreads",
    "Debit Spreads",
    "Straddles",
    "Strangles"
  ];

  const loadProfile = useCallback(async () => {
    try {
      // Load profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAvatarUrl(data.avatar_url || "");
        setFullName(data.full_name || "");
        setBio(data.bio || "");
        setInvestmentExperience(data.investment_experience || "");
        setRiskTolerance(data.risk_tolerance || "");
        setInvestmentGoals(data.investment_goals || "");
        setYearsTrading(String(data.years_trading || ""));
        setSelectedStrategies(data.preferred_strategies || []);
      }
      
      // Load client record for SMS settings
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, phone_number, sms_opt_in')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (!clientError && clientData) {
        setHasClientRecord(true);
        setClientId(clientData.id);
        setPhoneNumber(clientData.phone_number || "");
        setSmsOptIn(clientData.sms_opt_in || false);
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
        avatar_url: avatarUrl,
        full_name: fullName,
        bio,
        investment_experience: investmentExperience,
        risk_tolerance: riskTolerance,
        investment_goals: investmentGoals,
        years_trading: yearsTrading ? parseInt(yearsTrading) : null,
        preferred_strategies: selectedStrategies,
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(profile, { onConflict: 'user_id' });

      if (error) throw error;
      
      // Update client record with phone/SMS settings if they have one
      if (hasClientRecord && clientId) {
        const { error: clientError } = await supabase
          .from('clients')
          .update({
            phone_number: phoneNumber || null,
            sms_opt_in: smsOptIn,
          })
          .eq('id', clientId);
        
        if (clientError) throw clientError;
      }

      toast({
        title: "Profile saved",
        description: "Your investor profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);

      toast({
        title: "Avatar uploaded",
        description: "Your profile photo has been updated.",
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

  const toggleStrategy = (strategy: string) => {
    setSelectedStrategies(prev =>
      prev.includes(strategy)
        ? prev.filter(s => s !== strategy)
        : [...prev, strategy]
    );
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
        <CardTitle>Investor Profile</CardTitle>
        <CardDescription>
          Your profile information is visible to advisors and helps them understand your investment approach
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback>
              <User className="h-12 w-12" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Label htmlFor="avatar-upload">Profile Photo</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
              {avatarUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAvatarUrl("")}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <p className="text-xs text-muted-foreground">
              Recommended: Square image, at least 200x200px
            </p>
          </div>
        </div>

        {/* Full Name */}
        <div className="grid gap-2">
          <Label htmlFor="full-name">Full Name</Label>
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
          />
        </div>

        {/* Bio */}
        <div className="grid gap-2">
          <Label htmlFor="bio">About Me</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself as an investor..."
            rows={4}
          />
        </div>

        {/* Investment Experience */}
        <div className="grid gap-2">
          <Label htmlFor="experience">Investment Experience</Label>
          <Select value={investmentExperience} onValueChange={setInvestmentExperience}>
            <SelectTrigger id="experience">
              <SelectValue placeholder="Select your experience level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner (0-2 years)</SelectItem>
              <SelectItem value="intermediate">Intermediate (2-5 years)</SelectItem>
              <SelectItem value="advanced">Advanced (5-10 years)</SelectItem>
              <SelectItem value="expert">Expert (10+ years)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Years Trading Options */}
        <div className="grid gap-2">
          <Label htmlFor="years-trading">Years Trading Options</Label>
          <Input
            id="years-trading"
            type="number"
            value={yearsTrading}
            onChange={(e) => setYearsTrading(e.target.value)}
            placeholder="e.g., 3"
            min="0"
          />
        </div>

        {/* Risk Tolerance */}
        <div className="grid gap-2">
          <Label htmlFor="risk-tolerance">Risk Tolerance</Label>
          <Select value={riskTolerance} onValueChange={setRiskTolerance}>
            <SelectTrigger id="risk-tolerance">
              <SelectValue placeholder="Select your risk tolerance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="aggressive">Aggressive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Investment Goals */}
        <div className="grid gap-2">
          <Label htmlFor="goals">Investment Goals</Label>
          <Textarea
            id="goals"
            value={investmentGoals}
            onChange={(e) => setInvestmentGoals(e.target.value)}
            placeholder="What are you trying to achieve with your options trading?"
            rows={3}
          />
        </div>

        {/* Preferred Strategies */}
        <div className="grid gap-2">
          <Label>Preferred Strategies</Label>
          <div className="flex flex-wrap gap-2">
            {strategies.map((strategy) => (
              <Badge
                key={strategy}
                variant={selectedStrategies.includes(strategy) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleStrategy(strategy)}
              >
                {strategy}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Click to select/deselect strategies you use or are interested in
          </p>
        </div>

        {/* SMS & Communication Settings - Only show if user has a client record */}
        {hasClientRecord && (
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Communication Settings</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage how your advisor can contact you
            </p>
            
            <div className="grid gap-2">
              <Label htmlFor="phone-number">Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone-number"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Required for SMS notifications from your advisor
              </p>
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="sms-opt-in" className="text-sm font-medium">SMS Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Allow your advisor to send you SMS messages and alerts
                </p>
              </div>
              <Switch
                id="sms-opt-in"
                checked={smsOptIn}
                onCheckedChange={setSmsOptIn}
                disabled={!phoneNumber}
              />
            </div>
            
            {smsOptIn && phoneNumber && (
              <div className="rounded-lg bg-success/10 border border-success/20 p-3">
                <p className="text-sm text-success">
                  ✓ SMS notifications enabled. Your advisor can send you text messages.
                </p>
              </div>
            )}
          </div>
        )}

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
