import { supabase } from '../lib/supabase';
import { triggerFinanceExceptionNotification } from './emailService';

export interface ThreeWayMatchResult {
  invoice: any;
  po: any | null;
  grn: any | null;
  shipment: any | null;
  qc: any | null;
  existingException: any | null;
  
  // Mathematical Comparison Metrics
  poNumber: string;
  poQty: number;
  poUnitPrice: number;
  poContractTotal: number;
  
  grnNumber: string;
  grnReceivedQty: number;
  grnAcceptedQty: number;
  grnDamagedQty: number;
  grnStatus: string;
  
  invNumber: string;
  invQty: number;
  invUnitPrice: number;
  invTotal: number;
  
  expectedPayable: number;
  priceVariance: number;
  qtyVariance: number;
  totalDiff: number;
  
  // Verification Booleans
  hasPo: boolean;
  hasGrn: boolean;
  isGrnAccepted: boolean;
  isPriceMatched: boolean;
  isQtyMatched: boolean;
  isTotalMatched: boolean;
  isFullyMatched: boolean;
  
  // Discrepancy Classification
  discrepancyType: 'MISSING_PO' | 'MISSING_GRN' | 'DAMAGED_GOODS' | 'PRICE_MISMATCH' | 'QUANTITY_MISMATCH' | 'TOTAL_VARIANCE' | null;
  mismatchDetails: string;
}

/**
 * Helper to check valid UUID
 */
const isValidUuid = (val?: string): boolean => {
  return Boolean(val && val.length === 36 && val.includes('-'));
};

/**
 * 1. Autofetch linked PO, GRN, Quality Checks, and Invoice line data
 */
