import { getQueuedSurveys } from './offlineSurveyQueue';
import { getQueuedWrites } from './offlineWriteQueue';

export const countPendingSync = (): number => getQueuedSurveys().length + getQueuedWrites().length;

// Replay goes through DatabaseConnection, which sends whatever session token is
// current when it runs - so these are sent as (and attributed to) whoever signs
// in next on this device, not the person who recorded them.
export const logoutWarningMessage = (count: number): string =>
  `${count} ${count === 1 ? 'item is' : 'items are'} still waiting to sync on this device. ` +
  `${count === 1 ? 'It' : 'They'} will stay on this device and sync the next time someone signs in on it, ` +
  `using that person's account.`;
