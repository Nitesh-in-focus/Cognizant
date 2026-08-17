import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShoppingCart,
  Truck,
  Receipt,
  ShieldCheck,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Package,
  Radio,
  FileText,
  CreditCard,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Send,
  HelpCircle,
  XCircle,
  ExternalLink,
  Users,
  Eye,
  Calendar,
  MapPin,
  CheckSquare,
  Square,
  AlertTriangle,
  Compass,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import {
  Supplier,
  PurchaseOrder,
  Shipment,
  Invoice,
  QualityCheck,
  SupplierPerformance,
  SupplierScoreHistory,
  DriverAssignmentRequest,
} from '../../types/database';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { OcrScanPanel } from '../../components/common/OcrScanPanel';
import { OcrInvoiceResult } from '../../lib/ocr';
import { sendEmailNotification } from '../../services/notificationService';
import {
  sendPoResponseNotification,
  sendDispatchNotification,
  sendInvoiceEmail,
  triggerPoAcceptedNotification,
  triggerShipmentDispatchedNotification,
} from '../../services/emailService';
import {
  broadcastDriverRequests,
  getStoredDriverRequests,
} from '../../services/driverAssignmentService';
import { LocationPickerModal } from '../../components/maps/LocationPickerModal';

type SupplierTab = 'overview' | 'sent_pos' | 'accepted_pos' | 'shipments' | 'invoices' | 'quality' | 'locations' | 'fleet' | 'profile';

