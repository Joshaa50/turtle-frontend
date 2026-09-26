import React, { useCallback, useEffect, useState } from 'react';
import { FileBarChart, RefreshCw, Download, Printer, AlertCircle } from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import type { NestEventData } from '../services/Database';
import { buildSeasonReport, seasonsPresent, currentSeason, type SeasonReport as Report } from '../lib/seasonReport';
import { downloadCsv } from '../lib/utils';
import { Button } from '../components/UIComponents';
import { Select } from '../components/ui/Select';

/**
 * The season summary an organisation sends a funder or a ministry.
 *
 * The dashboard tiles are live counters; this is a document about a finished
 * or finishing season, with the denominator stated so nobody has to guess what
 * "78% success" was measured against.
 */

const SeasonReport: React.FC<{ theme?: 'light' | 'dark'; user?: { role: string } }> = ({ user }) => {
  // Hiding the nav entry is not the same as closing the screen: the view can
  // still be reached by state that set it before a role changed.
  const canView = !user || user.role.includes('Coordinator');

  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [previous, setPrevious] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (wanted?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const nests = await DatabaseConnection.getNests();
      const years = seasonsPresent(nests);
      setSeasons(years);

      const target = wanted ?? currentSeason(nests) ?? years[0];
      if (target === undefined) { setReport(null); setIsLoading(false); return; }
      setSeason(target);

      // Hatchling counts live on each nest's events, so this season's nests
      // and the previous season's are fetched together - the comparison is
      // the point of the report, and a second round trip on switching years
      // would make it feel broken.
      const relevant = nests.filter((n: any) => {
        const y = n.date_found ? new Date(n.date_found).getUTCFullYear() : null;
        return y === target || y === target - 1;
      });

      const eventsByNest: Record<string, NestEventData[]> = {};
      await Promise.all(relevant.map(async (n: any) => {
        if (!n.nest_code) return;
        try {
          eventsByNest[String(n.nest_code)] = await DatabaseConnection.getNestEvents(n.nest_code);
        } catch {
          // A nest whose events fail to load is counted as awaiting an
          // outcome, not as zero hatchlings.
        }
      }));

      setReport(buildSeasonReport(nests, eventsByNest, target));
      setPrevious(years.includes(target - 1) ? buildSeasonReport(nests, eventsByNest, target - 1) : null);
    } catch (err: any) {
      setError(err?.message || 'Could not build the season report.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!report) return;
    const rows = report.beaches.map((b) => ({
      season: report.season,
      beach: b.beach,
      nests: b.nests,
      relocated: b.relocated,
      eggs: b.eggs,
      nests_with_outcome: b.nestsWithOutcome,
      hatchlings: b.hatchlings,
      nests_flagged: b.flaggedNests,
      hatch_success_pct: b.successRate ?? '',
    }));
    rows.push({
      season: report.season, beach: 'TOTAL',
      nests: report.totals.nests, relocated: report.totals.relocated, eggs: report.totals.eggs,
      nests_with_outcome: report.totals.nestsWithOutcome, hatchlings: report.totals.hatchlings,
      nests_flagged: report.totals.flaggedNests,
      hatch_success_pct: report.totals.successRate ?? '',
    });
    downloadCsv(`season_report_${report.season}.csv`, rows);
  };

  const delta = (now: number, before: number | undefined) => {
    if (before === undefined || before === 0) return null;
    const pct = Math.round(((now - before) / before) * 100);
    return pct === 0 ? null : `${pct > 0 ? '+' : ''}${pct}%`;
  };

  if (!canView) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <p className="text-sm text-slate-500">
          The season report is compiled by the project coordinator.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full print:max-w-none">
      <header className="mb-6 print:mb-4">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <FileBarChart className="size-6 text-primary shrink-0 print:hidden" />
          {/* The app header already says "Season Report"; this says which one. */}
          <h2 className="text-xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            {season ? `${season} season` : 'Season'}
          </h2>
          <button
            onClick={() => load(season ?? undefined)}
            disabled={isLoading}
            className="ml-auto p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/10 disabled:opacity-40 print:hidden"
            title="Refresh" aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nesting, hatching and relocation totals by beach, for sending on.
        </p>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-end gap-3 mb-6 flex-wrap print:hidden">
        <div className="w-40">
          <Select
            label="Season"
            value={String(season ?? '')}
            onChange={(e) => load(Number(e.target.value))}
            disabled={isLoading || seasons.length === 0}
            options={seasons.map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!report} icon={<Download className="size-4" />}>
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()} disabled={!report} icon={<Printer className="size-4" />}>
          Print / PDF
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Building the report…</p>
      ) : !report || report.totals.nests === 0 ? (
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">No nests recorded for this season</p>
          <p className="text-xs text-slate-500">Nests are counted in the season they were found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Nests', value: report.totals.nests, was: previous?.totals.nests },
              { label: 'Eggs', value: report.totals.eggs, was: previous?.totals.eggs },
              { label: 'Hatchlings', value: report.totals.hatchlings, was: previous?.totals.hatchlings },
              { label: 'Relocated', value: report.totals.relocated, was: previous?.totals.relocated },
            ].map((tile) => {
              const d = delta(tile.value, tile.was);
              return (
                <div key={tile.label} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{tile.label}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{tile.value.toLocaleString()}</p>
                  {d && previous && (
                    <p className="text-[11px] font-bold text-slate-500 mt-1">{d} vs {previous.season}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 mb-6">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Hatch success:{' '}
              {report.totals.successRate !== null ? `${report.totals.successRate}%` : 'not yet measurable'}
            </p>
            {/* Anyone reading a percentage in a funding report will ask what it
                was measured against. Say it, rather than making them ask. */}
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {report.totals.nestsWithOutcome > 0
                ? `Hatchlings as a share of the eggs in the ${report.totals.nestsWithOutcome} ${report.totals.nestsWithOutcome === 1 ? 'nest' : 'nests'} with a recorded outcome.`
                : 'No nest has a hatching or excavation record yet.'}
              {report.nestsAwaitingOutcome > 0 && ` ${report.nestsAwaitingOutcome} still awaiting an outcome ${report.nestsAwaitingOutcome === 1 ? 'is' : 'are'} excluded, rather than counted as zero.`}
            </p>
            {report.totals.flaggedNests > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 leading-relaxed flex items-start gap-1.5">
                <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                {report.totals.flaggedNests} {report.totals.flaggedNests === 1 ? 'nest records' : 'nests record'} more hatchlings than eggs. That cannot be right, so {report.totals.flaggedNests === 1 ? 'it is' : 'they are'} counted as 100% of the clutch. Check the nest records.
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['Beach', 'Nests', 'Relocated', 'Eggs', 'Hatchlings', 'Success'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 ${i > 0 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.beaches.map((b) => (
                  <tr key={b.beach} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{b.beach}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{b.nests}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{b.relocated || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{b.eggs.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{b.hatchlings.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold">
                      {b.successRate !== null ? `${b.successRate}%` : <span className="text-slate-400 font-normal">—</span>}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 font-black">
                  <td className="px-4 py-3 text-slate-900 dark:text-white">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.totals.nests}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.totals.relocated || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.totals.eggs.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.totals.hatchlings.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {report.totals.successRate !== null ? `${report.totals.successRate}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            Nests are counted in the season they were found. A dash means no outcome is on record yet.
          </p>
        </>
      )}
    </div>
  );
};

export default SeasonReport;
