import { useMessaging } from "@/hooks/useMessaging";
import { Badge } from "@/components/ui/badge";

export function UnreadBadge() {
  const { totalUnreadCount } = useMessaging();

  if (totalUnreadCount === 0) return null;

  return (
    <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 ml-2">
      {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
    </Badge>
  );
}
