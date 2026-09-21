/**
 * Incident Store — unified access point for the incident repository.
 *
 * All server-side code that needs incident data imports this module.
 * The repository uses file-based persistence: data survives server restarts
 * and is shared between all concurrent requests on the same server instance.
 *
 * Persistence path: <project-root>/incident-store/incidents/
 *
 * To swap to a different backend (e.g. Vercel Blob, Supabase), implement
 * the IncidentRepository interface and re-export a new singleton here.
 */

import { fileIncidentRepository } from '../storage/file-incident-repository';
import { kvIncidentRepository } from '../storage/kv-incident-repository';
import type { IncidentRepository } from '../storage/incident-repository';

const useKv = !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);

export const incidentStore: IncidentRepository = useKv 
  ? kvIncidentRepository 
  : fileIncidentRepository;
