import { logger } from "../utils/logger.js";
import { syncExternalBrandkitData } from "./externalBrandkitService.js";
import { generateBrandkitSuggestions } from "./brandkitService.js";
import { applySuggestionsToDoc } from "./applyService.js";
import { fetchEntryDraft, updateEntry } from "./contentstackService.js";

export interface AutomateWorkflow {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  actions: AutomateAction[];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface AutomateAction {
  type: 'brandkit_sync' | 'content_analysis' | 'bulk_replace' | 'entry_update' | 'notification';
  config: any;
  condition?: string;
}

export interface AutomateTrigger {
  type: 'webhook' | 'schedule' | 'content_change' | 'manual';
  config: any;
}

// Predefined workflows for common use cases
export const PREDEFINED_WORKFLOWS: AutomateWorkflow[] = [
  {
    id: 'brandkit_auto_sync',
    name: 'Auto Brandkit Sync',
    description: 'Automatically sync brandkit data when brand content changes',
    triggers: ['entry.publish', 'entry.update'],
    actions: [
      {
        type: 'brandkit_sync',
        config: { content_types: ['brands', 'banned_phrases', 'tone_rules'] }
      }
    ],
    enabled: true
  },
  {
    id: 'content_brand_check',
    name: 'Content Brand Compliance Check',
    description: 'Check content for brand compliance and suggest improvements',
    triggers: ['entry.publish', 'entry.update'],
    actions: [
      {
        type: 'content_analysis',
        config: { 
          check_banned_phrases: true,
          check_tone_consistency: true,
          generate_suggestions: true
        }
      }
    ],
    enabled: true
  },
  {
    id: 'bulk_brand_update',
    name: 'Bulk Brand Update',
    description: 'Update multiple entries with new brand terms',
    triggers: ['manual', 'schedule'],
    actions: [
      {
        type: 'bulk_replace',
        config: {
          content_types: ['article', 'blog', 'page'],
          fields: ['title', 'body', 'description']
        }
      }
    ],
    enabled: false
  }
];

// Active workflows registry
const activeWorkflows = new Map<string, AutomateWorkflow>();


// Initialize Automate service with predefined workflows
export function initializeAutomateService(): void {
  logger.info("Initializing Automate service");
  
  // Register predefined workflows
  PREDEFINED_WORKFLOWS.forEach(workflow => {
    if (workflow.enabled) {
      activeWorkflows.set(workflow.id, workflow);
      logger.info("Registered workflow", { 
        id: workflow.id, 
        name: workflow.name,
        triggers: workflow.triggers 
      });
    }
  });
  
  logger.info("Automate service initialized", { 
    total_workflows: activeWorkflows.size 
  });
}

// Execute a workflow by ID
export async function executeWorkflow(
  workflowId: string, 
  triggerData: any = {},
  requestId?: string
): Promise<{ success: boolean; results: any[]; errors: string[] }> {
  const workflow = activeWorkflows.get(workflowId);
  
  if (!workflow) {
    const error = `Workflow not found: ${workflowId}`;
    logger.error("Workflow execution failed", { workflowId, error, requestId });
    return { success: false, results: [], errors: [error] };
  }

  logger.info("Executing workflow", { 
    workflowId, 
    name: workflow.name, 
    requestId 
  });

  const results: any[] = [];
  const errors: string[] = [];

  try {
    for (const action of workflow.actions) {
      try {
        const result = await executeAction(action, triggerData, requestId);
        results.push(result);
        
        logger.debug("Action executed successfully", {
          workflowId,
          actionType: action.type,
          result: result.success
        });
      } catch (error: any) {
        const errorMsg = `Action ${action.type} failed: ${error.message}`;
        errors.push(errorMsg);
        logger.error("Action execution failed", {
          workflowId,
          actionType: action.type,
          error: error.message,
          requestId
        });
      }
    }

    // Update workflow last run time
    workflow.lastRun = new Date();
    activeWorkflows.set(workflowId, workflow);

    const success = errors.length === 0;
    logger.info("Workflow execution completed", {
      workflowId,
      success,
      resultsCount: results.length,
      errorsCount: errors.length,
      requestId
    });

    return { success, results, errors };
  } catch (error: any) {
    const errorMsg = `Workflow execution failed: ${error.message}`;
    errors.push(errorMsg);
    logger.error("Workflow execution failed", {
      workflowId,
      error: error.message,
      requestId
    });
    return { success: false, results, errors };
  }
}

// Execute a single action
async function executeAction(
  action: AutomateAction, 
  triggerData: any, 
  requestId?: string
): Promise<{ success: boolean; actionType: string; data?: any; error?: string }> {
  try {
    switch (action.type) {
      case 'brandkit_sync':
        const syncResult = await syncExternalBrandkitData(requestId);
        return {
          success: syncResult.success,
          actionType: 'brandkit_sync',
          data: syncResult
        };

      case 'content_analysis':
        const analysisResult = await performContentAnalysis(triggerData, action.config);
        return {
          success: true,
          actionType: 'content_analysis',
          data: analysisResult
        };

      case 'bulk_replace':
        const bulkResult = await performBulkReplace(triggerData, action.config);
        return {
          success: true,
          actionType: 'bulk_replace',
          data: bulkResult
        };

      case 'entry_update':
        const updateResult = await performEntryUpdate(triggerData, action.config);
        return {
          success: true,
          actionType: 'entry_update',
          data: updateResult
        };

      case 'notification':
        const notificationResult = await sendNotification(triggerData, action.config);
        return {
          success: true,
          actionType: 'notification',
          data: notificationResult
        };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  } catch (error: any) {
    return {
      success: false,
      actionType: action.type,
      error: error.message
    };
  }
}

// Perform content analysis for brand compliance
async function performContentAnalysis(
  triggerData: any, 
  config: any
): Promise<any> {
  const { entry_uid, content_type_uid, text } = triggerData;
  
  if (!text) {
    throw new Error("No text provided for content analysis");
  }

  // Generate brandkit suggestions
  const suggestions = await generateBrandkitSuggestions(text);
  
  const analysis = {
    entry_uid,
    content_type_uid,
    text_length: text.length,
    suggestions: suggestions,
    banned_phrases_found: suggestions.filter((s: any) => s.suggestionType === 'banned_phrase').length,
    tone_issues_found: suggestions.filter((s: any) => s.suggestionType === 'tone_style').length,
    brand_suggestions_found: suggestions.filter((s: any) => s.suggestionType === 'brand_standardization').length,
    analysis_timestamp: new Date().toISOString()
  };

  logger.info("Content analysis completed", {
    entry_uid,
    suggestions_count: suggestions.length,
    banned_phrases: analysis.banned_phrases_found,
    tone_issues: analysis.tone_issues_found
  });

  return analysis;
}

 // Perform bulk replace operation
async function performBulkReplace(
  triggerData: any, 
  config: any
): Promise<any> {
  const { entries, replacements } = triggerData;
  
  if (!entries || !Array.isArray(entries)) {
    throw new Error("No entries provided for bulk replace");
  }
  
  if (!replacements || !Array.isArray(replacements)) {
    throw new Error("No replacements provided for bulk replace");
  }

  const results = [];
  
  for (const entry of entries) {
    try {
      const result = await applySuggestionsToDoc(entry, replacements);
      results.push({
        entry_uid: entry.uid,
        success: true,
        changes_applied: result.totalReplaced > 0,
        replacements_made: result.totalReplaced
      });
    } catch (error: any) {
      results.push({
        entry_uid: entry.uid,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const totalReplacements = results.reduce((sum, r) => sum + (r.replacements_made || 0), 0);

  logger.info("Bulk replace completed", {
    total_entries: entries.length,
    success_count: successCount,
    total_replacements: totalReplacements
  });

  return {
    total_entries: entries.length,
    success_count: successCount,
    total_replacements: totalReplacements,
    results
  };
}

 // Perform entry update
async function performEntryUpdate(
  triggerData: any, 
  config: any
): Promise<any> {
  const { entry_uid, content_type_uid, updates } = triggerData;
  
  if (!entry_uid || !content_type_uid || !updates) {
    throw new Error("Missing required data for entry update");
  }

  // Get current entry
  const currentEntry = await fetchEntryDraft(content_type_uid, entry_uid);
  
  if (!currentEntry) {
    throw new Error(`Entry not found: ${entry_uid}`);
  }

  // Apply updates
  const updatedEntry = { ...currentEntry, ...updates };
  
  // Update entry in Contentstack
  const result = await updateEntry(content_type_uid, entry_uid, updatedEntry);
  
  logger.info("Entry update completed", {
    entry_uid,
    content_type_uid,
    updates_applied: Object.keys(updates).length
  });

  return {
    entry_uid,
    content_type_uid,
    updates_applied: Object.keys(updates).length,
    result
  };
}

// Send notification
async function sendNotification(
  triggerData: any, 
  config: any
): Promise<any> {
  const { message, recipients, type = 'info' } = config;
  
  // This would integrate with your notification service
  // For now, just log the notification
  logger.info("Notification sent", {
    type,
    message,
    recipients: recipients?.length || 0,
    trigger_data: Object.keys(triggerData)
  });

  return {
    type,
    message,
    recipients: recipients?.length || 0,
    sent_at: new Date().toISOString()
  };
}

// Get all active workflows
export function getActiveWorkflows(): AutomateWorkflow[] {
  return Array.from(activeWorkflows.values());
}

// Get workflow by ID
export function getWorkflow(workflowId: string): AutomateWorkflow | undefined {
  return activeWorkflows.get(workflowId);
}

// Create a new workflow
export function createWorkflow(workflow: Omit<AutomateWorkflow, 'id'>): string {
  const id = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newWorkflow: AutomateWorkflow = { ...workflow, id };
  
  activeWorkflows.set(id, newWorkflow);
  
  logger.info("Workflow created", { id, name: workflow.name });
  
  return id;
}

// Update an existing workflow
export function updateWorkflow(workflowId: string, updates: Partial<AutomateWorkflow>): boolean {
  const existing = activeWorkflows.get(workflowId);
  
  if (!existing) {
    return false;
  }
  
  const updated = { ...existing, ...updates };
  activeWorkflows.set(workflowId, updated);
  
  logger.info("Workflow updated", { workflowId, name: updated.name });
  
  return true;
}

// Delete a workflow
export function deleteWorkflow(workflowId: string): boolean {
  const deleted = activeWorkflows.delete(workflowId);
  
  if (deleted) {
    logger.info("Workflow deleted", { workflowId });
  }
  
  return deleted;
}