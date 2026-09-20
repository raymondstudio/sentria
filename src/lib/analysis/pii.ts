/**
 * PII Detection and Report Sanitization
 *
 * Detects:
 *   - Person names (pattern-based, context-aware)
 *   - Nigerian phone numbers (08XX, +234XX)
 *   - Email addresses (personal vs. technical indicator)
 *   - Student/Staff IDs
 *   - Account numbers
 *   - Credit card numbers
 *   - Addresses
 *
 * Rules:
 *   - Technical indicators (malicious domains, IOC emails) are NOT redacted as PII
 *   - Victim personal emails may be redacted; attacker emails are IOCs
 *   - Sanitized report replaces PII with placeholders
 *   - Original report is always preserved
 */

import { PiiType, IndicatorType } from '@/types/incident';
import type { PiiMatch, SanitizationResult, ExtractedIndicator } from './types';

// ─── PII Patterns ─────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{
  type: PiiType;
  pattern: RegExp;
  redactedAs: string;
  confidence: number;
}> = [
  // Nigerian phone numbers (high confidence)
  {
    type: PiiType.PHONE_NUMBER,
    pattern: /(?:\+?234|0)(?:7[01]|8[01]|9[0])\d{8}\b/g,
    redactedAs: '[PHONE]',
    confidence: 0.92,
  },
  // International phone numbers
  {
    type: PiiType.PHONE_NUMBER,
    pattern: /\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{4}\b/g,
    redactedAs: '[PHONE]',
    confidence: 0.80,
  },
  // Email addresses (will be filtered against IOC list)
  {
    type: PiiType.EMAIL_ADDRESS,
    pattern: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    redactedAs: '[EMAIL]',
    confidence: 0.85,
  },
  // Student IDs: common formats — STU/STC followed by numbers, or university matric formats
  {
    type: PiiType.STUDENT_ID,
    pattern: /\b(?:STU|STC|MAT|REG|MATRIC)[\/\-]?\d{5,10}\b/gi,
    redactedAs: '[STUDENT_ID]',
    confidence: 0.88,
  },
  // Staff IDs
  {
    type: PiiType.STAFF_ID,
    pattern: /\b(?:STAFF|EMP|HR)[\/\-]?\d{4,10}\b/gi,
    redactedAs: '[STAFF_ID]',
    confidence: 0.88,
  },
  // Account numbers: common formats (account followed by digits, or ACT/ACC prefix)
  {
    type: PiiType.ACCOUNT_NUMBER,
    pattern: /\b(?:AC[CT]|ACCOUNT)[^\w]?[\s\-]?\d{6,18}\b/gi,
    redactedAs: '[ACCOUNT]',
    confidence: 0.85,
  },
  // Credit card numbers (13-19 digits, optionally separated by spaces/dashes)
  {
    type: PiiType.CREDIT_CARD,
    pattern: /\b(?:\d{4}[\s\-]?){3}\d{4,7}\b/g,
    redactedAs: '[CREDIT_CARD]',
    confidence: 0.75,
  },
  // SSN-like patterns
  {
    type: PiiType.SSN,
    pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
    redactedAs: '[SSN]',
    confidence: 0.88,
  },
];

// ─── Name detection ───────────────────────────────────────────────────────────

// Common Nigerian first names and surnames for detection
// This is intentionally a small but representative set — AI should extend this
const COMMON_NAME_FIRST = new Set([
  // Common Nigerian/West African names
  'chidi', 'ada', 'obi', 'emeka', 'ngozi', 'amara', 'tunde', 'bola', 'kemi',
  'adeola', 'funmi', 'yemi', 'seun', 'femi', 'wale', 'tobi', 'dayo', 'seyi',
  'chinwe', 'chukwu', 'uche', 'nna', 'ike', 'chibundo', 'uchenna', 'obiora',
  'adaeze', 'chidinma', 'nkechi', 'ifeoma', 'blessing', 'chisom',
  // Common English names
  'john', 'james', 'michael', 'david', 'peter', 'paul', 'mary', 'sarah',
  'grace', 'victor', 'samuel', 'daniel', 'joseph', 'joshua', 'mark',
  'luke', 'matthew', 'andrew', 'simon', 'thomas', 'philip', 'stephen',
]);

// Context phrases that precede a name
const NAME_CONTEXT_PATTERNS = [
  /(?:my name is|i am|i'm|this is|name:|sender:|from:|by|analyst:|user:|victim:|staff:|student:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
  /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:from|of|in)\s+(?:the\s+)?(?:finance|it|hr|security|department|office)/gi,
];

function detectPersonNames(text: string): PiiMatch[] {
  const results: PiiMatch[] = [];

  // Pattern 1: Context-driven name detection
  for (const pattern of NAME_CONTEXT_PATTERNS) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const nameGroup = match[1] || match[2];
      if (!nameGroup) continue;
      const nameIdx = text.indexOf(nameGroup, match.index);
      if (nameIdx === -1) continue;

      results.push({
        type: PiiType.PERSON_NAME,
        value: nameGroup,
        redactedAs: '[PERSON]',
        startIndex: nameIdx,
        endIndex: nameIdx + nameGroup.length,
        context: `Name detected via context: "${match[0].substring(0, 50)}"`,
        confidence: 0.78,
        isTechnicalIndicator: false,
      });
    }
  }

  // Pattern 2: Known first name + Surname pattern
  const wordPattern = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
  let match: RegExpExecArray | null;
  while ((match = wordPattern.exec(text)) !== null) {
    const firstName = match[1].toLowerCase();
    if (COMMON_NAME_FIRST.has(firstName)) {
      const fullName = match[0];
      results.push({
        type: PiiType.PERSON_NAME,
        value: fullName,
        redactedAs: '[PERSON]',
        startIndex: match.index,
        endIndex: match.index + fullName.length,
        context: `Name detected: first name matches known name list`,
        confidence: 0.72,
        isTechnicalIndicator: false,
      });
    }
  }

  return results;
}

