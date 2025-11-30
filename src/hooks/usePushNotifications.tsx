import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if browser supports notifications
    const supported = 'Notification' in window && 
                     'serviceWorker' in navigator && 
                     'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const subscribeToPush = async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check current permission state
      if (Notification.permission === 'denied') {
        toast({
          title: "Notifications Blocked",
          description: "Click the lock icon in your browser's address bar, then find Notifications and change it to 'Allow'. Refresh the page after.",
          variant: "destructive",
          duration: 10000,
        });
        setIsLoading(false);
        return;
      }

      // Request notification permission - this shows Chrome's native "Allow" dialog
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast({
          title: "Permission Required",
          description: permission === 'denied' 
            ? "Notifications are blocked. Check your browser settings to enable them."
            : "Notification permission was not granted. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      // Note: You need a VAPID public key for production
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          // This is a placeholder - in production, you'd use your own VAPID key
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8mrYGkkk0V_J5-3A8J0bHoJ_7u7vQ3Q3F0aU-wG7WZP7gFR-7PoMZE'
        )
      });

      // Save subscription to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const subscriptionData = subscription.toJSON();
      
      await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionData.endpoint!,
          p256dh: subscriptionData.keys!.p256dh,
          auth: subscriptionData.keys!.auth,
        });

      setIsSubscribed(true);
      toast({
        title: "Notifications Enabled",
        description: "You'll receive push notifications for new messages",
      });

    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast({
        title: "Subscription Failed",
        description: "Failed to enable push notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }

        setIsSubscribed(false);
        toast({
          title: "Notifications Disabled",
          description: "You won't receive push notifications",
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast({
        title: "Unsubscribe Failed",
        description: "Failed to disable push notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribeToPush,
    unsubscribeFromPush,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
