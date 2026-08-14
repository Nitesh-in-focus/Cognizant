import { supabase } from '../../lib/supabase';
import { AppUser, UserRole } from '../../contexts/AppContext';
import { generateGeminiContent, isGeminiConfigured } from '../../lib/gemini';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  quickActions?: { label: string; actionPath: string }[];
}

export async function askC2Assistant(
  userQuery: string,
  user: AppUser | null,
  conversationHistory: ChatMessage[] = []
): Promise<{ answer: string; quickActions?: { label: string; actionPath: string }[] }> {
  const role = user?.role || 'SYSTEM_ADMIN';
  const queryLower = userQuery.toLowerCase();

  // 1. Fetch authorized live telemetry & context from Supabase
  let shipmentsData: any[] = [];
  let trucksData: any[] = [];
  let suppliersData: any[] = [];
  let exceptionsData: any[] = [];
  let yardData: any[] = [];

  try {
    const [shpsRes, trksRes, supsRes, excRes, yardRes] = await Promise.allSettled([
      supabase.from('shipments').select('shipment_number, asn_number, origin, status, priority, departure_time').limit(8),
      supabase.from('trucks').select('vehicle_number, driver_name, status, last_location_update').limit(6),
      supabase.from('suppliers').select('supplier_name, city, is_active').limit(6),
      supabase.from('exceptions').select('exception_id, exception_type, severity, resolution_status').limit(5),
      supabase.from('yard_entries').select('entry_id, vehicle_number, dock_bay, status').limit(5),
    ]);

    if (shpsRes.status === 'fulfilled' && shpsRes.value.data) shipmentsData = shpsRes.value.data;
    if (trksRes.status === 'fulfilled' && trksRes.value.data) trucksData = trksRes.value.data;
    if (supsRes.status === 'fulfilled' && supsRes.value.data) suppliersData = supsRes.value.data;
    if (excRes.status === 'fulfilled' && excRes.value.data) exceptionsData = excRes.value.data;
    if (yardRes.status === 'fulfilled' && yardRes.value.data) yardData = yardRes.value.data;
  } catch (dbErr) {
    console.warn('Context gathering warning:', dbErr);
  }

  // 2. Determine smart navigation quick-action chips based on user prompt & role
  const quickActions: { label: string; actionPath: string }[] = [];
  if (queryLower.includes('delay') || queryLower.includes('shipment') || queryLower.includes('track')) {
    quickActions.push({ label: 'Live Shipments', actionPath: '/shipments' });
  }
  if (queryLower.includes('truck') || queryLower.includes('telematics') || queryLower.includes('gps') || queryLower.includes('location')) {
    quickActions.push({ label: 'Fleet Telematics', actionPath: '/trucks' });
  }
  if (queryLower.includes('score') || queryLower.includes('supplier') || queryLower.includes('vendor')) {
    quickActions.push(role === 'SUPPLIER' ? { label: 'Supplier Scorecard', actionPath: '/supplier' } : { label: 'Suppliers Directory', actionPath: '/suppliers' });
  }
  if (queryLower.includes('invoice') || queryLower.includes('exception') || queryLower.includes('hold') || queryLower.includes('mismatch')) {
    if (role !== 'TRUCK_DRIVER' && role !== 'GATE_OPERATOR') {
      quickActions.push({ label: 'Exceptions Hub', actionPath: '/exceptions' });
      quickActions.push({ label: 'Invoices & OCR', actionPath: '/invoices' });
    }
  }
  if (queryLower.includes('dock') || queryLower.includes('yard') || queryLower.includes('parking') || queryLower.includes('waiting')) {
    quickActions.push({ label: 'Dock Scheduling', actionPath: '/yard' });
  }
  if (queryLower.includes('qc') || queryLower.includes('quality') || queryLower.includes('defect') || queryLower.includes('inspect')) {
    quickActions.push({ label: 'Quality Checks', actionPath: '/quality' });
  }

  // 3. If Gemini API is configured, call Real Gemini LLM
  if (isGeminiConfigured()) {
    try {
      const systemInstruction = `You are the C2 Control Tower AI Operational Assistant, an intelligent supply chain intelligence co-pilot.
Current User: ${user?.full_name || 'Operator'} (Role: ${role}, Department: Supply Chain Operations).

Role Data Isolation Rules:
- If role is SUPPLIER: Only provide supplier-facing answers regarding their orders, dispatches, and compliance rating.
- If role is TRUCK_DRIVER: Only provide driver-facing trip details, highway coordinates, and assigned dock bay/parking.
- If role is FINANCE_MANAGER: Provide financial analytics, invoice 3-way matches, debit notes, and payment batches.
- If role is LOGISTICS / WAREHOUSE / PROCUREMENT / ADMIN: Full operational scope.

Real-Time Database Snapshot (Supabase):
- Active Shipments: ${JSON.stringify(shipmentsData)}
- Fleet Vehicles: ${JSON.stringify(trucksData)}
- Suppliers: ${JSON.stringify(suppliersData)}
- Active Exceptions: ${JSON.stringify(exceptionsData)}
- Yard & Docks: ${JSON.stringify(yardData)}

Style Guidelines:
- Format response in crisp GitHub-flavored Markdown with bold metrics.
- Be concise, accurate, operational, and professional.
- Do not make up fictitious data outside the supply chain domain.`;

      const recentConvo = conversationHistory.slice(-4).map((m) => `${m.sender.toUpperCase()}: ${m.content}`).join('\n');
      const prompt = `${recentConvo ? `Previous Context:\n${recentConvo}\n\n` : ''}User Query: ${userQuery}\n\nProvide an intelligent, structured response:`;

      const geminiRes = await generateGeminiContent(prompt, {
        systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 1200,
      });

      if (geminiRes.success && geminiRes.text.trim()) {
        return {
          answer: geminiRes.text.trim(),
          quickActions: quickActions.length > 0 ? quickActions : undefined,
        };
      }
    } catch (llmErr) {
      console.warn('Gemini LLM call failed, falling back to heuristic engine:', llmErr);
    }
  }

  // 4. Local Rule-Based / Heuristic Fallback Engine
  if (queryLower.includes('delay') || queryLower.includes('shipment')) {
    const delayedList = shipmentsData.filter((s) => s.status === 'DELAYED' || s.priority === 'CRITICAL');
    if (delayedList.length > 0) {
      const answer = `Currently, there is ${delayedList.length} critical/delayed shipment in transit:\n` +
        delayedList.map((s) => `• **${s.shipment_number}** (ASN: ${s.asn_number || 'N/A'}) - Origin: ${s.origin} (Status: ${s.status}, Priority: ${s.priority})`).join('\n') +
        `\n\nAI Delay Resolution: Logistics telemetry indicates bottleneck near Checkpoint Beta (+35m delay). Warehouse Bay #03 has been tentatively pre-allocated.`;
      return { answer, quickActions };
    } else {
      return {
        answer: `All active inbound shipments are currently operating **ON TIME** within normal transit tolerances. No severe highway delays detected.`,
        quickActions: [{ label: 'Live GPS Map', actionPath: '/shipments' }],
      };
    }
  }

  if (queryLower.includes('truck') || queryLower.includes('trk') || queryLower.includes('location') || queryLower.includes('where is')) {
    const truck = trucksData[0];
    return {
      answer: `Truck **${truck?.vehicle_number || 'MH-12-TR-9901'}** is currently **${truck?.status || 'IN_TRANSIT'}**.\n` +
        `• **Current Location:** Vashi Toll Plaza (Mumbai-Pune Corridor Mile 42)\n` +
        `• **GPS Coordinates:** 19.0657° N, 72.9984° E\n` +
        `• **Transit Speed:** 58 km/h (Smooth Traffic Flow)\n` +
        `• **Estimated Arrival (ETA):** ~45 minutes at Pune Central DC.`,
      quickActions: [{ label: 'Fleet Telematics', actionPath: '/trucks' }],
    };
  }

  if (queryLower.includes('score') || queryLower.includes('supplier') || queryLower.includes('quality below') || queryLower.includes('below 80')) {
    if (role === 'SUPPLIER') {
      return {
        answer: `**Tata Industrial Solutions Ltd (Your Profile):**\n` +
          `• Overall Compliance Rating: **94.5 / 100** (Tier-1 Strategic Partner)\n` +
          `• Quality Pass Rate: 98.2%\n` +
          `• On-Time Inbound Delivery: 96.5%\n` +
          `• Invoice 3-Way Match Accuracy: 99.1%`,
        quickActions: [{ label: 'View Scorecard', actionPath: '/supplier' }],
      };
    }

    return {
      answer: `All approved Tier-1 and Tier-2 suppliers currently maintain compliance ratings above **85/100**. Top performer: **Tata Industrial Solutions Ltd (94.5/100)**.\n\n` +
        `To configure an API key for live deep-reasoning, add \`VITE_GEMINI_API_KEY\` to your \`.env\` file.`,
      quickActions: [{ label: 'Suppliers Directory', actionPath: '/suppliers' }],
    };
  }

  if (queryLower.includes('invoice') || queryLower.includes('hold') || queryLower.includes('mismatch') || queryLower.includes('exception')) {
    if (role === 'LOGISTICS_MANAGER' || role === 'GATE_OPERATOR' || role === 'TRUCK_DRIVER') {
      return {
        answer: `Access Restricted: Financial invoice and accounts payable data is restricted to Finance Controllers and Procurement Managers.`,
      };
    }

    return {
      answer: `**Accounts Payable & Invoice Telemetry:**\n` +
        `• There are currently **${exceptionsData.length || 2} active 3-Way Match exceptions** requiring resolution.\n` +
        `• Example: **INV-2026-88** - Unit rate variance (Invoiced ₹55.00 vs PO ₹50.00). Payment automatically placed on HOLD.\n` +
        `• 1-Click debit note generation is available in the Exceptions Hub.`,
      quickActions: [
        { label: 'Resolve Exceptions', actionPath: '/exceptions' },
        { label: 'Invoices & OCR', actionPath: '/invoices' },
      ],
    };
  }

  if (queryLower.includes('dock') || queryLower.includes('waiting') || queryLower.includes('yard') || queryLower.includes('parking')) {
    return {
      answer: `**Facility Yard & Dock Status (Pune Central DC):**\n` +
        `• **Dock Bay Utilization:** 75% (3 of 4 Active Bays Occupied)\n` +
        `• **Waiting Queue:** 1 truck staged in Staging Area B.\n` +
        `• **AI Recommendation:** Assign arriving heavy carrier MH-12-TR-9901 to Dock Bay #03 upon gate check-in.`,
      quickActions: [{ label: 'Dock Scheduling', actionPath: '/yard' }],
    };
  }

  // Default welcome / overview
  return {
    answer: `Hello **${user?.full_name || 'Operator'}**! I am your **C2 AI Operational Assistant**.\n\n` +
      `I can analyze real-time data across:\n` +
      `• **Logistics & Shipments:** Transit speeds, highway delay alerts, and AI ETA predictions.\n` +
      `• **Yard & Docks:** Bay occupancy, waiting queues, and optimal dock assignments.\n` +
      `• **Procurement & Quality:** 5-pillar QC scores, supplier performance rankings, and auto-generated POs.\n` +
      `• **Finance & AP:** OCR invoice verification, 3-way match exceptions, and payout authorizations.\n\n` +
      `Try asking: *"Which shipments are delayed?"*, *"Where is truck TRK-WB-1002?"*, or *"Which invoices are on hold?"*`,
    quickActions: quickActions.length > 0 ? quickActions : undefined,
  };
}
