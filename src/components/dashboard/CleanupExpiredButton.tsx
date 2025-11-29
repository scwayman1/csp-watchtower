import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { useState } from "react";

interface CleanupExpiredButtonProps {
  onSuccess?: () => void;
}

export function CleanupExpiredButton({ onSuccess }: CleanupExpiredButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCleanup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-expired-positions');

      if (error) throw error;

      toast({
        title: "Cleanup Complete",
        description: data.message,
      });

      onSuccess?.();
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast({
        title: "Cleanup failed",
        description: error.message || "Failed to clean up expired positions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleCleanup} 
      disabled={loading}
      variant="destructive"
      size="sm"
    >
      <Trash2 className="mr-2 h-4 w-4" />
      {loading ? "Cleaning..." : "Clean & Reload Nov 6 Data"}
    </Button>
  );
}
