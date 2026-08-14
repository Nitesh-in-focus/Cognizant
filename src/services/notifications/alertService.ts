export interface AppAlert {
  id?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  link?: string;
  timestamp?: string;
  read?: boolean;
}

// In-app alert dispatch bridge
export function createInAppAlert(alert: AppAlert): AppAlert {
  return {
    ...alert,
    id: alert.id || `alt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: 'Just now',
    read: false,
  };
}
