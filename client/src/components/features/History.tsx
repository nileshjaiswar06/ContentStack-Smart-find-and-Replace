import React from 'react';
import { HistoryItem } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HistoryProps {
  history: HistoryItem[];
}

export const History: React.FC<HistoryProps> = ({ history }) => {
  const getStatusVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Operation History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getStatusVariant(item.status)}>
                        {item.status}
                      </Badge>
                      <span className="text-xs text-gray-500">{item.timestamp}</span>
                    </div>
                    <p className="font-medium text-sm text-gray-900 mb-1">{item.action}</p>
                    {item.details && (
                      <p className="text-xs text-gray-500 mb-2">{item.details}</p>
                    )}
                    {item.changesCount && (
                      <Badge variant="outline" className="text-xs">
                        {item.changesCount} changes
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No history yet</h3>
            <p className="text-gray-500">Your operation history will appear here after you perform actions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};