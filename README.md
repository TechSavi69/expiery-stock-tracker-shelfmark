# Shelfmark — Expiry & Stock Tracker

> **An elegant, offline-first expiry and stock tracker designed for independent retail teams.**  
> Keep your stockroom organized, your shelves honest, and your team informed — entirely on-device.

![Shelfmark Dashboard](./client/public/dashboard_illustration.png)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📦 **Inventory Ledger** | Add, edit, and delete stock items with name, category, quantity, and barcode |
| 📅 **Expiry Tracking** | Items auto-categorized as Expired / Expiring Soon / Safe Stock |
| 🎙️ **Voice Entry** | Speak to auto-fill the form — supports **English, Sinhala, and Tamil** |
| 📷 **Barcode Scanner** | Scan barcodes using the device camera via `html5-qrcode` |
| 💬 **WhatsApp Export** | One-tap to send today's expiring items list to any WhatsApp contact or group |
| 📁 **JSON / CSV Export** | Full inventory backup — downloadable and re-importable |
| 📲 **PWA / Installable** | Works as a home screen app on Android and iOS |
| 🔔 **Sound Alerts** | Optional audio beep when urgent items are detected |
| 🌐 **Offline-First** | All data stored locally in IndexedDB — zero backend required |
| 🔍 **Search & Filter** | Filter by status, category, or free-text search |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v10+ (`npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/TechSavi69/expiery-stock-tracker-shelfmark.git
cd expiery-stock-tracker-shelfmark

# Install dependencies
pnpm install

# Start the development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗂️ Project Structure

```
expiry-stock-tracker/
├── client/                    # Frontend (React + Vite)
│   ├── public/                # Static assets (logo, illustrations, manifest)
│   │   ├── shelfmark_logo.png
│   │   ├── dashboard_illustration.png
│   │   ├── summary_illustration.png
│   │   ├── empty_state_illustration.png
│   │   └── manifest.json      # PWA manifest
│   ├── src/
│   │   ├── lib/
│   │   │   └── db.ts          # Dexie.js IndexedDB schema
│   │   ├── pages/
│   │   │   └── Home.tsx       # Main application (all views)
│   │   ├── App.tsx            # Root component with router
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Design system (Paper Ledger tokens)
│   └── index.html             # HTML entry + SEO meta tags
├── server/
│   └── index.ts               # Minimal Express server (static file serving)
├── shared/
│   └── const.ts               # Shared constants
├── vercel.json                # Vercel deployment configuration
├── vite.config.ts             # Vite build configuration
├── tsconfig.json              # TypeScript configuration
└── package.json
```

---

## 🎙️ Voice Entry — How to Use

The Voice Entry feature uses the **browser's built-in Web Speech API** — completely free, no external APIs required.

1. Click **"Add item"** to open the form
2. At the top of the form, select your language: **English / Sinhala / Tamil**
3. Click **"Speak"** and say something like:
   - 🇬🇧 English: *"Add 24 milks expiring tomorrow"*
   - 🇱🇰 Sinhala: *"කිරි 24 හෙට කල් ඉකුත් වන"*
   - 🇱🇰 Tamil: *"24 பால் நாளை காலாவதியாகும்"*
4. The **Item name**, **Quantity**, and **Expiry date** fields will auto-fill!

> ⚠️ Voice Entry requires a browser with Web Speech API support (Chrome, Edge, Safari).

---

## 📲 PWA Installation

Shelfmark can be installed as a native-like app on any device:

- **Android (Chrome):** Tap the **"Install"** prompt in the browser or use the menu → "Add to Home Screen"
- **iOS (Safari):** Tap the Share button → "Add to Home Screen"
- **Desktop:** Click the install icon in the Chrome address bar

---

## 📤 WhatsApp Export

Tap **"Send expiring list"** on the dashboard to generate a pre-formatted message of all items expiring within the next 7 days. WhatsApp will open with the message ready to send to any contact or group — no backend or SMS fees required.

---

## 🏗️ Build for Production

```bash
pnpm run build
```

This compiles the React app into `dist/public/` and bundles the Express server into `dist/index.js`.

---

## ☁️ Deployment

### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Or connect your GitHub repository directly in the [Vercel Dashboard](https://vercel.com/dashboard) — Vercel will auto-detect the configuration from `vercel.json`.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Styling** | Tailwind CSS v4, Custom CSS Design System |
| **Database** | Dexie.js (IndexedDB wrapper) |
| **Routing** | Wouter |
| **Icons** | Lucide React |
| **Notifications** | Sonner |
| **Barcode Scanning** | html5-qrcode |
| **Voice Input** | Web Speech API (browser native) |
| **PWA** | Web App Manifest + Service Worker ready |
| **Server** | Express.js (static file serving only) |

---

## 📄 License

MIT © Shelfmark

---

> *"A clear shelf is a good shelf."*
