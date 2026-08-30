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
} from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { User, RecordReview } from '../types';

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

const whenText = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

interface ReviewQueueProps {
  user: User;
  theme?: 'light' | 'dark';
}

const ReviewQueue: React.FC<ReviewQueueProps> = ({ user }) => {
  const reviewer = isReviewer(user.role);

  const [reviews, setReviews] = useState<RecordReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  /** Ids with a decision in flight, so a double click cannot send two. */
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
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
          <ClipboardCheck className="size-6 text-primary shrink-0" />
          <h2 className="text-xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            {reviewer ? 'Review Queue' : 'My Submissions'}
          </h2>
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
                  <div className="min-w-0 flex-1">
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
                      </p>
                    )}
                  </div>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide shrink-0 ${status.className}`}>
                    <status.Icon className="size-3.5" />
                    {status.label}
                  </span>
                </div>

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