export const SupplierPortal: React.FC = () => {
  const { currentUser, role, showToast, addAlert, effectiveSupplierId, logAuditAction } = useApp();
  const [activeTab, setActiveTab] = useState<SupplierTab>('overview');
  const [loading, setLoading] = useState(true);

  // Supplier isolated data
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [performance, setPerformance] = useState<SupplierPerformance | null>(null);
  const [scoreHistory, setScoreHistory] = useState<SupplierScoreHistory[]>([]);
  const [driverRequests, setDriverRequests] = useState<DriverAssignmentRequest[]>([]);
  const [supplierLocations, setSupplierLocations] = useState<any[]>([]);

  // Modals
  const [openRejectModal, setOpenRejectModal] = useState(false);
  const [openViewPoModal, setOpenViewPoModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedQc, setSelectedQc] = useState<QualityCheck | null>(null);
  const [openViewQcModal, setOpenViewQcModal] = useState(false);

  // Multi-Shipment Creation State
  const [openShipmentModal, setOpenShipmentModal] = useState(false);
  const [shipmentPo, setShipmentPo] = useState<PurchaseOrder | null>(null);
  const [shipmentQty, setShipmentQty] = useState<number>(300);
  const [shipmentOrigin, setShipmentOrigin] = useState('Mumbai JNPT Sourcing Terminal');
  const [shipmentDest, setShipmentDest] = useState('Pune Central DC');
  const [shipmentDispatchDate, setShipmentDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [shipmentExpectedArrival, setShipmentExpectedArrival] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );

  // Multi-Driver Assignment Modal State (Sections 3-7 of updates9.md)
  const [openDriverModal, setOpenDriverModal] = useState(false);
  const [driverModalShipment, setDriverModalShipment] = useState<Shipment | null>(null);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [driverCompensation, setDriverCompensation] = useState<number>(7500);
  const [driverExpiryOption, setDriverExpiryOption] = useState<'30' | '60' | '120' | 'custom'>('60');
  const [customExpiryMin, setCustomExpiryMin] = useState<number>(45);
  const [broadcastingDrivers, setBroadcastingDrivers] = useState(false);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverFilterCategory, setDriverFilterCategory] = useState<'ALL' | 'APP_DRIVER' | 'FLEET_CARRIER' | 'PRIVATE_FLEET'>('ALL');

  // Supplier Location Management State (Sections 24-25 of updates9.md)
  const [openLocationPicker, setOpenLocationPicker] = useState(false);

  // Supplier Fleet State (Updates 10)
  const [supplierDrivers, setSupplierDrivers] = useState<any[]>([]);
  const [supplierTrucks, setSupplierTrucks] = useState<any[]>([]);
  const [fleetSubTab, setFleetSubTab] = useState<'drivers' | 'trucks'>('drivers');
  const [openAddDriverModal, setOpenAddDriverModal] = useState(false);
  const [openAddTruckModal, setOpenAddTruckModal] = useState(false);
  const [newDriver, setNewDriver] = useState({ driver_name: '', phone: '', license_number: '', availability: 'AVAILABLE' });
  const [newTruck, setNewTruck] = useState({ registration_number: '', vehicle_type: 'HCV', capacity: 0, status: 'AVAILABLE' });

  // Partial Dispatch State (Updates 10)
  const [openDispatchModal, setOpenDispatchModal] = useState(false);
  const [dispatchPo, setDispatchPo] = useState<PurchaseOrder | null>(null);
  const [dispatchQty, setDispatchQty] = useState<number>(0);

  // Driver Fallback State (Updates 10)
  const [openFallbackModal, setOpenFallbackModal] = useState(false);
  const [fallbackShipment, setFallbackShipment] = useState<Shipment | null>(null);
  const [fallbackDriverId, setFallbackDriverId] = useState('');
  const [fallbackTruckId, setFallbackTruckId] = useState('');

  // Invoice Upload & Submission Modal State (Updates 11 Sections 8-10 & 18)
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [invoicePoId, setInvoicePoId] = useState('');
  const [invoiceShipmentId, setInvoiceShipmentId] = useState('');
  const [newInvoice, setNewInvoice] = useState({
    invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
    invoiced_quantity: 100,
    unit_price: 250,
    subtotal: 25000,
    tax_amount: 4500,
    freight_charges: 0,
    total_amount: 29500,
    payment_terms: 'NET_30',
    notes: 'Commercial invoice against accepted PO contract.',
  });
  const [invoiceRecipientEmail, setInvoiceRecipientEmail] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrInvoiceResult | null>(null);

  // Eligible Drivers from DB (registered org drivers, fleet trucks, and private drivers)
  const [eligibleOrgDrivers, setEligibleOrgDrivers] = useState<any[]>([]);
  const [allSystemTrucks, setAllSystemTrucks] = useState<any[]>([]);

  const targetSupplierId = effectiveSupplierId || '00000000-0000-4000-8000-000000000003';

  useEffect(() => {
    fetchSupplierData();
  }, [targetSupplierId]);

  const fetchSupplierData = async () => {
    try {
      setLoading(true);
      const [
        { data: supData },
        { data: poData },
        { data: shpData },
        { data: invData },
        { data: qcData },
        { data: perfData },
        { data: histData },
        { data: locData },
        { data: fleetDriverData },
        { data: fleetTruckData },
        { data: appUserData },
        { data: truckFleetData },
      ] = await Promise.all([
        supabase.from('suppliers').select('*').eq('supplier_id', targetSupplierId).maybeSingle(),
        supabase
          .from('purchase_orders')
          .select('*, warehouses(warehouse_name, city), purchase_requisitions(pr_number), po_items(*, products(*))')
          .eq('supplier_id', targetSupplierId)
          .in('status', [
            'SENT_TO_SUPPLIER',
            'ACCEPTED',
            'ACCEPTED_BY_SUPPLIER',
            'REJECTED',
            'REJECTED_BY_SUPPLIER',
            'SUPPLIER_REJECTED',
            'CLARIFICATION_REQUESTED',
            'PARTIALLY_DISPATCHED',
            'DISPATCHED',
            'COMPLETED',
            'CONFIRMED',
          ])
          .order('order_date', { ascending: false }),
        supabase
          .from('shipments')
          .select('*, purchase_orders(po_number, total_amount, total_quantity, dispatched_quantity, remaining_quantity), warehouses(warehouse_name)')
          .eq('supplier_id', targetSupplierId)
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('*')
          .eq('supplier_id', targetSupplierId)
          .order('created_at', { ascending: false }),
        supabase
          .from('quality_checks')
          .select('*, purchase_orders(po_number), products(product_name)')
          .eq('supplier_id', targetSupplierId)
          .order('inspection_date', { ascending: false }),
        supabase
          .from('supplier_performance')
          .select('*')
          .eq('supplier_id', targetSupplierId)
          .maybeSingle(),
        supabase
          .from('supplier_score_history')
          .select('*')
          .eq('supplier_id', targetSupplierId)
          .order('calculated_at', { ascending: false }),
        supabase
          .from('locations')
          .select('*')
          .eq('supplier_id', targetSupplierId)
          .order('created_at', { ascending: false }),
        // Supplier-owned fleet
        supabase.from('supplier_drivers').select('*').eq('supplier_id', targetSupplierId).order('created_at', { ascending: false }),
        supabase.from('supplier_trucks').select('*').eq('supplier_id', targetSupplierId).order('created_at', { ascending: false }),
        // All registered drivers from app_users
        supabase.from('app_users').select('user_id, full_name, email, role, phone, driver_code, status'),
        // All carrier fleet trucks from trucks table
        supabase.from('trucks').select('truck_id, vehicle_number, driver_name, driver_phone, carrier_name, truck_type, status, driver_status').order('driver_name', { ascending: true }),
      ]);

      setSupplier(supData || null);
      setPurchaseOrders(poData || []);
      setShipments(shpData || []);
      setInvoices(invData || []);
      setQualityChecks(qcData || []);
      setPerformance(perfData || null);
      setScoreHistory(histData || []);
      setSupplierLocations(locData || []);
      setSupplierDrivers(fleetDriverData || []);
      setSupplierTrucks(fleetTruckData || []);
      setAllSystemTrucks(truckFleetData || []);

      // Unify all system drivers so every single driver is visible
      const registeredAppDrivers = (appUserData || [])
        .filter((u: any) => u.role === 'TRUCK_DRIVER' || u.role === 'CARRIER_FLEET_DRIVER' || u.role === 'DRIVER' || u.role === 'FLEET_DRIVER' || u.driver_code || u.role === 'WORKER')
        .map((u: any) => ({
          user_id: u.user_id,
          full_name: u.full_name,
          phone: u.phone || '+91 98000 00000',
          driver_code: u.driver_code || `DRV-${u.user_id.slice(0, 4).toUpperCase()}`,
          category: 'APP_DRIVER' as const,
          carrier_name: 'Registered Platform Driver',
          vehicle_number: '',
          truck_id: undefined,
          status: u.status || 'ACTIVE',
        }));

      const carrierTruckDrivers = (truckFleetData || [])
        .filter((t: any) => t.driver_name && t.driver_name.trim() !== '')
        .map((t: any) => ({
          user_id: t.truck_id,
          full_name: t.driver_name,
          phone: t.driver_phone || '+91 91000 20000',
          driver_code: t.vehicle_number || `TRK-${t.truck_id.slice(0, 4).toUpperCase()}`,
          category: 'FLEET_CARRIER' as const,
          carrier_name: t.carrier_name || 'Carrier Fleet Network',
          vehicle_number: t.vehicle_number,
          truck_id: t.truck_id,
          status: t.driver_status || t.status || 'AVAILABLE',
        }));

      const privateFleetDrivers = (fleetDriverData || []).map((d: any) => ({
        user_id: d.supplier_driver_id,
        full_name: d.driver_name,
        phone: d.phone || '+91 98765 43210',
        driver_code: d.license_number || 'PRIVATE-FLEET',
        category: 'PRIVATE_FLEET' as const,
        carrier_name: supData?.supplier_name || 'Supplier Dedicated Fleet',
        vehicle_number: '',
        truck_id: undefined,
        status: d.availability || 'AVAILABLE',
      }));

      // Combine all drivers
      const allUnifiedDrivers = [...registeredAppDrivers, ...carrierTruckDrivers, ...privateFleetDrivers];
      setEligibleOrgDrivers(allUnifiedDrivers);
      setDriverRequests(getStoredDriverRequests());
    } catch (err: any) {
      console.error(err);
      showToast('Error loading supplier portal data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sent PO Feed: Accept / Reject
  const handleAcceptPo = async (po: PurchaseOrder) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'ACCEPTED_BY_SUPPLIER',
          updated_at: new Date().toISOString(),
        })
        .eq('po_id', po.po_id);

      if (error) throw error;

      await logAuditAction('SUPPLIER_PO_ACCEPTED', 'purchase_orders', po.po_id, {
        po_number: po.po_number,
        supplier_id: targetSupplierId,
      });

      // Dispatch EmailJS Notification to PR Officer (Updates 12 Section 4)
      await triggerPoAcceptedNotification(po.po_id, supplier?.supplier_name || 'Vendor Partner', currentUser?.full_name);

      sendEmailNotification({
        alert_type: 'PO_ACCEPTED',
        severity: 'INFO',
        title: `PO #${po.po_number} Accepted by Vendor Partner`,
        message: `Supplier Partner acknowledged and accepted Purchase Order #${po.po_number}. Ready for multi-shipment dispatch allocation.`,
        entity_type: 'purchase_orders',
        entity_number: po.po_number,
        action_link: '/supplier-portal',
      });

      showToast(`Purchase Order #${po.po_number} accepted! Now available in "Accepted POs" for shipment creation.`, 'success');
      fetchSupplierData();
    } catch (err: any) {
      showToast('PO Acceptance failed: ' + err.message, 'error');
    }
  };

  const handleRejectPo = async () => {
    if (!selectedPo || !rejectionReason.trim()) {
      showToast('Please specify a rejection reason.', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'REJECTED',
          notes: `Rejected by Supplier: ${rejectionReason.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('po_id', selectedPo.po_id);

      if (error) throw error;

      await logAuditAction('SUPPLIER_PO_REJECTED', 'purchase_orders', selectedPo.po_id, {
        po_number: selectedPo.po_number,
        reason: rejectionReason.trim(),
      });

      // Dispatch EmailJS Notification to PR Officer (Phase 9)
      await sendPoResponseNotification({
        poId: selectedPo.po_id,
        supplierName: supplier?.supplier_name || 'Vendor Partner',
        responseStatus: 'REJECTED_BY_SUPPLIER',
        rejectionReason: rejectionReason.trim(),
        actorName: currentUser?.full_name,
      });

      showToast(`Purchase Order #${selectedPo.po_number} declined. Procurement notified.`, 'info');
      setOpenRejectModal(false);
      setSelectedPo(null);
      setRejectionReason('');
      fetchSupplierData();
    } catch (err: any) {
      showToast('PO Rejection failed: ' + err.message, 'error');
    }
  };

  // Multi-Shipment Quantity Metrics helper
  const getPoQuantityMetrics = (po: PurchaseOrder) => {
    const totalPoQty = po.po_items?.reduce((sum, item) => sum + Number(item.ordered_quantity || 0), 0) || 1000;
    const poShipments = shipments.filter((s) => s.po_id === po.po_id);
    const allocatedQty = poShipments.reduce((sum, s) => sum + Number(s.total_quantity || 0), 0);
    const remainingQty = Math.max(0, totalPoQty - allocatedQty);

    return {
      totalPoQty,
      allocatedQty,
      remainingQty,
      shipmentCount: poShipments.length,
      shipments: poShipments,
    };
  };

  // Multi-Shipment Creation (Sections 8-9 of updates9.md)
  const handleOpenShipmentModal = (po: PurchaseOrder) => {
    const { remainingQty } = getPoQuantityMetrics(po);
    setShipmentPo(po);
    setShipmentQty(Math.min(remainingQty, 250));
    setShipmentOrigin(supplier?.city ? `${supplier.city} Sourcing Hub` : 'Mumbai JNPT Sourcing Terminal');
    setShipmentDest(po.warehouses?.warehouse_name || 'Pune Central DC');
    setShipmentDispatchDate(new Date().toISOString().split('T')[0]);
    setShipmentExpectedArrival(new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]);
    setOpenShipmentModal(true);
  };

  const handleCreateShipment = async () => {
    if (!shipmentPo) return;
    const { remainingQty } = getPoQuantityMetrics(shipmentPo);

    if (shipmentQty <= 0) {
      showToast('Shipment quantity must be greater than 0.', 'error');
      return;
    }

    if (shipmentQty > remainingQty) {
      showToast(
        `Quantity Error: Cannot allocate ${shipmentQty} units. Maximum remaining unallocated PO quantity is ${remainingQty} units.`,
        'error'
      );
      return;
    }

    try {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const shipmentNumber = `SHP-2026-${suffix}`;
      const asnNumber = `ASN-2026-${suffix}`;

      const { data: shp, error } = await supabase
        .from('shipments')
        .insert([
          {
            shipment_number: shipmentNumber,
            asn_number: asnNumber,
            po_id: shipmentPo.po_id,
            supplier_id: targetSupplierId,
            origin: shipmentOrigin,
            destination: shipmentDest,
            dispatch_date: new Date(shipmentDispatchDate).toISOString(),
            expected_arrival: new Date(shipmentExpectedArrival).toISOString(),
            status: 'READY_FOR_DRIVER',
            driver_status: 'PENDING',
            location_source: 'DECLARED_BY_SUPPLIER',
            total_quantity: shipmentQty,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await logAuditAction('SUPPLIER_SHIPMENT_CREATED', 'shipments', shp.shipment_id, {
        asn_number: asnNumber,
        po_id: shipmentPo.po_id,
        quantity: shipmentQty,
        remaining_po_quantity: remainingQty - shipmentQty,
      });

      showToast(
        `Shipment #${shipmentNumber} created! (${shipmentQty} units allocated, ${remainingQty - shipmentQty} remaining). Now assign drivers in Dispatch.`,
        'success'
      );

      setOpenShipmentModal(false);
      setActiveTab('shipments');
      fetchSupplierData();
    } catch (err: any) {
      showToast('Shipment creation failed: ' + err.message, 'error');
    }
  };

  // Multi-Driver Request Dispatch (Sections 3-7 of updates9.md)
  const handleOpenDriverModal = (shp: Shipment) => {
    setDriverModalShipment(shp);
    setSelectedDriverIds([]);
    setDriverSearchQuery('');
    setDriverFilterCategory('ALL');
    setDriverCompensation(7500);
    setDriverExpiryOption('60');
    setOpenDriverModal(true);
  };

  const handleBroadcastDriverRequests = async () => {
    if (!driverModalShipment || selectedDriverIds.length === 0) {
      showToast('Please select at least one eligible driver from the list.', 'error');
      return;
    }

    if (driverCompensation <= 0) {
      showToast('Driver Compensation must be entered.', 'error');
      return;
    }

    setBroadcastingDrivers(true);
    try {
      const selectedDrivers = eligibleOrgDrivers
        .filter((d) => selectedDriverIds.includes(d.user_id))
        .map(d => ({
          driver_id: d.user_id,
          driver_code: d.driver_code || d.user_id,
          driver_name: d.full_name,
          driver_phone: d.phone,
          availability: d.status || 'AVAILABLE',
          truck_id: d.truck_id,
          vehicle_number: d.vehicle_number || '',
          rating: 4.8,
        }));
      const expiryMinutes = driverExpiryOption === 'custom' ? customExpiryMin : parseInt(driverExpiryOption);

      await broadcastDriverRequests({
        shipment_id: driverModalShipment.shipment_id,
        po_id: driverModalShipment.po_id,
        supplier_id: targetSupplierId,
        supplier_name: supplier?.supplier_name || 'Supplier',
        offered_amount: driverCompensation,
        origin: driverModalShipment.origin,
        destination: driverModalShipment.destination,
        selected_drivers: selectedDrivers,
        expiry_minutes: expiryMinutes,
      });

      showToast(
        `Broadcasted dispatch request to ${selectedDrivers.length} drivers for ₹${driverCompensation.toLocaleString('en-IN')}! (${expiryMinutes}-min deadline, first acceptance wins).`,
        'success'
      );

      setOpenDriverModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Driver broadcast failed: ' + err.message, 'error');
    } finally {
      setBroadcastingDrivers(false);
    }
  };

  // Dispatch Action: Ready for Dispatch ➔ Dispatched / In Transit
  // Dispatch Action: Ready for Dispatch ➔ Dispatched / In Transit
  const handleDispatchShipment = async (shp: Shipment) => {
    try {
      let driverId = shp.driver_id;
      let truckId = shp.truck_id;
      let driverName = (shp as any).driver_name || '';
      let driverPhone = (shp as any).driver_phone || '';
      let driverCode = (shp as any).driver_code || '';
      let vehicleNumber = (shp as any).vehicle_number || '';

      // If no driver assigned, auto-assign from registered carrier drivers
      if (!driverId) {
        const { data: driverUser } = await supabase
          .from('app_users')
          .select('user_id, full_name, phone, driver_code')
          .in('role', ['TRUCK_DRIVER', 'DRIVER'])
          .limit(1)
          .maybeSingle();

        driverId = driverUser?.user_id || 'a0000000-0000-4000-8000-000000000009';
        driverName = driverUser?.full_name || 'Rajesh Sharma';
        driverPhone = driverUser?.phone || '+91 98234 56789';
        driverCode = driverUser?.driver_code || 'DRV-2026-9901';
      }

      if (!truckId) {
        const { data: truckObj } = await supabase
          .from('trucks')
          .select('truck_id, vehicle_number, driver_name')
          .limit(1)
          .maybeSingle();

        truckId = truckObj?.truck_id || null;
        vehicleNumber = truckObj?.vehicle_number || 'MH-12-AB-9901';
        if (!driverName && truckObj?.driver_name) driverName = truckObj.driver_name;
      }

      const dispatchTimestamp = new Date().toISOString();
      const expectedArrival = shp.expected_arrival || new Date(Date.now() + 86400000 * 2).toISOString();

      const { error } = await supabase
        .from('shipments')
        .update({
          status: 'DISPATCHED',
          driver_status: 'ACCEPTED',
          driver_id: driverId,
          truck_id: truckId,
          dispatch_date: dispatchTimestamp,
          expected_arrival: expectedArrival,
          location_source: 'GPS_TELEMETRY',
          updated_at: dispatchTimestamp,
        })
        .eq('shipment_id', shp.shipment_id);

      if (error) throw error;

      // Update PO status to DISPATCHED
      if (shp.po_id) {
        await supabase
          .from('purchase_orders')
          .update({ status: 'DISPATCHED', updated_at: dispatchTimestamp })
          .eq('po_id', shp.po_id);
      }

      // Upsert into driver_requests so driver portal links seamlessly
      if (driverId) {
        await supabase.from('driver_requests').upsert({
          shipment_id: shp.shipment_id,
          po_id: shp.po_id,
          driver_id: driverId,
          supplier_id: targetSupplierId,
          status: 'ACCEPTED',
          offered_amount: (shp as any).driver_compensation || 7500,
          response_at: dispatchTimestamp,
          origin: shp.origin,
          destination: shp.destination,
        });
      }

      // Insert initial waypoint into truck_locations if truckId is present
      if (truckId) {
        await supabase.from('truck_locations').insert([
          {
            truck_id: truckId,
            shipment_id: shp.shipment_id,
            location_name: shp.origin || 'JNPT Port Container Terminal (Mumbai)',
            latitude: 18.9496,
            longitude: 72.9515,
            speed: 35,
            status: 'DISPATCHED',
            timestamp: dispatchTimestamp,
          },
        ]);

        await supabase
          .from('trucks')
          .update({
            status: 'IN_TRANSIT',
            driver_name: driverName,
            driver_phone: driverPhone,
            last_location_update: dispatchTimestamp,
          })
          .eq('truck_id', truckId);
      }

      await logAuditAction('SHIPMENT_DISPATCHED', 'shipments', shp.shipment_id, {
        shipment_number: shp.shipment_number,
        po_id: shp.po_id,
        driver_id: driverId,
      });

      // Dispatch EmailJS Notification to PR Officer (Updates 12 Section 4)
      await triggerShipmentDispatchedNotification({
        shipmentId: shp.shipment_id,
        poId: shp.po_id,
        supplierName: supplier?.supplier_name || 'Vendor Partner',
        shipmentNumber: shp.shipment_number,
        asnNumber: shp.asn_number || `ASN-${shp.shipment_number}`,
        totalQuantity: shp.total_quantity || 100,
        driverName: driverName || 'Carrier Driver',
        vehicleNumber: vehicleNumber || 'Carrier Truck',
        eta: expectedArrival,
      });

      showToast(`Shipment #${shp.shipment_number} dispatched! Driver assigned & live highway tracking started.`, 'success');
      fetchSupplierData();
    } catch (err: any) {
      showToast('Dispatch update failed: ' + err.message, 'error');
    }
  };

  // Quick 1-Click Dispatch from Accepted PO directly to Driver
  const handleQuickDispatchPo = async (po: PurchaseOrder) => {
    const { remainingQty } = getPoQuantityMetrics(po);
    if (remainingQty <= 0) {
      showToast('This Purchase Order is already 100% allocated & fulfilled.', 'info');
      return;
    }

    try {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const shipmentNumber = `SHP-2026-${suffix}`;
      const asnNumber = `ASN-2026-${suffix}`;

      // Resolve driver & truck
      const { data: driverUser } = await supabase
        .from('app_users')
        .select('user_id, full_name, phone, driver_code')
        .in('role', ['TRUCK_DRIVER', 'DRIVER'])
        .limit(1)
        .maybeSingle();

      const { data: truckObj } = await supabase
        .from('trucks')
        .select('truck_id, vehicle_number, driver_name, driver_phone')
        .limit(1)
        .maybeSingle();

      const driverId = driverUser?.user_id || 'a0000000-0000-4000-8000-000000000009';
      const driverName = driverUser?.full_name || truckObj?.driver_name || 'Rajesh Sharma';
      const driverPhone = driverUser?.phone || truckObj?.driver_phone || '+91 98234 56789';
      const driverCode = driverUser?.driver_code || 'DRV-2026-9901';
      const truckId = truckObj?.truck_id || null;
      const vehicleNumber = truckObj?.vehicle_number || 'MH-12-AB-9901';

      const dispatchTimestamp = new Date().toISOString();
      const expectedArrival = new Date(Date.now() + 86400000 * 2).toISOString();

      const { data: shp, error } = await supabase
        .from('shipments')
        .insert([
          {
            shipment_number: shipmentNumber,
            asn_number: asnNumber,
            po_id: po.po_id,
            supplier_id: targetSupplierId,
            driver_id: driverId,
            truck_id: truckId,
            origin: supplier?.city ? `${supplier.city} Facility` : 'Mumbai JNPT Port Terminal',
            destination: po.warehouses?.warehouse_name || 'Pune Central DC',
            dispatch_date: dispatchTimestamp,
            expected_arrival: expectedArrival,
            status: 'DISPATCHED',
            driver_status: 'ACCEPTED',
            location_source: 'GPS_TELEMETRY',
            total_quantity: remainingQty,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Update PO status to DISPATCHED
      await supabase
        .from('purchase_orders')
        .update({ status: 'DISPATCHED', updated_at: dispatchTimestamp })
        .eq('po_id', po.po_id);

      // Save driver request as ACCEPTED
      await supabase.from('driver_requests').insert([
        {
          shipment_id: shp.shipment_id,
          po_id: po.po_id,
          driver_id: driverId,
          supplier_id: targetSupplierId,
          status: 'ACCEPTED',
          offered_amount: 7500,
          response_at: dispatchTimestamp,
          origin: shp.origin,
          destination: shp.destination,
        },
      ]);

      // Insert initial waypoint into truck_locations
      if (truckId) {
        await supabase.from('truck_locations').insert([
          {
            truck_id: truckId,
            shipment_id: shp.shipment_id,
            location_name: shp.origin || 'JNPT Port Container Terminal (Mumbai)',
            latitude: 18.9496,
            longitude: 72.9515,
            speed: 35,
            status: 'DISPATCHED',
            timestamp: dispatchTimestamp,
          },
        ]);

        await supabase
          .from('trucks')
          .update({
            status: 'IN_TRANSIT',
            driver_name: driverName,
            driver_phone: driverPhone,
            last_location_update: dispatchTimestamp,
          })
          .eq('truck_id', truckId);
      }

      await logAuditAction('SHIPMENT_DISPATCHED', 'shipments', shp.shipment_id, {
        shipment_number: shipmentNumber,
        po_id: po.po_id,
        driver_id: driverId,
      });

      // Dispatch EmailJS Notification to PR Officer
      await triggerShipmentDispatchedNotification({
        shipmentId: shp.shipment_id,
        poId: po.po_id,
        supplierName: supplier?.supplier_name || 'Vendor Partner',
        shipmentNumber: shipmentNumber,
        asnNumber: asnNumber,
        totalQuantity: remainingQty,
        driverName: driverName,
        vehicleNumber: vehicleNumber,
        eta: expectedArrival,
      });

      showToast(`1-Click Dispatch: Shipment #${shipmentNumber} generated, driver assigned & live GPS tracking started!`, 'success');
      fetchSupplierData();
    } catch (err: any) {
      showToast('Quick dispatch failed: ' + err.message, 'error');
    }
  };

  // Partial Dispatch: create a shipment for chosen quantity (Updates 10)
  const handleOpenDispatchModal = (po: PurchaseOrder) => {
    const { remainingQty } = getPoQuantityMetrics(po);
    setDispatchPo(po);
    setDispatchQty(Math.min(remainingQty, 100));
    setOpenDispatchModal(true);
  };

  const handlePartialDispatch = async () => {
    if (!dispatchPo) return;
    const { remainingQty } = getPoQuantityMetrics(dispatchPo);

    if (dispatchQty <= 0) {
      showToast('Dispatch quantity must be > 0.', 'error');
      return;
    }
    if (dispatchQty > remainingQty) {
      showToast(`Cannot dispatch ${dispatchQty} units — only ${remainingQty} remaining on PO.`, 'error');
      return;
    }

    try {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const shipmentNumber = `SHP-2026-${suffix}`;
      const asnNumber = `ASN-2026-${suffix}`;

      // Resolve driver & truck
      const { data: driverUser } = await supabase
        .from('app_users')
        .select('user_id, full_name, phone, driver_code')
        .in('role', ['TRUCK_DRIVER', 'DRIVER'])
        .limit(1)
        .maybeSingle();

      const { data: truckObj } = await supabase
        .from('trucks')
        .select('truck_id, vehicle_number, driver_name, driver_phone')
        .limit(1)
        .maybeSingle();

      const driverId = driverUser?.user_id || 'a0000000-0000-4000-8000-000000000009';
      const driverName = driverUser?.full_name || truckObj?.driver_name || 'Rajesh Sharma';
      const driverPhone = driverUser?.phone || truckObj?.driver_phone || '+91 98234 56789';
      const driverCode = driverUser?.driver_code || 'DRV-2026-9901';
      const truckId = truckObj?.truck_id || null;
      const vehicleNumber = truckObj?.vehicle_number || 'MH-12-AB-9901';

      const dispatchTimestamp = new Date().toISOString();
      const expectedArrival = new Date(Date.now() + 86400000 * 2).toISOString();

      const { data: shp, error } = await supabase
        .from('shipments')
        .insert([{
          shipment_number: shipmentNumber,
          asn_number: asnNumber,
          po_id: dispatchPo.po_id,
          supplier_id: targetSupplierId,
          driver_id: driverId,
          truck_id: truckId,
          origin: supplier?.city ? `${supplier.city} Facility` : 'Mumbai JNPT Port Terminal',
          destination: dispatchPo.warehouses?.warehouse_name || 'Pune Central DC',
          dispatch_date: dispatchTimestamp,
          expected_arrival: expectedArrival,
          status: 'DISPATCHED',
          driver_status: 'ACCEPTED',
          location_source: 'GPS_TELEMETRY',
          total_quantity: dispatchQty,
        }])
        .select().single();

      if (error) throw error;

      // Update PO status to DISPATCHED
      await supabase
        .from('purchase_orders')
        .update({ status: 'DISPATCHED', updated_at: dispatchTimestamp })
        .eq('po_id', dispatchPo.po_id);

      // Save driver request as ACCEPTED
      await supabase.from('driver_requests').insert([
        {
          shipment_id: shp.shipment_id,
          po_id: dispatchPo.po_id,
          driver_id: driverId,
          supplier_id: targetSupplierId,
          status: 'ACCEPTED',
          offered_amount: 7500,
          response_at: dispatchTimestamp,
          origin: shp.origin,
          destination: shp.destination,
        },
      ]);

      // Insert initial waypoint into truck_locations
      if (truckId) {
        await supabase.from('truck_locations').insert([
          {
            truck_id: truckId,
            shipment_id: shp.shipment_id,
            location_name: shp.origin || 'JNPT Port Container Terminal (Mumbai)',
            latitude: 18.9496,
            longitude: 72.9515,
            speed: 35,
            status: 'DISPATCHED',
            timestamp: dispatchTimestamp,
          },
        ]);

        await supabase
          .from('trucks')
          .update({
            status: 'IN_TRANSIT',
            driver_name: driverName,
            driver_phone: driverPhone,
            last_location_update: dispatchTimestamp,
          })
          .eq('truck_id', truckId);
      }

      await logAuditAction('PARTIAL_DISPATCH', 'shipments', shp.shipment_id, {
        po_id: dispatchPo.po_id,
        dispatch_qty: dispatchQty,
        remaining_qty: remainingQty - dispatchQty,
      });

      // Dispatch EmailJS Notification to PR Officer
      await triggerShipmentDispatchedNotification({
        shipmentId: shp.shipment_id,
        poId: dispatchPo.po_id,
        supplierName: supplier?.supplier_name || 'Vendor Partner',
        shipmentNumber: shipmentNumber,
        asnNumber: asnNumber,
        totalQuantity: dispatchQty,
        driverName: driverName,
        vehicleNumber: vehicleNumber,
        eta: expectedArrival,
      });

      showToast(`Partial dispatch: ${dispatchQty} units dispatched to driver (${remainingQty - dispatchQty} remain on PO).`, 'success');
      setOpenDispatchModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Partial dispatch failed: ' + err.message, 'error');
    }
  };

  // Fleet CRUD — Add Driver (Updates 10)
  const handleAddFleetDriver = async () => {
    if (!newDriver.driver_name.trim()) { showToast('Driver name is required.', 'error'); return; }
    try {
      const { error } = await supabase.from('supplier_drivers').insert([{
        supplier_id: targetSupplierId,
        driver_name: newDriver.driver_name,
        phone: newDriver.phone,
        license_number: newDriver.license_number,
        availability: newDriver.availability,
        status: 'ACTIVE',
      }]);
      if (error) throw error;
      showToast('Fleet driver added!', 'success');
      setOpenAddDriverModal(false);
      setNewDriver({ driver_name: '', phone: '', license_number: '', availability: 'AVAILABLE' });
      fetchSupplierData();
    } catch (err: any) {
      showToast('Failed to add driver: ' + err.message, 'error');
    }
  };

  // Fleet CRUD — Add Truck (Updates 10)
  const handleAddFleetTruck = async () => {
    if (!newTruck.registration_number.trim()) { showToast('Registration number is required.', 'error'); return; }
    try {
      const { error } = await supabase.from('supplier_trucks').insert([{
        supplier_id: targetSupplierId,
        registration_number: newTruck.registration_number,
        vehicle_type: newTruck.vehicle_type,
        capacity: newTruck.capacity,
        status: 'AVAILABLE',
      }]);
      if (error) throw error;
      showToast('Fleet truck added!', 'success');
      setOpenAddTruckModal(false);
      setNewTruck({ registration_number: '', vehicle_type: 'HCV', capacity: 0, status: 'AVAILABLE' });
      fetchSupplierData();
    } catch (err: any) {
      showToast('Failed to add truck: ' + err.message, 'error');
    }
  };

  // Fallback Fleet Assignment (Updates 10)
  const handleFallbackAssign = async () => {
    if (!fallbackShipment || !fallbackDriverId) { showToast('Select a fleet driver.', 'error'); return; }
    try {
      const driver =
        supplierDrivers.find(d => d.supplier_driver_id === fallbackDriverId) ||
        eligibleOrgDrivers.find(d => d.user_id === fallbackDriverId);
      const driverName = driver?.driver_name || driver?.full_name || 'Assigned Driver';
      const driverPhone = driver?.phone || '';
      const truck =
        supplierTrucks.find(t => t.supplier_truck_id === fallbackTruckId) ||
        allSystemTrucks.find(t => t.truck_id === fallbackTruckId);
      const truckReg = truck?.registration_number || truck?.vehicle_number || '';

      const truckCapacity = Number(truck?.capacity) || 0;
      if (truckCapacity > 0 && fallbackShipment.total_quantity > truckCapacity) {
        showToast(`Truck capacity (${truckCapacity}) is less than shipment quantity (${fallbackShipment.total_quantity}).`, 'error');
        return;
      }

      const { error } = await supabase.from('shipments').update({
        status: 'DISPATCHED',
        driver_status: 'ASSIGNED_FALLBACK',
        dispatch_date: new Date().toISOString(),
      }).eq('shipment_id', fallbackShipment.shipment_id);
      if (error) throw error;

      await logAuditAction('FALLBACK_DRIVER_ASSIGNED', 'shipments', fallbackShipment.shipment_id, {
        supplier_driver: driverName,
        driver_phone: driverPhone,
        supplier_truck: truckReg,
      });

      if (supplierDrivers.some(d => d.supplier_driver_id === fallbackDriverId)) {
        await supabase.from('supplier_drivers').update({ availability: 'BUSY', updated_at: new Date().toISOString() }).eq('supplier_driver_id', fallbackDriverId);
      }
      if (supplierTrucks.some(t => t.supplier_truck_id === fallbackTruckId)) {
        await supabase.from('supplier_trucks').update({ status: 'IN_USE', updated_at: new Date().toISOString() }).eq('supplier_truck_id', fallbackTruckId);
      }

      showToast(`Fleet driver ${driverName} assigned to shipment #${fallbackShipment.shipment_number}. Dispatched.`, 'success');
      setOpenFallbackModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Fallback assignment failed: ' + err.message, 'error');
    }
  };

  // Invoice Upload & Submission Flow (Updates 11 Sections 7-10 & 18)
  const handleOpenInvoiceModal = (poOrShp?: PurchaseOrder | Shipment) => {
    let targetPo: PurchaseOrder | undefined;
    let targetShp: Shipment | undefined;

    if (poOrShp && 'po_number' in poOrShp) {
      targetPo = poOrShp as PurchaseOrder;
    } else if (poOrShp && 'shipment_number' in poOrShp) {
      targetShp = poOrShp as Shipment;
      targetPo = purchaseOrders.find((p) => p.po_id === targetShp?.po_id) || purchaseOrders[0];
    } else {
      targetPo = purchaseOrders.find((p) => p.status === 'ACCEPTED_BY_SUPPLIER' || p.status === 'CONFIRMED') || purchaseOrders[0];
    }

    const targetPoId = targetPo?.po_id || '';
    const targetShipmentId = targetShp?.shipment_id || '';
    const firstItem = (targetPo as any)?.po_items?.[0];

    const qty = targetShp?.total_quantity || Number(firstItem?.ordered_quantity) || Number((targetPo as any)?.total_quantity) || 100;
    const unitPrice = Number(firstItem?.unit_price) || (targetPo ? Math.round(Number(targetPo.total_amount) / 1.18 / qty) : 250);
    const subtotal = qty * unitPrice;
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + tax;

    setInvoicePoId(targetPoId);
    setInvoiceShipmentId(targetShipmentId);
    setNewInvoice({
      invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      invoiced_quantity: qty,
      unit_price: unitPrice,
      subtotal: subtotal,
      tax_amount: tax,
      freight_charges: 0,
      total_amount: total,
      payment_terms: targetPo?.payment_terms || 'NET_30',
      notes: `Commercial invoice for PO #${targetPo?.po_number || '2026'}${targetShp ? ` (Shipment #${targetShp.shipment_number})` : ''}`,
    });
    setOcrResult(null);
    setOpenInvoiceModal(true);
  };

  const handleInvoicePoSelect = (poId: string) => {
    const targetPo = purchaseOrders.find((p) => p.po_id === poId);
    if (!targetPo) {
      setInvoicePoId(poId);
      return;
    }
    const firstItem = (targetPo as any)?.po_items?.[0];
    const qty = Number(firstItem?.ordered_quantity) || Number((targetPo as any)?.total_quantity) || 100;
    const unitPrice = Number(firstItem?.unit_price) || (targetPo.total_amount ? Math.round(Number(targetPo.total_amount) / 1.18 / qty) : 250);
    const subtotal = qty * unitPrice;
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + tax;

    setInvoicePoId(poId);
    setNewInvoice((prev) => ({
      ...prev,
      invoiced_quantity: qty,
      unit_price: unitPrice,
      subtotal: subtotal,
      tax_amount: tax,
      total_amount: total,
      payment_terms: targetPo.payment_terms || prev.payment_terms,
      notes: `Commercial invoice for PO #${targetPo.po_number}`,
    }));
  };

  const handleOcrExtracted = (result: OcrInvoiceResult) => {
    setOcrResult(result);
    setNewInvoice((prev) => {
      const invNum = result.invoiceNumber || prev.invoice_number;
      const invDate = result.invoiceDate || prev.invoice_date;
      const total = result.totalAmount !== null ? result.totalAmount : prev.total_amount;
      const subtotal = result.subtotal !== null ? result.subtotal : Math.round(total / 1.18);
      const tax = result.gstAmount !== null ? result.gstAmount : Math.round(total - subtotal);

      if (result.poNumber) {
        const matched = purchaseOrders.find((p) =>
          p.po_number.toLowerCase().includes(result.poNumber!.toLowerCase()) ||
          result.poNumber!.toLowerCase().includes(p.po_number.toLowerCase())
        );
        if (matched) {
          setInvoicePoId(matched.po_id);
        }
      }

      return {
        ...prev,
        invoice_number: invNum,
        invoice_date: invDate,
        total_amount: total,
        subtotal: subtotal,
        tax_amount: tax,
      };
    });
    showToast(`OCR Scan complete (${result.confidence}% confidence). Review extracted values before submission.`, 'success');
  };

  const handleUploadSupplierInvoice = async () => {
    if (!newInvoice.invoice_number || newInvoice.total_amount <= 0) {
      showToast('Please specify a valid invoice number and positive amount.', 'error');
      return;
    }
    if (!invoicePoId) {
      showToast('Please select a Target Purchase Order.', 'error');
      return;
    }

    try {
      const { data: inv, error } = await supabase.from('invoices').insert([
        {
          invoice_number: newInvoice.invoice_number,
          po_id: invoicePoId,
          shipment_id: invoiceShipmentId || null,
          supplier_id: targetSupplierId,
          invoice_date: new Date(newInvoice.invoice_date).toISOString(),
          due_date: new Date(newInvoice.due_date).toISOString(),
          invoiced_quantity: newInvoice.invoiced_quantity || 100,
          unit_price: newInvoice.unit_price || 250,
          subtotal: newInvoice.subtotal,
          tax_amount: newInvoice.tax_amount,
          freight_charges: newInvoice.freight_charges || 0,
          total_amount: newInvoice.total_amount,
          currency: 'INR',
          payment_terms: newInvoice.payment_terms || 'NET_30',
          status: 'PENDING',
          ocr_status: ocrResult ? 'COMPLETED' : 'MANUAL',
          match_status: 'PENDING',
          payment_status: 'UNPAID',
          notes: ocrResult
            ? `${newInvoice.notes} | [Tesseract OCR ${ocrResult.confidence}% confidence]`
            : newInvoice.notes,
        },
      ]).select().single();

      if (error) throw error;

      await logAuditAction('SUPPLIER_INVOICE_SUBMITTED', 'invoices', inv.invoice_id, {
        supplier_id: targetSupplierId,
        invoice_number: newInvoice.invoice_number,
        total_amount: newInvoice.total_amount,
        po_id: invoicePoId,
      });

      addAlert({
        title: `Supplier Invoice Submitted: ${newInvoice.invoice_number}`,
        message: `Commercial invoice #${newInvoice.invoice_number} submitted to Finance AP Queue (₹${Number(newInvoice.total_amount).toLocaleString()}).`,
        severity: 'info',
        link: '/invoices',
      });

      // Optional Supplier Invoice Email (Phases 12 & 13)
      if (invoiceRecipientEmail.trim()) {
        const emailRes = await sendInvoiceEmail({
          recipientEmail: invoiceRecipientEmail.trim(),
          invoiceId: inv.invoice_id,
          invoiceNumber: newInvoice.invoice_number,
          poId: invoicePoId,
          shipmentId: invoiceShipmentId || undefined,
          supplierName: supplier?.supplier_name || 'Vendor Partner',
          invoiceAmount: newInvoice.total_amount,
          invoiceDate: newInvoice.invoice_date,
          notes: newInvoice.notes,
        });

        if (emailRes.success) {
          showToast(`Invoice #${newInvoice.invoice_number} submitted and email dispatched to ${invoiceRecipientEmail.trim()}!`, 'success');
        } else {
          showToast(`Invoice submitted to AP queue, but email notification failed: ${emailRes.error || 'EmailJS not configured'}.`, 'warning');
        }
      } else {
        showToast(`Invoice #${newInvoice.invoice_number} submitted to Finance AP for 3-Way Match!`, 'success');
      }

      setInvoiceRecipientEmail('');
      setOpenInvoiceModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Invoice submission failed: ' + err.message, 'error');
    }
  };

  // Add Supplier Location (Sections 24-25 of updates9.md)
  const handleSaveSupplierLocation = async (data: {
    formatted_address: string;
    latitude: number;
    longitude: number;
    city: string;
    state?: string;
  }) => {
    try {
      const locationId = crypto.randomUUID();
      const facilityName = `${data.city} Dispatch Terminal Hub`;

      const { error } = await supabase.from('locations').insert([
        {
          location_id: locationId,
          supplier_id: targetSupplierId,
          name: facilityName,
          type: 'SUPPLIER_FACILITY',
          formatted_address: data.formatted_address,
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city,
          state: data.state || 'Maharashtra',
          status: 'ACTIVE',
        },
      ]);

      if (error) throw error;

      showToast(`Facility location "${facilityName}" saved with GPS coordinates!`, 'success');
      fetchSupplierData();
    } catch (err: any) {
      showToast('Failed to save location: ' + err.message, 'error');
    }
  };

  // Filtered PO lists
  const sentPos = purchaseOrders.filter(
    (p) => p.status === 'SENT_TO_SUPPLIER' || p.status === 'DRAFT_AI_GENERATED' || p.status === 'APPROVED'
  );
  const acceptedPos = purchaseOrders.filter(
    (p) => p.status === 'ACCEPTED_BY_SUPPLIER' || p.status === 'CONFIRMED'
  );

  // Filtered Driver List for Driver Broadcast Modal
  const filteredDrivers = eligibleOrgDrivers.filter((driver) => {
    const matchesCategory =
      driverFilterCategory === 'ALL' || driver.category === driverFilterCategory;
    const matchesSearch =
      !driverSearchQuery ||
      driver.full_name?.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      driver.phone?.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      driver.driver_code?.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      driver.carrier_name?.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      driver.vehicle_number?.toLowerCase().includes(driverSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600/30 border border-indigo-400/40 rounded-2xl flex items-center justify-center text-indigo-300">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                SUPPLIER PARTNER PORTAL
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: {supplier?.supplier_code || 'SUP-1003'}</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              {supplier?.supplier_name || 'Tata Industrial Solutions Ltd'}
            </h1>
            <p className="text-xs text-slate-300">
              Primary Contact: {supplier?.contact_person || 'Rahul Mehta'} • {supplier?.email || 'rahul.mehta@tataindustrial.com'} • {supplier?.city || 'Mumbai'}
            </p>
          </div>
        </div>

        {/* Live Score Badge */}
        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/15 text-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-300 block font-semibold">Overall Supplier Rating</span>
          <div className="text-3xl font-black text-amber-300 flex items-center justify-center gap-1.5 mt-0.5">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <span>{performance?.overall_score || 94.5}</span>
            <span className="text-sm font-normal text-slate-300">/ 100</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">Tier-1 Strategic Vendor</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: Building2 },
          { id: 'sent_pos', label: `Sent POs (${sentPos.length})`, icon: Bell },
          { id: 'accepted_pos', label: `Accepted POs (${acceptedPos.length})`, icon: ShoppingCart },
          { id: 'shipments', label: `Shipments & Dispatch (${shipments.length})`, icon: Truck },
          { id: 'invoices', label: `Invoices & Payments (${invoices.length})`, icon: Receipt },
          { id: 'quality', label: `QC Reports (${qualityChecks.length})`, icon: ShieldCheck },
          { id: 'locations', label: `Facility Locations (${supplierLocations.length})`, icon: MapPin },
          { id: 'fleet', label: `My Fleet (${supplierDrivers.length + supplierTrucks.length})`, icon: Users },
          { id: 'profile', label: 'Rating & Profile', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SupplierTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Pending PO Acceptance</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{sentPos.length}</p>
              <span className="text-xs text-slate-500">Requires confirmation</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Accepted POs</span>
              <p className="text-2xl font-black text-indigo-600 mt-1">{acceptedPos.length}</p>
              <span className="text-xs text-slate-500">Ready for multi-shipment dispatch</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Active Dispatches</span>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {shipments.filter((s) => s.status === 'IN_TRANSIT' || s.status === 'DISPATCHED' || s.status === 'READY_FOR_DISPATCH').length}
              </p>
              <span className="text-xs text-slate-500">Inbound highway transport</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Quality Inspection Pass Rate</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">{performance?.quality_score || 96}%</p>
              <span className="text-xs text-slate-500">Authoritative dock QA score</span>
            </div>
          </div>

          {/* Quick POs & Shipments List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <span>Incoming POs Awaiting Acceptance</span>
                </h3>
                <button
                  onClick={() => setActiveTab('sent_pos')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                >
                  View All ({sentPos.length})
                </button>
              </div>

              {sentPos.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">All sent purchase orders have been acknowledged.</div>
              ) : (
                <div className="space-y-2.5">
                  {sentPos.slice(0, 3).map((po) => (
                    <div
                      key={po.po_id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-slate-900">{po.po_number}</div>
                        <div className="text-slate-500">
                          {new Date(po.order_date || '').toLocaleDateString()} • ₹{Number(po.total_amount).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedPo(po);
                            setOpenViewPoModal(true);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleAcceptPo(po)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Shipments & Dispatch Pipeline</span>
                </h3>
                <button
                  onClick={() => setActiveTab('shipments')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                >
                  Manage ({shipments.length})
                </button>
              </div>

              {shipments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No active shipments created yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {shipments.slice(0, 3).map((shp) => (
                    <div
                      key={shp.shipment_id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{shp.shipment_number}</span>
                          <span className="text-[10px] text-blue-700 font-normal">({shp.total_quantity} units)</span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {shp.origin || 'Mumbai'} ➔ {shp.destination || 'Pune DC'}
                        </div>
                      </div>
                      <StatusBadge status={shp.status} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SENT POs FEED ── */}
      {activeTab === 'sent_pos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sent Purchase Orders Feed</h2>
              <p className="text-xs text-slate-500">
                Purchase orders approved and transmitted by Procurement Officer awaiting your acceptance.
              </p>
            </div>
          </div>

          {sentPos.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs">
              No pending purchase orders awaiting acceptance. All sent POs have been acknowledged.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentPos.map((po) => {
                const totalQty = po.po_items?.reduce((sum, item) => sum + Number(item.ordered_quantity || 0), 0) || 1000;
                const prodNames = po.po_items?.map((item) => item.products?.product_name || 'Industrial Material').join(', ') || 'Industrial SKU';

                return (
                  <div key={po.po_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="font-mono font-black text-blue-600 text-sm">{po.po_number}</span>
                        <div className="text-[11px] text-slate-400">Sent Date: {new Date(po.order_date || po.created_at || '').toLocaleDateString()}</div>
                      </div>
                      <StatusBadge status={po.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Products</span>
                        <span className="font-bold text-slate-900 truncate block">{prodNames}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Quantity</span>
                        <span className="font-bold text-slate-900">{totalQty.toLocaleString()} units</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Delivery Location</span>
                        <span className="font-medium text-slate-800">{po.warehouses?.warehouse_name || 'Pune Central DC'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Amount</span>
                        <span className="font-bold text-indigo-700">₹{Number(po.total_amount).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedPo(po);
                          setOpenViewPoModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View PO</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPo(po);
                          setOpenRejectModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Reject PO
                      </button>
                      <button
                        onClick={() => handleAcceptPo(po)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept PO</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: ACCEPTED POs & MULTI-SHIPMENT ALLOCATION ── */}
      {activeTab === 'accepted_pos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Accepted Purchase Orders</h2>
              <p className="text-xs text-slate-500">
                Fulfill accepted contracts by creating 1..N partial or full shipment dispatches.
              </p>
            </div>
          </div>

          {acceptedPos.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs">
              No accepted purchase orders yet. Accept POs from the "Sent POs" tab to begin dispatch creation.
            </div>
          ) : (
            <div className="space-y-3">
              {acceptedPos.map((po) => {
                const { totalPoQty, allocatedQty, remainingQty, shipmentCount } = getPoQuantityMetrics(po);
                const percentAllocated = Math.round((allocatedQty / totalPoQty) * 100);

                return (
                  <div key={po.po_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-base text-slate-900">{po.po_number}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ACCEPTED_BY_SUPPLIER
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Delivery DC: <strong className="text-slate-800">{po.warehouses?.warehouse_name || 'Pune Central DC'}</strong> • Commitment: <strong className="text-indigo-700">₹{Number(po.total_amount).toLocaleString()}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedPo(po);
                            setOpenViewPoModal(true);
                          }}
                          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View PO</span>
                        </button>
                        <button
                          onClick={() => handleOpenInvoiceModal(po)}
                          className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Submit Invoice</span>
                        </button>
                        <button
                          onClick={() => handleOpenDispatchModal(po)}
                          disabled={remainingQty <= 0}
                          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Partial Dispatch</span>
                        </button>
                        <button
                          onClick={() => handleQuickDispatchPo(po)}
                          disabled={remainingQty <= 0}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                          title="Instantly create shipment, assign carrier truck driver, and dispatch to highway"
                        >
                          <Truck className="w-4 h-4" />
                          <span>⚡ Dispatch to Driver</span>
                        </button>
                        <button
                          onClick={() => handleOpenShipmentModal(po)}
                          disabled={remainingQty <= 0}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create Shipment ({remainingQty} units avail)</span>
                        </button>
                      </div>
                    </div>

                    {/* Allocation Progress Bar */}
                    <div className="pt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          Fulfillment Allocation: <strong>{allocatedQty}</strong> of <strong>{totalPoQty}</strong> units ({shipmentCount} shipments created)
                        </span>
                        <span className={`font-bold ${remainingQty === 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                          {remainingQty === 0 ? '100% Fully Allocated' : `${remainingQty} units remaining to fulfill`}
                        </span>
                      </div>

                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${remainingQty === 0 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                          style={{ width: `${Math.min(100, percentAllocated)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: SHIPMENT & DISPATCH MANAGEMENT ── */}
      {activeTab === 'shipments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Shipment & Dispatch Pipeline</h2>
              <p className="text-xs text-slate-500">
                Manage truck dispatches, broadcast driver assignment requests with compensation, and launch live GPS telematics.
              </p>
            </div>
          </div>

          {shipments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs">
              No shipments created. Create a shipment against an accepted purchase order to initiate dispatch.
            </div>
          ) : (
            <div className="space-y-3">
              {shipments.map((shp) => {
                const isReadyForDriver = shp.status === 'READY_FOR_DRIVER' || shp.status === 'CREATED';
                const isDriverRequested = shp.status === 'DRIVER_REQUESTED';
                const isReadyToDispatch = shp.status === 'READY_FOR_DISPATCH' || (shp.driver_status === 'ACCEPTED' && shp.status !== 'DISPATCHED' && shp.status !== 'IN_TRANSIT');
                const isDispatched = shp.status === 'DISPATCHED' || shp.status === 'IN_TRANSIT' || shp.status === 'ARRIVED_AT_FACILITY' || shp.status === 'AT_DOCK';

                return (
                  <div key={shp.shipment_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-blue-600 text-sm">{shp.shipment_number}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                            ASN: {shp.asn_number || 'ASN-2026-9901'}
                          </span>
                          <StatusBadge status={shp.status} size="sm" />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          PO Ref: <strong className="text-slate-800">{shp.purchase_orders?.po_number || 'PO-1045'}</strong> • Quantity: <strong className="text-indigo-700">{shp.total_quantity} units</strong>
                        </div>
                      </div>

                      {/* Contextual Action Buttons */}
                      <div className="flex items-center gap-2">
                        {isReadyForDriver && (
                          <button
                            onClick={() => handleOpenDriverModal(shp)}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Assign Drivers</span>
                          </button>
                        )}

                        {isDriverRequested && (
                          <button
                            onClick={() => handleOpenDriverModal(shp)}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                            <span>Driver Requests Pending (Rebroadcast)</span>
                          </button>
                        )}

                        {isReadyToDispatch && (
                          <button
                            onClick={() => handleDispatchShipment(shp)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Dispatch Shipment</span>
                          </button>
                        )}

                        {isDispatched && (
                          <button
                            onClick={() => handleOpenInvoiceModal(shp)}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Create Invoice</span>
                          </button>
                        )}

                        {!isDispatched && (
                          <button
                            onClick={() => {
                              setFallbackShipment(shp);
                              const availDriver = supplierDrivers.find((d) => d.availability === 'AVAILABLE');
                              const availTruck = supplierTrucks.find((t) => t.status === 'AVAILABLE');
                              setFallbackDriverId(availDriver?.supplier_driver_id || (supplierDrivers[0]?.supplier_driver_id ?? ''));
                              setFallbackTruckId(availTruck?.supplier_truck_id || (supplierTrucks[0]?.supplier_truck_id ?? ''));
                              setOpenFallbackModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                            title="Assign own supplier fleet if org drivers reject or expire"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Fleet Fallback</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-semibold">Origin</span>
                        <span className="font-bold text-slate-800 truncate block">{shp.origin || 'Mumbai Hub'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-semibold">Destination</span>
                        <span className="font-bold text-slate-800 truncate block">{shp.destination || 'Pune Central DC'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-semibold">Driver / Carrier</span>
                        <span className="font-medium text-slate-800 truncate block">{shp.driver_id ? `Assigned Driver (${shp.driver_id.slice(0, 8)})` : 'Unassigned'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-semibold">Expected Arrival</span>
                        <span className="font-mono text-slate-700 block">
                          {shp.expected_arrival ? new Date(shp.expected_arrival).toLocaleDateString() : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: INVOICES & SETTLEMENT ── */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Invoices & Settlement Tracking</h2>
              <p className="text-xs text-slate-500">
                Upload commercial invoices against dispatched shipments for Accounts Payable 3-Way Matching.
              </p>
            </div>
            <button
              onClick={() => handleOpenInvoiceModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Commercial Invoice</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <th className="p-3">Invoice#</th>
                  <th className="p-3">PO Reference</th>
                  <th className="p-3">Shipment Ref</th>
                  <th className="p-3">Invoice Date</th>
                  <th className="p-3 text-right">Invoiced Value</th>
                  <th className="p-3 text-center">3-Way Match</th>
                  <th className="p-3">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="p-3 font-mono text-blue-600">{inv.purchase_orders?.po_number || inv.po_id || 'PO-1045'}</td>
                    <td className="p-3 font-mono text-slate-700">{inv.shipment_id ? `SHP-${inv.shipment_id.slice(0, 6)}` : 'Consolidated'}</td>
                    <td className="p-3 text-slate-600">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(inv.total_amount).toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">
                        {inv.match_status || 'MATCHED'}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={inv.payment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: QUALITY CHECK REPORTS & 8-FACTOR AUDIT RESULTS ── */}
      {activeTab === 'quality' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>Customer Quality Check & 8-Factor Inspection Reports</span>
              </h2>
              <p className="text-xs text-slate-500">
                Live inspection results, 8-factor quality scoring, and physical discrepancy audits updated by customer dock receiving leads.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                8-Factor QA Framework
              </span>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Total Inspections</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{qualityChecks.length}</p>
              <span className="text-xs text-slate-500">Completed dock audits</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Average 8-Factor Score</span>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-black text-emerald-600">
                  {qualityChecks.length > 0
                    ? Math.round((qualityChecks.reduce((sum, q) => sum + Number(q.overall_score || 0), 0) / qualityChecks.length) * 10) / 10
                    : 94.5}
                </p>
                <span className="text-xs text-slate-400 font-bold">/ 100</span>
              </div>
              <span className="text-xs text-emerald-600 font-semibold">Tier-1 Quality Rating</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Accepted Units</span>
              <p className="text-2xl font-black text-indigo-600 mt-1">
                {qualityChecks.reduce((sum, q) => sum + Number(q.accepted_quantity || 0), 0).toLocaleString()}
              </p>
              <span className="text-xs text-slate-500">Passed quality standards</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Total Damaged / Rejected</span>
              <p className="text-2xl font-black text-rose-600 mt-1">
                {qualityChecks.reduce((sum, q) => sum + Number(q.damaged_quantity || 0) + Number(q.rejected_quantity || 0), 0).toLocaleString()}
              </p>
              <span className="text-xs text-slate-500">Units requiring debits</span>
            </div>
          </div>

          {/* Quality Checks Feed */}
          {qualityChecks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">No Quality Inspection reports recorded yet.</p>
              <p className="text-slate-400">Dockside quality inspections submitted by receiving leads will appear here in real-time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {qualityChecks.map((qc) => {
                const score = Number(qc.overall_score || 0);
                const scoreColor =
                  score >= 85
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : score >= 70
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200';

                return (
                  <div key={qc.quality_check_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm">
                              QC #{qc.quality_check_id.slice(0, 8)}
                            </span>
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                              PO: {qc.purchase_orders?.po_number || qc.po_id?.slice(0, 8) || 'PO-1045'}
                            </span>
                            <StatusBadge status={qc.status} size="sm" />
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Product: <strong className="text-slate-800">{qc.products?.product_name || 'Industrial Material'}</strong> • Inspection Date: <strong className="text-slate-700">{qc.inspection_date ? new Date(qc.inspection_date).toLocaleDateString() : 'Recent'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Overall Score Badge */}
                        <div className={`px-4 py-2 rounded-xl border font-bold flex items-center gap-2 ${scoreColor}`}>
                          <Sparkles className="w-4 h-4" />
                          <div className="text-right">
                            <div className="text-xs uppercase text-slate-500 font-semibold leading-none">8-Factor Score</div>
                            <div className="text-base font-black leading-tight">{score} / 100</div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedQc(qc);
                            setOpenViewQcModal(true);
                          }}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Full Dossier</span>
                        </button>
                      </div>
                    </div>

                    {/* Quantities Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Expected</span>
                        <strong className="text-slate-800 font-mono text-sm">{Number(qc.expected_quantity || 0).toLocaleString()}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                        <span className="text-[10px] uppercase text-blue-600 font-bold block">Received</span>
                        <strong className="text-blue-800 font-mono text-sm">{Number(qc.received_quantity || 0).toLocaleString()}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] uppercase text-emerald-600 font-bold block">Accepted</span>
                        <strong className="text-emerald-800 font-mono text-sm">{Number(qc.accepted_quantity || 0).toLocaleString()}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                        <span className="text-[10px] uppercase text-rose-600 font-bold block">Damaged</span>
                        <strong className="text-rose-800 font-mono text-sm">{Number(qc.damaged_quantity || 0).toLocaleString()}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                        <span className="text-[10px] uppercase text-red-600 font-bold block">Rejected</span>
                        <strong className="text-red-800 font-mono text-sm">{Number(qc.rejected_quantity || 0).toLocaleString()}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <span className="text-[10px] uppercase text-amber-600 font-bold block">Missing</span>
                        <strong className="text-amber-800 font-mono text-sm">{Number(qc.missing_quantity || 0).toLocaleString()}</strong>
                      </div>
                    </div>

                    {/* 8-Factor Scores Quick Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">1. Product Quality (20%):</span>
                        <strong className="font-mono text-indigo-700">{qc.factor_product_quality || Math.round(Number(qc.product_quality_score || 36) / 4)}/10</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">2. Qty Accuracy (15%):</span>
                        <strong className="font-mono text-indigo-700">{qc.factor_quantity_accuracy || Math.round(Number(qc.quantity_accuracy_score || 20) / 2)}/10</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">3. Packaging (10%):</span>
                        <strong className="font-mono text-indigo-700">{qc.factor_packaging || Math.round(Number(qc.packaging_score || 10) / 1)}/10</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">4. Damage Condition (15%):</span>
                        <strong className="font-mono text-indigo-700">{qc.factor_damage_condition || 9}/10</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">5. Documentation (10%):</span>
                        <strong className="font-mono text-indigo-700">{qc.factor_documentation || Math.round(Number(qc.documentation_score || 10) / 1)}/10</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">6. Delivery Condition (10%):</span>
                        <strong className="font-mono text-indigo-700">{qc.factor_delivery_condition || Math.round(Number(qc.delivery_condition_score || 10) / 1)}/10</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">7. Compliance (10%):</span>
                        <strong className="font-mono text-indigo-700">{qc.factor_compliance || 10}/10</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 flex items-center justify-between">
                        <span className="text-slate-600 text-[11px]">8. Overall Lot (10%):</span>
                        <strong className="font-mono text-indigo-700">{qc.factor_overall || 9}/10</strong>
                      </div>
                    </div>

                    {/* Inspector Remarks */}
                    {qc.remarks && (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
                        <strong className="text-amber-900 block mb-0.5">Inspector Remarks & Notes:</strong>
                        <p className="text-slate-700 italic">{qc.remarks}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 6: SUPPLIER LOCATION MANAGEMENT (Sections 24-25 of updates9.md) ── */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Supplier Origin Facilities & Dispatch Terminals</h2>
              <p className="text-xs text-slate-500">
                Manage registered dispatch locations, pickup docks, and exact Google Maps GPS pin coordinates.
              </p>
            </div>

            <button
              onClick={() => setOpenLocationPicker(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Facility Location</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Default Sourcing Facility */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{supplier?.city || 'Mumbai'} Primary Sourcing Hub</span>
                    <span className="text-[10px] text-slate-400 font-mono">PRIMARY ORIGIN</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ACTIVE
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>{supplier?.address || 'MIDC Industrial Corridor, Andheri East, Mumbai'}</span>
                </div>
                <div className="text-[11px] font-mono text-indigo-600">
                  Coordinates: 18.9496° N, 72.9515° E
                </div>
              </div>
            </div>

            {/* Custom Saved Locations */}
            {supplierLocations.map((loc) => (
              <div key={loc.location_id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">{loc.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{loc.city || 'India'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {loc.status}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{loc.formatted_address}</span>
                  </div>
                  <div className="text-[11px] font-mono text-indigo-600">
                    Coordinates: {Number(loc.latitude).toFixed(4)}° N, {Number(loc.longitude).toFixed(4)}° E
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: SUPPLIER PRIVATE FLEET (Sections 14-16 of updates10.md) ── */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Supplier Private Fleet & Transport Assets</h2>
              <p className="text-xs text-slate-500">
                Manage your private dedicated drivers and trucks. These assets are exclusively available to your supplier account and serve as primary fallback during carrier shortages.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenAddDriverModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Fleet Driver</span>
              </button>
              <button
                onClick={() => setOpenAddTruckModal(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>Add Fleet Truck</span>
              </button>
            </div>
          </div>

          {/* Grid of Drivers and Trucks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Drivers Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Private Drivers ({supplierDrivers.length})</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">SUPPLIER-OWNED</span>
              </div>

              {supplierDrivers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                  No private drivers registered yet. Add drivers to enable fallback dispatch.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {supplierDrivers.map((driver) => (
                    <div
                      key={driver.supplier_driver_id}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{driver.driver_name}</span>
                          {driver.license_number && (
                            <span className="text-[10px] font-mono text-slate-400 font-normal">
                              Lic: {driver.license_number}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Phone: {driver.phone || 'N/A'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            driver.availability === 'AVAILABLE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : driver.availability === 'BUSY'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {driver.availability}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trucks Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  <span>Private Trucks & Vehicles ({supplierTrucks.length})</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">SUPPLIER-OWNED</span>
              </div>

              {supplierTrucks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                  No private trucks registered yet. Add trucks with cargo capacity to enable fallback dispatch.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {supplierTrucks.map((truck) => (
                    <div
                      key={truck.supplier_truck_id}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span className="font-mono text-indigo-700">{truck.registration_number}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {truck.vehicle_type}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Payload Capacity: <strong>{truck.capacity ? `${truck.capacity} units` : 'Unspecified'}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            truck.status === 'AVAILABLE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : truck.status === 'IN_USE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {truck.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 7: QUALITY & PROFILE ── */}
      {(activeTab === 'quality' || activeTab === 'profile') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Multi-Criteria Scorecard</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span>Quality Compliance (35%):</span>
                <span className="font-bold text-indigo-700">{performance?.quality_score || 95}%</span>
              </div>
              <div className="flex justify-between">
                <span>On-Time Delivery (25%):</span>
                <span className="font-bold text-indigo-700">{performance?.delivery_score || 92}%</span>
              </div>
              <div className="flex justify-between">
                <span>Quantity Accuracy (15%):</span>
                <span className="font-bold text-indigo-700">{performance?.quantity_accuracy_score || 98}%</span>
              </div>
              <div className="flex justify-between">
                <span>Invoice Accuracy (10%):</span>
                <span className="font-bold text-indigo-700">{performance?.invoice_accuracy_score || 95}%</span>
              </div>
              <div className="flex justify-between">
                <span>Operational Responsiveness (10%):</span>
                <span className="font-bold text-indigo-700">{performance?.responsiveness_score || 92}%</span>
              </div>
              <div className="flex justify-between">
                <span>Historical Reliability (5%):</span>
                <span className="font-bold text-indigo-700">{performance?.reliability_score || 96}%</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">QC Finalized Score History & Trends</h3>
            <div className="space-y-2">
              {scoreHistory.map((hist) => (
                <div
                  key={hist.history_id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{new Date(hist.calculated_at).toLocaleDateString()} Evaluation</span>
                    <span className="text-slate-500 block text-[11px]">Period Audit Evaluation</span>
                  </div>
                  <span className="font-bold text-amber-600 text-sm">{(hist as any).composite_score || (hist as any).score || 95} / 100</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 1: VIEW PO SPECIFICATIONS (Section 10 of updates9.md) ── */}
      {openViewPoModal && selectedPo && (
        <Modal
          title={`Purchase Order Specifications: ${selectedPo.po_number}`}
          subtitle="Official contract issued by Procurement Officer"
          isOpen={openViewPoModal}
          onClose={() => {
            setOpenViewPoModal(false);
            setSelectedPo(null);
          }}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Header Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">PO Number</span>
                <span className="font-mono font-extrabold text-blue-600 text-xs">{selectedPo.po_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">PR Reference</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{selectedPo.purchase_requisitions?.pr_number || 'PR-2026-001'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Supplier ID</span>
                <span className="font-mono font-bold text-indigo-600 text-xs">{supplier?.supplier_code || 'SUP-1003'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">PO Status</span>
                <StatusBadge status={selectedPo.status} size="sm" />
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <label className="font-bold text-slate-800 block mb-1.5">Contract Items & Pricing</label>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase">
                      <th className="py-2.5 px-3">Product Name & SKU</th>
                      <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPo.po_items?.map((item: any) => (
                      <tr key={item.po_item_id || item.product_id}>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.products?.product_name || 'Industrial Material Component'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.products?.product_code || 'PRD-SKU-9901'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">{item.ordered_quantity} units</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">₹{Number(item.unit_price || 150).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-700">₹{Number(item.line_total || item.ordered_quantity * (item.unit_price || 150)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery DC & Terms */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Delivery Facility & Date</span>
                <div className="font-bold text-slate-800">{selectedPo.warehouses?.warehouse_name || 'Pune Central DC'}</div>
                <div className="text-slate-500 text-[11px]">Required by: {new Date(selectedPo.expected_delivery_date || Date.now()).toLocaleDateString()}</div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Commercial Terms</span>
                <div className="font-bold text-slate-800">Net 30 Days Commercial Settlement</div>
                <div className="text-slate-500 text-[11px]">Total Commitment: ₹{Number(selectedPo.total_amount).toLocaleString()}</div>
              </div>
            </div>

            {/* Multi-Shipment Allocation Progress */}
            {(() => {
              const { totalPoQty, allocatedQty, remainingQty, shipmentCount } = getPoQuantityMetrics(selectedPo);
              const percent = Math.round((allocatedQty / totalPoQty) * 100);
              return (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-900 text-xs">
                    <span>Fulfillment Progress:</span>
                    <span>{allocatedQty} / {totalPoQty} units ({percent}%)</span>
                  </div>
                  <div className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600 pt-0.5">
                    <span>Active Shipments: <strong>{shipmentCount}</strong></span>
                    <span>Remaining Unallocated: <strong className="text-indigo-700">{remainingQty} units</strong></span>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setOpenViewPoModal(false);
                  setSelectedPo(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL 2: REJECT PO ── */}
      {openRejectModal && selectedPo && (
        <Modal
          title={`Decline Purchase Order: ${selectedPo.po_number}`}
          subtitle="A mandatory reason is required to notify Procurement"
          isOpen={openRejectModal}
          onClose={() => setOpenRejectModal(false)}
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Reason for Rejection <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Specify reason (e.g. insufficient production capacity, raw material stockout, lead-time mismatch)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpenRejectModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectPo}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL 3: MULTI-SHIPMENT CREATION (Section 8-9 of updates9.md) ── */}
      {openShipmentModal && shipmentPo && (
        <Modal
          title={`Create Shipment against PO #${shipmentPo.po_number}`}
          subtitle="Multi-shipment dispatch allocation engine"
          isOpen={openShipmentModal}
          onClose={() => setOpenShipmentModal(false)}
        >
          <div className="space-y-4 text-xs">
            {/* Allocation Stats Card */}
            {(() => {
              const { totalPoQty, allocatedQty, remainingQty } = getPoQuantityMetrics(shipmentPo);
              return (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>PO Total Contract Units:</span>
                    <span>{totalPoQty.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Already Allocated to Shipments:</span>
                    <span className="font-semibold">{allocatedQty.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between font-black text-indigo-700 text-sm pt-1 border-t border-indigo-200">
                    <span>Remaining Unallocated:</span>
                    <span>{remainingQty.toLocaleString()} units</span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Shipment Quantity (Units)</label>
                <input
                  type="number"
                  value={shipmentQty}
                  onChange={(e) => setShipmentQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Origin Facility Hub</label>
                <input
                  type="text"
                  value={shipmentOrigin}
                  onChange={(e) => setShipmentOrigin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Delivery Facility</label>
                <input
                  type="text"
                  value={shipmentDest}
                  onChange={(e) => setShipmentDest(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Expected Dispatch Date</label>
                <input
                  type="date"
                  value={shipmentDispatchDate}
                  onChange={(e) => setShipmentDispatchDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenShipmentModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateShipment}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Confirm Shipment Creation
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL 4: MULTI-DRIVER REQUEST BROADCAST (Sections 3-7 of updates9.md) ── */}
      {openDriverModal && driverModalShipment && (
        <Modal
          title={`Broadcast Driver Requests: ${driverModalShipment.shipment_number}`}
          subtitle="First valid driver acceptance atomically wins the trip assignment"
          isOpen={openDriverModal}
          onClose={() => setOpenDriverModal(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Multi-Driver Broadcast & First-Acceptance-Wins Rule</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Selected drivers will receive a simultaneous push dispatch request with your offered compensation and deadline. The first driver to accept atomically claims the shipment; all other pending requests will be cancelled automatically.
              </p>
            </div>

            {/* Driver Compensation & Deadline Input (Sections 5-6 of updates9.md) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  Driver Compensation (INR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    min="500"
                    step="100"
                    value={driverCompensation}
                    onChange={(e) => setDriverCompensation(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-sm focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">Response Deadline</label>
                <select
                  value={driverExpiryOption}
                  onChange={(e) => setDriverExpiryOption(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                >
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                  <option value="120">2 Hours</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            {driverExpiryOption === 'custom' && (
              <div>
                <label className="font-bold text-slate-900 block mb-1">Custom Deadline (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={customExpiryMin}
                  onChange={(e) => setCustomExpiryMin(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold text-slate-900 block text-xs">
                  Select Drivers from Fleet Network ({eligibleOrgDrivers.length} Registered System Drivers)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = filteredDrivers.map((d) => d.user_id);
                      setSelectedDriverIds(allIds);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Select All ({filteredDrivers.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDriverIds([])}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search driver by name, phone, truck number, or carrier..."
                  value={driverSearchQuery}
                  onChange={(e) => setDriverSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 text-[10px]">
                {[
                  { id: 'ALL', label: `All Drivers (${eligibleOrgDrivers.length})` },
                  { id: 'FLEET_CARRIER', label: `Carrier Fleet Trucks (${eligibleOrgDrivers.filter((d) => d.category === 'FLEET_CARRIER').length})` },
                  { id: 'APP_DRIVER', label: `Registered App Drivers (${eligibleOrgDrivers.filter((d) => d.category === 'APP_DRIVER').length})` },
                  { id: 'PRIVATE_FLEET', label: `Private Fleet (${eligibleOrgDrivers.filter((d) => d.category === 'PRIVATE_FLEET').length})` },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setDriverFilterCategory(cat.id as any)}
                    className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      driverFilterCategory === cat.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Drivers List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {filteredDrivers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                    No drivers match your search query. Try clearing the search filter.
                  </div>
                ) : (
                  filteredDrivers.map((driver) => {
                    const isChecked = selectedDriverIds.includes(driver.user_id);
                    return (
                      <div
                        key={driver.user_id}
                        onClick={() => {
                          setSelectedDriverIds((prev) =>
                            isChecked ? prev.filter((id) => id !== driver.user_id) : [...prev, driver.user_id]
                          );
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-300'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-indigo-600">
                            {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                              <span className="text-xs">{driver.full_name}</span>
                              <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                                {driver.driver_code}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                driver.category === 'APP_DRIVER'
                                  ? 'bg-blue-100 text-blue-800'
                                  : driver.category === 'FLEET_CARRIER'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {driver.category === 'APP_DRIVER' ? 'App Driver' : driver.category === 'FLEET_CARRIER' ? 'Carrier Fleet' : 'Private Fleet'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{driver.phone}</span>
                              {driver.carrier_name && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 font-medium">{driver.carrier_name}</span>
                                </>
                              )}
                              {driver.vehicle_number && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono font-bold text-slate-700">{driver.vehicle_number}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] shrink-0">
                          {driver.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-500">
                Offered: <strong>₹{driverCompensation.toLocaleString('en-IN')}</strong> • Deadline: <strong>{driverExpiryOption === 'custom' ? customExpiryMin : driverExpiryOption} mins</strong>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpenDriverModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={broadcastingDrivers || selectedDriverIds.length === 0}
                  onClick={handleBroadcastDriverRequests}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {broadcastingDrivers ? 'Broadcasting...' : `Send Requests (${selectedDriverIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}



      {/* ── MODAL: PARTIAL DISPATCH (Updates 10 Section 5) ── */}
      {openDispatchModal && dispatchPo && (
        <Modal
          title={`Partial Dispatch: PO #${dispatchPo.po_number}`}
          subtitle="Choose exact quantity to dispatch now vs leave remaining on PO"
          isOpen={openDispatchModal}
          onClose={() => setOpenDispatchModal(false)}
        >
          {(() => {
            const { totalPoQty, allocatedQty, remainingQty } = getPoQuantityMetrics(dispatchPo);
            return (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>PO Total Contract Units:</span>
                    <span>{totalPoQty.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Already Dispatched/Allocated:</span>
                    <span className="font-semibold">{allocatedQty.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between font-black text-indigo-700 text-sm pt-1 border-t border-indigo-200">
                    <span>Remaining to Dispatch:</span>
                    <span>{remainingQty.toLocaleString()} units</span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-900 block mb-1">
                    Units to Dispatch Now <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={remainingQty}
                    value={dispatchQty}
                    onChange={(e) => setDispatchQty(Math.max(1, Math.min(remainingQty, Number(e.target.value))))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-sm"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    After this dispatch: {Math.max(0, remainingQty - dispatchQty)} units will remain unfulfilled on the PO.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setOpenDispatchModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePartialDispatch}
                    disabled={dispatchQty <= 0 || dispatchQty > remainingQty}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    Confirm Dispatch ({dispatchQty} Units)
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ── MODAL: SUPPLIER FLEET FALLBACK ASSIGNMENT (Updates 10 Section 10) ── */}
      {openFallbackModal && fallbackShipment && (
        <Modal
          title={`Assign Private Fleet to Shipment #${fallbackShipment.shipment_number}`}
          subtitle="Direct fallback assignment using supplier-owned driver and truck assets"
          isOpen={openFallbackModal}
          onClose={() => setOpenFallbackModal(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <Truck className="w-4 h-4 text-amber-700" />
                <span>Supplier Private Fleet Fallback Protocol</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Use this when organization drivers are unavailable, have rejected requests, or broadcast response deadlines have expired.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 space-y-1">
              <div className="flex justify-between">
                <span>Shipment Cargo Volume:</span>
                <strong className="text-slate-900">{fallbackShipment.total_quantity} units</strong>
              </div>
              <div className="flex justify-between">
                <span>Destination:</span>
                <strong className="text-slate-900">{fallbackShipment.destination}</strong>
              </div>
            </div>

            {/* Select Driver */}
            <div>
              <label className="font-bold text-slate-900 block mb-1.5">
                Select Dedicated Driver <span className="text-rose-500">*</span>
              </label>
              {eligibleOrgDrivers.length === 0 ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px]">
                  No drivers registered in the system.
                </div>
              ) : (
                <select
                  value={fallbackDriverId}
                  onChange={(e) => setFallbackDriverId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 text-xs"
                >
                  <option value="">-- Choose Driver ({eligibleOrgDrivers.length} Available) --</option>
                  {eligibleOrgDrivers.map((d) => (
                    <option key={d.user_id} value={d.user_id}>
                      {d.full_name} ({d.phone}) • [{d.category === 'APP_DRIVER' ? 'App Driver' : d.category === 'FLEET_CARRIER' ? `Carrier ${d.vehicle_number || ''}` : 'Private'}] {d.status}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Select Truck */}
            <div>
              <label className="font-bold text-slate-900 block mb-1.5">
                Select Transport Truck / Carrier <span className="text-rose-500">*</span>
              </label>
              {supplierTrucks.length === 0 && allSystemTrucks.length === 0 ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px]">
                  No trucks registered in the system.
                </div>
              ) : (
                <select
                  value={fallbackTruckId}
                  onChange={(e) => setFallbackTruckId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 text-xs"
                >
                  <option value="">-- Choose Transport Truck --</option>
                  {supplierTrucks.map((t) => (
                    <option key={t.supplier_truck_id} value={t.supplier_truck_id}>
                      [Private Fleet] {t.registration_number} ({t.vehicle_type}, Cap: {t.capacity || 'N/A'} units) - {t.status}
                    </option>
                  ))}
                  {allSystemTrucks.map((t) => (
                    <option key={t.truck_id} value={t.truck_id}>
                      [{t.carrier_name || 'Carrier Fleet'}] {t.vehicle_number} ({t.truck_type || 'Heavy Container'}, Cap: {t.capacity || '10-Ton'}) - {t.status}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Capacity Warning Check */}
            {(() => {
              const selectedTruck = supplierTrucks.find((t) => t.supplier_truck_id === fallbackTruckId);
              if (selectedTruck && selectedTruck.capacity > 0 && fallbackShipment.total_quantity > selectedTruck.capacity) {
                return (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Warning: Truck capacity ({selectedTruck.capacity} units) is smaller than shipment quantity ({fallbackShipment.total_quantity} units)!
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenFallbackModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFallbackAssign}
                disabled={!fallbackDriverId || !fallbackTruckId}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                Confirm Fallback & Dispatch
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: ADD FLEET DRIVER (Updates 10 Section 14) ── */}
      {openAddDriverModal && (
        <Modal
          title="Add Private Fleet Driver"
          subtitle="Register a driver dedicated exclusively to your supplier organization"
          isOpen={openAddDriverModal}
          onClose={() => setOpenAddDriverModal(false)}
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-900 block mb-1">
                Driver Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Vikram Shinde"
                value={newDriver.driver_name}
                onChange={(e) => setNewDriver({ ...newDriver, driver_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-900 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={newDriver.phone}
                  onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-900 block mb-1">Driving License Number</label>
                <input
                  type="text"
                  placeholder="MH-04-2018-0099881"
                  value={newDriver.license_number}
                  onChange={(e) => setNewDriver({ ...newDriver, license_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-1">Initial Availability</label>
              <select
                value={newDriver.availability}
                onChange={(e) => setNewDriver({ ...newDriver, availability: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 text-xs"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="BUSY">BUSY</option>
                <option value="OFF_DUTY">OFF_DUTY</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenAddDriverModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFleetDriver}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Save Driver
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: ADD FLEET TRUCK (Updates 10 Section 15) ── */}
      {openAddTruckModal && (
        <Modal
          title="Add Private Fleet Truck"
          subtitle="Register a truck/carrier vehicle owned by your supplier organization"
          isOpen={openAddTruckModal}
          onClose={() => setOpenAddTruckModal(false)}
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-900 block mb-1">
                Vehicle Registration Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="MH 12 AB 4589"
                value={newTruck.registration_number}
                onChange={(e) => setNewTruck({ ...newTruck, registration_number: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-900 block mb-1">Vehicle Classification</label>
                <select
                  value={newTruck.vehicle_type}
                  onChange={(e) => setNewTruck({ ...newTruck, vehicle_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 text-xs"
                >
                  <option value="HCV">Heavy Commercial Vehicle (HCV)</option>
                  <option value="MCV">Medium Commercial Vehicle (MCV)</option>
                  <option value="LCV">Light Commercial Vehicle (LCV)</option>
                  <option value="TRAILER">Multi-Axle Trailer</option>
                  <option value="CONTAINER">Container Carrier</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">Cargo Capacity (Units)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 500"
                  value={newTruck.capacity || ''}
                  onChange={(e) => setNewTruck({ ...newTruck, capacity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenAddTruckModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFleetTruck}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Save Truck
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: COMMERCIAL INVOICE SUBMISSION WITH OCR (Updates 11 Sections 7-10 & 18) ── */}
      {openInvoiceModal && (
        <Modal
          title="Submit Commercial Supplier Invoice"
          subtitle="Generate and transmit commercial invoice with OCR document scan for Accounts Payable 3-Way Match"
          isOpen={openInvoiceModal}
          onClose={() => setOpenInvoiceModal(false)}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setOpenInvoiceModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadSupplierInvoice}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Submit Invoice to Finance AP</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Target PO Selector */}
            <div>
              <label className="font-bold text-slate-900 block mb-1">
                Select Purchase Order <span className="text-rose-500">*</span>
              </label>
              <select
                value={invoicePoId}
                onChange={(e) => handleInvoicePoSelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs"
              >
                <option value="">-- Select Accepted PO --</option>
                {purchaseOrders.map((p) => (
                  <option key={p.po_id} value={p.po_id}>
                    {p.po_number} ({p.status} • Total: ₹{Number(p.total_amount || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-derived PO Details Banner */}
            {(() => {
              const po = purchaseOrders.find((p) => p.po_id === invoicePoId);
              if (!po) return null;
              return (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Delivery DC</span>
                    <strong className="text-slate-900 truncate block">{po.warehouses?.warehouse_name || 'Central DC'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Contract Amount</span>
                    <strong className="text-blue-700 font-mono">₹{Number(po.total_amount || 0).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Payment Terms</span>
                    <strong className="text-slate-900">{po.payment_terms || 'NET_30'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">PR Reference</span>
                    <strong className="text-slate-900 font-mono">{po.purchase_requisitions?.pr_number || 'PR-2026'}</strong>
                  </div>
                </div>
              );
            })()}

            {/* OCR Document Scanner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Upload & Run Tesseract OCR on Invoice Document (Optional)</span>
                </span>
                <span className="text-[10px] text-slate-400">PNG, JPG, PDF</span>
              </div>
              <OcrScanPanel
                onExtracted={handleOcrExtracted}
                documentLabel="Commercial Invoice"
              />
            </div>

            {/* Invoice Fields Form */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoice Number <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newInvoice.invoice_number}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={newInvoice.invoice_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoiced Qty</label>
                  <input
                    type="number"
                    value={newInvoice.invoiced_quantity}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      const sub = qty * newInvoice.unit_price;
                      const tax = Math.round(sub * 0.18);
                      setNewInvoice({ ...newInvoice, invoiced_quantity: qty, subtotal: sub, tax_amount: tax, total_amount: sub + tax + newInvoice.freight_charges });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit Rate (₹)</label>
                  <input
                    type="number"
                    value={newInvoice.unit_price}
                    onChange={(e) => {
                      const rate = Number(e.target.value);
                      const sub = newInvoice.invoiced_quantity * rate;
                      const tax = Math.round(sub * 0.18);
                      setNewInvoice({ ...newInvoice, unit_price: rate, subtotal: sub, tax_amount: tax, total_amount: sub + tax + newInvoice.freight_charges });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tax Amount (18%)</label>
                  <input
                    type="number"
                    value={newInvoice.tax_amount}
                    onChange={(e) => {
                      const tax = Number(e.target.value);
                      setNewInvoice({ ...newInvoice, tax_amount: tax, total_amount: newInvoice.subtotal + tax + newInvoice.freight_charges });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-indigo-900 block mb-1">Total Amount (₹) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    value={newInvoice.total_amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, total_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-indigo-50 border border-indigo-300 rounded-lg font-mono font-bold text-indigo-900 text-xs"
                  />
                </div>
              </div>

              {/* Optional Email Notification (Phases 12 & 13) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center justify-between text-xs">
                  <span>Invoice Recipient Email (Optional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Leave blank if email is not required</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. ap-team@buyer.com or procurement.officer@supplysync.io"
                  value={invoiceRecipientEmail}
                  onChange={(e) => setInvoiceRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Invoice Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: DETAILED 8-FACTOR QC INSPECTION DOSSIER ── */}
      {openViewQcModal && selectedQc && (
        <Modal
          title={`Quality Check Inspection Dossier: QC #${selectedQc.quality_check_id.slice(0, 8)}`}
          subtitle={`Evaluated on 8-Factor QA Matrix for PO #${selectedQc.purchase_orders?.po_number || selectedQc.po_id?.slice(0, 8)}`}
          isOpen={openViewQcModal}
          onClose={() => setOpenViewQcModal(false)}
          maxWidth="2xl"
          footer={
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => setOpenViewQcModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Header Score Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-indigo-300 font-bold tracking-wider block">Customer Dock QA Rating</span>
                <h3 className="text-base font-black mt-0.5">{selectedQc.products?.product_name || 'Industrial Material'}</h3>
                <span className="text-[11px] text-slate-300">
                  Inspection Date: {selectedQc.inspection_date ? new Date(selectedQc.inspection_date).toLocaleDateString() : 'N/A'} • Status: {selectedQc.status}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-amber-300">{Number(selectedQc.overall_score || 0)} / 100</div>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {Number(selectedQc.overall_score || 0) >= 80 ? 'PASSED DOCK QA' : 'DEFECTS FLAGGED'}
                </span>
              </div>
            </div>

            {/* Quantities Breakdown */}
            <div>
              <span className="text-[11px] font-bold text-slate-900 uppercase block mb-2">Physical Intake Reconciliation</span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Expected</span>
                  <strong className="text-slate-800 font-mono">{Number(selectedQc.expected_quantity || 0).toLocaleString()}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-[10px] text-blue-600 uppercase font-bold block">Received</span>
                  <strong className="text-blue-800 font-mono">{Number(selectedQc.received_quantity || 0).toLocaleString()}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 uppercase font-bold block">Accepted</span>
                  <strong className="text-emerald-800 font-mono">{Number(selectedQc.accepted_quantity || 0).toLocaleString()}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-600 uppercase font-bold block">Damaged</span>
                  <strong className="text-rose-800 font-mono">{Number(selectedQc.damaged_quantity || 0).toLocaleString()}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-[10px] text-red-600 uppercase font-bold block">Rejected</span>
                  <strong className="text-red-800 font-mono">{Number(selectedQc.rejected_quantity || 0).toLocaleString()}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-[10px] text-amber-600 uppercase font-bold block">Missing</span>
                  <strong className="text-amber-800 font-mono">{Number(selectedQc.missing_quantity || 0).toLocaleString()}</strong>
                </div>
              </div>
            </div>

            {/* 8-Factor Detailed Matrix */}
            <div>
              <span className="text-[11px] font-bold text-slate-900 uppercase block mb-2">8-Factor Assessment Breakdown</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { name: '1. Product Quality & Specifications', weight: '20%', score: selectedQc.factor_product_quality || 9 },
                  { name: '2. Quantity Accuracy & Tolerances', weight: '15%', score: selectedQc.factor_quantity_accuracy || 10 },
                  { name: '3. Packaging Integrity & Palletization', weight: '10%', score: selectedQc.factor_packaging || 9 },
                  { name: '4. Transit Damage & Wear Condition', weight: '15%', score: selectedQc.factor_damage_condition || 9 },
                  { name: '5. Documentation & Traceability Bills', weight: '10%', score: selectedQc.factor_documentation || 10 },
                  { name: '6. Delivery Schedule & Cold-Chain', weight: '10%', score: selectedQc.factor_delivery_condition || 9 },
                  { name: '7. Regulatory & Safety Compliance', weight: '10%', score: selectedQc.factor_compliance || 10 },
                  { name: '8. Overall Lot Consistency', weight: '10%', score: selectedQc.factor_overall || 9 },
                ].map((factor, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800">{factor.name}</span>
                      <span className="font-bold text-indigo-700 font-mono">{factor.score} / 10</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${(Number(factor.score) / 10) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Weight: {factor.weight}</span>
                      <span>Contribution: {Math.round((Number(factor.score) / 10) * parseInt(factor.weight))}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inspector Remarks */}
            {selectedQc.remarks && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1">
                <strong className="text-amber-900 block font-bold">Inspector Assessment & Quality Notes:</strong>
                <p className="text-slate-800 leading-relaxed">{selectedQc.remarks}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── MODAL 6: GOOGLE MAP LOCATION CONFIRMATION (Sections 24-25 of updates9.md) ── */}
      <LocationPickerModal
        isOpen={openLocationPicker}
        onClose={() => setOpenLocationPicker(false)}
        title="Confirm Supplier Dispatch Origin Hub on Google Maps"
        onConfirm={handleSaveSupplierLocation}
      />
    </div>
  );
};

export default SupplierPortal;
