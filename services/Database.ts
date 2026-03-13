
export const API_URL = 'https://turtle-backend-pxcx.onrender.com';

export function decodeProfilePicture(pic: any): string | null {
  if (!pic) return null;
  
  let finalPic: string | null = null;
  
  try {
    if (typeof pic === 'object' && pic !== null) {
      if (Array.isArray(pic)) {
        const bytes = new Uint8Array(pic);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        if (binary.startsWith('\x89PNG') || binary.startsWith('\xFF\xD8') || binary.startsWith('GIF8')) {
          finalPic = btoa(binary);
        } else {
          finalPic = binary;
        }
      } else if ('data' in pic) {
        if (Array.isArray((pic as any).data)) {
          const bytes = new Uint8Array((pic as any).data);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          
          // Check if binary is already a base64 string or raw bytes
          if (binary.startsWith('\x89PNG') || binary.startsWith('\xFF\xD8') || binary.startsWith('GIF8')) {
            finalPic = btoa(binary);
          } else {
            finalPic = binary;
          }
        } else if (typeof (pic as any).data === 'string') {
          finalPic = (pic as any).data;
        }
      }
    } else if (typeof pic === 'string') {
      try {
        if (pic.trim().startsWith('{') || pic.trim().startsWith('[')) {
          const parsed = JSON.parse(pic);
          // If it successfully parsed as an object, recursively decode it
          return decodeProfilePicture(parsed);
        }
      } catch (e) {
        // Not JSON, continue as string
      }
      finalPic = pic;
    }
    
    if (typeof finalPic === 'string') {
      finalPic = finalPic.trim();
      if (finalPic === 'null' || finalPic === 'undefined') return null;
      if (finalPic.startsWith('"') && finalPic.endsWith('"')) {
        finalPic = finalPic.slice(1, -1);
      }
      if (finalPic.startsWith("'") && finalPic.endsWith("'")) {
        finalPic = finalPic.slice(1, -1);
      }
      
      if (finalPic === '') return null;
      if (finalPic.startsWith('http') || finalPic.startsWith('data:')) return finalPic;
      
      // Check if it's raw image bytes (e.g. if backend sent raw bytes as string)
      if (finalPic.startsWith('\x89PNG') || finalPic.startsWith('\xFF\xD8') || finalPic.startsWith('GIF8')) {
        finalPic = btoa(finalPic);
      }
      
      // Remove any whitespace that might have crept in
      finalPic = finalPic.replace(/\s/g, '');
      
      // Decode URL encoded string if necessary
      if (finalPic.includes('%2F') || finalPic.includes('%2B') || finalPic.includes('%3D')) {
        try {
          finalPic = decodeURIComponent(finalPic);
        } catch (e) {
          // Ignore
        }
      }
      
      // Detect mime type from base64 string
      let mimeType = 'image/png';
      if (finalPic.startsWith('/9j/')) mimeType = 'image/jpeg';
      else if (finalPic.startsWith('iVBORw0KGgo')) mimeType = 'image/png';
      else if (finalPic.startsWith('R0lGOD')) mimeType = 'image/gif';
      else if (finalPic.startsWith('UklGR')) mimeType = 'image/webp';
      else if (finalPic.startsWith('PHN2Zy')) mimeType = 'image/svg+xml';
      
      return `data:${mimeType};base64,${finalPic}`;
    }
  } catch (err) {
    console.error('Error decoding profile picture:', err);
  }
  
  return null;
}

export interface Beach {
  id: number;
  name: string;
  code: string;
  station: string;
  survey_area: string;
  is_active: boolean;
  created_at: string;
}

export interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  station: string;
  profilePicture?: string;
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

  microchip_number?: string;
  microchip_location?: string;
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

  microchip_number?: string;
  microchip_location?: string;

  health_condition: string;
  observer: string;
  notes?: string;

  // Night Survey specific time fields
  time_first_seen?: string;
  time_start_egg_laying?: string;
  time_covering?: string;
  time_start_camouflage?: string;
  time_end_camouflage?: string;
  time_reach_sea?: string;
}

export interface NestData {
  id?: number;
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
  tri_tl_img?: string | null;

  tri_tr_desc?: string | null;
  tri_tr_lat?: number | null;
  tri_tr_long?: number | null;
  tri_tr_distance?: number | null;
  tri_tr_img?: string | null;

