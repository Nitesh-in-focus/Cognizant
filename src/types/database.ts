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
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  reason: string;
  request_date?: string;
  required_date?: string;
  approved_at?: string;
  created_at?: string;
  warehouses?: Warehouse;
  pr_items?: PRItem[];
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
  status: 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'IN_TRANSIT' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
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
  po_items?: POItem[];
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
  destination_warehouse_id: string;
  origin?: string;
  dispatch_date?: string;
  expected_arrival?: string;
  actual_arrival?: string;
  status: 'SCHEDULED' | 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED';
  total_quantity: number;
  created_at?: string;
  purchase_orders?: PurchaseOrder;
  warehouses?: Warehouse;
}

export interface Truck {
  truck_id: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone?: string;
  carrier_name?: string;
  truck_type?: string;
  capacity?: number;
  status: 'IDLE' | 'IN_TRANSIT' | 'IN_YARD' | 'AT_DOCK' | 'COMPLETED';
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
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  capacity?: number;
  current_truck?: string;
  yards?: Yard;
}

export interface YardEntry {
  yard_entry_id: string;
  truck_id: string;
  shipment_id?: string;
  yard_id: string;
  entry_time: string;
  exit_time?: string;
  status: 'CHECKED_IN' | 'WAITING' | 'AT_DOCK' | 'DEPARTED';
  waiting_minutes?: number;
  gate_verified?: boolean;
  trucks?: Truck;
  shipments?: Shipment;
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
  supplier_id: string;
  invoice_date: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  document_url?: string;
  ocr_status: 'NOT_STARTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  match_status: 'PENDING' | 'MATCHED' | 'MISMATCH' | 'MANUAL_OVERRIDE';
  payment_status: 'UNPAID' | 'PROCESSING' | 'PAID' | 'ON_HOLD';
  created_at?: string;
  suppliers?: Supplier;
  purchase_orders?: PurchaseOrder;
  invoice_items?: InvoiceItem[];
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
  exception_type: 'PRICE_MISMATCH' | 'QUANTITY_MISMATCH' | 'DAMAGED_GOODS' | 'UNAUTHORIZED_INVOICE' | 'DUPLICATE_BILLING';
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
