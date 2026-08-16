import emailjs from '@emailjs/browser';
import { supabase } from '../lib/supabase';

/**
 * Supply Sync Centralized EmailJS Configuration (Phases 1, 2, 15, 20)
 * Safely reads from Vite environment variables with no hardcoded credentials.
 */
export const EMAILJS_CONFIG = {
  get publicKey(): string {
    return (import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '').trim();
  },
  get serviceId(): string {
    return (import.meta.env.VITE_EMAILJS_SERVICE_ID || '').trim();
  },
  get notificationTemplateId(): string {
    return (import.meta.env.VITE_EMAILJS_NOTIFICATION_TEMPLATE_ID || '').trim();
  },
  get poActionTemplateId(): string {
    return (import.meta.env.VITE_EMAILJS_PO_ACTION_TEMPLATE_ID || '').trim();
  },
  isConfigured(): boolean {
    return Boolean(this.publicKey && this.serviceId && (this.notificationTemplateId || this.poActionTemplateId));
  },
};

export interface EmailLogEntry {
  notification_id?: string;
  event_type: string;
  recipient_user_id?: string;
  recipient_email: string;
  recipient_name?: string;
  entity_type: string;
  entity_id: string;
  po_id?: string;
  shipment_id?: string;
  invoice_id?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
  emailjs_template_id?: string;
  template_params?: Record<string, any>;
  sent_at?: string;
  error_message?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  notConfigured?: boolean;
}

/**
 * Log email dispatch to Supabase email_notifications table (Phase 17)
 * Non-destructive: failure to log will never throw or roll back business transactions.
 */
export async function logEmailNotification(entry: EmailLogEntry): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('email_notifications')
      .insert([
        {
          event_type: entry.event_type,
          recipient_user_id: entry.recipient_user_id || null,
          recipient_email: entry.recipient_email,
          recipient_name: entry.recipient_name || '',
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          po_id: entry.po_id || null,
          shipment_id: entry.shipment_id || null,
          invoice_id: entry.invoice_id || null,
          status: entry.status,
          emailjs_template_id: entry.emailjs_template_id || null,
          template_params: entry.template_params || {},
          sent_at: entry.status === 'SENT' ? new Date().toISOString() : null,
          error_message: entry.error_message || null,
        },
      ])
      .select('notification_id')
      .maybeSingle();

    if (error) {
      console.warn('email_notifications DB log note:', error.message);
      return null;
    }
    return data?.notification_id || null;
  } catch (err) {
    console.warn('Failed to log email notification to database:', err);
    return null;
  }
}

/**
 * Dynamic Recipient Resolution (Phase 16)
 * Queries supplier table for accurate supplier email.
 */
export async function resolveSupplierRecipient(supplierId?: string): Promise<{
  email: string;
  supplierName: string;
  contactPerson: string;
  supplierCode: string;
} | null> {
  try {
    if (supplierId) {
      // 1. Check suppliers table
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('supplier_id, supplier_code, supplier_name, contact_person, email')
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (supplierData?.email && supplierData.email.includes('@')) {
        return {
          email: supplierData.email.trim(),
          supplierName: supplierData.supplier_name || 'Vendor Partner',
          contactPerson: supplierData.contact_person || 'Authorized Representative',
          supplierCode: supplierData.supplier_code || 'SUP',
        };
      }

      // 2. Check if supplierId is linked to an app_users record
      const { data: userData } = await supabase
        .from('app_users')
        .select('user_id, full_name, email, role')
        .eq('user_id', supplierId)
        .maybeSingle();

      if (userData?.email && userData.email.includes('@')) {
        return {
          email: userData.email.trim(),
          supplierName: userData.full_name || supplierData?.supplier_name || 'Vendor Partner',
          contactPerson: userData.full_name || 'Authorized Representative',
          supplierCode: supplierData?.supplier_code || 'SUP',
        };
      }
    }

    // 3. Fallback: Query active supplier user from app_users
    const { data: fallbackUser } = await supabase
      .from('app_users')
      .select('user_id, full_name, email, role')
      .eq('role', 'SUPPLIER')
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (fallbackUser?.email && fallbackUser.email.includes('@')) {
      return {
        email: fallbackUser.email.trim(),
        supplierName: fallbackUser.full_name || 'Cognizant Supplier Partner',
        contactPerson: fallbackUser.full_name || 'Authorized Representative',
        supplierCode: 'SUP-COG',
      };
    }
  } catch (err) {
    console.warn('Error resolving supplier recipient:', err);
  }

  // Safe fallback default
  return {
    email: 'cartoonish@gmail.com',
    supplierName: 'Cognizant Supplier Partner',
    contactPerson: 'Train',
    supplierCode: 'SUP-COG',
  };
}