  status: string;
  relocated: boolean;
  date_laid: string;
  date_found?: string;
  beach: string;
  notes?: string | null;
  sketch?: string | null;
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

export interface ShiftData {
  shift_id: number;
  shift_name: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface MorningSurveyData {
  survey_date: string;
  start_time: string;
  end_time: string;
  beach_id: number;
  tl_lat?: number | string;
  tl_long?: number | string;
  tr_lat?: number | string;
  tr_long?: number | string;
  protected_nest_count?: number;
  notes?: string;
  nest_id?: number;
  event_id?: number;
}

export class DatabaseConnection {
  static async createUser(userData: RegistrationData) {
    // console.log(`[API Client] Sending registration request to ${API_URL}/users/register`);

    try {
      let profilePic = userData.profilePicture;
      if (typeof profilePic === 'string' && profilePic.startsWith('data:image')) {
        profilePic = profilePic.split(',')[1];
      }
      
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          station: userData.station,
          profile_picture: profilePic
        }),
      });

      const data = await response.json();
      // console.log('[API Client] Response Data:', data);

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
    // console.log(`[API Client] Sending login request to ${API_URL}/users/login`);

    try {
      const response = await fetch(`${API_URL}/users/login`, {
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
      // console.log('[API Client] Login Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Login failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error logging in:', error);
      throw error;
    }
  }

  static async createTurtle(turtleData: TurtleData) {
    // console.log(`[API Client] Sending turtle creation request to ${API_URL}/turtles/create`);

    try {
      const response = await fetch(`${API_URL}/turtles/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(turtleData),
      });

      const data = await response.json();
      // console.log('[API Client] Create Turtle Response:', data);

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
    // console.log(`[API Client] Sending turtle update request to ${API_URL}/turtles/${id}/update`);

    try {
      const response = await fetch(`${API_URL}/turtles/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(turtleData),
      });

      const data = await response.json();
      // console.log('[API Client] Update Turtle Response:', data);

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
    // console.log(`[API Client] Sending turtle event creation request to ${API_URL}/turtle_survey_events/create`);

    try {
      const response = await fetch(`${API_URL}/turtle_survey_events/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();
      // console.log('[API Client] Create Turtle Event Response:', data);

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
    // console.log(`[API Client] Sending nest creation request to ${API_URL}/nests/create`);

    try {
      const payload = { ...nestData };
      if (typeof payload.tri_tl_img === 'string' && payload.tri_tl_img.startsWith('data:image')) {
        payload.tri_tl_img = payload.tri_tl_img.split(',')[1];
      }
      if (typeof payload.tri_tr_img === 'string' && payload.tri_tr_img.startsWith('data:image')) {
        payload.tri_tr_img = payload.tri_tr_img.split(',')[1];
      }
      if (typeof (payload as any).sketch === 'string' && (payload as any).sketch.startsWith('data:image')) {
        (payload as any).sketch = (payload as any).sketch.split(',')[1];
      }
      
      const response = await fetch(`${API_URL}/nests/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      // console.log('[API Client] Create Nest Response:', data);

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
    // console.log(`[API Client] Sending nest update request to ${API_URL}/nests/${id}/update`);

    try {
      const payload = { ...nestData };
      if (typeof payload.tri_tl_img === 'string' && payload.tri_tl_img.startsWith('data:image')) {
        payload.tri_tl_img = payload.tri_tl_img.split(',')[1];
      }
      if (typeof payload.tri_tr_img === 'string' && payload.tri_tr_img.startsWith('data:image')) {
        payload.tri_tr_img = payload.tri_tr_img.split(',')[1];
      }
      if (typeof (payload as any).sketch === 'string' && (payload as any).sketch.startsWith('data:image')) {
        (payload as any).sketch = (payload as any).sketch.split(',')[1];
      }
      
      const response = await fetch(`${API_URL}/nests/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      // console.log('[API Client] Update Nest Response:', data);

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
    // console.log(`[API Client] Sending nest event creation request to ${API_URL}/nest-events/create`);

    try {
      const response = await fetch(`${API_URL}/nest-events/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();
      // console.log('[API Client] Create Nest Event Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to create nest event: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating nest event:', error);
      throw error;
    }
  }

  static async createMorningSurvey(surveyData: MorningSurveyData) {
    try {
      const response = await fetch(`${API_URL}/morning-surveys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(surveyData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to create morning survey: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating morning survey:', error);
      throw error;
    }
  }

  static async updateNestEvent(id: string | number, eventData: any) {
    // console.log(`[API Client] Sending nest event update request to ${API_URL}/nest-events/${id}`);

    try {
      // Strip internal fields that shouldn't be sent back
      const { id: _, created_at: __, ...payload } = eventData;

      const response = await fetch(`${API_URL}/nest-events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      // console.log('[API Client] Update Nest Event Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to update nest event: ${response.status}`);
      }

      // After a successful update, fetch the updated event to return it
      const updatedEventResponse = await fetch(`${API_URL}/nest-events/event/${id}`);
      const updatedEventData = await updatedEventResponse.json();

      if (!updatedEventResponse.ok) {
        throw new Error(updatedEventData.error || 'Failed to fetch the updated event data.');
      }

      return updatedEventData;
    } catch (error) {
      console.error('[API Client] Error updating nest event:', error);
      throw error;
    }
  }

  static async getNests() {
    // console.log(`[API Client] Fetching nests from ${API_URL}/nests`);
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
    // console.log(`[API Client] Fetching nest ${nestCode} from ${API_URL}/nests/${nestCode}`);
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
    // console.log(`[API Client] Fetching events for nest ${nestCode} from ${API_URL}/nest-events/${nestCode}`);
    try {
      const url = `${API_URL}/nest-events/${nestCode}?timestamp=${new Date().getTime()}`;
      const response = await fetch(url);
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
    // console.log(`[API Client] Fetching turtles from ${API_URL}/turtles`);
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
    // console.log(`[API Client] Fetching turtle ${id} from ${API_URL}/turtles/${id}`);
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
    // console.log(`[API Client] Fetching survey events for turtle ${turtleId} from ${API_URL}/turtles/${turtleId}/survey_events`);
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

  static async getUser(userId: number | string) {
    try {
      const response = await fetch(`${API_URL}/users/${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user');
      }

      return data.user || data;
    } catch (error) {
      console.error(`[API Client] Error fetching user ${userId}:`, error);
      throw error;
    }
  }

  static async getUsers() {
    // console.log(`[API Client] Fetching users from ${API_URL}/users`);
    try {
      const response = await fetch(`${API_URL}/users`);
      const data = await response.json();
      console.log('[API Client] Users Response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      // Handle both { users: [...] } and [...] formats
      let userList = [];
      if (Array.isArray(data)) userList = data;
      else if (data.users && Array.isArray(data.users)) userList = data.users;
      else if (data.data && Array.isArray(data.data)) userList = data.data; // Some APIs wrap in 'data'
      
      return userList;
    } catch (error) {
      console.error("[API Client] Error fetching users:", error);
      return [];
    }
  }

  static async approveUser(userId: number | string) {
    return this.updateUser(userId, { is_active: true });
  }

  static async updateProfilePicture(userId: number | string, base64Data: string) {
    try {
      // Strip prefix if it exists
      let rawBase64 = base64Data;
      if (rawBase64.startsWith('data:image')) {
        rawBase64 = rawBase64.split(',')[1];
      }
      
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile_picture: rawBase64 }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update profile picture');
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error updating profile picture:', error);
      throw error;
    }
  }

  static async updateUser(userId: number | string, updates: any) {
    try {
      // Create a copy of updates
      const payload = { ...updates };

      // Map camelCase to snake_case for profilePicture
      if (payload.profilePicture) {
        let pic = payload.profilePicture;
        if (typeof pic === 'string' && pic.startsWith('data:image')) {
          pic = pic.split(',')[1];
        }
        payload.profile_picture = pic;
        delete payload.profilePicture;
      }
      
      if (payload.profile_picture && typeof payload.profile_picture === 'string' && payload.profile_picture.startsWith('data:image')) {
        payload.profile_picture = payload.profile_picture.split(',')[1];
      }
      
      console.log(`[DatabaseConnection] updateUser called for user ${userId} with payload:`, payload);
      
      // Try to parse userId as integer if it's a string number
      let finalUserId = userId;
      if (typeof userId === 'string' && !isNaN(Number(userId))) {
        finalUserId = Number(userId);
      }

      // console.log(`[API Client] Updating user ${finalUserId} with payload:`, payload);
      console.log(`[API Client] Updating user ${finalUserId} with payload:`, payload);

      const response = await fetch(`${API_URL}/users/${finalUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (!response.ok) throw new Error(text || `Error ${response.status}`);
        data = { message: text };
      }

      if (!response.ok) throw new Error(data.error || data.message || `Failed to update user: ${response.status}`);
      return data;
    } catch (error) {
      console.error('[API Client] Error updating user:', error);
      throw error;
    }
  }

  static async rejectUser(userId: number | string) {
    return this.updateUser(userId, { is_active: false });
  }

  static async resetUserPassword(userId: number | string) {
    console.log(`[DatabaseConnection] Resetting password for user ${userId}`);
    return this.updateUser(userId, { password: 'password' });
  }

  static async createEmergence(emergenceData: { distance_to_sea_s: number | null, gps_lat: number | null, gps_long: number | null, event_date: string, beach: string | null }) {
    // console.log(`[API Client] Sending emergence creation request to ${API_URL}/emergences`);

    try {
      const response = await fetch(`${API_URL}/emergences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emergenceData),
      });

      const data = await response.json();
      // console.log('[API Client] Create Emergence Response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Failed to create emergence record: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating emergence:', error);
      throw error;
    }
  }

  static async changePassword(email: string, currentPass: string, newPass: string) {
    // console.log(`[API Client] Sending password change request to ${API_URL}/users/change-password`);
    
    try {
      const response = await fetch(`${API_URL}/users/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          current_password: currentPass,
          new_password: newPass
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to change password');
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error changing password:', error);
      throw error;
    }
  }

  static async createTimetableEntry(userId: number | string, shiftId: number | string, workDate: string) {
    // console.log(`[API Client] Creating timetable entry at ${API_URL}/timetable/create`);
    try {
      const response = await fetch(`${API_URL}/timetable/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          shift_id: shiftId,
          work_date: workDate
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create timetable entry');
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error creating timetable entry:', error);
      throw error;
    }
  }

  static async removeTimetableEntry(userId: number | string, shiftId: number | string, workDate: string) {
    // console.log(`[API Client] Removing timetable entry at ${API_URL}/timetable/remove`);
    try {
      const response = await fetch(`${API_URL}/timetable/remove`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          shift_id: shiftId,
          work_date: workDate
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove timetable entry');
      }

      return data;
    } catch (error) {
      console.error('[API Client] Error removing timetable entry:', error);
      throw error;
    }
  }

  static async getWeeklyTimetable(mondayDate: string) {
    // console.log(`[API Client] Fetching weekly timetable for ${mondayDate} from ${API_URL}/timetable/week`);
    try {
      const response = await fetch(`${API_URL}/timetable/week?monday_date=${mondayDate}&_t=${new Date().getTime()}`);
      const data = await response.json();
      // console.log('[API Client] Weekly Timetable Response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch weekly timetable');
      }

      return data.schedule || [];
    } catch (error) {
      console.error("[API Client] Error fetching weekly timetable:", error);
      return [];
    }
  }

  static async getShifts() {
    // console.log(`[API Client] Fetching shifts from ${API_URL}/shifts`);
    try {
      const response = await fetch(`${API_URL}/shifts`);
      const data = await response.json();
      // console.log('[API Client] Shifts Response:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch shifts');
      }

      // Handle both { shifts: [...] } and [...] formats
      let shiftList = [];
      if (Array.isArray(data)) shiftList = data;
      else if (data.shifts && Array.isArray(data.shifts)) shiftList = data.shifts;
      else if (data.data && Array.isArray(data.data)) shiftList = data.data;
      
      return shiftList;
    } catch (error) {
      console.error("[API Client] Error fetching shifts:", error);
      return [];
    }
  }

  static async getBeaches(): Promise<Beach[]> {
    try {
      const response = await fetch(`${API_URL}/beaches`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch beaches');
      }

      return data.beaches || [];
    } catch (error) {
      console.error("[API Client] Error fetching beaches:", error);
      return [];
    }
  }
}
