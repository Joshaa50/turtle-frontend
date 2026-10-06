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
  Pencil,
  Send,
} from 'lucide-react';
import { DatabaseConnection } from '../services/Database';
import { User, RecordReview } from '../types';
import { formatDateTime, formatDateDisplay } from '../lib/utils';
import {
  buildFormSections,
  editableFieldsFor,
  toEditValues,
  buildResubmitPayload,
  inputKindFor,
  RESUBMIT_EDITABLE_TYPES,
} from '../lib/reviewForm';

/** Saves the one field the fixed record's own route owns. */
const saveCorrectedRecord = (recordType: string, recordId: number, payload: Record<string, any>) => {
  if (recordType === 'emergence') return DatabaseConnection.updateEmergence(recordId, payload);
  if (recordType === 'turtle') return DatabaseConnection.updateTurtle(recordId, payload);
  if (recordType === 'nest_event') return DatabaseConnection.updateNestEvent(recordId, payload);
  if (recordType === 'morning_survey') return DatabaseConnection.updateMorningSurvey(recordId, payload);
  return Promise.reject(new Error('This record type cannot be corrected here.'));
};

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

// The collapsed card is a reviewer's only chance to triage without opening
// every record — a one-word "Emergence · beach" line can't distinguish a
// false crawl from a nesting, or say which day it happened. Surfacing the
// type and event date here means most records can be judged without expanding.
const recordSummary = (review: RecordReview): string | null => {
  const detail = review.record_detail;
  if (!detail) return null;
  const parts: string[] = [];
  if (review.record_type === 'emergence' && detail.emergence_type) parts.push(String(detail.emergence_type));
  if (detail.event_date) parts.push(formatDateDisplay(detail.event_date));
  else if (detail.date_found) parts.push(formatDateDisplay(detail.date_found));
  return parts.length > 0 ? parts.join(' · ') : null;
};

