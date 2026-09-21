import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incidentStore } from '@/lib/data/store';
import { AppError, ErrorCode, createErrorResponse, logError } from '@/lib/errors';
import { IncidentStatus } from '@/types/incident';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  notes: z.string().max(2000).optional(),
});

// ─── GET /api/incidents/[id] ──────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 400, 'Invalid incident ID');
    }

    const incident = await incidentStore.getById(id);
    if (!incident) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, `Incident ${id} not found`);
    }

    return NextResponse.json({ incident });
  } catch (error) {
    logError(error, 'GET /api/incidents/[id]');
    const { statusCode, body } = createErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ─── PATCH /api/incidents/[id] ────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 400, 'Invalid incident ID');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError(ErrorCode.INVALID_INPUT, 400, 'Request body must be valid JSON');
    }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join('; ');
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, messages);
    }

    const updated = await incidentStore.update(id, parsed.data);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, `Incident ${id} not found`);
    }

    return NextResponse.json({ incident: updated });
  } catch (error) {
    logError(error, 'PATCH /api/incidents/[id]');
    const { statusCode, body } = createErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
