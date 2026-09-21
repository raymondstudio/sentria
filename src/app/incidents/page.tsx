export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { incidentStore } from '@/lib/data/store';
import { IncidentSeverity, IncidentStatus } from '@/types/incident';

const SEVERITY_COLORS: Record<string, string> = {
  [IncidentSeverity.CRITICAL]: 'border-red-500/50 bg-red-500/10 text-red-200',
  [IncidentSeverity.HIGH]: 'border-orange-500/50 bg-orange-500/10 text-orange-200',
  [IncidentSeverity.MEDIUM]: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  [IncidentSeverity.LOW]: 'border-slate-600/50 bg-slate-700/20 text-slate-300',
};

const STATUS_COLORS: Record<string, string> = {
  [IncidentStatus.NEW]: 'border-cyan-500/40 text-cyan-300',
  [IncidentStatus.TRIAGED]: 'border-blue-500/40 text-blue-300',
  [IncidentStatus.INVESTIGATING]: 'border-amber-500/40 text-amber-300',
  [IncidentStatus.ESCALATED]: 'border-red-500/40 text-red-300',
  [IncidentStatus.RESOLVED]: 'border-emerald-500/40 text-emerald-300',
  [IncidentStatus.FALSE_POSITIVE]: 'border-slate-600/40 text-slate-400',
};

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS[IncidentSeverity.LOW];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS[IncidentStatus.NEW];
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const severity = params.severity;
  const type = params.type;
  const status = params.status;
  const search = params.search;
  const page = Math.max(1, Number(params.page ?? '1') || 1);

  const result = await incidentStore.list({ severity, type, status, search, page, limit: 25 });

  const hasFilters = !!(severity ?? type ?? status ?? search);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400 hover:text-cyan-300"
              >
                Sentria
              </Link>
              <span className="text-slate-600">/</span>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Incident Queue
              </p>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold text-white">Priority Queue</h1>
          </div>
          <Link
            href="/incidents/new"
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            + New Incident
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Filter bar */}
        <form
          method="GET"
          className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
        >
          <div className="flex-1">
            <label htmlFor="search" className="block text-xs font-medium text-slate-400">
              Search
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={search ?? ''}
              placeholder="ID, summary, indicator…"
              className="mt-1 w-full min-w-48 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="severity" className="block text-xs font-medium text-slate-400">
              Severity
            </label>
            <select
              id="severity"
              name="severity"
              defaultValue={severity ?? ''}
              className="mt-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All</option>
              {Object.values(IncidentSeverity).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-xs font-medium text-slate-400">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ''}
              className="mt-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All</option>
              {Object.values(IncidentStatus).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Filter
            </button>
            {hasFilters && (
              <Link
                href="/incidents"
                className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        {/* Queue table */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-200">
              {hasFilters ? 'Filtered results' : 'All incidents'} — sorted by priority
            </h2>
            <span className="font-mono text-sm text-slate-400">
              {result.total} record{result.total !== 1 ? 's' : ''}
            </span>
          </div>

          {result.incidents.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              {hasFilters ? (
                <>
                  <p className="text-slate-300">No incidents match the current filters.</p>
                  <Link
                    href="/incidents"
                    className="mt-4 text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    Clear filters
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-slate-300">The queue is empty.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Analyze a report or screenshot to create the first incident.
                  </p>
                  <Link
                    href="/incidents/new"
                    className="mt-6 inline-flex rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                  >
                    Analyze first incident
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {result.incidents.map((incident) => (
                <Link
                  key={incident.incidentId}
                  href={`/incidents/${incident.incidentId}`}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-800/50 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-medium text-slate-500">
                        {incident.incidentId}
                      </span>
                      <SeverityBadge severity={incident.severity} />
                      <StatusBadge status={incident.status} />
                      {incident.clusterId && (
                        <span className="rounded border border-purple-500/40 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                          CLUSTER
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-white">
                      {incident.incidentType.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                      {incident.summary}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-3 md:flex-col md:items-end md:gap-1.5">
                    <span className="text-xs text-slate-500">
                      {new Date(incident.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-xs text-slate-500">
                      {incident.technicalIndicators.length} indicator
                      {incident.technicalIndicators.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      → {incident.recommendedRoute.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {result.pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>
              Page {page} of {result.pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/incidents?page=${page - 1}${severity ? `&severity=${severity}` : ''}${status ? `&status=${status}` : ''}${search ? `&search=${search}` : ''}`}
                  className="rounded border border-slate-700 px-3 py-1.5 hover:border-slate-500"
                >
                  Previous
                </Link>
              )}
              {page < result.pages && (
                <Link
                  href={`/incidents?page=${page + 1}${severity ? `&severity=${severity}` : ''}${status ? `&status=${status}` : ''}${search ? `&search=${search}` : ''}`}
                  className="rounded border border-slate-700 px-3 py-1.5 hover:border-slate-500"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
