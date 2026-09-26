import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardCheck,
  Check,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  RefreshCw,
  Trash2,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { User, RecordReview } from '../types';
import { formatDate, formatDateTime } from '../lib/utils';

/**
 * Review Queue
 *
 * Field Volunteers record like everyone else and their records are stored
 * immediately — a volunteer on a beach at dawn must never lose an observation
 * waiting for a reviewer. What this screen adds is the Field Leader's
 * confirmation on top of that record.
 *
 * The same screen serves both sides: a reviewer sees everyone's pending
 * submissions and can act on them, while a volunteer sees only their own and
 * what was decided. Two views of one list beats two screens that drift apart.
 */

const isReviewer = (role: string) => role === 'Field Leader' || role.includes('Coordinator');

const STATUS_STYLES: Record<RecordReview['status'], { label: string; className: string; Icon: typeof Clock }> = {
  pending:  { label: 'Awaiting review', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', Icon: Clock },
  approved: { label: 'Approved',        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', Icon: CheckCircle2 },
  rejected: { label: 'Needs correction',className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', Icon: XCircle },
};

const fullName = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(' ') || 'Unknown';

const whenText = (iso: string | null) => (iso ? formatDateTime(iso) : '');

const coord = (lat: unknown, lng: unknown) =>
  lat == null || lng == null || lat === '' || lng === ''
    ? null
    : `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;

const clock = (iso: unknown) => (iso ? formatDateTime(String(iso)) : null);

/**
 * The facts a reviewer needs to judge a record, as label/value pairs. Built
 * from what the server sends in record_detail; an empty list means it could
 * not be loaded, and the card says so instead of showing a blank.
 */
const detailRows = (review: RecordReview): { label: string; value: string }[] => {
  const d = review.record_detail;
  if (!d) return [];
  const rows: [string, unknown][] = [];
  switch (review.record_type) {
    case 'nest':
      rows.push(
        ['Date found', d.date_found ? formatDate(d.date_found) : null],
        ['Beach', d.beach],
        ['GPS', coord(d.gps_lat, d.gps_long)],
        ['Eggs', d.total_num_eggs],
        ['Distance to sea', d.distance_to_sea_s != null ? `${d.distance_to_sea_s} m` : null],
        ['Status', d.status],
        ['Relocated', d.relocated ? 'Yes' : 'No'],
        ['Photos', `${d.photo_count ?? 0} attached${d.has_triangulation_photos ? ', triangulation photos included' : ''}`],
        ['Notes', d.notes],
      );
      break;
    case 'emergence':
      rows.push(
        ['Type', d.emergence_type],
        ['Date', d.event_date ? formatDate(d.event_date) : null],
        ['Beach', d.beach],
        ['GPS', coord(d.gps_lat, d.gps_long)],
        ['Distance to sea', d.distance_to_sea_s != null ? `${d.distance_to_sea_s} m` : null],
        ['Track sketch', d.has_track_sketch ? 'Attached' : 'None'],
        ['Linked nest', d.linked_nest_code],
      );
      break;
    case 'nest_event':
      rows.push(
        ['Event', String(d.event_type || '').replace(/_/g, ' ').toLowerCase()],
        ['Nest', d.nest_code],
        ['Observer', d.observer],
        ['Started', clock(d.start_time)],
        ['Finished', clock(d.end_time)],
        ['Eggs counted', d.total_eggs],
        ['Hatched', d.hatched_count],
        ['Tracks to sea / lost', d.tracks_to_sea != null || d.tracks_lost != null ? `${d.tracks_to_sea ?? 0} / ${d.tracks_lost ?? 0}` : null],
        ['Notes', d.notes],
      );
      break;
    case 'turtle':
      rows.push(
        ['Name', d.name],
        ['Species', d.species],
        ['Sex', d.sex],
        ['Condition', d.health_condition],
        ['Tags', [d.front_left_tag, d.front_right_tag, d.rear_left_tag, d.rear_right_tag].filter(Boolean).join(', ') || null],
      );
      break;
    case 'morning_survey':
      rows.push(
        ['Date', d.survey_date ? formatDate(d.survey_date) : null],
        ['Beach', d.beach],
        ['Times', d.start_time && d.end_time ? `${d.start_time} – ${d.end_time}` : null],
        ['Protected nests', d.protected_nest_count],
        ['Notes', d.notes],
      );
      break;
  }
  return rows
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([label, value]) => ({ label, value: String(value) }));
};

/** The nest a review's record belongs to, when there is one to open. */
const nestCodeFor = (review: RecordReview): string | null => {
  const d = review.record_detail;
  if (!d) return null;
  if (review.record_type === 'nest') return d.nest_code ?? null;
  if (review.record_type === 'emergence') return d.linked_nest_code ?? null;
  if (review.record_type === 'nest_event') return d.nest_code ?? null;
  return null;
};

interface ReviewQueueProps {
  user: User;
  theme?: 'light' | 'dark';
  /** Called after anything changes the pending set, so the nav badge keeps up. */
  onQueueChange?: () => void;
  /** Opens a nest's own page, for the records that belong to one. */
  onOpenNest?: (nestCode: string) => void;
}

const ReviewQueue: React.FC<ReviewQueueProps> = ({ user, onQueueChange, onOpenNest }) => {
  const reviewer = isReviewer(user.role);

  const [reviews, setReviews] = useState<RecordReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  /** Ids with a decision in flight, so a double click cannot send two. */
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  /** Cards opened to show the record behind them. */
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [rejecting, setRejecting] = useState<RecordReview | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = reviewer
        ? await DatabaseConnection.getReviews(filter)
        : await DatabaseConnection.getMyReviews();
      setReviews(rows);
    } catch (err: any) {
      setError(err?.message || 'Could not load the review queue.');
    } finally {
      setIsLoading(false);
    }
  }, [reviewer, filter]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = useMemo(
    () => reviews.filter((r) => r.status === 'pending').length,
    [reviews]
  );

  const decide = async (review: RecordReview, decision: 'approve' | 'reject', note?: string) => {
    setBusyIds((prev) => new Set(prev).add(review.id));
    setError(null);
    try {
      const updated = await DatabaseConnection.decideReview(review.id, decision, note);
      // Replace in place rather than refetching, so the row the reviewer just
      // acted on visibly changes instead of vanishing and reappearing.
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, ...updated } : r)));
      setNotice(decision === 'approve' ? 'Record approved.' : 'Sent back for correction.');
      setTimeout(() => setNotice(null), 4000);
      // One fewer thing pending - tell the nav badge rather than leaving it
      // showing a number the reviewer just changed.
      onQueueChange?.();
    } catch (err: any) {
      // A 409 means someone else decided it first. Reload so the screen shows
      // what actually happened rather than leaving a stale button.
      setError(err?.message || 'Could not save that decision.');
      if (String(err?.message || '').toLowerCase().includes('already')) load();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(review.id);
        return next;
      });
    }
  };

  /**
   * Clears a review row whose record was deleted after the fact — the row
   * itself carries nothing worth keeping once there's no record left to point
   * at. Only ever offered when record_missing is true, so this never removes
   * a live, actionable review.
   */
  const dismiss = async (review: RecordReview) => {
    setBusyIds((prev) => new Set(prev).add(review.id));
    setError(null);
    try {
      await DatabaseConnection.dismissReview(review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      onQueueChange?.();
    } catch (err: any) {
      setError(err?.message || 'Could not dismiss that row.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(review.id);
        return next;
      });
    }
  };

  const submitRejection = async () => {
    if (!rejecting || !rejectNote.trim()) return;
    const target = rejecting;
    const note = rejectNote.trim();
    setRejecting(null);
    setRejectNote('');
    await decide(target, 'reject', note);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardCheck className="size-5 text-primary shrink-0" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            {isLoading ? 'Loading…' : pendingCount > 0 ? `${pendingCount} awaiting review` : 'Nothing awaiting review'}
          </p>
          <button
            onClick={load}
            disabled={isLoading}
            className="ml-auto p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/10 disabled:opacity-40"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {reviewer
            ? 'Records submitted by Field Volunteers. The record is already saved — approving confirms it as reviewed fieldwork.'
            : 'Everything you have recorded is saved. This is where a Field Leader confirms it.'}
        </p>
      </header>

      {reviewer && (
        <div className="flex items-center gap-2 mb-4">
          {(['pending', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-colors ${
                filter === f
                  ? 'bg-primary text-white border-primary'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-500/10'
              }`}
            >
              {f === 'pending' ? `Pending${pendingCount ? ` (${pendingCount})` : ''}` : 'All'}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div role="status" className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">Loading…</p>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center">
          <Inbox className="size-10 mx-auto mb-3 text-slate-400 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {reviewer ? 'Nothing waiting to be reviewed.' : 'You have not submitted anything for review yet.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => {
            const status = STATUS_STYLES[review.status] ?? STATUS_STYLES.pending;
            const busy = busyIds.has(review.id);
            return (
              <li
                key={review.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(review.id)}
                    aria-expanded={expandedIds.has(review.id)}
                    aria-label={expandedIds.has(review.id) ? 'Hide record details' : 'Show record details'}
                    className="mt-0.5 p-1 -ml-1 rounded text-slate-500 hover:bg-slate-500/10"
                  >
                    <ChevronDown className={`size-4 transition-transform ${expandedIds.has(review.id) ? 'rotate-180' : ''}`} />
                  </button>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpanded(review.id)}>
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {review.record_kind}
                      {review.record_label ? ` · ${review.record_label}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {reviewer
                        ? `Recorded by ${fullName(review.submitted_by_first_name, review.submitted_by_last_name)}`
                        : 'Recorded by you'}
                      {whenText(review.submitted_at) ? ` · ${whenText(review.submitted_at)}` : ''}
                    </p>
                    {review.record_missing && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        This record has since been deleted.
                        {reviewer && (
                          <button
                            onClick={() => dismiss(review)}
                            disabled={busyIds.has(review.id)}
                            className="inline-flex items-center gap-1 ml-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold disabled:opacity-50"
                          >
                            <Trash2 className="size-3" />
                            Dismiss
                          </button>
                        )}
                      </p>
                    )}
                  </div>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide shrink-0 ${status.className}`}>
                    <status.Icon className="size-3.5" />
                    {status.label}
                  </span>
                </div>

                {expandedIds.has(review.id) && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-500/5 border border-slate-500/10">
                    {detailRows(review).length > 0 ? (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {detailRows(review).map((row) => (
                          <div key={row.label} className="flex gap-2 min-w-0">
                            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500 shrink-0 w-28">{row.label}</dt>
                            <dd className="text-slate-800 dark:text-slate-200 min-w-0 break-words">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-slate-500">
                        {review.record_missing ? 'The record has been deleted.' : 'The record\'s details could not be loaded.'}
                      </p>
                    )}
                    {onOpenNest && nestCodeFor(review) && (
                      <button
                        onClick={() => onOpenNest(nestCodeFor(review)!)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        Open nest {nestCodeFor(review)}
                      </button>
                    )}
                  </div>
                )}

                {review.status !== 'pending' && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {review.status === 'approved' ? 'Approved' : 'Sent back'} by{' '}
                    {fullName(review.reviewed_by_first_name, review.reviewed_by_last_name)}
                    {whenText(review.reviewed_at) ? ` · ${whenText(review.reviewed_at)}` : ''}
                  </p>
                )}

                {review.review_note && (
                  <p className="mt-2 p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10 text-sm text-slate-700 dark:text-slate-300">
                    {review.review_note}
                  </p>
                )}

                {reviewer && review.status === 'pending' && !review.record_missing && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => decide(review, 'approve')}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
                    >
                      <Check className="size-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejecting(review); setRejectNote(''); }}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-500/10 disabled:opacity-50"
                    >
                      <X className="size-4" />
                      Send back
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* A rejection without a reason is not actionable by the person who
          recorded it, so the note is required rather than optional. */}
      {rejecting && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white mb-1">
              Send back for correction
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              {rejecting.record_kind}
              {rejecting.record_label ? ` · ${rejecting.record_label}` : ''}
            </p>
            <label htmlFor="reject-note" className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
              What needs correcting?
            </label>
            <textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent p-2.5 text-sm text-slate-900 dark:text-white"
              placeholder="e.g. Distance to sea looks like it was measured from the wrong marker."
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => { setRejecting(null); setRejectNote(''); }}
                className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-500/10"
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                disabled={!rejectNote.trim()}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-50"
              >
                Send back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewQueue;