// ─── Email context analysis ───────────────────────────────────────────────────

const IOC_EMAIL_CONTEXT = [
  'phishing email', 'from the attacker', 'malicious sender',
  'suspicious sender', 'spam from', 'email came from', 'email was from',
  'received from', 'sent by attacker', 'attacker email',
  'hacker email', 'fake sender', 'impersonating',
];

const PERSONAL_EMAIL_CONTEXT = [
  'my email', 'my email address', 'my personal email', 'contact me at',
  'reach me at', 'email me at', 'i can be reached', 'my gmail',
  'my yahoo', 'my hotmail', 'victim email', 'user email', 'reporter email',
];

function emailIsTechnicalIndicator(
  email: string,
  context: string,
  indicators: ExtractedIndicator[]
): boolean {
  const lowerCtx = context.toLowerCase();
  const lowerEmail = email.toLowerCase();

  // If explicitly marked as IOC in context
  if (IOC_EMAIL_CONTEXT.some((s) => lowerCtx.includes(s))) return true;

  // If explicitly personal
  if (PERSONAL_EMAIL_CONTEXT.some((s) => lowerCtx.includes(s))) return false;

  // If already in indicators list and marked malicious
  const indicator = indicators.find(
    (ind) => ind.type === IndicatorType.EMAIL && ind.value === lowerEmail
  );
  if (indicator?.isMalicious) return true;

  // Heuristic: suspicious domain in email
  const domain = email.split('@')[1] || '';
  const suspiciousKeywords = [
    'payroll', 'login', 'secure', 'verify', 'account', 'update',
    'banking', 'wallet', 'password', 'reset', 'confirm', 'auth',
  ];
  if (suspiciousKeywords.some((kw) => domain.toLowerCase().includes(kw))) return true;

  return false;
}

// ─── Address detection ────────────────────────────────────────────────────────

const ADDRESS_PATTERN =
  /\b\d{1,5}\s+[A-Z][a-zA-Z\s]{3,40}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Close|Cl|Way|Court|Ct)\b/gi;

function detectAddresses(text: string): PiiMatch[] {
  const results: PiiMatch[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(ADDRESS_PATTERN.source, 'gi');
  while ((match = re.exec(text)) !== null) {
    const addr = match[0];
    results.push({
      type: PiiType.ADDRESS,
      value: addr,
      redactedAs: '[ADDRESS]',
      startIndex: match.index,
      endIndex: match.index + addr.length,
      context: `Street address detected`,
      confidence: 0.80,
      isTechnicalIndicator: false,
    });
  }
  return results;
}

// ─── Main detection ───────────────────────────────────────────────────────────

function extractContextWindow(text: string, start: number, end: number, window = 80): string {
  const from = Math.max(0, start - window);
  const to = Math.min(text.length, end + window);
  return text.slice(from, to).replace(/\n/g, ' ').trim();
}

/**
 * Detect PII in a report and produce a sanitized version.
 * Does not blindly redact IOC emails.
 */
export function detectAndSanitizePii(
  text: string,
  indicators: ExtractedIndicator[]
): SanitizationResult {
  const allMatches: PiiMatch[] = [];

  // Detect names
  allMatches.push(...detectPersonNames(text));

  // Detect addresses
  allMatches.push(...detectAddresses(text));

  // Pattern-based PII
  for (const def of PII_PATTERNS) {
    let match: RegExpExecArray | null;
    const re = new RegExp(def.pattern.source, def.pattern.flags);

    while ((match = re.exec(text)) !== null) {
      const value = match[0];
      const start = match.index;
      const end = start + value.length;
      const ctx = extractContextWindow(text, start, end);

      // Special handling for emails — don't redact IOC emails
      if (def.type === PiiType.EMAIL_ADDRESS) {
        const isIOC = emailIsTechnicalIndicator(value, ctx, indicators);
        allMatches.push({
          type: def.type,
          value,
          redactedAs: def.redactedAs,
          startIndex: start,
          endIndex: end,
          context: ctx,
          confidence: def.confidence,
          isTechnicalIndicator: isIOC,
        });
      } else {
        allMatches.push({
          type: def.type,
          value,
          redactedAs: def.redactedAs,
          startIndex: start,
          endIndex: end,
          context: ctx,
          confidence: def.confidence,
          isTechnicalIndicator: false,
        });
      }
    }
  }

  // Sort by start index (for sequential replacement)
  allMatches.sort((a, b) => a.startIndex - b.startIndex);

  // Remove overlapping matches (keep higher confidence)
  const dedupedMatches: PiiMatch[] = [];
  let lastEnd = -1;
  for (const m of allMatches) {
    if (m.startIndex >= lastEnd) {
      dedupedMatches.push(m);
      lastEnd = m.endIndex;
    }
  }

  // Build sanitized report by applying redactions in reverse order
  // (reverse so that indices don't shift)
  let sanitized = text;
  const replacements = dedupedMatches
    .filter((m) => !m.isTechnicalIndicator)
    .slice()
    .reverse();

  for (const m of replacements) {
    sanitized =
      sanitized.slice(0, m.startIndex) +
      m.redactedAs +
      sanitized.slice(m.endIndex);
  }

  return {
    sanitizedReport: sanitized,
    piiMatches: dedupedMatches,
  };
}
