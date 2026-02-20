
export const API_URL = '';

export interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
}

export interface TurtleData {
  name?: string;
  species: string;
  sex: string;
  health_condition: string;

  front_left_tag?: string;
  front_left_address?: string;
  front_right_tag?: string;
  front_right_address?: string;
  rear_left_tag?: string;
  rear_left_address?: string;
  rear_right_tag?: string;
  rear_right_address?: string;

  scl_max: number;
  scl_min: number;
  scw: number;
  ccl_max: number;
  ccl_min: number;
  ccw: number;

  tail_extension: number;
  vent_to_tail_tip: number;
  total_tail_length: number;
}

export interface TurtleEventData {
  event_date: string;
  event_type: 'TAGGING' | 'NIGHT_SURVEY';
  location: string;
  turtle_id: number;

  front_left_tag?: string;
  front_left_address?: string;
  front_right_tag?: string;
  front_right_address?: string;
  rear_left_tag?: string;
  rear_left_address?: string;
  rear_right_tag?: string;
  rear_right_address?: string;

  scl_max: number;
  scl_min: number;
  scw: number;
  ccl_max: number;
  ccl_min: number;
  ccw: number;
  tail_extension: number;
  vent_to_tail_tip: number;
  total_tail_length: number;

  health_condition: string;
  observer: string;
  notes?: string;

  // Night Survey specific time fields
  time_first_seen?: string;
  time_start_egg_laying?: string;
  time_covering?: string;
  time_end_camouflage?: string;
  time_reach_sea?: string;
}

export interface NestData {
  nest_code: string;
  total_num_eggs?: number | null;
  current_num_eggs?: number | null;
  depth_top_egg_h: number;
  depth_bottom_chamber_h?: number | null;
  distance_to_sea_s: number;
  width_w?: number | null;
  gps_long: number;
  gps_lat: number;

  tri_tl_desc?: string | null;
  tri_tl_lat?: number | null;
  tri_tl_long?: number | null;
  tri_tl_distance?: number | null;

  tri_tr_desc?: string | null;
  tri_tr_lat?: number | null;
  tri_tr_long?: number | null;
  tri_tr_distance?: number | null;

  status: string;
  relocated: boolean;
  date_found: string;
  beach: string;
  notes?: string | null;
  is_archived?: boolean;
}

export interface NestEventData {
  id?: number;
  event_type: string;
  nest_code: string;
  created_at?: string;

  original_depth_top_egg_h?: number;
  original_depth_bottom_chamber_h?: number;
  original_width_w?: number;
  original_distance_to_sea_s?: number;
  original_gps_lat?: number;
  original_gps_long?: number;

  total_eggs?: number;
  helped_to_sea?: number;
  eggs_reburied?: number;

  hatched_count?: number;
  hatched_black_fungus_count?: number;
  hatched_green_bacteria_count?: number;
  hatched_pink_bacteria_count?: number;

  non_viable_count?: number;
  non_viable_black_fungus_count?: number;
  non_viable_green_bacteria_count?: number;
  non_viable_pink_bacteria_count?: number;

  eye_spot_count?: number;
  eye_spot_black_fungus_count?: number;
  eye_spot_green_bacteria_count?: number;
  eye_spot_pink_bacteria_count?: number;

  early_count?: number;
  early_black_fungus_count?: number;
  early_green_bacteria_count?: number;
  early_pink_bacteria_count?: number;

  middle_count?: number;
  middle_black_fungus_count?: number;
  middle_green_bacteria_count?: number;
  middle_pink_bacteria_count?: number;

  late_count?: number;
  late_black_fungus_count?: number;
  late_green_bacteria_count?: number;
  late_pink_bacteria_count?: number;

  piped_dead_count?: number;
  piped_dead_black_fungus_count?: number;
  piped_dead_green_bacteria_count?: number;
  piped_dead_pink_bacteria_count?: number;

  piped_alive_count?: number;

  // New Hatchling Status Fields
  alive_within?: number;
  dead_within?: number;
  alive_above?: number;
  dead_above?: number;

  // Track Data
  tracks_to_sea?: number;
  tracks_lost?: number;

  reburied_depth_top_egg_h?: number;
  reburied_depth_bottom_chamber_h?: number;
  reburied_width_w?: number;
  reburied_distance_to_sea_s?: number;
  reburied_gps_lat?: number;
  reburied_gps_long?: number;

  notes?: string;
  start_time?: string;
  end_time?: string;
  observer?: string;
}

export class DatabaseConnection {
  private static _status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR' = 'CONNECTED';

  // Initialize connection (Simulated for REST API availability)
  static async init() {
    this._status = 'CONNECTED';
    return true;
  }

  static get status() {
    return this._status;
  }

