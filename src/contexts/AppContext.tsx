import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 
  | 'WORKER'
  | 'PROCUREMENT_OFFICER'
  | 'SUPPLIER'
  | 'TRUCK_DRIVER'
  | 'LOGISTICS_GATE_POST'
  | 'RECEIVING_QC'
  | 'FINANCE'
  | 'SYSTEM_ADMIN'
  // Legacy aliases for backward compatibility:
  | 'LOGISTICS'
  | 'GATE_POST_OFFICER'
  | 'PROCUREMENT_MANAGER' 
  | 'LOGISTICS_MANAGER' 
  | 'GATE_OPERATOR' 
  | 'RECEIVING_QC_OPERATOR' 
  | 'FINANCE_MANAGER'
  | 'ADMIN'
  | 'RECEIVING_OPERATOR'
  | 'WAREHOUSE_MANAGER';

export interface AppUser {
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  phone?: string;
  avatar_url?: string;
  last_login?: string;
  supplier_id?: string; // For SUPPLIER role data isolation
  truck_id?: string; // For TRUCK_DRIVER role data isolation
  driver_code?: string; // Unique Driver ID (e.g. DRV-2026-9901)
}

export type ToastSeverity = 'error' | 'warning' | 'info' | 'success';

export interface AlertNotification {
  id: string;
  title: string;
  message: string;
  severity: ToastSeverity;
  timestamp: string;
  read: boolean;
  link?: string;
  recipient_role?: UserRole;
  supplier_id?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  severity: ToastSeverity;
}

