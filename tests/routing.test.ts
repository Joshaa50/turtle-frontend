// QA-061: "My Submissions" (the volunteer-facing Review Queue) was only
// reachable at /review-queue - a direct link to /my-submissions (matching
// its own nav label) 404'd and bounced to the dashboard instead of opening
// the screen.
import { describe, it, expect } from 'vitest';
import { pathForRoute, routeForPath } from '../lib/routing';
import { AppView } from '../types';

describe('routing: /my-submissions alias for Review Queue (QA-061)', () => {
  it('resolves /my-submissions to the Review Queue view', () => {
    const route = routeForPath('/my-submissions', '');
    expect(route?.view).toBe(AppView.REVIEW_QUEUE);
  });

  it('still resolves the canonical /review-queue path', () => {
    const route = routeForPath('/review-queue', '');
    expect(route?.view).toBe(AppView.REVIEW_QUEUE);
  });

  it('keeps emitting the canonical path for Review Queue, not the alias', () => {
    expect(pathForRoute({ view: AppView.REVIEW_QUEUE })).toMatch(/\/review-queue$/);
  });
});
