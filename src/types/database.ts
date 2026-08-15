export interface Supplier {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  contact_person: string;
  email: string;
  phone?: string;
  address?: string;
  city: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  created_at?: string;
}

export interface Product {
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  unit_of_measure: string;
  unit_price: number;
  description?: string;
  status?: string;
}

export interface Warehouse {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  city: string;
  address?: string;
  total_docks: number;
  latitude?: number;
  longitude?: number;
  status?: string;
}

export interface PurchaseRequisition {
  pr_id: string;
  pr_number: string;
  warehouse_id: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority_reason?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  reason: string;
  natural_language_prompt?: string;
  created_by_worker?: string;
  rejection_reason?: string;
  rejected_by?: string;
  rejected_at?: string;
  request_date?: string;
  required_date?: string;
  approved_at?: string;
  created_at?: string;
  warehouses?: Warehouse;
  pr_items?: PRItem[];
  purchase_orders?: PurchaseOrder | PurchaseOrder[];
}

export interface PRItem {
  pr_item_id?: string;
  pr_id?: string;
  product_id: string;
  requested_quantity: number;
  products?: Product;
}

export interface PurchaseOrder {
  po_id: string;
  po_number: string;
  pr_id?: string;
  supplier_id: string;
  warehouse_id: string;
  status:
    | 'DRAFT'
    | 'DRAFT_AI_GENERATED'
    | 'DRAFT_AUTO_GENERATED'
    | 'READY_TO_SEND'
    | 'APPROVED'
    | 'REJECTED'
    | 'SENT_TO_SUPPLIER'
    | 'ACCEPTED_BY_SUPPLIER'
    | 'CONFIRMED'
    | 'SUPPLIER_REJECTED'
    | 'CLARIFICATION_REQUESTED'
    | 'CHANGE_REQUESTED'
    | 'DISPATCHED'
    | 'IN_TRANSIT'
    | 'RECEIVED'
    | 'CLOSED'
    | 'CANCELLED';
  rejection_reason?: string;
  rejected_by?: string;
  rejected_at?: string;
  supplier_response_reason?: string;
  supplier_response_at?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  currency?: string;
  order_date?: string;
  expected_delivery_date?: string;
  payment_terms?: string;
  created_at?: string;
  suppliers?: Supplier;
  warehouses?: Warehouse;
  purchase_requisitions?: PurchaseRequisition;
  po_items?: POItem[];
  shipments?: Shipment[];
}

export interface POItem {
  po_item_id?: string;
  po_id?: string;
  product_id: string;
  ordered_quantity: number;
  unit_price: number;
  tax_rate?: number;
  line_total: number;
  products?: Product;
}

export interface Shipment {
  shipment_id: string;
  shipment_number: string;
  po_id: string;
  supplier_id?: string;
  destination_warehouse_id?: string;
  origin?: string;
  destination?: string;
  dispatch_date?: string;
  expected_arrival?: string;
  actual_arrival?: string;
  departure_time?: string;
  asn_number?: string;
  location_source?: 'GPS_TELEMATICS' | 'DECLARED_BY_SUPPLIER' | 'SIMULATED';
  driver_id?: string;
  driver_code?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  driver_rejection_reason?: string;
  truck_id?: string;
  vehicle_number?: string;
  carrier_name?: string;
  distance_travelled_km?: number;
  distance_remaining_km?: number;
  parking_slot?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status:
    | 'CREATED'
    | 'READY_FOR_DRIVER'
    | 'DRIVER_REQUESTED'
    | 'DRIVER_ACCEPTED'
    | 'DRIVER_REJECTED'
    | 'READY_FOR_DISPATCH'
    | 'DISPATCHED'
    | 'IN_TRANSIT'
    | 'ARRIVED_AT_FACILITY'
    | 'AT_GATE'
    | 'IN_YARD'
    | 'AT_DOCK'
    | 'UNLOADING'
    | 'UNLOADED'
    | 'RECEIVED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'PLANNED'
    | 'SCHEDULED'
    | 'ARRIVED'
    | 'DELIVERED';
  total_quantity: number;
  created_at?: string;
  purchase_orders?: PurchaseOrder;
  warehouses?: Warehouse;
  truck_locations?: TruckLocation[];
}

export interface DriverAssignmentRequest {
  request_id: string;
  shipment_id: string;
  driver_id: string;
  driver_code?: string;
  driver_name?: string;
  driver_phone?: string;
  truck_id?: string;
  vehicle_number?: string;
  supplier_id: string;
  sent_at: string;
  expires_at: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  response_at?: string;
  rejection_reason?: string;
  shipment?: Shipment;
  supplier?: Supplier;
}

export interface DriverHistorySummary {
  accepted_count: number;
  rejected_count: number;
  expired_count: number;
  cancelled_count: number;
  completed_count: number;
}

