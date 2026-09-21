export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { incidentStore } from '@/lib/data/store';
import { IncidentSeverity } from '@/types/incident';

const SEVERITY_STYLES: Record<string, { border: string; bg: string; label: string; sub: string }> =
  {
    [IncidentSeverity.CRITICAL]: {
      border: 'border-red-500/40',
      bg: 'bg-red-500/10',
      label: 'text-red-200',
      sub: 'text-red-300',
    },
    [IncidentSeverity.HIGH]: {
      border: 'border-orange-500/40',
      bg: 'bg-orange-500/10',
      label: 'text-orange-200',
      sub: 'text-orange-300',
    },
    [IncidentSeverity.MEDIUM]: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/10',
      label: 'text-amber-200',
      sub: 'text-amber-300',
    },
    [IncidentSeverity.LOW]: {
      border: 'border-slate-600/40',
      bg: 'bg-slate-700/20',
      label: 'text-slate-300',
      sub: 'text-slate-400',
    },
  };

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES[IncidentSeverity.LOW];
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${s.border} ${s.label}`}
    >
      {severity}
    </span>
  );
}

export default async function DashboardPage() {
  const metrics = await incidentStore.getDashboardMetrics();
  const recentIncidents = metrics.recentIncidents.slice(0, 5);

  const topTypes = Object.entries(metrics.typeDistribution)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Sentria
            </p>
            <h1 className="mt-1.5 text-2xl font-bold text-white">Threat Operations Dashboard</h1>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/incidents"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Queue
            </Link>
            <Link
              href="/clusters"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Clusters
            </Link>
            <Link
              href="/evaluation"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Evaluation
            </Link>
            <Link
              href="/incidents/new"
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              + New Incident
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Metric cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm font-medium text-slate-400">Total incidents</p>
            <p className="mt-3 text-5xl font-bold tabular-nums text-white">{metrics.total}</p>
            <p className="mt-2 text-xs text-slate-500">All persisted records</p>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-5">
            <p className="text-sm font-medium text-red-300">Critical</p>
            <p className="mt-3 text-5xl font-bold tabular-nums text-red-200">{metrics.critical}</p>
            <p className="mt-2 text-xs text-red-400">Immediate action required</p>
          </div>

          <div className="rounded-xl border border-orange-500/30 bg-orange-500/8 p-5">
            <p className="text-sm font-medium text-orange-300">High</p>
            <p className="mt-3 text-5xl font-bold tabular-nums text-orange-200">{metrics.high}</p>
            <p className="mt-2 text-xs text-orange-400">Priority investigations</p>
          </div>

          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/8 p-5">
            <p className="text-sm font-medium text-cyan-300">Clusters</p>
            <p className="mt-3 text-5xl font-bold tabular-nums text-cyan-200">
              {metrics.activeClusters}
            </p>
            <p className="mt-2 text-xs text-cyan-400">Correlated incident groups</p>
          </div>
        </section>

        {/* Secondary metrics */}
        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-300">Medium severity</p>
              <p className="text-2xl font-bold tabular-nums text-amber-200">{metrics.medium}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Low severity</p>
              <p className="text-2xl font-bold tabular-nums text-slate-300">{metrics.low}</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-emerald-300">New / unreviewed</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-200">
                {metrics.newCount}
              </p>
            </div>
          </div>
        </section>

        {/* Main content */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_0.85fr]">
          {/* Recent incidents */}
          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className="text-base font-semibold text-white">Priority queue (top 5)</h2>
              <Link
                href="/incidents"
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                Open full queue →
              </Link>
            </div>

            {recentIncidents.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <p className="text-slate-300">No incidents yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Submit a report to begin populating the queue.
                </p>
                <Link
                  href="/incidents/new"
                  className="mt-6 inline-flex items-center rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  Analyze first incident
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {recentIncidents.map((incident) => (
                  <Link
                    key={incident.incidentId}
                    href={`/incidents/${incident.incidentId}`}
                    className="flex items-start justify-between gap-4 px-6 py-4 transition hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs text-slate-500">
                          {incident.incidentId}
                        </span>
                        <SeverityBadge severity={incident.severity} />
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-white">
                        {incident.incidentType.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                        {incident.summary}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-slate-500">
                        {new Date(incident.createdAt).toLocaleDateString()}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {incident.technicalIndicators.length} IOCs
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Type distribution + quick stats */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-base font-semibold text-white">Incident types</h2>
              {topTypes.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No data yet</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {topTypes.map(([type, count]) => (
                    <div key={type}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-300">{type.replace(/_/g, ' ')}</span>
                        <span className="font-semibold tabular-nums text-slate-100">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div
                          className="h-1.5 rounded-full bg-cyan-500"
                          style={{
                            width: `${Math.max(6, (count / Math.max(metrics.total, 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-base font-semibold text-white">Quick actions</h2>
              <div className="mt-4 space-y-2">
                <Link
                  href="/incidents/new"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800/60"
                >
                  <span>Analyze new report</span>
                  <span className="text-slate-500">→</span>
                </Link>
                <Link
                  href="/incidents?status=NEW"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800/60"
                >
                  <span>View unreviewed</span>
                  <span className="text-slate-500">→</span>
                </Link>
                <Link
                  href="/clusters"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800/60"
                >
                  <span>View clusters</span>
                  <span className="text-slate-500">→</span>
                </Link>
                <Link
                  href="/evaluation"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800/60"
                >
                  <span>Evaluation report</span>
                  <span className="text-slate-500">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
