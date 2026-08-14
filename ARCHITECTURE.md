# Shelfmark — System Architecture

> A visual breakdown of how Shelfmark is designed, how data flows through the system, and how the key features are wired together.

---

## 1. High-Level Architecture Overview

Shelfmark is an **offline-first Single-Page Application (SPA)**. There is no traditional backend database. All user data lives on the device inside the browser's `IndexedDB`. The Express server exists solely to serve the compiled static files.

```mermaid
graph TB
    subgraph "User's Device (Browser)"
        direction TB
        UI["⚛️ React UI\n(Home.tsx)"]
        STATE["🔄 React State\nuseState / useMemo"]
        DB[("🗄️ IndexedDB\n(via Dexie.js)")]
        SPEECH["🎙️ Web Speech API\n(Browser Native)"]
        CAMERA["📷 Camera\n(html5-qrcode)"]
        PWA["📲 PWA Manifest\n(installable)"]
    end

    subgraph "Express Server"
        SERVER["🟢 Node.js\nExpress (static serving)"]
        DIST["📁 dist/public/\n(compiled React app)"]
    end

    subgraph "External Services (Zero Cost)"
        WHATSAPP["💬 WhatsApp\n(wa.me deep link)"]
        FONTS["🔤 Google Fonts\n(DM Serif + Manrope)"]
        VERCEL["☁️ Vercel CDN\n(hosting)"]
    end

    USER["👤 Retail Worker"] --> UI
    UI <--> STATE
    STATE <--> DB
    SPEECH --> UI
    CAMERA --> UI
    SERVER --> DIST
    DIST --> UI
    UI --> WHATSAPP
    UI --> FONTS
    VERCEL --> SERVER
```

---

## 2. Data Flow Architecture

This diagram shows the complete lifecycle of data — from user input to storage and back to the screen.

```mermaid
flowchart LR
    subgraph INPUT["Data Entry Methods"]
        MANUAL["⌨️ Manual Form\nTyped input"]
        VOICE["🎙️ Voice Command\nEn / Si / Ta"]
        SCAN["📷 Barcode Scan\nCamera"]
        IMPORT["📂 JSON/CSV Import\nFile upload"]
    end

    subgraph PROCESS["Processing Layer (React)"]
        PARSE["🔍 parseVoiceCommand()\nNLP extraction"]
        VALIDATE["✅ Form Validation\nname, date, qty > 0"]
        NORMALIZE["🔧 normalizeImportedItem()\nData sanitization"]
    end

    subgraph STORAGE["Storage Layer"]
        DEXIE["📦 Dexie.js ORM"]
        IDB[("🗄️ IndexedDB\nshelfmark-inventory")]
        SCHEMA["📋 Schema v2\n++id, name, barcode,\ncategory, expiryDate,\nalertThreshold, updatedAt"]
    end

    subgraph OUTPUT["Output / Display"]
        FILTER["🔍 Filter & Search\nuseMemo derived state"]
        CARDS["📇 Inventory Cards\nExpired / Soon / Safe"]
        EXPORT_W["💬 WhatsApp\nExpiry list message"]
        EXPORT_F["📁 JSON / CSV\nDownload backup"]
    end

    MANUAL --> VALIDATE
    VOICE --> PARSE --> VALIDATE
    SCAN --> VALIDATE
    IMPORT --> NORMALIZE --> DEXIE

    VALIDATE --> DEXIE
    DEXIE <--> IDB
    IDB -.->|"schema defined"| SCHEMA
    IDB -->|"orderBy expiryDate"| FILTER
    FILTER --> CARDS
    FILTER --> EXPORT_W
    FILTER --> EXPORT_F
```

---

## 3. Component Architecture

The entire UI is contained within a single file (`Home.tsx`) using a **composition** pattern with clearly separated sub-components.

```mermaid
graph TD
    subgraph "Home.tsx — Main Orchestrator"
        HOME["🏠 Home()\nAll state lives here:\nitems, form, filters, views,\nsoundEnabled, installEvent"]
    end

    subgraph "Pure Display Components"
        LOGO["AppLogo\nBrand identity"]
        METRIC["Metric\nStat block with tone"]
        BADGE["StatusBadge\nExpired / Soon / Safe chip"]
        CARD["InventoryCard\nSingle item row"]
        COLUMN["StatusColumn\nGrouped list by status"]
    end

    subgraph "Modal / Sheet Components"
        ITEMSHEET["ItemSheet\nAdd/Edit form +\n🎙️ Voice Entry panel"]
        SCANNER["BarcodeScanner\nCamera overlay"]
        TRANSFER["TransferSheet\nImport / Export / Install"]
    end

    subgraph "Views (conditional render)"
        DASH["Dashboard View\nHero + Metrics + Status Columns"]
        SUMMARY["Summary View\nSearch + Filters + Full Ledger"]
    end

    HOME --> LOGO
    HOME --> DASH
    HOME --> SUMMARY
    HOME --> ITEMSHEET
    HOME --> SCANNER
    HOME --> TRANSFER
    DASH --> METRIC
    DASH --> COLUMN
    COLUMN --> CARD
    CARD --> BADGE
    SUMMARY --> CARD
```

