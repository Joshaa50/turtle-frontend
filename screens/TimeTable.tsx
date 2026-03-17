
import React, { useState, useEffect } from 'react';
import { TimetableShift, User } from '../types';
import { DatabaseConnection, ShiftData } from '../services/Database';
import { 
  Plus, 
  Sparkles, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  RefreshCw, 
  Edit, 
  Trash, 
  X, 
  Search, 
  UserPlus, 
  AlertTriangle 
} from 'lucide-react';

interface TimeTableProps {
  user: User;
  theme: 'light' | 'dark';
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const SHIFTS = ['Morning', 'Afternoon', 'All Day'] as const;

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const TimeTable: React.FC<TimeTableProps> = ({ user, theme }) => {
  const [schedule, setSchedule] = useState<TimetableShift[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<ShiftData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedAutoAssignVolunteers, setSelectedAutoAssignVolunteers] = useState<string[]>([]);
  const [shiftRequests, setShiftRequests] = useState<{volunteerEmail: string, day: string, shiftType: string, task: string}[]>([]);
  const [teamingRequests, setTeamingRequests] = useState<{volunteer1Email: string, volunteer2Email: string}[]>([]);
  const [newShiftRequest, setNewShiftRequest] = useState({ volunteerEmail: '', day: 'Monday', shiftType: 'Morning', task: '' });
  const [newTeamingRequest, setNewTeamingRequest] = useState({ volunteer1Email: '', volunteer2Email: '' });
  const [volunteers, setVolunteers] = useState<{name: string, email: string, id?: number | string, role?: string, station?: string}[]>([]);
  const [volunteerSearch, setVolunteerSearch] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [newShift, setNewShift] = useState<{
    day: TimetableShift['day'];
    shiftType: TimetableShift['shiftType'];
    task: string;
    date: string;
    selectedVolunteerEmails: string[];
  }>({
    day: 'Monday',
    shiftType: 'Morning',
    task: '',
    date: new Date().toISOString().split('T')[0],
    selectedVolunteerEmails: []
  });

  const isFieldLeader = user?.role?.toLowerCase() === 'field leader' || user?.role?.toLowerCase().includes('coordinator') || user?.role?.toLowerCase() === 'admin';

  const loadData = async () => {
    setIsLoading(true);
    const mondayStr = currentWeekStart.toISOString().split('T')[0];
    // console.log(`[TimeTable] Loading data for week starting ${mondayStr}...`);
    
    try {
      // 1. Fetch task templates from /shifts
      const dbShifts: ShiftData[] = await DatabaseConnection.getShifts();
      // console.log("[TimeTable] Fetched shifts:", dbShifts);
      setTaskTemplates(dbShifts);

      // 2. Fetch volunteers
      const users = await DatabaseConnection.getUsers();
      // console.log("[TimeTable] Fetched users:", users);
      
      const mappedVolunteers = users.map((u: any) => {
        const firstName = u.first_name || u.firstName || u.first || '';
        const lastName = u.last_name || u.lastName || u.last || '';
        const email = u.email || u.user_email || u.Email || '';
        const name = u.name || u.full_name || ((firstName || lastName) ? `${firstName} ${lastName}`.trim() : email);
        const id = u.id || u.user_id || u.ID || u.User_ID || u.uid;
        const role = u.role || u.Role || '';
        const station = u.station || u.Station || '';
        return { name, email, id, role, station };
      }).filter(v => v.email);
      
      setVolunteers(mappedVolunteers);

      // 3. Fetch weekly timetable from backend
      const weeklySchedule = await DatabaseConnection.getWeeklyTimetable(mondayStr);
      // console.log("[TimeTable] Raw Weekly Schedule:", weeklySchedule);
      
      // Group assignments by (date, shift_name, shift_type)
      const groupedMap = new Map<string, TimetableShift>();
      
      weeklySchedule.forEach((a: any) => {
        const date = a.work_date.split('T')[0];
        const key = `${date}-${a.shift_name}-${a.shift_type}`;
        
        if (!groupedMap.has(key)) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const day = dayNames[new Date(date).getDay()] as any;
          
          // Try to get shift_id from response first, then fallback to template matching
          let shiftId = a.shift_id;
          if (!shiftId) {
             const shiftTemplate = dbShifts.find(s => s.shift_name === a.shift_name && s.shift_type === a.shift_type);
             shiftId = shiftTemplate?.shift_id || (shiftTemplate as any)?.id;
          }

          groupedMap.set(key, {
            id: a.assignment_id.toString(),
            shift_id: shiftId,
            volunteers: [],
            day: day,
            shiftType: a.shift_type as any,
            task: a.shift_name,
            date: date
          });
        }
        
        const fullName = `${a.first_name} ${a.last_name}`.trim();
        // Try to get user_id from response first, then fallback to name matching
        let userId = a.user_id;
        let email = '';
        
        if (!userId) {
            const volunteerMatch = mappedVolunteers.find(v => v.name === fullName);
            userId = volunteerMatch?.id;
            email = volunteerMatch?.email || '';
        } else {
            // If we have user_id, try to find email from mappedVolunteers
            const volunteerMatch = mappedVolunteers.find(v => v.id === userId);
            email = volunteerMatch?.email || '';
        }
        
        groupedMap.get(key)!.volunteers.push({
          name: fullName,
          email: email,
          id: userId
        });
      });
      
      const backendSchedule = Array.from(groupedMap.values());
      
      // Update local storage with latest backend data to keep them in sync
      // This prevents "zombie shifts" from reappearing if the backend is empty
      localStorage.setItem('turtle_timetable', JSON.stringify(backendSchedule));
      
      setSchedule(backendSchedule);

    } catch (err) {
      console.error("[TimeTable] Failed to load timetable data:", err);
      // Fallback to local storage ONLY on error (e.g. offline)
      const savedSchedule = localStorage.getItem('turtle_timetable');
      if (savedSchedule) {
        console.log("[TimeTable] Loaded fallback data from local storage");
        setSchedule(JSON.parse(savedSchedule));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  // Get unique tasks filtered by shift type with robust matching and fallbacks
  const filteredTasks = React.useMemo(() => {
    const uniqueTasks = new Set<string>();
    
    // 1. Try to get tasks from DB templates that match the shift type
    taskTemplates.forEach(s => {
      const dbType = String(s.shift_type || '').trim().toLowerCase();
      const selectedType = newShift.shiftType?.toLowerCase();
      
      // Flexible matching: check if it matches "Morning", "1", or contains the word
      const isMatch = dbType === selectedType || 
                      (selectedType === 'morning' && (dbType === '1' || dbType.includes('morning'))) ||
                      (selectedType === 'afternoon' && (dbType === '2' || dbType.includes('afternoon')));

      if (isMatch && (s.shift_name || (s as any).name)) {
        uniqueTasks.add(s.shift_name || (s as any).name);
      }
    });
    
    // 2. Fallback: If no tasks match the type but we have DB templates, show all DB tasks
    if (uniqueTasks.size === 0 && taskTemplates.length > 0) {
      taskTemplates.forEach(s => {
        if (s.shift_name || (s as any).name) uniqueTasks.add(s.shift_name || (s as any).name);
      });
    }

    // 3. Fallback: If still no tasks (DB empty or no names), provide sensible defaults
    if (uniqueTasks.size === 0) {
      if (newShift.shiftType === 'Morning') {
        ['Team A - Beach Patrol', 'Team B - Beach Patrol', 'Team C - Beach Patrol', 'Morning Survey', 'Nest Excavation'].forEach(t => uniqueTasks.add(t));
      } else {
        ['Nest Relocation', 'Hatchling Release', 'Public Education', 'Data Entry', 'Equipment Maintenance'].forEach(t => uniqueTasks.add(t));
      }
    }

    return Array.from(uniqueTasks).sort();
  }, [taskTemplates, newShift.shiftType]);

  const eligibleVolunteers = React.useMemo(() => {
    let list = volunteers;
    
    // Find the current user's record in the fetched list to get their most up-to-date station/role
    const currentUserRecord = volunteers.find(v => v.email.toLowerCase() === user?.email?.toLowerCase());
    
    const roleLower = (currentUserRecord?.role || user?.role || '').toLowerCase().trim();
    const currentStation = (currentUserRecord?.station || user?.station || '').toLowerCase().trim();
    
    // Check if user is specifically a Field Leader
    if (roleLower === 'field leader') {
      list = list.filter(v => {
        const uRole = (v.role || '').toLowerCase().trim();
        const uStation = (v.station || '').toLowerCase().trim();
        
        // Match "Field Volunteer", "Volunteer", "Field Assistant", "Assistant"
        const isVolunteer = uRole.includes('volunteer');
        const isAssistant = uRole.includes('assistant');
        const isSameStation = uStation === currentStation;
        
        return (isVolunteer || isAssistant) && isSameStation;
      });
    }
    return list;
  }, [volunteers, user]);

  const filteredVolunteers = React.useMemo(() => {
    if (!volunteerSearch.trim()) return eligibleVolunteers;
    const query = volunteerSearch.toLowerCase();
    return eligibleVolunteers.filter(v => 
      v.name.toLowerCase().includes(query) || 
      v.email.toLowerCase().includes(query)
    );
  }, [eligibleVolunteers, volunteerSearch]);

  const saveSchedule = (updatedSchedule: TimetableShift[]) => {
    setSchedule(updatedSchedule);
    localStorage.setItem('turtle_timetable', JSON.stringify(updatedSchedule));
  };

  const handleAddShift = async () => {
    if (newShift.selectedVolunteerEmails.length === 0 || !newShift.task || !newShift.date) {
      alert("Please select at least one volunteer and fill in all fields");
      return;
    }

    const assignedVolunteers = volunteers.filter(v => newShift.selectedVolunteerEmails.includes(v.email));
    
    // Check for conflicts (skip conflict check if editing the same shift)
    const busyVolunteers = assignedVolunteers.filter(v => {
        return schedule.some(s => 
            s.id !== editingShiftId && // Ignore the shift being edited
            s.date === newShift.date && 
            s.shiftType === newShift.shiftType && 
            s.task !== newShift.task && 
            s.volunteers.some(vol => vol.email === v.email)
        );
    });

    if (busyVolunteers.length > 0) {
        alert(`Cannot add shift. The following volunteers are already busy at this time:\n${busyVolunteers.map(v => v.name).join(', ')}`);
        return;
    }

    setIsLoading(true);
    // console.log("[TimeTable] Attempting to save shift to backend...");
    try {
      // assignedVolunteers is already defined above
      const selectedTaskTemplate = taskTemplates.find(t => t.shift_name === newShift.task || (t as any).name === newShift.task);
      const shiftId = selectedTaskTemplate?.shift_id || (selectedTaskTemplate as any).id || (selectedTaskTemplate as any).ID;
      const workDate = newShift.date;

      if (!shiftId) {
        console.warn("[TimeTable] No valid shift_id found for task:", newShift.task);
        // We still save locally, but we skip backend if no shift_id
      }

      if (isEditing && editingShiftId) {
        // --- EDIT MODE ---
        const originalShift = schedule.find(s => s.id === editingShiftId);
        if (originalShift) {
            const originalEmails = new Set(originalShift.volunteers.map(v => v.email));
            const newEmails = new Set(newShift.selectedVolunteerEmails);
            
            const taskChanged = originalShift.task !== newShift.task;
            const oldShiftId = originalShift.shift_id;

            if (taskChanged) {
                // If task changed, we remove ALL volunteers from the old shift
                // and add ALL selected volunteers to the new shift
                
                // 1. Remove everyone from old shift
                for (const v of originalShift.volunteers) {
                    if (v.id && oldShiftId) {
                        try {
                            // console.log(`[TimeTable] Removing ${v.name} from old shift ${oldShiftId}`);
                            await DatabaseConnection.removeTimetableEntry(v.id, oldShiftId, workDate);
                        } catch (e) { console.error(`Failed to remove ${v.name} from old shift:`, e); }
                    }
                }

                // 2. Add everyone to new shift
                for (const volunteer of assignedVolunteers) {
                    if (volunteer.id && shiftId) {
                        try {
                            // console.log(`[TimeTable] Adding ${volunteer.name} to new shift ${shiftId}`);
                            await DatabaseConnection.createTimetableEntry(volunteer.id, shiftId, workDate);
                        } catch (e) { console.error(`Failed to add ${volunteer.name} to new shift:`, e); }
                    }
                }

            } else {
                // Task is the same, just diffing volunteers
                // Use the oldShiftId for removal to be safe (it should match shiftId, but if templates changed, this is safer)
                const effectiveRemoveShiftId = oldShiftId || shiftId;

                // 1. Identify volunteers to ADD
                const volunteersToAdd = assignedVolunteers.filter(v => !originalEmails.has(v.email));
                
                // 2. Identify volunteers to REMOVE
                const volunteersToRemove = originalShift.volunteers.filter(v => !newEmails.has(v.email));

                // Process Additions
                for (const v of volunteersToAdd) {
                    if (v.id && shiftId) {
                        try {
                            // console.log(`[TimeTable] Adding ${v.name} to shift ${shiftId}`);
                            await DatabaseConnection.createTimetableEntry(v.id, shiftId, workDate);
                        } catch (e) { console.error(`Failed to add ${v.name}:`, e); }
                    }
                }

                // Process Removals
                for (const v of volunteersToRemove) {
                    if (v.id && effectiveRemoveShiftId) {
                        try {
                            // console.log(`[TimeTable] Removing ${v.name} from shift ${effectiveRemoveShiftId}`);
                            await DatabaseConnection.removeTimetableEntry(v.id, effectiveRemoveShiftId, workDate);
                        } catch (e) { console.error(`Failed to remove ${v.name}:`, e); }
                    } else {
                        console.warn(`[TimeTable] Cannot remove ${v.name}: Missing ID (${v.id}) or ShiftID (${effectiveRemoveShiftId})`);
                    }
                }
            }
        }
      } else {
        // --- CREATE MODE ---
        // Create entries in backend for each volunteer
        for (const volunteer of assignedVolunteers) {
            // console.log(`[TimeTable] Processing volunteer: ${volunteer.name} (ID: ${volunteer.id})`);
            if (volunteer.id && shiftId) {
            try {
                // console.log(`[TimeTable] Calling createTimetableEntry for User ${volunteer.id}, Shift ${shiftId}, Date ${workDate}`);
                await DatabaseConnection.createTimetableEntry(volunteer.id, shiftId, workDate);
                // console.log(`[TimeTable] Successfully saved shift for ${volunteer.name}`);
            } catch (apiErr: any) {
                console.error(`[TimeTable] Failed to save shift for ${volunteer.name} to backend:`, apiErr);
                // We continue with other volunteers even if one fails
            }
            } else {
            console.warn(`[TimeTable] Skipping backend save for ${volunteer.name} due to missing ID or Shift ID. UserID: ${volunteer.id}, ShiftID: ${shiftId}`);
            }
        }
      }

      // Refresh data from backend to ensure everything is in sync and grouped correctly
      await loadData();

      setShowAddModal(false);
      setIsEditing(false);
      setEditingShiftId(null);
      setVolunteerSearch('');
      setNewShift({ ...newShift, task: '', selectedVolunteerEmails: [] });
    } catch (err) {
      console.error("[TimeTable] Error saving shift to backend:", err);
      alert("Failed to save shift to database. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    if (selectedAutoAssignVolunteers.length === 0) {
      alert("Please select at least one volunteer.");
      return;
    }

    setIsLoading(true);
    // console.log("[TimeTable] Starting auto-assignment with specific rules...");

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }

    // 1. Identify specific shifts
    const morningSurveyShifts = taskTemplates.filter(t => 
        (t.shift_type === 'Morning' || t.shift_type === '1') && 
        (t.shift_name.toLowerCase().includes('survey') || t.shift_name.toLowerCase().includes('patrol'))
    );
    
    const sandSiftingShift = taskTemplates.find(t => t.shift_name.toLowerCase().includes('sifting'));
    const beachProfileShift = taskTemplates.find(t => t.shift_name.toLowerCase().includes('profile'));
    const beachCleanShift = taskTemplates.find(t => t.shift_name.toLowerCase().includes('clean'));

    // Fallback for morning if no specific survey/patrol found
    const morningShiftsToUse = morningSurveyShifts.length > 0 
        ? morningSurveyShifts 
        : taskTemplates.filter(t => t.shift_type === 'Morning' || t.shift_type === '1');

    if (morningShiftsToUse.length === 0) {
        alert("No morning shifts found. Please create 'Morning Survey' or 'Beach Patrol' shifts.");
        setIsLoading(false);
        return;
    }

    // Check for afternoon requirements
    const missingAfternoonTasks = [];
    if (!sandSiftingShift) missingAfternoonTasks.push("Sand Sifting");
    if (!beachProfileShift) missingAfternoonTasks.push("Beach Profile");
    // Beach clean is optional "any number", but we need it to assign the rest
    if (!beachCleanShift) missingAfternoonTasks.push("Beach Clean");

    if (missingAfternoonTasks.length > 0) {
        const proceed = window.confirm(`Warning: Could not find the following afternoon shifts: ${missingAfternoonTasks.join(', ')}. \n\nVolunteers may not be assigned to these specific tasks. Do you want to proceed anyway?`);
        if (!proceed) {
            setIsLoading(false);
            return;
        }
    }

    // 2. Assign days off per volunteer
    const volunteerDaysOff = new Map<string, Set<number>>(); // email -> Set of day indices (0-6)
    const volunteerAfternoonCounts = new Map<string, number>(); // email -> count of afternoon shifts
    
    // Pre-process teaming requests to ensure pairs have same days off if possible (simplified: just random for now, but we'll try to keep them together in shifts)
    
    for (const email of selectedAutoAssignVolunteers) {
        const daysOff = new Set<number>();
        
        // Check if any specific shift requests fall on a day off - if so, don't make it a day off!
        // Also, if they requested "Day Off" (All Day), force that day to be a day off.
        const requestedDaysIndices = shiftRequests
            .filter(req => req.volunteerEmail === email && req.task !== 'Day Off')
            .map(req => DAYS.indexOf(req.day as any));
            
        const requestedDaysOffIndices = shiftRequests
            .filter(req => req.volunteerEmail === email && req.task === 'Day Off')
            .map(req => DAYS.indexOf(req.day as any));

        // Add requested days off first
        requestedDaysOffIndices.forEach(idx => {
            if (idx !== -1) daysOff.add(idx);
        });
            
        while (daysOff.size < 2) {
            const randomDay = Math.floor(Math.random() * 7);
            if (!requestedDaysIndices.includes(randomDay) && !daysOff.has(randomDay)) {
                daysOff.add(randomDay);
            }
        }
        volunteerDaysOff.set(email, daysOff);
        volunteerAfternoonCounts.set(email, 0);
    }

    let successCount = 0;

    // 3. Process each day
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const workDate = weekDates[dayIndex];
        const dayName = DAYS[dayIndex];
        
        // Get volunteers working today
        const workingVolunteers = selectedAutoAssignVolunteers
            .filter(email => !volunteerDaysOff.get(email)?.has(dayIndex))
            .map(email => volunteers.find(v => v.email === email))
            .filter((v): v is typeof volunteers[0] => !!v && !!v.id);

        if (workingVolunteers.length === 0) continue;

        // --- Handle Specific Shift Requests First ---
        const volunteersWithMorningRequest = new Set<string>();
        const volunteersWithAfternoonRequest = new Set<string>();

        // Process requests for this day
        const todaysRequests = shiftRequests.filter(req => req.day === dayName);
        
        for (const req of todaysRequests) {
            const volunteer = volunteers.find(v => v.email === req.volunteerEmail);
            if (!volunteer || !volunteer.id) continue;

            // Find the shift template
            const shiftTemplate = taskTemplates.find(t => t.shift_name === req.task && (t.shift_type === req.shiftType || t.shift_type === (req.shiftType === 'Morning' ? '1' : '2')));
            
            if (shiftTemplate && shiftTemplate.shift_id) {
                try {
                    await DatabaseConnection.createTimetableEntry(volunteer.id, shiftTemplate.shift_id, workDate);
                    successCount++;
                    if (req.shiftType === 'Morning') volunteersWithMorningRequest.add(req.volunteerEmail);
                    if (req.shiftType === 'Afternoon') {
                        volunteersWithAfternoonRequest.add(req.volunteerEmail);
                        volunteerAfternoonCounts.set(req.volunteerEmail, (volunteerAfternoonCounts.get(req.volunteerEmail) || 0) + 1);
                    }
                } catch (e) { console.error(e); }
            }
        }

        // --- Morning Assignments (Spread evenly) ---
        // Filter out those who already have a morning assignment from requests
        const volunteersForMorning = workingVolunteers.filter(v => !volunteersWithMorningRequest.has(v.email));
        
        // Shuffle but keep teams together
        const shuffledMorningVolunteers = [...volunteersForMorning].sort(() => Math.random() - 0.5);
        
        // Simple teaming logic: if V1 is in list, try to put V2 next to them
        const orderedMorningVolunteers: typeof volunteers = [];
        const processedEmails = new Set<string>();

        for (const v of shuffledMorningVolunteers) {
            if (processedEmails.has(v.email)) continue;
            
            orderedMorningVolunteers.push(v);
            processedEmails.add(v.email);

            // Check for teammate
            const teamReq = teamingRequests.find(r => r.volunteer1Email === v.email || r.volunteer2Email === v.email);
            if (teamReq) {
                const partnerEmail = teamReq.volunteer1Email === v.email ? teamReq.volunteer2Email : teamReq.volunteer1Email;
                const partner = shuffledMorningVolunteers.find(p => p.email === partnerEmail);
                if (partner && !processedEmails.has(partner.email)) {
                    orderedMorningVolunteers.push(partner);
                    processedEmails.add(partner.email);
                }
            }
        }

        for (let i = 0; i < orderedMorningVolunteers.length; i++) {
            const volunteer = orderedMorningVolunteers[i];
            const shiftTemplate = morningShiftsToUse[i % morningShiftsToUse.length];
            
            if (shiftTemplate && shiftTemplate.shift_id) {
                try {
                    await DatabaseConnection.createTimetableEntry(volunteer.id!, shiftTemplate.shift_id, workDate);
                    successCount++;
                } catch (e) {
                    console.error(`[TimeTable] Failed to assign morning shift to ${volunteer.name}:`, e);
                }
            }
        }

        // --- Afternoon Assignments (Specific Counts) ---
        // Filter out those who already have an afternoon assignment from requests
        const volunteersForAfternoon = workingVolunteers.filter(v => !volunteersWithAfternoonRequest.has(v.email));

        // Sort by workload, but try to keep teams together if possible (harder with specific counts)
        // We'll prioritize workload balancing first
        const volunteersByWorkload = [...volunteersForAfternoon].sort((a, b) => {
            const countA = volunteerAfternoonCounts.get(a.email) || 0;
            const countB = volunteerAfternoonCounts.get(b.email) || 0;
            if (countA === countB) return Math.random() - 0.5;
            return countA - countB;
        });

        let assignedIndex = 0;

        // Helper to assign next N volunteers to a shift
        const assignToShift = async (shiftTemplate: any, count: number) => {
            if (!shiftTemplate || !shiftTemplate.shift_id) return;
            
            let assignedCount = 0;
            while (assignedCount < count && assignedIndex < volunteersByWorkload.length) {
                const volunteer = volunteersByWorkload[assignedIndex];
                
                // Check if this volunteer has a teammate we should try to pull in
                const teamReq = teamingRequests.find(r => r.volunteer1Email === volunteer.email || r.volunteer2Email === volunteer.email);
                let partner = null;
                
                if (teamReq) {
                    const partnerEmail = teamReq.volunteer1Email === volunteer.email ? teamReq.volunteer2Email : teamReq.volunteer1Email;
                    // Find partner in the REMAINING unassigned list
                    const partnerIndex = volunteersByWorkload.findIndex((v, idx) => idx > assignedIndex && v.email === partnerEmail);
                    if (partnerIndex !== -1) {
                        partner = volunteersByWorkload[partnerIndex];
                        // Remove partner from their current spot so we can process them now
                        volunteersByWorkload.splice(partnerIndex, 1);
                        // Insert partner right after current volunteer
                        volunteersByWorkload.splice(assignedIndex + 1, 0, partner);
                    }
                }

                // Assign current volunteer
                try {
                    await DatabaseConnection.createTimetableEntry(volunteer.id!, shiftTemplate.shift_id, workDate);
                    successCount++;
                    volunteerAfternoonCounts.set(volunteer.email, (volunteerAfternoonCounts.get(volunteer.email) || 0) + 1);
                    assignedCount++;
                } catch (e) { console.error(e); }
                
                assignedIndex++;

                // If we pulled a partner and still have room, assign them next loop iteration (they are now at assignedIndex)
            }
        };

        // 1. Sand Sifting (3 people)
        await assignToShift(sandSiftingShift, 3);

        // 2. Beach Profile (4 people)
        await assignToShift(beachProfileShift, 4);

        // 3. Beach Clean (Max 5 people)
        await assignToShift(beachCleanShift, 5);
        
        // Remaining volunteers get afternoon off (no assignment created)
    }

    // console.log(`[TimeTable] Auto-assignment complete. Created ${successCount} entries.`);
    await loadData();
    setShowAutoAssignModal(false);
    setSelectedAutoAssignVolunteers([]);
    setIsLoading(false);
  };

  const handleClearWeek = () => {
    // console.log("[TimeTable] Opening Clear Week confirmation modal");
    setShowClearModal(true);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  const handleEditShift = (shiftId: string) => {
    const shiftToEdit = schedule.find(s => s.id === shiftId);
    if (!shiftToEdit) return;

    setNewShift({
      day: shiftToEdit.day,
      shiftType: shiftToEdit.shiftType,
      task: shiftToEdit.task,
      date: shiftToEdit.date,
      selectedVolunteerEmails: shiftToEdit.volunteers.map(v => v.email)
    });
    setEditingShiftId(shiftId);
    setIsEditing(true);
    setShowAddModal(true);
  };

  const executeClearWeek = async () => {
    // console.log("[TimeTable] executeClearWeek triggered");
    try {
        setIsLoading(true);
        // console.log("[TimeTable] Clearing all shifts for the week...");

        // Get all shifts for the current week
        const shiftsToClear = schedule.filter(s => weekDates.includes(s.date));
        
        if (shiftsToClear.length === 0) {
            alert("No shifts found to clear for this week.");
            setIsLoading(false);
            setShowClearModal(false);
            return;
        }

        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;

        for (const shift of shiftsToClear) {
            // Try to resolve shift_id if missing
            let shiftId = shift.shift_id;
            if (!shiftId) {
                 const template = taskTemplates.find(t => t.shift_name === shift.task && (t.shift_type === shift.shiftType || t.shift_type === (shift.shiftType === 'Morning' ? '1' : '2')));
                 shiftId = template?.shift_id || (template as any)?.id;
            }

            if (!shiftId) {
                console.warn(`[TimeTable] Skipping shift "${shift.task}" (ID: ${shift.id}) - could not resolve shift_id`);
                skipCount++;
                continue;
            }

            for (const volunteer of shift.volunteers) {
                // Try to resolve user_id if missing
                let userId = volunteer.id;
                if (!userId) {
                    const user = volunteers.find(v => v.email === volunteer.email || v.name === volunteer.name);
                    userId = user?.id;
                }

                if (!userId) {
                    console.warn(`[TimeTable] Skipping volunteer ${volunteer.name} - could not resolve user ID`);
                    skipCount++;
                    continue;
                }

                try {
                    // Ensure IDs are numbers if possible, though strings usually work
                    const payloadUserId = Number(userId) || userId;
                    const payloadShiftId = Number(shiftId) || shiftId;
                    // Ensure date is YYYY-MM-DD
                    const payloadDate = shift.date.split('T')[0];
                    
                    // console.log(`[TimeTable] Deleting assignment: User ${payloadUserId}, Shift ${payloadShiftId}, Date ${payloadDate}`);
                    await DatabaseConnection.removeTimetableEntry(payloadUserId, payloadShiftId, payloadDate);
                    successCount++;
                } catch (e) {
                    console.error(`[TimeTable] Failed to remove assignment for ${volunteer.name}:`, e);
                    failCount++;
                }
            }
        }

        // console.log(`[TimeTable] Clear week complete. Removed: ${successCount}, Failed: ${failCount}, Skipped: ${skipCount}`);
        
        // Small delay to allow backend to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await loadData();
        setIsLoading(false);
        setShowClearModal(false);
        
        if (successCount > 0) {
            alert(`Weekly schedule cleared. Removed ${successCount} assignments.`);
        } else if (failCount > 0 || skipCount > 0) {
            alert(`Failed to clear schedule. Errors: ${failCount}, Skipped: ${skipCount}. Check console for details.`);
        } else {
            alert("No assignments were found to remove.");
        }
    } catch (err) {
        console.error("[TimeTable] Critical error in executeClearWeek:", err);
        alert("An unexpected error occurred while clearing the week. Check console for details.");
        setIsLoading(false);
        setShowClearModal(false);
    }
  };

  const [shiftToDelete, setShiftToDelete] = useState<TimetableShift | null>(null);

  const handleDeleteShift = (id: string) => {
    const shift = schedule.find(s => s.id === id);
    if (shift) {
      setShiftToDelete(shift);
    } else {
      console.error("[TimeTable] Shift not found for deletion:", id);
    }
  };

  const confirmDeleteShift = async () => {
    if (!shiftToDelete) return;

    setIsLoading(true);
    try {
        // If it has shift_id and volunteers with IDs, try to remove from backend
        if (shiftToDelete.shift_id && shiftToDelete.volunteers.length > 0) {
          let successCount = 0;
          for (const volunteer of shiftToDelete.volunteers) {
            // Try to resolve user_id if missing
            let userId = volunteer.id;
            if (!userId) {
                const user = volunteers.find(v => v.email === volunteer.email || v.name === volunteer.name);
                userId = user?.id;
            }

            if (userId) {
              try {
                  const payloadUserId = Number(userId) || userId;
                  const payloadShiftId = Number(shiftToDelete.shift_id) || shiftToDelete.shift_id;
                  const payloadDate = shiftToDelete.date.split('T')[0];

                  await DatabaseConnection.removeTimetableEntry(payloadUserId, payloadShiftId, payloadDate);
                  successCount++;
              } catch (e) {
                  console.error(`[TimeTable] Failed to remove assignment for ${volunteer.name}:`, e);
              }
            }
          }
        }

        // Update local state
        const updatedSchedule = schedule.filter(s => s.id !== shiftToDelete.id);
        saveSchedule(updatedSchedule);
        
        // Small delay to allow backend to process
        await new Promise(resolve => setTimeout(resolve, 500));

        // Refresh data to ensure sync with backend
        await loadData();
    } catch (err) {
        console.error("[TimeTable] Error deleting shift:", err);
        alert("Failed to delete shift. Please try again.");
    } finally {
        setIsLoading(false);
        setShiftToDelete(null);
    }
  };

  const goToPreviousWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const formatWeekRange = () => {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}, ${start.getFullYear()}`;
  };

  const weekDates = React.useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [currentWeekStart]);

  const getDayDate = (dayName: string) => {
    const index = DAYS.indexOf(dayName as any);
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + index);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Filter schedule: Volunteers only see their own, Field Leaders see all, and filter by current week
  const displayedSchedule = isFieldLeader 
    ? schedule.filter(s => weekDates.includes(s.date))
    : schedule.filter(s => 
        s.volunteers?.some(v => v.email.toLowerCase() === (user?.email?.toLowerCase() || '')) &&
        weekDates.includes(s.date)
      );

  return (
    <div className={`flex flex-col min-h-full relative ${theme === 'dark' ? 'bg-background-dark' : 'bg-background-light'}`}>
      <header className={`sticky top-0 z-10 backdrop-blur-md border-b px-8 h-16 flex items-center justify-between transition-all duration-300 ${
        theme === 'dark' ? 'bg-background-dark/80 border-[#283039]' : 'bg-white/80 border-slate-200'
      }`}>
        <div className="flex items-center gap-4 z-20">
          <div className="w-10 flex-shrink-0">
            {/* Left spacer for menu button */}
          </div>
        </div>
        
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <h2 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {isFieldLeader ? 'Team Timetable' : 'My Schedule'}
          </h2>
        </div>
      </header>

      <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row items-center justify-end gap-6">
          {/* Right side: Actions and Week navigation */}
          <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
            {isFieldLeader && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
                >
                  <Plus className="size-4" />
                  Add Shift
                </button>
                <button 
                  onClick={() => setShowAutoAssignModal(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-500' : 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-700'}`}
                >
                  <Sparkles className="size-4" />
                  Auto Assign
                </button>
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1"></div>
                <button 
                  onClick={handleClearWeek}
                  className={`p-2 rounded-xl transition-all flex items-center justify-center ${theme === 'dark' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-500 hover:bg-rose-50'}`}
                  title="Clear all shifts for this week"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
            )}
            
