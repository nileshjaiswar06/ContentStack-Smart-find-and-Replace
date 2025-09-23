'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Webhook, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Shield,
  Zap,
  Clock,
  Database
} from 'lucide-react';
import { enhancedApi, WebhookStatus } from '@/lib/enhanced-api';

interface WebhookStatusProps {
  environment?: string;
  branch?: string;
}

export function WebhookStatusComponent({ 
  environment = 'development', 
  branch = 'main' 
}: WebhookStatusProps) {
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWebhookStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await enhancedApi.getWebhookStatus(environment, branch);
      if (response.success && response.data) {
        setWebhookStatus(response.data);
        // Webhook status loaded
      } else {
        setError('Failed to load webhook status');
      }
    } catch (err) {
      console.error('❌ Error loading webhook status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load webhook status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWebhookStatus();
  }, [environment, branch]);

  const getWebhookIcon = (enabled: boolean) => {
    return enabled ? CheckCircle : XCircle;
  };

  const getWebhookColor = (enabled: boolean) => {
    return enabled ? 'text-green-600' : 'text-red-600';
  };

  const getSecurityIcon = (configured: boolean) => {
    return configured ? Shield : AlertTriangle;
  };

  const getSecurityColor = (configured: boolean) => {
    return configured ? 'text-green-600' : 'text-yellow-600';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading webhook status...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span>Error: {error}</span>
        </div>
        <Button 
          onClick={loadWebhookStatus} 
          className="mt-4"
          size="sm"
        >
          Retry
        </Button>
      </Card>
    );
  }

  if (!webhookStatus) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Webhook className="w-5 h-5 text-blue-600" />
          <span>Webhook Status</span>
        </h3>
        <Button
          onClick={loadWebhookStatus}
          disabled={loading}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Webhook Endpoints */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Webhook Endpoints</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(webhookStatus.webhooks).map(([key, config]) => {
              const Icon = getWebhookIcon(config.enabled);
              return (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${getWebhookColor(config.enabled)}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{key}</p>
                      <p className="text-xs text-gray-500">{config.path}</p>
                    </div>
                  </div>
                  <Badge variant={config.enabled ? "default" : "secondary"}>
                    {config.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security Status */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Security</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className={`w-4 h-4 ${getSecurityColor(webhookStatus.security.signature_verification)}`} />
                <span className="text-sm text-gray-900">Signature Verification</span>
              </div>
              <Badge variant={webhookStatus.security.signature_verification ? "default" : "secondary"}>
                {webhookStatus.security.signature_verification ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className={`w-4 h-4 ${getSecurityColor(webhookStatus.security.webhook_secret_configured)}`} />
                <span className="text-sm text-gray-900">Webhook Secret</span>
              </div>
              <Badge variant={webhookStatus.security.webhook_secret_configured ? "default" : "secondary"}>
                {webhookStatus.security.webhook_secret_configured ? 'Configured' : 'Not Configured'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Brandkit Integration */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Brandkit Integration</h4>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Real-time Sync</span>
              </div>
              <Badge variant={webhookStatus.brandkit.real_time_sync ? "default" : "secondary"}>
                {webhookStatus.brandkit.real_time_sync ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="text-xs text-blue-800 space-y-1">
              <p><strong>Content Types:</strong> {webhookStatus.brandkit.content_types.join(', ')}</p>
              <p><strong>Last Sync:</strong> {new Date(webhookStatus.brandkit.last_sync).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}