const STATUS_STYLES: Record<RecordReview['status'], { label: string; className: string; Icon: typeof Clock }> = {
  pending:  { label: 'Awaiting review', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', Icon: Clock },
  approved: { label: 'Approved',        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', Icon: CheckCircle2 },
  rejected: { label: 'Needs correction',className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', Icon: XCircle },
};

const fullName = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(' ') || 'Unknown';

const whenText = (iso: string | null) => (iso ? formatDateTime(iso) : '');

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

  /** The rejected review currently open for correction, if any. */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = (review: RecordReview) => {
    const fields = editableFieldsFor(review.record_type);
    setEditValues(toEditValues(review.record_type, review.record_detail || {}, fields));
    setEditingId(review.id);
    setEditError(null);
    setExpandedIds((prev) => new Set(prev).add(review.id));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  /**
   * Saves the edited fields to the record's own route. A submitter fixing a
   * rejection also resubmits it (the only way it leaves "rejected"); a
   * reviewer editing something still pending just corrects it in place - the
   * record was never sent back, so there is nothing to resubmit.
   */
  const saveEdit = async (review: RecordReview, resubmit: boolean) => {
    const fields = editableFieldsFor(review.record_type);
    const payload = buildResubmitPayload(review.record_detail || {}, fields, editValues);
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await saveCorrectedRecord(review.record_type, review.record_id, payload);
      if (resubmit) {
        const updated = await DatabaseConnection.resubmitReview(review.id);
        setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, ...updated, record_detail: payload } : r)));
        setNotice('Sent back for review.');
      } else {
        setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, record_detail: payload } : r)));
        setNotice('Changes saved.');
      }
      setEditingId(null);
      setTimeout(() => setNotice(null), 4000);
      onQueueChange?.();
    } catch (err: any) {
      setEditError(err?.message || 'Could not save that correction.');
    } finally {
      setIsSavingEdit(false);
    }
  };

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

  // QA-034: a Morning Survey walk across several beaches queues one review
  // per beach, which is correct (each beach's data is its own row), but left
  // a reviewer clicking Approve 8 times for one walk. There is no batch id to
  // group by, so this groups the next best thing - the same submitter and
  // the same survey date - and only when there is more than one beach to
  // group, since a single-beach survey has nothing to batch.
  const [bulkApprovingKey, setBulkApprovingKey] = useState<string | null>(null);

  const walkGroupKey = (review: RecordReview): string | null => {
    if (review.record_type !== 'morning_survey' || review.status !== 'pending') return null;
    const date = review.record_detail?.survey_date;
    if (!date) return null;
    return `${review.submitted_by ?? 'x'}|${date}`;
  };

  const walkGroups = useMemo(() => {
    const groups = new Map<string, RecordReview[]>();
    for (const r of reviews) {
      const key = walkGroupKey(r);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    for (const [key, members] of groups) {
      if (members.length < 2) groups.delete(key);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews]);

  const bulkApprove = async (key: string, members: RecordReview[]) => {
    const ids = members.map((m) => m.id);
    setBulkApprovingKey(key);
    setError(null);
    try {
      const { reviews: updated, skippedIds } = await DatabaseConnection.bulkApproveReviews(ids);
      setReviews((prev) =>
        prev.map((r) => {
          const match = updated.find((u) => u.id === r.id);
          return match ? { ...r, ...match } : r;
        })
      );
      setNotice(
        `${updated.length} record(s) approved.` +
          (skippedIds.length ? ` ${skippedIds.length} had already been decided.` : '')
      );
      setTimeout(() => setNotice(null), 4000);
      onQueueChange?.();
    } catch (err: any) {
      setError(err?.message || 'Could not approve the selected records.');
    } finally {
      setBulkApprovingKey(null);
    }
  };

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

  // A single review's card - also reused, unchanged, inside a walk group
  // (renderWalkGroup below), so every per-beach action (expand, approve,
  // send back, edit) keeps working exactly as it does standalone.
  const renderReviewRow = (review: RecordReview) => {
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
                      {recordSummary(review) ? ` · ${recordSummary(review)}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {reviewer
                        ? `Recorded by ${fullName(review.submitted_by_first_name, review.submitted_by_last_name)}`
                        : 'Recorded by you'}
                      {whenText(review.submitted_at) ? ` · submitted ${whenText(review.submitted_at)}` : ''}
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
                    {editingId === review.id ? (
                      <div className="space-y-3">
                        {editableFieldsFor(review.record_type).map((field) => {
                          const original = (review.record_detail || {})[field.key];
                          const kind = inputKindFor(original);
                          return (
                            <div key={field.key} className="grid grid-cols-1 sm:grid-cols-[7rem_1fr] gap-x-4 gap-y-1 items-center">
                              <label htmlFor={`edit-${review.id}-${field.key}`} className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {field.label}
                              </label>
                              <input
                                id={`edit-${review.id}-${field.key}`}
                                type={kind === 'datetime' ? 'datetime-local' : kind === 'time' ? 'time' : kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'}
                                step={kind === 'number' ? (Number.isInteger(original) ? '1' : 'any') : undefined}
                                value={editValues[field.key] ?? ''}
                                onChange={(e) => setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-sm text-slate-900 dark:text-white"
                              />
                            </div>
                          );
                        })}
                        {editError && (
                          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{editError}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(review, !reviewer)}
                            disabled={isSavingEdit}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:opacity-90 text-white text-sm font-bold disabled:opacity-50"
                          >
                            {reviewer ? <Check className="size-4" /> : <Send className="size-4" />}
                            {isSavingEdit ? 'Saving…' : reviewer ? 'Save changes' : 'Save & send back for review'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSavingEdit}
                            className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const sections = buildFormSections(review.record_type, review.record_detail);
                          if (sections.length === 0) {
                            return (
                              <p className="text-sm text-slate-500">
                                {review.record_missing ? 'The record has been deleted.' : 'The record\'s details could not be loaded.'}
                              </p>
                            );
                          }
                          return (
                            <div className="space-y-4">
                              {sections.map((section) => (
                                <section key={section.title} aria-label={section.title}>
                                  <h4 className="text-[11px] font-black uppercase tracking-widest text-primary mb-1.5">
                                    {section.title}
                                  </h4>
                                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                    {section.rows.map((row) => (
                                      <div key={row.label} className="flex gap-2 min-w-0">
                                        <dt className="text-xs font-bold uppercase tracking-wide text-slate-500 shrink-0 w-28">{row.label}</dt>
                                        <dd className="text-slate-800 dark:text-slate-200 min-w-0 break-words">{row.value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </section>
                              ))}
                            </div>
                          );
                        })()}
                        {onOpenNest && nestCodeFor(review) && (
                          <button
                            onClick={() => onOpenNest(nestCodeFor(review)!)}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                          >
                            <ExternalLink className="size-3.5" />
                            Open nest {nestCodeFor(review)}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {review.status !== 'pending' && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {review.status === 'approved' && review.reviewed_by === null
                      ? 'Approved automatically'
                      : `${review.status === 'approved' ? 'Approved' : 'Sent back'} by ${fullName(review.reviewed_by_first_name, review.reviewed_by_last_name)}`}
                    {whenText(review.reviewed_at) ? ` · ${whenText(review.reviewed_at)}` : ''}
                  </p>
                )}

                {review.review_note && (
                  <p className="mt-2 p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10 text-sm text-slate-700 dark:text-slate-300">
                    {review.review_note}
                  </p>
                )}

                {!reviewer && review.status === 'rejected' && !review.record_missing && editingId !== review.id && (
                  RESUBMIT_EDITABLE_TYPES.has(review.record_type) ? (
                    <button
                      onClick={() => startEdit(review)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-500/10"
                    >
                      <Pencil className="size-4" />
                      Edit & send back for review
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Ask a Field Leader or Coordinator to make this correction.
                    </p>
                  )
                )}

                {reviewer && review.status === 'pending' && !review.record_missing && (
                  expandedIds.has(review.id) ? (
                    editingId === review.id ? null : (
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
                        {RESUBMIT_EDITABLE_TYPES.has(review.record_type) && (
                          <button
                            onClick={() => startEdit(review)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-500/10 disabled:opacity-50"
                          >
                            <Pencil className="size-4" />
                            Edit
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    // A decision made without ever opening the record is a
                    // decision made on the one-line summary alone - make
                    // opening it the only way to approve or reject.
                    <button
                      onClick={() => toggleExpanded(review.id)}
                      className="mt-3 text-xs font-bold text-primary hover:underline"
                    >
                      Open the record to approve or send back
                    </button>
                  )
                )}
      </li>
    );
  };

  // One "walk" of beaches submitted together, shown as a single card with
  // the usual per-beach cards nested inside (unchanged, still individually
  // expandable and actionable) plus one button that approves every beach
  // still pending in the group.
  const renderWalkGroup = (key: string, members: RecordReview[]) => {
    const first = members[0];
    const beachNames = members.map((m) => m.record_label).filter(Boolean).join(', ');
    const busy = bulkApprovingKey === key;
    return (
      <li
        key={`walk-${key}`}
        className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3"
      >
        <div>
          <p className="font-bold text-slate-900 dark:text-white">
            Morning survey walk · {members.length} beaches
          </p>
          {beachNames && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{beachNames}</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {reviewer
              ? `Recorded by ${fullName(first.submitted_by_first_name, first.submitted_by_last_name)}`
              : 'Recorded by you'}
            {whenText(first.submitted_at) ? ` · submitted ${whenText(first.submitted_at)}` : ''}
          </p>
        </div>
        {reviewer && (
          <button
            onClick={() => bulkApprove(key, members)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
          >
            <Check className="size-4" />
            {busy ? 'Approving…' : `Approve all ${members.length}`}
          </button>
        )}
        <ul className="space-y-3">
          {members.map((m) => renderReviewRow(m))}
        </ul>
      </li>
    );
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
          {(() => {
            const renderedGroupKeys = new Set<string>();
            return reviews.map((review) => {
              const key = walkGroupKey(review);
              if (key && walkGroups.has(key)) {
                if (renderedGroupKeys.has(key)) return null;
                renderedGroupKeys.add(key);
                return renderWalkGroup(key, walkGroups.get(key)!);
              }
              return renderReviewRow(review);
            });
          })()}
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
