
import React, { useState, useEffect } from 'react';
import { DatabaseConnection } from '../services/Database';
import { 
  Egg, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowLeft, 
  Clock,
  ShieldCheck,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { PageTitle, BodyText, Label, SectionHeading } from '../components/ui/Typography';

interface LoginProps {
  onLogin: (user: {
    id: string | number;
    firstName: string;
    lastName: string;
    role: string;
    email: string;
    station?: string;
    profilePicture?: string;
    isActive?: boolean;
  }) => void;
  onViewPublicStats?: () => void;
}

type AuthMode = 'SIGN_IN' | 'SIGN_UP' | 'PENDING' | 'FORGOT_PASSWORD' | 'REQUEST_REACTIVATION';

// Every auth screen gets a title. The two recovery modes previously fell
// through every branch and rendered a headerless panel under the bare tagline.
const AUTH_TITLES: Record<AuthMode, string> = {
  SIGN_IN: 'Turtle Data Portal',
  SIGN_UP: 'Create Researcher Profile',
  PENDING: 'Application Submitted',
  FORGOT_PASSWORD: 'Turtle Data Portal',
  REQUEST_REACTIVATION: 'Turtle Data Portal',
};


const Login: React.FC<LoginProps> = ({ onLogin, onViewPublicStats }) => {
  const [mode, setMode] = useState<AuthMode>('SIGN_IN');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inactiveEmail, setInactiveEmail] = useState('');
  const [inactiveUserId, setInactiveUserId] = useState<string | number | null>(null);

  // Registration State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState('Field Volunteer');
  const [regStation, setRegStation] = useState('Lix');
  const [regPass, setRegPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // The server decides which demo roles exist, and whether demo access is on at
  // all. Nothing here is hardcoded, so turning it off server-side removes the
  // buttons without a redeploy.
  const [demoRoles, setDemoRoles] = useState<string[]>([]);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    DatabaseConnection.getDemoRoles().then((roles) => {
      if (!cancelled) setDemoRoles(roles);
    });
    return () => { cancelled = true; };
  }, []);

  const handleDemoLogin = async (role: string) => {
    setDemoBusy(role);
    setErrorMsg(null);
    try {
      const response = await DatabaseConnection.demoLogin(role);
      let user = response.user;
      try {
        const fullUser = await DatabaseConnection.getUser(user.id);
        if (fullUser) user = { ...user, ...fullUser };
      } catch {
        // Profile picture is cosmetic - don't block the demo on it.
      }
      onLogin({
        id: user.id,
        firstName: user.first_name || user.firstName,
        lastName: user.last_name || user.lastName,
        role: user.role,
        email: user.email,
        station: user.station,
        profilePicture: user.profile_picture || user.profilePicture,
        isActive: user.is_active || user.isActive,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo sign-in failed.');
      setDemoBusy(null);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // No pre-flight status check: this used to download every user account
      // before authenticating, which handed the whole staff list - and, until
      // the server stopped sending them, their password hashes - to anyone who
      // opened the login page. The server now reports the reason itself, but
      // only once the password has actually checked out.
      const response = await DatabaseConnection.loginUser(email.trim().toLowerCase(), password);
      let user = response.user;

      // Fetch full user details to get the profile picture properly
      try {
        const fullUser = await DatabaseConnection.getUser(user.id);
        if (fullUser) {
          user = { ...user, ...fullUser };
        }
      } catch (fetchErr) {
        console.warn("Could not fetch full user details, proceeding with login data", fetchErr);
      }

      onLogin({
        id: user.id,
        firstName: user.first_name || user.firstName,
        lastName: user.last_name || user.lastName,
        role: user.role,
        email: user.email,
        station: user.station,
        profilePicture: user.profile_picture || user.profilePicture,
        isActive: user.is_active || user.isActive
      });
    } catch (err: any) {
      console.error("Login Error:", err);

      if (err.reason === 'INACTIVE') {
        setInactiveEmail(email.trim().toLowerCase());
        setMode('REQUEST_REACTIVATION');
        return;
      }

      if (err.reason === 'UNVERIFIED') {
        setErrorMsg("Your account has not been verified by the field leader yet.");
        return;
      }

      setErrorMsg(err.message || "Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !regEmail || !regPass || !confirmPass || !regRole || !regStation) return;
    
    if (regPass !== confirmPass) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    
    setIsSubmitting(true);
    setErrorMsg(null);
    
    try {
      await DatabaseConnection.createUser({
        firstName,
        lastName,
        email: regEmail,
        password: regPass,
        role: regRole,
        station: regStation
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
    <div className="dark h-screen flex justify-center relative overflow-y-auto font-sans bg-background-dark">
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
                {mode === 'PENDING' ? (
                  <Clock className="text-primary w-8 h-8" />
                ) : (
                  <Egg className="text-primary w-8 h-8" fill="currentColor" />
                )}
              </div>
              <PageTitle className="mb-1 !text-white">
                {AUTH_TITLES[mode]}
              </PageTitle>
              <p className="text-primary/80 text-sm font-medium">
                {mode === 'PENDING' ? 'Scientific Board Review in Progress' : 'Protecting Greek Sea Turtles through Data'}
              </p>
            </div>

          {errorMsg && (
            <div className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-3">
              <AlertCircle className="text-rose-500 w-5 h-5 flex-shrink-0" />
              <p className="text-xs text-rose-400 font-bold leading-tight">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="w-full mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />
              <p className="text-xs text-emerald-400 font-bold leading-tight">{successMsg}</p>
            </div>
          )}

          {mode === 'SIGN_IN' && (
            <form className="w-full space-y-5" onSubmit={handleSignIn} autoComplete="off">
              <Input
                label="Email Address"
                placeholder="researcher@university.edu"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />

              <div className="relative">
                <Input
                  label="Password"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button 
                  className="absolute right-3 top-[38px] text-slate-400 hover:text-white transition-colors" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <button 
                  type="button"
                  onClick={() => setMode('FORGOT_PASSWORD')}
                  className="text-primary text-sm font-bold hover:underline mt-2 absolute right-0 -bottom-8 p-2"
                >
                  Forgot Password?
                </button>
              </div>

              <Button 
                type="submit"
                className="w-full mt-10"
                isLoading={isSubmitting}
                size="lg"
              >
                Log in
              </Button>

              {demoRoles.length > 0 && (
                <div className="mt-6 pt-5 border-t border-slate-700/50">
                  <p className="text-center text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">
                    Demo Access
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {demoRoles.map((role) => (
                      <Button
                        key={role}
                        type="button"
                        variant="outline"
                        className="!text-emerald-500 !border-emerald-500/30 hover:!bg-emerald-500 hover:!text-white !text-xs"
                        isLoading={demoBusy === role}
                        disabled={demoBusy !== null}
                        onClick={() => handleDemoLogin(role)}
                      >
                        {role}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center mt-8">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-slate-400 text-sm">
                    New researcher? <button type="button" onClick={() => setMode('SIGN_UP')} className="text-primary font-bold hover:underline p-2 text-base">Request Access</button>
                  </p>
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 bg-slate-900/50 rounded-xl border border-white/5 max-w-[320px]">
                    <div className="flex items-center gap-2">
                      <Info className="w-3 h-3 text-primary" />
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Access Policy</span>
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold leading-tight">
                      All new accounts require Scientific Board approval. Submit your details for verification.
                    </p>
                  </div>
                  {onViewPublicStats && (
                    <button
                      type="button"
                      onClick={onViewPublicStats}
                      className="text-slate-400 text-xs font-bold hover:text-primary hover:underline transition-colors"
                    >
                      View Public Season Stats
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          {mode === 'SIGN_UP' && (
            <form className="w-full space-y-4" onSubmit={handleSignUp} autoComplete="off">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  placeholder="Maria"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                />
                <Input
                  label="Last Name"
                  placeholder="Pappas"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
              
              <Select
                label="Account Role"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value)}
                required
                options={[
                  { value: 'Project Coordinator', label: 'Project Coordinator' },
                  { value: 'Field Leader', label: 'Field Leader' },
                  { value: 'Field Assistant', label: 'Field Assistant' },
                  { value: 'Field Volunteer', label: 'Field Volunteer' }
                ]}
              />

              <Select
                label="Station"
                value={regStation}
                onChange={(e) => setRegStation(e.target.value)}
                required
                options={[
                  { value: 'Lix', label: 'Lix' },
                  { value: 'Argo', label: 'Argo' }
                ]}
              />

              <Input
                label="Email"
                placeholder="m.pappas@university.gr"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                autoComplete="off"
              />

              <Input
                label="Password"
                placeholder="••••••••"
                type="password"
                value={regPass}
                onChange={(e) => setRegPass(e.target.value)}
                required
                autoComplete="new-password"
              />
              
              <Input
                label="Confirm Password"
                placeholder="••••••••"
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                required
                autoComplete="new-password"
              />

              <Button 
                type="submit"
                className="w-full mt-2"
                isLoading={isSubmitting}
                size="lg"
              >
                Submit Application
              </Button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => setMode('SIGN_IN')} className="text-slate-400 text-xs hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to Log in
                </button>
              </div>
            </form>
          )}

          {mode === 'PENDING' && (
            <div className="w-full space-y-6 text-center animate-in fade-in zoom-in duration-500">
              <div className="space-y-3">
                <Button 
                  onClick={simulateApproval} 
                  variant="outline"
                  className="w-full !text-emerald-500 !border-emerald-500/30 hover:!bg-emerald-500 hover:!text-white"
                >
                  Return to Log in
                </Button>
              </div>
            </div>
          )}

          {mode === 'FORGOT_PASSWORD' && (
            <div className="w-full space-y-4 animate-in fade-in zoom-in duration-500">
              <SectionHeading className="!text-white mb-2">Reset Password</SectionHeading>
              <BodyText className="mb-4">Enter your email to request a password reset.</BodyText>
              <Input 
                label="Email Address"
                placeholder="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button 
                onClick={async () => {
                  const sanitizedEmail = email.trim().toLowerCase();
                  if (!sanitizedEmail) {
                    setErrorMsg("Enter your email address.");
                    return;
                  }
                  setIsSubmitting(true);
                  setErrorMsg(null);
                  try {
                    // The server answers the same way whether or not the address
                    // has an account, so this form can't be used to find out
                    // which emails are registered.
                    await DatabaseConnection.requestPasswordReset(sanitizedEmail);
                    setSuccessMsg("Password reset requested. If that account exists, please wait for Field Leader approval.");
                    setMode('SIGN_IN');
                  } catch (err: any) {
                    setErrorMsg(err.message);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full"
                size="lg"
                isLoading={isSubmitting}
              >
                Request Reset
              </Button>
              <Button variant="ghost" onClick={() => setMode('SIGN_IN')} className="w-full">Back to Log in</Button>
            </div>
          )}

          {mode === 'REQUEST_REACTIVATION' && (
            <div className="w-full space-y-4 animate-in fade-in zoom-in duration-500">
              <SectionHeading className="!text-white mb-2">Account Inactive</SectionHeading>
              <BodyText className="mb-4">Your account is inactive. Would you like to request reactivation?</BodyText>
              <Button 
                onClick={async () => {
                  setIsSubmitting(true);
                  setErrorMsg(null);
                  try {
                    // Puts the account back in the field leader's approval queue.
                    // The client used to send is_active/is_email_verified itself,
                    // which meant anyone could flip those columns on any account.
                    await DatabaseConnection.requestReactivation(inactiveEmail.trim().toLowerCase());
                    setSuccessMsg("Reactivation requested. A field leader must approve it before you can sign in.");
                    setMode('SIGN_IN');
                  } catch (err: any) {
                    setErrorMsg(err.message);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full"
                size="lg"
                isLoading={isSubmitting}
              >
                Request Reactivation
              </Button>
              <Button variant="ghost" onClick={() => setMode('SIGN_IN')} className="w-full">Back to Log in</Button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-700/50 w-full text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-slate-500">
                <ShieldCheck className="w-4 h-4" />
                <p className="text-[10px] uppercase tracking-widest font-black">
                  Authorized Biological Personnel Only
                </p>
              </div>
              <p className="text-[9px] text-slate-600 font-bold max-w-[300px] leading-tight">
                Access is restricted to verified researchers and volunteers. Unauthorized attempts are logged and reported.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
