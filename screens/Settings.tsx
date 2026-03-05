
import React, { useState } from 'react';
import { User } from '../types';
import { DatabaseConnection } from '../services/Database';

interface SettingsProps {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
  theme: 'light' | 'dark';
}

const Settings: React.FC<SettingsProps> = ({ user, onUpdateUser, theme }) => {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const avatars = [
    'https://picsum.photos/seed/turtle1/200/200',
    'https://picsum.photos/seed/turtle2/200/200',
    'https://picsum.photos/seed/ocean1/200/200',
    'https://picsum.photos/seed/beach1/200/200',
    'https://picsum.photos/seed/nature1/200/200',
    'https://picsum.photos/seed/shell1/200/200',
  ];

  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: true
  });

  const [privacy, setPrivacy] = useState({
    showProfile: true,
    shareData: false
  });

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      // Use the user's email from the user object
      // If user.email is not available, we might need to pass it or get it from somewhere
      // Looking at App.tsx, handleLogin passes { name, role, email }
      // But User interface in types.ts only has { name, role, avatar }
      // I should check types.ts again.
      
      // I'll use a placeholder or assume it's in the user object if I update the type.
      // Let's check types.ts
      await DatabaseConnection.changePassword(user.email, currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'bg-background-dark text-white' : 'bg-background-light text-slate-900'}`}>
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
            User Settings
          </h1>
        </div>
      </header>

      <div className="p-8 max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-slate-500 font-medium">Manage your researcher profile and preferences</p>
          </div>
          <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="material-symbols-outlined text-primary text-2xl">settings</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'} shadow-xl`}>
              <div className="flex flex-col items-center text-center">
                <div className="size-24 rounded-full overflow-hidden ring-4 ring-primary/20 mb-4 relative group">
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setShowAvatarPicker(true)}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-white">photo_camera</span>
                  </button>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">{user.name}</h2>
                <p className="text-primary text-xs font-black uppercase tracking-widest mt-1">{user.role}</p>
                <button 
                  onClick={() => setShowAvatarPicker(true)}
                  className="mt-6 w-full py-2.5 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-primary/90 transition-all"
                >
                  Change Avatar
                </button>
              </div>
            </div>

            {showAvatarPicker && (
              <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} animate-in fade-in slide-in-from-top-2`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Avatar</span>
                  <button onClick={() => setShowAvatarPicker(false)} className="material-symbols-outlined text-sm text-slate-500 hover:text-rose-500">close</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {avatars.map((url, i) => (
                    <button 
                      key={i} 
                      onClick={() => {
                        onUpdateUser({ avatar: url });
                        setShowAvatarPicker(false);
                      }}
                      className={`size-12 rounded-full overflow-hidden border-2 transition-all hover:scale-110 ${user.avatar === url ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <nav className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary border-l-4 border-primary font-black uppercase tracking-widest text-[10px]">
                <span className="material-symbols-outlined text-lg">person</span> Profile
              </button>
              <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${theme === 'dark' ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>
                <span className="material-symbols-outlined text-lg">security</span> Security
              </button>
              <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${theme === 'dark' ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>
                <span className="material-symbols-outlined text-lg">notifications</span> Notifications
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            <section className={`p-8 rounded-2xl border ${theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'} shadow-xl`}>
              <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">contact_page</span> Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Full Name</label>
                  <input type="text" defaultValue={user.name} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Professional Role</label>
                  <input type="text" readOnly value={user.role} className={`w-full px-4 py-3 rounded-xl border outline-none opacity-60 cursor-not-allowed font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Address</label>
                  <input type="email" defaultValue={user.email} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-end">
                <button className="px-8 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Update Profile
                </button>
              </div>
            </section>

            <section className={`p-8 rounded-2xl border ${theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'} shadow-xl`}>
              <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">security</span> Change Password
              </h3>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                {passwordError && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-500">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{passwordError}</span>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-500">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Password updated successfully</span>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Password</label>
                  <input 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">New Password</label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <button 
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-8 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </section>

            <section className={`p-8 rounded-2xl border ${theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'} shadow-xl`}>
              <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">notifications_active</span> Notification Preferences
              </h3>
              <div className="space-y-4">
                {Object.entries(notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-slate-700/30 last:border-0">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-tight">{key} Notifications</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Receive updates regarding nest activity via {key}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={value} className="sr-only peer" onChange={() => setNotifications({...notifications, [key]: !value})} />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className={`p-8 rounded-2xl border border-rose-500/20 ${theme === 'dark' ? 'bg-rose-500/5' : 'bg-rose-50'} shadow-xl`}>
              <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-rose-500 flex items-center gap-2">
                <span className="material-symbols-outlined">dangerous</span> Danger Zone
              </h3>
              <p className="text-xs text-slate-500 mb-6 uppercase tracking-widest font-bold">Once you delete your account, there is no going back. Please be certain.</p>
              <button className="px-6 py-3 border border-rose-500 text-rose-500 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-500 hover:text-white transition-all">
                Delete Researcher Account
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