export interface Truck {
  truck_id: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone?: string;
  driver_code?: string;
  carrier_name?: string;
  truck_type?: string;
  capacity?: number;
  driver_status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  last_location_update?: string;
  status: 'IDLE' | 'IN_TRANSIT' | 'IN_YARD' | 'AT_DOCK' | 'COMPLETED';
}

export interface AuthOtpCode {
  otp_id: string;
  email: string;
  otp_code_hash: string;
  expires_at: string;
  attempts: number;
  is_used: boolean;
  created_at?: string;
}

export interface EmailLog {
  log_id: string;
  recipient_email: string;
  recipient_role?: string;
  subject: string;
  template_name: string;
  severity: string;
  status: 'SENT' | 'FAILED' | 'RETRIED';
  error_message?: string;
  sent_at?: string;
}

export interface TruckLocation {
  location_id?: string;
  truck_id: string;
  shipment_id?: string;
  latitude?: number;
  longitude?: number;
  location_name: string;
  timestamp: string;
  speed?: number;
  status?: string;
}

export interface Yard {
  yard_id: string;
  warehouse_id: string;
  yard_name: string;
  capacity: number;
  status: string;
  warehouses?: Warehouse;
}

export interface Dock {
  dock_id: string;
  yard_id: string;
  dock_number: string;
  dock_type: 'INBOUND' | 'OUTBOUND' | 'HYBRID';
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'UNLOADING' | 'MAINTENANCE' | 'BLOCKED';
  capacity?: number;
  current_truck?: string;
  current_shipment?: string;
  driver_name?: string;
  driver_phone?: string;
  supplier_name?: string;
  po_number?: string;
  eta?: string;
  arrival_time?: string;
  unloading_start?: string;
  unloading_end?: string;
  remarks?: string;
  yards?: Yard;
}

export interface YardEntry {
  yard_entry_id: string;
  truck_id: string;
  shipment_id?: string;
  po_id?: string;
  yard_id: string;
  entry_time: string;
  exit_time?: string;
  status: 'CHECKED_IN' | 'WAITING' | 'AT_DOCK' | 'DEPARTED';
  waiting_minutes?: number;
  gate_verified?: boolean;
  trucks?: Truck;
  shipments?: Shipment;
  purchase_orders?: PurchaseOrder;
  yards?: Yard;
  dock_assignments?: DockAssignment[];
}

export interface DockAssignment {
  assignment_id: string;
  yard_entry_id: string;
  dock_id: string;
  assigned_at: string;
  dock_start_time?: string;
  dock_end_time?: string;
  status: 'ASSIGNED' | 'UNLOADING' | 'COMPLETED';
  docks?: Dock;
}

export interface GoodsReceipt {
  grn_id: string;
  grn_number: string;
  po_id: string;
  shipment_id?: string;
  yard_entry_id?: string;
  received_date: string;
  status: 'DRAFT' | 'PENDING_INSPECTION' | 'INSPECTED' | 'COMPLETED' | 'REJECTED';
  notes?: string;
  purchase_orders?: PurchaseOrder;
  shipments?: Shipment;
  grn_items?: GRNItem[];
}

export interface GRNItem {
  grn_item_id?: string;
  grn_id?: string;
  po_item_id?: string;
  product_id: string;
  ordered_quantity: number;
  received_quantity: number;
  damaged_quantity: number;
  accepted_quantity: number;
  inspection_status: 'ACCEPTED' | 'PARTIAL' | 'DAMAGED_REJECTED';
  products?: Product;
}

export interface Invoice {
  invoice_id: string;
  invoice_number: string;
  po_id?: string;
  shipment_id?: string;
  supplier_id: string;
  invoice_date: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  currency?: string;
  document_url?: string;
  ocr_status: 'NOT_STARTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  match_status: 'PENDING' | 'MATCHED' | 'MISMATCH' | 'MANUAL_OVERRIDE';
  payment_status: 'UNPAID' | 'PROCESSING' | 'PAID' | 'ON_HOLD';
  created_at?: string;
  suppliers?: Supplier;
  purchase_orders?: PurchaseOrder;
  shipments?: Shipment;
  invoice_items?: InvoiceItem[];
  payments?: Payment[];
}

export interface InvoiceItem {
  invoice_item_id?: string;
  invoice_id?: string;
  po_item_id?: string;
  product_id: string;
  invoiced_quantity: number;
  unit_price: number;
  tax_rate?: number;
  line_total: number;
  products?: Product;
}

