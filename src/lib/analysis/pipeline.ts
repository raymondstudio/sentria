/**
 * Analysis Pipeline Orchestrator
 *
 * Executes all analysis stages in order:
 *   1. normalizeText
 *   2. extractDeterministicIndicators
 *   3. classifyIncident (deterministic)
 *   4. classifyWithAi (async, merged with deterministic result)
 *   5. calculateSeverity
 *   6. generateSummary (AI with fallback)
 *   7. detectAndSanitizePii
 *   8. determineRouting
 *   9. generateRecommendedAction
 *  10. findRelatedIncidents
 *  11. calculatePriorityScore
 *  12. buildFinalResult
 *
 * Each stage has clear input/output. Side effects are limited to:
 *   - Reading from the incident store (for similarity)
 *   - Writing to the incident store (at the end)
 */

import { normalizeReport } from './normalize';
import { extractIndicators } from './indicators';
import { classifyIncident, mergeClassifications } from './classify';
import { calculateSeverity } from './severity';
import { detectAndSanitizePii } from './pii';
import { determineRouting } from './routing';
import { generateRecommendedAction } from './recommendations';
import { findRelatedIncidents } from './similarity';
import { classifyWithAi, generateSummary } from '../ai/provider';
import { incidentStore } from '../data/store';
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentInputSource,
  IncidentSource,
} from '@/types/incident';
import type { IncidentAnalysis } from '@/types/incident';
import type { PipelineResult } from './types';

// ─── Priority calculation ─────────────────────────────────────────────────────

const SEVERITY_BASE: Record<IncidentSeverity, number> = {
  [IncidentSeverity.CRITICAL]: 75,
  [IncidentSeverity.HIGH]: 50,
  [IncidentSeverity.MEDIUM]: 25,
  [IncidentSeverity.LOW]: 0,
};

/**
 * Calculate a priority score (0–100) for queue ordering.
 * Higher score = higher priority.
 */
