import { UserRole } from '../contexts/AppContext';

export interface EmailDispatchPayload {
  alert_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  message: string;
  entity_type: string;
  entity_number: string;
  supplier_name?: string;
  supplier_id?: string;
  expected_value?: string | number;
  current_value?: string | number;
  difference?: string | number;
  action_link: string;
}

export interface EmailDeliveryRecord {
  id: string;
  recipient_email: string;
  recipient_role: UserRole;
  subject: string;
  body_preview: string;
  status: 'SENT' | 'FAILED' | 'QUEUED';
  sent_at: string;
  action_link: string;
}

// In-memory or localStorage delivery log for tracking
const EMAIL_LOG_KEY = 'c2_email_delivery_logs';

export function getEmailDeliveryLogs(): EmailDeliveryRecord[] {
  try {
    const raw = localStorage.getItem(EMAIL_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEmailDeliveryLog(log: EmailDeliveryRecord) {
  try {
    const existing = getEmailDeliveryLogs();
    localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify([log, ...existing].slice(0, 50)));
  } catch (err) {
    console.warn('Failed to save email delivery log:', err);
  }
}

// Role-to-email mapping
const ROLE_EMAILS: Record<string, string> = {
  PROCUREMENT_MANAGER: 'procurement@c2tower.com',
  LOGISTICS_MANAGER: 'logistics@c2tower.com',
  WAREHOUSE_MANAGER: 'warehouse@c2tower.com',
  GATE_OPERATOR: 'gate@c2tower.com',
  RECEIVING_QC_OPERATOR: 'receiving@c2tower.com',
  FINANCE_MANAGER: 'finance@c2tower.com',
  SYSTEM_ADMIN: 'admin@c2tower.com',
  SUPPLIER: 'rahul.mehta@tataindustrial.com',
};

export async function sendEmailNotification(payload: EmailDispatchPayload): Promise<{
  deliveredRecipients: string[];
  logs: EmailDeliveryRecord[];
}> {
  const targetRoles: UserRole[] = [];

  // Determine recipient roles according to Section 36 of updates1.md
  switch (payload.alert_type) {
    case 'PR_PENDING':
    case 'PO_APPROVAL':
    case 'SUPPLIER_SCORE_DROP':
      targetRoles.push('PROCUREMENT_MANAGER');
      break;

    case 'SHIPMENT_DELAY':
      targetRoles.push('LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER');
      if (payload.supplier_id) targetRoles.push('SUPPLIER');
      break;

    case 'YARD_CONGESTION':
    case 'DOCK_WAITING':
      targetRoles.push('WAREHOUSE_MANAGER');
      break;

    case 'QUALITY_FAILURE':
    case 'QUALITY_REJECTED':
      targetRoles.push('WAREHOUSE_MANAGER', 'PROCUREMENT_MANAGER');
      if (payload.supplier_id) targetRoles.push('SUPPLIER');
      break;

    case 'INVOICE_MISMATCH':
    case 'PAYMENT_HOLD':
    case 'PAYMENT_OVERDUE':
      targetRoles.push('FINANCE_MANAGER');
      break;

    case 'PAYMENT_COMPLETED':
      targetRoles.push('FINANCE_MANAGER');
      if (payload.supplier_id) targetRoles.push('SUPPLIER');
      break;

    default:
      targetRoles.push('SYSTEM_ADMIN');
      break;
  }

  const logs: EmailDeliveryRecord[] = [];
  const deliveredRecipients: string[] = [];

  for (const r of targetRoles) {
    const recipientEmail = ROLE_EMAILS[r] || `${r.toLowerCase()}@c2tower.com`;
    const subject = `[C2 ALERT] [${payload.severity}] ${payload.title} - ${payload.entity_number}`;
    const preview = `${payload.message} | Supplier: ${payload.supplier_name || 'N/A'} | Action Link: ${payload.action_link}`;

    const record: EmailDeliveryRecord = {
      id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipient_email: recipientEmail,
      recipient_role: r,
      subject,
      body_preview: preview,
      status: 'SENT',
      sent_at: new Date().toISOString(),
      action_link: payload.action_link,
    };

    saveEmailDeliveryLog(record);
    logs.push(record);
    deliveredRecipients.push(recipientEmail);
  }

  return { deliveredRecipients, logs };
}
