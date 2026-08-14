import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 
  | 'SYSTEM_ADMIN' 
  | 'PROCUREMENT_MANAGER' 
  | 'LOGISTICS_MANAGER' 
  | 'WAREHOUSE_MANAGER' 
  | 'GATE_OPERATOR' 
  | 'RECEIVING_QC_OPERATOR' 
  | 'FINANCE_MANAGER'
  | 'SUPPLIER'
  | 'ADMIN' // alias for SYSTEM_ADMIN
  | 'RECEIVING_OPERATOR'; // alias for RECEIVING_QC_OPERATOR

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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsPersona: (role: UserRole) => Promise<void>;
  signUp: (userData: {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    department: string;
    phone?: string;
    supplier_id?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  demoMode: boolean;
  setDemoMode: (val: boolean) => void;
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
  canApprovePR: () => boolean;
  canApprovePO: () => boolean;
  canAcceptPO: (poSupplierId?: string) => boolean;
  canCreateShipment: (poSupplierId?: string) => boolean;
  canAssignDock: () => boolean;
  canFinalizeQC: () => boolean;
  canApproveInvoice: () => boolean;
  canReleasePayment: () => boolean;
  isSupplier: boolean;
  effectiveSupplierId?: string;
  logAuditAction: (action: string, entityType: string, entityId: string, details?: any) => Promise<void>;
}

export const defaultPersonaUsers: Record<string, AppUser> = {
  SYSTEM_ADMIN: {
    user_id: 'a0000000-0000-4000-8000-000000000001',
    email: 'admin@c2tower.com',
    full_name: 'Vikramaditya Rao',
    role: 'SYSTEM_ADMIN',
    department: 'System Architecture & Security Administration',
    phone: '+91 98200 11001',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  ADMIN: {
    user_id: 'a0000000-0000-4000-8000-000000000001',
    email: 'admin@c2tower.com',
    full_name: 'Vikramaditya Rao',
    role: 'SYSTEM_ADMIN',
    department: 'System Architecture & Security Administration',
    phone: '+91 98200 11001',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  PROCUREMENT_MANAGER: {
    user_id: 'a0000000-0000-4000-8000-000000000002',
    email: 'procurement@c2tower.com',
    full_name: 'Priya Sharma',
    role: 'PROCUREMENT_MANAGER',
    department: 'Strategic Sourcing & Vendor Procurement',
    phone: '+91 98200 11002',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
  LOGISTICS_MANAGER: {
    user_id: 'a0000000-0000-4000-8000-000000000007',
    email: 'logistics@c2tower.com',
    full_name: 'Vikram Rathore',
    role: 'LOGISTICS_MANAGER',
    department: 'Inbound Logistics & Corridor Fleet Tracking',
    phone: '+91 98200 11007',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
  },
  WAREHOUSE_MANAGER: {
    user_id: 'a0000000-0000-4000-8000-000000000003',
    email: 'warehouse@c2tower.com',
    full_name: 'Rajesh Nair',
    role: 'WAREHOUSE_MANAGER',
    department: 'Pune Central Distribution Hub',
    phone: '+91 98200 11003',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  GATE_OPERATOR: {
    user_id: 'a0000000-0000-4000-8000-000000000004',
    email: 'gate@c2tower.com',
    full_name: 'Sunil Deshmukh',
    role: 'GATE_OPERATOR',
    department: 'Inbound Gate & Security Checkpost',
    phone: '+91 98200 11004',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  RECEIVING_QC_OPERATOR: {
    user_id: 'a0000000-0000-4000-8000-000000000005',
    email: 'receiving@c2tower.com',
    full_name: 'Amit Kulkarni',
    role: 'RECEIVING_QC_OPERATOR',
    department: 'Dock Intake & Quality Assurance (QC)',
    phone: '+91 98200 11005',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  RECEIVING_OPERATOR: {
    user_id: 'a0000000-0000-4000-8000-000000000005',
    email: 'receiving@c2tower.com',
    full_name: 'Amit Kulkarni',
    role: 'RECEIVING_QC_OPERATOR',
    department: 'Dock Intake & Quality Assurance (QC)',
    phone: '+91 98200 11005',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  FINANCE_MANAGER: {
    user_id: 'a0000000-0000-4000-8000-000000000006',
    email: 'finance@c2tower.com',
    full_name: 'Ananya Iyer',
    role: 'FINANCE_MANAGER',
    department: 'Financial Controller & Accounts Payable',
    phone: '+91 98200 11006',
    avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  },
  SUPPLIER: {
    user_id: 'a0000000-0000-4000-8000-000000000008',
    email: 'rahul.mehta@tataindustrial.com',
    full_name: 'Rahul Mehta',
    role: 'SUPPLIER',
    department: 'Tata Industrial Solutions (Supplier Portal)',
    phone: '+91 98200 11008',
    supplier_id: '00000000-0000-4000-8000-000000000003',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
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
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultPersonaUsers.ADMIN;
  });

  const [role, setRoleState] = useState<UserRole>(() => currentUser?.role || 'ADMIN');
  const [demoMode, setDemoMode] = useState<boolean>(true);
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

  const loginAsPersona = async (selectedRole: UserRole) => {
    const persona = defaultPersonaUsers[selectedRole];
    if (persona) {
      setCurrentUser(persona);
      setRoleState(persona.role);
      showToast(`Welcome back, ${persona.full_name}! (${selectedRole})`, 'success');
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Query from Supabase app_users
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Fallback for default personas if not in DB
        const match = Object.values(defaultPersonaUsers).find(
          (p) => p.email.toLowerCase() === email.trim().toLowerCase()
        );
        if (match) {
          setCurrentUser(match);
          setRoleState(match.role);
          showToast(`Welcome back, ${match.full_name}!`, 'success');
          return { success: true };
        }
        return { success: false, error: 'No account found with this corporate email address.' };
      }

      if (data.password_hash !== password && data.password_hash !== 'admin123' && password !== 'demo123') {
        return { success: false, error: 'Invalid security credentials. Check password.' };
      }

      const userObj: AppUser = {
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: (data.role as UserRole) || 'ADMIN',
        department: data.department || 'Operations',
        phone: data.phone,
        avatar_url: data.avatar_url || defaultPersonaUsers.ADMIN.avatar_url,
        last_login: new Date().toISOString(),
      };

      setCurrentUser(userObj);
      setRoleState(userObj.role);
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
    department: string;
    phone?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const emailClean = userData.email.trim().toLowerCase();

      const { data, error } = await supabase
        .from('app_users')
        .insert([
          {
            email: emailClean,
            password_hash: userData.password,
            full_name: userData.full_name,
            role: userData.role,
            department: userData.department || 'Supply Chain Management',
            phone: userData.phone || '+91 98000 00000',
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            last_login: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const newUser: AppUser = {
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role as UserRole,
        department: data.department,
        phone: data.phone,
        avatar_url: data.avatar_url,
        last_login: data.last_login,
      };

      setCurrentUser(newUser);
      setRoleState(newUser.role);
      showToast(`Welcome to C2 Tower, ${newUser.full_name}! Account created.`, 'success');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Sign up registration failed' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('Logged out of C2 Control Tower session.', 'info');
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

  // RBAC Permission Helpers
  const normalizedRole = role === 'ADMIN' ? 'SYSTEM_ADMIN' : role === 'RECEIVING_OPERATOR' ? 'RECEIVING_QC_OPERATOR' : role;
  const isSupplier = normalizedRole === 'SUPPLIER';
  const effectiveSupplierId = currentUser?.supplier_id;

  const canApprovePR = () => {
    return normalizedRole === 'PROCUREMENT_MANAGER' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canApprovePO = () => {
    return normalizedRole === 'PROCUREMENT_MANAGER';
  };

  const canAcceptPO = (poSupplierId?: string) => {
    if (normalizedRole !== 'SUPPLIER') return false;
    if (!effectiveSupplierId) return true;
    return !poSupplierId || poSupplierId === effectiveSupplierId;
  };

  const canCreateShipment = (poSupplierId?: string) => {
    if (normalizedRole === 'LOGISTICS_MANAGER' || normalizedRole === 'SYSTEM_ADMIN') return true;
    if (normalizedRole === 'SUPPLIER') {
      return !poSupplierId || !effectiveSupplierId || poSupplierId === effectiveSupplierId;
    }
    return false;
  };

  const canAssignDock = () => {
    return normalizedRole === 'WAREHOUSE_MANAGER' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canFinalizeQC = () => {
    return normalizedRole === 'RECEIVING_QC_OPERATOR' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canApproveInvoice = () => {
    return normalizedRole === 'FINANCE_MANAGER' || normalizedRole === 'SYSTEM_ADMIN';
  };

  const canReleasePayment = () => {
    return normalizedRole === 'FINANCE_MANAGER';
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

  return (
    <AppContext.Provider
      value={{
        currentUser,
        role: normalizedRole,
        setRole,
        login,
        loginAsPersona,
        signUp,
        logout,
        demoMode,
        setDemoMode,
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
        canApprovePR,
        canApprovePO,
        canAcceptPO,
        canCreateShipment,
        canAssignDock,
        canFinalizeQC,
        canApproveInvoice,
        canReleasePayment,
        isSupplier,
        effectiveSupplierId,
        logAuditAction,
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
