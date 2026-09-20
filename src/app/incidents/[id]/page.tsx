import { notFound } from 'next/navigation';
import Link from 'next/link';
import { incidentStore } from '@/lib/data/store';
import { IncidentSeverity, IncidentStatus } from '@/types/incident';
import StatusControls from './status-controls';

const SEVERITY_STYLES: Record<
  string,
  { badge: string; glow: string; label: string }
> = {
  [IncidentSeverity.CRITICAL]: {
    badge: 'border-red-500/50 bg-red-500/15 text-red-200',
    glow: 'bg-red-500',
    label: 'Critical',
  },
  [IncidentSeverity.HIGH]: {
    badge: 'border-orange-500/50 bg-orange-500/15 text-orange-200',
    glow: 'bg-orange-500',
    label: 'High',
  },
  [IncidentSeverity.MEDIUM]: {
    badge: 'border-amber-500/50 bg-amber-500/15 text-amber-200',
    glow: 'bg-amber-500',
    label: 'Medium',
  },
  [IncidentSeverity.LOW]: {
    badge: 'border-slate-600/50 bg-slate-700/20 text-slate-300',
    glow: 'bg-slate-400',
    label: 'Low',
  },
};

function SectionCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900 p-6 ${className}`}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const incident = incidentStore.getById(id);

  if (!incident) {
    notFound();
  }

  const sev = SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES[IncidentSeverity.LOW];
  const relatedFull = incident.relatedIncidents
    .map((rel) => ({ ...rel, incident: incidentStore.getById(rel.incidentId) }))
    .filter((r) => r.incident !== null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center gap-3 text-xs">
            <Link href="/" className="font-semibold uppercase tracking-[0.3em] text-cyan-400 hover:text-cyan-300">
              Sentria
            </Link>
            <span className="text-slate-600">/</span>
            <Link href="/incidents" className="uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300">
              Queue
            </Link>
            <span className="text-slate-600">/</span>
            <span className="font-mono text-slate-400">{incident.incidentId}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-lg font-bold text-white">{incident.incidentId}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase ${sev.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sev.glow}`} />
                  {sev.label}
                </span>
                <span className="rounded border border-slate-700 px-2.5 py-1 text-xs font-medium uppercase text-slate-300">
                  {incident.status.replace(/_/g, ' ')}
                </span>
                {incident.clusterId && (
                  <span className="rounded border border-purple-500/40 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300">
                    Cluster: {incident.clusterId}
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-xl font-bold text-white">
                {incident.incidentType.replace(/_/g, ' ')}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Submitted {new Date(incident.createdAt).toLocaleString('en-GB')}
                {incident.department && ` · ${incident.department}`}
                {incident.affectedSystem && ` · ${incident.affectedSystem}`}
              </p>
            </div>
            <Link
              href="/incidents"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
            >
              ← Back to queue
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-6 py-8">
        {/* Classification strip */}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Incident type</p>
            <p className="mt-1.5 text-lg font-bold text-white">
              {incident.incidentType.replace(/_/g, ' ')}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {Math.round(incident.typeConfidence * 100)}% confidence
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Severity score</p>
            <p className={`mt-1.5 text-lg font-bold ${sev.badge.split(' ').find(c => c.startsWith('text-')) ?? 'text-white'}`}>
              {incident.severity} — {incident.severityScore}/100
            </p>
            <p className="mt-1 text-xs text-slate-400">{incident.severityReasons[0] ?? 'No triggering factors'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Routing</p>
            <p className="mt-1.5 text-lg font-bold text-cyan-200">
              {incident.recommendedRoute.replace(/_/g, ' ')}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {incident.routingReasoning[0] ?? 'Rule-based routing'}
            </p>
          </div>
        </section>

        {/* Summary + Workflow */}
        <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <SectionCard title="Summary">
            <p className="text-sm leading-7 text-slate-200">{incident.summary}</p>

            {incident.severityReasons.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Severity factors
                </p>
                <ul className="mt-3 space-y-2">
                  {incident.severityReasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <div className="space-y-5">
            <SectionCard title="Workflow">
              <StatusControls
                incidentId={incident.incidentId}
                initialStatus={incident.status}
                initialNotes={incident.notes}
              />
            </SectionCard>

            <SectionCard title="Recommended action">
              <p className="text-sm leading-6 text-slate-300">{incident.recommendedAction}</p>
            </SectionCard>
          </div>
        </section>

        {/* Technical indicators + Routing reasoning */}
        <section className="grid gap-5 lg:grid-cols-2">
          <SectionCard title={`Technical indicators (${incident.technicalIndicators.length})`}>
            {incident.technicalIndicators.length === 0 ? (
              <p className="text-sm text-slate-500">No IOCs extracted from this report.</p>
            ) : (
              <div className="space-y-2.5">
                {incident.technicalIndicators.map((ind, i) => (
                  <div
                    key={`${ind.type}-${i}`}
                    className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-cyan-400">
                        {ind.type}
                      </span>
                      {ind.isMalicious && (
                        <span className="text-[10px] font-bold uppercase text-red-400">
                          ⚠ Malicious
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 break-all font-mono text-sm text-white">{ind.value}</p>
                    {ind.context && (
                      <p className="mt-1 text-xs text-slate-500">{ind.context}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Routing reasoning">
            <p className="font-semibold text-cyan-300">
              {incident.recommendedRoute.replace(/_/g, ' ')}
            </p>
            <ul className="mt-3 space-y-2.5">
              {incident.routingReasoning.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
                  {reason}
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>

        {/* PII findings + Related incidents */}
        <section className="grid gap-5 lg:grid-cols-2">
          <SectionCard title={`Privacy findings (${incident.piiDetections.length})`}>
            {incident.piiDetections.length === 0 ? (
              <p className="text-sm text-slate-500">No PII detected in this report.</p>
            ) : (
              <div className="space-y-2.5">
                {incident.piiDetections.map((pii, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-amber-300">
                        {pii.type.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-xs text-amber-400">{pii.redactedAs}</span>
                    </div>
                    {pii.context && (
                      <p className="mt-1 text-xs text-slate-400">…{pii.context.substring(0, 80)}…</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={`Related incidents (${incident.relatedIncidents.length})`}>
            {relatedFull.length === 0 ? (
              <p className="text-sm text-slate-500">
                No related incidents found. Similarity is assessed at submission time.
              </p>
            ) : (
              <div className="space-y-2.5">
                {relatedFull.map((rel) => (
                  <Link
                    key={rel.incidentId}
                    href={`/incidents/${rel.incidentId}`}
                    className="block rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 transition hover:border-purple-500/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-purple-300">
                        {rel.incidentId}
                      </span>
                      <span className="text-xs text-slate-400">
                        {Math.round(rel.similarity * 100)}% similar
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{rel.reason}</p>
                    {rel.incident && (
                      <p className="mt-1 text-xs text-slate-500">
                        {rel.incident.incidentType.replace(/_/g, ' ')} — {rel.incident.severity}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        {/* Original + sanitized reports */}
        <section className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Original report">
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <pre className="whitespace-pre-wrap text-xs leading-6 text-slate-300 font-sans">
                {incident.originalReport}
              </pre>
            </div>
          </SectionCard>

          <SectionCard title="Sanitized report">
            <p className="mb-3 text-xs text-slate-500">
              PII replaced with tokens for safe onward sharing.
            </p>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <pre className="whitespace-pre-wrap text-xs leading-6 text-slate-300 font-sans">
                {incident.sanitizedReport}
              </pre>
            </div>
          </SectionCard>
        </section>

        {/* Status history */}
        <SectionCard title="Status history">
          <ol className="relative border-l border-slate-700 pl-5 space-y-4">
            {incident.statusHistory.map((entry, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[22px] flex h-3 w-3 items-center justify-center rounded-full border border-slate-600 bg-slate-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                </span>
                <p className="text-sm font-semibold text-white">{entry.status.replace(/_/g, ' ')}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(entry.timestamp).toLocaleString('en-GB')}
                  {entry.analyst && ` · ${entry.analyst}`}
                </p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </main>
    </div>
  );
}