---

## 4. Voice Command System

The voice feature uses a pipeline from raw audio → text → structured data.

```mermaid
sequenceDiagram
    actor User
    participant UI as "Speak Button (UI)"
    participant SR as "SpeechRecognition\n(Browser API)"
    participant NLP as "parseVoiceCommandMultiLang()"
    participant FORM as "Form State"

    User->>UI: Selects language (En/Si/Ta)\nClicks "Speak"
    UI->>SR: recognition.start()
    SR-->>UI: onstart → isListening = true (pulse animation)
    User->>SR: Speaks: "Add 24 milks tomorrow"
    SR-->>NLP: onresult → transcript string
    Note over NLP: 1. Extract digits → quantity = "24"<br/>2. Match "tomorrow" / "හෙට" / "நாளை" → daysToAdd = 1<br/>3. Strip trigger words → name = "Milks"<br/>4. Calculate expiryDate = today + 1 day
    NLP-->>FORM: { name: "Milks", quantity: "24", expiryDate: "2026-08-15" }
    FORM-->>UI: Fields auto-populated
    UI-->>User: Toast: "Voice applied: Add 24 milks tomorrow"
```

---

## 5. Status Classification Engine

Every item is classified in real-time using a pure function — no background jobs needed.

```mermaid
flowchart TD
    ITEM["InventoryItem\n{ expiryDate: 'YYYY-MM-DD' }"]
    CALC["getDaysUntil(expiryDate)\n= floor((expiry - today) / 86400000)"]
    
    ITEM --> CALC
    
    CALC -->|"days < 0"| EXPIRED["🔴 EXPIRED\nNeeds immediate action\nRed pencil mark on card"]
    CALC -->|"0 ≤ days ≤ 7"| SOON["🟡 EXPIRING SOON\nWithin 7 days\nAmber alert chip"]
    CALC -->|"days > 7"| SAFE["🟢 SAFE STOCK\nBeyond 7 days\nOlive badge"]
    
    EXPIRED --> ALERT["🔔 Sound beep\n(if soundEnabled)\nurgent-card CSS class\nShown in WhatsApp export"]
    SOON --> WHATSAPP["💬 Included in\nWhatsApp export list"]
```

---

## 6. Deployment Pipeline

```mermaid
flowchart LR
    subgraph "Development"
        CODE["📝 Code\n(React + TypeScript)"]
        DEV["🔥 pnpm run dev\nVite HMR on :3000"]
    end

    subgraph "Build"
        BUILD["⚙️ pnpm run build"]
        VITE_OUT["📁 dist/public/\n(React SPA bundle)"]
        ESB_OUT["📄 dist/index.js\n(Express server)"]
    end

    subgraph "GitHub"
        REPO["🐙 GitHub Repo\nTechSavi69/expiery-stock-tracker-shelfmark"]
        PUSH["git push origin main"]
    end

    subgraph "Vercel"
        VCFG["vercel.json\nbuildCommand: pnpm run build\noutputDirectory: dist/public\nrewrites: /* → index.html"]
        CDN["🌍 Global CDN\nhttps://your-app.vercel.app"]
    end

    CODE --> DEV
    CODE --> PUSH --> REPO
    REPO -->|"Auto-deploy on push"| BUILD
    BUILD --> VITE_OUT & ESB_OUT
    VCFG --> CDN
    VITE_OUT --> CDN
```

---

## 7. IndexedDB Schema

```mermaid
erDiagram
    INVENTORY_ITEM {
        number id PK "Auto-increment"
        string name "Required. Product name"
        string barcode "Optional. Scanned or typed"
        string category "Dairy, Produce, Bakery..."
        number quantity "Units on hand (integer ≥ 0)"
        string expiryDate "ISO format: YYYY-MM-DD"
        number alertThreshold "Days before expiry to alert"
        string createdAt "ISO 8601 timestamp"
        string updatedAt "ISO 8601 timestamp"
    }
```

**Indexes defined:** `id` (PK), `name`, `barcode`, `category`, `expiryDate`, `updatedAt`

---

## 8. Technology Decisions

| Decision | Choice | Reason |
|---|---|---|
| **Storage** | IndexedDB (Dexie.js) | Offline-first, no server costs, data stays on device |
| **Voice** | Web Speech API | Free, browser-native, no API keys needed |
| **Barcode** | html5-qrcode | Camera-based, works on any HTTPS page |
| **Routing** | Wouter | Tiny alternative to React Router (1.3kb) |
| **Styling** | Tailwind CSS v4 + Custom CSS | Utility-first speed + bespoke "Paper Ledger" tokens |
| **State** | React useState/useMemo | No Redux needed — all state is local and derived |
| **Notifications** | Sonner | Elegant toast library with minimal footprint |
| **Hosting** | Vercel | Zero-config deployment, global CDN, free tier |
