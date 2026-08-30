
export enum AppView {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  NEST_RECORDS = 'NEST_RECORDS',
  TURTLE_RECORDS = 'TURTLE_RECORDS',
  NEST_ENTRY = 'NEST_ENTRY',
  NEST_DETAILS = 'NEST_DETAILS',
  NEST_INVENTORY = 'NEST_INVENTORY',
  TAGGING_ENTRY = 'TAGGING_ENTRY',
  TURTLE_DETAILS = 'TURTLE_DETAILS',
  MORNING_SURVEY = 'MORNING_SURVEY',
  MAP_VIEW = 'MAP_VIEW',
  SETTINGS = 'SETTINGS',
  TIME_TABLE = 'TIME_TABLE',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  PUBLIC_STATS = 'PUBLIC_STATS',
  REVIEW_QUEUE = 'REVIEW_QUEUE'
}

export interface User {
  id: string | number;
  firstName: string;
  lastName: string;
  role: string;
  avatar: string;
  email: string;
  station?: string;
  isActive?: boolean;
  profilePicture?: string;
  is_password_reset_needed?: boolean;
}

/**
 * A Field Volunteer's submission awaiting a Field Leader's confirmation. The
 * record itself is already stored - this tracks only the decision on it.
 */
export interface RecordReview {
  id: number;
  record_type: 'nest' | 'turtle' | 'nest_event' | 'emergence' | 'morning_survey';
  record_id: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: number | null;
  submitted_at: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_note: string | null;
  submitted_by_first_name: string | null;
  submitted_by_last_name: string | null;
  reviewed_by_first_name: string | null;
  reviewed_by_last_name: string | null;
  /** Short human label for the record, e.g. a nest code. Null if it was deleted. */
  record_label: string | null;
  /** "Nest", "Turtle", ... for display. */
  record_kind: string;
  /** True when the underlying record no longer exists. */
  record_missing: boolean;
}

export interface NestRecord {
  id: string; // Used as nest_code for display/logic
  dbId?: number; // Primary key for DB updates
  location: string;
  date: string;
  laidTimestamp: number;
  species: string;
  status: 'HATCHED' | 'INCUBATING' | 'HATCHING';
  hatchlingsCount?: number;
  isArchived?: boolean;
  /** The row as the API returned it, for the CSV export's quantitative columns. */
  raw?: any;
}

export interface TurtleRecord {
  id?: string | number;
  tagId: string;
  name: string;
  species: string;
  lastSeen: string;
  location: string;
  weight: number;
  isArchived?: boolean;
  measurements?: {
    scl_max?: number;
    scl_min?: number;
    scw?: number;
    ccl_max?: number;
    ccl_min?: number;
    ccw?: number;
    tail_extension?: number;
    vent_to_tail_tip?: number;
    total_tail_length?: number;
    microchip_number?: string;
    microchip_location?: string;
  };
}

export interface TimetableShift {
  id: string;
  shift_id?: string | number;
  volunteers: { name: string; email: string; id?: string | number }[];
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  shiftType: 'Morning' | 'Afternoon' | 'Night';
  task: string;
  date: string;
}

export interface SurveyNest {
  nestCode: string;
  newNestDetails: string;
  isEmergence?: boolean;
  entryId?: string | number;
  payload?: any;
  relocationEventPayload?: any;
}

export interface SurveyTrack {
  nestCode: string;
  tracksToSea: string;
  tracksLost: string;
}

export interface SurveyData {
  firstTime: string;
  lastTime: string;
  region: string;
  tlGpsLat: string;
  tlGpsLng: string;
  trGpsLat: string;
  trGpsLng: string;
  nestTally: number;
  nests: SurveyNest[];
  tracks: SurveyTrack[];
  notes: string;
}

export interface EmergenceRecord {
  id: number;
  event_date: string;
  distance_to_sea_s?: number;
  gps_lat?: number;
  gps_long?: number;
  beach?: string;
  track_sketch?: string;
}
