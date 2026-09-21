/**
 * IncidentRepository — Shared persistence abstraction
 *
 * All incident persistence goes through this interface.
 * The UI never touches storage directly — only API routes do.
 *
 * Architecture:
 *   Browser → Next.js API Routes → IncidentRepository → FileIncidentRepository
 */

import type { IncidentAnalysis, IncidentStatus } from '@/types/incident';
import type { StoredIncidentSummary } from '../analysis/similarity';

export interface DashboardMetrics {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  newCount: number;
  activeClusters: number;
  typeDistribution: Record<string, number>;
  recentIncidents: IncidentAnalysis[];
}

export interface ListResult {
  incidents: IncidentAnalysis[];
  total: number;
  pages: number;
}

export interface ListFilters {
  severity?: string;
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IncidentRepository {
  generateId(): Promise<string>;
  save(incident: IncidentAnalysis, priorityScore: number): Promise<void>;
  getById(id: string): Promise<IncidentAnalysis | null>;
  list(filters?: ListFilters): Promise<ListResult>;
  update(id: string, updates: { status?: IncidentStatus; notes?: string }): Promise<IncidentAnalysis | null>;
  getSummariesExcluding(excludeId: string): Promise<StoredIncidentSummary[]>;
  getDashboardMetrics(): Promise<DashboardMetrics>;
  count(): Promise<number>;
}
