
import React, { useState } from 'react';
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
}

type AuthMode = 'SIGN_IN' | 'SIGN_UP' | 'PENDING' | 'FORGOT_PASSWORD' | 'REQUEST_REACTIVATION';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Check user status first to show specific messages even if password is wrong
      try {
        const users = await DatabaseConnection.getUsers();
        const preCheckUser = users.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());
        
        if (preCheckUser) {
          if (preCheckUser.is_active === false) {
            setInactiveEmail(email);
            setInactiveUserId(preCheckUser.id);
            setMode('REQUEST_REACTIVATION');
            setIsSubmitting(false);
            return;
          }
          
          if (preCheckUser.is_email_verified === false) {
            setErrorMsg("Your account has not been verified by the field leader yet.");
            setIsSubmitting(false);
            return;
          }
        }
      } catch (preCheckErr) {
        console.warn("Pre-login check failed, proceeding with standard login", preCheckErr);
      }

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
      
      // Check if user is inactive regardless of the error message from the backend
      // This ensures we show the reactivation screen even if the password was wrong
      try {
        const users = await DatabaseConnection.getUsers();
        const user = users.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (user && user.is_active === false) {
          setInactiveEmail(email);
          setInactiveUserId(user.id);
          setMode('REQUEST_REACTIVATION');
          setIsSubmitting(false);
          return;
        }
      } catch (e) {
        console.error("Error checking user status in catch block:", e);
      }

      if (err.message.toLowerCase().includes('inactive')) {
        // This is now handled by the check above, but we keep it for safety
        // if the getUsers call failed but the login call returned an 'inactive' error
        setInactiveEmail(email);
        
        // Find user ID by email
        try {
          const users = await DatabaseConnection.getUsers();
          const user = users.find((u: any) => u.email === email);
          if (user) {
            setInactiveUserId(user.id);
          }
        } catch (e) {
          console.error("Error finding user by email:", e);
        }

        setMode('REQUEST_REACTIVATION');
        setIsSubmitting(false);
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
    <div className="dark min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-background-dark">
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
                {mode === 'SIGN_IN' && 'Turtle Data Portal'}
                {mode === 'SIGN_UP' && 'Create Researcher Profile'}
                {mode === 'PENDING' && 'Application Submitted'}
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

              <Button 
                type="button"
                variant="outline"
                className="w-full mt-4 !text-emerald-500 !border-emerald-500/30 hover:!bg-emerald-500 hover:!text-white"
                size="lg"
                onClick={async () => {
                    setEmail('dev@gmail.com');
                    setPassword('123');
                    setTimeout(() => {
                        const form = document.querySelector('form');
                        form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }, 0);
                }}
              >
                Quick Login (Dev)
              </Button>

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
                  setIsSubmitting(true);
                  setErrorMsg(null);
                  try {
                    const users = await DatabaseConnection.getUsers();
                    const user = users.find((u: any) => u.email.toLowerCase() === sanitizedEmail);
                    if (!user) throw new Error("User not found with this email.");
                    
                    if (user.is_active === false) {
                      setInactiveUserId(user.id);
                      setInactiveEmail(sanitizedEmail);
                      setMode('REQUEST_REACTIVATION');
                      return;
                    }

                    if (user.is_email_verified === false) {
                      throw new Error("Your account has not been verified by the field leader yet.");
                    }

                    await DatabaseConnection.updateUser(user.id, { is_password_reset_needed: true });
                    setSuccessMsg("Password reset requested. Please wait for Field Leader approval.");
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
                    if (inactiveUserId) {
                        await DatabaseConnection.updateUser(inactiveUserId, { is_email_verified: false, is_active: true });
                        setMode('SIGN_IN');
                    }
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
