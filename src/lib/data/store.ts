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

export { fileIncidentRepository as incidentStore } from '../storage/file-incident-repository';
