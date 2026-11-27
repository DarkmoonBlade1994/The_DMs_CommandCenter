# DM Hub — D&D 5e Command Center

A **local-first, offline-capable, zero-backend** D&D 5e Dungeon Master web application built with modular HTML, CSS, and vanilla JavaScript. Runs directly from GitHub Pages, locally from `index.html` with no server, or installed as an offline app on laptops and tablets.

**Open DM Hub:** https://darkmoonblade1994.github.io/The_DMs_CommandCenter/

---

## Install Guide (Offline-Ready)

### Laptops — Windows & macOS

#### Option A: Install as a Desktop App (Recommended — Works Offline)
- **Windows & macOS (Google Chrome or Microsoft Edge):**
  1. Open DM Hub at https://darkmoonblade1994.github.io/The_DMs_CommandCenter/.
  2. Click the **Install** icon (monitor/plus icon) on the right side of the address bar—or open the browser menu (`⋮` / `⋯`) and select **Install DM Hub** (Edge: **Apps → Install this site as an app**).
  3. Launch **DM Hub** anytime from your **Start Menu / Desktop** (Windows) or **Applications / Launchpad** (macOS), even without internet.
  4. *Bonus on Chrome/Edge:* Open **Settings → Layer 2: External File Backup → Link Backup Folder** to pick a folder on your laptop for automatic 4-file rotating backups (`dm-hub-backup-1.json` through `dm-hub-backup-4.json`).
- **macOS (Safari — macOS Sonoma or newer):**
  1. Open the DM Hub URL in **Safari**.
  2. In the menu bar, click **File → Add to Dock…** and click **Add**.
  3. Launch **DM Hub** offline directly from your Mac Dock.

#### Option B: Run Locally Without Internet
1. Download the repository ZIP (**Code → Download ZIP**) and unzip the folder anywhere on your laptop.
2. Double-click **`index.html`** to open it directly in Chrome, Edge, Safari, or Firefox—no install, no build step, and no local server required.

---

### Tablets — Windows & iPad (Apple)

#### Windows Tablets (Surface, 2-in-1s, etc.)
1. Open the DM Hub URL in **Microsoft Edge** or **Google Chrome**.
2. Tap the **Install** icon in the address bar (or `⋯` → **Apps → Install this site as an app** in Edge / `⋮` → **Install DM Hub** in Chrome).
3. Pin **DM Hub** to your Start Menu or Taskbar—it opens in a clean full-screen window, works offline, supports touch-friendly `44×44px` controls, and supports local 4-file rotating folder backups.

#### iPad & iPhone (iPadOS / iOS — Apple Tablets)
1. Open the DM Hub URL in **Safari** *(must be Safari for Home Screen offline install on iPadOS/iOS)*.
2. Tap the **Share** button (square with upward arrow in the top bar on iPad, bottom bar on iPhone).
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.
4. Open **DM Hub** from your Home Screen icon. It runs full-screen and **100% offline** via Service Worker caching, saves automatically to `localStorage`, and keeps **4 rolling snapshots** in IndexedDB.
5. For extra off-device backups (or syncing to your laptop), tap **Settings → Export Backup (.json)** to save to **Files / iCloud Drive**, and **Import Backup (.json)** to restore on any device.

---

## Moving Campaigns Between Laptop & Tablet

Because DM Hub is 100% local-first (no accounts or cloud servers):
1. On your current device, open **Settings → Layer 2: External File Backup → Export Backup (.json)**.
2. Send or save that `.json` file via AirDrop, iCloud Drive, OneDrive, Google Drive, or email.
3. On your other device, open **Settings → Import Backup (.json)** and select the file to restore your encounters, party, bestiary, notes, and settings.

---

## Core Features

- **3-Column Command Center:** Battlefield Overview (color-coded Healthy/Bloodied/Critical/Down bars), Initiative Rolodex (active turn pinned to top + **Clustered Enemy Initiative with Solo/Boss exceptions**) & Freeform Mode, plus Smart Attack & Split-Damage Resolver with a `− / +` **Dice Tray**.
- **Fast Tabletop Combat:** **`+ Add Enemy`** multi-monster batch roster builder (Bestiary + Custom stat blocks), **`⚔ Attack`** Quick Attack popup directly on every enemy card (Target auto-AC, attack count, Advantage/Disadvantage, bonus mod, *Shield* overrides, split damage, and 1-click Apply Damage), **`Clear Encounter`** (Keep Party or Clear All without ending the session), fast HP math (`− Dmg`, `+ Heal`, Temp HP), 5e Conditions with rules tooltips, and Concentration Save DC toasts with 1-click `Roll CON Save`.
- **Prep, Notes & House Rules:** Full Add/Edit/Remove Party Roster and Local Bestiary, Prepared Encounters, Emergency Scratchpad, offline NPC & 7-category Establishment Generator, all 4 5e Critical Hit rules, **Mordor: Dark Lord** (Dark) & **Fantasy Adventure** (Light) themes, and explicit **Save Settings** confirmation.