function calculatePriorityScore(
  severityScore: number,
  severity: IncidentSeverity,
  classificationConfidence: number,
  hasRelatedIncidents: boolean,
  isDuplicate: boolean
): number {
  // Base from severity tier
  const base = SEVERITY_BASE[severity];

  // Raw severity score contribution (0–24 range scaled to 0–15)
  const scoreContribution = Math.min(15, (severityScore / 100) * 15);

  // Confidence contribution (high confidence = more actionable)
  const confidenceContribution = classificationConfidence * 5;

  // Campaign bonus (part of a cluster)
  const campaignBonus = hasRelatedIncidents ? 5 : 0;

  // Duplicate reduction (duplicates are lower priority)
  const duplicatePenalty = isDuplicate ? -10 : 0;

  const priority =
    base + scoreContribution + confidenceContribution + campaignBonus + duplicatePenalty;

  return Math.max(0, Math.min(100, Math.round(priority)));
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export const ANALYSIS_VERSION = '1.0.0';

/**
 * Full incident analysis pipeline.
 * Returns a complete PipelineResult and persists the incident to the store.
 */
export async function analyzeIncident(
  rawReport: string,
  options: {
    persist?: boolean;
    inputSource?: IncidentInputSource;
    source?: IncidentSource;
    affectedSystem?: string;
    reporterCategory?: string;
    incidentTime?: string;
    department?: string;
    evidence?: { name: string; type: string; size: number }[];
  } = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const incidentId = await incidentStore.generateId();
  const submittedAt = new Date();

  // Stage 1: Normalize text
  const normalized = normalizeReport(rawReport);

  // Stage 2: Extract deterministic indicators
  const indicators = extractIndicators(normalized.normalized);

  // Stage 3: Deterministic classification
  const deterministicClassification = classifyIncident(normalized.normalized);

  // Stage 4: AI-enhanced classification (runs in parallel with other stages)
  // We run AI classification concurrently with severity calculation
  const aiClassificationPromise = classifyWithAi(normalized.normalized);

  // Stage 5: AI summary generation (start concurrently)
  const summaryPromise = generateSummary(normalized.normalized, deterministicClassification.type);

  // Await AI classification and merge with deterministic result
  const aiClassificationResult = await aiClassificationPromise;
  const finalClassification = mergeClassifications(
    deterministicClassification,
    aiClassificationResult.classification
  );

  // Recalculate severity with final (possibly different) classification
  const finalSeverity = calculateSeverity(normalized.normalized, finalClassification);

  // Stage 7: PII detection and sanitization
  const sanitization = detectAndSanitizePii(normalized.normalized, indicators);

  // Stage 8: Routing
  const routing = determineRouting(finalClassification, finalSeverity);

  // Stage 9: Recommended actions
  const recommendedAction = generateRecommendedAction(
    finalClassification,
    finalSeverity,
    indicators
  );

  // Await summary
  const summaryResult = await summaryPromise;

  // Stage 10: Find related incidents
  const storedSummaries = await incidentStore.getSummariesExcluding(incidentId);
  const relatedIncidents = findRelatedIncidents(
    {
      normalizedText: normalized.normalized,
      indicators,
      incidentType: finalClassification.type,
    },
    storedSummaries
  );

  // Stage 11: Cluster assignment (simple: use top related incident's cluster if exists)
  let clusterId: string | undefined;
  const isDuplicate = relatedIncidents.some((r) => r.isDuplicate);

  if (relatedIncidents.length > 0) {
    const topRelated = await incidentStore.getById(relatedIncidents[0].incidentId);
    if (topRelated?.clusterId) {
      clusterId = topRelated.clusterId;
    } else if (relatedIncidents[0].similarity >= 0.65) {
      // Create new cluster ID for this group
      clusterId = `CLUSTER-${incidentId.replace('INC-', '')}`;
    }
  }

  // Stage 12: Calculate priority score
  const priorityScore = calculatePriorityScore(
    finalSeverity.score,
    finalSeverity.severity,
    finalClassification.confidence,
    relatedIncidents.length > 0,
    isDuplicate
  );

  const processingDurationMs = Date.now() - startTime;
  const usedFallback =
    aiClassificationResult.usedFallback && summaryResult.usedFallback;

  // Build final IncidentAnalysis object (matches public schema)
  const analysis: IncidentAnalysis = {
    incidentId,
    createdAt: submittedAt,
    updatedAt: submittedAt,
    originalReport: rawReport,
    inputSource: options.inputSource,
    source: options.source,
    affectedSystem: options.affectedSystem,
    reporterCategory: options.reporterCategory,
    incidentTime: options.incidentTime,
    department: options.department,
    evidence: options.evidence,

    incidentType: finalClassification.type,
    typeConfidence: finalClassification.confidence,

    severity: finalSeverity.severity,
    severityScore: finalSeverity.score,
    severityReasons: finalSeverity.reasons,

    summary: summaryResult.summary,

    technicalIndicators: indicators.map((ind) => ({
      type: ind.type,
      value: ind.value,
      context: ind.context,
      confidence: ind.confidence,
      isMalicious: ind.isMalicious,
    })),

    piiDetections: sanitization.piiMatches
      .filter((p) => !p.isTechnicalIndicator)
      .map((p) => ({
        type: p.type,
        context: p.context,
        confidence: p.confidence,
        redactedAs: p.redactedAs,
      })),

    sanitizedReport: sanitization.sanitizedReport,

    relatedIncidents: relatedIncidents.map((r) => ({
      incidentId: r.incidentId,
      similarity: r.similarity,
      reason: r.reason,
    })),

    clusterId,

    recommendedRoute: routing.destination,
    routingReasoning: routing.reasoning,

    recommendedAction,

    status: IncidentStatus.NEW,
    statusHistory: [{ status: IncidentStatus.NEW, timestamp: submittedAt }],
  };

  if (options.persist !== false) {
    await incidentStore.save(analysis, priorityScore);
  }

  return {
    context: {
      incidentId,
      submittedAt,
      analysisVersion: ANALYSIS_VERSION,
    },
    analysis,
    priorityScore,
    normalized,
    classification: finalClassification,
    severity: finalSeverity,
    indicators,
    sanitization,
    summary: summaryResult.summary,
    routing,
    recommendedAction,
    relatedIncidents,
    clusterAssignment: {
      clusterId: clusterId ?? null,
      isNewCluster: clusterId !== undefined && !(await Promise.all(relatedIncidents.map(async (r) => {
        const rel = await incidentStore.getById(r.incidentId);
        return rel?.clusterId === clusterId;
      }))).some(Boolean),
      clusterSize: clusterId
        ? (await incidentStore.list()).incidents.filter((i) => i.clusterId === clusterId).length
        : 0,
    },
    processingDurationMs,
    usedFallback,
  };
}
