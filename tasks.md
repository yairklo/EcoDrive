# EcoDrive - App Production Backlog & Architecture (0 to 100)

This master backlog document outlines the complete architectural blueprint and itemized task breakdown for **EcoDrive**—a scalable, production-ready mobile application designed to promote fuel efficiency through real-time feedback and vehicle data calibration.

---

## 1. System Architecture & Tech Stack

To ensure maximum scalability, extensibility, and security, the platform is structured with a modular, decoupled architecture capable of scaling up to handle thousands of concurrent live trips.

```
+--------------------------------------------------------------------------+
|                               MOBILE CLIENT                              |
|   +-------------------+  +-------------------+  +--------------------+   |
|   |  React Native App |  | Expo Location API |  | Background Runner  |   |
|   +---------+---------+  +---------+---------+  +----------+---------+   |
+-------------|----------------------|-----------------------|-------------+
              |                      |                       |
              v                      v                       v
      HTTPS (REST APIs)       HTTPS (Geo-Inversion)   Secure WebSockets
              |                      |                       |
              +----------------------+-----------------------+
                                     |
                                     v
+------------------------------------+-------------------------------------+
|                             REVERSE PROXY                                |
|                        Nginx / Cloudflare WAF                            |
+------------------------------------+-------------------------------------+
                                     |
                                     v
+------------------------------------+-------------------------------------+
|                         APPLICATION SERVER GATEWAY                        |
|                     Node.js / Express or Fastify                         |
+------------------------------------+-------------------------------------+
        |                     |                       |              |
        v                     v                       v              v
+---------------+     +---------------+     +----------------+ +-----------+
| Auth Service  |     | Trip Service  |     | Fuel Analytics | | Push Notif|
| (JWT / OAuth) |     |  (Real-Time)  |     |   Engine (V2)  | |  Engine   |
+---------------+     +---------------+     +----------------+ +-----------+
        |                     |                       |              |
        +-------------+-------+-----------------------+--------------+
                      |
                      v
+---------------------+----------------------------------------------------+
|                                DATA LAYER                                |
|   +-------------------+  +-------------------+  +--------------------+   |
|   | MongoDB / Postgre |  | Redis Cache & MQ  |  | TimeScaleDB (V2)   |   |
|   | (User/Vehicle Data|  | (Session/Queueing)|  | (Telemetry Log)    |   |
|   +-------------------+  +-------------------+  +--------------------+   |
+--------------------------------------------------------------------------+
```

### Stack Selection
* **Frontend (Mobile):** React Native (Expo) — Cross-platform (iOS/Android), background geolocation libraries, lightweight local caching (AsyncStorage/MMKV).
* **Backend (API & Processing):** Node.js with Fastify or Express — High throughput, robust asynchronous request handling.
* **Databases:**
    * **PostgreSQL / MongoDB:** For core structured datasets (Users, Vehicles, Refueling Journals).
    * **Redis:** For managing active live-trip sessions, caching configuration parameters, and queuing asynchronous heavy processing.
* **Infrastructure & Security:** Hosted on highly reliable deployment layers (Render/Vercel/AWS), protected by HTTPS/TLS 1.3, input validation via Zod/Joi, rate limiting, and secure JSON Web Tokens (JWT) stored in mobile keychains.

---

## 2. Epics & Modular Task Breakdown

### Phase 1: Foundations & Infrastructure Setup (INFRA)
* [x] **TASK-1.1: Core Repository and Monorepo/Decoupled Setup**
    * Initialize a structured multi-folder directory structure (`/client` and `/server`).
    * Configure basic code formatters and linters (ESLint, Prettier).
    * Set up `.gitignore` for security keys, `.env` boilerplate profiles, and operational environment profiles.
* [x] **TASK-1.2: Server Setup & Express/Fastify Boilerplate**
    * Initialize Node.js backend environment with TypeScript/JavaScript.
    * Implement centralized error-handling middleware to intercept runtime faults cleanly.
    * Add CORS configurations, `helmet` headers for foundational HTTP security, and standard JSON input parsers.
* [x] **TASK-1.3: Database Connections & Schema Models Setup**
    * Establish structural connections to primary instance storage with resilient automatic retry patterns.
    * Define Core Schema Models:
        * `User`: Email (hashed), encrypted password string, profile preferences, metadata records.
        * `Vehicle`: Owner ID, structural type mapping (Sedan, SUV, Compact, Hybrid), fuel tank total volume capacity.
        * `RefuelLog`: Vehicle Link ID, timestamp entry, current odometer reading integer, total liters pumped floating-value, financial cost-per-liter pricing metrics.
* [x] **TASK-1.4: Production CI/CD Pipeline & Deployment Pre-configurations**
    * Create multi-stage Dockerfiles or deployment workflows targeted for seamless cloud hosting runners (Render/Vercel).
    * Configure dynamic, environment-isolated configuration pipelines (`dev`, `staging`, `production`).

### Phase 2: Authentication & Secure Account Operations (AUTH)
* [x] **TASK-2.1: Secure User Registration & Cryptographic Password Storage**
    * Construct standard API registration endpoint validating constraints (valid email syntax, password string strength bounds).
    * Integrate secure hashing algorithms (`bcrypt` / `argon2`) to ensure credentials are never preserved as raw text strings.
* [x] **TASK-2.2: Stateless Session Token Generation & User Login Pipelines**
    * Develop access authentication endpoint evaluating submitted parameters against encrypted system data.
    * Issue stateless JWT authorization markers packed with strict token expiration properties.
