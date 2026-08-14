import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Building,
  Phone,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Boxes,
  Receipt,
  CreditCard,
  Eye,
  EyeOff,
  Radio,
  FileText,
} from 'lucide-react';
import { useApp, UserRole, defaultPersonaUsers } from '../contexts/AppContext';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { login, signUp, loginAsPersona } = useApp();

  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('PROCUREMENT_MANAGER');
  const [department, setDepartment] = useState('Strategic Sourcing');
  const [phone, setPhone] = useState('+91 98200 11000');

  const personas = [
    {
      role: 'ADMIN' as UserRole,
      title: 'Executive Operations Lead',
      name: defaultPersonaUsers.ADMIN.full_name,
      email: defaultPersonaUsers.ADMIN.email,
      dept: 'Executive Operations',
      icon: Layers,
      color: 'bg-blue-600',
      badge: 'Full Access',
      desc: 'Complete Control Tower, analytics, and operational configuration.',
    },
    {
      role: 'PROCUREMENT_MANAGER' as UserRole,
      title: 'Procurement Manager',
      name: defaultPersonaUsers.PROCUREMENT_MANAGER.full_name,
      email: defaultPersonaUsers.PROCUREMENT_MANAGER.email,
      dept: 'Sourcing & Purchasing',
      icon: FileText,
      color: 'bg-amber-600',
      badge: 'PR & POs',
      desc: 'Purchase Requisitions, Purchase Orders, Vendor SLA catalogs.',
    },
    {
      role: 'WAREHOUSE_MANAGER' as UserRole,
      title: 'Warehouse & Facility Lead',
      name: defaultPersonaUsers.WAREHOUSE_MANAGER.full_name,
      email: defaultPersonaUsers.WAREHOUSE_MANAGER.email,
      dept: 'Pune Central DC Hub',
      icon: Boxes,
      color: 'bg-indigo-600',
      badge: 'Yard & DC',
      desc: 'Fleet telemetry, warehouse dock scheduling, and yard queues.',
    },
    {
      role: 'GATE_OPERATOR' as UserRole,
      title: 'Gate Security Officer',
      name: defaultPersonaUsers.GATE_OPERATOR.full_name,
      email: defaultPersonaUsers.GATE_OPERATOR.email,
      dept: 'Facility Gate Post',
      icon: Radio,
      color: 'bg-teal-600',
      badge: 'Gate In/Out',
      desc: 'Vehicle license verification, gate check-in, and dwell tracking.',
    },
    {
      role: 'RECEIVING_OPERATOR' as UserRole,
      title: 'Dock QA & Receiving Inspector',
      name: defaultPersonaUsers.RECEIVING_OPERATOR.full_name,
      email: defaultPersonaUsers.RECEIVING_OPERATOR.email,
      dept: 'Quality Assurance',
      icon: Truck,
      color: 'bg-purple-600',
      badge: 'GRN Intake',
      desc: 'Unloading verification, Goods Receipt Notes, damage counters.',
    },
    {
      role: 'FINANCE_MANAGER' as UserRole,
      title: 'Financial Controller',
      name: defaultPersonaUsers.FINANCE_MANAGER.full_name,
      email: defaultPersonaUsers.FINANCE_MANAGER.email,
      dept: 'Accounts Payable',
      icon: CreditCard,
      color: 'bg-emerald-600',
      badge: '3-Way Match',
      desc: 'Invoice AI OCR, variance investigation, and NEFT payments.',
    },
  ];

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!fullName || !email || !password) {
          setErrorMessage('Please fill in all required fields.');
          setLoading(false);
          return;
        }

        const res = await signUp({
          full_name: fullName,
          email,
          password,
          role,
          department,
          phone,
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Sign up failed.');
          setLoading(false);
          return;
        }
      } else {
        if (!email || !password) {
          setErrorMessage('Please enter email and password.');
          setLoading(false);
          return;
        }

        const res = await login(email, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Invalid credentials.');
          setLoading(false);
          return;
        }
      }

      navigate('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaQuickLogin = async (selectedRole: UserRole) => {
    setLoading(true);
    await loginAsPersona(selectedRole);
    setLoading(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Brand Bar */}
      <header className="h-16 border-b border-slate-800/80 px-6 sm:px-12 flex items-center justify-between bg-[#0F172A]/70 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black tracking-wider text-white">
              C2 CONTROL TOWER
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              Enterprise Supply Chain Mission Control
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Supabase Live DB Connected</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex flex-col justify-center">
        {/* Welcoming Header (Sections 1-4) */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-Persona Role-Aware Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Supply Chain Operations Hub
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Welcome to the C2 Supply Chain Portal. Select a verified operational persona for instant 1-click access, or sign in with your corporate credentials.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: 1-Click Persona Quick Logins (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>1-Click Persona Access (Demo Testing)</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Click any role to launch with tailored view
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {personas.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.role}
                    onClick={() => handlePersonaQuickLogin(p.role)}
                    className="p-4 rounded-xl border border-slate-800 bg-[#0F172A]/80 hover:bg-[#1E293B] hover:border-blue-500/50 cursor-pointer transition-all duration-200 group flex flex-col justify-between shadow-sm hover:shadow-md hover:shadow-blue-500/5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${p.color} text-white shadow-xs`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                              {p.title}
                            </div>
                            <div className="text-[10px] text-slate-400">{p.name}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug mb-3">
                        {p.desc}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-blue-400 group-hover:text-blue-300">
                      <span>Launch Role Portal</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Security Guarantee Banner */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-xs text-slate-400 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block mb-0.5">
                  Enterprise Security & Privacy Architecture
                </span>
                <span>
                  PostgreSQL Row-Level Security (RLS) active with deterministic foreign key validation, audit trails, and 256-bit TLS data transmission.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Credentials Login / Sign Up Form (5 cols) */}
          <div className="lg:col-span-5 bg-[#0F172A] rounded-2xl border border-slate-800 p-6 sm:p-7 shadow-xl">
            {/* Form Mode Toggle */}
            <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  !isSignUp
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  isSignUp
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="mb-4">
              <h3 className="text-base font-bold text-white">
                {isSignUp ? 'Register New Operational User' : 'Corporate Account Sign In'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSignUp
                  ? 'Create your role profile in the Supabase database'
                  : 'Enter your corporate credentials to sign in'}
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5 text-xs">
              {isSignUp && (
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Chandra"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="user@c2tower.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">
                      Assigned Operational Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="ADMIN">System Administrator (Full Access)</option>
                      <option value="PROCUREMENT_MANAGER">Procurement Manager (PR & POs)</option>
                      <option value="WAREHOUSE_MANAGER">Warehouse Lead (Dock & Yard)</option>
                      <option value="GATE_OPERATOR">Gate Operator (Check-In & Security)</option>
                      <option value="RECEIVING_OPERATOR">Receiving Operator (GRN & QA)</option>
                      <option value="FINANCE_MANAGER">Finance Controller (3-Way Match & Pay)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">
                        Department
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sourcing"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        placeholder="+91 98000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Authenticating...' : isSignUp ? 'Create User Profile' : 'Sign In to Control Tower'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {!isSignUp && (
                <div className="text-center pt-2">
                  <span className="text-[11px] text-slate-400">
                    Test credentials: <code className="text-blue-400">admin@c2tower.com</code> / <code className="text-blue-400">admin123</code>
                  </span>
                </div>
              )}
            </form>
          </div>
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-12 border-t border-slate-800/80 px-6 sm:px-12 flex items-center justify-between text-[11px] text-slate-500 bg-[#0B1120]">
        <span>© 2026 C2 Supply Chain Intelligence Control Tower</span>
        <div className="flex items-center gap-4">
          <span>PostgreSQL v16</span>
          <span>•</span>
          <span>Tailwind v4</span>
          <span>•</span>
          <span>v2.4 Pro</span>
        </div>
      </footer>
    </div>
  );
};

export default Auth;