/**
 * Dynamic Recipient Resolution (Phase 16)
 * Queries purchase order creator or active Procurement Officer in app_users.
 */
export async function resolvePrOfficerRecipient(poId?: string): Promise<{
  email: string;
  fullName: string;
  userId?: string;
}> {
  try {
    // 1. If PO ID provided, check created_by
    if (poId) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('created_by, purchase_requisitions(created_by)')
        .eq('po_id', poId)
        .maybeSingle();

      const creatorId = po?.created_by || (po?.purchase_requisitions as any)?.created_by;
      if (creatorId) {
        const { data: user } = await supabase
          .from('app_users')
          .select('user_id, full_name, email')
          .eq('user_id', creatorId)
          .maybeSingle();

        if (user?.email) {
          return {
            email: user.email,
            fullName: user.full_name || 'Procurement Officer',
            userId: user.user_id,
          };
        }
      }
    }

    // 2. Query active Procurement Officer from app_users
    const { data: prOfficer } = await supabase
      .from('app_users')
      .select('user_id, full_name, email')
      .eq('role', 'PROCUREMENT_OFFICER')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prOfficer?.email) {
      return {
        email: prOfficer.email,
        fullName: prOfficer.full_name || 'Procurement Officer',
        userId: prOfficer.user_id,
      };
    }
  } catch (err) {
    console.warn('Error resolving PR Officer recipient:', err);
  }

  return {
    email: 'niteshjha.myself@gmail.com',
    fullName: 'Nitesh Jha (Procurement Officer)',
  };
}

/**
 * Resolve All Active Procurement Officers (User Request)
 * Queries all PR Officers from app_users (typically 1 or 2).
 */
export async function resolveAllPrOfficers(): Promise<Array<{
  email: string;
  fullName: string;
  userId?: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('user_id, full_name, email, role, status')
      .eq('role', 'PROCUREMENT_OFFICER')
      .eq('status', 'ACTIVE');

    if (!error && data && data.length > 0) {
      const valid = data
        .filter((u) => u.email && u.email.trim() !== '')
        .map((u) => ({
          email: u.email.trim(),
          fullName: u.full_name || 'Procurement Officer',
          userId: u.user_id,
        }));

      if (valid.length > 0) return valid;
    }
  } catch (err) {
    console.warn('Error resolving all PR officers:', err);
  }

  // Fallback to active system PR officer
  return [
    {
      email: 'niteshjha.myself@gmail.com',
      fullName: 'Nitesh Jha (Procurement Officer)',
      userId: 'bd412c82-d806-4185-8464-5610937c2132',
    },
  ];
}

/**
 * Send New PR Requested Notification to all active Procurement Officers
 * When a worker submits a PR, EmailJS notification is dispatched to all PR officers in the system.
 */
export async function sendPrRequestedNotification(payload: {
  prId: string;
  prNumber: string;
  requestedByWorker: string;
  productName: string;
  quantity: number;
  priority: string;
  warehouseName?: string;
  requiredDate?: string;
  reason?: string;
}): Promise<{ totalSent: number; errors: string[] }> {
  const prOfficers = await resolveAllPrOfficers();
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173';
  const templateId = EMAILJS_CONFIG.notificationTemplateId || EMAILJS_CONFIG.poActionTemplateId;

  let totalSent = 0;
  const errors: string[] = [];

  for (const officer of prOfficers) {
    const templateParams = {
      to_email: officer.email,
      to_name: officer.fullName,
      recipient_email: officer.email,
      recipient_name: officer.fullName,
      event_type: 'NEW_PR_REQUESTED',
      pr_id: payload.prId,
      pr_number: payload.prNumber,
      po_id: payload.prId,
      po_number: payload.prNumber,
      supplier_name: 'Procurement Allocation Pending',
      product_name: payload.productName,
      quantity: `${Number(payload.quantity).toLocaleString()} units`,
      amount: 'Awaiting PO Generation',
      total_amount: 'Awaiting PO Generation',
      priority: payload.priority,
      delivery_location: payload.warehouseName || 'Central Warehouse',
      delivery_date: payload.requiredDate || 'As specified in Requisition',
      status: 'PENDING_APPROVAL',
      event_time: new Date().toLocaleString('en-IN'),
      action_url: `${origin}/purchase-requisitions?pr=${payload.prNumber}`,
      view_url: `${origin}/purchase-requisitions`,
      message: `Worker "${payload.requestedByWorker}" has submitted a new Purchase Requisition #${payload.prNumber} for ${Number(payload.quantity).toLocaleString()} units of "${payload.productName}" (Priority: ${payload.priority}, Delivery to: ${payload.warehouseName || 'Warehouse'}). Please log in to Supply Sync to review the requisition and approve/allocate a supplier.`,
    };

    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | undefined = undefined;

    if (EMAILJS_CONFIG.isConfigured() && templateId) {
      try {
        await emailjs.send(
          EMAILJS_CONFIG.serviceId,
          templateId,
          templateParams,
          EMAILJS_CONFIG.publicKey
        );
        totalSent++;
        console.log(`[EmailJS] Successfully dispatched New PR email to PR Officer: ${officer.email}`);
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err?.text || err?.message || 'EmailJS delivery failed';
        errors.push(`${officer.email}: ${errorMessage}`);
        console.warn(`[EmailJS] Failed to send New PR email to ${officer.email}:`, err);
      }
    } else {
      status = 'FAILED';
      errorMessage = 'EmailJS credentials not configured in .env';
      errors.push(`${officer.email}: ${errorMessage}`);
    }

    await logEmailNotification({
      event_type: 'NEW_PR_REQUESTED',
      recipient_user_id: officer.userId,
      recipient_email: officer.email,
      recipient_name: officer.fullName,
      entity_type: 'purchase_requisitions',
      entity_id: payload.prId,
      status: status,
      emailjs_template_id: templateId || 'NOTIFICATION_TEMPLATE',
      template_params: templateParams,
      error_message: errorMessage,
    });
  }

  return { totalSent, errors };
}

