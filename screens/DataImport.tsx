import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileDown, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';
import {
  parseNestCsv, importTemplateCsv, REQUIRED_COLUMNS, OPTIONAL_COLUMNS,
  type ParsedNest, type ImportIssue,
} from '../lib/csvImport';
import { downloadCsv } from '../lib/utils';
import { Button } from '../components/UIComponents';

/**
 * Bringing historical nest records in from a spreadsheet.
 *
 * Nothing is written until the file has been read, checked and shown back,
 * because the alternative - discovering on row 340 of 600 that the date format
 * was wrong - leaves a half-imported season somebody then has to unpick by
 * hand.
 */

interface DataImportProps {
  user: User;
  onImported?: () => void;
}

type RowOutcome = { row: number; nest_code: string; ok: boolean; error?: string };

const DataImport: React.FC<DataImportProps> = ({ user, onImported }) => {
  const canImport = user.role.includes('Coordinator');

  const [beaches, setBeaches] = useState<string[]>([]);
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ rows: ParsedNest[]; issues: ImportIssue[]; unknownColumns: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!canImport) return;
    DatabaseConnection.getBeaches().then((list) => setBeaches(list.map((b) => b.name)));
    DatabaseConnection.getNests().then((nests: any[]) =>
      setExistingCodes(new Set(nests.map((n) => String(n.nest_code || '').toLowerCase())))
    );
  }, [canImport]);

  const readFile = useCallback(async (file: File) => {
    setOutcomes(null);
    setFileName(file.name);
    const text = await file.text();
    setParsed(parseNestCsv(text, beaches));
  }, [beaches]);

  // Codes already in the database. Checked here rather than left to the API so
  // it shows in the preview, alongside everything else that would be refused.
  const duplicates = (parsed?.rows || []).filter((r) => existingCodes.has(r.nest_code.toLowerCase()));
  const importable = (parsed?.rows || []).filter((r) => !existingCodes.has(r.nest_code.toLowerCase()));

  const runImport = async () => {
    if (importable.length === 0) return;
    setIsImporting(true);
    setProgress(0);
    const results: RowOutcome[] = [];

    // One at a time. These go through the same endpoint as a typed nest, and
    // firing hundreds at a free-tier backend in parallel is how an import
    // half-succeeds.
    for (const [i, row] of importable.entries()) {
      try {
        const { row: _row, ...nest } = row;
        await DatabaseConnection.createNest(nest as any);
        results.push({ row: row.row, nest_code: row.nest_code, ok: true });
      } catch (err: any) {
        results.push({ row: row.row, nest_code: row.nest_code, ok: false, error: err?.message || 'Rejected by the server' });
      }
      setProgress(i + 1);
    }

    setOutcomes(results);
    setIsImporting(false);
    setParsed(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
    onImported?.();
    DatabaseConnection.getNests().then((nests: any[]) =>
      setExistingCodes(new Set(nests.map((n) => String(n.nest_code || '').toLowerCase())))
    );
  };

  if (!canImport) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <p className="text-sm text-slate-500">Only a project coordinator can import records.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Upload className="size-6 text-primary shrink-0" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Bring past seasons in from a spreadsheet. Every row is checked and shown back before anything is saved.
        </p>
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Only nests can be imported here. Hatch outcomes, turtles and emergences are not, so an
          imported season will have no hatch success rate until its excavations are recorded.
        </p>
      </header>

      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-5">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Columns</p>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
          <span className="font-bold">Required:</span> {REQUIRED_COLUMNS.join(', ')}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          <span className="font-bold">Optional:</span> {OPTIONAL_COLUMNS.join(', ')}
        </p>
        <p className="text-xs text-slate-500 mb-3">
          Dates as YYYY-MM-DD or DD/MM/YYYY. Beach names must match your configured beaches.
        </p>
        <p className="text-xs text-slate-500 mb-3">
          <span className="font-bold">Units:</span> gps_lat and gps_long in decimal degrees (e.g. 38.20000);
          distance_to_sea_s in metres; depth_top_egg_h, depth_bottom_chamber_h and width_w in centimetres;
          total_num_eggs as a whole number of eggs.
        </p>
        <Button
          variant="outline"
          icon={<FileDown className="size-4" />}
          onClick={() => downloadCsv('nest_import_template.csv', [
            Object.fromEntries([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((c) => [c, ''])),
          ])}
        >
          Download template
        </Button>
      </div>

      <div className="mb-6">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-primary file:text-white hover:file:bg-primary/90"
        />
        {fileName && <p className="mt-2 text-xs text-slate-500">Reading <span className="font-bold">{fileName}</span></p>}
      </div>

      {parsed && (
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Ready to import', value: importable.length, tone: 'text-emerald-600 dark:text-emerald-500' },
              { label: 'Already in the database', value: duplicates.length, tone: 'text-amber-600 dark:text-amber-500' },
              { label: 'Rows with problems', value: parsed.issues.length, tone: 'text-rose-600 dark:text-rose-500' },
            ].map((t) => (
              <div key={t.label} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className={`text-2xl font-black tabular-nums ${t.tone}`}>{t.value}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">{t.label}</p>
              </div>
            ))}
          </div>

          {parsed.unknownColumns.length > 0 && (
            <div className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-500">
              Ignored {parsed.unknownColumns.length === 1 ? 'column' : 'columns'}:{' '}
              <span className="font-bold">{parsed.unknownColumns.join(', ')}</span>. Nothing in
              {parsed.unknownColumns.length === 1 ? ' it' : ' them'} will be imported.
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400">
              {duplicates.length} {duplicates.length === 1 ? 'nest is' : 'nests are'} already recorded and will be skipped rather than duplicated:{' '}
              <span className="font-bold">{duplicates.slice(0, 8).map((d) => d.nest_code).join(', ')}</span>
              {duplicates.length > 8 && ` and ${duplicates.length - 8} more`}.
            </div>
          )}

          {parsed.issues.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 overflow-hidden">
              <p className="px-3 py-2 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 border-b border-rose-500/20">
                These rows will not be imported
              </p>
              <ul className="max-h-60 overflow-y-auto divide-y divide-rose-500/10">
                {parsed.issues.slice(0, 100).map((issue, i) => (
                  <li key={i} className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-black">Row {issue.row}</span>
                    {issue.field && <span className="text-slate-400"> · {issue.field}</span>} — {issue.message}
                  </li>
                ))}
              </ul>
              {parsed.issues.length > 100 && (
                <p className="px-3 py-2 text-xs text-slate-500">and {parsed.issues.length - 100} more</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={runImport} disabled={importable.length === 0 || isImporting}
                    icon={isImporting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}>
              {isImporting
                ? `Importing ${progress} of ${importable.length}…`
                : `Import ${importable.length} ${importable.length === 1 ? 'nest' : 'nests'}`}
            </Button>
            <Button variant="outline" onClick={() => { setParsed(null); setFileName(null); if (fileRef.current) fileRef.current.value = ''; }}
                    disabled={isImporting} icon={<X className="size-4" />}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {outcomes && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {outcomes.filter((o) => o.ok).length} imported
              {outcomes.some((o) => !o.ok) && `, ${outcomes.filter((o) => !o.ok).length} refused`}
            </p>
          </div>
          {outcomes.some((o) => !o.ok) && (
            <ul className="max-h-60 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
              {outcomes.filter((o) => !o.ok).map((o) => (
                <li key={o.row} className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <AlertCircle className="size-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span><span className="font-black">Row {o.row}</span> ({o.nest_code}) — {o.error}</span>
                </li>
              ))}
            </ul>
          )}
          {/* The rows that did import are real records now; saying so stops a
              partial run being re-run from the top. */}
          <p className="px-4 py-3 text-xs text-slate-500">
            Imported nests are saved and appear in Nest Records. Re-importing the same file will skip them.
          </p>
        </div>
      )}
    </div>
  );
};

export default DataImport;
