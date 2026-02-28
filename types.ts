
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
  MAP_VIEW = 'MAP_VIEW'
}

export interface User {
  name: string;
  role: string;
  avatar: string;
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
  };
}
