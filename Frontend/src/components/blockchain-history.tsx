import { Badge } from "@/components/ui/badge";
import { Shield, Eye, Upload, UserPlus, UserMinus, Clock, UserCheck, Stethoscope } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface HistoryEntry {
  id: string;
  userId: string;
  userGeneratedId: string;
  userName: string;
  action: string;
  documentName: string;
  quantumStatus: string;
  timestamp: string;
  blockHash: string;
  details?: {
    grantedTo?: string;
    revokedFrom?: string;
    fileName?: string;
  };
}

interface BlockchainHistoryProps {
  userId?: string; // Optional: filter by user
}

function getActionIcon(action: string) {
  switch (action) {
    case 'upload':
      return <Upload className="h-3 w-3" />;
    case 'view':
      return <Eye className="h-3 w-3" />;
    case 'grant':
      return <UserPlus className="h-3 w-3" />;
    case 'revoke':
      return <UserMinus className="h-3 w-3" />;
    case 'suggestion_created':
      return <Stethoscope className="h-3 w-3" />;
    default:
      return <Shield className="h-3 w-3" />;
  }
}

function getActionBadge(action: string) {
  const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
  
  switch (action) {
    case 'upload':
      return (
        <Badge className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`}>
          {getActionIcon(action)}
          <span className="ml-1">Uploaded</span>
        </Badge>
      );
    case 'view':
      return (
        <Badge className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>
          {getActionIcon(action)}
          <span className="ml-1">Viewed</span>
        </Badge>
      );
    case 'grant':
      return (
        <Badge className={`${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200`}>
          {getActionIcon(action)}
          <span className="ml-1">Granted</span>
        </Badge>
      );
    case 'revoke':
      return (
        <Badge className={`${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`}>
          {getActionIcon(action)}
          <span className="ml-1">Revoked</span>
        </Badge>
      );
    case 'suggestion_created':
      return (
        <Badge className={`${baseClasses} bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200`}>
          {getActionIcon(action)}
          <span className="ml-1">Suggestion</span>
        </Badge>
      );
    default:
      return (
        <Badge className={`${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`}>
          {getActionIcon(action)}
          <span className="ml-1">{action}</span>
        </Badge>
      );
  }
}

export default function BlockchainHistory({ userId }: BlockchainHistoryProps) {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["/api/blockchain/history", userId],
    queryFn: async () => {
      const url = userId
        ? `/api/blockchain/history?userId=${encodeURIComponent(userId)}`
        : "/api/blockchain/history";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-spin" />
        <p className="text-muted-foreground">Loading blockchain history...</p>
      </div>
    );
  }

  const history: HistoryEntry[] = (historyData as any)?.history || [];

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No blockchain activity yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 font-medium text-foreground">User ID</th>
            <th className="text-left py-3 px-4 font-medium text-foreground">Action</th>
            <th className="text-left py-3 px-4 font-medium text-foreground">Document</th>
            <th className="text-left py-3 px-4 font-medium text-foreground">Timestamp</th>
            <th className="text-left py-3 px-4 font-medium text-foreground">Quantum Status</th>
            <th className="text-left py-3 px-4 font-medium text-foreground">Block Hash</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id} className="border-b border-border/50 hover:bg-accent/30">
              <td className="py-3 px-4">
                <div>
                  <p className="font-medium text-foreground">{entry.userGeneratedId}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-32">
                    {entry.userName}
                  </p>
                </div>
              </td>
              <td className="py-3 px-4">
                {getActionBadge(entry.action)}
              </td>
              <td className="py-3 px-4 text-muted-foreground max-w-40">
                <span className="truncate block" title={entry.documentName}>
                  {entry.documentName || 'N/A'}
                </span>
              </td>
              <td className="py-3 px-4 text-muted-foreground">
                <div>
                  <p>{new Date(entry.timestamp).toLocaleDateString()}</p>
                  <p className="text-xs">{new Date(entry.timestamp).toLocaleTimeString()}</p>
                </div>
              </td>
              <td className="py-3 px-4">
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <Shield className="h-3 w-3 mr-1" />
                  Secured
                </Badge>
              </td>
              <td className="py-3 px-4">
                <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {entry.blockHash}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
