export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { incidentStore } from '@/lib/data/store';
import { IncidentSeverity } from '@/types/incident';

const SEVERITY_ORDER = [
  IncidentSeverity.CRITICAL,
  IncidentSeverity.HIGH,
  IncidentSeverity.MEDIUM,
  IncidentSeverity.LOW,
];

const SEVERITY_COLORS: Record<string, string> = {
  [IncidentSeverity.CRITICAL]: 'text-red-300 border-red-500/40 bg-red-500/10',
  [IncidentSeverity.HIGH]: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
  [IncidentSeverity.MEDIUM]: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  [IncidentSeverity.LOW]: 'text-slate-300 border-slate-600/40 bg-slate-700/20',
};

export default function ClustersPage() {
  const metrics = incidentStore.getDashboardMetrics();
  const allResult = incidentStore.list({ limit: 500 });
  const allIncidents = allResult.incidents;

  // Group incidents by clusterId
  const clusterMap = new Map<
    string,
    { incidents: typeof allIncidents; highestSeverity: string }
  >();

  for (const incident of allIncidents) {
    if (!incident.clusterId) continue;
    const entry = clusterMap.get(incident.clusterId) ?? {
      incidents: [],
      highestSeverity: IncidentSeverity.LOW,
    };
    entry.incidents.push(incident);

    const currentSevIdx = SEVERITY_ORDER.indexOf(entry.highestSeverity as IncidentSeverity);
    const thisSevIdx = SEVERITY_ORDER.indexOf(incident.severity as IncidentSeverity);
    if (thisSevIdx < currentSevIdx) {
      entry.highestSeverity = incident.severity;
    }

    clusterMap.set(incident.clusterId, entry);
  }

  const clusters = Array.from(clusterMap.entries())
    .map(([id, data]) => ({
      id,
      incidents: data.incidents,
      highestSeverity: data.highestSeverity,
      count: data.incidents.length,
    }))
    .sort((a, b) => {
      const sA = SEVERITY_ORDER.indexOf(a.highestSeverity as IncidentSeverity);
      const sB = SEVERITY_ORDER.indexOf(b.highestSeverity as IncidentSeverity);
      return sA - sB || b.count - a.count;
    });

  const unclustered = allIncidents.filter((i) => !i.clusterId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-3 text-xs">
              <Link href="/" className="font-semibold uppercase tracking-[0.3em] text-cyan-400 hover:text-cyan-300">
                Sentria
              </Link>
              <span className="text-slate-600">/</span>
              <span className="uppercase tracking-[0.2em] text-amber-400">Correlation</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold text-white">Incident Clusters</h1>
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
        {/* Summary cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Active clusters</p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-white">{clusters.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Clustered incidents</p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-white">
              {allIncidents.length - unclustered.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total incidents</p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-white">{metrics.total}</p>
          </div>
        </section>

        {clusters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
            <p className="text-lg font-semibold text-slate-300">No clusters detected yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Clusters form when submitted incidents share similar text, indicators, or patterns.
              Submit multiple related reports to see correlation.
            </p>
            <Link
              href="/incidents/new"
              className="mt-6 inline-flex rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Submit a report
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {clusters.map((cluster) => {
              const sevStyle = SEVERITY_COLORS[cluster.highestSeverity] ?? SEVERITY_COLORS[IncidentSeverity.LOW];
              return (
                <div key={cluster.id} className="rounded-xl border border-slate-800 bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-white">{cluster.id}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${sevStyle}`}>
                        {cluster.highestSeverity}
                      </span>
                      <span className="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-300">
                        {cluster.count} incident{cluster.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800/60">
                    {cluster.incidents.slice(0, 5).map((incident) => (
                      <Link
                        key={incident.incidentId}
                        href={`/incidents/${incident.incidentId}`}
                        className="flex items-center justify-between gap-4 px-6 py-3.5 transition hover:bg-slate-800/50"
                      >
                        <div>
                          <span className="font-mono text-xs font-medium text-slate-500 mr-2">
                            {incident.incidentId}
                          </span>
                          <span className="text-sm text-white">
                            {incident.incidentType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{incident.severity}</span>
                          <span>{new Date(incident.createdAt).toLocaleDateString('en-GB')}</span>
                        </div>
                      </Link>
                    ))}
                    {cluster.count > 5 && (
                      <div className="px-6 py-3 text-xs text-slate-500">
                        + {cluster.count - 5} more incident{cluster.count - 5 !== 1 ? 's' : ''} in this cluster
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {unclustered.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-300">
                Unclustered incidents ({unclustered.length})
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                These incidents have no detected correlation with others.
              </p>
            </div>
            <div className="divide-y divide-slate-800/60">
              {unclustered.slice(0, 10).map((incident) => (
                <Link
                  key={incident.incidentId}
                  href={`/incidents/${incident.incidentId}`}
                  className="flex items-center justify-between gap-4 px-6 py-3 transition hover:bg-slate-800/50"
                >
                  <span className="font-mono text-xs text-slate-400">{incident.incidentId}</span>
                  <span className="text-xs text-slate-500">
                    {incident.incidentType.replace(/_/g, ' ')} — {incident.severity}
                  </span>
                </Link>
              ))}
              {unclustered.length > 10 && (
                <div className="px-6 py-3 text-xs text-slate-500">
                  + {unclustered.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
