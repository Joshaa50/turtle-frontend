
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
  USER_MANAGEMENT = 'USER_MANAGEMENT'
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
}

export interface NestRecord {
  id: string; // Used as nest_code for display/logic
  dbId?: number; // Primary key for DB updates
  location: string;
  date: string;
  species: string;
  status: 'HATCHED' | 'INCUBATING' | 'HATCHING';
  hatchlingsCount?: number;
  isArchived?: boolean;
}

export interface TurtleRecord {
  id?: string | number;
  tagId: string;
  name: string;
  species: string;
  lastSeen: string;
  location: string;
  weight: number;
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
