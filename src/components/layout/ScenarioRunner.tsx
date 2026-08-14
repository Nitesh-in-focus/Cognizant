import React, { useState } from 'react';
import {
  Play,
  Zap,
  AlertTriangle,
  Radio,
  CheckCircle2,
  X,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';

interface ScenarioRunnerProps {
  open: boolean;
  onClose: () => void;
}

export const ScenarioRunner: React.FC<ScenarioRunnerProps> = ({ open, onClose }) => {
  const { showSnackbar, triggerRefresh, addAlert } = useApp();
  const [running, setRunning] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const stepsScenario1 = [
    'PR Creation',
    'PO & Dispatch',
    'Yard & Dock',
    'GRN Receiving',
    '3-Way Match & Pay',
  ];

  const runGoldenP2PFlow = async () => {
    try {
      setRunning('scenario1');
      setActiveStep(0);

      const { data: suppliers } = await supabase.from('suppliers').select('*').limit(1);
      const { data: products } = await supabase.from('products').select('*').limit(1);
      const { data: warehouses } = await supabase.from('warehouses').select('*').limit(1);
      const { data: yards } = await supabase.from('yards').select('*').limit(1);
      const { data: docks } = await supabase.from('docks').select('*').limit(1);

      if (!suppliers?.length || !products?.length || !warehouses?.length) {
        throw new Error('Base master data missing.');
      }

      const sup = suppliers[0];
      const prd = products[0];
      const wh = warehouses[0];
      const yard = yards?.[0];
      const dock = docks?.[0];

      const suffix = Math.floor(1000 + Math.random() * 9000);

      // Step 1: Create & Approve PR
      setActiveStep(0);
      const prNum = `PR-AUTO-${suffix}`;
      const { data: pr, error: prErr } = await supabase
        .from('purchase_requisitions')
        .insert([
          {
            pr_number: prNum,
            warehouse_id: wh.warehouse_id,
            priority: 'HIGH',
            status: 'APPROVED',
            reason: 'Automated Demo: Production line replenishment',
            approved_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();
      if (prErr) throw prErr;

      await supabase.from('pr_items').insert([
        {
          pr_id: pr.pr_id,
          product_id: prd.product_id,
          requested_quantity: 150,
        },
      ]);

      await new Promise((r) => setTimeout(r, 500));

      // Step 2: PO & Shipment
      setActiveStep(1);
      const poNum = `PO-AUTO-${suffix}`;
      const unitPrice = Number(prd.unit_price) || 50;
      const totalAmount = unitPrice * 150;

      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert([
          {
            po_number: poNum,
            pr_id: pr.pr_id,
            supplier_id: sup.supplier_id,
            warehouse_id: wh.warehouse_id,
            status: 'CONFIRMED',
            total_amount: totalAmount,
            subtotal: totalAmount,
          },
        ])
        .select()
        .single();
      if (poErr) throw poErr;

      const { data: poItem } = await supabase
        .from('po_items')
        .insert([
          {
            po_id: po.po_id,
            product_id: prd.product_id,
            ordered_quantity: 150,
            unit_price: unitPrice,
            line_total: totalAmount,
          },
        ])
        .select()
        .single();

      const shpNum = `SHP-AUTO-${suffix}`;
      const { data: shp } = await supabase
        .from('shipments')
        .insert([
          {
            shipment_number: shpNum,
            po_id: po.po_id,
            destination_warehouse_id: wh.warehouse_id,
            status: 'ARRIVED',
            total_quantity: 150,
          },
        ])
        .select()
        .single();

      await new Promise((r) => setTimeout(r, 500));

      // Step 3: Yard & Dock Check-in
      setActiveStep(2);
      const { data: truck } = await supabase
        .from('trucks')
        .insert([
          {
            vehicle_number: `MH-14-TR-${suffix}`,
            driver_name: 'Suresh Patil',
            driver_phone: '+91 9876543210',
            status: 'AT_DOCK',
            capacity: 2000,
          },
        ])
        .select()
        .single();

      let yardEntryId: string | undefined;
      if (yard && truck && shp) {
        const { data: yEntry } = await supabase
          .from('yard_entries')
          .insert([
            {
              truck_id: truck.truck_id,
              shipment_id: shp.shipment_id,
              yard_id: yard.yard_id,
              entry_time: new Date().toISOString(),
              status: 'AT_DOCK',
              gate_verified: true,
              waiting_minutes: 5,
            },
          ])
          .select()
          .single();
        yardEntryId = yEntry?.yard_entry_id;

        if (dock && yEntry) {
          await supabase.from('dock_assignments').insert([
            {
              yard_entry_id: yEntry.yard_entry_id,
              dock_id: dock.dock_id,
              assigned_at: new Date().toISOString(),
              dock_start_time: new Date().toISOString(),
              status: 'UNLOADING',
            },
          ]);
        }
      }

      await new Promise((r) => setTimeout(r, 500));

      // Step 4: GRN Receiving
      setActiveStep(3);
      const grnNum = `GRN-AUTO-${suffix}`;
      const { data: grn } = await supabase
        .from('goods_receipts')
        .insert([
          {
            grn_number: grnNum,
            po_id: po.po_id,
            shipment_id: shp?.shipment_id,
            yard_entry_id: yardEntryId,
            received_date: new Date().toISOString(),
            status: 'COMPLETED',
            notes: 'Automated 100% Quality Inspection: PASSED',
          },
        ])
        .select()
        .single();

      if (grn && poItem) {
        await supabase.from('grn_items').insert([
          {
            grn_id: grn.grn_id,
            po_item_id: poItem.po_item_id,
            product_id: prd.product_id,
            ordered_quantity: 150,
            received_quantity: 150,
            damaged_quantity: 0,
            accepted_quantity: 150,
            inspection_status: 'ACCEPTED',
          },
        ]);
      }

      await new Promise((r) => setTimeout(r, 500));

      // Step 5: Matched Invoice & Payment
      setActiveStep(4);
      const invNum = `INV-AUTO-${suffix}`;
      const { data: inv } = await supabase
        .from('invoices')
        .insert([
          {
            invoice_number: invNum,
            po_id: po.po_id,
            supplier_id: sup.supplier_id,
            invoice_date: new Date().toISOString(),
            subtotal: totalAmount,
            total_amount: totalAmount,
            ocr_status: 'COMPLETED',
            match_status: 'MATCHED',
            payment_status: 'PAID',
          },
        ])
        .select()
        .single();

      if (inv) {
        await supabase.from('payments').insert([
          {
            invoice_id: inv.invoice_id,
            supplier_id: sup.supplier_id,
            payment_amount: totalAmount,
            payment_date: new Date().toISOString(),
            payment_method: 'NEFT',
            status: 'COMPLETED',
            transaction_reference: `NEFT-${Date.now().toString().slice(-8)}`,
          },
        ]);
      }

      addAlert({
        title: `Full P2P Flow Completed: ${poNum}`,
        message: `PO #${poNum} was generated, received at dock, 3-way matched, and paid (₹${totalAmount.toLocaleString()})!`,
        severity: 'success',
        link: '/traceability',
      });

      showSnackbar(`Full P2P Workflow Completed for ${poNum}!`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(`Failed: ${err.message}`, 'error');
    } finally {
      setRunning(null);
    }
  };

  const runExceptionScenario = async () => {
    try {
      setRunning('scenario2');

      const { data: suppliers } = await supabase.from('suppliers').select('*').limit(1);
      const { data: products } = await supabase.from('products').select('*').limit(1);
      const { data: warehouses } = await supabase.from('warehouses').select('*').limit(1);

      if (!suppliers?.length || !products?.length || !warehouses?.length) return;

      const sup = suppliers[0];
      const prd = products[0];
      const wh = warehouses[0];
      const suffix = Math.floor(1000 + Math.random() * 9000);

      const poNum = `PO-MISMATCH-${suffix}`;
      const { data: po } = await supabase
        .from('purchase_orders')
        .insert([
          {
            po_number: poNum,
            supplier_id: sup.supplier_id,
            warehouse_id: wh.warehouse_id,
            status: 'RECEIVED',
            total_amount: 5000,
          },
        ])
        .select()
        .single();

      const { data: grn } = await supabase
        .from('goods_receipts')
        .insert([
          {
            grn_number: `GRN-MISMATCH-${suffix}`,
            po_id: po.po_id,
            received_date: new Date().toISOString(),
            status: 'PENDING_INSPECTION',
            notes: '10 units damaged in transit during unloading',
          },
        ])
        .select()
        .single();

      const { data: inv } = await supabase
        .from('invoices')
        .insert([
          {
            invoice_number: `INV-MISMATCH-${suffix}`,
            po_id: po.po_id,
            supplier_id: sup.supplier_id,
            invoice_date: new Date().toISOString(),
            total_amount: 5500,
            ocr_status: 'COMPLETED',
            match_status: 'MISMATCH',
            payment_status: 'ON_HOLD',
          },
        ])
        .select()
        .single();

      await supabase.from('exceptions').insert([
        {
          exception_number: `EXC-PRICE-${suffix}`,
          po_id: po.po_id,
          invoice_id: inv?.invoice_id,
          grn_id: grn?.grn_id,
          exception_type: 'PRICE_MISMATCH',
          expected_value: 5000,
          actual_value: 5500,
          difference: 500,
          severity: 'HIGH',
          status: 'OPEN',
          description: 'Invoice price of ₹55.00 exceeds Purchase Order rate of ₹50.00 by 10%.',
        },
      ]);

      addAlert({
        title: `Price Mismatch Flagged: ${inv?.invoice_number}`,
        message: `Invoice #${inv?.invoice_number} exceeded PO amount by ₹500. Automatic Payment Hold applied.`,
        severity: 'error',
        link: '/exceptions',
      });

      showSnackbar(`Exception Scenario generated: ${poNum} flagged with price variance!`, 'warning');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(`Failed: ${err.message}`, 'error');
    } finally {
      setRunning(null);
    }
  };

  const advanceGpsSimulation = async () => {
    try {
      setRunning('scenario3');

      const checkpoints = [
        { name: 'Toll Plaza Vashi (Mumbai Highway)', lat: 19.0657, lng: 72.9984, speed: 65, status: 'ON_TIME' },
        { name: 'Lonavala Ghat Waypoint', lat: 18.7557, lng: 73.4091, speed: 45, status: 'ON_TIME' },
        { name: 'Talegaon Checkpost', lat: 18.7300, lng: 73.6700, speed: 55, status: 'SLIGHT_DELAY' },
        { name: 'Pune Central Warehouse Approach', lat: 18.5204, lng: 73.8567, speed: 30, status: 'ARRIVING' },
      ];

      const chosen = checkpoints[Math.floor(Math.random() * checkpoints.length)];

      const { data: trucks } = await supabase.from('trucks').select('*').limit(1);
      if (trucks?.length) {
        await supabase.from('truck_locations').insert([
          {
            truck_id: trucks[0].truck_id,
            location_name: chosen.name,
            latitude: chosen.lat,
            longitude: chosen.lng,
            speed: chosen.speed,
            status: chosen.status,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      showSnackbar(`GPS Telemetry simulated: Truck pinged at "${chosen.name}" (${chosen.speed} km/h)`, 'info');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(`Failed: ${err.message}`, 'error');
    } finally {
      setRunning(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Automated Scenario Execution Wizard
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-slate-500">
            Execute full multi-step supply chain simulations in real-time. All data is automatically created,
            linked with relational foreign keys, and dynamically reflected across all dashboards.
          </p>

          {/* Stepper Progress when running scenario 1 */}
          {running === 'scenario1' && (
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-800 mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Executing Autonomous P2P Pipeline...</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {stepsScenario1.map((label, idx) => (
                  <div key={label} className="text-center">
                    <div
                      className={`h-1.5 rounded-full mb-1.5 transition-all ${
                        idx <= activeStep ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium block leading-tight ${
                        idx === activeStep
                          ? 'text-blue-700 font-bold'
                          : idx < activeStep
                          ? 'text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scenario 1 */}
          <div className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 transition-all bg-white shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Scenario 1: Complete "Golden" Procure-to-Pay Cycle
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                    Full E2E
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Runs the entire chain: PR ➔ PO ➔ Shipment ➔ Yard Entry ➔ Dock Assign ➔ 100% Quality GRN ➔ Clean 3-Way Match ➔ NEFT Payout.
                </p>
              </div>
              <button
                onClick={runGoldenP2PFlow}
                disabled={Boolean(running)}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs"
              >
                {running === 'scenario1' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white" />
                )}
                <span>Run Cycle</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Scenario 2 */}
            <div className="p-4 rounded-xl border border-slate-200 hover:border-amber-500 transition-all bg-white shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900">
                    Scenario 2: Price & Quantity Discrepancy
                  </h4>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">
                    Exception
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Simulates a price overcharge (+10%) and 10 damaged units at receiving to trigger automated Exception routing and Payment Hold.
                </p>
              </div>
              <button
                onClick={runExceptionScenario}
                disabled={Boolean(running)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Trigger Exception</span>
              </button>
            </div>

            {/* Scenario 3 */}
            <div className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 transition-all bg-white shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900">
                    Scenario 3: Live GPS Telemetry Ping
                  </h4>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                    Logistics
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Advances the simulated truck along highway waypoints with speed, coordinate telemetry, and arrival ETA calculations.
                </p>
              </div>
              <button
                onClick={advanceGpsSimulation}
                disabled={Boolean(running)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition-colors"
              >
                <Radio className="w-3.5 h-3.5 text-blue-600" />
                <span>Simulate GPS Ping</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScenarioRunner;