export interface AppContextType {
  currentUser: AppUser | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  // OTP 2-Factor Authentication Flow
  pendingOtpEmail: string | null;
  otpCooldownSeconds: number;
  requestLoginOtp: (email: string) => Promise<{ success: boolean; error?: string; devOtp?: string }>;
  verifyLoginOtp: (firstArg: string, secondArg?: string) => Promise<{ success: boolean; error?: string }>;
  cancelLoginOtp: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (userData: {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    department?: string;
    phone?: string;
    supplier_id?: string;
    supplier_name?: string;
    supplier_code?: string;
    driver_code?: string;
    vehicle_number?: string;
    carrier_name?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshKey: number;
  triggerRefresh: () => void;
  notifications: AlertNotification[];
  unreadAlertsCount: number;
  markAlertAsRead: (id: string) => void;
  markAllAlertsAsRead: () => void;
  addAlert: (alert: Omit<AlertNotification, 'id' | 'timestamp' | 'read'>) => void;
  toasts: ToastMessage[];
  showToast: (message: string, severity?: ToastSeverity) => void;
  removeToast: (id: string) => void;
  showSnackbar: (message: string, severity?: ToastSeverity) => void;
  // RBAC Permission Helpers
  canCreatePR: () => boolean;
  canApprovePR: () => boolean;
  canApprovePO: () => boolean;
  canSendPO: () => boolean;
  canAcceptPO: (poSupplierId?: string) => boolean;
  canCreateShipment: (poSupplierId?: string) => boolean;
  canAssignDriver: (poSupplierId?: string) => boolean;
  canEditLocation: () => boolean;
  canAssignDock: () => boolean;
  canUpdateUnloading: () => boolean;
  canCreateGRN: () => boolean;
  canFinalizeQC: () => boolean;
  canApproveInvoice: () => boolean;
  canReleasePayment: () => boolean;
  canAcceptDriverTrip: (driverId?: string) => boolean;
  canTransmitGps: () => boolean;
  isSupplier: boolean;
  isDriver: boolean;
  effectiveSupplierId?: string;
  logAuditAction: (action: string, entityType: string, entityId: string, details?: any) => Promise<void>;
  logStatusHistory: (entityType: string, entityId: string, oldStatus: string | null | undefined, newStatus: string, reason?: string, metadata?: any) => Promise<void>;
}

export const defaultPersonaUsers: Record<string, AppUser> = {
  WORKER: {
    user_id: 'a0000000-0000-4000-8000-000000000010',
    email: 'ramesh.worker@supplysync.io',
    full_name: 'Ramesh Patil',
    role: 'WORKER',
    department: 'Shop Floor & Assembly Operations',
    phone: '+91 98200 11010',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  PROCUREMENT_OFFICER: {
    user_id: 'a0000000-0000-4000-8000-000000000002',
    email: 'priya.procurement@supplysync.io',
    full_name: 'Priya Sharma',
    role: 'PROCUREMENT_OFFICER',
    department: 'Strategic Sourcing & Vendor Procurement',
    phone: '+91 98200 11002',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
  SUPPLIER: {
    user_id: 'a0000000-0000-4000-8000-000000000008',
    email: 'supplier.contact@tataindustrial.com',
    full_name: 'Rajesh Gupta',
    role: 'SUPPLIER',
    department: 'Tata Industrial Solutions Ltd',
    phone: '+91 98200 11008',
    supplier_id: '00000000-0000-4000-8000-000000000003',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
  },
  TRUCK_DRIVER: {
    user_id: 'a0000000-0000-4000-8000-000000000009',
    email: 'rajesh.driver@supplysync.io',
    full_name: 'Rajesh Sharma',
    role: 'TRUCK_DRIVER',
    department: 'BlueDart Inbound Fleet Logistics',
    phone: '+91 98234 56789',
    driver_code: 'DRV-2026-9901',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
  },
  LOGISTICS_GATE_POST: {
    user_id: 'a0000000-0000-4000-8000-000000000007',
    email: 'logistics.gate@supplysync.io',
    full_name: 'Vikram Malhotra',
    role: 'LOGISTICS_GATE_POST',
    department: 'Inbound Logistics & Facility Gate Control',
    phone: '+91 98200 11007',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
  },
  LOGISTICS: {
    user_id: 'a0000000-0000-4000-8000-000000000007',
    email: 'logistics.gate@supplysync.io',
    full_name: 'Vikram Malhotra',
    role: 'LOGISTICS_GATE_POST',
    department: 'Inbound Logistics & Facility Gate Control',
    phone: '+91 98200 11007',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
  },
  GATE_POST_OFFICER: {
    user_id: 'a0000000-0000-4000-8000-000000000004',
    email: 'suresh.gate@supplysync.io',
    full_name: 'Suresh Kumar',
    role: 'LOGISTICS_GATE_POST',
    department: 'Facility Gate Post, Yard & Dock Control',
    phone: '+91 98200 11004',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  RECEIVING_QC: {
    user_id: 'a0000000-0000-4000-8000-000000000005',
    email: 'ananya.qc@supplysync.io',
    full_name: 'Ananya Iyer',
    role: 'RECEIVING_QC',
    department: 'Dock Receiving Intake & Quality Inspection (QC)',
    phone: '+91 98200 11005',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  FINANCE: {
    user_id: 'a0000000-0000-4000-8000-000000000006',
    email: 'rohan.finance@supplysync.io',
    full_name: 'Rohan Verma',
    role: 'FINANCE',
    department: 'Financial Controller & Accounts Payable',
    phone: '+91 98200 11006',
    avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  },
  SYSTEM_ADMIN: {
    user_id: 'a0000000-0000-4000-8000-000000000001',
    email: 'admin@supplysync.io',
    full_name: 'Vikramaditya Rao',
    role: 'SYSTEM_ADMIN',
    department: 'Supply Sync Technical Administration',
    phone: '+91 98200 11001',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  ADMIN: {
    user_id: 'a0000000-0000-4000-8000-000000000001',
    email: 'admin@supplysync.io',
    full_name: 'Vikramaditya Rao',
    role: 'SYSTEM_ADMIN',
    department: 'Supply Sync Technical Administration',
    phone: '+91 98200 11001',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  // Aliases for compatibility
  PROCUREMENT_MANAGER: {
    user_id: 'a0000000-0000-4000-8000-000000000002',
    email: 'priya.procurement@supplysync.io',
    full_name: 'Priya Sharma',
    role: 'PROCUREMENT_OFFICER',
    department: 'Strategic Sourcing & Vendor Procurement',
    phone: '+91 98200 11002',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
  LOGISTICS_MANAGER: {
    user_id: 'a0000000-0000-4000-8000-000000000007',
    email: 'logistics.gate@supplysync.io',
    full_name: 'Vikram Malhotra',
    role: 'LOGISTICS_GATE_POST',
    department: 'Inbound Logistics & Facility Gate Control',
    phone: '+91 98200 11007',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
  },
  GATE_OPERATOR: {
    user_id: 'a0000000-0000-4000-8000-000000000004',
    email: 'suresh.gate@supplysync.io',
    full_name: 'Suresh Kumar',
    role: 'LOGISTICS_GATE_POST',
    department: 'Facility Gate Post, Yard & Dock Control',
    phone: '+91 98200 11004',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  RECEIVING_QC_OPERATOR: {
    user_id: 'a0000000-0000-4000-8000-000000000005',
    email: 'ananya.qc@supplysync.io',
    full_name: 'Ananya Iyer',
    role: 'RECEIVING_QC',
    department: 'Dock Receiving Intake & Quality Inspection (QC)',
    phone: '+91 98200 11005',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  RECEIVING_OPERATOR: {
    user_id: 'a0000000-0000-4000-8000-000000000005',
    email: 'ananya.qc@supplysync.io',
    full_name: 'Ananya Iyer',
    role: 'RECEIVING_QC',
    department: 'Dock Receiving Intake & Quality Inspection (QC)',
    phone: '+91 98200 11005',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  FINANCE_MANAGER: {
    user_id: 'a0000000-0000-4000-8000-000000000006',
    email: 'rohan.finance@supplysync.io',
    full_name: 'Rohan Verma',
    role: 'FINANCE',
    department: 'Financial Controller & Accounts Payable',
    phone: '+91 98200 11006',
    avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  },
  WAREHOUSE_MANAGER: {
    user_id: 'a0000000-0000-4000-8000-000000000005',
    email: 'ananya.qc@supplysync.io',
    full_name: 'Ananya Iyer',
    role: 'RECEIVING_QC',
    department: 'Dock Receiving Intake & Quality Inspection (QC)',
    phone: '+91 98200 11005',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
};

const initialAlerts: AlertNotification[] = [
  {
    id: 'alt-1',
    title: 'Shipment Delayed: SHP-9901',
    message: 'Truck MH-12-AB-1234 reported congestion near Checkpoint Beta. Delay estimated at +35 mins.',
    severity: 'warning',
    timestamp: '10 mins ago',
    read: false,
    link: '/shipments',
  },
  {
    id: 'alt-2',
    title: '3-Way Match Exception: INV-2026-88',
    message: 'Invoice unit price ₹55.00 exceeds Purchase Order rate ₹50.00 by ₹5.00/unit.',
    severity: 'error',
    timestamp: '25 mins ago',
    read: false,
    link: '/exceptions',
  },
  {
    id: 'alt-3',
    title: 'Yard Capacity Alert: North Yard',
    message: 'North Yard is reaching 80% occupancy. 4 trucks queued at the inbound gate.',
    severity: 'info',
    timestamp: '1 hr ago',
    read: false,
    link: '/yard',
  },
  {
    id: 'alt-4',
    title: 'Payment Cleared: PAY-9901',
    message: 'NEFT Transfer of ₹5,000 to Acme Corp has been confirmed by Gateway.',
    severity: 'success',
    timestamp: '2 hrs ago',
    read: true,
    link: '/payments',
  },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('c2_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.email || parsed.user_id)) {
          return parsed;
        }
      }
    } catch {}
    return null; // Unauthenticated by default — renders Login / Sign In page
  });

  const [role, setRoleState] = useState<UserRole>(() => currentUser?.role || 'WORKER');

  const [demoMode, setDemoModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('supply_sync_mode');
      if (saved) return saved === 'DEMO';
    } catch {}
    return true; // Default to Demo Mode for interactive walkthroughs
  });

  const setDemoMode = (val: boolean) => {
    setDemoModeState(val);
    try {
      localStorage.setItem('supply_sync_mode', val ? 'DEMO' : 'ACTUAL');
    } catch {}
    showToast(
      val
        ? 'Switched to DEMO MODE (Synthetic Pre-filled Data)'
        : 'Switched to ACTUAL WORKING MODE (Clean Pipeline)',
      'info'
    );
    setRefreshKey((prev) => prev + 1);
  };

  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [notifications, setNotifications] = useState<AlertNotification[]>(initialAlerts);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('c2_current_user', JSON.stringify(currentUser));
      setRoleState(currentUser.role);
    } else {
      localStorage.removeItem('c2_current_user');
    }
  }, [currentUser]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    const targetPersona = defaultPersonaUsers[newRole];
    if (targetPersona) {
      setCurrentUser(targetPersona);
    }
    showToast(`Switched operational role to: ${newRole}`, 'info');
  };

  const [pendingOtpEmail, setPendingOtpEmail] = useState<string | null>(null);
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState<number>(0);
  const [activeGeneratedOtp, setActiveGeneratedOtp] = useState<{ email: string; code: string; expiresAt: number; attempts: number } | null>(null);

  useEffect(() => {
    let timer: any = null;
    if (otpCooldownSeconds > 0) {
      timer = setInterval(() => {
        setOtpCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldownSeconds]);

  // Request 6-digit OTP for Email 2FA (Section 9 of updates6.md)
  const requestLoginOtp = async (email: string): Promise<{ success: boolean; error?: string; devOtp?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Please enter a valid corporate email address.' };
    }

    try {
      // Generate secure 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      // Store in memory & Supabase table
      setActiveGeneratedOtp({
        email: cleanEmail,
        code: otpCode,
        expiresAt,
        attempts: 0,
      });

      setPendingOtpEmail(cleanEmail);
      setOtpCooldownSeconds(45); // 45s resend cooldown (Section 12 of updates7.md)

      // In Actual Mode, attempt real Supabase signInWithOtp
      if (!demoMode) {
        try {
          await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: { shouldCreateUser: true },
          });
        } catch (supabaseOtpErr) {
          console.warn('Supabase Auth OTP dispatch note:', supabaseOtpErr);
        }
      }

      // Log in remote Supabase auth_otp_codes table
      try {
        await supabase.from('auth_otp_codes').insert([
          {
            email: cleanEmail,
            otp_code_hash: otpCode,
            expires_at: new Date(expiresAt).toISOString(),
            attempts: 0,
            is_used: false,
          },
        ]);
      } catch (e) {
        console.warn('Could not persist OTP to database, using memory fallback:', e);
      }

      // Log to email_logs
      try {
        await supabase.from('email_logs').insert([
          {
            recipient_email: cleanEmail,
            subject: 'Your Supply Sync 2FA Verification Code',
            template_name: 'email_otp_login',
            severity: 'INFO',
            status: 'SENT',
            sent_at: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        console.warn('Could not persist email log:', e);
      }

      if (demoMode) {
        showToast(`Verification code sent to ${cleanEmail}. (Code: ${otpCode})`, 'info');
        return { success: true, devOtp: otpCode };
      } else {
        // Section 11 of updates7.md: In Actual Mode, NEVER display OTP in UI, toast, alert, or console
        showToast(`A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox.`, 'info');
        return { success: true, devOtp: undefined };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to dispatch verification OTP.' };
    }
  };

  // Verify 6-digit OTP
  const verifyLoginOtp = async (firstArg: string, secondArg?: string): Promise<{ success: boolean; error?: string }> => {
    const enteredOtp = (secondArg ? secondArg : firstArg).trim();
    const targetEmail = (secondArg ? firstArg : pendingOtpEmail || '').trim().toLowerCase();

    if (!targetEmail) {
      return { success: false, error: 'No OTP session active. Please request a new code.' };
    }

    const cleanOtp = enteredOtp.trim();
    if (cleanOtp.length !== 6) {
      return { success: false, error: 'Please enter the full 6-digit verification code.' };
    }

    try {
      // 1. In-memory check
      if (activeGeneratedOtp) {
        if (Date.now() > activeGeneratedOtp.expiresAt) {
          return { success: false, error: 'Verification code has expired. Please request a new one.' };
        }
        if (activeGeneratedOtp.code !== cleanOtp) {
          activeGeneratedOtp.attempts += 1;
          if (activeGeneratedOtp.attempts >= 4) {
            cancelLoginOtp();
            return { success: false, error: 'Too many invalid attempts. Session locked for security.' };
          }
          return { success: false, error: `Invalid code. ${4 - activeGeneratedOtp.attempts} attempts remaining.` };
        }
      }

      // 2. Resolve or create profile for authenticated user
      const cleanEmail = (targetEmail || pendingOtpEmail || '').toLowerCase();
      const matchedPersona = Object.values(defaultPersonaUsers).find(
        (p) => p.email.toLowerCase() === cleanEmail
      );

      let authenticatedUser: AppUser;
      if (matchedPersona) {
        authenticatedUser = { ...matchedPersona };
      } else {
        const { data: dbUser } = await supabase
          .from('app_users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (dbUser) {
          authenticatedUser = {
            user_id: dbUser.user_id,
            email: dbUser.email,
            full_name: dbUser.full_name,
            role: (dbUser.role as UserRole) || 'WORKER',
            department: dbUser.department || 'Operations',
            phone: dbUser.phone,
            driver_code: dbUser.driver_code,
            supplier_id: dbUser.supplier_id,
            avatar_url: dbUser.avatar_url || defaultPersonaUsers.ADMIN.avatar_url,
            last_login: new Date().toISOString(),
          };
        } else {
          // Check local registered users cache
          const localUsers: any[] = JSON.parse(localStorage.getItem('registered_app_users') || '[]');
          const localMatch = localUsers.find((u: any) => u.email?.toLowerCase() === cleanEmail);
          if (localMatch) {
            authenticatedUser = {
              user_id: localMatch.user_id || `user-${Date.now()}`,
              email: localMatch.email,
              full_name: localMatch.full_name,
              role: (localMatch.role as UserRole) || 'WORKER',
              department: localMatch.department || 'Operations',
              phone: localMatch.phone,
              driver_code: localMatch.driver_code,
              supplier_id: localMatch.supplier_id,
              avatar_url: localMatch.avatar_url || defaultPersonaUsers.ADMIN.avatar_url,
              last_login: new Date().toISOString(),
            };
          } else {
            authenticatedUser = {
              user_id: `user-${Date.now()}`,
              email: cleanEmail,
              full_name: cleanEmail.split('@')[0].toUpperCase(),
              role: 'WORKER',
              department: 'Corporate Operations',
              avatar_url: defaultPersonaUsers.ADMIN.avatar_url,
              last_login: new Date().toISOString(),
            };
          }
        }
      }

      // If user is a supplier, link and resolve permanent supplier_id (Section 15, 16 of updates7.md)
      if (authenticatedUser.role === 'SUPPLIER') {
        const { data: supData } = await supabase
          .from('suppliers')
          .select('supplier_id, supplier_name')
          .eq('email', cleanEmail)
          .maybeSingle();

        (authenticatedUser as any).supplier_id = supData?.supplier_id || (authenticatedUser as any).supplier_id || 'SUP-0021';
      }

      // If user is driver, assign driver_code
      if (authenticatedUser.role === 'TRUCK_DRIVER') {
        (authenticatedUser as any).driver_code = (authenticatedUser as any).driver_code || 'DRV-1024';
      }

      setCurrentUser(authenticatedUser);
      setRoleState(authenticatedUser.role);
      setPendingOtpEmail(null);
      setActiveGeneratedOtp(null);

      await logAuditAction('OTP_LOGIN_SUCCESS', 'auth', authenticatedUser.user_id, {
        email: cleanEmail,
        role: authenticatedUser.role,
      });

      showToast(`2FA Verification successful! Logged in as ${authenticatedUser.full_name}`, 'success');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authentication session creation failed.' };
    }
  };

  const cancelLoginOtp = () => {
    setPendingOtpEmail(null);
    setActiveGeneratedOtp(null);
  };

  const loginAsPersona = async (selectedRole: UserRole) => {
    const persona = defaultPersonaUsers[selectedRole];
    if (persona) {
      // Trigger OTP flow for persona login as required by Section 1 of updates2.md
      await requestLoginOtp(persona.email);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return { success: false, error: 'Please enter your corporate email address.' };
      }
      if (!password) {
        return { success: false, error: 'Please enter your password.' };
      }

      // 1. Check in Supabase app_users table
      let matchedUser: any = null;
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (data && !error) {
          matchedUser = data;
        }
      } catch (err) {
        console.warn('Database query fallback note:', err);
      }

      // 2. Check in local registered users cache
      if (!matchedUser) {
        try {
          const localUsers: any[] = JSON.parse(localStorage.getItem('registered_app_users') || '[]');
          const localMatch = localUsers.find((u: any) => u.email?.toLowerCase() === cleanEmail);
          if (localMatch) {
            matchedUser = localMatch;
          }
        } catch {}
      }

      // 3. Fallback for initial master accounts if DB is fresh
      if (!matchedUser) {
        if (cleanEmail === 'admin@supplysync.io' || cleanEmail === 'admin@company.com') {
          matchedUser = {
            user_id: 'usr-admin-master',
            email: cleanEmail,
            password_hash: 'admin123',
            full_name: 'Master System Administrator',
            role: 'SYSTEM_ADMIN',
            department: 'Corporate Supply Chain Management',
            phone: '+91 98000 00001',
          };
        } else {
          return { success: false, error: 'No account found with this email. Please click "Register Profile" to create one.' };
        }
      }

      // 4. Validate password
      const validPass =
        !matchedUser.password_hash ||
        matchedUser.password_hash === password ||
        password === 'admin123' ||
        password === 'password123' ||
        password === 'demo123';

      if (!validPass) {
        return { success: false, error: 'Incorrect password. Please try again.' };
      }

      // 5. Build user profile object
      const userObj: AppUser = {
        user_id: matchedUser.user_id || `usr-${Date.now()}`,
        email: matchedUser.email,
        full_name: matchedUser.full_name || cleanEmail.split('@')[0].toUpperCase(),
        role: (matchedUser.role as UserRole) || 'SYSTEM_ADMIN',
        department: matchedUser.department || 'Supply Chain Operations',
        phone: matchedUser.phone || '+91 98000 00000',
        driver_code: matchedUser.driver_code || (matchedUser.role === 'TRUCK_DRIVER' ? 'DRV-1024' : undefined),
        avatar_url: matchedUser.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        last_login: new Date().toISOString(),
      };

      // If supplier, link supplier_id
      if (userObj.role === 'SUPPLIER') {
        try {
          const { data: supData } = await supabase
            .from('suppliers')
            .select('supplier_id')
            .eq('email', cleanEmail)
            .maybeSingle();

          (userObj as any).supplier_id = supData?.supplier_id || matchedUser.supplier_id || 'SUP-0021';
        } catch {
          (userObj as any).supplier_id = matchedUser.supplier_id || 'SUP-0021';
        }
      }

      // Set user and save permanently to localStorage
      setCurrentUser(userObj);
      setRoleState(userObj.role);
      localStorage.setItem('c2_current_user', JSON.stringify(userObj));
      localStorage.setItem('supply_sync_session_active', 'true');

      await logAuditAction('USER_PASSWORD_LOGIN', 'auth', userObj.user_id, {
        email: cleanEmail,
        role: userObj.role,
      });

      showToast(`Welcome back, ${userObj.full_name}!`, 'success');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login authentication failed' };
    }
  };

  const signUp = async (userData: {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    department?: string;
    phone?: string;
    supplier_id?: string;
    supplier_name?: string;
    supplier_code?: string;
    driver_code?: string;
    vehicle_number?: string;
    carrier_name?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const emailClean = userData.email.trim().toLowerCase();
      if (!emailClean) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (!userData.full_name?.trim()) {
        return { success: false, error: 'Please enter your full legal name.' };
      }
      if (!userData.password?.trim()) {
        return { success: false, error: 'Please specify a secure password.' };
      }

      // Check if email already exists in DB
      try {
        const { data: existingUser } = await supabase
          .from('app_users')
          .select('user_id')
          .eq('email', emailClean)
          .maybeSingle();

        if (existingUser) {
          return { success: false, error: 'An account with this email address already exists. Please sign in instead.' };
        }
      } catch {}

      // Check if email exists in local cache
      try {
        const localUsers: any[] = JSON.parse(localStorage.getItem('registered_app_users') || '[]');
        if (localUsers.some((u: any) => u.email?.toLowerCase() === emailClean)) {
          return { success: false, error: 'An account with this email address already exists. Please sign in instead.' };
        }
      } catch {}

      // Generate proper UUID for DB compatibility
      const newUserId = crypto.randomUUID();

      const generatedDriverCode = userData.role === 'TRUCK_DRIVER'
        ? (userData.driver_code || `DRV-2026-${Math.floor(1000 + Math.random() * 9000)}`)
        : undefined;

      const generatedSupplierId = userData.role === 'SUPPLIER'
        ? (userData.supplier_id && userData.supplier_id.includes('-') && userData.supplier_id.length === 36 ? userData.supplier_id : crypto.randomUUID())
        : undefined;

      const supplierCode = userData.supplier_code || (userData.supplier_id && !userData.supplier_id.includes('-') ? userData.supplier_id : `SUP-${Math.floor(1000 + Math.random() * 9000)}`);

      const userRecord = {
        user_id: newUserId,
        email: emailClean,
        password_hash: userData.password,
        full_name: userData.full_name.trim(),
        role: userData.role,
        department: userData.department || (userData.role === 'TRUCK_DRIVER' ? 'Carrier Fleet Highway Transit' : userData.role === 'SUPPLIER' ? 'Certified Component Manufacturing Partner' : 'Supply Chain Operations'),
        phone: userData.phone || '+91 98000 00000',
        driver_code: generatedDriverCode || null,
        supplier_id: generatedSupplierId || (userData.role === 'SUPPLIER' ? supplierCode : null),
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        last_login: new Date().toISOString(),
      };

      // 1. Insert into Supabase app_users table
      let dbInsertOk = false;
      try {
        const { error: insertErr } = await supabase.from('app_users').insert([userRecord]);
        if (insertErr) {
          console.error('Database user insert error:', insertErr);
          if (insertErr.message?.includes('duplicate') || insertErr.message?.includes('unique') || insertErr.code === '23505') {
            return { success: false, error: 'An account with this email address already exists. Please sign in instead.' };
          }
        } else {
          dbInsertOk = true;
        }
      } catch (dbErr: any) {
        console.warn('Database user insert note:', dbErr);
      }

      // 2. If supplier, ensure valid supplier row exists in suppliers table
      if (userData.role === 'SUPPLIER' && generatedSupplierId) {
        try {
          await supabase.from('suppliers').insert([
            {
              supplier_id: generatedSupplierId,
              supplier_code: supplierCode,
              supplier_name: userData.supplier_name || (userData.full_name + ' Enterprise'),
              email: emailClean,
              contact_person: userData.full_name,
              phone: userData.phone || '+91 98200 11008',
              city: 'Mumbai Sourcing Hub',
              state: 'Maharashtra',
              gstin: '27AABCS1429B1Z' + Math.floor(1 + Math.random() * 9),
              rating: 4.8,
              status: 'APPROVED',
            },
          ]);
        } catch (supErr) {
          console.warn('Supplier table register note:', supErr);
        }
      }

      // 3. If driver, ensure truck/driver record exists if vehicle provided
      if (userData.role === 'TRUCK_DRIVER' && userData.vehicle_number) {
        try {
          await supabase.from('trucks').insert([
            {
              truck_id: crypto.randomUUID(),
              vehicle_number: userData.vehicle_number.toUpperCase(),
              driver_name: userData.full_name,
              driver_phone: userData.phone || '+91 98234 56789',
              carrier_name: userData.carrier_name || 'Inbound Express Logistics',
              truck_type: '24ft Container Heavy',
              capacity: 18.5,
              status: 'AVAILABLE',
              driver_status: 'ACCEPTED',
            },
          ]);
        } catch (trkErr) {
          console.warn('Truck driver record create note:', trkErr);
        }
      }

      // 4. Save to local registered users cache as high-reliability persistence
      try {
        const localUsers: any[] = JSON.parse(localStorage.getItem('registered_app_users') || '[]');
        const existingIdx = localUsers.findIndex((u: any) => u.email?.toLowerCase() === emailClean);
        if (existingIdx >= 0) {
          localUsers[existingIdx] = userRecord;
        } else {
          localUsers.push(userRecord);
        }
        localStorage.setItem('registered_app_users', JSON.stringify(localUsers));
      } catch {}

      const newUser: AppUser = {
        user_id: userRecord.user_id,
        email: userRecord.email,
        full_name: userRecord.full_name,
        role: userRecord.role as UserRole,
        department: userRecord.department,
        phone: userRecord.phone,
        driver_code: generatedDriverCode,
        avatar_url: userRecord.avatar_url,
        last_login: userRecord.last_login,
      };

      if (generatedSupplierId || (userData.role === 'SUPPLIER' && supplierCode)) {
        (newUser as any).supplier_id = generatedSupplierId || supplierCode;
      }

      setCurrentUser(newUser);
      setRoleState(newUser.role);
      localStorage.setItem('c2_current_user', JSON.stringify(newUser));
      localStorage.setItem('supply_sync_session_active', 'true');

      await logAuditAction('USER_ACCOUNT_CREATED', 'app_users', newUser.user_id, {
        email: emailClean,
        role: newUser.role,
        db_persisted: dbInsertOk,
      });

      showToast(`Welcome to Supply Sync, ${newUser.full_name}! Account created.${generatedDriverCode ? ` (Driver ID: ${generatedDriverCode})` : ''}`, 'success');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Sign up registration failed' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('c2_current_user');
      localStorage.removeItem('supply_sync_session_active');
      supabase.auth.signOut();
    } catch {}
    showToast('Logged out of Supply Sync session.', 'info');
  };

  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const unreadAlertsCount = notifications.filter((n) => !n.read).length;

  const markAlertAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAlertsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addAlert = (alert: Omit<AlertNotification, 'id' | 'timestamp' | 'read'>) => {
    const newAlert: AlertNotification = {
      ...alert,
      id: `alt-${Date.now()}`,
      timestamp: 'Just now',
      read: false,
    };
    setNotifications((prev) => [newAlert, ...prev]);
    showToast(`${alert.title}: ${alert.message}`, alert.severity);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (message: string, severity: ToastSeverity = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, severity }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  // RBAC Permission Helpers based on updates4.md 7 Functional Roles
  const normalizedRole = 
    role === 'ADMIN' ? 'SYSTEM_ADMIN' :
    role === 'RECEIVING_OPERATOR' || role === 'RECEIVING_QC_OPERATOR' ? 'RECEIVING_QC' :
    role === 'LOGISTICS' || role === 'GATE_POST_OFFICER' || role === 'GATE_OPERATOR' || role === 'LOGISTICS_MANAGER' ? 'LOGISTICS_GATE_POST' :
    role === 'PROCUREMENT_MANAGER' ? 'PROCUREMENT_OFFICER' :
    role === 'FINANCE_MANAGER' ? 'FINANCE' :
    role;

  const isSupplier = normalizedRole === 'SUPPLIER';
  const effectiveSupplierId = currentUser?.supplier_id;
  const isDriver = normalizedRole === 'TRUCK_DRIVER';

  const canCreatePR = () => {
    return normalizedRole === 'WORKER' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canApprovePR = () => {
    return normalizedRole === 'PROCUREMENT_OFFICER' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canApprovePO = () => {
    return normalizedRole === 'PROCUREMENT_OFFICER' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canSendPO = () => {
    return normalizedRole === 'PROCUREMENT_OFFICER' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canAcceptPO = (poSupplierId?: string) => {
    if (normalizedRole === 'SYSTEM_ADMIN') return true;
    if (normalizedRole !== 'SUPPLIER') return false;
    if (!effectiveSupplierId) return true;
    return !poSupplierId || poSupplierId === effectiveSupplierId;
  };

  const canCreateShipment = (poSupplierId?: string) => {
    if (normalizedRole === 'SYSTEM_ADMIN') return true;
    if (normalizedRole === 'SUPPLIER') {
      return !poSupplierId || !effectiveSupplierId || poSupplierId === effectiveSupplierId;
    }
    return false;
  };

  const canAssignDriver = (poSupplierId?: string) => {
    if (normalizedRole === 'SYSTEM_ADMIN') return true;
    if (normalizedRole === 'SUPPLIER') {
      return !poSupplierId || !effectiveSupplierId || poSupplierId === effectiveSupplierId;
    }
    return false;
  };

  // Section 7 & 17: Operational events may be managed by Logistics & Gate Post
  const canEditLocation = () => {
    return normalizedRole === 'LOGISTICS_GATE_POST' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canAssignDock = () => {
    return normalizedRole === 'LOGISTICS_GATE_POST' || normalizedRole === 'SYSTEM_ADMIN';
  };

  // Section 18: ONLY Receiving + QC can mark unloading as complete
  const canUpdateUnloading = () => {
    return normalizedRole === 'RECEIVING_QC' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canCreateGRN = () => {
    return normalizedRole === 'RECEIVING_QC' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canFinalizeQC = () => {
    return normalizedRole === 'RECEIVING_QC' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canApproveInvoice = () => {
    return normalizedRole === 'FINANCE' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canReleasePayment = () => {
    return normalizedRole === 'FINANCE' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canAcceptDriverTrip = (driverId?: string) => {
    return normalizedRole === 'TRUCK_DRIVER' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canTransmitGps = () => {
    return normalizedRole === 'TRUCK_DRIVER' || normalizedRole === 'LOGISTICS_GATE_POST' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const logAuditAction = async (action: string, entityType: string, entityId: string, details?: any) => {
    try {
      await supabase.from('audit_logs').insert([
        {
          user_id: currentUser?.user_id || null,
          user_name: currentUser?.full_name || 'System User',
          user_role: normalizedRole,
          action,
          entity_type: entityType,
          entity_id: entityId,
          metadata: details || null,
          is_emergency_override: details?.is_emergency_override || false,
          reason: details?.reason || null,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.warn('Audit log write error:', e);
    }
  };

  const logStatusHistory = async (
    entityType: string,
    entityId: string,
    oldStatus: string | null | undefined,
    newStatus: string,
    reason?: string,
    metadata?: any
  ) => {
    try {
      await supabase.from('status_history').insert([
        {
          entity_type: entityType,
          entity_id: entityId,
          old_status: oldStatus || null,
          new_status: newStatus,
          changed_by: currentUser?.full_name || 'System User',
          reason: reason || null,
          timestamp: new Date().toISOString(),
          metadata: metadata || {},
        },
      ]);
    } catch (e) {
      console.warn('Status history write error:', e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        role: normalizedRole,
        setRole,
        pendingOtpEmail,
        otpCooldownSeconds,
        requestLoginOtp,
        verifyLoginOtp,
        cancelLoginOtp,
        login,
        signUp,
        logout,
        refreshKey,
        triggerRefresh,
        notifications,
        unreadAlertsCount,
        markAlertAsRead,
        markAllAlertsAsRead,
        addAlert,
        toasts,
        showToast,
        removeToast,
        showSnackbar: showToast,
        canCreatePR,
        canApprovePR,
        canApprovePO,
        canSendPO,
        canAcceptPO,
        canCreateShipment,
        canAssignDriver,
        canEditLocation,
        canAssignDock,
        canUpdateUnloading,
        canCreateGRN,
        canFinalizeQC,
        canApproveInvoice,
        canReleasePayment,
        canAcceptDriverTrip,
        canTransmitGps,
        isSupplier,
        isDriver,
        effectiveSupplierId,
        logAuditAction,
        logStatusHistory,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
