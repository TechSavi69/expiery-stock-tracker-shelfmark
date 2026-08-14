/*
 * Shelfmark design reminder: contemporary editorial modernism for independent retailers.
 * Warm parchment, ink navy, olive safe-stock signals, and tomato-pencil urgency keep
 * the interface tactile, readable, and practical on a one-handed mobile screen.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  CloudOff,
  Download,
  FileText,
  Filter,
  Leaf,
  ListFilter,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  Search,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Mic,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { toast } from "sonner";
import { db, type InventoryItem } from "@/lib/db";

const LOGO_SRC = "/shelfmark_logo.png";
const DASHBOARD_ART = "/dashboard_illustration.png";
const SUMMARY_ART = "/summary_illustration.png";
const EMPTY_ART = "/empty_state_illustration.png";
const DAY_MS = 86_400_000;

type ViewKey = "dashboard" | "summary";
type StatusKey = "expired" | "soon" | "safe";
type FilterKey = "all" | StatusKey;

type ItemForm = {
  name: string;
  barcode: string;
  category: string;
  quantity: string;
  expiryDate: string;
  alertThreshold: string;
};

type DatePreset = "today" | "3d" | "7d" | "custom";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CATEGORY_OPTIONS = ["Dairy", "Produce", "Bakery", "Pantry", "Frozen", "Beverage", "Household"];

const todayKey = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const dateKeyFrom = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const createEmptyForm = (): ItemForm => ({
  name: "",
  barcode: "",
  category: "",
  quantity: "",
  expiryDate: dateKeyFrom(addDays(new Date(), 7)),
  alertThreshold: "3",
});

const formatDate = (date: string, options: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(`${date}T12:00:00`));

const getDaysUntil = (date: string) => {
  const today = new Date(`${todayKey()}T00:00:00`);
  const expiry = new Date(`${date}T00:00:00`);
  return Math.floor((expiry.getTime() - today.getTime()) / DAY_MS);
};

const parseVoiceCommandMultiLang = (transcript: string) => {
  const text = transcript.toLowerCase();
  const quantityMatch = text.match(/\d+/);
  const quantity = quantityMatch ? quantityMatch[0] : "";
  let daysToAdd = 7;
  if (text.includes("today") || text.includes("අද") || text.includes("இன்று")) {
    daysToAdd = 0;
  } else if (text.includes("tomorrow") || text.includes("හෙට") || text.includes("நாளை")) {
    daysToAdd = 1;
  }
  const targetDate = addDays(new Date(), daysToAdd);
  const expiryDate = dateKeyFrom(targetDate);
  let name = text
    .replace(/add|expiring|today|tomorrow/g, "")
    .replace(/එකතු කරන්න|කල් ඉකුත් වන|අද|හෙට/g, "")
    .replace(/சேர்|காலாவதியாகும்|இன்று|நாளை/g, "")
    .replace(/\d+/g, "")
    .trim();
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return { name, quantity, expiryDate };
};

const getDatePreset = (date: string): DatePreset => {
  const days = getDaysUntil(date);
  if (days === 0) return "today";
  if (days === 3) return "3d";
  if (days === 7) return "7d";
  return "custom";
};

const getStatus = (item: InventoryItem): StatusKey => {
  const days = getDaysUntil(item.expiryDate);
  if (days < 0) return "expired";
  if (days <= 7) return "soon";
  return "safe";
};

const statusCopy: Record<StatusKey, { label: string; accent: string; soft: string; icon: typeof CircleAlert }> = {
  expired: { label: "Expired", accent: "text-[#B84735]", soft: "bg-[#FBE5DF]", icon: CircleAlert },
  soon: { label: "Within 7 days", accent: "text-[#9A5B22]", soft: "bg-[#F9ECD2]", icon: CalendarClock },
  safe: { label: "Safe stock", accent: "text-[#477255]", soft: "bg-[#E4EEE2]", icon: ShieldCheck },
};

const statusFilterLabel: Record<FilterKey, string> = {
  all: "All statuses",
  expired: "Expired",
  soon: "Within 7 days",
  safe: "Safe stock",
};

const normalizeImportedItem = (row: Record<string, unknown>): Omit<InventoryItem, "id"> | null => {
  const name = String(row.name ?? "").trim();
  const barcode = String(row.barcode ?? "").trim();
  const category = String(row.category ?? "Uncategorized").trim() || "Uncategorized";
  const quantity = Number(row.quantity);
  const expiryDate = String(row.expiryDate ?? "").slice(0, 10);
  const alertThreshold = Number(row.alertThreshold ?? 3);

  if (!name || !expiryDate || !Number.isFinite(quantity) || quantity < 0) return null;

  const now = new Date().toISOString();
  return {
    name,
    barcode: barcode || undefined,
    category,
    quantity: Math.round(quantity),
    expiryDate,
    alertThreshold: Number.isFinite(alertThreshold) ? Math.max(0, Math.round(alertThreshold)) : 3,
    createdAt: String(row.createdAt ?? now),
    updatedAt: now,
  };
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
};

const parseCsv = (text: string) => {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
};

const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
};

const playWarningBeep = () => {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.18);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
  window.setTimeout(() => context.close().catch(() => undefined), 260);
};

function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={LOGO_SRC} alt="" className={compact ? "size-8" : "size-9"} />
      {!compact && (
        <div className="leading-none">
          <div className="flex items-baseline tracking-[-0.05em] text-[#17342B]"><span className="font-display text-[1.4rem]">Shelf</span><span className="ml-0.5 font-sans text-[1.18rem] font-extrabold">mark</span></div>
          <div className="mt-1 font-sans text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7D847D]">Retail ledger</div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, detail, tone = "ink" }: { label: string; value: string | number; detail: string; tone?: "ink" | "tomato" | "olive" }) {
  const toneClass = tone === "tomato" ? "text-[#C14C39]" : tone === "olive" ? "text-[#477255]" : "text-[#17342B]";
  return (
    <div className="min-w-0 border-l border-[#DED7CE] pl-4 first:border-l-0 first:pl-0">
      <div className="font-sans text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8D918C]">{label}</div>
      <div className={`mt-1 font-display text-[1.9rem] leading-none tracking-[-0.06em] ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-[#747D76]">{detail}</div>
    </div>
  );
}

function StatusBadge({ status, days, urgent = false }: { status: StatusKey; days: number; urgent?: boolean }) {
  const copy = statusCopy[status];
  const Icon = copy.icon;
  const timing = status === "expired" ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[10px] font-extrabold uppercase tracking-[0.08em] ${urgent ? "bg-[#FBE5DF] text-[#B84735]" : `${copy.soft} ${copy.accent}`}`}>
      <Icon className="size-3.5" strokeWidth={2.4} />
      {timing}
    </span>
  );
}

function InventoryCard({ item, onEdit, onDelete }: { item: InventoryItem; onEdit: (item: InventoryItem) => void; onDelete: (item: InventoryItem) => void }) {
  const status = getStatus(item);
  const days = getDaysUntil(item.expiryDate);
  const copy = statusCopy[status];
  const urgent = days <= 2;

  return (
    <article className={`ledger-card group relative overflow-hidden rounded-2xl border border-[#E4DDD4] bg-[#FFFDF9] p-4 shadow-[0_10px_24px_rgba(23,52,43,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(23,52,43,0.1)] ${status === "expired" ? "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#E45B45]" : ""} ${urgent ? "urgent-card" : ""}`}>
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-sans text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8B928A]">{item.category}</span>
            {item.alertThreshold > 0 && status !== "expired" && (
              <span className="rounded-full bg-[#F3EEE7] px-2 py-0.5 text-[9px] font-bold text-[#777E77]">Alert {item.alertThreshold}d</span>
            )}
          </div>
          <h3 className="truncate font-sans text-[15px] font-extrabold tracking-[-0.02em] text-[#17342B]">{item.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button type="button" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)} className="rounded-full p-2 text-[#7F8981] transition hover:bg-[#F2ECE4] hover:text-[#17342B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E45B45]">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" aria-label={`Delete ${item.name}`} onClick={() => onDelete(item)} className="rounded-full p-2 text-[#7F8981] transition hover:bg-[#FBE5DF] hover:text-[#B84735] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E45B45]">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 pl-1">
        <div>
          <div className="font-display text-2xl leading-none tracking-[-0.05em] text-[#17342B]">{item.quantity}</div>
          <div className="mt-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B928A]">units on hand</div>
        </div>
        <div className="text-right">
          <StatusBadge status={status} days={days} urgent={urgent} />
          <div className={`mt-2 text-xs font-bold ${copy.accent}`}>{formatDate(item.expiryDate)}</div>
        </div>
      </div>
    </article>
  );
}

function StatusColumn({ status, items, onEdit, onDelete, onSeeAll }: { status: StatusKey; items: InventoryItem[]; onEdit: (item: InventoryItem) => void; onDelete: (item: InventoryItem) => void; onSeeAll: () => void }) {
  const copy = statusCopy[status];
  const Icon = copy.icon;
  const visibleItems = items.slice(0, 3);
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className={`flex size-8 items-center justify-center rounded-xl ${copy.soft} ${copy.accent}`}><Icon className="size-4" /></div>
          <div>
            <h2 className="font-sans text-[13px] font-extrabold tracking-[-0.01em] text-[#17342B]">{copy.label}</h2>
            <p className="mt-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.11em] text-[#949992]">{items.length} {items.length === 1 ? "item" : "items"}</p>
          </div>
        </div>
        {items.length > 3 && <button type="button" onClick={onSeeAll} className="text-xs font-bold text-[#7A847C] underline decoration-[#D9D0C5] underline-offset-4 transition hover:text-[#17342B]">View all</button>}
      </div>
      <div className="space-y-3">
        {visibleItems.length > 0 ? visibleItems.map((item) => <InventoryCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />) : (
          <div className="rounded-2xl border border-dashed border-[#DCD5CC] bg-[#FBF8F3] px-4 py-7 text-center">
            <Check className={`mx-auto size-5 ${copy.accent}`} />
            <p className="mt-2 font-sans text-sm font-bold text-[#6F7B72]">Nothing here.</p>
            <p className="mt-1 text-xs leading-5 text-[#9A9D96]">A clear shelf is a good shelf.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function BarcodeScanner({ onClose, onDetected }: { onClose: () => void; onDetected: (value: string) => void }) {
  const [error, setError] = useState("");
  const [manualInput, setManualInput] = useState("");
  const regionId = "shelfmark-barcode-reader";

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let isMounted = true;
    let startPromise: Promise<any> | null = null;

    const initScanner = async () => {
      try {
        // Small delay to allow modal animation/DOM to settle
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (!isMounted) return;

        scanner = new Html5Qrcode(regionId);
        startPromise = scanner.start(
          { facingMode: "environment" }, // Will fallback to user camera on laptops
          { 
            fps: 20, 
            qrbox: { width: 300, height: 150 }, 
            disableFlip: false,
            // Native BarcodeDetector is much faster on modern browsers (Chrome/Edge)
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            },
            // Focus heavily on 1D retail barcodes to improve detection speed
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39
            ]
          },
          (decodedText) => {
            if (isMounted) onDetected(decodedText);
          },
          () => undefined
        );
        await startPromise;
      } catch (err) {
        if (isMounted) {
          console.warn("Scanner error:", err);
          setError("Camera access is unavailable. You can type the barcode instead.");
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      if (scanner) {
        const cleanup = () => {
          try {
            if (scanner && scanner.getState() === 2 /* SCANNING */) {
              scanner.stop().then(() => {
                try { scanner?.clear(); } catch (e) {}
              }).catch(() => {
                try { scanner?.clear(); } catch (e) {}
              });
            } else {
              try { scanner?.clear(); } catch (e) {}
            }
          } catch (e) {} // Catch all to prevent React Error Boundary crash
        };

        if (startPromise) {
          // Wait for start to finish before attempting to stop
          startPromise.then(cleanup).catch(cleanup);
        } else {
          cleanup();
        }
      }
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[70] bg-[#17342B]/55 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="barcode-title" className="absolute inset-x-4 bottom-4 overflow-hidden rounded-[1.8rem] border border-[#E4DDD4] bg-[#FFFDF9] shadow-[0_20px_70px_rgba(23,52,43,0.3)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(92vw,430px)] sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="flex items-start justify-between gap-4 border-b border-[#E8E1D8] px-5 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2 font-sans text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#477255]"><ScanLine className="size-3.5" /> Fast entry</div>
            <h2 id="barcode-title" className="font-display text-[1.8rem] leading-none tracking-[-0.05em] text-[#17342B]">Scan a barcode</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#E4DDD4] p-2.5 text-[#7F8981] transition hover:bg-[#F3EEE7] hover:text-[#17342B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E45B45]"><X className="size-4" /></button>
        </div>
        <div className="p-5">
          <div id={regionId} className="scanner-frame" aria-label="Barcode camera preview" />
          {error ? <div className="mt-3 rounded-xl bg-[#FBE5DF] px-3 py-2.5 text-xs font-bold leading-5 text-[#B84735]">{error}</div> : <p className="mt-3 text-xs leading-5 text-[#7B847C]">Point the camera at the product barcode. Nothing leaves this device.</p>}
          
          <div className="mt-4 flex gap-2">
            <input 
              type="text" 
              inputMode="numeric"
              placeholder="Or type barcode here..." 
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="field-input flex-1"
            />
            <button 
              type="button" 
              onClick={() => { if(manualInput.trim()) onDetected(manualInput.trim()); else onClose(); }} 
              className="flex items-center justify-center rounded-xl bg-[#17342B] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-[#2b5948] focus-visible:outline-none"
            >
              Enter
            </button>
          </div>
          <button type="button" onClick={onClose} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DED7CE] bg-[#FBF8F3] px-4 py-3 text-xs font-extrabold text-[#59675E] transition hover:bg-[#FFFDF9] focus-visible:outline-none">Cancel</button>
        </div>
      </section>
    </div>
  );
}

