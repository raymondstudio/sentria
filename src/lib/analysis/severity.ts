/**
 * Severity Engine
 *
 * Rule-based scoring system that produces an explainable severity
 * level and score from 0–100. Each factor has a defined max contribution.
 *
 * Scoring is reproducible: same report → same score.
 * Score thresholds:
 *   0–24   = LOW
 *   25–49  = MEDIUM
 *   50–74  = HIGH
 *   75–100 = CRITICAL
 */

import { IncidentType, IncidentSeverity } from '@/types/incident';
import type { SeverityResult, SeverityFactor, ClassificationResult } from './types';


// ─── Signal lists for each factor ────────────────────────────────────────────

const CREDENTIAL_SIGNALS = [
  'entered my password', 'entered password', 'typed my password',
  'submitted password', 'gave my password', 'password was stolen',
  'credentials stolen', 'credentials compromised', 'login details',
  'username and password', 'my credentials', 'account credentials',
  'my details', 'my information', 'filled in my password',
  'put in my password', 'key in my password',
];

const ACTIVE_COMPROMISE_SIGNALS = [
  'account hacked', 'account taken over', 'account compromised',
  'unauthorized login', 'someone logged in', 'strange login',
  'login from unknown', 'new device login', 'my account was accessed',
  'session hijacked', 'unauthorized access', 'attacker is inside',
  'intruder detected', 'intrusion detected', 'still ongoing',
  'happening now', 'happening right now', 'currently happening',
];

const CRITICAL_SYSTEM_SIGNALS = [
  'payroll', 'salary', 'hr system', 'identity', 'active directory',
  'domain controller', 'email server', 'mail server',
  'financial system', 'accounting system', 'banking system',
  'erp', 'student records', 'staff records', 'patient records',
  'healthcare', 'government system', 'critical infrastructure',
  'production server', 'database server', 'core system',
];

const MULTIPLE_USERS_SIGNALS = [
  'multiple users', 'several users', 'many users', 'all staff',
  'entire department', 'entire organisation', 'whole company',
  'multiple accounts', 'several accounts', 'mass email',
  'widespread', 'campaign', 'many people', 'others also',
  'colleagues also', 'affecting everyone',
];

const RANSOMWARE_SIGNALS = [
  'ransomware', 'files encrypted', 'ransom note', 'ransom demand',
  'ransom message', 'pay to decrypt', 'decryption key',
  'files locked', 'cannot open files', "can't access files",
  'files inaccessible', '.locked', '.encrypted', 'pay or',
  'bitcoin', 'monero', 'cryptocurrency', 'crypto payment',
];

const FINANCIAL_SIGNALS = [
  'money stolen', 'money lost', 'money transferred', 'transferred money',
  'financial loss', 'unauthorized transaction', 'fraudulent transaction',
  'bank transfer', 'wire transfer', 'invoice', 'payment made',
  'charged', 'deducted', 'credit card', 'debit card',
];

const DATA_EXPOSURE_SIGNALS = [
  'data exposed', 'data leaked', 'data exfiltrated', 'database dumped',
  'records stolen', 'information leaked', 'sensitive data',
  'confidential data', 'personal data', 'customer data',
  'student data', 'staff data', 'medical records', 'data breach',
];

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function countSignalHits(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s)).length;
}

function hasAnySignal(text: string, signals: string[]): boolean {
  return countSignalHits(text, signals) > 0;
}

// ─── Score calculation ────────────────────────────────────────────────────────

function scoreCredentialCompromise(text: string): SeverityFactor {
  const hits = countSignalHits(text, CREDENTIAL_SIGNALS);
  const triggered = hits > 0;
  return {
    name: 'credential_compromise',
    maxPoints: 25,
    points: triggered ? 25 : 0,
    triggered,
    reason: triggered
      ? 'Credentials were likely submitted to an untrusted system'
      : 'No evidence of credential compromise',
  };
}

