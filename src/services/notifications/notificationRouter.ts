import { sendEmailWithLog } from './emailService';
import { defaultPersonaUsers } from '../../contexts/AppContext';

export type AlertEventType =
  | 'SHIPMENT_DELAY'
  | 'DRIVER_ASSIGNMENT_REJECTED'
  | 'DOCK_CONGESTION'
  | 'YARD_CONGESTION'
  | 'QUALITY_FAILURE'
  | 'SUPPLIER_SCORE_DROP'
  | 'INVOICE_MISMATCH'
  | 'PAYMENT_OVERDUE'
  | 'PO_APPROVAL'
  | 'PO_AWAITING_ACCEPTANCE'
  | 'TRUCK_ARRIVAL'
  | 'DRIVER_LOCATION_UPDATE';

export interface RouteNotificationPayload {
  event_type: AlertEventType;
  title: string;
  message: string;
  severity?: 'INFO' | 'HIGH' | 'CRITICAL' | 'SUCCESS';
  entity_type?: string;
  entity_number?: string;
  supplier_id?: string;
  supplier_email?: string;
  driver_email?: string;
  action_link?: string;
}

export async function routeNotification(payload: RouteNotificationPayload): Promise<void> {
  const severity = payload.severity || 'INFO';
  const recipients: { email: string; role: string }[] = [];

  // Routing matrix according to Section 21 of updates2.md:
  switch (payload.event_type) {
    case 'SHIPMENT_DELAY':
      recipients.push({ email: defaultPersonaUsers.LOGISTICS_MANAGER.email, role: 'LOGISTICS_MANAGER' });
      recipients.push({ email: defaultPersonaUsers.WAREHOUSE_MANAGER.email, role: 'WAREHOUSE_MANAGER' });
      break;

    case 'DRIVER_ASSIGNMENT_REJECTED':
      recipients.push({ email: defaultPersonaUsers.LOGISTICS_MANAGER.email, role: 'LOGISTICS_MANAGER' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      }
      break;

    case 'DOCK_CONGESTION':
    case 'YARD_CONGESTION':
      recipients.push({ email: defaultPersonaUsers.WAREHOUSE_MANAGER.email, role: 'WAREHOUSE_MANAGER' });
      break;

    case 'QUALITY_FAILURE':
      recipients.push({ email: defaultPersonaUsers.RECEIVING_QC_OPERATOR.email, role: 'RECEIVING_QC_OPERATOR' });
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_MANAGER.email, role: 'PROCUREMENT_MANAGER' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      }
      break;

    case 'SUPPLIER_SCORE_DROP':
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_MANAGER.email, role: 'PROCUREMENT_MANAGER' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      }
      break;

    case 'INVOICE_MISMATCH':
    case 'PAYMENT_OVERDUE':
      recipients.push({ email: defaultPersonaUsers.FINANCE_MANAGER.email, role: 'FINANCE_MANAGER' });
      break;

    case 'PO_APPROVAL':
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_MANAGER.email, role: 'PROCUREMENT_MANAGER' });
      break;

    case 'PO_AWAITING_ACCEPTANCE':
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_MANAGER.email, role: 'PROCUREMENT_MANAGER' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      }
      break;

    case 'TRUCK_ARRIVAL':
      recipients.push({ email: defaultPersonaUsers.GATE_OPERATOR.email, role: 'GATE_OPERATOR' });
      recipients.push({ email: defaultPersonaUsers.WAREHOUSE_MANAGER.email, role: 'WAREHOUSE_MANAGER' });
      break;

    default:
      recipients.push({ email: defaultPersonaUsers.SYSTEM_ADMIN.email, role: 'SYSTEM_ADMIN' });
      break;
  }

  // Dispatch email logs for all targeted recipients
  await Promise.all(
    recipients.map((rec) =>
      sendEmailWithLog({
        recipient_email: rec.email,
        recipient_role: rec.role,
        subject: `[C2 ${severity}] ${payload.title}`,
        template_name: payload.event_type.toLowerCase(),
        severity: severity === 'CRITICAL' ? 'CRITICAL' : severity === 'HIGH' ? 'HIGH' : 'INFO',
        metadata: {
          action_link: payload.action_link,
          entity_type: payload.entity_type,
          entity_number: payload.entity_number,
        },
      })
    )
  );
}
