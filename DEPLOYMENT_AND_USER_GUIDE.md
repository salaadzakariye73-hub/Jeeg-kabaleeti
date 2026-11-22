# MSh Company — Jeeg iyo Kabaleeti Management System
## Deployment, Configuration, and Bilingual User Guide

---

## 1. Architecture Summary

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, `vite-plugin-pwa`, IndexedDB (`idb`), `jspdf` + `jspdf-autotable`
- **Backend**: Node.js, Express.js, JWT + `bcryptjs` authentication, Role-Based Access Control (`MANAGER` vs `ADMIN`), Rate Limiting, Audit Logging, Scheduled Automated Backups
- **Database**: MongoDB Atlas via Mongoose (`server/models/mongooseModels.ts`) when `MONGODB_URI` is configured, with automatic local persistent disk storage fallback (`.data/msh_database.json`) in zero-config development environments.

---

## 2. Production Deployment Guide

### A. MongoDB Atlas Setup
1. Create a free or dedicated cluster in [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a database user with `readWrite` permission on the `msh_rental` database.
3. Configure Network Access (whitelist your Render outbound IPs or `0.0.0.0/0` with strong credentials).
4. Copy your SRV connection string:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/msh_rental?retryWrites=true&w=majority`

### B. Render Backend Deployment
1. Push this repository to GitHub.
2. Create a new **Web Service** on Render connected to the GitHub repository.
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. Set Environment Variables in Render (never commit secrets):
   - `NODE_ENV=production`
   - `PORT=3000`
   - `MONGODB_URI=<your MongoDB Atlas URI>`
   - `JWT_SECRET=<generate a random 64-character secret>`
   - `CORS_ORIGIN=<your Cloudflare Pages URL if hosting frontend separately>`

### C. Cloudflare Pages (Optional Separate Static Frontend Host)
If hosting the frontend separately from Render:
1. Build Command: `npm run build`
2. Build Output Directory: `dist`
3. Environment Variable:
   - `VITE_API_BASE_URL=https://<your-render-backend>.onrender.com`
*(When serving both frontend and backend from the same Render service, leave `VITE_API_BASE_URL` empty.)*

---

## 3. PWA Installation Guide (Android, Desktop, iOS)

1. **Android (Chrome / Edge)**:
   - Open the application URL.
   - Tap **"Ku Rakib Telefoonka / Install App"** in the header or drawer, or open the Chrome menu (`⋮`) → **Install app / Add to Home screen**.
2. **Desktop (Chrome / Edge)**:
   - Click the install icon in the address bar or click **Install App** in the top header.
3. **iPhone / iPad (Safari)**:
   - Tap the **Share** button (`□↑`) in Safari and choose **Add to Home Screen**.

### Honest Browser & Offline Sync Limitations
- Offline transactions created by an **Admin** (Rentals, Returns, Payments, Expenses) are stored in IndexedDB with unique `clientTransactionId` keys and preserved across browser restarts.
- **Limitation**: On iOS Safari and certain mobile browsers, the OS does not wake a closed PWA for silent background sync (`BackgroundSync` API is unsupported on WebKit). Therefore, queued records automatically synchronize as soon as the user reopens the app with an active internet connection or taps **Sync Now** in the Offline Sync Center.
- **Manager accounts remain strictly read-only offline** and cannot enqueue offline business mutations.

---

## 4. User Guide — Af-Soomaali

### Bilowga Koowaad (Maamulaha / Manager)
1. Marka ugu horreysa ee nidaamka la furo, bogga **Diyaarinta Koowaad ee Maamulaha** ayaa soo baxa. Geli Magacaaga, Emaylka, iyo Erayga Sirta ah (ugu yaraan 8 xaraf).
2. Marka Maamulaha la abuuro, isdiiwaangelinta dadweynaha si toos ah ayay u xirmeysaa.
3. Maamuluhu wuxuu geli karaa **Maamulka Isticmaalayaasha** si uu u abuuro, u hawlgeliyo, ama u joojiyo xisaabaadka **Hawl-wadeennada (Admins)**.
4. Maamuluhu wuxuu arki karaa dhammaan xogta, warbixinnada, iyo **Diiwaanka Dhaqdhaqaaqa (Audit Logs)** isagoo **akhris kaliya ah** (ma beddeli karo bakhaarka, kirada, lacagta, ama kharashka).

### Hawlaha Maalinlaha ah (Hawl-wadeen / Admin)
1. **Bakhaarka Qalabka**: Ku dar **Kabaleeti** ama **Jeeg** cusub. Nidaamku si toos ah ayuu u xisaabiyaa inta diyaarka ah, kireysan, la soo celiyay, halaabay, iyo inta luntay.
2. **Kirada Qalabka**: Dooro macmiil jira ama diiwaangeli macmiil cusub (Magac, Goobta Dhismaha, Telefoon, Gaari). Dooro **Habka Qiimeynta** (A: Heshiis Guud, B: Maalinle Guud, C: Xabbad Maalintii) iyo lacagta (**USD** ama **SOS** oo sarifkeedu yahay `1 USD = 28 SOS`). Taariikhda soo celinta la filayo waa ikhtiyaari.
3. **Soo Celinta Qalabka**: Diiwaangeli soo celin buuxda ama qayb ah, adigoo kala saaraya qalabka badqaba, kan halaabay, iyo kan lumay.
4. **Kharashaadka & Lacag Bixinta**: Diiwaangeli rarista (`Rarista`), dejinta (`Dejinta`), gaadiidka, iyo lacag bixinta qayb-qaybta ah; kala saar kharashka shirkadda iyo kan macmiilka lagu dallacay.
5. **Dejinta & Astaanta**: Geli astaanta shirkadda (Logo), beddel magaca nidaamka/websaydhka, ama cusbooneysii sarifka lacagta.

---

## 5. User Guide — English

### Initial Setup & Manager Supervision
1. On first launch, the **Initial Manager Setup** page creates the single company Manager account and permanently locks public registration.
2. Managers have **strict read-only access** across all operational modules (Dashboard, Inventory, Rentals, Returns, Customers, Payments, Expenses, Reports, Audit Logs) and exclusive authority to create, activate, or deactivate **Admin** operator accounts.

### Daily Operations (Admin)
1. **Inventory**: Register **Kabaleeti** and **Jeeg** equipment. Stock availability automatically reconciles rentals, good returns, damaged units, and lost units.
2. **Rentals**: Register rentals with customer & transport vehicle details, optional expected return date, currency (`USD` or `SOS` using historical snapshot e.g. `1 USD = 28 SOS`), and one of the 3 pricing formulas (Contract Fixed, Daily Total, or Per-Piece Daily). Print/export branded PDF receipts.
3. **Returns**: Record partial or full returns; damaged and lost items never re-enter available stock.
4. **Payments & Expenses**: Track partial payments in USD/SOS, loading/unloading/transport expenses (distinguishing Company-Paid vs Customer-Charged), and view real-time customer debt balances.
5. **Reports & Settings**: Generate 13 USD-standardized PDF/printable reports, upload a company logo, customize system/website names, and monitor automatic 6-hour backups.
