
import React, { useState } from 'react';
import { User } from '../types';
import { DatabaseConnection } from '../services/Database';

interface SettingsProps {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
  theme: 'light' | 'dark';
}

const Settings: React.FC<SettingsProps> = ({ user, onUpdateUser, theme }) => {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const standardIcons = [
    'https://picsum.photos/seed/turtle1/200/200',
    'https://picsum.photos/seed/turtle2/200/200',
    'https://picsum.photos/seed/ocean1/200/200',
    'https://picsum.photos/seed/beach1/200/200',
    'https://picsum.photos/seed/nature1/200/200',
    'https://picsum.photos/seed/shell1/200/200',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/identicon/svg?seed=Jack',
  ];

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the prefix (e.g., "data:image/png;base64,")
        const base64Data = base64String.split(',')[1];
        onUpdateUser({ avatar: base64String, profilePicture: base64Data });
        
        // Also update on server
        DatabaseConnection.updateProfilePicture(user.id, base64Data)
          .catch(err => setProfileError(err.message || "Failed to update profile picture"));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectStandardIcon = async (url: string) => {
    onUpdateUser({ avatar: url });
    setShowIconPicker(false);
    try {
      await DatabaseConnection.updateUser(user.id, { profilePicture: url });
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile picture");
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdatingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      await DatabaseConnection.updateUser(user.id, {
        first_name: firstName,
        last_name: lastName,
        email: email
      });
      onUpdateUser({ firstName, lastName, email });
      setProfileSuccess(true);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Password Change State
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

    setIsChangingPassword(true);
    try {
      await DatabaseConnection.updateUser(user.id, { password: newPassword });
      setPasswordSuccess(true);
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
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'} shadow-xl`}>
              <div className="flex flex-col items-center text-center">
                <div className="size-24 rounded-full overflow-hidden ring-4 ring-primary/20 mb-4 relative group">
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <input 
                    type="file" 
                    id="avatar-upload" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleAvatarChange} 
                  />
                  <input 
                    type="file" 
                    id="camera-upload" 
                    className="hidden" 
                    accept="image/*" 
                    capture="user" 
                    onChange={handleAvatarChange} 
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                    <button 
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                      title="Upload Photo"
                    >
                      <span className="material-symbols-outlined text-white text-sm">upload</span>
                    </button>
                    <button 
                      onClick={() => document.getElementById('camera-upload')?.click()}
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                      title="Take Photo"
                    >
                      <span className="material-symbols-outlined text-white text-sm">photo_camera</span>
                    </button>
                  </div>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">{user.firstName} {user.lastName}</h2>
                <p className="text-primary text-xs font-black uppercase tracking-widest mt-1">{user.role}</p>
                
                <div className="mt-6 w-full space-y-2">
                  <button 
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className={`w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border ${
                      theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {showIconPicker ? 'Close Icon Picker' : 'Choose Standard Icon'}
                  </button>
                  
                  <button 
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    className="w-full py-2.5 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-primary/90 transition-all"
                  >
                    Upload New Photo
                  </button>
                </div>
              </div>
            </div>

            {showIconPicker && (
              <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'} shadow-xl animate-in fade-in slide-in-from-top-4 duration-300`}>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Select Standard Icon</h3>
                <div className="grid grid-cols-3 gap-4">
                  {standardIcons.map((url, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSelectStandardIcon(url)}
                      className={`aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                        user.avatar === url ? 'border-primary ring-4 ring-primary/20' : 'border-transparent'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <nav className="space-y-2">
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Professional Role</label>
                  <input type="text" readOnly value={user.role} className={`w-full px-4 py-3 rounded-xl border outline-none opacity-60 cursor-not-allowed font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-primary transition-all font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-700/50 flex flex-col gap-4">
                {profileError && <p className="text-rose-500 text-xs font-bold">{profileError}</p>}
                {profileSuccess && <p className="text-emerald-500 text-xs font-bold">Profile updated successfully</p>}
                <div className="flex justify-center">
                  <button onClick={handleUpdateProfile} disabled={isUpdatingProfile} className="px-8 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                    {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
                  </button>
                </div>
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
                <div className="pt-4 flex justify-center">
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
