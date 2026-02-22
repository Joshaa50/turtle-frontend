
import React, { useState } from 'react';
import { DatabaseConnection } from '../services/Database';

interface LoginProps {
  onLogin: (user: { name: string; role: string; email: string }) => void;
}

type AuthMode = 'SIGN_IN' | 'SIGN_UP' | 'PENDING';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('SIGN_IN');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  // Default to lowercase 'researcher' to match DB constraints
  const [regRole, setRegRole] = useState('researcher');
  const [regPass, setRegPass] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // BYPASS AUTHENTICATION FOR DEMO
    setIsSubmitting(true);
    setErrorMsg(null);

    setTimeout(() => {
        onLogin({
            name: "Demo Researcher",
            role: "Project Coordinator",
            email: email || "researcher@archelon.gr"
        });
        setIsSubmitting(false);
    }, 500);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !regEmail || !regPass || !regRole) return;
    
    setIsSubmitting(true);
    setErrorMsg(null);
    
    try {
      await DatabaseConnection.createUser({
        firstName,
        lastName,
        email: regEmail,
        password: regPass,
        role: regRole
      });
      setMode('PENDING');
    } catch (err: any) {
      console.error("Database Error:", err);
      setErrorMsg(err.message || "Connection failed. Is the server running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const simulateApproval = () => {
    setMode('SIGN_IN');
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center relative overflow-hidden font-display bg-background-dark">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-overlay dark:bg-overlay z-10"></div>
        <img 
          className="w-full h-full object-cover blur-[2px]" 
          alt="Greek beach background"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBty1eUB4C63fzQDx8hpKAej_4lcC3BiEWs-3TdmDaChK9monlP7vLeB-OtstaQMrlNlPxoHkyyrBm1vanxr7GvnLkC6-dV_yrb5A6Yq8WAquX6rujRBIS_RgDAguKJVzwZ2W4bYKuVcLniTR2D9WpjyrA35_n5IV0zlrdAYQqy48HYW-LPE0zH3Ecf_p35CAey-rxCt3ZJSGrT_Acvy070R1m1SQLnkkAZG2WebGXxmOaMMhf9JIMHTm6O7syHKpPugW_t1cbB78c" 
        />
      </div>

      <div className="relative z-20 w-full max-w-[520px] px-6 py-12">
        <div className="glass-panel p-8 rounded-xl shadow-2xl flex flex-col items-center border border-white/10 transition-all duration-500 bg-slate-950/90 backdrop-blur-md">
          
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(19,127,236,0.3)]">
              <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {mode === 'PENDING' ? 'pending_actions' : 'egg'}
              </span>
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight mb-1">
              {mode === 'SIGN_IN' && 'Archelon Data Portal'}
              {mode === 'SIGN_UP' && 'Create Researcher Profile'}
              {mode === 'PENDING' && 'Application Submitted'}
            </h1>
            <p className="text-primary/80 text-sm font-medium">
              {mode === 'PENDING' ? 'Scientific Board Review in Progress' : 'Protecting Greek Sea Turtles through Data'}
            </p>
          </div>

          {errorMsg && (
            <div className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined text-rose-500 text-xl">error</span>
              <p className="text-xs text-rose-400 font-bold leading-tight">{errorMsg}</p>
            </div>
          )}

          {mode === 'SIGN_IN' && (
            <form className="w-full space-y-5" onSubmit={handleSignIn}>
              <div className="flex flex-col gap-1.5">
                <label className="text-white text-[10px] font-black uppercase tracking-widest opacity-60" htmlFor="email">Email Address</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-xl group-focus-within:text-primary transition-colors">mail</span>
                  <input 
                    className="form-input w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-11 pr-4 text-white placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 outline-none" 
                    id="email" 
                    name="email"
                    placeholder="researcher@archelon.gr" 
                    type="email"
                    value={email}
                    autoComplete="username"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-white text-[10px] font-black uppercase tracking-widest opacity-60" htmlFor="password">Password</label>
                  <button type="button" className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline">Forgot?</button>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-xl group-focus-within:text-primary transition-colors">lock</span>
                  <input 
                    className="form-input w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-11 pr-12 text-white placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 outline-none" 
                    id="password" 
                    name="password"
                    placeholder="••••••••" 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <button 
                disabled={isSubmitting}
                className={`w-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest py-4 rounded-lg shadow-lg shadow-primary/20 transform transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`} 
                type="submit"
              >
                 {isSubmitting ? (
                    <>
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Authenticating...
                    </>
                ) : (
                    'Log in'
                )}
              </button>

              <div className="text-center mt-6">
                <p className="text-slate-400 text-xs">
                  New researcher? <button type="button" onClick={() => setMode('SIGN_UP')} className="text-primary font-bold hover:underline">Create an Account</button>
                </p>
              </div>
            </form>
          )}

          {mode === 'SIGN_UP' && (
            <form className="w-full space-y-4" onSubmit={handleSignUp}>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-white text-[10px] font-black uppercase tracking-widest opacity-60">First Name</label>
                  <input 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white placeholder:text-slate-600 focus:border-primary outline-none text-sm" 
                    placeholder="Maria" 
                    type="text" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-white text-[10px] font-black uppercase tracking-widest opacity-60">Last Name</label>
                  <input 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white placeholder:text-slate-600 focus:border-primary outline-none text-sm" 
                    placeholder="Pappas" 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-white text-[10px] font-black uppercase tracking-widest opacity-60">Professional Email</label>
                <input 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white placeholder:text-slate-600 focus:border-primary outline-none text-sm" 
                    placeholder="m.pappas@university.gr" 
                    type="email" 
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white text-[10px] font-black uppercase tracking-widest opacity-60">Account Role</label>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white focus:border-primary outline-none text-sm appearance-none cursor-pointer"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                  >
                    <option value="researcher">Researcher</option>
                    <option value="volunteer">Field Volunteer</option>
                    <option value="coordinator">Project Coordinator</option>
                    <option value="veterinarian">Veterinarian</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-lg">expand_more</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white text-[10px] font-black uppercase tracking-widest opacity-60">Password</label>
                <input 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white placeholder:text-slate-600 focus:border-primary outline-none text-sm" 
                    placeholder="Create a strong password" 
                    type="password" 
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    required
                />
              </div>

              <button 
                disabled={isSubmitting}
                className={`w-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest py-4 rounded-lg shadow-lg shadow-primary/20 transform transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`} 
                type="submit"
              >
                {isSubmitting ? (
                    <>
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Creating Account...
                    </>
                ) : (
                    'Submit Application'
                )}
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => setMode('SIGN_IN')} className="text-slate-400 text-xs hover:text-white flex items-center justify-center gap-1 mx-auto">
                  <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Log in
                </button>
              </div>
            </form>
          )}

          {mode === 'PENDING' && (
            <div className="w-full space-y-6 text-center animate-in fade-in zoom-in duration-500">
              <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-4">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Your request for access has been logged in the <span className="text-amber-400 font-mono">LIVE DATABASE</span>.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-slate-500">
                    <span>Identity Verification</span>
                    <span className="text-green-500">Complete</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-slate-500">
                    <span>Scientific Board Review</span>
                    <span className="text-amber-500 animate-pulse">In Progress</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <button onClick={simulateApproval} className="w-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/30 font-black uppercase tracking-widest py-2.5 rounded-lg text-[10px] transition-all">
                  Return to Log in
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-700/50 w-full text-center">
            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold opacity-60">
              Authorized Biological Personnel Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
