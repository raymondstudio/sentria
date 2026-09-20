/**
 * FileIncidentRepository
 *
 * File-system based incident store. Each incident is written as an individual
 * JSON file under <project-root>/incident-store/incidents/.
 * A counter/index is maintained in <project-root>/incident-store/meta.json.
 *
 * Data survives server restarts.
 * All visitors to the same server instance share the same store.
 *
 * Note: Not suitable for multi-instance deployments. For production,
 * replace with a database-backed implementation. The IncidentRepository
 * interface makes this swap straightforward.
 */

import fs from 'fs';
import path from 'path';

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

// ─── Storage paths ────────────────────────────────────────────────────────────

const STORE_ROOT = path.join(process.cwd(), 'incident-store');
const INCIDENTS_DIR = path.join(STORE_ROOT, 'incidents');
const META_FILE = path.join(STORE_ROOT, 'meta.json');

interface Meta {
  counter: number;
}

interface StoredEntry {
  analysis: IncidentAnalysis;
  priorityScore: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDirs(): void {
  if (!fs.existsSync(STORE_ROOT)) fs.mkdirSync(STORE_ROOT, { recursive: true });
  if (!fs.existsSync(INCIDENTS_DIR)) fs.mkdirSync(INCIDENTS_DIR, { recursive: true });
}

function readMeta(): Meta {
  try {
    if (fs.existsSync(META_FILE)) {
      const raw = fs.readFileSync(META_FILE, 'utf-8');
      return JSON.parse(raw) as Meta;
    }
  } catch {
    // meta is missing or corrupt — start fresh
  }
  return { counter: 0 };
}

function writeMeta(meta: Meta): void {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * Revive Date objects that JSON.parse turns into strings.
 */
function reviveDates(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);

  const record = obj as Record<string, unknown>;
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === 'string' && ISO_RE.test(value)) {
      record[key] = new Date(value);
    } else {
      record[key] = reviveDates(value);
    }
  }
  return record;
}

function incidentFilePath(incidentId: string): string {
  return path.join(INCIDENTS_DIR, `${incidentId}.json`);
}

function writeEntry(entry: StoredEntry): void {
  const file = incidentFilePath(entry.analysis.incidentId);
  fs.writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8');
}

function readEntry(incidentId: string): StoredEntry | null {
  const file = incidentFilePath(incidentId);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return reviveDates(JSON.parse(raw)) as StoredEntry;
  } catch {
    return null;
  }
}

function listAllEntries(): StoredEntry[] {
  ensureDirs();
  let files: string[];
  try {
    files = fs.readdirSync(INCIDENTS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const entries: StoredEntry[] = [];
  for (const file of files) {
    const incidentId = file.replace(/\.json$/, '');
    const entry = readEntry(incidentId);
    if (entry) entries.push(entry);
  }
  return entries;
}

// ─── Repository implementation ────────────────────────────────────────────────

export class FileIncidentRepository implements IncidentRepository {
  constructor() {
    ensureDirs();
  }

  generateId(): string {
    ensureDirs();
    const meta = readMeta();
    meta.counter += 1;
    writeMeta(meta);
    const seq = String(meta.counter).padStart(4, '0');
    return `INC-${seq}`;
  }

  save(analysis: IncidentAnalysis, priorityScore: number): void {
    ensureDirs();
    writeEntry({ analysis, priorityScore });
  }

  getById(id: string): IncidentAnalysis | null {
    return readEntry(id)?.analysis ?? null;
  }

  list(filters?: ListFilters): ListResult {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    let entries = listAllEntries();

    if (filters?.severity) {
      entries = entries.filter((e) => e.analysis.severity === filters.severity);
    }
    if (filters?.type) {
      entries = entries.filter((e) => e.analysis.incidentType === filters.type);
    }
    if (filters?.status) {
      entries = entries.filter((e) => e.analysis.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.analysis.incidentId.toLowerCase().includes(q) ||
          e.analysis.summary.toLowerCase().includes(q) ||
          e.analysis.technicalIndicators.some((i) => i.value.toLowerCase().includes(q))
      );
    }

    // Priority sort: by score desc, then by creation date desc
    entries.sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        new Date(b.analysis.createdAt).getTime() - new Date(a.analysis.createdAt).getTime()
    );

    const total = entries.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = entries.slice(start, start + limit).map((e) => e.analysis);

    return { incidents: paged, total, pages };
  }

  update(
    id: string,
    updates: { status?: IncidentStatus; notes?: string }
  ): IncidentAnalysis | null {
    const entry = readEntry(id);
    if (!entry) return null;

    const analysis = { ...entry.analysis };

    if (updates.status && updates.status !== analysis.status) {
      analysis.status = updates.status;
      analysis.statusHistory = [
        ...analysis.statusHistory,
        { status: updates.status, timestamp: new Date() },
      ];
    }

    if (updates.notes !== undefined) {
      analysis.notes = updates.notes;
    }

    analysis.updatedAt = new Date();

    writeEntry({ ...entry, analysis });
    return analysis;
  }

  getSummariesExcluding(excludeId: string): StoredIncidentSummary[] {
    return listAllEntries()
      .filter((e) => e.analysis.incidentId !== excludeId)
      .map((e) => ({
        incidentId: e.analysis.incidentId,
        normalizedText: e.analysis.originalReport,
        indicators: e.analysis.technicalIndicators as ExtractedIndicator[],
        incidentType: e.analysis.incidentType,
        createdAt: new Date(e.analysis.createdAt),
      }));
  }

  getDashboardMetrics(): DashboardMetrics {
    const entries = listAllEntries();
    const analyses = entries.map((e) => e.analysis);

    const typeDistribution: Record<string, number> = {};
    for (const t of Object.values(IncidentType)) {
      typeDistribution[t] = analyses.filter((a) => a.incidentType === t).length;
    }

    const clusterIds = new Set(
      analyses.filter((a) => a.clusterId).map((a) => a.clusterId!)
    );

    const topByPriority = [...entries]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 10)
      .map((e) => e.analysis);

    return {
      total: analyses.length,
      critical: analyses.filter((a) => a.severity === IncidentSeverity.CRITICAL).length,
      high: analyses.filter((a) => a.severity === IncidentSeverity.HIGH).length,
      medium: analyses.filter((a) => a.severity === IncidentSeverity.MEDIUM).length,
      low: analyses.filter((a) => a.severity === IncidentSeverity.LOW).length,
      newCount: analyses.filter((a) => a.status === IncStatus.NEW).length,
      activeClusters: clusterIds.size,
      typeDistribution,
      recentIncidents: topByPriority,
    };
  }

  count(): number {
    return listAllEntries().length;
  }
}

// Singleton — one repository instance per server process
export const fileIncidentRepository = new FileIncidentRepository();