* [x] **TASK-2.3: API Gateway Authorization & Route Protection Middleware**
    * Implement modular authentication barrier middleware filtering incoming server calls.
    * Intercept, inspect, and map valid inbound request headers (`Authorization: Bearer <JWT>`) to isolate user execution scope safely.
* [x] **TASK-2.4: Mobile Authentication Interface & Secure Storage Layer**
    * Develop login and registration screens within the mobile React Native directory.
    * Incorporate secure phone storage mechanisms (`expo-secure-store` / native Keychains) to retain structural JWT instances across restarts.

### Phase 3: Vehicle Profiles & Odometer Refueling Logbooks (VEHICLE)
* [x] **TASK-3.1: Vehicle Onboarding API Engine & Management Routes**
    * Construct operational API pathways allowing users to create, view, update, and remove physical vehicle items.
    * Implement validation to prevent negative values for storage parameters (e.g., fuel tank capacity limits).
* [x] **TASK-3.2: Fuel Journal Data Submissions & Logs Management API**
    * Construct endpoint allowing entries for historical fill-up logs.
    * Implement server-side logical cross-examinations ensuring current odometer metrics are greater than previous logs.
* [x] **TASK-3.3: Adaptive Calibration Engine (Multi-Variable Dual-Profile Calibration Framework)**
    * Develop a robust computational utility triggered after successive refueling updates.
    * Require at least 3 refueling logs to execute an Ordinary Least Squares (OLS) Linear Regression using matrix math (via `mathjs`).
    * *Algorithm:* Independent variables must be accumulated predicted city fuel burn and predicted highway fuel burn. Dependent variable is the actual total fuel pumped.
    * Isolate and save two independent correction factors: `k_city` and `k_highway` to eliminate guessing fuel distribution.
* [x] **TASK-3.4: Vehicle Profile Setup UI Forms & Log Entry Dialogues**
    * Design interactive interface views allowing users to assign their transport layout configurations.
    * Build manual reporting submission windows for gas station refills, immediately recalculating vehicle stats.

### Phase 4: GPS Tracking & Real-Time Physics Calculus Engine (TRIP)
* [x] **TASK-4.1: Real-Time Mobile Location Capture & Background Runners**
    * Incorporate safe GPS background tracking permissions and runtime systems (`expo-location`).
    * Enforce structured data capture configurations balancing high precision (tracking deltas every few meters) against aggressive battery drain.
* [x] **TASK-4.2: Velocity-to-Consumption Telemetry Engine (The Core Physics Calculator)**
    * **Dynamic Telemetry Segmentation:** Real-time GPS data streams must be actively sorted into two tracking buckets during a trip: `Distance_City` (0-60 km/h or high frequency of stops) and `Distance_Highway` (60+ km/h steady cruise).
    * **Kinetic Energy Acceleration Penalties:** Incorporate accelerometer monitoring to capture acceleration epochs (a > 2.5 m/s²).
    * Implement the strict physics-based kinetic energy delta formula: `Delta_E = 0.5 * m * (v_final² - v_initial²)`
    * Assume a baseline standard vehicle mass (`m = 1400 kg`) and a standard internal combustion engine thermal efficiency of `30%` to calculate the precise baseline fuel-burn penalty in milliliters for every aggressive acceleration event.
* [x] **TASK-4.3: Real-Time Live In-Trip Server Synchronization Endpoint**
    * Construct light data ingestion API or stateful WebSocket payload standard accepting telemetry records.
    * Process inbound stream variables to log ongoing trip states securely without blocking core system performance.

### Phase 5: UI/UX Safety Interface & Audio Feedback System (UI-DRIVE)
* [x] **TASK-5.1: Peripheral Vision UI Dashboard (Non-Distracting Interface)**
    * Design a driving view that does not require reading small text.
    * Implement a full-screen ambient color shift system: **Bright Green** (Optimal Speed), **Soft Amber** (Slight Over-speeding), **Deep Muted Crimson** (Aggressive fuel waste).
* [x] **TASK-5.2: Text-To-Speech (TTS) In-App Audio Voice Prompts Engine**
    * Integrate speech synthesis plugins (`expo-speech`) to deliver hands-free audio notifications.
    * Incorporate voice notification delays to avoid sound fatigue (e.g., limiting spoken efficiency guidance to once every 2 minutes max).
    * *Example Phrasings:* *"Slowing down by 15 km/h will save you 18 Shekels on this trip while adding only 3 minutes to arrival time."*
* [x] **TASK-5.3: Post-Trip Summary Report Analytics View**
    * Design a post-trip summary screen that displays metrics once the app detects the vehicle has stopped.
    * Present direct financial summaries, environmental preservation metrics (CO₂ prevented), and an overall "Eco-Score" grading performance from 0 to 100.

### Phase 6: System Hardening, Safety, & Scale Auditing (SEC-TEST)
* [x] **TASK-6.1: Input Data Sanitization & Strict Request Validation**
    * Enforce structural input verification middleware on all public endpoints to mitigate injection and tampering vulnerabilities.
    * Incorporate rate-limiting limits across security paths to block brute-force attempts.
* [x] **TASK-6.2: System Integration Testing Framework**
    * Write a test suite (e.g., using Jest) to verify the physics engine logic using mocked GPS tracking data arrays.
    * Verify database transactional isolation and error resilience when input data is malformed.
