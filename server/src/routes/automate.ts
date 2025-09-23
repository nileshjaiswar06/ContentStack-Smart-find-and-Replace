import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { 
  getActiveWorkflows, 
  getWorkflow, 
  executeWorkflow, 
  createWorkflow, 
  updateWorkflow, 
  deleteWorkflow 
} from "../services/automateService.js";

const router = Router();

/**
 * GET /automate/workflows
 * Get all active workflows
 */
router.get("/workflows", async (req: Request, res: Response) => {
  try {
    const { environment = 'development', branch = 'main' } = req.query;
    
    logger.info("Getting automate workflows", { environment, branch });
    
    const workflows = getActiveWorkflows();
    
    res.json({
      success: true,
      data: workflows
    });
  } catch (error: any) {
    logger.error("Error getting workflows", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to get workflows",
      details: error.message
    });
  }
});

/**
 * GET /automate/workflows/:id
 * Get a specific workflow by ID
 */
router.get("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { environment = 'development', branch = 'main' } = req.query;
    
    logger.info("Getting workflow", { id, environment, branch });
    
    if (typeof id !== "string") {
      return res.status(400).json({
        success: false,
        error: "Workflow ID is required"
      });
    }

    const workflow = getWorkflow(id as string);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found"
      });
    }
    
    res.json({
      success: true,
      data: workflow
    });
  } catch (error: any) {
    logger.error("Error getting workflow", { error: error.message, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: "Failed to get workflow",
      details: error.message
    });
  }
});

/**
 * POST /automate/workflows
 * Create a new workflow
 */
router.post("/workflows", async (req: Request, res: Response) => {
  try {
    const { environment = 'development', branch = 'main' } = req.query;
    const workflowData = req.body;
    
    logger.info("Creating workflow", { environment, branch, workflowName: workflowData.name });
    
    const workflowId = createWorkflow(workflowData);
    const workflow = getWorkflow(workflowId);
    
    res.status(201).json({
      success: true,
      data: workflow
    });
  } catch (error: any) {
    logger.error("Error creating workflow", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to create workflow",
      details: error.message
    });
  }
});

/**
 * PUT /automate/workflows/:id
 * Update an existing workflow
 */
router.put("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { environment = 'development', branch = 'main' } = req.query;
    const updates = req.body;
    
    logger.info("Updating workflow", { id, environment, branch });

    if (typeof id !== "string") {
      return res.status(400).json({
        success: false,
        error: "Workflow ID is required"
      });
    }
    
    const success = updateWorkflow(id, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found"
      });
    }
    
    const workflow = getWorkflow(id);
    
    res.json({
      success: true,
      data: workflow
    });
  } catch (error: any) {
    logger.error("Error updating workflow", { error: error.message, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: "Failed to update workflow",
      details: error.message
    });
  }
});

/**
 * DELETE /automate/workflows/:id
 * Delete a workflow
 */
router.delete("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { environment = 'development', branch = 'main' } = req.query;
    
    logger.info("Deleting workflow", { id, environment, branch });

    if (typeof id !== "string") {
      return res.status(400).json({
        success: false,
        error: "Workflow ID is required"
      });
    }
    
    const success = deleteWorkflow(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found"
      });
    }
    
    res.json({
      success: true
    });
  } catch (error: any) {
    logger.error("Error deleting workflow", { error: error.message, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: "Failed to delete workflow",
      details: error.message
    });
  }
});

/**
 * POST /automate/execute
 * Execute a workflow
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { workflowId, triggerData = {} } = req.body;
    const { environment = 'development', branch = 'main' } = req.query;
    
    if (!workflowId) {
      return res.status(400).json({
        success: false,
        error: "Workflow ID is required"
      });
    }
    
    logger.info("Executing workflow", { workflowId, environment, branch });
    
    const result = await executeWorkflow(workflowId, triggerData);
    
    res.json({
      success: result.success,
      results: result.results,
      errors: result.errors
    });
  } catch (error: any) {
    logger.error("Error executing workflow", { error: error.message, workflowId: req.body.workflowId });
    res.status(500).json({
      success: false,
      error: "Failed to execute workflow",
      details: error.message
    });
  }
});

export default router;