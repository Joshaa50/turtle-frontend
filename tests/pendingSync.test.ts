import { describe, it, expect, beforeEach } from 'vitest';
import { countPendingSync, logoutWarningMessage } from '../lib/pendingSync';

const SURVEY_KEY = 'turtle_offline_survey_queue';

describe('countPendingSync', () => {
  beforeEach(() => localStorage.clear());

  it('is 0 when both queues are empty', () => {
    expect(countPendingSync()).toBe(0);
  });

  it('sums writes and surveys', () => {
    localStorage.setItem('turtle_offline_write_queue', JSON.stringify([{ id: 'a' }, { id: 'b' }]));
    localStorage.setItem(SURVEY_KEY, JSON.stringify([{ id: 's' }]));
    expect(countPendingSync()).toBe(3);
  });
});

describe('logoutWarningMessage', () => {
  it('states count, that items stay, and that the next sign-in syncs them', () => {
    const m = logoutWarningMessage(3);
    expect(m).toContain('3 items are');
    expect(m).toContain('stay on this device');
    expect(m).toContain("that person's account");
  });
  it('singular', () => {
    expect(logoutWarningMessage(1)).toContain('1 item is');
  });
});