export interface ExceptionRecord {
  exception_id: string;
  exception_number: string;
  po_id?: string;
  invoice_id?: string;
  grn_id?: string;
  shipment_id?: string;
  exception_type: 'PRICE_MISMATCH' | 'QUANTITY_MISMATCH' | 'DAMAGED_GOODS' | 'UNAUTHORIZED_INVOICE' | 'DUPLICATE_BILLING' | 'TRANSIT_DELAY';
  expected_value?: number;
  actual_value?: number;
  difference?: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'WAIVED';
  description: string;
  created_at?: string;
  resolved_at?: string;
  purchase_orders?: PurchaseOrder;
  invoices?: Invoice;
  goods_receipts?: GoodsReceipt;
  shipments?: Shipment;
}

export interface Payment {
  payment_id: string;
  invoice_id: string;
  supplier_id: string;
  payment_amount: number;
  payment_date: string;
  payment_method: 'NEFT' | 'RTGS' | 'ACH' | 'WIRE' | 'CREDIT_CARD';
  status: 'PENDING' | 'INITIATED' | 'COMPLETED' | 'FAILED';
  transaction_reference: string;
  created_at?: string;
  suppliers?: Supplier;
  invoices?: Invoice;
}

export interface QualityCheck {
  quality_check_id: string;
  supplier_id: string;
  po_id: string;
  shipment_id?: string;
  grn_id?: string;
  warehouse_id?: string;
  product_id?: string;
  inspector_id?: string;
  inspection_date: string;
  expected_quantity: number;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  damaged_quantity: number;
  missing_quantity?: number;
  // 8-factor evaluation (1-10 scale)
  factor_product_quality?: number; // 1-10
  factor_quantity_accuracy?: number; // 1-10
  factor_packaging?: number; // 1-10
  factor_damage_condition?: number; // 1-10
  factor_documentation?: number; // 1-10
  factor_delivery_condition?: number; // 1-10
  factor_compliance?: number; // 1-10
  factor_overall?: number; // 1-10
  // Compatibility scores
  product_quality_score: number;
  quantity_accuracy_score: number;
  packaging_score: number;
  documentation_score: number;
  delivery_condition_score: number;
  overall_score: number; // 0-100
  defect_rate?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'PASSED_WITH_ISSUES' | 'FAILED' | 'FINALIZED';
  remarks?: string;
  evidence_path?: string;
  created_at?: string;
  finalized_at?: string;
  suppliers?: Supplier;
  purchase_orders?: PurchaseOrder;
  products?: Product;
  warehouses?: Warehouse;
  shipments?: Shipment;
}

export interface QualityCheckItem {
  qc_item_id: string;
  quality_check_id: string;
  product_id: string;
  inspected_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  defect_category?: string;
  notes?: string;
  products?: Product;
}

export interface SupplierPerformance {
  supplier_performance_id: string;
  supplier_id: string;
  quality_score: number; // 35%
  delivery_score: number; // 25%
  quantity_accuracy_score: number; // 15%
  invoice_accuracy_score: number; // 10%
  responsiveness_score: number; // 10%
  reliability_score: number; // 5%
  overall_score: number; // 100%
  damage_rate?: number;
  completed_orders?: number;
  failed_qc_count?: number;
  sample_size: number;
  calculated_at: string;
  suppliers?: Supplier;
}

export interface SupplierScoreHistory {
  history_id: string;
  supplier_id: string;
  previous_score: number;
  new_score: number;
  change: number;
  reason: string;
  source_quality_check_id?: string;
  po_id?: string;
  shipment_id?: string;
  grn_id?: string;
  calculated_at: string;
  suppliers?: Supplier;
}

export interface NlpExtractionLog {
  log_id: string;
  raw_prompt: string;
  extracted_product_name?: string;
  extracted_quantity?: number;
  extracted_required_date?: string;
  extracted_priority?: string;
  priority_reason?: string;
  confidence: number;
  worker_corrections?: any;
  final_values?: any;
  created_at: string;
}

export interface AiRecommendation {
  ai_recommendation_id: string;
  recommendation_type: 'SUPPLIER_SELECTION' | 'ETA' | 'DOCK_ASSIGNMENT' | 'SHIPMENT_PRIORITY' | 'QUALITY_ANALYSIS';
  entity_type: string;
  entity_id: string;
  model_name: string;
  recommendation: any;
  confidence: number;
  reasoning_summary: string;
  input_snapshot?: any;
  human_decision?: 'ACCEPTED' | 'OVERRIDDEN' | 'REJECTED' | 'PENDING';
  decided_by?: string;
  decided_at?: string;
  created_at?: string;
}

export interface AuditLog {
  audit_id: string;
  user_id?: string;
  user_name?: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_state?: any;
  new_state?: any;
  reason?: string;
  is_emergency_override?: boolean;
  metadata?: any;
  created_at?: string;
}

export interface StatusHistory {
  history_id: string;
  entity_type: string;
  entity_id: string;
  old_status?: string;
  new_status: string;
  changed_by?: string;
  reason?: string;
  timestamp: string;
  metadata?: any;
}