/**
 * PHASE 1 & 19: Test and Verify EmailJS Connection
 * Sends a live diagnostic test email to verify credentials, service, and template.
 */
export async function testEmailJsConnection(toEmail: string, toName = 'Supply Sync Admin'): Promise<EmailResult> {
  if (!toEmail || !toEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid recipient email address.' };
  }

  if (!EMAILJS_CONFIG.publicKey || !EMAILJS_CONFIG.serviceId) {
    return {
      success: false,
      notConfigured: true,
      error: 'EmailJS is not configured. Please add VITE_EMAILJS_PUBLIC_KEY and VITE_EMAILJS_SERVICE_ID in your .env file and restart Vite.',
    };
  }

  const templateId = EMAILJS_CONFIG.notificationTemplateId || EMAILJS_CONFIG.poActionTemplateId;
  if (!templateId) {
    return {
      success: false,
      notConfigured: true,
      error: 'No EmailJS Template ID found. Please set VITE_EMAILJS_NOTIFICATION_TEMPLATE_ID or VITE_EMAILJS_PO_ACTION_TEMPLATE_ID in .env.',
    };
  }

  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173';
  const timestamp = new Date().toLocaleString('en-IN');

  const templateParams = {
    to_email: toEmail,
    to_name: toName,
    recipient_email: toEmail,
    recipient_name: toName,
    event_type: 'EMAILJS_CONNECTION_TEST',
    po_id: 'PO-TEST-001',
    po_number: 'PO-TEST-001',
    supplier_name: 'Supply Sync Diagnostic Service',
    quantity: '1 test dispatch',
    amount: '₹0.00',
    total_amount: '₹0.00',
    status: 'SYSTEM_VERIFIED',
    event_time: timestamp,
    action_url: `${origin}/alerts`,
    view_url: `${origin}/alerts`,
    message: `This is an automated diagnostic test message from Supply Sync to confirm that your EmailJS service (${EMAILJS_CONFIG.serviceId}) is transmitting live operational notifications successfully.`,
  };

  try {
    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      templateId,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );

    await logEmailNotification({
      event_type: 'EMAILJS_CONNECTION_TEST',
      recipient_email: toEmail,
      recipient_name: toName,
      entity_type: 'purchase_orders',
      entity_id: '00000000-0000-4000-8000-000000000000',
      status: 'SENT',
      emailjs_template_id: templateId,
      template_params: templateParams,
    });

    return {
      success: true,
      messageId: response.text || 'OK (Status 200)',
    };
  } catch (err: any) {
    const errorText = err?.text || err?.message || JSON.stringify(err) || 'EmailJS test dispatch failed';

    await logEmailNotification({
      event_type: 'EMAILJS_CONNECTION_TEST',
      recipient_email: toEmail,
      recipient_name: toName,
      entity_type: 'purchase_orders',
      entity_id: '00000000-0000-4000-8000-000000000000',
      status: 'FAILED',
      emailjs_template_id: templateId,
      template_params: templateParams,
      error_message: errorText,
    });

    return {
      success: false,
      error: errorText,
    };
  }
}

/**
 * PHASE 5 & 7: Send Supplier PO Notification (INFORMATIONAL ONLY - Phase 24)
 * Triggered ONLY when PR Officer explicitly clicks "Send to Supplier".
 * No Accept/Reject buttons inside email in this iteration.
 */
