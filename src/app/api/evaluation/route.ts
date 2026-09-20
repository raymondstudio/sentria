import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { analyzeIncident } from '@/lib/analysis/pipeline';
import { IncidentInputSource } from '@/types/incident';

interface AnswerKeyEntry {
  caseId: string;
  expectedType: string;
  expectedSeverity: string;
  expectedRouting: string;
  expectedIndicators: string[];
  expectedPiiTypes: string[];
  containsPii: boolean;
  isDuplicate: boolean;
  clusterGroup?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { batchSize = 10, offset = 0 } = await request.json();

    const casesDir = path.join(process.cwd(), 'data', 'dataset', 'cases');
    const answerKeyFile = path.join(process.cwd(), 'data', 'dataset', 'answer-key.json');

    if (!fs.existsSync(casesDir) || !fs.existsSync(answerKeyFile)) {
      return NextResponse.json({ error: 'Dataset not found. Run generation script first.' }, { status: 404 });
    }

    const answerKey = JSON.parse(fs.readFileSync(answerKeyFile, 'utf-8')) as AnswerKeyEntry[];
    const targetCases = answerKey.slice(offset, offset + batchSize);
    const results = [];

    for (const key of targetCases) {
      const caseFile = path.join(casesDir, `${key.caseId}.json`);
      if (!fs.existsSync(caseFile)) continue;

      const caseData = JSON.parse(fs.readFileSync(caseFile, 'utf-8'));
      
      const analysis = await analyzeIncident(caseData.report, {
        persist: false, // Don't save test cases to live database
        inputSource: IncidentInputSource.TEXT,
        source: caseData.source,
      });

      results.push({
        caseId: key.caseId,
        report: caseData.report,
        groundTruth: key,
        actual: {
          type: analysis.classification.type,
          typeConfidence: analysis.classification.confidence,
          severity: analysis.severity.severity,
          severityScore: analysis.severity.score,
          routing: analysis.routing.destination,
          indicators: analysis.indicators.map((i) => i.value),
          piiFound: analysis.sanitization.piiMatches.length > 0,
          usedFallback: analysis.usedFallback,
        },
        matchedType: analysis.classification.type === key.expectedType,
        matchedSeverity: analysis.severity.severity === key.expectedSeverity,
        matchedRouting: analysis.routing.destination === key.expectedRouting,
      });
      
      // Add slight delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      processed: results.length,
      nextOffset: offset + results.length,
      hasMore: offset + results.length < answerKey.length,
      totalCases: answerKey.length,
      results,
    });
  } catch (error) {
    console.error('Evaluation API error:', error);
    return NextResponse.json(
      { error: 'Failed to run evaluation batch' },
      { status: 500 }
    );
  }
}
