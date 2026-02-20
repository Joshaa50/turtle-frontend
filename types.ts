
export enum AppView {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  NEST_RECORDS = 'NEST_RECORDS',
  TURTLE_RECORDS = 'TURTLE_RECORDS',
  DATA_MANAGEMENT = 'DATA_MANAGEMENT',
  NEST_ENTRY = 'NEST_ENTRY',
  TALLY_SCREEN = 'TALLY_SCREEN',
  NEST_DETAILS = 'NEST_DETAILS',
  NEST_INVENTORY = 'NEST_INVENTORY',
  TAGGING_ENTRY = 'TAGGING_ENTRY',
  TURTLE_DETAILS = 'TURTLE_DETAILS'
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
}