export async function fetchThreeWayMatchData(invoiceIdOrObject: string | any): Promise<{
  invoice: any;
  po: any | null;
  grn: any | null;
  shipment: any | null;
  qc: any | null;
  existingException: any | null;
}> {
  let inv = typeof invoiceIdOrObject === 'object' ? invoiceIdOrObject : null;

  if (!inv || !inv.invoice_id) {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        purchase_orders(
          po_id,
          po_number,
          total_amount,
          order_date,
          status,
          warehouses(warehouse_name),
          po_items(*, products(*))
        ),
        suppliers(supplier_id, supplier_name, supplier_code, city, email),
        shipments(shipment_id, shipment_number, total_quantity, status, po_id)
      `)
      .eq('invoice_id', typeof invoiceIdOrObject === 'string' ? invoiceIdOrObject : invoiceIdOrObject.invoice_id)
      .single();

    if (error) throw error;
    inv = data;
  }

  // Resolve PO ID (directly from invoice or through linked shipment)
  const targetPoId = inv.po_id || inv.purchase_orders?.po_id || inv.shipments?.po_id || null;
  const targetShipmentId = inv.shipment_id || inv.shipments?.shipment_id || null;

  // 1. Fetch linked PO with complete items and product rates
  const poPromise = targetPoId
    ? supabase
        .from('purchase_orders')
        .select('*, suppliers(*), warehouses(*), po_items(*, products(*))')
        .eq('po_id', targetPoId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  // 2. Fetch linked GRN (check po_id first, then shipment_id)
  const fetchGrn = async () => {
    if (targetPoId) {
      const { data } = await supabase
        .from('goods_receipts')
        .select('*, grn_items(*, products(*)), shipments(*)')
        .eq('po_id', targetPoId)
        .order('received_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }
    if (targetShipmentId) {
      const { data } = await supabase
        .from('goods_receipts')
        .select('*, grn_items(*, products(*)), shipments(*)')
        .eq('shipment_id', targetShipmentId)
        .order('received_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }
    return null;
  };

  // 3. Fetch linked Shipment
  const shpPromise = targetShipmentId
    ? supabase.from('shipments').select('*').eq('shipment_id', targetShipmentId).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  // 4. Fetch linked Quality Check
  const qcPromise = targetPoId
    ? supabase
        .from('quality_checks')
        .select('*')
        .eq('po_id', targetPoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  // 5. Fetch any existing open exception for this invoice
  const excPromise = inv.invoice_id
    ? supabase
        .from('exceptions')
        .select('*')
        .eq('invoice_id', inv.invoice_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [poRes, grnData, shpRes, qcRes, excRes] = await Promise.all([
    poPromise,
    fetchGrn(),
    shpPromise,
    qcPromise,
    excPromise,
  ]);

  return {
    invoice: inv,
    po: poRes.data || inv.purchase_orders || null,
    grn: grnData || null,
    shipment: shpRes.data || inv.shipments || null,
    qc: qcRes.data || null,
    existingException: excRes.data || null,
  };
}

/**
 * 2. Algorithmic 3-Way Match Evaluation
 */
export function evaluateThreeWayMatch(data: {
  invoice: any;
  po: any | null;
  grn: any | null;
  shipment: any | null;
  qc?: any | null;
  existingException?: any | null;
}): ThreeWayMatchResult {
  const { invoice, po, grn, shipment, qc, existingException } = data;

  const firstPoItem = po?.po_items?.[0];

  // 1. PO Baseline
  const hasPo = Boolean(po && po.po_id);
  const poQty = Number(firstPoItem?.ordered_quantity || po?.total_quantity || 100);
  const poUnitPrice = Number(
    firstPoItem?.unit_price || (po ? Math.round(Number(po.total_amount) / 1.18 / (poQty || 1)) : 250)
  );
  const poContractTotal = Number(po?.total_amount || 0);

  // 2. GRN Intake & Quantities Extraction
  const hasGrn = Boolean(grn && grn.grn_id);

  let rawGrnRecv = 0;
  let rawGrnAcc = 0;
  let rawGrnDmg = 0;

  // Extract from grn_items array if present
  if (grn?.grn_items && Array.isArray(grn.grn_items) && grn.grn_items.length > 0) {
    rawGrnRecv = grn.grn_items.reduce((sum: number, item: any) => sum + Number(item.received_quantity || 0), 0);
    rawGrnAcc = grn.grn_items.reduce(
      (sum: number, item: any) => sum + Number(item.accepted_quantity ?? item.received_quantity ?? 0),
      0
    );
    rawGrnDmg = grn.grn_items.reduce((sum: number, item: any) => sum + Number(item.damaged_quantity || 0), 0);
  }

  // Fallbacks to goods_receipts parent columns or PO quantity if grn_items was empty
  if (rawGrnRecv === 0 && hasGrn) {
    if (Number(grn.received_quantity) > 0) {
      rawGrnRecv = Number(grn.received_quantity);
    } else if (Number(grn.expected_quantity) > 0) {
      rawGrnRecv = Number(grn.expected_quantity);
    } else if (Number(grn.total_quantity) > 0) {
      rawGrnRecv = Number(grn.total_quantity);
    } else if (
      Number(invoice?.invoiced_quantity) > 0 &&
      Number(invoice?.invoiced_quantity) <= poQty &&
      grn.status !== 'REJECTED'
    ) {
      rawGrnRecv = Number(invoice.invoiced_quantity);
    } else {
      rawGrnRecv = poQty;
    }
  }

  if (rawGrnDmg === 0 && hasGrn) {
    if (Number(grn.damaged_quantity) > 0) {
      rawGrnDmg = Number(grn.damaged_quantity);
    } else if (grn.notes && /damage/i.test(grn.notes)) {
      const dmgMatch = grn.notes.match(/(\d+)\s*(?:units?|items?|qty|pcs?)?\s*damage/i);
      rawGrnDmg = dmgMatch ? Number(dmgMatch[1]) : 0;
    } else if (qc && Number(qc.damaged_quantity) > 0) {
      rawGrnDmg = Number(qc.damaged_quantity);
    }
  }

  if (rawGrnAcc === 0 && hasGrn) {
    if (Number(grn.accepted_quantity) > 0) {
      rawGrnAcc = Number(grn.accepted_quantity);
    } else {
      rawGrnAcc = Math.max(0, rawGrnRecv - rawGrnDmg);
    }
  }

  const grnReceivedQty = hasGrn ? rawGrnRecv : 0;
  const grnDamagedQty = hasGrn ? rawGrnDmg : 0;
  const grnAcceptedQty = hasGrn ? rawGrnAcc : 0;
  const grnStatus = grn?.status || (hasGrn ? 'INSPECTED' : 'PENDING_INTAKE');
  const isGrnAccepted = hasGrn && grnAcceptedQty > 0 && grnStatus !== 'REJECTED';

  // 3. Invoice Billed
  const invTotal = Number(invoice?.total_amount || 0);
  const invQty = Number(invoice?.invoiced_quantity || firstPoItem?.ordered_quantity || poQty);
  const invUnitPrice = Number(
    invoice?.unit_price || (invQty > 0 ? Math.round(invTotal / 1.18 / invQty) : poUnitPrice)
  );

  // 4. Expected Payable Calculation:
  // For a billed invoice of invQty units, expected payable is invQty * unit rate * 1.18 GST,
  // capped at dock accepted units if accepted units is less than invoiced units.
  const payableQty = hasGrn ? Math.min(invQty, grnAcceptedQty) : invQty;
  const expectedPayable = Math.round(payableQty * poUnitPrice * 1.18);

  const priceVariance = Math.round((invUnitPrice - poUnitPrice) * 100) / 100;
  const qtyVariance = hasGrn ? invQty - grnAcceptedQty : invQty - poQty;
  const totalDiff = invTotal - expectedPayable;

  // Verification Rules
  const isPriceMatched = Math.abs(priceVariance) <= 0.5;
  const isQtyMatched = hasGrn ? qtyVariance <= 0 : false;
  const isTotalMatched = Math.abs(totalDiff) <= 5.0 || invTotal <= expectedPayable;

  const isResolvedException =
    existingException?.status === 'RESOLVED' ||
    invoice?.match_status === 'MANUAL_OVERRIDE' ||
    invoice?.payment_status === 'APPROVED_FOR_PAYMENT';

  const isAlgorithmicMatch = hasPo && hasGrn && isGrnAccepted && isPriceMatched && isQtyMatched && isTotalMatched;
  const isFullyMatched = isResolvedException || isAlgorithmicMatch;

  // Determine Discrepancy details
  let discrepancyType: ThreeWayMatchResult['discrepancyType'] = null;
  let mismatchDetails = '';

  if (isResolvedException) {
    discrepancyType = null;
    mismatchDetails = existingException?.description
      ? `Discrepancy officially settled & hold lifted: ${existingException.description}. Ready for Finance banking payout.`
      : `Discrepancy officially settled by Procurement / Finance. Ready for banking settlement.`;
  } else if (!hasPo) {
    discrepancyType = 'MISSING_PO';
    mismatchDetails = `No authorized Purchase Order found linking to Invoice #${invoice.invoice_number}.`;
  } else if (!hasGrn) {
    discrepancyType = 'MISSING_GRN';
    mismatchDetails = `Goods Receipt Note (GRN) not yet recorded. Physical dock intake and QC inspection required before payment release.`;
  } else if (!isGrnAccepted) {
    discrepancyType = 'DAMAGED_GOODS';
    mismatchDetails = `Dock intake rejected or 100% damaged units recorded (${grnDamagedQty} damaged units). Payment on hold.`;
  } else if (!isPriceMatched) {
    discrepancyType = 'PRICE_MISMATCH';
    mismatchDetails = `Unit rate mismatch: Supplier billed ₹${invUnitPrice}/unit vs authorized PO rate of ₹${poUnitPrice}/unit (Variance: +₹${priceVariance}/unit).`;
  } else if (!isQtyMatched) {
    discrepancyType = 'QUANTITY_MISMATCH';
    mismatchDetails = `Quantity over-billed: Supplier billed ${invQty} units, but dock accepted only ${grnAcceptedQty} units (${grnDamagedQty} damaged/missing at intake).`;
  } else if (!isTotalMatched) {
    discrepancyType = 'TOTAL_VARIANCE';
    mismatchDetails = `Total billing discrepancy: Invoiced amount of ₹${invTotal.toLocaleString()} exceeds authorized payable of ₹${expectedPayable.toLocaleString()} (Difference: +₹${totalDiff.toLocaleString()}).`;
  }

  return {
    invoice,
    po,
    grn,
    shipment,
    qc: qc || null,
    existingException: existingException || null,
    poNumber: po?.po_number || 'PO-PENDING',
    poQty,
    poUnitPrice,
    poContractTotal,
    grnNumber: grn?.grn_number || (hasGrn ? 'GRN-RECORDED' : 'GRN-PENDING (Dock Intake Awaited)'),
    grnReceivedQty,
    grnAcceptedQty,
    grnDamagedQty,
    grnStatus,
    invNumber: invoice?.invoice_number || 'INV-2026-X',
    invQty,
    invUnitPrice,
    invTotal,
    expectedPayable,
    priceVariance,
    qtyVariance,
    totalDiff,
    hasPo,
    hasGrn,
    isGrnAccepted,
    isPriceMatched,
    isQtyMatched,
    isTotalMatched,
    isFullyMatched,
    discrepancyType,
    mismatchDetails,
  };
}

