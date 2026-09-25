/**
 * Prometheus Metrics Module — Adapted from heytam-core
 * Provides /metrics endpoint for Prometheus scraping.
 * Tracks: agent requests, workflow executions, LLM latency, cron task health.
 */

// ─── Type definitions for prom-client (avoids requiring the npm package) ──────
// We implement a lightweight local registry to avoid adding a heavy dependency.
// If prom-client IS available, this is replaced by the actual lib.

type LabelValues = Record<string, string | number>;

interface MetricEntry {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: Map<string, number>;
  buckets?: number[];
}

class SimpleMetricsRegistry {
  private registry = new Map<string, MetricEntry>();
  readonly contentType = 'text/plain; version=0.0.4; charset=utf-8';

  registerCounter(name: string, help: string, labelNames: string[]): Counter {
    const entry: MetricEntry = { name, help, type: 'counter', values: new Map() };
    this.registry.set(name, entry);
    return new Counter(entry);
  }

  registerGauge(name: string, help: string, labelNames: string[]): Gauge {
    const entry: MetricEntry = { name, help, type: 'gauge', values: new Map() };
    this.registry.set(name, entry);
    return new Gauge(entry);
  }

  registerHistogram(name: string, help: string, labelNames: string[], buckets: number[]): Histogram {
    const entry: MetricEntry = { name, help, type: 'histogram', values: new Map(), buckets };
    this.registry.set(name, entry);
    return new Histogram(entry, buckets);
  }

  async getMetrics(): Promise<string> {
    const lines: string[] = [];
    for (const [, entry] of this.registry) {
      lines.push(`# HELP ${entry.name} ${entry.help}`);
      lines.push(`# TYPE ${entry.name} ${entry.type}`);
      for (const [labels, value] of entry.values) {
        lines.push(`${entry.name}${labels ? `{${labels}}` : ''} ${value}`);
      }
    }
    return lines.join('\n') + '\n';
  }
}

class Counter {
  constructor(private entry: MetricEntry) {}

  labels(labelObj: LabelValues): { inc: (v?: number) => void } {
    const labelStr = Object.entries(labelObj).map(([k, v]) => `${k}="${v}"`).join(',');
    return {
      inc: (v = 1) => {
        const current = this.entry.values.get(labelStr) || 0;
        this.entry.values.set(labelStr, current + v);
      }
    };
  }

  inc(v = 1): void {
    const current = this.entry.values.get('') || 0;
    this.entry.values.set('', current + v);
  }
}

class Gauge {
  constructor(private entry: MetricEntry) {}

  labels(labelObj: LabelValues): { set: (v: number) => void; inc: (v?: number) => void } {
    const labelStr = Object.entries(labelObj).map(([k, v]) => `${k}="${v}"`).join(',');
    return {
      set: (v: number) => { this.entry.values.set(labelStr, v); },
      inc: (v = 1) => {
        const current = this.entry.values.get(labelStr) || 0;
        this.entry.values.set(labelStr, current + v);
      }
    };
  }

  set(v: number): void { this.entry.values.set('', v); }
}

class Histogram {
  private pendingTimers = new Map<string, number>();

  constructor(private entry: MetricEntry, private buckets: number[]) {}

  labels(labelObj: LabelValues): { startTimer: () => () => void; observe: (v: number) => void } {
    const labelStr = Object.entries(labelObj).map(([k, v]) => `${k}="${v}"`).join(',');
    return {
      startTimer: () => {
        const start = Date.now();
        return () => {
          const duration = (Date.now() - start) / 1000;
          this.observe(labelStr, duration);
        };
      },
      observe: (v: number) => this.observe(labelStr, v),
    };
  }

  private observe(labelStr: string, value: number): void {
    const key = labelStr ? `sum,${labelStr}` : 'sum';
    this.entry.values.set(key, (this.entry.values.get(key) || 0) + value);
    const countKey = labelStr ? `count,${labelStr}` : 'count';
    this.entry.values.set(countKey, (this.entry.values.get(countKey) || 0) + 1);
  }
}

// ─── Create the global registry ──────────────────────────────────────────────
export const metricsRegistry = new SimpleMetricsRegistry();

// ─── Heytam Agent Metrics (mirrors heytam-core's Prometheus config) ───────────

/** Total agent execution requests */
export const agentRequestsTotal = metricsRegistry.registerCounter(
  'heytam_agent_requests_total',
  'Total number of agent task executions',
  ['agent_id', 'status']
);

/** Agent execution duration in seconds */
export const agentRequestDuration = metricsRegistry.registerHistogram(
  'heytam_agent_request_duration_seconds',
  'Duration of agent executions in seconds',
  ['agent_id'],
  [0.5, 1, 2.5, 5, 10, 30, 60]
);

/** Orchestrator workflow executions */
export const workflowExecutionsTotal = metricsRegistry.registerCounter(
  'heytam_workflow_executions_total',
  'Total number of workflow executions by the HeyTam orchestrator',
  ['workflow_name', 'status']
);

/** Cron task executions (mirroring heytam-core scheduler metrics) */
export const cronExecutionsTotal = metricsRegistry.registerCounter(
  'heytam_cron_executions_total',
  'Total number of scheduled cron tasks executed by HeyTam orchestrator',
  ['task_type', 'status']
);

/** Real action executions (email, SMS, call) */
export const realActionsTotal = metricsRegistry.registerCounter(
  'heytam_real_actions_total',
  'Total number of real-world actions taken by agents (email, sms, call)',
  ['action_type', 'status']
);

/** CRM lead signals received */
export const crmSignalsTotal = metricsRegistry.registerCounter(
  'heytam_crm_signals_total',
  'Total number of CRM lead signals received',
  ['signal_type', 'status']
);

/** Active workflow runs gauge */
export const activeWorkflowRuns = metricsRegistry.registerGauge(
  'heytam_active_workflow_runs',
  'Number of currently running workflow executions',
  []
);

/** Current AI backend in use */
export const currentAiBackend = metricsRegistry.registerGauge(
  'heytam_ai_backend_info',
  'Currently configured AI backend (1=OpenAI, 2=Anthropic, 3=Copilot)',
  ['backend']
);