            <div className={`flex items-center gap-1 p-1.5 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <button 
                onClick={() => setCurrentWeekStart(getMonday(new Date()))}
                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-200 text-slate-900'}`}
              >
                Today
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-1"></div>
              <button 
                onClick={goToPreviousWeek}
                className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-200 text-slate-900'}`}
                title="Previous Week"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="relative flex items-center group">
                <input 
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value);
                    if (!isNaN(selectedDate.getTime())) {
                      setCurrentWeekStart(getMonday(selectedDate));
                    }
                  }}
                />
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 group-hover:text-primary transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {formatWeekRange()}
                </span>
                <Calendar className="size-3 text-slate-400 group-hover:text-primary transition-colors" />
              </div>
              <button 
                onClick={goToNextWeek}
                className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-200 text-slate-900'}`}
                title="Next Week"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-1"></div>
              <button 
                onClick={loadData}
                disabled={isLoading}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-200 text-slate-900'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Refresh Schedule"
              >
                <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="size-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Fetching Team Schedule...</p>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-3xl border ${theme === 'dark' ? 'bg-[#111418] border-[#283039]' : 'bg-white border-slate-200'} shadow-2xl`}>
          <table className="w-full border-collapse">
            <thead>
              <tr className={theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}>
                <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-white/10">Day</th>
                {['Morning', 'Afternoon'].map(shift => (
                  <th key={shift} className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-white/10">
                    {shift}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className={`border-b ${theme === 'dark' ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-100 hover:bg-slate-50'} transition-colors`}>
                  <td className="p-4 align-top">
                    <div className="flex flex-col">
                      <span className={`text-sm font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{day}</span>
                      <span className="text-[10px] font-bold text-slate-500">{getDayDate(day)}</span>
                    </div>
                  </td>
                  {['Morning', 'Afternoon'].map(shiftType => {
                    // Filter shifts: include specific shift type OR 'All Day' shifts
                    const dayShifts = displayedSchedule.filter(s => 
                        s.day === day && (s.shiftType === shiftType || s.shiftType === 'All Day')
                    );
                    return (
                      <td key={shiftType} className="p-4 align-top min-w-[250px]">
                        <div className="space-y-3">
                          {dayShifts.map(s => (
                            <div 
                              key={s.id} 
                              className={`p-3 rounded-xl border relative group transition-all ${
                                theme === 'dark' 
                                  ? 'bg-slate-900/50 border-white/10 hover:border-primary/50' 
                                  : 'bg-slate-50 border-slate-200 hover:border-primary/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500`}>
                                      {s.shiftType === 'All Day' ? 'All Day' : s.date}
                                    </span>
                                  </div>
                                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme === 'dark' ? 'text-primary' : 'text-primary'}`}>
                                    {s.task}
                                  </p>
                                  <div className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                    {s.volunteers && s.volunteers.length > 0 ? (
                                        s.volunteers.map((v, i) => (
                                            <span key={i} className={`block ${i === 0 ? 'text-rose-500' : ''}`}>
                                                {v.name}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-slate-400 italic">No volunteers assigned</span>
                                    )}
                                  </div>
                                </div>
                                {isFieldLeader && (
                                  <div className="flex flex-col gap-1">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditShift(s.id);
                                      }}
                                      className="p-1.5 text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                                      title="Edit Shift"
                                    >
                                      <Edit className="size-4" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteShift(s.id);
                                      }}
                                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                      title="Delete Shift"
                                    >
                                      <Trash className="size-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {dayShifts.length === 0 && (
                            <div className="h-12 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-center">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">No Assignments</span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      )}

      {/* Add Shift Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingShiftId(null); setVolunteerSearch(''); }}></div>
          <div className={`relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-[#1a232e] border border-white/10' : 'bg-white border border-slate-200'}`}>
            <header className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className={`text-lg font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{isEditing ? 'Edit Shift' : 'Add New Shift'}</h3>
                <button 
                  onClick={loadData}
                  className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                  title="Reload Data"
                >
                  <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <button onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingShiftId(null); setVolunteerSearch(''); }} className="text-slate-500 hover:text-rose-500 transition-colors">
                <X className="size-5" />
              </button>
            </header>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assign Volunteers</label>
                  <span className="text-[10px] font-bold text-primary">{newShift.selectedVolunteerEmails.length} Selected</span>
                </div>
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                  <input 
                    type="text"
                    placeholder="Search volunteers..."
                    className={`w-full h-10 pl-9 pr-4 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-xs ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    value={volunteerSearch}
                    onChange={(e) => setVolunteerSearch(e.target.value)}
                  />
                </div>

                <div className={`grid grid-cols-1 gap-2 p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-slate-50 border-slate-200'} max-h-40 overflow-y-auto`}>
                  {filteredVolunteers.map(v => {
                    const busyShift = schedule.find(s => 
                      s.date === newShift.date && 
                      s.shiftType === newShift.shiftType && 
                      s.volunteers.some(vol => vol.email === v.email) &&
                      s.id !== editingShiftId // Ignore the shift currently being edited
                    );
                    const isBusy = !!busyShift;
                    const isSameTask = busyShift?.task === newShift.task;
                    const isCurrentlySelected = newShift.selectedVolunteerEmails.includes(v.email);

                    return (
                    <label key={v.email} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isBusy ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                      <input 
                        type="checkbox"
                        className="size-4 rounded border-slate-300 text-primary focus:ring-primary disabled:opacity-50"
                        checked={isCurrentlySelected}
                        disabled={isBusy}
                        onChange={(e) => {
                          if (isBusy) return;
                          const emails = e.target.checked 
                            ? [...newShift.selectedVolunteerEmails, v.email]
                            : newShift.selectedVolunteerEmails.filter(email => email !== v.email);
                          setNewShift({...newShift, selectedVolunteerEmails: emails});
                        }}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{v.name}</span>
                            {isBusy && (
                                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isSameTask ? 'text-blue-500 bg-blue-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
                                    {isSameTask ? 'Joined' : 'Busy'}
                                </span>
                            )}
                            {isCurrentlySelected && !isBusy && (
                                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded text-blue-500 bg-blue-500/10`}>
                                    Selected
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-500">{v.email}</span>
                        {isBusy && !isSameTask && (
                            <span className="text-[9px] text-slate-400 truncate">
                                Assigned to: {busyShift?.task}
                            </span>
                        )}
                      </div>
                    </label>
                  )})}
                  {filteredVolunteers.length === 0 && volunteers.length > 0 && (
                    <p className="text-[9px] text-slate-500 font-bold uppercase text-center py-2">No matching volunteers</p>
                  )}
                  {volunteers.length === 0 && (
                    <p className="text-[9px] text-rose-500 font-bold uppercase">No volunteers found in database</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date</label>
                  <input 
                    type="date"
                    className={`w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    value={newShift.date}
                    onChange={(e) => {
                      const date = e.target.value;
                      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const day = dayNames[new Date(date).getDay()] as any;
                      setNewShift({...newShift, date, day});
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shift</label>
                  <select 
                    className={`w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm select-nice cursor-pointer shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    value={newShift.shiftType}
                    onChange={(e) => setNewShift({...newShift, shiftType: e.target.value as any, task: ''})}
                  >
                    {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Task</label>
                <select 
                  className={`w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm select-nice cursor-pointer shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  value={newShift.task || ''}
                  onChange={(e) => {
                    const task = e.target.value;
                    setNewShift({...newShift, task});
                  }}
                >
                  <option value="">Select Task</option>
                  {filteredTasks.map(task => (
                    <option key={task} value={task}>{task}</option>
                  ))}
                </select>
                {taskTemplates.length === 0 && (
                  <p className="text-[9px] text-rose-500 font-bold uppercase mt-1">No shifts found in database</p>
                )}
                {taskTemplates.length > 0 && filteredTasks.length === 0 && (
                  <p className="text-[9px] text-amber-500 font-bold uppercase mt-1">No tasks match {newShift.shiftType} shift</p>
                )}
              </div>

              <button 
                onClick={handleAddShift}
                className="w-full py-4 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all mt-4"
              >
                {isEditing ? 'Save Changes' : 'Confirm Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Assign Modal */}
      {showAutoAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setShowAutoAssignModal(false); setSelectedAutoAssignVolunteers([]); }}></div>
          <div className={`relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-[#1a232e] border border-white/10' : 'bg-white border border-slate-200'}`}>
            <header className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className={`text-lg font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Auto-Assign Shifts</h3>
              </div>
              <button onClick={() => { setShowAutoAssignModal(false); setSelectedAutoAssignVolunteers([]); }} className="text-slate-500 hover:text-rose-500 transition-colors">
                <X className="size-5" />
              </button>
            </header>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-slate-500 font-bold">
                Select volunteers to automatically assign for the week of <span className="text-primary">{formatWeekRange()}</span>. 
                Each volunteer will be assigned 5 shifts with 2 random days off.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Volunteers</label>
                  <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setSelectedAutoAssignVolunteers(eligibleVolunteers.map(v => v.email))}
                        className="text-[10px] font-bold text-primary hover:underline"
                    >
                        Select All
                    </button>
                    <span className="text-[10px] text-slate-300">|</span>
                    <button 
                        onClick={() => setSelectedAutoAssignVolunteers([])}
                        className="text-[10px] font-bold text-slate-500 hover:underline"
                    >
                        Clear
                    </button>
                  </div>
                </div>
                
                <div className={`grid grid-cols-1 gap-2 p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-slate-50 border-slate-200'} max-h-60 overflow-y-auto`}>
                  {eligibleVolunteers.map(v => (
                    <label key={v.email} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                      <input 
                        type="checkbox"
                        className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        checked={selectedAutoAssignVolunteers.includes(v.email)}
                        onChange={(e) => {
                          const emails = e.target.checked 
                            ? [...selectedAutoAssignVolunteers, v.email]
                            : selectedAutoAssignVolunteers.filter(email => email !== v.email);
                          setSelectedAutoAssignVolunteers(emails);
                        }}
                      />
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{v.name}</span>
                        <span className="text-[10px] text-slate-500">{v.email}</span>
                      </div>
                    </label>
                  ))}
                  {eligibleVolunteers.length === 0 && (
                    <p className="text-[9px] text-rose-500 font-bold uppercase text-center py-4">No volunteers found</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-200 dark:border-white/10 pt-4">
                <h4 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Constraints & Requests</h4>
                
                {/* Shift Requests */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Specific Shift Requests</label>
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <select 
                                className={`flex-1 p-2 rounded-lg text-xs border select-nice font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                value={newShiftRequest.volunteerEmail}
                                onChange={(e) => setNewShiftRequest({...newShiftRequest, volunteerEmail: e.target.value})}
                            >
                                <option value="">Select Volunteer</option>
                                {eligibleVolunteers.map(v => <option key={v.email} value={v.email}>{v.name}</option>)}
                            </select>
                            <select 
                                className={`w-24 p-2 rounded-lg text-xs border select-nice font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                value={newShiftRequest.day}
                                onChange={(e) => setNewShiftRequest({...newShiftRequest, day: e.target.value})}
                            >
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <select 
                                className={`w-24 p-2 rounded-lg text-xs border select-nice font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                value={newShiftRequest.shiftType}
                                onChange={(e) => {
                                    const type = e.target.value;
                                    setNewShiftRequest({
                                        ...newShiftRequest, 
                                        shiftType: type,
                                        task: type === 'All Day' ? 'Day Off' : newShiftRequest.task
                                    });
                                }}
                            >
                                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select 
                                className={`flex-1 p-2 rounded-lg text-xs border select-nice font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                value={newShiftRequest.task}
                                onChange={(e) => setNewShiftRequest({...newShiftRequest, task: e.target.value})}
                                disabled={newShiftRequest.shiftType === 'All Day'}
                            >
                                <option value="">Select Task</option>
                                {newShiftRequest.shiftType === 'All Day' ? (
                                    <option value="Day Off">Day Off</option>
                                ) : (
                                    filteredTasks.map(t => <option key={t} value={t}>{t}</option>)
                                )}
                            </select>
                        </div>
                        <button 
                            onClick={() => {
                                if (newShiftRequest.volunteerEmail && newShiftRequest.task) {
                                    setShiftRequests([...shiftRequests, newShiftRequest]);
                                    setNewShiftRequest({ ...newShiftRequest, task: '' }); // Reset task only for easier multi-add
                                }
                            }}
                            disabled={!newShiftRequest.volunteerEmail || !newShiftRequest.task}
                            className="w-full p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Plus className="size-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Add Shift Request</span>
                        </button>
                    </div>
                    </div>
                    
                    {shiftRequests.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {shiftRequests.map((req, idx) => {
                                const volName = volunteers.find(v => v.email === req.volunteerEmail)?.name || req.volunteerEmail;
                                return (
                                    <div key={idx} className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-[10px] border ${theme === 'dark' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                                        <span>{volName}: {req.day.slice(0,3)} {req.shiftType === 'Morning' ? 'AM' : 'PM'} - {req.task}</span>
                                        <button onClick={() => setShiftRequests(shiftRequests.filter((_, i) => i !== idx))} className="hover:text-rose-500">
                                            <X className="size-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Teaming Requests */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Teaming Requests (Work Together)</label>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <select 
                                className={`flex-1 p-2 rounded-lg text-xs border select-nice font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                value={newTeamingRequest.volunteer1Email}
                                onChange={(e) => setNewTeamingRequest({...newTeamingRequest, volunteer1Email: e.target.value})}
                            >
                                <option value="">Volunteer 1</option>
                                {eligibleVolunteers.map(v => <option key={v.email} value={v.email}>{v.name}</option>)}
                            </select>
                            <span className="text-slate-400">&</span>
                            <select 
                                className={`flex-1 p-2 rounded-lg text-xs border select-nice font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                value={newTeamingRequest.volunteer2Email}
                                onChange={(e) => setNewTeamingRequest({...newTeamingRequest, volunteer2Email: e.target.value})}
                            >
                                <option value="">Volunteer 2</option>
                                {eligibleVolunteers.filter(v => v.email !== newTeamingRequest.volunteer1Email).map(v => <option key={v.email} value={v.email}>{v.name}</option>)}
                            </select>
                        </div>
                        <button 
                            onClick={() => {
                                if (newTeamingRequest.volunteer1Email && newTeamingRequest.volunteer2Email) {
                                    setTeamingRequests([...teamingRequests, newTeamingRequest]);
                                    setNewTeamingRequest({ volunteer1Email: '', volunteer2Email: '' });
                                }
                            }}
                            disabled={!newTeamingRequest.volunteer1Email || !newTeamingRequest.volunteer2Email}
                            className="w-full p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <UserPlus className="size-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Add Teaming Request</span>
                        </button>
                    </div>

                    {teamingRequests.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {teamingRequests.map((req, idx) => {
                                const v1 = volunteers.find(v => v.email === req.volunteer1Email)?.name || req.volunteer1Email;
                                const v2 = volunteers.find(v => v.email === req.volunteer2Email)?.name || req.volunteer2Email;
                                return (
                                    <div key={idx} className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-[10px] border ${theme === 'dark' ? 'bg-teal-500/20 border-teal-500/30 text-teal-200' : 'bg-teal-50 border-teal-200 text-teal-700'}`}>
                                        <span>{v1} + {v2}</span>
                                        <button onClick={() => setTeamingRequests(teamingRequests.filter((_, i) => i !== idx))} className="hover:text-rose-500">
                                            <X className="size-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
              </div>

              <button 
                onClick={handleAutoAssign}
                disabled={selectedAutoAssignVolunteers.length === 0 || isLoading}
                className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all mt-4 flex items-center justify-center gap-2 ${
                    selectedAutoAssignVolunteers.length === 0 
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                        : theme === 'dark' 
                            ? 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-500' 
                            : 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-700'
                }`}
              >
                {isLoading ? (
                    <>
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Assigning...
                    </>
                ) : (
                    <>
                        <Sparkles className="size-4" />
                        Generate Schedule ({selectedAutoAssignVolunteers.length})
                    </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Clear Week Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowClearModal(false)}></div>
          <div className={`relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-[#1a232e] border border-white/10' : 'bg-white border border-slate-200'}`}>
            <div className="p-6 text-center space-y-4">
              <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto">
                <AlertTriangle className="text-rose-600 size-6" />
              </div>
              <div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Clear Weekly Schedule?</h3>
                <p className="text-sm text-slate-500 font-medium mt-2">
                  Are you sure you want to delete ALL shifts for the week of <span className="text-primary">{formatWeekRange()}</span>?
                </p>
                <p className="text-xs text-rose-500 font-bold mt-2 uppercase">This action cannot be undone.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button 
                  onClick={() => setShowClearModal(false)}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeClearWeek}
                  disabled={isLoading}
                  className="py-3 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-500 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Yes, Clear All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Shift Confirmation Modal */}
      {shiftToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShiftToDelete(null)}></div>
          <div className={`relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-[#1a232e] border border-white/10' : 'bg-white border border-slate-200'}`}>
            <div className="p-6 text-center space-y-4">
              <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto">
                <Trash className="text-rose-600 size-6" />
              </div>
              <div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Delete Shift?</h3>
                <p className="text-sm text-slate-500 font-medium mt-2">
                  Are you sure you want to delete <span className="text-primary font-bold">"{shiftToDelete.task}"</span> on {shiftToDelete.day}?
                </p>
                <p className="text-xs text-rose-500 font-bold mt-2 uppercase">This will remove {shiftToDelete.volunteers.length} volunteer assignment(s).</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button 
                  onClick={() => setShiftToDelete(null)}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteShift}
                  disabled={isLoading}
                  className="py-3 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-500 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash className="size-4" />
                      Yes, Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default TimeTable;
