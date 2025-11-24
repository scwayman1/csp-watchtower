import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SimulatorSettings {
  id: string;
  user_id: string;
  starting_capital: number;
  created_at: string;
  updated_at: string;
}

export const useSimulatorSettings = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['simulator-settings', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('simulator_settings' as any)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as unknown as SimulatorSettings | null;
    },
    enabled: !!userId,
  });

  const updateSettings = useMutation({
    mutationFn: async (starting_capital: number) => {
      if (!settings) {
        // Insert new settings
        const { data, error } = await supabase
          .from('simulator_settings' as any)
          .insert([{ user_id: userId, starting_capital }])
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Update existing settings
        const { data, error } = await supabase
          .from('simulator_settings' as any)
          .update({ starting_capital })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulator-settings', userId] });
      toast({
        title: "Settings updated",
        description: "Starting capital updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update settings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
  };
};