/**
 * 3. Execute 3-Way Match & Sync Database State
 * Automatically creates exception if unmatched, or approves invoice if matched.
 */
export async function executeThreeWayMatchAndSync(
  invoiceIdOrObject: string | any,
  options?: {
    userName?: string;
    userRole?: string;
  }
): Promise<ThreeWayMatchResult> {
  const data = await fetchThreeWayMatchData(invoiceIdOrObject);
  const evaluation = evaluateThreeWayMatch(data);
  const inv = evaluation.invoice;

  const validPoId = isValidUuid(evaluation.po?.po_id) ? evaluation.po.po_id : (isValidUuid(inv.po_id) ? inv.po_id : null);
  const validInvoiceId = isValidUuid(inv.invoice_id) ? inv.invoice_id : null;
  const validGrnId = isValidUuid(evaluation.grn?.grn_id) ? evaluation.grn.grn_id : null;
  const validShipmentId = isValidUuid(evaluation.shipment?.shipment_id)
    ? evaluation.shipment.shipment_id
    : (isValidUuid(inv.shipment_id) ? inv.shipment_id : null);

  if (evaluation.isFullyMatched) {
    // 1. Clean Match -> Set to MATCHED and APPROVED_FOR_PAYMENT
    const updatePayload: any = {
      match_status: 'MATCHED',
      updated_at: new Date().toISOString(),
    };
    if (inv.payment_status !== 'PAID') {
      updatePayload.payment_status = 'APPROVED_FOR_PAYMENT';
    }

    await supabase
      .from('invoices')
      .update(updatePayload)
      .eq('invoice_id', inv.invoice_id);

    // 2. Resolve any existing open exception for this invoice
    if (evaluation.existingException && evaluation.existingException.status === 'OPEN') {
      await supabase
        .from('exceptions')
        .update({
          status: 'RESOLVED',
          resolved_at: new Date().toISOString(),
          description: `${evaluation.existingException.description} [3-Way Match Auto-Resolved: 100% Aligned]`,
        })
        .eq('exception_id', evaluation.existingException.exception_id);
    }
  } else {
    // 1. Unmatched / Discrepancy -> Set to MISMATCH and ON_HOLD
    if (inv.payment_status !== 'PAID') {
      await supabase
        .from('invoices')
        .update({
          match_status: 'MISMATCH',
          payment_status: 'ON_HOLD',
          notes: inv.notes
            ? `${inv.notes} | [3-Way Match Discrepancy]: ${evaluation.mismatchDetails}`
            : `[3-Way Match Discrepancy]: ${evaluation.mismatchDetails}`,
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_id', inv.invoice_id);
    }

    // 2. Auto-generate Exception ticket if not already open
    if (!evaluation.existingException || evaluation.existingException.status !== 'OPEN') {
      const excNumber = `EXC-3WAY-${Math.floor(1000 + Math.random() * 9000)}`;
      const excType = evaluation.discrepancyType === 'PRICE_MISMATCH' || evaluation.discrepancyType === 'TOTAL_VARIANCE'
        ? 'PRICE_MISMATCH'
        : evaluation.discrepancyType === 'QUANTITY_MISMATCH' || evaluation.discrepancyType === 'MISSING_GRN'
        ? 'QUANTITY_MISMATCH'
        : evaluation.discrepancyType === 'DAMAGED_GOODS'
        ? 'DAMAGED_GOODS'
        : 'PRICE_MISMATCH';

      const { data: createdExc } = await supabase
        .from('exceptions')
        .insert([
          {
            exception_number: excNumber,
            po_id: validPoId,
            invoice_id: validInvoiceId,
            grn_id: validGrnId,
            shipment_id: validShipmentId,
            exception_type: excType,
            expected_value: evaluation.expectedPayable || evaluation.poContractTotal,
            actual_value: evaluation.invTotal,
            difference: Math.abs(evaluation.totalDiff || evaluation.priceVariance || 0),
            severity: 'HIGH',
            status: 'OPEN',
            description: `Automated 3-Way Match Discrepancy on Invoice #${inv.invoice_number}: ${evaluation.mismatchDetails}`,
          },
        ])
        .select()
        .single();

      if (createdExc) {
        evaluation.existingException = createdExc;
      }

      // 3. Dispatch PR Officer Email Notification
      await triggerFinanceExceptionNotification({
        exceptionId: excNumber,
        invoiceId: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        poId: validPoId || undefined,
        poNumber: evaluation.poNumber,
        shipmentId: validShipmentId || undefined,
        shipmentNumber: evaluation.shipment?.shipment_number,
        supplierName: inv.suppliers?.supplier_name || 'Vendor Partner',
        mismatchType: excType,
        mismatchDetails: evaluation.mismatchDetails,
        amount: Math.abs(evaluation.totalDiff || 0),
      });
    }
  }

  return evaluation;
}

/**
 * 4. Execute Banking Payout Settlement (NEFT / RTGS / ACH / WIRE)
 */
export async function executeInvoicePayout(params: {
  invoice: any;
  paymentMethod?: string;
  notes?: string;
  userName?: string;
}): Promise<{ payment: any; transactionReference: string }> {
  const { invoice, paymentMethod = 'NEFT', notes, userName } = params;
  const txRef = `${paymentMethod}-${Date.now().toString().slice(-8)}`;

  // 1. Insert Payment Record
  const { data: payData, error: payErr } = await supabase
    .from('payments')
    .insert([
      {
        invoice_id: invoice.invoice_id,
        supplier_id: invoice.supplier_id,
        payment_amount: invoice.total_amount,
        payment_date: new Date().toISOString(),
        payment_method: paymentMethod,
        status: 'COMPLETED',
        transaction_reference: txRef,
      },
    ])
    .select()
    .single();

  if (payErr) throw payErr;

  // 2. Update Invoice to PAID
  const { error: invErr } = await supabase
    .from('invoices')
    .update({
      payment_status: 'PAID',
      notes: notes
        ? `${invoice.notes || ''} | [Settlement Txn ${txRef} via ${paymentMethod}]: ${notes}`
        : `${invoice.notes || ''} | [Settlement Txn ${txRef} via ${paymentMethod}]`,
      updated_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoice.invoice_id);

  if (invErr) throw invErr;

  return {
    payment: payData,
    transactionReference: txRef,
  };
}
