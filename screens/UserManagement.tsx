
import React, { useState, useEffect } from 'react';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

interface UserManagementProps {
  user: User;
  theme?: 'light' | 'dark';
}

const UserManagement: React.FC<UserManagementProps> = ({ user, theme = 'dark' }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [confirmingUser, setConfirmingUser] = useState<any | null>(null);
  const [pendingSearch, setPendingSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [pendingPage, setPendingPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await DatabaseConnection.getUsers();
      // console.log('[UserManagement] Raw users data:', data);

      // Normalize user data to ensure 'id' and other fields are consistent
      const normalized = data.map((u: any) => {
        // Helper to normalize boolean values
        const toBool = (val: any) => {
          if (val === true || val === 1) return true;
          if (typeof val === 'string') {
            const lower = val.toLowerCase();
            return lower === 'true' || lower === 't' || lower === '1' || lower === 'yes';
          }
          return false;
        };

        const isActive = toBool(u.is_active ?? u.active);
        const isEmailVerified = toBool(u.is_email_verified ?? u.email_verified);
        
        // console.log(`[UserManagement] Normalizing user ${u.email}:`, {
        //   keys: Object.keys(u),
        //   raw_active: u.is_active,
        //   raw_verified: u.is_email_verified,
        //   normalized_active: isActive,
        //   normalized_verified: isEmailVerified
        // });
        
        // Ensure ID is a primitive (string or number)
        let rawId = u.id ?? u.user_id ?? u.ID ?? u.User_ID ?? u.uid;
        if (rawId && typeof rawId === 'object') {
          rawId = rawId.id || rawId.value || JSON.stringify(rawId);
        }

        return {
          ...u,
          id: rawId,
          is_active: isActive,
          is_email_verified: isEmailVerified,
          name: u.name || u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
        };
      });
      // console.log('[UserManagement] Normalized users:', normalized);
      setUsers(normalized);
    } catch (err: any) {
      console.error('[UserManagement] Failed to fetch users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await DatabaseConnection.updateUser(editingUser.id, {
        role: editingUser.role,
        station: editingUser.station,
        first_name: editingUser.first_name,
        last_name: editingUser.last_name,
        email: editingUser.email
      });
      setSuccessMsg('User updated successfully');
      setEditingUser(null);
      fetchUsers();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleApprove = async (userId: number | string) => {
    // console.log('[UserManagement] Approving user:', userId);
    if (userId === undefined || userId === null || userId === '') {
      setError('Invalid user ID');
      return;
    }
    // Optimistic update
    const previousUsers = [...users];
    setUsers(prev => {
      const newUsers = prev.map(u => {
        const match = String(u.id) === String(userId);
        // if (match) console.log('[UserManagement] Found matching user for optimistic update (Approve):', u);
        return match ? { ...u, is_active: true } : u;
      });
      return newUsers;
    });
    
    try {
      await DatabaseConnection.approveUser(userId);
      // console.log('[UserManagement] User approved successfully');
      setSuccessMsg('User approved successfully');
      fetchUsers(); // Refresh to be sure
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('[UserManagement] Approval error:', err);
      setUsers(previousUsers); // Rollback
      setError(err.message || 'Failed to approve user');
    }
  };

  const executeReject = async (userId: number | string) => {
    console.log('[UserManagement] executeReject called with ID:', userId);
    const user = users.find(u => String(u.id) === String(userId));
    
    if (!user) {
      console.error('[UserManagement] User not found for ID:', userId);
      return;
    }

    const isPending = !user.is_active || user.is_email_verified !== true;
    const action = isPending ? 'reject' : 'deactivate';
    
    console.log(`[UserManagement] Processing ${action} for user:`, {
      id: user.id,
      email: user.email,
      is_active: user.is_active,
      is_email_verified: user.is_email_verified,
      calculated_isPending: isPending
    });
    
    if (userId === undefined || userId === null || userId === '') {
      setError('Invalid user ID');
      return;
    }

    // Optimistic update
    const previousUsers = [...users];
    setUsers(prev => {
      const newUsers = prev.map(u => {
        const match = String(u.id) === String(userId);
        if (match) console.log(`[UserManagement] Found matching user for optimistic update (${action}):`, u);
        return match ? { ...u, is_active: false } : u;
      });
      return newUsers;
    });

    try {
      // Explicitly set is_active to false
      console.log(`[UserManagement] Sending API request to set is_active=false for user ${userId}`);
      const result = await DatabaseConnection.updateUser(userId, { is_active: false });
      console.log(`[UserManagement] ${action} API result:`, result);
      setSuccessMsg(`User ${action}ed`);
      fetchUsers(); // Refresh to be sure
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(`[UserManagement] ${action} error:`, err);
      setUsers(previousUsers); // Rollback
      setError(err.message || `Failed to ${action} user`);
    } finally {
      setConfirmingUser(null);
    }
  };

  const handleVerifyEmail = async (userId: string | number) => {
    try {
      await DatabaseConnection.updateUser(userId, { is_email_verified: true });
      setSuccessMsg('Email verified successfully');
      fetchUsers();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('[UserManagement] Verify email error:', err);
      setError(err.message || 'Failed to verify email');
    }
  };

  // Find the full user object for the currently logged-in user from the fetched users list
  // This ensures we have the most up-to-date station info, in case the login response was incomplete
  const currentUserRecord = users.find(u => (u.email || '').toLowerCase() === (user.email || '').toLowerCase());
  const currentStation = currentUserRecord?.station || user.station;
  const currentRole = currentUserRecord?.role || user.role;

  const pendingUsers = users.filter(u => {
    // Filter out users who are explicitly not active (rejected/deactivated)
    if (u.is_active === false) return false;
    
    // If current user is a Field Leader, only show users from their station AND hide Project Coordinators
    if (currentRole === 'Field Leader') {
      if (u.role === 'Project Coordinator') return false;

      if (currentStation) {
        const uStation = (u.station || '').toLowerCase().trim();
        const myStation = (currentStation || '').toLowerCase().trim();
        
        if (uStation !== myStation) {
          return false;
        }
      }
    }

    // Show users who are active but not email verified
    // Note: Since we filter out is_active === false above, this effectively means
    // we only show users where is_active === true AND is_email_verified !== true
    return u.is_email_verified !== true;
  });
  
  const activeUsers = users.filter(u => {
    if (u.is_active !== true || u.is_email_verified !== true) return false;

    // If current user is a Field Leader, only show users from their station AND hide Project Coordinators
    if (currentRole === 'Field Leader') {
      if (u.role === 'Project Coordinator') return false;

      if (currentStation) {
        const uStation = (u.station || '').toLowerCase().trim();
        const myStation = (currentStation || '').toLowerCase().trim();
        
        if (uStation !== myStation) {
          return false;
        }
      }
    }

    return true;
  });

  // Filter and Paginate Pending
  const filteredPendingUsers = pendingUsers.filter(u => {
    const term = pendingSearch.toLowerCase();
    const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  const totalPendingPages = Math.ceil(filteredPendingUsers.length / ITEMS_PER_PAGE);
  const paginatedPendingUsers = filteredPendingUsers.slice(
    (pendingPage - 1) * ITEMS_PER_PAGE,
    pendingPage * ITEMS_PER_PAGE
  );

  // Filter and Paginate Active
  const filteredActiveUsers = activeUsers.filter(u => {
    const term = activeSearch.toLowerCase();
    const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  const totalActivePages = Math.ceil(filteredActiveUsers.length / ITEMS_PER_PAGE);
  const paginatedActiveUsers = filteredActiveUsers.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  // useEffect(() => {
  //   console.log('[UserManagement] User lists updated:', {
  //     total: users.length,
  //     pendingCount: pendingUsers.length,
  //     activeCount: activeUsers.length,
  //     pendingEmails: pendingUsers.map(u => u.email),
  //     activeEmails: activeUsers.map(u => u.email)
  //   });
  // }, [users]);

  const getRoleBadge = (role: string) => {
    let styles = '';
    let icon = '';
    
    switch (role) {
      case 'Project Coordinator':
        styles = theme === 'dark' 
          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
          : 'bg-purple-100 text-purple-700 border-purple-200';
        icon = 'manage_accounts';
        break;
      case 'Field Leader':
        styles = theme === 'dark' 
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
          : 'bg-blue-100 text-blue-700 border-blue-200';
        icon = 'supervisor_account';
        break;
      case 'Field Assistant':
        styles = theme === 'dark' 
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
          : 'bg-emerald-100 text-emerald-700 border-emerald-200';
        icon = 'support_agent';
        break;
      case 'Field Volunteer':
        styles = theme === 'dark' 
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
          : 'bg-amber-100 text-amber-700 border-amber-200';
        icon = 'volunteer_activism';
        break;
      default:
        styles = theme === 'dark' 
          ? 'bg-slate-800 text-slate-400 border-white/5' 
          : 'bg-slate-100 text-slate-600 border-slate-200';
        icon = 'person';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase rounded-md border ${styles}`}>
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {role}
      </span>
    );
  };

  return (
    <div className={`flex flex-col min-h-full ${theme === 'dark' ? 'bg-background-dark' : 'bg-background-light'}`}>
      <header className={`sticky top-0 z-10 backdrop-blur-md border-b px-8 h-16 flex items-center justify-between transition-all duration-300 ${
        theme === 'dark' ? 'bg-background-dark/80 border-white/5' : 'bg-white/80 border-slate-200'
      }`}>
        <div className="flex items-center gap-4 z-20">
          <div className="w-10 flex-shrink-0">
            {/* Left spacer for menu button */}
          </div>
        </div>
        
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <h1 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            User Management
          </h1>
        </div>
      </header>

      <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
        {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-rose-500">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            <p className="text-xs font-bold">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-500/10 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-500">
          <span className="material-symbols-outlined">check_circle</span>
          <p className="text-xs font-bold">{successMsg}</p>
        </div>
      )}

      <div className="space-y-6">
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500">pending_actions</span>
              <h2 className={`text-lg font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Pending Requests ({filteredPendingUsers.length})</h2>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">search</span>
              <input 
                type="text" 
                placeholder="Search requests..." 
                value={pendingSearch}
                onChange={(e) => { setPendingSearch(e.target.value); setPendingPage(1); }}
                className={`pl-9 pr-4 py-2 border rounded-lg text-sm placeholder:text-slate-500 focus:border-primary outline-none w-full sm:w-64 ${
                  theme === 'dark' 
                    ? 'bg-slate-900/50 border-white/10 text-white' 
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>
          
          <div className={`rounded-xl border overflow-hidden backdrop-blur-md ${
            theme === 'dark' 
              ? 'bg-slate-900/50 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Researcher</th>
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Role</th>
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Station</th>
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'}`}>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Loading requests...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPendingUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                        {pendingSearch ? 'No matching requests found' : 'No pending requests found'}
                      </td>
                    </tr>
                  ) : (
                    paginatedPendingUsers.map((user) => (
                      <tr key={user.id} className={`transition-colors group ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.first_name} {user.last_name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-mono">{user.email}</span>
                              {!user.is_active && (
                                <span className="px-1.5 py-0.5 bg-slate-500/10 text-slate-400 text-[8px] font-black uppercase rounded border border-slate-500/20">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getRoleBadge(user.role)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{user.station}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {!user.is_active && (
                              <button 
                                onClick={() => handleApprove(user.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase rounded-lg transition-all active:scale-95 shadow-lg shadow-green-500/20"
                              >
                                <span className="material-symbols-outlined text-sm">check</span>
                                Approve
                              </button>
                            )}
                            {user.is_email_verified === false && (
                              <button 
                                onClick={() => handleVerifyEmail(user.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                              >
                                <span className="material-symbols-outlined text-sm">mark_email_read</span>
                                Verify User
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                const validStations = ['Lix', 'Argo'];
                                const station = validStations.includes(user.station) ? user.station : 'Lix';
                                setEditingUser({ ...user, station });
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white text-[10px] font-black uppercase rounded-lg border border-amber-500/20 transition-all active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              Edit
                            </button>
                            <button 
                              onClick={() => setConfirmingUser(user)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white text-[10px] font-black uppercase rounded-lg border border-rose-500/20 transition-all active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPendingPages > 1 && (
              <div className={`px-6 py-4 border-t flex items-center justify-between ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
                <span className="text-xs text-slate-500 font-medium">
                  Showing {(pendingPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(pendingPage * ITEMS_PER_PAGE, filteredPendingUsers.length)} of {filteredPendingUsers.length}
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                    disabled={pendingPage === 1}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{pendingPage} / {totalPendingPages}</span>
                  <button 
                    onClick={() => setPendingPage(p => Math.min(totalPendingPages, p + 1))}
                    disabled={pendingPage === totalPendingPages}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-green-500">verified_user</span>
              <h2 className={`text-lg font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Active Researchers ({filteredActiveUsers.length})</h2>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">search</span>
              <input 
                type="text" 
                placeholder="Search researchers..." 
                value={activeSearch}
                onChange={(e) => { setActiveSearch(e.target.value); setActivePage(1); }}
                className={`pl-9 pr-4 py-2 border rounded-lg text-sm placeholder:text-slate-500 focus:border-primary outline-none w-full sm:w-64 ${
                  theme === 'dark' 
                    ? 'bg-slate-900/50 border-white/10 text-white' 
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>
          
          <div className={`rounded-xl border overflow-hidden backdrop-blur-md ${
            theme === 'dark' 
              ? 'bg-slate-900/50 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Researcher</th>
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Role</th>
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Station</th>
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'}`}>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Loading researchers...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredActiveUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                        {activeSearch ? 'No matching researchers found' : 'No active researchers found'}
                      </td>
                    </tr>
                  ) : (
                    paginatedActiveUsers.map((user) => (
                      <tr key={user.id} className={`transition-colors group ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.first_name} {user.last_name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getRoleBadge(user.role)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{user.station}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                const validStations = ['Lix', 'Argo'];
                                const station = validStations.includes(user.station) ? user.station : 'Lix';
                                setEditingUser({ ...user, station });
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                theme === 'dark' 
                                  ? 'hover:bg-white/5 text-slate-500 hover:text-primary' 
                                  : 'hover:bg-slate-100 text-slate-400 hover:text-primary'
                              }`}
                              title="Edit User"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button 
                              onClick={() => setConfirmingUser(user)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                theme === 'dark' 
                                  ? 'hover:bg-white/5 text-slate-500 hover:text-rose-500' 
                                  : 'hover:bg-slate-100 text-slate-400 hover:text-rose-500'
                              }`}
                              title="Deactivate User"
                            >
                              <span className="material-symbols-outlined text-sm">person_off</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalActivePages > 1 && (
              <div className={`px-6 py-4 border-t flex items-center justify-between ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
                <span className="text-xs text-slate-500 font-medium">
                  Showing {(activePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(activePage * ITEMS_PER_PAGE, filteredActiveUsers.length)} of {filteredActiveUsers.length}
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setActivePage(p => Math.max(1, p - 1))}
                    disabled={activePage === 1}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{activePage} / {totalActivePages}</span>
                  <button 
                    onClick={() => setActivePage(p => Math.min(totalActivePages, p + 1))}
                    disabled={activePage === totalActivePages}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
            theme === 'dark' 
              ? 'bg-slate-900 border-white/10' 
              : 'bg-white border-slate-200'
          }`}>
            <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
              <h3 className={`text-lg font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Edit Researcher Details</h3>
              <button 
                onClick={() => setEditingUser(null)} 
                className={`transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">First Name</label>
                  <input 
                    type="text"
                    value={editingUser.first_name}
                    onChange={(e) => setEditingUser({...editingUser, first_name: e.target.value})}
                    className={`w-full border rounded-lg px-4 py-2 text-sm focus:border-primary outline-none ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Last Name</label>
                  <input 
                    type="text"
                    value={editingUser.last_name}
                    onChange={(e) => setEditingUser({...editingUser, last_name: e.target.value})}
                    className={`w-full border rounded-lg px-4 py-2 text-sm focus:border-primary outline-none ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                <div className="relative">
                  <select 
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                    className={`w-full border rounded-lg px-4 py-2 text-sm focus:border-primary outline-none select-nice cursor-pointer font-bold shadow-sm ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="Project Coordinator">Project Coordinator</option>
                    <option value="Field Leader">Field Leader</option>
                    <option value="Field Assistant">Field Assistant</option>
                    <option value="Field Volunteer">Field Volunteer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Station</label>
                <div className="relative">
                  <select 
                    value={editingUser.station}
                    onChange={(e) => setEditingUser({...editingUser, station: e.target.value})}
                    className={`w-full border rounded-lg px-4 py-2 text-sm focus:border-primary outline-none select-nice cursor-pointer font-bold shadow-sm ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="Lix">Lix</option>
                    <option value="Argo">Argo</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className={`flex-1 px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${
                    theme === 'dark' 
                      ? 'bg-white/5 hover:bg-white/10 text-slate-400' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-primary/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirm Reject Modal */}
      {confirmingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
            theme === 'dark' 
              ? 'bg-slate-900 border-white/10' 
              : 'bg-white border-slate-200'
          }`}>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-500">
                <span className="material-symbols-outlined text-3xl">warning</span>
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Confirm Action</h3>
              </div>
              
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Are you sure you want to {(!confirmingUser.is_active || confirmingUser.is_email_verified !== true) ? 'reject' : 'deactivate'} <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{confirmingUser.first_name} {confirmingUser.last_name}</span>?
                <br/><br/>
                This action will remove their access to the system.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  onClick={() => setConfirmingUser(null)}
                  className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                    theme === 'dark' 
                      ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => executeReject(confirmingUser.id)}
                  className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Confirm
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

export default UserManagement;
