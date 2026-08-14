import { createWorker } from 'tesseract.js';

export interface OcrInvoiceResult {
  invoiceNumber: string | null;
  poNumber: string | null;
  totalAmount: number | null;
  subtotal: number | null;
  gstAmount: number | null;
  vendorName: string | null;
  invoiceDate: string | null;
  quantity: number | null;
  unitPrice: number | null;
  damagedQuantity: number | null;
  productName: string | null;
  paymentTerms: string | null;
  rawText: string;
  confidence: number;
  lines: string[];
}

/**
 * Normalizes dirty OCR string: strips extra symbols, cleans whitespace,
 * converts OCR letter-digit confusions where appropriate.
 */
function cleanText(raw: string): string {
  return raw
    .replace(/[\r\t]/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a numeric amount from messy currency strings (e.g. "₹ 1,50,000.00", "Rs.45000/-", "15000.50")
 */
function parseAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  // Remove currency words, symbols, trailing slashes, dashes, commas
  const cleaned = raw
    .replace(/₹|Rs\.?|INR|USD|\$|EUR|\/|\-/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Runs Tesseract.js OCR on an uploaded File (image or PDF-page screenshot)
 * and extracts PO, GRN, and Invoice fields using a multi-heuristic parser.
 */
export async function extractInvoiceFields(
  file: File,
  onProgress?: (pct: number, status: string) => void
): Promise<OcrInvoiceResult> {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onProgress?.(pct, `Scanning document with Tesseract OCR... ${pct}%`);
      } else {
        onProgress?.(0, m.status ? `OCR: ${m.status}` : 'Initializing OCR engine...');
      }
    },
  });

  const { data } = await worker.recognize(file);
  await worker.terminate();

  const rawText = data.text || '';
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanFullText = cleanText(rawText);

  // ══════════════════════════════════════════════════════════════════════
  // 1. INVOICE NUMBER EXTRACTION
  // ══════════════════════════════════════════════════════════════════════
  let invoiceNumber: string | null = null;

  // Rule 1: Explicit labels with colon or whitespace on same line
  const invMatch1 = rawText.match(
    /(?:tax\s*invoice|invoice|inv|bill)\s*(?:no|number|num|#|\.)?[:\s\-_|#]*([A-Za-z0-9\-\/]{3,30})/i
  );
  if (invMatch1 && !/date|total|amount|due/i.test(invMatch1[1])) {
    invoiceNumber = invMatch1[1].trim();
  }

  // Rule 2: Multi-line check (Label on line i, value on line i+1)
  if (!invoiceNumber) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^(?:tax\s*invoice|invoice|inv|bill)\s*(?:no|number|#|\.)?[:\s\-_#]*$/i.test(lines[i])) {
        const next = lines[i + 1].trim();
        if (/^[A-Za-z0-9\-\/]{3,30}$/.test(next) && !/date|total|amount/i.test(next)) {
          invoiceNumber = next;
          break;
        }
      }
    }
  }

  // Rule 3: Standalone INV patterns (e.g. INV-2026-001, INV/26/109)
  if (!invoiceNumber) {
    const standaloneInv = rawText.match(/\b(INV[0-9A-Za-z\-\/]{3,20})\b/i);
    if (standaloneInv) invoiceNumber = standaloneInv[1].trim();
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. PURCHASE ORDER (PO) NUMBER EXTRACTION
  // ══════════════════════════════════════════════════════════════════════
  let poNumber: string | null = null;

  // Rule 1: Explicit PO labels
  const poMatch1 = rawText.match(
    /(?:purchase\s*order|p\.?\s*o\.?|po|order\s*ref(?:erence)?|order)\s*(?:no|number|num|#|\.)?[:\s\-_|#]*([A-Za-z0-9\-\/]{3,30})/i
  );
  if (poMatch1 && !/date|total|amount|qty/i.test(poMatch1[1])) {
    poNumber = poMatch1[1].trim();
  }

  // Rule 2: Multi-line PO label
  if (!poNumber) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^(?:purchase\s*order|p\.?\s*o\.?|po\s*no|po\s*#)[:\s\-_#]*$/i.test(lines[i])) {
        const next = lines[i + 1].trim();
        if (/^[A-Za-z0-9\-\/]{3,30}$/.test(next)) {
          poNumber = next;
          break;
        }
      }
    }
  }

  // Rule 3: Standalone PO patterns (e.g. PO-2026-1001, PO-1002)
  if (!poNumber) {
    const standalonePo = rawText.match(/\b(PO[0-9A-Za-z\-\/]{3,20})\b/i);
    if (standalonePo) poNumber = standalonePo[1].trim();
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. FINANCIAL TOTALS (TOTAL, SUBTOTAL, GST)
  // ══════════════════════════════════════════════════════════════════════
  let totalAmount: number | null = null;
  let subtotal: number | null = null;
  let gstAmount: number | null = null;

  // Total Amount: Grand Total, Total Amount, Net Payable, Total (INR), Amount Due
  const totalMatch = rawText.match(
    /(?:grand\s*total|total\s*amount|net\s*payable|amount\s*due|invoice\s*total|total\s*\(inr\)|total\s*inr|net\s*amount|total)[:\s\-_|₹Rs.]*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (totalMatch) {
    totalAmount = parseAmount(totalMatch[1]);
  }

  // Multi-line total (e.g., line 1: "TOTAL AMOUNT", line 2: "₹ 59,000.00")
  if (!totalAmount) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^(?:grand\s*total|total\s*amount|total\s*inr|net\s*payable|total)[:\s]*$/i.test(lines[i])) {
        const amt = parseAmount(lines[i + 1]);
        if (amt && amt > 0) {
          totalAmount = amt;
          break;
        }
      }
    }
  }

  // Fallback for total: scan for highest monetary figure in document if typical
  if (!totalAmount) {
    const allNums = rawText.match(/(?:₹|Rs\.?|INR|\$)\s*([\d,]+(?:\.\d{2})?)/gi);
    if (allNums && allNums.length > 0) {
      const parsedNums = allNums.map((n) => parseAmount(n)).filter((n): n is number => n !== null && n > 100);
      if (parsedNums.length > 0) {
        totalAmount = Math.max(...parsedNums);
      }
    }
  }

  // Subtotal / Taxable Amount
  const subtotalMatch = rawText.match(
    /(?:sub[\s-]?total|taxable\s*amount|taxable\s*value|basic\s*amount|basic\s*price)[:\s\-_|₹Rs.]*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (subtotalMatch) {
    subtotal = parseAmount(subtotalMatch[1]);
  }

  // GST / Tax Amount
  const gstMatch = rawText.match(
    /(?:total\s*gst|igst|cgst\s*\+\s*sgst|tax\s*amount|gst\s*\(18%\)|gst\s*amount|18%\s*gst|gst)[:\s\-_|₹Rs.]*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (gstMatch) {
    gstAmount = parseAmount(gstMatch[1]);
  } else if (totalAmount && !subtotal) {
    // Standard 18% GST estimate if not explicitly stated
    subtotal = Math.round((totalAmount / 1.18) * 100) / 100;
    gstAmount = Math.round((totalAmount - subtotal) * 100) / 100;
  } else if (totalAmount && subtotal) {
    gstAmount = Math.round((totalAmount - subtotal) * 100) / 100;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. VENDOR / SUPPLIER COMPANY NAME
  // ══════════════════════════════════════════════════════════════════════
  let vendorName: string | null = null;

  // Rule 1: Explicit labels (From, Vendor, Supplier, Issued By, Seller)
  const vendorMatch = rawText.match(
    /(?:from|vendor|supplier|issued\s*by|bill\s*from|sold\s*by|seller|party\s*name)[:\s\-_|]*([A-Za-z0-9\s&.,\-]{3,45})/i
  );
  if (vendorMatch && !/date|invoice|address|pincode|gstin|phone/i.test(vendorMatch[1])) {
    vendorName = vendorMatch[1].trim();
  }

  // Rule 2: Corporate entity pattern in top 6 lines
  if (!vendorName) {
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const l = lines[i];
      if (/(?:pvt\.?\s*ltd|private\s*limited|ltd\.?|limited|corp\.?|corporation|llp|inc\.?|enterprises|industries|steel|forge|logistics|spares|systems)/i.test(l)) {
        if (!/invoice|tax|bill|to:|ship\s*to/i.test(l) && l.length > 3 && l.length < 60) {
          vendorName = l.replace(/^(?:from|vendor|seller)[:\s]*/i, '').trim();
          break;
        }
      }
    }
  }

  // Rule 3: Match known vendors from database seed
  const knownVendors = [
    'Tata Steel Tubes Ltd',
    'Bharat Heavy Forge Co',
    'Kirloskar Flow Systems',
    'Mahindra Logistics Freight',
    'Apex Electronics Spares',
    'ABC Industrial Supplies',
    'Eastern Logistics',
    'BlueDart Heavy Freight',
    'Siemens Industrial Automation',
  ];
  if (!vendorName) {
    for (const v of knownVendors) {
      if (new RegExp(v.replace(/\s+/g, '\\s*'), 'i').test(rawText)) {
        vendorName = v;
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. DATE EXTRACTION
  // ══════════════════════════════════════════════════════════════════════
  let invoiceDate: string | null = null;

  // Rule 1: Explicit date label
  const dateMatch = rawText.match(
    /(?:invoice\s*date|date\s*of\s*issue|po\s*date|challan\s*date|dated|issue\s*date|date)[:\s\-_|]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{2,4})/i
  );
  if (dateMatch) {
    invoiceDate = dateMatch[1].trim();
  }

  // Rule 2: Standalone date patterns
  if (!invoiceDate) {
    const standaloneDate = rawText.match(
      /\b([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})\b/
    );
    if (standaloneDate) invoiceDate = standaloneDate[1].trim();
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. QUANTITY & UNIT PRICE EXTRACTION (For PO / GRN)
  // ══════════════════════════════════════════════════════════════════════
  let quantity: number | null = null;
  let unitPrice: number | null = null;
  let damagedQuantity: number | null = null;

  // Quantity match
  const qtyMatch = rawText.match(
    /(?:qty|quantity|units|total\s*qty|received\s*qty|delivered\s*qty|ordered\s*qty)[:\s\-_|]*([0-9]+(?:\.[0-9]+)?)/i
  );
  if (qtyMatch) {
    const q = parseFloat(qtyMatch[1]);
    if (!isNaN(q) && q > 0) quantity = Math.round(q);
  } else {
    // Check for "100 Nos" or "100 Units" or "100 Pcs"
    const unitMatch = rawText.match(/\b([0-9]{1,5})\s*(?:nos|pcs|units|boxes|pkts)\b/i);
    if (unitMatch) quantity = parseInt(unitMatch[1], 10);
  }

  // Unit Price match
  const priceMatch = rawText.match(
    /(?:unit\s*price|rate|price\/unit|rate\/unit|unit\s*rate)[:\s\-_|₹Rs.]*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (priceMatch) {
    unitPrice = parseAmount(priceMatch[1]);
  } else if (totalAmount && quantity && quantity > 0) {
    // Derive unit price from subtotal or total / qty
    const baseAmount = subtotal || totalAmount / 1.18;
    unitPrice = Math.round((baseAmount / quantity) * 100) / 100;
  }

  // Damaged Quantity match
  const damageMatch = rawText.match(
    /(?:damaged|damage|defective|rejected|breakage|shortage)[:\s\-_|]*([0-9]+)/i
  );
  if (damageMatch) {
    damagedQuantity = parseInt(damageMatch[1], 10);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 7. PRODUCT SKU / NAME DETECTION
  // ══════════════════════════════════════════════════════════════════════
  let productName: string | null = null;
  const knownProducts = [
    'Industrial Centrifugal Pump',
    'Stainless Steel Tubes 2-Inch',
    'Heavy Forged Flanges',
    'Hydraulic Control Valves',
    'Ball Bearings Set 6204',
    'Pneumatic Actuator',
    'Pressure Transmitter Sensor',
  ];
  for (const p of knownProducts) {
    if (new RegExp(p.replace(/\s+/g, '\\s*'), 'i').test(rawText)) {
      productName = p;
      break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8. PAYMENT TERMS
  // ══════════════════════════════════════════════════════════════════════
  let paymentTerms: string | null = null;
  const termsMatch = rawText.match(/(?:payment\s*terms|terms)[:\s\-_|]*(NET\s*\d+|IMMEDIATE|ADVANCE|COD)/i);
  if (termsMatch) {
    paymentTerms = termsMatch[1].toUpperCase().trim();
  }

  return {
    invoiceNumber,
    poNumber,
    totalAmount,
    subtotal,
    gstAmount,
    vendorName,
    invoiceDate,
    quantity,
    unitPrice,
    damagedQuantity,
    productName,
    paymentTerms,
    rawText,
    confidence: Math.round(data.confidence),
    lines,
  };
}
