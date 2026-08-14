# Shelfmark — Design Direction

## Three stylistic approaches

### Theme Name: Paper Ledger
Very Brief Intro: A tactile editorial stockroom tool that feels like a beautifully kept shop ledger: warm paper, ink, red-pencil alerts, and practical information hierarchy.
Probability: 0.08

### Theme Name: Signal Pantry
Very Brief Intro: A quiet, high-contrast operations dashboard with deep navy surfaces, sharp coral status signals, and compact data density for busy retail teams.
Probability: 0.04

### Theme Name: Garden Shelf
Very Brief Intro: A soft botanical inventory companion with rounded cards, leafy illustrations, and a calm green palette that makes expiry work feel approachable.
Probability: 0.06

## Chosen approach: Paper Ledger

### Design Movement
Contemporary editorial modernism with references to independent grocer ephemera, archival paper goods, and practical Swiss information design.

### Core Principles
1. **Make the important date unmistakable.** Expiry state uses a compact three-color signal system and plain-language labels.
2. **Pair utility with tactility.** Cards behave like clipped ledger notes: generous paper space, fine rules, quiet grain, and slight offset details.
3. **Keep the shop in view.** Category chips, quantity, and a daily summary stay visible without turning the mobile screen into a spreadsheet.
4. **Design for one-handed rhythm.** The primary action is always within thumb reach, with stacked mobile sections before any desktop expansion.

### Color Philosophy
Warm parchment keeps the interface human and low-glare. Deep ink navy carries the brand and gives text authority. Olive is reserved for safe stock and calmer confirmations, while tomato red is used only when a date needs attention. The palette should feel like a storekeeper's notes, not a medical or finance app.

### Layout Paradigm
Use a **split-ledger composition**: a narrow, sticky utility rail on wide screens and a bottom action dock on mobile; content flows as offset editorial blocks rather than one centered grid. The dashboard starts with a wide date-and-status band, then falls into three responsive ledger columns.

### Signature Elements
- A tomato-red vertical “pencil mark” on urgent cards.
- Small uppercase section labels with generous tracking, like archival cataloguing.
- Subtle paper-grain texture and offset card shadows that suggest layered stock cards.

### Interaction Philosophy
Interactions should feel like handling a well-made paper tool: press states are tactile, focus rings are clear, destructive actions are explicit, and successful saves surface a short, human confirmation. Filters should update immediately without page changes.

### Animation
Use short 160–220ms ease-out transitions for controls, a gentle 30ms stagger for card entrances, and a 180ms slide/fade for the item sheet. Do not animate layout dimensions. Respect `prefers-reduced-motion` and keep keyboard actions instant.

### Typography System
Display: **DM Serif Display** for the product name and high-level dashboard greeting. Body: **Manrope** for controls, labels, item names, and numbers. Use compact uppercase Manrope at 11px with 0.14em tracking for metadata. Headlines should feel literary; operational text should stay crisp.

### Brand Essence
Shelfmark is a pocket stockroom ledger for independent retailers who need expiry clarity without a heavyweight system. Personality: **observant, grounded, quietly exact**.

### Brand Voice
Headlines are direct but warm. CTAs sound like a shopkeeper helping the next task along, never like enterprise software. Microcopy tells the user what changed and why.

Example lines:
- “Keep the shelf honest.”
- “Nothing urgent today. Good work.”

### Wordmark & Logo
The mark is a compact shelf bracket holding a small leaf and check stroke. It should appear as a standalone symbol in the app header and favicon; the Shelfmark wordmark pairs a high-contrast serif “Shelf” with a measured sans “mark.”

### Signature Brand Color
**Tomato pencil — `#E45B45`**. It is warm enough to feel human and vivid enough to make an expiry alert immediately legible.

## Style Decisions

- Treat warm paper as the primary canvas; do not introduce purple or electric gradients.
- Use generated illustrations only as supportive editorial moments, never as a substitute for readable inventory data.
- Keep urgent states unmistakable with tomato pencil, while allowing safe stock to remain calm and olive-led.
- Desktop composition reads as a ledger spread with a narrow utility rail and offset content blocks.
- Inventory surfaces feel like layered stock cards using warm paper, fine ruled borders, subtle grain, offset shadows, and clipped-note details.
- Tomato pencil `#E45B45` is used primarily for urgency, annotations, and primary action emphasis.
