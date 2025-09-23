'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Play, 
  Pause, 
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Database,
  Brain,
  BarChart3,
  FileText,
  Bell
} from 'lucide-react';
import { enhancedApi, AutomateWorkflow } from '@/lib/enhanced-api';

interface AutomateWorkflowsProps {
  environment?: string;
  branch?: string;
}

export function AutomateWorkflows({ 
  environment = 'development', 
  branch = 'main' 
}: AutomateWorkflowsProps) {
  const [workflows, setWorkflows] = useState<AutomateWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await enhancedApi.getAutomateWorkflows(environment, branch);
      if (response.success && response.data) {
        setWorkflows(response.data);
        // Automate workflows loaded
      } else {
        setError('Failed to load workflows');
      }
    } catch (err) {
      console.error('❌ Error loading workflows:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [environment, branch]);

  const handleExecuteWorkflow = async (workflowId: string) => {
    setExecuting(workflowId);
    
    try {
      const response = await enhancedApi.executeAutomateWorkflow(
        { workflowId, triggerData: { manual: true } },
        environment,
        branch
      );
      
      if (response.success) {
        // Workflow executed
        // Refresh workflows to update last run time
        await loadWorkflows();
      } else {
        console.error(`❌ Workflow ${workflowId} execution failed:`, response.errors);
      }
    } catch (err) {
      console.error(`❌ Workflow ${workflowId} execution error:`, err);
    } finally {
      setExecuting(null);
    }
  };

  const handleToggleWorkflow = async (workflowId: string, enabled: boolean) => {
    try {
      const response = await enhancedApi.updateAutomateWorkflow(
        workflowId,
        { enabled },
        environment,
        branch
      );
      
      if (response.success) {
        // Workflow status updated
        await loadWorkflows();
      }
    } catch (err) {
      console.error(`❌ Error toggling workflow ${workflowId}:`, err);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'brandkit_sync': return Database;
      case 'content_analysis': return Brain;
      case 'bulk_replace': return BarChart3;
      case 'entry_update': return FileText;
      case 'notification': return Bell;
      default: return Settings;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'brandkit_sync': return 'text-yellow-600 bg-yellow-50';
      case 'content_analysis': return 'text-purple-600 bg-purple-50';
      case 'bulk_replace': return 'text-blue-600 bg-blue-50';
      case 'entry_update': return 'text-green-600 bg-green-50';
      case 'notification': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTriggerColor = (trigger: string) => {
    switch (trigger) {
      case 'entry.publish': return 'text-green-600 bg-green-50';
      case 'entry.update': return 'text-blue-600 bg-blue-50';
      case 'entry.create': return 'text-purple-600 bg-purple-50';
      case 'schedule': return 'text-orange-600 bg-orange-50';
      case 'manual': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading workflows...</span>
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
          onClick={loadWorkflows} 
          className="mt-4"
          size="sm"
        >
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-purple-600" />
          <span>Automate Workflows</span>
        </h3>
        <div className="flex items-center space-x-2">
          <Button
            onClick={loadWorkflows}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </Button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-8">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Workflows</h4>
          <p className="text-gray-500 mb-4">Create your first automation workflow to get started.</p>
          <Button className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Workflow</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900">{workflow.name}</h4>
                    <Badge variant={workflow.enabled ? "default" : "secondary"}>
                      {workflow.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{workflow.description}</p>
                  
                  {/* Triggers */}
                  <div className="mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Triggers</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {workflow.triggers.map((trigger, index) => (
                        <Badge key={index} className={`text-xs ${getTriggerColor(trigger)}`}>
                          {trigger}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {workflow.actions.map((action, index) => {
                        const Icon = getActionIcon(action.type);
                        return (
                          <div key={index} className="flex items-center space-x-1 px-2 py-1 rounded text-xs bg-gray-100">
                            <Icon className="w-3 h-3" />
                            <span className="text-gray-700">{action.type.replace('_', ' ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Last Run */}
                  {workflow.lastRun && (
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>Last run: {new Date(workflow.lastRun).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    onClick={() => handleExecuteWorkflow(workflow.id)}
                    disabled={executing === workflow.id || !workflow.enabled}
                    size="sm"
                    variant="outline"
                    className="flex items-center space-x-1"
                  >
                    {executing === workflow.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    <span>Run</span>
                  </Button>
                  
                  <Button
                    onClick={() => handleToggleWorkflow(workflow.id, !workflow.enabled)}
                    size="sm"
                    variant="outline"
                    className="flex items-center space-x-1"
                  >
                    {workflow.enabled ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center space-x-1"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}