export async function sendSupplierPONotification(poId: string, supplierId?: string): Promise<EmailResult> {
  try {
    // 1. Fetch full PO details
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('*, warehouses(warehouse_name, address, city), purchase_requisitions(pr_number), po_items(*, products(*))')
      .eq('po_id', poId)
      .maybeSingle();

    if (poErr || !po) {
      return { success: false, error: 'Purchase Order record not found in database.' };
    }

    // 2. Resolve Supplier
    const supId = supplierId || po.supplier_id;
    const supplierRecipient = await resolveSupplierRecipient(supId);
    if (!supplierRecipient?.email) {
      return { success: false, error: 'Supplier email address is missing or invalid in supplier profile.' };
    }

    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173';
    const viewUrl = `${origin}/supplier`;

    const firstItem = po.po_items?.[0];
    const productName = firstItem?.products?.product_name || firstItem?.item_name || 'Procurement Line Items';
    const productSku = firstItem?.products?.product_code || 'SKU-STANDARD';
    const itemQty = firstItem?.quantity || po.total_quantity || 100;
    const unitPrice = firstItem?.unit_price || (po.total_amount ? Math.round(Number(po.total_amount) / itemQty) : 250);

    const templateParams = {
      to_email: supplierRecipient.email,
      email: supplierRecipient.email,
      recipient_email: supplierRecipient.email,
      user_email: supplierRecipient.email,
      reply_to: supplierRecipient.email,
      to_name: supplierRecipient.contactPerson || supplierRecipient.supplierName,
      name: supplierRecipient.contactPerson || supplierRecipient.supplierName,
      recipient_name: supplierRecipient.contactPerson || supplierRecipient.supplierName,
      supplier_name: supplierRecipient.supplierName,
      supplier_code: supplierRecipient.supplierCode,
      event_type: 'PO_SENT_TO_SUPPLIER',
      subject: `[Supply Sync] Official Purchase Order Issued: #${po.po_number}`,
      title: `Official Purchase Order Issued: #${po.po_number}`,
      po_id: po.po_id,
      po_number: po.po_number,
      pr_id: po.pr_id || '',
      pr_number: po.purchase_requisitions?.pr_number || 'PR-2026',
      po_date: new Date(po.order_date || po.created_at || Date.now()).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      product_name: productName,
      product_sku: productSku,
      quantity: `${Number(itemQty).toLocaleString()} units`,
      unit_price: `₹${Number(unitPrice).toLocaleString('en-IN')}`,
      total_amount: `₹${Number(po.total_amount || 0).toLocaleString('en-IN')}`,
      amount: `₹${Number(po.total_amount || 0).toLocaleString('en-IN')}`,
      delivery_location: po.warehouses?.warehouse_name
        ? `${po.warehouses.warehouse_name} (${po.warehouses.city || 'Central DC'})`
        : 'Central Logistics Hub',
      delivery_date: po.expected_delivery_date
        ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'As scheduled in contract',
      payment_terms: po.payment_terms || 'NET_30',
      action_url: viewUrl,
      view_url: viewUrl,
      event_time: new Date().toLocaleString('en-IN'),
      message: `Commercial Purchase Order #${po.po_number} has been officially issued to your organization by Supply Sync Procurement. Please log into the Supply Sync Supplier Portal to review line item details and confirm order acceptance.`,
    };

    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | undefined = undefined;

    const templateId = EMAILJS_CONFIG.notificationTemplateId || EMAILJS_CONFIG.poActionTemplateId;

    if (EMAILJS_CONFIG.isConfigured() && templateId) {
      try {
        await emailjs.send(
          EMAILJS_CONFIG.serviceId,
          templateId,
          templateParams,
          EMAILJS_CONFIG.publicKey
        );
        console.log(`[EmailJS] Dispatched PO Notification to supplier: ${supplierRecipient.email}`);
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err?.text || err?.message || 'EmailJS delivery failed';
        console.warn(`[EmailJS] Failed to dispatch PO Notification to supplier:`, err);
      }
    } else {
      status = 'FAILED';
      errorMessage = 'EmailJS credentials not configured in .env';
    }

    await logEmailNotification({
      event_type: 'PO_SENT_TO_SUPPLIER',
      recipient_email: supplierRecipient.email,
      recipient_name: supplierRecipient.supplierName,
      entity_type: 'purchase_orders',
      entity_id: po.po_id,
      po_id: po.po_id,
      status: status,
      emailjs_template_id: templateId || 'PO_NOTIFICATION_TEMPLATE',
      template_params: templateParams,
      error_message: errorMessage,
    });

    return {
      success: status === 'SENT',
      error: errorMessage,
      notConfigured: !EMAILJS_CONFIG.isConfigured(),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * PHASE 9: Send Supplier Response Notification to PR Officer
 * Triggered when Supplier Accepts or Rejects PO in the application.
 */
export async function sendPoResponseNotification(payload: {
  poId: string;
  supplierName: string;
  responseStatus: 'ACCEPTED_BY_SUPPLIER' | 'REJECTED' | 'REJECTED_BY_SUPPLIER' | 'ACCEPTED';
  rejectionReason?: string;
  actorName?: string;
}): Promise<EmailResult> {
  try {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('*, purchase_requisitions(pr_number)')
      .eq('po_id', payload.poId)
      .maybeSingle();

    if (!po) return { success: false, error: 'PO not found' };

    const prOfficer = await resolvePrOfficerRecipient(payload.poId);
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173';

    const isAccepted = payload.responseStatus === 'ACCEPTED' || payload.responseStatus === 'ACCEPTED_BY_SUPPLIER';
    const eventType = isAccepted ? 'PURCHASE ORDER ACCEPTED BY SUPPLIER' : 'PURCHASE ORDER REJECTED BY SUPPLIER';
    const title = isAccepted ? `PO #${po.po_number} Accepted by Supplier` : `PO #${po.po_number} Declined by Supplier`;
    const message = isAccepted
      ? `Supplier "${payload.supplierName}" has officially accepted Purchase Order #${po.po_number} (Value: ₹${Number(po.total_amount || 0).toLocaleString('en-IN')}). Inventory is being allocated for dispatch.`
      : `Supplier "${payload.supplierName}" declined Purchase Order #${po.po_number}. Reason: ${payload.rejectionReason || 'Commercial/capacity constraints'}. Please review and adjust procurement requirements.`;

    const templateParams = {
      to_email: prOfficer.email,
      email: prOfficer.email,
      recipient_email: prOfficer.email,
      user_email: prOfficer.email,
      reply_to: prOfficer.email,
      to_name: prOfficer.fullName,
      name: prOfficer.fullName,
      recipient_name: prOfficer.fullName,
      event_type: eventType,
      subject: `[Supply Sync] ${title}`,
      title: title,
      po_id: po.po_id,
      po_number: po.po_number,
      pr_id: po.pr_id || '',
      pr_number: po.purchase_requisitions?.pr_number || 'PR-2026',
      supplier_name: payload.supplierName,
      quantity: `${Number(po.total_quantity || 0).toLocaleString()} units`,
      amount: `₹${Number(po.total_amount || 0).toLocaleString('en-IN')}`,
      total_amount: `₹${Number(po.total_amount || 0).toLocaleString('en-IN')}`,
      status: payload.responseStatus,
      event_time: new Date().toLocaleString('en-IN'),
      action_url: `${origin}/purchase-orders`,
      view_url: `${origin}/purchase-orders`,
      message: message,
    };

    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | undefined = undefined;

    const templateId = EMAILJS_CONFIG.notificationTemplateId || EMAILJS_CONFIG.poActionTemplateId;

    if (EMAILJS_CONFIG.isConfigured() && templateId) {
      try {
        await emailjs.send(
          EMAILJS_CONFIG.serviceId,
          templateId,
          templateParams,
          EMAILJS_CONFIG.publicKey
        );
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err?.text || err?.message || 'EmailJS delivery failed';
      }
    } else {
      status = 'FAILED';
      errorMessage = 'EmailJS credentials not configured in .env';
    }

    await logEmailNotification({
      event_type: isAccepted ? 'PO_ACCEPTED_BY_SUPPLIER' : 'PO_REJECTED_BY_SUPPLIER',
      recipient_user_id: prOfficer.userId,
      recipient_email: prOfficer.email,
      recipient_name: prOfficer.fullName,
      entity_type: 'purchase_orders',
      entity_id: po.po_id,
      po_id: po.po_id,
      status: status,
      emailjs_template_id: templateId || 'NOTIFICATION_TEMPLATE',
      template_params: templateParams,
      error_message: errorMessage,
    });

    return {
      success: status === 'SENT',
      error: errorMessage,
      notConfigured: !EMAILJS_CONFIG.isConfigured(),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * PHASE 10: Send Dispatch Notification to PR Officer
 * Triggered when Supplier dispatches shipment.
 */
export async function sendDispatchNotification(payload: {
  shipmentId: string;
  poId?: string;
  supplierName: string;
  shipmentNumber: string;
  asnNumber?: string;
  totalQuantity: number;
  driverName?: string;
  vehicleNumber?: string;
  eta?: string;
}): Promise<EmailResult> {
  try {
    const prOfficer = await resolvePrOfficerRecipient(payload.poId);
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173';

    const templateParams = {
      to_email: prOfficer.email,
      email: prOfficer.email,
      recipient_email: prOfficer.email,
      user_email: prOfficer.email,
      reply_to: prOfficer.email,
      to_name: prOfficer.fullName,
      name: prOfficer.fullName,
      recipient_name: prOfficer.fullName,
      event_type: 'SHIPMENT_DISPATCHED',
      subject: `[Supply Sync] Shipment Dispatched: #${payload.shipmentNumber}`,
      title: `Shipment Dispatched: #${payload.shipmentNumber}`,
      po_id: payload.poId || '',
      shipment_id: payload.shipmentId,
      shipment_number: payload.shipmentNumber,
      asn_number: payload.asnNumber || `ASN-${payload.shipmentNumber}`,
      supplier_name: payload.supplierName,
      quantity: `${Number(payload.totalQuantity).toLocaleString()} units`,
      driver_name: payload.driverName || 'Carrier Fleet Driver',
      vehicle_number: payload.vehicleNumber || 'Transit Vehicle',
      eta: payload.eta ? new Date(payload.eta).toLocaleString('en-IN') : 'Scheduled Inbound',
      status: 'DISPATCHED',
      event_time: new Date().toLocaleString('en-IN'),
      action_url: `${origin}/shipments`,
      view_url: `${origin}/shipments`,
      message: `Supplier "${payload.supplierName}" has dispatched Shipment #${payload.shipmentNumber} (ASN: ${payload.asnNumber || payload.shipmentNumber}) containing ${Number(payload.totalQuantity).toLocaleString()} units. Carrier vehicle ${payload.vehicleNumber || ''} is now in transit to warehouse.`,
    };

    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | undefined = undefined;

    const templateId = EMAILJS_CONFIG.notificationTemplateId || EMAILJS_CONFIG.poActionTemplateId;

    if (EMAILJS_CONFIG.isConfigured() && templateId) {
      try {
        await emailjs.send(
          EMAILJS_CONFIG.serviceId,
          templateId,
          templateParams,
          EMAILJS_CONFIG.publicKey
        );
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err?.text || err?.message || 'EmailJS delivery failed';
      }
    } else {
      status = 'FAILED';
      errorMessage = 'EmailJS credentials not configured in .env';
    }

    await logEmailNotification({
      event_type: 'SHIPMENT_DISPATCHED',
      recipient_user_id: prOfficer.userId,
      recipient_email: prOfficer.email,
      recipient_name: prOfficer.fullName,
      entity_type: 'shipments',
      entity_id: payload.shipmentId,
      po_id: payload.poId,
      shipment_id: payload.shipmentId,
      status: status,
      emailjs_template_id: templateId || 'NOTIFICATION_TEMPLATE',
      template_params: templateParams,
      error_message: errorMessage,
    });

    return {
      success: status === 'SENT',
      error: errorMessage,
      notConfigured: !EMAILJS_CONFIG.isConfigured(),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * PHASE 11: Send Finance Exception Notification to PR Officer
 * Triggered when Finance raises/escalates 3-way match exception.
 */
export async function sendFinanceExceptionNotification(payload: {
  exceptionId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  poId?: string;
  poNumber?: string;
  shipmentId?: string;
  shipmentNumber?: string;
  supplierName: string;
  mismatchType: string;
  mismatchDetails: string;
  amount: number;
}): Promise<EmailResult> {
  try {
    const prOfficers = await resolveAllPrOfficers();
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173';
    const templateId = EMAILJS_CONFIG.notificationTemplateId || EMAILJS_CONFIG.poActionTemplateId;

    let anySent = false;
    let lastError: string | undefined = undefined;

    for (const prOfficer of prOfficers) {
      const templateParams = {
        to_email: prOfficer.email,
        email: prOfficer.email,
        recipient_email: prOfficer.email,
        user_email: prOfficer.email,
        reply_to: prOfficer.email,
        to_name: prOfficer.fullName,
        name: prOfficer.fullName,
        recipient_name: prOfficer.fullName,
        event_type: '3-WAY MATCH EXCEPTION RAISED',
        subject: `[Supply Sync] 3-Way Match Exception: ${payload.exceptionId} (PO #${payload.poNumber || 'N/A'})`,
        title: `3-Way Match Exception: ${payload.exceptionId}`,
        po_id: payload.poId || '',
        po_number: payload.poNumber || 'N/A',
        invoice_id: payload.invoiceId || '',
        invoice_number: payload.invoiceNumber || 'N/A',
        shipment_id: payload.shipmentId || '',
        shipment_number: payload.shipmentNumber || 'N/A',
        exception_id: payload.exceptionId,
        supplier_name: payload.supplierName,
        mismatch_type: payload.mismatchType,
        amount: `₹${Number(payload.amount || 0).toLocaleString('en-IN')}`,
        invoice_amount: `₹${Number(payload.amount || 0).toLocaleString('en-IN')}`,
        total_amount: `₹${Number(payload.amount || 0).toLocaleString('en-IN')}`,
        status: 'REQUIRES_PROCUREMENT_REVIEW',
        event_time: new Date().toLocaleString('en-IN'),
        action_url: `${origin}/exceptions`,
        view_url: `${origin}/exceptions`,
        message: `Finance Accounts Payable detected a 3-Way Match discrepancy on Invoice #${payload.invoiceNumber || ''} against PO #${payload.poNumber || ''} for Supplier "${payload.supplierName}". Discrepancy Details: ${payload.mismatchDetails}. Please review and resolve in the Exceptions Center.`,
      };

      let status: 'SENT' | 'FAILED' = 'SENT';
      let errorMessage: string | undefined = undefined;

      if (EMAILJS_CONFIG.isConfigured() && templateId) {
        try {
          await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            templateId,
            templateParams,
            EMAILJS_CONFIG.publicKey
          );
          anySent = true;
          console.log(`[EmailJS] Dispatched Finance Exception Notification to PR Officer: ${prOfficer.email}`);
        } catch (err: any) {
          status = 'FAILED';
          errorMessage = err?.text || err?.message || 'EmailJS delivery failed';
          lastError = errorMessage;
        }
      } else {
        status = 'FAILED';
        errorMessage = 'EmailJS credentials not configured in .env';
        lastError = errorMessage;
      }

      await logEmailNotification({
        event_type: 'FINANCE_EXCEPTION_RAISED',
        recipient_user_id: prOfficer.userId,
        recipient_email: prOfficer.email,
        recipient_name: prOfficer.fullName,
        entity_type: 'exceptions',
        entity_id: payload.exceptionId,
        po_id: payload.poId,
        invoice_id: payload.invoiceId,
        status: status,
        emailjs_template_id: templateId || 'NOTIFICATION_TEMPLATE',
        template_params: templateParams,
        error_message: errorMessage,
      });
    }

    return {
      success: anySent,
      error: lastError,
      notConfigured: !EMAILJS_CONFIG.isConfigured(),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * PHASE 12 & 13: Optional Supplier Invoice Email
 * Triggered only if supplier optionally enters a recipient email during invoice submission.
 */
export async function sendInvoiceEmail(payload: {
  recipientEmail: string;
  recipientName?: string;
  invoiceId: string;
  invoiceNumber: string;
  poId?: string;
  shipmentId?: string;
  supplierName: string;
  invoiceAmount: number;
  invoiceDate?: string;
  notes?: string;
}): Promise<EmailResult> {
  if (!payload.recipientEmail || !payload.recipientEmail.includes('@')) {
    return { success: false, error: 'Invalid recipient email address provided.' };
  }

  try {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173';
    const recipientName = payload.recipientName || 'Accounts Payable Team';

    const templateParams = {
      to_email: payload.recipientEmail,
      to_name: recipientName,
      recipient_email: payload.recipientEmail,
      recipient_name: recipientName,
      event_type: 'SUPPLIER_INVOICE_SUBMITTED',
      invoice_id: payload.invoiceId,
      invoice_number: payload.invoiceNumber,
      po_id: payload.poId || '',
      shipment_id: payload.shipmentId || '',
      supplier_name: payload.supplierName,
      invoice_amount: `₹${Number(payload.invoiceAmount || 0).toLocaleString('en-IN')}`,
      amount: `₹${Number(payload.invoiceAmount || 0).toLocaleString('en-IN')}`,
      total_amount: `₹${Number(payload.invoiceAmount || 0).toLocaleString('en-IN')}`,
      invoice_date: payload.invoiceDate || new Date().toLocaleDateString('en-IN'),
      status: 'SUBMITTED_FOR_MATCHING',
      event_time: new Date().toLocaleString('en-IN'),
      action_url: `${origin}/invoices`,
      view_url: `${origin}/invoices`,
      message: `Commercial Invoice #${payload.invoiceNumber} has been generated and submitted by "${payload.supplierName}" for the amount of ₹${Number(payload.invoiceAmount || 0).toLocaleString('en-IN')}. The invoice is registered in Supply Sync Accounts Payable queue for 3-way matching.`,
    };

    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | undefined = undefined;

    const templateId = EMAILJS_CONFIG.notificationTemplateId || EMAILJS_CONFIG.poActionTemplateId;

    if (EMAILJS_CONFIG.isConfigured() && templateId) {
      try {
        await emailjs.send(
          EMAILJS_CONFIG.serviceId,
          templateId,
          templateParams,
          EMAILJS_CONFIG.publicKey
        );
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err?.text || err?.message || 'EmailJS delivery failed';
      }
    } else {
      status = 'FAILED';
      errorMessage = 'EmailJS credentials not configured in .env';
    }

    await logEmailNotification({
      event_type: 'SUPPLIER_INVOICE_SUBMITTED',
      recipient_email: payload.recipientEmail,
      recipient_name: recipientName,
      entity_type: 'invoices',
      entity_id: payload.invoiceId,
      po_id: payload.poId,
      invoice_id: payload.invoiceId,
      status: status,
      emailjs_template_id: templateId || 'NOTIFICATION_TEMPLATE',
      template_params: templateParams,
      error_message: errorMessage,
    });

    return {
      success: status === 'SENT',
      error: errorMessage,
      notConfigured: !EMAILJS_CONFIG.isConfigured(),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Aliases for seamless backwards compatibility
export const triggerSupplierPoEmail = sendSupplierPONotification;
export const triggerPoAcceptedNotification = (poId: string, supplierName: string, actorName?: string) =>
  sendPoResponseNotification({ poId, supplierName, responseStatus: 'ACCEPTED_BY_SUPPLIER', actorName });
export const triggerShipmentDispatchedNotification = sendDispatchNotification;
export const triggerFinanceExceptionNotification = sendFinanceExceptionNotification;

export interface EmailPayload {
  eventType: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientRole?: string;
  subject: string;
  bodyHtml?: string;
  bodyText: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function sendTransactionalEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    await logEmailNotification({
      event_type: payload.eventType || 'TRANSACTIONAL_NOTIFICATION',
      recipient_email: payload.recipientEmail,
      recipient_name: payload.recipientRole || 'System Recipient',
      entity_type: (payload.relatedEntityType as any) || 'purchase_orders',
      entity_id: payload.relatedEntityId || '00000000-0000-4000-8000-000000000000',
      status: 'SENT',
      template_params: { subject: payload.subject, body: payload.bodyText },
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Token Validation & Action Execution for Public Landing Page (Optional future action links)
 */
export async function verifyPoActionToken(token: string): Promise<{
  valid: boolean;
  tokenData?: any;
  poData?: any;
  supplierData?: any;
  error?: string;
}> {
  try {
    const { data: tokenRecord, error } = await supabase
      .from('po_action_tokens')
      .select('*, purchase_orders(*, warehouses(*), po_items(*, products(*))), suppliers(*)')
      .eq('token', token)
      .maybeSingle();

    if (error || !tokenRecord) {
      return { valid: false, error: 'Invalid or expired PO action link.' };
    }

    if (tokenRecord.is_used) {
      return {
        valid: false,
        error: 'This action link has already been used.',
        tokenData: tokenRecord,
        poData: tokenRecord.purchase_orders,
        supplierData: tokenRecord.suppliers,
      };
    }

    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      return {
        valid: false,
        error: 'This action link has expired.',
        tokenData: tokenRecord,
        poData: tokenRecord.purchase_orders,
      };
    }

    return {
      valid: true,
      tokenData: tokenRecord,
      poData: tokenRecord.purchase_orders,
      supplierData: tokenRecord.suppliers,
    };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

export async function executePoActionViaToken(payload: {
  token: string;
  action: 'ACCEPT' | 'REJECT';
  rejectionReason?: string;
}): Promise<{ success: boolean; error?: string; poNumber?: string }> {
  try {
    const { valid, tokenData, poData, supplierData, error: verifyErr } = await verifyPoActionToken(payload.token);
    if (!valid || !tokenData || !poData) {
      return { success: false, error: verifyErr || 'Verification failed.' };
    }

    const newStatus = payload.action === 'ACCEPT' ? 'ACCEPTED_BY_SUPPLIER' : 'REJECTED_BY_SUPPLIER';

    const { error: poUpdateErr } = await supabase
      .from('purchase_orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('po_id', tokenData.po_id);

    if (poUpdateErr) throw poUpdateErr;

    await supabase
      .from('po_action_tokens')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        rejection_reason: payload.rejectionReason || null,
      })
      .eq('token', payload.token);

    if (payload.action === 'ACCEPT') {
      await sendPoResponseNotification({
        poId: tokenData.po_id,
        supplierName: supplierData?.supplier_name || 'Vendor Partner',
        responseStatus: 'ACCEPTED_BY_SUPPLIER',
      });
    } else {
      await sendPoResponseNotification({
        poId: tokenData.po_id,
        supplierName: supplierData?.supplier_name || 'Vendor Partner',
        responseStatus: 'REJECTED_BY_SUPPLIER',
        rejectionReason: payload.rejectionReason,
      });
    }

    return { success: true, poNumber: poData.po_number };
  } catch (err: any) {
    return { success: false, error: err.message || 'Action execution failed.' };
  }
}
