import { Redis } from '@upstash/redis';
const kv = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
});
import type { IncidentAnalysis, IncidentStatus } from '@/types/incident';
import { IncidentType, IncidentSeverity, IncidentStatus as IncStatus } from '@/types/incident';
import type { StoredIncidentSummary } from '../analysis/similarity';
import type { ExtractedIndicator } from '../analysis/types';
import type {
  IncidentRepository,
  DashboardMetrics,
  ListResult,
  ListFilters,
} from './incident-repository';

interface StoredEntry {
  analysis: IncidentAnalysis;
  priorityScore: number;
}

export class KvIncidentRepository implements IncidentRepository {
  
  private reviveDates(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((i) => this.reviveDates(i));
    
    const record = { ...obj };
    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (typeof value === 'string' && ISO_RE.test(value)) {
        record[key] = new Date(value);
      } else {
        record[key] = this.reviveDates(value);
      }
    }
    return record;
  }

  async generateId(): Promise<string> {
    const counter = await kv.incr('meta:counter');
    return `INC-${String(counter).padStart(4, '0')}`;
  }

  async save(analysis: IncidentAnalysis, priorityScore: number): Promise<void> {
    const entry: StoredEntry = { analysis, priorityScore };
    await kv.set(`incident:${analysis.incidentId}`, entry);
    await kv.sadd('incidents:ids', analysis.incidentId);
  }

  async getById(id: string): Promise<IncidentAnalysis | null> {
    const entry = await kv.get<StoredEntry>(`incident:${id}`);
    if (!entry) return null;
    return this.reviveDates(entry.analysis);
  }

  private async listAllEntries(): Promise<StoredEntry[]> {
    const ids = await kv.smembers('incidents:ids');
    if (!ids || ids.length === 0) return [];
    
    const keys = ids.map((id) => `incident:${id}`);
    const entries = (await kv.mget(...keys)) as (StoredEntry | null)[];
    
    return entries.filter((e): e is StoredEntry => e !== null).map((e) => {
      e.analysis = this.reviveDates(e.analysis);
      return e;
    });
  }

  async list(filters: ListFilters = {}): Promise<ListResult> {
    let entries = await this.listAllEntries();

    if (filters.severity) {
      entries = entries.filter((e) => e.analysis.severity === filters.severity);
    }
    if (filters.type) {
      entries = entries.filter((e) => e.analysis.incidentType === filters.type);
    }
    if (filters.status) {
      entries = entries.filter((e) => e.analysis.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.analysis.incidentId.toLowerCase().includes(q) ||
          e.analysis.summary.toLowerCase().includes(q) ||
          e.analysis.originalReport.toLowerCase().includes(q)
      );
    }

    // Sort by priorityScore desc, then createdAt desc
    entries.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return b.analysis.createdAt.getTime() - a.analysis.createdAt.getTime();
    });

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const total = entries.length;
    const start = (page - 1) * limit;
    
    const paged = entries.slice(start, start + limit).map((e) => e.analysis);

    return {
      incidents: paged,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async update(id: string, updates: { status?: IncidentStatus; notes?: string }): Promise<IncidentAnalysis | null> {
    const entry = await kv.get<StoredEntry>(`incident:${id}`);
    if (!entry) return null;

    if (updates.status) {
      entry.analysis.status = updates.status;
      entry.analysis.statusHistory.push({
        status: updates.status,
        timestamp: new Date(),
      });
      entry.analysis.updatedAt = new Date();
    }
    if (updates.notes !== undefined) {
      entry.analysis.notes = updates.notes;
      entry.analysis.updatedAt = new Date();
    }

    await kv.set(`incident:${id}`, entry);
    return this.reviveDates(entry.analysis);
  }

  async getSummariesExcluding(excludeId: string): Promise<StoredIncidentSummary[]> {
    const entries = await this.listAllEntries();
    return entries
      .filter((e) => e.analysis.incidentId !== excludeId)
      .map((e) => ({
        incidentId: e.analysis.incidentId,
        incidentType: e.analysis.incidentType,
        summary: e.analysis.summary,
        originalReport: e.analysis.originalReport,
        indicators: e.analysis.technicalIndicators as ExtractedIndicator[],
        normalizedText: e.analysis.sanitizedReport,
        createdAt: e.analysis.createdAt,
      }));
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const entries = await this.listAllEntries();
    const analyses = entries.map((e) => e.analysis);

    const metrics: DashboardMetrics = {
      total: analyses.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      newCount: 0,
      activeClusters: 0,
      typeDistribution: Object.values(IncidentType).reduce(
        (acc, t) => ({ ...acc, [t]: 0 }),
        {}
      ),
      recentIncidents: [],
    };

    const clusters = new Set<string>();

    for (const a of analyses) {
      if (a.severity === IncidentSeverity.CRITICAL) metrics.critical++;
      else if (a.severity === IncidentSeverity.HIGH) metrics.high++;
      else if (a.severity === IncidentSeverity.MEDIUM) metrics.medium++;
      else if (a.severity === IncidentSeverity.LOW) metrics.low++;

      if (a.status === IncStatus.NEW) metrics.newCount++;

      if (a.clusterId) clusters.add(a.clusterId);

      if (metrics.typeDistribution[a.incidentType] !== undefined) {
        metrics.typeDistribution[a.incidentType]++;
      }
    }

    metrics.activeClusters = clusters.size;

    entries.sort(
      (a, b) => b.analysis.createdAt.getTime() - a.analysis.createdAt.getTime()
    );
    metrics.recentIncidents = entries.slice(0, 10).map((e) => e.analysis);

    return metrics;
  }

  async count(): Promise<number> {
    return await kv.scard('incidents:ids');
  }
}

export const kvIncidentRepository = new KvIncidentRepository();
