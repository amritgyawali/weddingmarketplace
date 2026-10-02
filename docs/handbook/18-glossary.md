# 18. Glossary

Product, Nepali and technical terms used in the code and the docs, in alphabetical order.

| Term | Meaning |
|---|---|
| **Action (store action)** | A function on `useDb` (or another store) that changes state for one use case. The app's API; each maps to a future server endpoint. |
| **Activate booking** | Confirming a booking: deliverables, crew plan, payables, revenue, calendar block, contract (`activateBooking`). |
| **AD** | Gregorian calendar dates; how dates are stored (`yyyy-mm-dd`). |
| **Assignment** | A person (staff or freelancer) on a booking's crew slot. |
| **Audit log** | `audit` collection / `audit_logs` table: who did what to which entity. |
| **Baggi** | A horse-drawn carriage for the groom's procession; a vehicles-trade service. |
| **Bhoj** | The wedding feast; the couple's "bhoj menu" tool. |
| **Booking** | A provider booked for a requirement, with `agreedPrice = providerPayable + platformFee`. |
| **Bratabandha** | A Hindu coming-of-age (sacred thread) ceremony for boys; an occasion. |
| **BS (Bikram Sambat)** | The official Nepali calendar, about 56.7 years ahead of AD. Shown by default; converted in `utils/bs.ts`. |
| **Capability** | Something a persona can do (`media.camera`, `food.menu`, `plan.sait`); granted by services, forms and occasions. |
| **Celebration** | Any occasion's project (the generic word outside weddings). |
| **Coordinator** | Platform staff who manages a project end to end. |
| **Core loop** | Plan → match → quote → book → crew → event day → payouts → reviews ([01 §3](01-product-and-domain.md#3-the-core-loop)). |
| **Craft** | A freelancer's line of work (photo, beauty, music…), derived from the primary skill. |
| **Crew slot** | A role a booking needs on the day (photographer, helper), staffed in-house or from the gig marketplace. |
| **Dakshina** | An offering to priests; part of the "tips and dakshina" tool. |
| **DbData** | The type of everything persisted in `useDb`. |
| **Demo backend / mock** | The on-device zustand store used when `EXPO_PUBLIC_BACKEND=mock`. |
| **Deliverable** | Something a provider hands over after the event (album, film), with its own status. |
| **Emergency replacement** | Replacing failed crew on the day through an emergency gig ([08 §9](08-business-logic.md#9-emergency-replacement-startemergencyreplacement-store)). |
| **Experience** | The resolved persona: role, capabilities, permissions, occasion, vocabulary (`services/experience.ts`). |
| **Expo Go** | Expo's sandbox app that runs the project without a native build; the app must keep working in it. |
| **Gig** | A freelancer job posting. |
| **Haldi** | Turmeric ceremony before the wedding. |
| **Invariant** | A rule tests assert must always hold (`AGENTS.md` §5). |
| **Janti** | The groom's wedding procession party; the "janti planner" tool. |
| **Lakh / crore** | 100,000 / 10,000,000; how Nepali families talk about budgets (`formatLakh`). |
| **Lead** | A vendor CRM enquiry from the marketplace (not a project). |
| **Mangsir, Magh, Falgun, Baisakh** | BS months; the peak wedding season. |
| **Mehendi** | Henna ceremony; also a freelancer craft (makeup and mehendi). |
| **Milestone** | One instalment the customer owes; status derived by `milestoneStatus()`. |
| **Muhurta** | An auspicious time for a ritual; the vendor "muhurta and samagri" tool. |
| **Namaste / Dhanyabad** | Hello / thank you; the app's tone. |
| **NPR** | Nepalese rupee. |
| **Nwaran** | Newborn naming ceremony (event type `NWARAN`). |
| **Occasion** | What a customer celebrates; decides functions, services, tools and vocabulary. |
| **Paisa** | 1/100 rupee; SQL stores money in paisa. |
| **Parity** | App money = SQL money (`npm run test:parity`). |
| **Pasni** | Rice-feeding ceremony for a baby. |
| **Payable** | Money the platform owes a provider or freelancer. |
| **Persona** | A user's identity inside their role (occasion, services, craft, staff role). |
| **Persona matrix** | `scripts/persona-matrix.json`: what each fixture persona sees. |
| **PGlite** | Postgres compiled to WebAssembly; used locally to test the SQL. |
| **Project (WP-xxxx)** | One celebration being organised. |
| **Quick help** | The rule-based assistant (never called AI). |
| **Quotation (QT-YYYY-NNNN)** | A versioned offer; sent versions are frozen. |
| **Requirement** | A service a project needs, with a budget. |
| **RLS** | Postgres row-level security; on for every table. |
| **RPC (`rpc_*`)** | A Postgres function the client may call; the server version of a store action. |
| **Run sheet** | The minute-by-minute plan for an event day. |
| **Sait** | An auspicious date, chosen with a priest; the "sait finder" tool. |
| **Samagri** | Ritual items needed for a puja. |
| **Seed** | The demo dataset (`buildSeedData()`), with dates relative to today. |
| **Shagun** | Gift money given at ceremonies; the "shagun and gifts" tool. |
| **Super admin** | Staff role with every permission, including `admin.full` and `occasion.manage`. |
| **Tool / toolkit** | Small role tools on top of the core loop ([10](10-toolkits.md)). |
| **Trade** | A group of vendor services (venue, photo, decor…). |
| **VAT** | Value added tax, 13% in Nepal. |
| **Vivah** | "Wedding" in Nepali; the product name (rebrand planned). |
| **Vivah Planners** | The concierge planning service (tab "Planner"), formerly "Genie" (some code names still say genie). |
| **When** | A visibility rule object (`types/persona.ts`). |
| **Worktree** | A second checkout of the repo in another folder (`git worktree`), used for parallel work. |
