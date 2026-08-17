import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Receipt,
  Eye,
  EyeOff,
  Building2,
  KeyRound,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useApp, UserRole } from '../contexts/AppContext';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { login, signUp } = useApp();

  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('WORKER');
  const [department, setDepartment] = useState('Shop Floor & Assembly');
  const [phone, setPhone] = useState('');

  // Supplier-specific fields
  const [supplierName, setSupplierName] = useState('');
  const [supplierCity, setSupplierCity] = useState('');

  // Driver-specific fields
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [carrierName, setCarrierName] = useState('');

  // Automatic department assignment based on the 7 canonical roles
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setErrorMessage('');

    switch (newRole) {
      case 'SYSTEM_ADMIN':
        setDepartment('Global Supply Chain Technical Administration & Operations');
        break;
      case 'WORKER':
        setDepartment('Shop Floor & Assembly Operations');
        break;
      case 'PROCUREMENT_OFFICER':
        setDepartment('Strategic Sourcing & Procurement');
        break;
      case 'SUPPLIER':
        setDepartment('Certified Component Manufacturing');
        break;
      case 'TRUCK_DRIVER':
        setDepartment('Carrier Fleet Highway Transit');
        break;
      case 'LOGISTICS_GATE_POST':
        setDepartment('Inbound Facility Gate & Yard');
        break;
      case 'RECEIVING_QC':
        setDepartment('Dock Receiving Intake & Quality Assurance');
        break;
      case 'FINANCE':
        setDepartment('Financial Controller & Accounts Payable');
        break;
      default:
        setDepartment('Supply Chain Operations');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    const getTargetRoute = (targetRole: string) => {
      switch (targetRole) {
        case 'PROCUREMENT_OFFICER':
        case 'PROCUREMENT_MANAGER':
        case 'ADMIN':
        case 'SYSTEM_ADMIN':
          return '/procurement/dashboard';
        case 'FINANCE':
        case 'FINANCE_MANAGER':
          return '/finance/dashboard';
        case 'WORKER':
          return '/worker/dashboard';
        case 'SUPPLIER':
          return '/supplier/dashboard';
        case 'LOGISTICS_GATE_POST':
        case 'GATE_POST_OFFICER':
        case 'GATE_OPERATOR':
        case 'LOGISTICS':
          return '/logistics/dashboard';
        case 'RECEIVING_QC':
        case 'RECEIVING_QC_OPERATOR':
        case 'RECEIVING_OPERATOR':
          return '/receiving/dashboard';
        case 'TRUCK_DRIVER':
        case 'DRIVER':
          return '/driver/dashboard';
        default:
          return '/';
      }
    };

    try {
      if (isSignUp) {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
          setErrorMessage('Please fill in all required fields.');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters in length.');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setErrorMessage('Passwords do not match. Please verify and re-enter.');
          setLoading(false);
          return;
        }

        const generatedSupplierCode = role === 'SUPPLIER'
          ? `SUP-${Math.floor(1000 + Math.random() * 9000)}`
          : undefined;

        const generatedDriverCode = role === 'TRUCK_DRIVER'
          ? `DRV-2026-${Math.floor(1000 + Math.random() * 9000)}`
          : undefined;

        const res = await signUp({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          department,
          phone: phone.trim() || undefined,
          supplier_name: role === 'SUPPLIER' ? (supplierName.trim() || `${fullName.trim()} Enterprise`) : undefined,
          supplier_code: generatedSupplierCode,
          vehicle_number: role === 'TRUCK_DRIVER' ? (vehicleNumber.trim() || undefined) : undefined,
          carrier_name: role === 'TRUCK_DRIVER' ? (carrierName.trim() || undefined) : undefined,
          driver_code: generatedDriverCode,
        });

        if (res.success) {
          setSuccessMessage('Account created successfully! Signing in...');
          setTimeout(() => {
            navigate(getTargetRoute(role));
          }, 800);
        } else {
          setErrorMessage(res.error || 'Failed to create account.');
        }
      } else {
        if (!email.trim() || !password.trim()) {
          setErrorMessage('Please enter both email and password.');
          setLoading(false);
          return;
        }

        const res = await login(email.trim().toLowerCase(), password);
        if (res.success) {
          const savedUser = JSON.parse(localStorage.getItem('c2_current_user') || '{}');
          const activeRole = savedUser?.role || 'PROCUREMENT_OFFICER';
          navigate(getTargetRoute(activeRole));
        } else {
          setErrorMessage(res.error || 'Invalid email or password.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const featurePillars = [
    {
      icon: Sparkles,
      title: 'AI Requisition & Natural Language PR',
      desc: 'Converts unstructured shop-floor needs into compliant purchase requisitions.',
    },
    {
      icon: Truck,
      title: 'Highway GPS Fleet Telematics',
      desc: 'Real-time transit tracking, geofence check-ins, and dock schedule synchronization.',
    },
    {
      icon: Receipt,
      title: 'Automated 3-Way Match & OCR',
      desc: 'Precision PO, GRN, and invoice reconciliation with variance protection.',
    },
    {
      icon: Layers,
      title: 'Complete 15-Stage Traceability',
      desc: 'End-to-end chain of custody from initial requisition to bank settlement.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Brand Header */}
      <header className="h-16 border-b border-slate-800/80 px-6 sm:px-12 flex items-center justify-between bg-[#0F172A]/70 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black tracking-wider text-white flex items-center gap-2">
              <span>SUPPLY SYNC</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                ENTERPRISE
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              Autonomous Supply Chain Intelligence & Operations
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Production Database Active</span>
        </div>
      </header>

      {/* Main Hero & Auth Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          {/* Left Column: Platform Capabilities Showcase */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Real-Time Autonomous Supply Chain System</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Procurement & Logistics Intelligence Platform
            </h1>

            <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
              Enterprise workflow coordinating Workers, PR Officers, Certified Suppliers, Carrier Fleet Drivers, Logistics & Gate Posts, Receiving QC Leads, and Financial Controllers.
            </p>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {featurePillars.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white">{feat.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{feat.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Unified Login & Registration Form */}
          <div className="lg:col-span-5 bg-[#0F172A] rounded-2xl border border-slate-700/80 p-6 sm:p-7 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

            {/* Card Header & Tabs */}
            <div className="mb-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white tracking-wide">
                      {isSignUp ? 'CREATE YOUR ACCOUNT' : 'SIGN IN'}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {isSignUp
                        ? 'Select your operational role to get started'
                        : 'Sign in to access your role-based dashboard'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
                    setSuccessMessage('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isSignUp
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {/* Quick Demo Login Pills on Sign In */}
            {!isSignUp && (
              <div className="mb-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Quick 1-Click Persona Auto-Fill
                  </span>
                  <span className="text-[10px] text-slate-500">Click to fill credentials</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@supplysync.io');
                      setPassword('admin123');
                    }}
                    className="p-2 rounded-lg bg-purple-950/50 hover:bg-purple-900/70 border border-purple-500/50 text-purple-200 text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all text-left"
                  >
                    <div className="font-extrabold flex items-center gap-1.5">
                      <span>👑</span>
                      <span>System Admin (All Access)</span>
                    </div>
                    <span className="text-[9px] text-purple-300 font-mono bg-purple-900/60 px-1 py-0.5 rounded">admin123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('priya.procurement@supplysync.io');
                      setPassword('demo123');
                    }}
                    className="p-2 rounded-lg bg-blue-950/50 hover:bg-blue-900/70 border border-blue-500/50 text-blue-200 text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all text-left"
                  >
                    <div className="font-extrabold flex items-center gap-1.5">
                      <span>📋</span>
                      <span>Procurement Officer</span>
                    </div>
                    <span className="text-[9px] text-blue-300 font-mono bg-blue-900/60 px-1 py-0.5 rounded">demo123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('alok@gmail.com');
                      setPassword('demo123');
                    }}
                    className="p-2 rounded-lg bg-amber-950/50 hover:bg-amber-900/70 border border-amber-500/50 text-amber-200 text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all text-left"
                  >
                    <div className="font-extrabold flex items-center gap-1.5">
                      <span>🏭</span>
                      <span>Supplier (Alok)</span>
                    </div>
                    <span className="text-[9px] text-amber-300 font-mono bg-amber-900/60 px-1 py-0.5 rounded">demo123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('ananya.paradox@gmail.com');
                      setPassword('demo123');
                    }}
                    className="p-2 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-500/50 text-cyan-200 text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all text-left"
                  >
                    <div className="font-extrabold flex items-center gap-1.5">
                      <span>🚚</span>
                      <span>Driver (Tikiyapara)</span>
                    </div>
                    <span className="text-[9px] text-cyan-300 font-mono bg-cyan-900/60 px-1 py-0.5 rounded">demo123</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-3.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="leading-tight">{errorMessage}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {successMessage && (
              <div className="mb-3.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              {isSignUp && (
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Patil"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. ramesh@supplysync.io"
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
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Exactly Seven Canonical Operational Roles */}
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">
                      Select Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="SYSTEM_ADMIN">👑 System Administrator (All Access)</option>
                      <option value="WORKER">1. Worker</option>
                      <option value="PROCUREMENT_OFFICER">2. PR Officer</option>
                      <option value="SUPPLIER">3. Supplier</option>
                      <option value="TRUCK_DRIVER">4. Carrier Fleet Driver</option>
                      <option value="LOGISTICS_GATE_POST">5. Logistics & Gate Post</option>
                      <option value="RECEIVING_QC">6. Receiver & QC Lead</option>
                      <option value="FINANCE">7. Finance Controller</option>
                    </select>
                  </div>

                  {/* Supplier-Specific Dynamic Fields */}
                  {role === 'SUPPLIER' && (
                    <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-2">
                      <div className="flex items-center gap-1.5 text-orange-400 font-bold text-[11px]">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Supplier Business Information</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="reg-sup-name" className="font-medium text-slate-300 block mb-0.5 text-[11px]">
                            Company Name
                          </label>
                          <input
                            id="reg-sup-name"
                            type="text"
                            placeholder="e.g. Apex Industrial Solutions"
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:outline-hidden focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="reg-sup-city" className="font-medium text-slate-300 block mb-0.5 text-[11px]">
                            City / Sourcing Hub
                          </label>
                          <input
                            id="reg-sup-city"
                            type="text"
                            placeholder="e.g. Mumbai Hub"
                            value={supplierCity}
                            onChange={(e) => setSupplierCity(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:outline-hidden focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="reg-sup-phone" className="font-medium text-slate-300 block mb-0.5 text-[11px]">
                          Business Contact Phone <span className="text-orange-400">*</span>
                        </label>
                        <input
                          id="reg-sup-phone"
                          type="tel"
                          placeholder="+91 98200 11000"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:outline-hidden focus:border-blue-500"
                        />
                      </div>
                      <span className="text-[10px] text-orange-300 block">
                        A unique <strong>Supplier ID</strong> (e.g. SUP-XXXX) will be generated and linked to all your POs, shipments, and invoices.
                      </span>
                    </div>
                  )}

                  {/* Driver-Specific Dynamic Fields */}
                  {role === 'TRUCK_DRIVER' && (
                    <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-2">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Carrier Fleet Driver Information</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="reg-drv-veh" className="font-medium text-slate-300 block mb-0.5 text-[11px]">
                            Assigned Vehicle Number
                          </label>
                          <input
                            id="reg-drv-veh"
                            type="text"
                            placeholder="e.g. MH-12-AB-9901"
                            value={vehicleNumber}
                            onChange={(e) => setVehicleNumber(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:outline-hidden focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="reg-drv-carrier" className="font-medium text-slate-300 block mb-0.5 text-[11px]">
                            Carrier Fleet Name
                          </label>
                          <input
                            id="reg-drv-carrier"
                            type="text"
                            placeholder="e.g. BlueDart Logistics"
                            value={carrierName}
                            onChange={(e) => setCarrierName(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:outline-hidden focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="reg-drv-phone" className="font-medium text-slate-300 block mb-0.5 text-[11px]">
                          Driver Operational Phone <span className="text-cyan-400">*</span>
                        </label>
                        <input
                          id="reg-drv-phone"
                          type="tel"
                          placeholder="+91 98234 56789"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:outline-hidden focus:border-blue-500"
                        />
                      </div>
                      <span className="text-[10px] text-cyan-300 block">
                        A unique <strong>Driver ID</strong> (e.g. DRV-2026-XXXX) will be generated for carrier dispatch and highway transit.
                      </span>
                    </div>
                  )}

                  {role !== 'SUPPLIER' && role !== 'TRUCK_DRIVER' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="reg-dept" className="font-semibold text-slate-300 block mb-1">
                          Department
                        </label>
                        <input
                          id="reg-dept"
                          type="text"
                          placeholder="e.g. Operations"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="reg-phone" className="font-semibold text-slate-300 block mb-1">
                          Contact Phone Number
                        </label>
                        <input
                          id="reg-phone"
                          type="tel"
                          placeholder="+91 98000 12345"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white font-medium focus:outline-hidden focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Authenticating...'
                    : isSignUp
                    ? 'Create Account'
                    : 'Sign In'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 text-center">
              {isSignUp ? (
                <span>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setIsSignUp(false);
                      setErrorMessage('');
                    }}
                    className="text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </span>
              ) : (
                <span>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setIsSignUp(true);
                      setErrorMessage('');
                    }}
                    className="text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-800/80 px-6 sm:px-12 flex items-center justify-between text-[11px] text-slate-500 bg-[#0B1120]">
        <span>© 2026 Supply Sync — Autonomous Supply Chain Intelligence Platform</span>
        <div className="flex items-center gap-4">
          <span>PostgreSQL v16</span>
          <span>•</span>
          <span>Tailwind CSS</span>
          <span>•</span>
          <span>Supply Sync v8.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Auth;