function ItemSheet({ editingItem, form, setForm, onClose, onSubmit, onScanBarcode }: { editingItem: InventoryItem | null; form: ItemForm; setForm: (form: ItemForm) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onScanBarcode: () => void }) {
  const update = (field: keyof ItemForm, value: string) => setForm({ ...form, [field]: value });
  
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-LK");

  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Your browser does not support voice input.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const parsedData = parseVoiceCommandMultiLang(transcript);
      setForm({
        ...form,
        name: parsedData.name || form.name,
        quantity: parsedData.quantity || form.quantity,
        expiryDate: parsedData.expiryDate || form.expiryDate
      });
      toast.success(`Voice applied: ${transcript}`);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== "no-speech") {
        toast.error(`Voice error: ${event.error}`);
      }
    };
    recognition.start();
  };

  const selectedPreset = getDatePreset(form.expiryDate);
  const setDatePreset = (preset: DatePreset) => {
    if (preset === "custom") return;
    const days = preset === "today" ? 0 : preset === "3d" ? 3 : 7;
    update("expiryDate", dateKeyFrom(addDays(new Date(), days)));
  };
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close item form" onClick={onClose} className="absolute inset-0 cursor-default bg-[#17342B]/35 backdrop-blur-[2px]" />
      <section role="dialog" aria-modal="true" aria-labelledby="item-sheet-title" className="absolute inset-x-0 bottom-0 max-h-[94vh] overflow-y-auto rounded-t-[2rem] border-t border-[#E4DDD4] bg-[#FFFDF9] px-5 pb-8 pt-5 shadow-[0_-18px_60px_rgba(23,52,43,0.18)] md:inset-y-0 md:left-auto md:right-0 md:w-[440px] md:rounded-none md:border-l md:border-t-0 md:px-8 md:pt-8">
        <div className="mx-auto max-w-xl md:mx-0">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 font-sans text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8B928A]"><Leaf className="size-3.5 text-[#477255]" /> Shelf entry</div>
              <h2 id="item-sheet-title" className="font-display text-[2rem] leading-none tracking-[-0.055em] text-[#17342B]">{editingItem ? "Edit item" : "Add to the shelf"}</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[#747D76]">Keep the details light. You can always tune the alert later.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-[#E4DDD4] p-2.5 text-[#7F8981] transition hover:bg-[#F3EEE7] hover:text-[#17342B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E45B45]"><X className="size-4" /></button>
          </div>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="flex flex-col gap-2 rounded-2xl bg-[#E4EEE2]/40 p-4 sm:flex-row sm:items-center sm:justify-between border border-[#CCDCCB]">
              <div>
                <div className="font-sans text-[11px] font-extrabold tracking-[0.05em] text-[#17342B] uppercase flex items-center gap-1.5"><Mic className="size-3 text-[#477255]" /> Voice Entry</div>
                <div className="mt-1 text-[10px] text-[#59675E]">Speak to auto-fill (e.g. "Add 12 milks tomorrow")</div>
              </div>
              <div className="flex items-center gap-2">
                <select aria-label="Voice language" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)} className="rounded-lg border border-[#CCDCCB] bg-white/70 px-2 py-1.5 text-[10px] font-bold text-[#59675E] outline-none">
                  <option value="en-LK">English</option>
                  <option value="si-LK">Sinhala</option>
                  <option value="ta-LK">Tamil</option>
                </select>
                <button type="button" onClick={startListening} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold transition-colors ${isListening ? "animate-pulse bg-[#FBE5DF] text-[#B84735] shadow-[0_0_10px_rgba(228,91,69,0.3)]" : "bg-[#17342B] text-white hover:bg-[#2b5948]"}`}><Mic className="size-3.5" /> {isListening ? "Listening..." : "Speak"}</button>
              </div>
            </div>
            <label className="block">
              <span className="field-label">Item name</span>
              <input required autoFocus value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Strawberry yogurt" className="field-input" />
            </label>
            <div>
              <span className="field-label">Barcode <span className="font-normal normal-case tracking-normal text-[#9A9D96]">(optional)</span></span>
              <div className="flex gap-2">
                <input inputMode="numeric" value={form.barcode} onChange={(event) => update("barcode", event.target.value)} placeholder="Scan or type digits" className="field-input flex-1" />
                <button type="button" onClick={onScanBarcode} className="scan-button"><ScanLine className="size-4" /><span>Scan</span></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label">Category</span>
                <input required list="category-options" value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="Dairy" className="field-input" />
                <datalist id="category-options">{CATEGORY_OPTIONS.map((category) => <option key={category} value={category} />)}</datalist>
              </label>
              <label className="block">
                <span className="field-label">Quantity</span>
                <input required min="0" step="1" type="number" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} placeholder="24" className="field-input" />
              </label>
            </div>
            <div>
              <span className="field-label">Expiry date</span>
              <div className="quick-date-grid" role="group" aria-label="Quick expiry date presets">
                {([ ["today", "Today"], ["3d", "+3 days"], ["7d", "+7 days"], ["custom", "Custom"] ] as [DatePreset, string][]).map(([preset, label]) => <button key={preset} type="button" onClick={() => setDatePreset(preset)} className={`quick-date-button ${selectedPreset === preset ? "quick-date-active" : ""}`}>{label}</button>)}
              </div>
              <input required type="date" value={form.expiryDate} onChange={(event) => update("expiryDate", event.target.value)} className="field-input" />
              <p className="mt-2 text-[11px] leading-5 text-[#929990]">Presets keep entry under five seconds. Choose Custom for a precise date.</p>
            </div>
            <label className="block">
              <span className="field-label">Alert threshold <span className="font-normal normal-case tracking-normal text-[#9A9D96]">(days before expiry)</span></span>
              <input required min="0" max="365" step="1" type="number" value={form.alertThreshold} onChange={(event) => update("alertThreshold", event.target.value)} className="field-input" />
            </label>
            <div className="rounded-2xl bg-[#F5F0E9] p-4 text-xs leading-5 text-[#747D76]"><strong className="text-[#17342B]">Shelfmark note:</strong> your inventory lives on this device in IndexedDB, so the tracker keeps working without a signal.</div>
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E45B45] px-4 py-3.5 font-sans text-sm font-extrabold text-white shadow-[0_10px_20px_rgba(228,91,69,0.22)] transition hover:-translate-y-0.5 hover:bg-[#D9513C] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17342B] focus-visible:ring-offset-2">{editingItem ? <Check className="size-4" /> : <Plus className="size-4" />}{editingItem ? "Save changes" : "Add item"}</button>
          </form>
        </div>
      </section>
    </div>
  );
}

function TransferSheet({ onClose, onImport, onExportJson, onExportCsv, installEvent, onInstall }: { onClose: () => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; onExportJson: () => void; onExportCsv: () => void; installEvent: InstallPromptEvent | null; onInstall: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close data tools" onClick={onClose} className="absolute inset-0 cursor-default bg-[#17342B]/35 backdrop-blur-[2px]" />
      <section role="dialog" aria-modal="true" aria-labelledby="transfer-title" className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-[#E4DDD4] bg-[#FFFDF9] px-5 pb-8 pt-6 shadow-[0_-18px_60px_rgba(23,52,43,0.18)] md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:rounded-none md:border-l md:border-t-0 md:px-8 md:pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 font-sans text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8B928A]"><Boxes className="size-3.5 text-[#477255]" /> Data tools</div>
            <h2 id="transfer-title" className="font-display text-[2rem] leading-none tracking-[-0.055em] text-[#17342B]">Take it with you.</h2>
            <p className="mt-2 text-sm leading-6 text-[#747D76]">Export a backup or bring an existing shelf into this device.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#E4DDD4] p-2.5 text-[#7F8981] transition hover:bg-[#F3EEE7] hover:text-[#17342B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E45B45]"><X className="size-4" /></button>
        </div>
        <div className="mt-7 space-y-3">
          <button type="button" onClick={onExportJson} className="transfer-action"><ArrowDownToLine className="size-4 text-[#477255]" /><span><strong>Export JSON backup</strong><small>Best for restoring the full inventory later.</small></span><ChevronRight className="ml-auto size-4 text-[#A0A69F]" /></button>
          <button type="button" onClick={onExportCsv} className="transfer-action"><FileText className="size-4 text-[#9A5B22]" /><span><strong>Export CSV sheet</strong><small>Easy to open in a spreadsheet.</small></span><ChevronRight className="ml-auto size-4 text-[#A0A69F]" /></button>
          <label className="transfer-action"><ArrowUpFromLine className="size-4 text-[#C14C39]" /><span><strong>Import JSON or CSV</strong><small>Merge items into this device's shelf.</small></span><Upload className="ml-auto size-4 text-[#A0A69F]" /><input type="file" accept=".json,.csv,application/json,text/csv" onChange={onImport} className="sr-only" /></label>
          {installEvent && <button type="button" onClick={onInstall} className="transfer-action"><Download className="size-4 text-[#17342B]" /><span><strong>Install Shelfmark</strong><small>Keep the ledger one tap away.</small></span><ChevronRight className="ml-auto size-4 text-[#A0A69F]" /></button>}
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<ItemForm>(createEmptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const refreshItems = async () => {
    const stored = await db.items.orderBy("expiryDate").toArray();
    setItems(stored);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshItems().catch(() => {
      setIsLoading(false);
      toast.error("Shelf data could not be opened on this device.");
    });
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort(), [items]);
  const expired = useMemo(() => items.filter((item) => getStatus(item) === "expired"), [items]);
  const soon = useMemo(() => items.filter((item) => getStatus(item) === "soon"), [items]);
  const safe = useMemo(() => items.filter((item) => getStatus(item) === "safe"), [items]);
  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const dueToday = useMemo(() => items.filter((item) => getDaysUntil(item.expiryDate) === 0), [items]);
  const urgentExpiring = useMemo(() => items.filter((item) => { const days = getDaysUntil(item.expiryDate); return days >= 0 && days < 3; }), [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const matchesSearch = !query || `${item.name} ${item.category} ${item.barcode ?? ""}`.toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" || getStatus(item) === statusFilter;
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.name.localeCompare(b.name));
  }, [categoryFilter, items, search, statusFilter]);

  const openNewItem = () => {
    setEditingItem(null);
    setForm(createEmptyForm());
    setIsFormOpen(true);
  };

  const handleBarcodeLookup = async (barcode: string) => {
    setForm((current) => ({ ...current, barcode }));
    setIsScannerOpen(false);

    if (!isOnline) {
      toast.success("Barcode captured.");
      return;
    }

    const toastId = toast.loading("Looking up product details...");
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        const productName = product.product_name || product.product_name_en || "";
        const category = product.categories_tags?.[0]?.replace(/en:/, "").replace(/-/g, " ") || "";
        
        if (productName) {
          setForm((current) => ({ 
            ...current, 
            name: productName,
            category: category ? category.charAt(0).toUpperCase() + category.slice(1) : current.category
          }));
          toast.success(`Found: ${productName}`, { id: toastId });
          return;
        }
      }
      toast.success("Barcode captured. (Not in global database)", { id: toastId });
    } catch (err) {
      toast.success("Barcode captured.", { id: toastId });
    }
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({ name: item.name, barcode: item.barcode ?? "", category: item.category, quantity: String(item.quantity), expiryDate: item.expiryDate, alertThreshold: String(item.alertThreshold) });
    setIsFormOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const category = form.category.trim() || "Uncategorized";
    const quantity = Number(form.quantity);
    const alertThreshold = Number(form.alertThreshold);
    if (!name || !form.expiryDate || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(alertThreshold) || alertThreshold < 0) {
      toast.error("Add a name, date, and valid non-negative numbers.");
      return;
    }

    const now = new Date().toISOString();
    const nextItem: InventoryItem = {
      id: editingItem?.id,
      name,
      barcode: form.barcode.trim() || undefined,
      category,
      quantity: Math.round(quantity),
      expiryDate: form.expiryDate,
      alertThreshold: Math.round(alertThreshold),
      createdAt: editingItem?.createdAt ?? now,
      updatedAt: now,
    };
    await db.items.put(nextItem);
    await refreshItems();
    setIsFormOpen(false);
    toast.success(editingItem ? "Shelf entry updated." : "Shelf entry added.");
  };

  useEffect(() => {
    if (soundEnabled && urgentExpiring.length > 0) playWarningBeep();
  }, [soundEnabled, urgentExpiring.length]);

  const handleSoundToggle = () => {
    if (!soundEnabled) {
      playWarningBeep();
      setSoundEnabled(true);
      toast.success(urgentExpiring.length ? "Urgent shelf alerts are on." : "Sound alerts are ready.");
    } else {
      setSoundEnabled(false);
      toast.success("Sound alerts are off.");
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!item.id || !window.confirm(`Remove ${item.name} from the shelf?`)) return;
    await db.items.delete(item.id);
    await refreshItems();
    toast.success("Shelf entry removed.");
  };

  const handleExportJson = () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 2);
    downloadFile(`shelfmark-inventory-${todayKey()}.json`, payload, "application/json");
    toast.success("JSON backup downloaded.");
  };

  const handleExportCsv = () => {
    const headers = ["name", "barcode", "category", "quantity", "expiryDate", "alertThreshold"];
    const escape = (value: string | number | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = items.map((item) => headers.map((header) => escape(item[header as keyof InventoryItem] as string | number | undefined)).join(","));
    downloadFile(`shelfmark-inventory-${todayKey()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
    toast.success("CSV sheet downloaded.");
  };

  const handleWhatsAppExport = () => {
    const expiring = items.filter((item) => {
      const days = getDaysUntil(item.expiryDate);
      return days >= 0 && days <= 7;
    }).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const lines = expiring.length
      ? expiring.map((item) => {
        const days = getDaysUntil(item.expiryDate);
        const timing = days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`;
        return `• ${item.name} — ${item.quantity} units, expires ${timing} (${formatDate(item.expiryDate, { month: "short", day: "numeric" })})`;
      })
      : ["• No items expire in the next 7 days."];
    const message = ["Shelfmark daily expiry list", "", ...lines, "", "Sent from Shelfmark · stored locally on this device"].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    toast.success("WhatsApp draft is ready.");
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".csv") ? parseCsv(text) : JSON.parse(text).items ?? JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error("Expected a list of inventory items.");
      const normalized = rows.map((row) => normalizeImportedItem(row as Record<string, unknown>)).filter((row): row is Omit<InventoryItem, "id"> => Boolean(row));
      if (!normalized.length) throw new Error("No valid inventory items found.");
      await db.items.bulkAdd(normalized);
      await refreshItems();
      setIsTransferOpen(false);
      toast.success(`${normalized.length} ${normalized.length === 1 ? "item" : "items"} imported.`);
    } catch {
      toast.error("That file could not be imported. Check the JSON or CSV columns.");
    }
  };

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") toast.success("Shelfmark is ready on your home screen.");
    setInstallEvent(null);
  };

  const loadSampleShelf = async () => {
    const now = new Date().toISOString();
    const sample: Omit<InventoryItem, "id">[] = [
      { name: "Strawberry yogurt", category: "Dairy", quantity: 18, expiryDate: dateKeyFrom(addDays(new Date(), 2)), alertThreshold: 3, createdAt: now, updatedAt: now },
      { name: "Sourdough loaf", category: "Bakery", quantity: 7, expiryDate: dateKeyFrom(addDays(new Date(), -1)), alertThreshold: 2, createdAt: now, updatedAt: now },
      { name: "Tinned tomatoes", category: "Pantry", quantity: 42, expiryDate: dateKeyFrom(addDays(new Date(), 96)), alertThreshold: 14, createdAt: now, updatedAt: now },
    ];
    await db.items.bulkAdd(sample);
    await refreshItems();
    toast.success("A small sample shelf has been added.");
  };

  const goToSummary = (filter: FilterKey = "all") => {
    setStatusFilter(filter);
    setActiveView("summary");
  };

  return (
    <div className="min-h-screen bg-[#F4EFE8] text-[#17342B] selection:bg-[#F7B3A7] selection:text-[#17342B]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.22] [background-image:radial-gradient(#AD9A86_0.65px,transparent_0.65px)] [background-size:9px_9px]" />
      <header className="sticky top-0 z-30 border-b border-[#E3DCD2]/80 bg-[#F4EFE8]/90 backdrop-blur-xl">
        <div className="container flex h-[68px] items-center justify-between gap-4">
          <AppLogo />
          <div className="hidden items-center gap-1 rounded-full border border-[#E1DAD0] bg-[#FBF8F3]/70 p-1 md:flex">
            <button type="button" onClick={() => setActiveView("dashboard")} className={`nav-pill ${activeView === "dashboard" ? "nav-pill-active" : ""}`}><Boxes className="size-3.5" /> Dashboard</button>
            <button type="button" onClick={() => setActiveView("summary")} className={`nav-pill ${activeView === "summary" ? "nav-pill-active" : ""}`}><ListFilter className="size-3.5" /> Daily summary</button>
          </div>
          <div className="flex items-center gap-2">
            <div className={`hidden items-center gap-1.5 rounded-full border px-3 py-2 font-sans text-[10px] font-extrabold uppercase tracking-[0.12em] sm:flex ${isOnline ? "border-[#CCDCCB] bg-[#EAF2E8] text-[#477255]" : "border-[#E8C5BA] bg-[#FBE5DF] text-[#B84735]"}`}>
              {isOnline ? <Wifi className="size-3" /> : <CloudOff className="size-3" />}
              {isOnline ? "Online" : "Offline"}
            </div>
            <button type="button" onClick={handleSoundToggle} className={`icon-button ${soundEnabled ? "sound-button-active" : ""}`} aria-label={soundEnabled ? "Turn sound alerts off" : "Turn sound alerts on"} aria-pressed={soundEnabled}>{soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</button>
            <button type="button" onClick={() => setIsTransferOpen(true)} className="icon-button" aria-label="Open data tools"><Settings2 className="size-4" /></button>
            <button type="button" onClick={openNewItem} className="mobile-add-button sm:hidden" aria-label="Add inventory item"><Plus className="size-4" /><span>Add</span></button>
            <button type="button" onClick={openNewItem} className="hidden items-center gap-2 rounded-full bg-[#E45B45] px-4 py-2.5 font-sans text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(228,91,69,0.18)] transition hover:-translate-y-0.5 hover:bg-[#D9513C] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17342B] focus-visible:ring-offset-2 sm:flex"><Plus className="size-3.5" /> Add item</button>
          </div>
        </div>
      </header>

      <main className="container relative z-10 pb-28 pt-5 sm:pt-8 md:pb-10">
        <aside className="desktop-rail" aria-label="Shelfmark utility rail">
          <div className="rail-label"><span>Shelf</span><small>today</small></div>
          <button type="button" onClick={() => setActiveView("dashboard")} className={`rail-button ${activeView === "dashboard" ? "rail-button-active" : ""}`} aria-label="Open dashboard"><Boxes className="size-4" /><span>Count</span></button>
          <div className="rail-rule" />
          <button type="button" onClick={() => goToSummary("soon")} className="rail-button" aria-label="Open items expiring within seven days"><CalendarClock className="size-4" /><span>{soon.length}</span></button>
          <button type="button" onClick={() => goToSummary("expired")} className="rail-button rail-button-alert" aria-label="Open expired items"><CircleAlert className="size-4" /><span>{expired.length}</span></button>
          <div className="rail-rule" />
          <button type="button" onClick={() => setIsTransferOpen(true)} className="rail-button" aria-label="Open data tools"><Settings2 className="size-4" /><span>Tools</span></button>
          <div className="rail-note"><span className="pencil-dot" /><span>offline</span><span>by design</span></div>
        </aside>
        <div className="ledger-flow">
        {activeView === "dashboard" ? (
          <>
            <section className="ledger-panel relative isolate overflow-hidden rounded-[2rem] bg-[#17342B] px-4 py-5 text-[#F8F2EA] shadow-[0_18px_45px_rgba(23,52,43,0.16)] sm:px-8 sm:py-9">
              <span className="pencil-mark absolute left-5 top-6 hidden h-24 sm:block" />
              <div className="absolute -right-20 -top-28 size-72 rounded-full bg-[#E45B45]/15 blur-3xl" />
              <div className="absolute -bottom-36 left-1/3 size-72 rounded-full bg-[#9BB995]/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-6 sm:items-center">
                <div className="max-w-xl">
                  <div className="mb-4 flex items-center gap-2 font-sans text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#B6C7B7]"><Sparkles className="size-3.5 text-[#F2A18F]" /> Tuesday, August 12 · local shelf</div>
                  <h1 className="max-w-[13ch] font-display text-[2.35rem] leading-[0.94] tracking-[-0.065em] sm:text-[3.7rem]">Keep the shelf <span className="text-[#F2A18F]">honest.</span></h1>
                  <p className="mt-3 max-w-md text-sm leading-6 text-[#D7E0D6] sm:mt-4 sm:text-[15px]">A clear view of what needs a look today, what can wait, and what is already safe in the back room.</p>
                  <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6">
                    <button type="button" onClick={openNewItem} className="flex items-center gap-2 rounded-full bg-[#F8F2EA] px-4 py-3 font-sans text-xs font-extrabold text-[#17342B] transition hover:-translate-y-0.5 hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A18F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17342B]"><Plus className="size-3.5" /> Add shelf item</button>
                    <button type="button" onClick={() => goToSummary("all")} className="flex items-center gap-2 rounded-full border border-[#648072] bg-[#284A3D]/50 px-4 py-3 font-sans text-xs font-extrabold text-[#F8F2EA] transition hover:border-[#A6C0AD] hover:bg-[#355A4B] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A18F]"><ListFilter className="size-3.5" /> Open summary</button>
                    <button type="button" onClick={handleWhatsAppExport} className="flex items-center gap-2 rounded-full border border-[#6B9881] bg-[#1B5A40]/55 px-4 py-3 font-sans text-xs font-extrabold text-[#D9F0DF] transition hover:border-[#B5D4BD] hover:bg-[#287451] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A18F]"><MessageCircle className="size-3.5" /> Send expiring list</button>
                  </div>
                  <div className="hero-status-grid" aria-label="Shelf status at a glance">
                    <button type="button" onClick={() => goToSummary("expired")} className="hero-status hero-status-tomato"><span>Expired</span><strong>{expired.length}</strong><small>needs action</small></button>
                    <button type="button" onClick={() => goToSummary("soon")} className="hero-status hero-status-amber"><span>Next 7 days</span><strong>{soon.length}</strong><small>keep an eye</small></button>
                    <button type="button" onClick={() => goToSummary("safe")} className="hero-status hero-status-olive"><span>Safe stock</span><strong>{safe.length}</strong><small>looks good</small></button>
                  </div>
                </div>
                <div className="hidden w-[37%] max-w-[360px] shrink-0 sm:block">
                  <img src={DASHBOARD_ART} alt="Illustration of a tidy grocery stockroom shelf" className="w-full mix-blend-screen opacity-90" />
                </div>
              </div>
            </section>

            <section className="ledger-panel mt-5 grid grid-cols-2 gap-4 rounded-[1.7rem] border border-[#E1DAD0] bg-[#FBF8F3]/80 p-5 shadow-[0_8px_24px_rgba(23,52,43,0.04)] sm:grid-cols-4 sm:gap-0">
              <Metric label="Items tracked" value={items.length} detail={`${categories.length || 0} categories`} />
              <Metric label="Units on hand" value={totalUnits} detail="Across this device" />
              <Metric label="Needs a look" value={expired.length + soon.length} detail={`${dueToday.length} due today`} tone="tomato" />
              <Metric label="Safe stock" value={safe.length} detail="Beyond 7 days" tone="olive" />
            </section>

            <div className="mt-8 flex items-end justify-between gap-4 px-1">
              <div>
                <div className="section-kicker">Shelf status</div>
                <h2 className="mt-1 font-display text-[2rem] leading-none tracking-[-0.055em] text-[#17342B]">The next right move.</h2>
              </div>
              <button type="button" onClick={() => goToSummary("all")} className="hidden items-center gap-1 text-xs font-extrabold text-[#6F7B72] underline decoration-[#CFC5B8] underline-offset-4 transition hover:text-[#17342B] sm:flex">View daily summary <ChevronRight className="size-3.5" /></button>
            </div>

            {isLoading ? <div className="mt-5 grid gap-5 lg:grid-cols-3"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div> : items.length === 0 ? (
              <section className="ledger-panel relative mt-5 flex flex-col items-center overflow-hidden rounded-[1.8rem] border border-dashed border-[#D9D0C5] bg-[#FBF8F3] px-5 py-10 text-center sm:flex-row sm:gap-10 sm:px-10 sm:text-left">
                <span className="pencil-mark absolute left-0 top-8 h-16" />
                <img src={EMPTY_ART} alt="Illustration of an open produce crate with a calendar slip" className="mb-5 w-36 sm:mb-0 sm:w-44" />
                <div className="max-w-md">
                  <div className="section-kicker">Your first shelf</div>
                  <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.055em] text-[#17342B]">Start with what is in front of you.</h2>
                  <p className="mt-3 text-sm leading-6 text-[#747D76]">Add a few products and Shelfmark will sort the rest into clear, daily actions. Everything stays on this device.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2.5 sm:justify-start"><button type="button" onClick={openNewItem} className="button-primary"><Plus className="size-3.5" /> Add first item</button><button type="button" onClick={loadSampleShelf} className="button-secondary"><Sparkles className="size-3.5" /> Load sample shelf</button></div>
                </div>
              </section>
            ) : (
              <div className="mt-5 grid gap-6 lg:grid-cols-3">
                <StatusColumn status="expired" items={expired} onEdit={openEditItem} onDelete={handleDelete} onSeeAll={() => goToSummary("expired")} />
                <StatusColumn status="soon" items={soon} onEdit={openEditItem} onDelete={handleDelete} onSeeAll={() => goToSummary("soon")} />
                <StatusColumn status="safe" items={safe} onEdit={openEditItem} onDelete={handleDelete} onSeeAll={() => goToSummary("safe")} />
              </div>
            )}
          </>
        ) : (
          <>
            <section className="ledger-panel relative overflow-hidden rounded-[2rem] border border-[#E1DAD0] bg-[#FBF8F3] px-5 py-6 shadow-[0_10px_30px_rgba(23,52,43,0.05)] sm:px-8 sm:py-8">
              <div className="relative z-10 max-w-xl">
                <div className="section-kicker">Daily summary · {formatDate(todayKey(), { weekday: "long", month: "long", day: "numeric" })}</div>
                <h1 className="mt-2 font-display text-[2.8rem] leading-[0.94] tracking-[-0.065em] text-[#17342B] sm:text-[3.8rem]">A quieter way to count.</h1>
                <p className="mt-4 max-w-md text-sm leading-6 text-[#747D76]">Search the whole shelf, narrow it by status or category, then make the one update that keeps today moving.</p>
                <div className="mt-5 flex flex-wrap gap-2" aria-label="Daily summary status totals">
                  <button type="button" onClick={() => setStatusFilter("expired")} className="summary-chip summary-chip-tomato"><CircleAlert className="size-3.5" /> {expired.length} expired</button>
                  <button type="button" onClick={() => setStatusFilter("soon")} className="summary-chip summary-chip-amber"><Clock3 className="size-3.5" /> {soon.length} due soon</button>
                  <button type="button" onClick={() => setStatusFilter("safe")} className="summary-chip summary-chip-olive"><Check className="size-3.5" /> {safe.length} safe</button>
                  <button type="button" onClick={handleWhatsAppExport} className="summary-chip summary-chip-whatsapp"><MessageCircle className="size-3.5" /> Send daily list</button>
                </div>
              </div>
              <img src={SUMMARY_ART} alt="Illustration of a paper planner and pantry tins" className="absolute -bottom-5 -right-2 hidden w-64 opacity-90 sm:block lg:w-80" />
            </section>

            <section className="ledger-panel mt-5 rounded-[1.7rem] border border-[#E1DAD0] bg-[#FBF8F3]/90 p-4 shadow-[0_8px_24px_rgba(23,52,43,0.04)] sm:p-5">
              <div className="summary-filters grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_170px_170px]">
                <div className="filter-control"><span className="filter-icon"><Search className="size-3.5" /></span><input aria-label="Search item or category" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item or category" className="field-input !pl-10 !pr-10" />{search && <button type="button" onClick={() => setSearch("")} className="filter-clear" aria-label="Clear search"><X className="size-3.5" /></button>}</div>
                <label className="filter-control"><span className="filter-icon"><Filter className="size-3.5" /></span><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterKey)} className="field-input appearance-none !pl-10 !pr-9">{Object.entries(statusFilterLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown className="filter-arrow size-3.5" /></label>
                <label className="filter-control"><span className="filter-icon"><Package className="size-3.5" /></span><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="field-input appearance-none !pl-10 !pr-9"><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><ChevronDown className="filter-arrow size-3.5" /></label>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E8E1D8] pt-4"><div className="flex items-center gap-2 text-xs text-[#7D857E]"><span className="flex size-7 items-center justify-center rounded-full bg-[#E4EEE2] text-[#477255]"><Check className="size-3.5" /></span><span><strong className="text-[#17342B]">{filteredItems.length}</strong> {filteredItems.length === 1 ? "entry" : "entries"} showing</span></div><button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); }} className="text-xs font-extrabold text-[#7D857E] underline decoration-[#D4C9BC] underline-offset-4 hover:text-[#17342B]">Reset filters</button></div>
            </section>

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-4 px-1"><div><div className="section-kicker">Inventory ledger</div><h2 className="mt-1 font-display text-[2rem] leading-none tracking-[-0.055em] text-[#17342B]">Every item, in order.</h2></div><button type="button" onClick={openNewItem} className="button-primary"><Plus className="size-3.5" /><span className="hidden sm:inline">Add item</span><span className="sm:hidden">Add</span></button></div>
              {filteredItems.length > 0 ? <div className="space-y-3">{filteredItems.map((item) => <InventoryCard key={item.id} item={item} onEdit={openEditItem} onDelete={handleDelete} />)}</div> : <div className="rounded-[1.7rem] border border-dashed border-[#D9D0C5] bg-[#FBF8F3] px-5 py-12 text-center"><Search className="mx-auto size-7 text-[#B4A99D]" /><h3 className="mt-3 font-display text-2xl tracking-[-0.04em] text-[#17342B]">No entries match.</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8C938C]">Try a different search or reset the filters to see the whole shelf again.</p></div>}
            </section>
          </>
        )}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DED7CE] bg-[#FBF8F3]/95 px-4 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_28px_rgba(23,52,43,0.08)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3 items-end gap-2">
          <button type="button" onClick={() => setActiveView("dashboard")} className={`mobile-nav-item ${activeView === "dashboard" ? "mobile-nav-active" : ""}`}><Boxes className="size-5" /><span>Dashboard</span></button>
          <button type="button" onClick={openNewItem} className="relative -top-5 flex size-14 items-center justify-center justify-self-center rounded-full bg-[#E45B45] text-white shadow-[0_10px_22px_rgba(228,91,69,0.32)] transition hover:-translate-y-1 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17342B] focus-visible:ring-offset-2"><Plus className="size-6" /></button>
          <button type="button" onClick={() => setActiveView("summary")} className={`mobile-nav-item ${activeView === "summary" ? "mobile-nav-active" : ""}`}><ListFilter className="size-5" /><span>Summary</span></button>
        </div>
      </nav>

      {isFormOpen && <ItemSheet editingItem={editingItem} form={form} setForm={setForm} onClose={() => { setIsFormOpen(false); setIsScannerOpen(false); }} onSubmit={handleSubmit} onScanBarcode={() => setIsScannerOpen(true)} />}
      {isScannerOpen && <BarcodeScanner onClose={() => setIsScannerOpen(false)} onDetected={handleBarcodeLookup} />}
      {isTransferOpen && <TransferSheet onClose={() => setIsTransferOpen(false)} onImport={handleImport} onExportJson={handleExportJson} onExportCsv={handleExportCsv} installEvent={installEvent} onInstall={handleInstall} />}
      <div className="fixed bottom-3 left-3 z-20 hidden items-center gap-2 rounded-full border border-[#E0D9D0] bg-[#FBF8F3]/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#889087] shadow-sm backdrop-blur sm:flex"><span className={`size-1.5 rounded-full ${isOnline ? "bg-[#6E9B78]" : "bg-[#E45B45]"}`} /> {isOnline ? "Saved on this device" : "Offline · changes stay local"}</div>
    </div>
  );
}
