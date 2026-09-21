import { NextResponse } from 'next/server';
import { incidentStore } from '@/lib/data/store';
import { createErrorResponse, logError } from '@/lib/errors';

/**
 * GET /api/dashboard
 * Returns real-time metrics from the incident store.
 */
export async function GET() {
  try {
    const metrics = await incidentStore.getDashboardMetrics();
    return NextResponse.json({ metrics });
  } catch (error) {
    logError(error, 'GET /api/dashboard');
    const { statusCode, body } = createErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
