import React, { useCallback, useRef, useState } from 'react';
import {
  Upload,
  FileCheck,
  X,
  Sparkles,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { extractInvoiceFields, OcrInvoiceResult } from '../../lib/ocr';

interface OcrScanPanelProps {
  /** Called when OCR finishes. Caller merges fields into their form state. */
  onExtracted: (result: OcrInvoiceResult) => void;
  onError?: (msg: string) => void;
  /** Optional: accepted file MIME types string */
  accept?: string;
  /** Label shown for what to upload */
  documentLabel?: string;
}

/**
 * Reusable OCR drop-zone + scanner panel.
 * Used in PO, GRN, and Invoice modals.
 */
export const OcrScanPanel: React.FC<OcrScanPanelProps> = ({
  onExtracted,
  onError,
  accept = 'image/*,.pdf',
  documentLabel = 'document',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<OcrInvoiceResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setResult(null);
    setProgress(0);
    setStatusText('');
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleScan = async () => {
    if (!selectedFile) return;
    try {
      setScanning(true);
      setProgress(0);
      setStatusText('Loading OCR engine...');
      const r = await extractInvoiceFields(selectedFile, (pct, st) => {
        setProgress(pct);
        setStatusText(st);
      });
      setResult(r);
      setProgress(100);
      setStatusText('Extraction complete!');
      onExtracted(r);
    } catch (err: any) {
      onError?.(err.message || 'OCR failed');
    } finally {
      setScanning(false);
    }
  };

  const confidenceColor = (c: number) =>
    c >= 80
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : c >= 50
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !scanning && fileInputRef.current?.click()}
        className={`relative w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70'
            : selectedFile
            ? 'border-emerald-400 bg-emerald-50/40'
            : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />

        {selectedFile ? (
          <>
            <FileCheck className="w-7 h-7 text-emerald-600 mb-1" />
            <span className="font-bold text-emerald-700 text-xs text-center truncate max-w-full px-2">
              {selectedFile.name}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setResult(null); }}
              className="mt-1.5 text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          </>
        ) : (
          <>
            <Upload className="w-7 h-7 text-slate-400 mb-1" />
            <span className="font-semibold text-slate-700 text-xs">
              Drop {documentLabel} or click to browse
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WEBP, BMP</span>
          </>
        )}
      </div>

      {/* Scan Button */}
      {selectedFile && !result && (
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors disabled:opacity-60"
        >
          {scanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {scanning ? statusText || 'Scanning...' : 'Run Tesseract OCR'}
        </button>
      )}

      {/* Progress Bar */}
      {scanning && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold text-slate-600">
            <span>{statusText}</span>
            <span className="text-blue-600">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-1.5 bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Result summary */}
      {result && !scanning && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              OCR Complete — Fields Auto-Filled
            </span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${confidenceColor(result.confidence)}`}>
              {result.confidence}% Conf.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-emerald-800">
            {result.invoiceNumber && <div>Invoice #: <strong>{result.invoiceNumber}</strong></div>}
            {result.poNumber && <div>PO #: <strong>{result.poNumber}</strong></div>}
            {result.totalAmount != null && <div>Total: <strong>₹{result.totalAmount.toLocaleString()}</strong></div>}
            {result.vendorName && <div>Vendor: <strong>{result.vendorName}</strong></div>}
            {result.invoiceDate && <div>Date: <strong>{result.invoiceDate}</strong></div>}
            {result.gstAmount != null && <div>GST: <strong>₹{result.gstAmount.toLocaleString()}</strong></div>}
          </div>
        </div>
      )}

      {/* Raw text toggle */}
      {result && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              Raw OCR Text
            </span>
            {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showRaw && (
            <div className="p-3 max-h-32 overflow-y-auto bg-slate-900 text-emerald-400 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
              {result.rawText || 'No text extracted.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OcrScanPanel;
