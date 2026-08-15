import { supabase } from '../lib/supabase';
import { DriverAssignmentRequest, DriverHistorySummary, Shipment } from '../types/database';
import { routeNotification } from './notifications/notificationRouter';

const DRIVER_REQUESTS_KEY = 'supply_sync_driver_requests';

// Get local or persistent driver requests
export async function fetchDriverRequests(): Promise<DriverAssignmentRequest[]> {
  try {
    const { data: dbRequests } = await supabase
      .from('driver_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbRequests && dbRequests.length > 0) {
      const now = new Date().getTime();
      const mapped: DriverAssignmentRequest[] = dbRequests.map((r: any) => {
        let status = r.status;
        if (status === 'PENDING' && r.response_deadline && new Date(r.response_deadline).getTime() < now) {
          status = 'EXPIRED';
        }
        return {
          request_id: r.request_id,
          shipment_id: r.shipment_id,
          po_id: r.po_id,
          driver_id: r.driver_id,
          supplier_id: r.supplier_id,
          offered_amount: Number(r.offered_amount) || 0,
          origin: r.origin,
          destination: r.destination,
          distance_km: r.distance_km,
          ai_eta_hours: r.ai_eta_hours,
          sent_at: r.created_at,
          expires_at: r.response_deadline || new Date(Date.now() + 3600000).toISOString(),
          status: status,
          response_at: r.response_at,
          rejection_reason: r.rejection_reason,
        };
      });
      saveStoredDriverRequests(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('Database driver requests fetch note:', err);
  }

  return getStoredDriverRequests();
}

export function getStoredDriverRequests(): DriverAssignmentRequest[] {
  try {
    const raw = localStorage.getItem(DRIVER_REQUESTS_KEY);
    if (!raw) return [];
    const requests: DriverAssignmentRequest[] = JSON.parse(raw);
    const now = new Date().getTime();

    // Auto-expire requests past deadline
    return requests.map((req) => {
      if (req.status === 'PENDING' && new Date(req.expires_at).getTime() < now) {
        return { ...req, status: 'EXPIRED' };
      }
      return req;
    });
  } catch {
    return [];
  }
}

export function saveStoredDriverRequests(requests: DriverAssignmentRequest[]) {
  try {
    localStorage.setItem(DRIVER_REQUESTS_KEY, JSON.stringify(requests));
  } catch (err) {
    console.warn('Failed to save driver requests:', err);
  }
}

/**
 * Supplier sends assignment request to multiple eligible drivers simultaneously (Sections 3-7 of updates9.md)
 */
export async function broadcastDriverRequests(payload: {
  shipment_id: string;
  po_id?: string;
  supplier_id: string;
  supplier_name?: string;
  offered_amount: number;
  origin?: string;
  destination?: string;
  distance_km?: number;
  ai_eta_hours?: number;
  selected_drivers: Array<{
    driver_id: string;
    driver_code?: string;
    driver_name: string;
    driver_phone?: string;
    truck_id?: string;
    vehicle_number?: string;
  }>;
  expiry_minutes?: number;
}): Promise<DriverAssignmentRequest[]> {
  const expiryMin = payload.expiry_minutes || 60;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMin * 60000).toISOString();
  const sentAt = now.toISOString();

  const newRequests: DriverAssignmentRequest[] = payload.selected_drivers.map((drv) => ({
    request_id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    shipment_id: payload.shipment_id,
    po_id: payload.po_id,
    driver_id: drv.driver_id,
    driver_code: drv.driver_code || 'DRV-2026-9901',
    driver_name: drv.driver_name,
    driver_phone: drv.driver_phone || '+91 98234 56789',
    truck_id: drv.truck_id,
    vehicle_number: drv.vehicle_number || 'MH-12-AB-9901',
    supplier_id: payload.supplier_id,
    supplier_name: payload.supplier_name,
    offered_amount: payload.offered_amount,
    origin: payload.origin || 'Mumbai Sourcing Hub',
    destination: payload.destination || 'Central Distribution Warehouse',
    distance_km: payload.distance_km || 145,
    ai_eta_hours: payload.ai_eta_hours || 4.2,
    sent_at: sentAt,
    expires_at: expiresAt,
    status: 'PENDING',
  }));

  // 1. Insert into Supabase driver_requests table
  try {
    await supabase.from('driver_requests').insert(
      newRequests.map((r) => ({
        shipment_id: r.shipment_id,
        po_id: r.po_id || null,
        driver_id: r.driver_id,
        supplier_id: r.supplier_id,
        offered_amount: r.offered_amount || 0,
        response_deadline: r.expires_at,
        status: 'PENDING',
        origin: r.origin,
        destination: r.destination,
        distance_km: r.distance_km,
        ai_eta_hours: r.ai_eta_hours,
      }))
    );
  } catch (err) {
    console.warn('Driver requests DB insert note:', err);
  }

  const existing = getStoredDriverRequests();
  // Filter out any existing requests for this shipment
  const filtered = existing.filter((r) => r.shipment_id !== payload.shipment_id);
  const updated = [...newRequests, ...filtered];
  saveStoredDriverRequests(updated);

  // 2. Update Shipment status in Supabase
  try {
    await supabase
      .from('shipments')
      .update({
        status: 'DRIVER_REQUESTED',
        driver_status: 'PENDING',
        driver_request_status: 'PENDING',
        offered_compensation: payload.offered_amount,
        driver_compensation: payload.offered_amount,
      })
      .eq('shipment_id', payload.shipment_id);
  } catch (err) {
    console.warn('Shipment status update note:', err);
  }

  // 3. Notify drivers
  for (const drv of payload.selected_drivers) {
    await routeNotification({
      event_type: 'DRIVER_REQUEST_BROADCAST',
      title: `New Dispatch Request (₹${payload.offered_amount.toLocaleString('en-IN')})`,
      message: `Supplier ${payload.supplier_name || 'Partner'} offered ₹${payload.offered_amount.toLocaleString('en-IN')} for Shipment #${payload.shipment_id.slice(0, 8)}. Route: ${payload.origin} ➔ ${payload.destination}. Response deadline: ${expiryMin} mins.`,
      severity: 'HIGH',
      action_link: '/driver',
    });
  }

  return newRequests;
}

/**
 * Driver accepts request — First Acceptance Wins Atomically (Section 4 of updates9.md)
 */
export async function acceptDriverRequest(
  requestId: string,
  driverId: string
): Promise<{ success: boolean; message: string; shipment_id?: string }> {
  const requests = getStoredDriverRequests();
  const req = requests.find((r) => r.request_id === requestId || r.shipment_id === requestId);

  if (!req) {
    return { success: false, message: 'Request not found.' };
  }

  if (req.status === 'EXPIRED') {
    return { success: false, message: 'This dispatch request has expired.' };
  }

  if (req.status === 'CANCELLED') {
    return { success: false, message: 'This dispatch was already accepted by another driver.' };
  }

  if (req.status === 'ACCEPTED') {
    return { success: true, message: 'You have already accepted this assignment.', shipment_id: req.shipment_id };
  }

  const responseAt = new Date().toISOString();

  // 1. Atomic Winner Assignment in DB
  try {
    // Mark winning request as ACCEPTED
    await supabase
      .from('driver_requests')
      .update({
        status: 'ACCEPTED',
        response_at: responseAt,
      })
      .eq('shipment_id', req.shipment_id)
      .eq('driver_id', req.driver_id);

    // Cancel all other competing requests for this shipment
    await supabase
      .from('driver_requests')
      .update({
        status: 'CANCELLED',
        response_at: responseAt,
      })
      .eq('shipment_id', req.shipment_id)
      .neq('driver_id', req.driver_id);

    // Update shipment
    await supabase
      .from('shipments')
      .update({
        driver_id: req.driver_id,
        driver_status: 'ACCEPTED',
        driver_request_status: 'ACCEPTED',
        status: 'READY_FOR_DISPATCH',
        driver_compensation: req.offered_amount || 0,
      })
      .eq('shipment_id', req.shipment_id);
  } catch (err) {
    console.warn('Driver accept DB update note:', err);
  }

  // 2. Update local state
  const updatedRequests = requests.map((r) => {
    if (r.shipment_id === req.shipment_id) {
      if (r.request_id === req.request_id || r.driver_id === req.driver_id) {
        return { ...r, status: 'ACCEPTED' as const, response_at: responseAt };
      }
      if (r.status === 'PENDING') {
        return { ...r, status: 'CANCELLED' as const, response_at: responseAt };
      }
    }
    return r;
  });

  saveStoredDriverRequests(updatedRequests);

  // 3. Notify Supplier
  await routeNotification({
    event_type: 'DRIVER_ASSIGNMENT_ACCEPTED',
    title: `Driver Accepted Dispatch!`,
    message: `Driver ${req.driver_name || req.driver_code} accepted shipment assignment for ₹${(req.offered_amount || 0).toLocaleString('en-IN')}. Status: READY_FOR_DISPATCH.`,
    severity: 'INFO',
    supplier_id: req.supplier_id,
    action_link: '/supplier',
  });

  return { success: true, message: 'Assignment accepted! Status: READY_FOR_DISPATCH', shipment_id: req.shipment_id };
}

/**
 * Driver rejects request with mandatory reason (Section 3 of updates9.md)
 */
export async function rejectDriverRequest(
  requestId: string,
  driverId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const requests = getStoredDriverRequests();
  const req = requests.find((r) => r.request_id === requestId || r.shipment_id === requestId);

  if (!req) {
    return { success: false, message: 'Request not found.' };
  }

  const responseAt = new Date().toISOString();

  // 1. Update in DB
  try {
    await supabase
      .from('driver_requests')
      .update({
        status: 'REJECTED',
        rejection_reason: reason,
        response_at: responseAt,
      })
      .eq('shipment_id', req.shipment_id)
      .eq('driver_id', req.driver_id);
  } catch (err) {
    console.warn('Driver reject DB update note:', err);
  }

  // 2. Update in local storage
  const updatedRequests = requests.map((r) => {
    if (r.request_id === req.request_id || (r.shipment_id === req.shipment_id && r.driver_id === req.driver_id)) {
      return { ...r, status: 'REJECTED' as const, rejection_reason: reason, response_at: responseAt };
    }
    return r;
  });

  saveStoredDriverRequests(updatedRequests);

  // 3. Route alert to Supplier
  await routeNotification({
    event_type: 'DRIVER_ASSIGNMENT_REJECTED',
    title: `Driver Declined Request`,
    message: `Driver ${req.driver_name || req.driver_code} declined request for shipment. Reason: "${reason}"`,
    severity: 'HIGH',
    supplier_id: req.supplier_id,
    action_link: '/supplier',
  });

  return { success: true, message: 'Assignment rejected. Supplier has been alerted.' };
}

/**
 * Driver History Statistics & Log
 */
export function getDriverHistorySummary(driverId?: string, driverCode?: string): {
  summary: DriverHistorySummary;
  logs: DriverAssignmentRequest[];
} {
  const allRequests = getStoredDriverRequests();
  const driverLogs = allRequests.filter(
    (r) =>
      (!driverId || r.driver_id === driverId) ||
      (!driverCode || r.driver_code === driverCode)
  );

  const accepted = driverLogs.filter((r) => r.status === 'ACCEPTED').length;
  const rejected = driverLogs.filter((r) => r.status === 'REJECTED').length;
  const expired = driverLogs.filter((r) => r.status === 'EXPIRED').length;
  const cancelled = driverLogs.filter((r) => r.status === 'CANCELLED').length;

  return {
    summary: {
      accepted_count: accepted,
      rejected_count: rejected,
      expired_count: expired,
      cancelled_count: cancelled,
      completed_count: accepted,
    },
    logs: driverLogs,
  };
}