  static async createUser(userData: RegistrationData) {
    console.log(`[API Client] Sending registration request to ${API_URL}/register`);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Updated to snake_case keys for Supabase backend
        body: JSON.stringify({
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: userData.email,
          password: userData.password,
          role: userData.role
        }),
      });

      const data = await response.json();
      console.log('[API Client] Response Data:', data);

      if (!response.ok) {
        throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating user:', error);
      throw error;
    }
  }

  static async loginUser(email: string, password: string) {
    console.log(`[API Client] Sending login request to ${API_URL}/login`);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        }),
      });

      const data = await response.json();
      console.log('[API Client] Login Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Login failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error logging in:', error);
      throw error;
    }
  }

  static async getUsers() {
    console.log(`[API Client] Fetching users from ${API_URL}/users`);
    try {
      const response = await fetch(`${API_URL}/users`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      return data.users;
    } catch (error) {
      console.error("[API Client] Error fetching users:", error);
      // Return empty array instead of throwing to prevent crashing entire form
      return []; 
    }
  }

  static async createTurtle(turtleData: TurtleData) {
    console.log(`[API Client] Sending turtle creation request to ${API_URL}/turtles/create`);

    try {
      const response = await fetch(`${API_URL}/turtles/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(turtleData),
      });

      const data = await response.json();
      console.log('[API Client] Create Turtle Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to create turtle record: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating turtle:', error);
      throw error;
    }
  }

  static async updateTurtle(id: string | number, turtleData: any) {
    console.log(`[API Client] Sending turtle update request to ${API_URL}/turtles/${id}/update`);

    try {
      const response = await fetch(`${API_URL}/turtles/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(turtleData),
      });

      const data = await response.json();
      console.log('[API Client] Update Turtle Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to update turtle record: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error updating turtle:', error);
      throw error;
    }
  }

  static async createTurtleEvent(eventData: TurtleEventData) {
    console.log(`[API Client] Sending turtle event creation request to ${API_URL}/turtle_survey_events/create`);

    try {
      const response = await fetch(`${API_URL}/turtle_survey_events/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();
      console.log('[API Client] Create Turtle Event Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to create turtle event: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating turtle event:', error);
      throw error;
    }
  }

  static async createNest(nestData: NestData) {
    console.log(`[API Client] Sending nest creation request to ${API_URL}/nests/create`);

    try {
      const response = await fetch(`${API_URL}/nests/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nestData),
      });

      const data = await response.json();
      console.log('[API Client] Create Nest Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to create nest record: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating nest:', error);
      throw error;
    }
  }

  static async updateNest(id: string | number, nestData: Partial<NestData>) {
    console.log(`[API Client] Sending nest update request to ${API_URL}/nests/${id}/update`);

    try {
      const response = await fetch(`${API_URL}/nests/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nestData),
      });

      const data = await response.json();
      console.log('[API Client] Update Nest Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to update nest record: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error updating nest:', error);
      throw error;
    }
  }

  static async createNestEvent(eventData: NestEventData) {
    console.log(`[API Client] Sending nest event creation request to ${API_URL}/nest-events/create`);

    try {
      const response = await fetch(`${API_URL}/nest-events/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();
      console.log('[API Client] Create Nest Event Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to create nest event: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating nest event:', error);
      throw error;
    }
  }

  static async getNests() {
    console.log(`[API Client] Fetching nests from ${API_URL}/nests`);
    try {
      const response = await fetch(`${API_URL}/nests`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch nests');
      }

      return data.nests;
    } catch (error) {
      console.error("[API Client] Error fetching nests:", error);
      throw error;
    }
  }

  static async getNest(nestCode: string) {
    console.log(`[API Client] Fetching nest ${nestCode} from ${API_URL}/nests/${nestCode}`);
    try {
      const response = await fetch(`${API_URL}/nests/${nestCode}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch nest details');
      }

      return data;
    } catch (error) {
      console.error("[API Client] Error fetching nest by ID:", error);
      throw error;
    }
  }

  static async getNestEvents(nestCode: string) {
    console.log(`[API Client] Fetching events for nest ${nestCode} from ${API_URL}/nest-events/${nestCode}`);
    try {
      const response = await fetch(`${API_URL}/nest-events/${nestCode}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch nest events');
      }

      return data.events || [];
    } catch (error) {
      console.error("[API Client] Error fetching nest events:", error);
      return [];
    }
  }

  static async getTurtles() {
    console.log(`[API Client] Fetching turtles from ${API_URL}/turtles`);
    try {
      const response = await fetch(`${API_URL}/turtles`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch turtles');
      }

      return data.turtles;
    } catch (error) {
      console.error("[API Client] Error fetching turtles:", error);
      throw error;
    }
  }

  static async getTurtle(id: string | number) {
    console.log(`[API Client] Fetching turtle ${id} from ${API_URL}/turtles/${id}`);
    try {
      const response = await fetch(`${API_URL}/turtles/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch turtle details');
      }

      return data; // Expected structure: { message: "...", turtle: { ... } }
    } catch (error) {
      console.error("[API Client] Error fetching turtle by ID:", error);
      throw error;
    }
  }

  static async getTurtleSurveyEvents(turtleId: string | number) {
    console.log(`[API Client] Fetching survey events for turtle ${turtleId} from ${API_URL}/turtles/${turtleId}/survey_events`);
    try {
      const response = await fetch(`${API_URL}/turtles/${turtleId}/survey_events`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch survey events');
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error fetching survey events:', error);
      throw error;
    }
  }
}
