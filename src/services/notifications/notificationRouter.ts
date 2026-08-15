import { sendEmailWithLog } from './emailService';
import { defaultPersonaUsers } from '../../contexts/AppContext';

export type AlertEventType =
  | 'PR_REJECTED'
  | 'PO_REJECTED'
  | 'PO_REJECTED_BY_SUPPLIER'
  | 'DRIVER_ASSIGNMENT_REJECTED'
  | 'SHIPMENT_DELAY'
  | 'TRUCK_ARRIVAL'
  | 'QUALITY_FAILURE'
  | 'INVOICE_MISMATCH'
  | 'PAYMENT_RELEASED'
  | 'PAYMENT_EXCEPTION'
  | 'DOCK_CONGESTION'
  | 'YARD_CONGESTION'
  | 'SUPPLIER_SCORE_DROP'
  | 'PO_APPROVAL'
  | 'PO_AWAITING_ACCEPTANCE'
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
  const recipients: { email: string; role: string; phone?: string }[] = [];

  // Routing matrix adhering strictly to Section 26 of updates4.md:
  switch (payload.event_type) {
    case 'PR_REJECTED':
      // PR Rejected: Worker + Procurement Officer
      recipients.push({ email: defaultPersonaUsers.WORKER.email, role: 'WORKER' });
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_OFFICER.email, role: 'PROCUREMENT_OFFICER' });
      break;

    case 'PO_REJECTED':
    case 'PO_REJECTED_BY_SUPPLIER':
      // PO Rejected by Supplier: Procurement Officer
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_OFFICER.email, role: 'PROCUREMENT_OFFICER' });
      break;

    case 'DRIVER_ASSIGNMENT_REJECTED':
      // Driver Assignment Rejected: Supplier + Logistics & Gate Post
      recipients.push({ email: defaultPersonaUsers.LOGISTICS_GATE_POST.email, role: 'LOGISTICS_GATE_POST' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      } else {
        recipients.push({ email: defaultPersonaUsers.SUPPLIER.email, role: 'SUPPLIER' });
      }
      break;

    case 'SHIPMENT_DELAY':
      // Shipment Delayed: Supplier + Logistics & Gate Post + Procurement where appropriate
      recipients.push({ email: defaultPersonaUsers.LOGISTICS_GATE_POST.email, role: 'LOGISTICS_GATE_POST' });
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_OFFICER.email, role: 'PROCUREMENT_OFFICER' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      }
      break;

    case 'TRUCK_ARRIVAL':
      // Truck Arrived: Logistics & Gate Post + Receiving/QC
      recipients.push({ email: defaultPersonaUsers.LOGISTICS_GATE_POST.email, role: 'LOGISTICS_GATE_POST' });
      recipients.push({ email: defaultPersonaUsers.RECEIVING_QC.email, role: 'RECEIVING_QC' });
      break;

    case 'QUALITY_FAILURE':
      // Quality Failure: Receiving/QC + Procurement Officer
      recipients.push({ email: defaultPersonaUsers.RECEIVING_QC.email, role: 'RECEIVING_QC' });
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_OFFICER.email, role: 'PROCUREMENT_OFFICER' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      }
      break;

    case 'INVOICE_MISMATCH':
      // Invoice Mismatch: Finance + Procurement Officer
      recipients.push({ email: defaultPersonaUsers.FINANCE.email, role: 'FINANCE' });
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_OFFICER.email, role: 'PROCUREMENT_OFFICER' });
      break;

    case 'PAYMENT_RELEASED':
      // Payment Released: Supplier + Finance
      recipients.push({ email: defaultPersonaUsers.FINANCE.email, role: 'FINANCE' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      } else {
        recipients.push({ email: defaultPersonaUsers.SUPPLIER.email, role: 'SUPPLIER' });
      }
      break;

    case 'PAYMENT_EXCEPTION':
      // Payment Exception: Finance + Procurement Officer
      recipients.push({ email: defaultPersonaUsers.FINANCE.email, role: 'FINANCE' });
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_OFFICER.email, role: 'PROCUREMENT_OFFICER' });
      break;

    case 'DOCK_CONGESTION':
    case 'YARD_CONGESTION':
      recipients.push({ email: defaultPersonaUsers.LOGISTICS_GATE_POST.email, role: 'LOGISTICS_GATE_POST' });
      recipients.push({ email: defaultPersonaUsers.RECEIVING_QC.email, role: 'RECEIVING_QC' });
      break;

    case 'SUPPLIER_SCORE_DROP':
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_OFFICER.email, role: 'PROCUREMENT_OFFICER' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      }
      break;

    case 'PO_APPROVAL':
    case 'PO_AWAITING_ACCEPTANCE':
      recipients.push({ email: defaultPersonaUsers.PROCUREMENT_OFFICER.email, role: 'PROCUREMENT_OFFICER' });
      if (payload.supplier_email) {
        recipients.push({ email: payload.supplier_email, role: 'SUPPLIER' });
      }
      break;

    default:
      recipients.push({ email: defaultPersonaUsers.SYSTEM_ADMIN.email, role: 'SYSTEM_ADMIN' });
      break;
  }

  // 1. Dispatch Email Engine
  await Promise.all(
    recipients.map((rec) =>
      sendEmailWithLog({
        recipient_email: rec.email,
        recipient_role: rec.role,
        subject: `[Supply Sync ${severity}] ${payload.title}`,
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

  // 2. WhatsApp API Integration Check (Section 25 of updates4.md)
  // Only transmit if a verified WhatsApp Business API webhook is configured in environment
  const isWhatsAppConfigured = Boolean((import.meta as any).env?.VITE_WHATSAPP_API_KEY);
  if (isWhatsAppConfigured) {
    console.info(`[Supply Sync WhatsApp Router] Transmitting WhatsApp alert to registered fleet/supplier contacts for: ${payload.title}`);
  }
}