function scoreActiveCompromise(
  text: string,
  classification: ClassificationResult
): SeverityFactor {
  const hits = countSignalHits(text, ACTIVE_COMPROMISE_SIGNALS);
  const isHighRiskType = [
    IncidentType.ACCOUNT_TAKEOVER,
    IncidentType.RANSOMWARE,
    IncidentType.DATA_BREACH,
    IncidentType.UNAUTHORIZED_ACCESS,
    IncidentType.INSIDER_THREAT,
  ].includes(classification.type);

  let points = 0;
  if (hits >= 2) points = 20;
  else if (hits === 1) points = 15;
  else if (isHighRiskType && classification.confidence > 0.75) points = 10;

  return {
    name: 'active_compromise',
    maxPoints: 20,
    points,
    triggered: points > 0,
    reason:
      points > 0
        ? 'Active or very recent unauthorised access indicated'
        : 'No clear indication of active compromise',
  };
}

function scoreSystemCriticality(text: string): SeverityFactor {
  const hits = countSignalHits(text, CRITICAL_SYSTEM_SIGNALS);
  let points = 0;
  if (hits >= 3) points = 15;
  else if (hits >= 2) points = 12;
  else if (hits === 1) points = 8;

  return {
    name: 'system_criticality',
    maxPoints: 15,
    points,
    triggered: points > 0,
    reason:
      points > 0
        ? 'Incident involves a critical or sensitive system'
        : 'No critical system involvement identified',
  };
}

function scoreAffectedPopulation(text: string): SeverityFactor {
  const hits = countSignalHits(text, MULTIPLE_USERS_SIGNALS);
  let points = 0;
  if (hits >= 3) points = 15;
  else if (hits >= 2) points = 10;
  else if (hits === 1) points = 5;

  return {
    name: 'affected_population',
    maxPoints: 15,
    points,
    triggered: points > 0,
    reason:
      points > 0
        ? 'Multiple users or accounts appear to be affected'
        : 'Single user or limited scope',
  };
}

function scoreRansomware(text: string, classification: ClassificationResult): SeverityFactor {
  const isRansomware = classification.type === IncidentType.RANSOMWARE;
  const signalHits = countSignalHits(text, RANSOMWARE_SIGNALS);
  let points = 0;

  if (isRansomware || signalHits >= 2) points = 15;
  else if (signalHits === 1) points = 8;

  return {
    name: 'ransomware',
    maxPoints: 15,
    points,
    triggered: points > 0,
    reason:
      points > 0
        ? 'Ransomware or data encryption indicators present'
        : 'No ransomware indicators',
  };
}

function scoreFinancialImpact(text: string): SeverityFactor {
  const triggered = hasAnySignal(text, FINANCIAL_SIGNALS);
  return {
    name: 'financial_impact',
    maxPoints: 5,
    points: triggered ? 5 : 0,
    triggered,
    reason: triggered
      ? 'Financial loss or fraudulent transaction indicated'
      : 'No financial impact detected',
  };
}

function scoreDataExposure(text: string): SeverityFactor {
  const triggered = hasAnySignal(text, DATA_EXPOSURE_SIGNALS);
  return {
    name: 'data_exposure',
    maxPoints: 5,
    points: triggered ? 5 : 0,
    triggered,
    reason: triggered
      ? 'Sensitive data may have been exposed or exfiltrated'
      : 'No data exposure indicated',
  };
}

function scoreToSeverity(score: number): IncidentSeverity {
  if (score >= 75) return IncidentSeverity.CRITICAL;
  if (score >= 50) return IncidentSeverity.HIGH;
  if (score >= 25) return IncidentSeverity.MEDIUM;
  return IncidentSeverity.LOW;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate severity for an incident based on its text and classification.
 * Returns an explainable severity score with contributing factors.
 */
export function calculateSeverity(
  text: string,
  classification: ClassificationResult
): SeverityResult {
  const factors: SeverityFactor[] = [
    scoreCredentialCompromise(text),
    scoreActiveCompromise(text, classification),
    scoreSystemCriticality(text),
    scoreAffectedPopulation(text),
    scoreRansomware(text, classification),
    scoreFinancialImpact(text),
    scoreDataExposure(text),
  ];

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const severity = scoreToSeverity(score);

  // Generate human-readable reasons (only triggered factors)
  const reasons = factors
    .filter((f) => f.triggered)
    .map((f) => f.reason);

  // Ensure at least one reason
  if (reasons.length === 0) {
    reasons.push('Incident does not exhibit high-risk indicators; assigning LOW severity');
  }

  return {
    severity,
    score,
    factors,
    reasons,
  };
}
