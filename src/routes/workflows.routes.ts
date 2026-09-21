/**
 * Workflows Routes — Full CRUD + Real-time Execution via Orchestrator
 */
import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { createWorkflow, getWorkflows, updateWorkflow, deleteWorkflow } from '../db/workflow.store.js';
import { getWorkflowRun, getWorkflowRuns, getBusinessRuns } from '../db/workflowRun.store.js';
import { orchestrateWorkflow, suggestWorkflow } from '../engine/orchestrator.engine.js';

const router = Router();

// GET /api/workflows/:businessId — list workflows
router.get('/:businessId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
  try {
    const workflows = await getWorkflows(businessId);
    res.json({ success: true, workflows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workflows.' });
  }
});

// POST /api/workflows/:businessId — create workflow
router.post('/:businessId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
  const { name, description, trigger, steps, status } = req.body;
  if (!name || !trigger) return res.status(400).json({ error: 'name and trigger are required.' });
  try {
    const workflow = await createWorkflow(businessId, { name, description: description || '', trigger, steps: steps || [], status: status || 'active' });
    res.status(201).json({ success: true, workflow });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create workflow.' });
  }
});

// PUT /api/workflows/:businessId/:workflowId — update workflow
router.put('/:businessId/:workflowId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  const workflowId = req.params.workflowId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
  try {
    const workflow = await updateWorkflow(businessId, workflowId, req.body);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found.' });
    res.json({ success: true, workflow });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update workflow.' });
  }
});

// DELETE /api/workflows/:businessId/:workflowId — delete workflow
router.delete('/:businessId/:workflowId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  const workflowId = req.params.workflowId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
  try {
    await deleteWorkflow(businessId, workflowId);
    res.json({ success: true, message: 'Workflow deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete workflow.' });
  }
});

// POST /api/workflows/:businessId/suggest — AI suggest a workflow from prompt
router.post('/:businessId/suggest', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required.' });
  try {
    const suggestion = suggestWorkflow(prompt);
    res.json({ success: true, suggestion });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate workflow suggestion.' });
  }
});

// POST /api/workflows/:businessId/:workflowId/run — execute workflow via orchestrator
router.post('/:businessId/:workflowId/run', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  const workflowId = req.params.workflowId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });

  try {
    const workflows = await getWorkflows(businessId);
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found.' });
    if (workflow.steps.length === 0) return res.status(400).json({ error: 'Workflow has no steps.' });

    const { runId } = await orchestrateWorkflow({
      workflowId: workflow.id,
      businessId,
      workflowName: workflow.name,
      trigger: req.body.trigger || workflow.trigger,
      steps: workflow.steps,
      triggerData: req.body.triggerData,
    });

    res.status(202).json({ success: true, runId, message: 'Workflow execution started. Poll /runs/:runId for real-time updates.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to start workflow.' });
  }
});

// GET /api/workflows/:businessId/runs/all — all recent runs for business
router.get('/:businessId/runs/all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
  try {
    const runs = await getBusinessRuns(businessId, 20);
    res.json({ success: true, runs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch runs.' });
  }
});

// GET /api/workflows/:businessId/:workflowId/runs — runs for specific workflow
router.get('/:businessId/:workflowId/runs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  const workflowId = req.params.workflowId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
  try {
    const runs = await getWorkflowRuns(workflowId, businessId);
    res.json({ success: true, runs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workflow runs.' });
  }
});

// GET /api/workflows/:businessId/run/:runId — poll a specific run for real-time updates
router.get('/:businessId/run/:runId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  const runId = req.params.runId as string;
  if (req.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
  try {
    const run = await getWorkflowRun(runId);
    if (!run) return res.status(404).json({ error: 'Run not found.' });
    if (run.businessId !== businessId) return res.status(403).json({ error: 'Access denied.' });
    res.json({ success: true, run });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch run.' });
  }
});

// GET /api/workflows/:businessId/run/:runId/stream — Server-Sent Events for real-time polling
router.get('/:businessId/run/:runId/stream', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.params.businessId as string;
  const runId = req.params.runId as string;
  if (req.businessId !== businessId) {
    res.status(403).end(); return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let pollCount = 0;
  const maxPolls = 60; // 60 seconds max stream

  const poll = async () => {
    try {
      const run = await getWorkflowRun(runId);
      if (!run) { send({ error: 'Run not found' }); res.end(); return; }

      send({ run });
      pollCount++;

      if (run.status !== 'running' || pollCount >= maxPolls) {
        send({ done: true });
        res.end();
      } else {
        setTimeout(poll, 1000); // poll every second
      }
    } catch {
      send({ error: 'Stream error' });
      res.end();
    }
  };

  req.on('close', () => { /* client disconnected */ });
  await poll();
});

export default router;
