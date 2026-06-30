Labour Registration (YoloHealth) — Product documentation
1. Project overview
Short description
Labour Registration is a single-page web application used at HealthATM / camp sites to register construction workers (UK BOCW camp flow), optionally manage additional camp tests, and upload patient reports. Operators identify the kiosk with an ATM ID stored locally; the app talks to YoloHealth’s HealthATM REST API.

Objective / purpose
Capture and submit labour / patient registration data for the UK BOCW camp integration, including live photo and optional geo-tagged location metadata.
Support camp workflows such as listing and marking additional tests, and uploading external reports after barcode-based session login.
2. Basic details
Field	Value
Product / app name	YoloHealth — Labour registration (see index.html title)
Client / product owner	Yolo Health (inferred from branding and yolohealth.in / HealthATM domains in tooling) — confirm official client name with PM if needed
Project type	Web (SPA, Vite + React)
Primary users	Field / camp operators at kiosks (ATM-scoped sessions)
3. Repository details
Item	Detail
Repository name	labour-registration-web-app (remote)
Repository URL	https://github.com/Shah-Hussain-Dev/labour-registration-web-app.git
Local / workspace folder	May appear as labour-registration-prod or similar on developer machines
Branch details (update to match your org’s Git policy)
Environment	Branch name	Notes
Development	TBD (e.g. develop)	Not defined in repo metadata; only main was observed locally
Staging	TBD (e.g. staging)	Add when your team standardises branches
Production (live)	main	Current default branch on origin
Action for doc owner: replace TBDs after aligning with your release process.

4. Project structure
Folder structure (high level)
labour-registration-web-app/
├── index.html
├── package.json
├── vite.config.js
├── public/                 # static assets, icons, manifest
└── src/
    ├── main.jsx            # React entry, BrowserRouter
    ├── App.jsx             # routes, ATM ID gate & layout
    ├── index.css
    ├── api/                # HTTP clients (fetch)
    ├── components/         # UI (forms, modals, panels)
    ├── constants/          # API base URL, routes, storage keys
    ├── layout/             # shell layout (header, outlet)
    ├── pages/              # route-level pages
    ├── utils/              # helpers (e.g. geo photo)
    └── assets/
Key modules / components
Area	Role
App.jsx	React Router routes; ATM ID capture and localStorage; wraps layout
layout/AppLayout.jsx	Shared chrome; passes atmId to child routes
pages/RegistrationPage.jsx	Hosts LabourRegistrationForm (main camp registration)
pages/ScanTestPage.jsx	ScanTestPanel — additional tests by barcode
pages/UploadReportPage.jsx	UploadReportPanel — report upload (uses ATM context where applicable)
api/labourService.js	UK BOCW: get labour, register patient (JSON + photo data URL)
api/additionalTestsService.js	Camp additional tests list + mark done
api/loginBarcodeService.js	Barcode login → JWT for authenticated flows
api/uploadPatientReportService.js	Bearer JWT upload of patient reports
constants/healthAtmApiBase.js	Production API base URL for HealthATM
vite.config.js	Dev proxies (HMS API path, Google Maps static/geocode); optional env for Maps key
5. Tech stack and versions
Layer	Technology	Version (from package.json unless noted)
Runtime (dev)	Node.js	Not pinned in repo — use current LTS or 18+ compatible with Vite 6; example: v22.x on a dev machine
Framework	React	^19.0.0
Routing	react-router-dom	^7.14.1
Build tool	Vite	^6.0.7
React plugin	@vitejs/plugin-react	^4.3.4
Camera	react-webcam	^7.2.0
Barcode (browser)	@zxing/browser	^0.1.5
Module format	ESM	"type": "module"
Scripts: npm run dev (Vite dev server), npm run build, npm run preview.

6. Environment and deployment
Local setup
Prerequisites: Node.js (recommend 18+ or team-standard LTS), npm.
Clone the repository (URL above).
Install: npm install
Run: npm run dev — default Vite URL is typically http://localhost:5173 (or the port Vite prints).
Optional env: .env.example exists; project currently documents minimal Vite vars. For Google Maps used by dev proxies, Vite loads: GOOGLE_MAP_API, VITE_GOOGLE_MAP_API, or VITE_GOOGLE_MAPS_API_KEY (see vite.config.js). Do not commit real keys; use local .env and team secret store.
Staging and production URLs (fill in)
Environment	Frontend URL	Notes
Staging	TBD	e.g. internal preview / UAT host
Production	TBD	e.g. CDN / static host behind your domain
Backend / API (application data): configured in code as:

configured via `import.meta.env.API_URL` (see [healthAtmApiBase.js](file:///d:/React%20Projects%20Yolo%20Health/labour-registration-prod/src/constants/healthAtmApiBase.js))
Deployment process (fill in)
Typical pattern for a Vite SPA (adapt to your pipeline):

npm run build → output in dist/
Deploy dist/ contents to static hosting (S3+CloudFront, Azure Static Web Apps, nginx, etc.)
Ensure HTTPS and correct cache headers for index.html vs hashed assets
No server-side secrets should ship in the client bundle; API keys belong in env at build time only where unavoidable
Replace this subsection with your actual CI/CD (GitHub Actions, etc.) when documented.

7. Features / modules
Feature	Route / entry	Summary
ATM / kiosk identification	App-wide	Operator enters ATM ID; stored in browser localStorage; required for labour API calls that need kiosk_id
UK BOCW labour registration	/	Lookup by labour registration number; loads main labour + family options; validates demographics, Aadhaar, optional email; barcode mapping; live webcam photo + optional geo address; submits to register-patient
Additional camp tests	/scan-tests	Load tests by patient barcode; mark selected tests done
Upload patient report	/upload-report	Scan barcode → login-barcode → JWT; upload file as data URI with metadata (title, category, file type)
Dev-only utilities	Proxies in Vite	Local dev can proxy HMS and Google Maps endpoints (see vite.config.js)
8. API details
Base URL(s)
Usage	Base URL
HealthATM / camp / user-app (main app API)	Dynamically configured via `API_URL` env variable
Dev proxy: /yolo-hms-api → https://hms.yolohealth.in/api (local development only).

Authentication
Flow	Method
UK BOCW get labour / register patient	JSON POST with Content-Type: application/json — no Bearer token in current implementation
Upload patient reports	Authorization: Bearer <JWT> where JWT comes from POST /v1/login-barcode response (data.token)
Additional tests	GET / POST JSON as implemented — no Bearer in service code
Key endpoints (as used by this app)
Method	Path	Purpose
POST	/v1/camp/uk-bocw/get-labour-data	Body: lab_reg_no, uses ATM context in app — returns labour + family
POST	/v1/camp/uk-bocw/register-patient	Registers patient with demographics, kiosk_id, labour_id, optional live_location, base64/data URL photo
GET	/v1/camp/additional-tests?barcode=…	List additional tests for barcode
POST	/v1/camp/additional-tests/mark-done	Body: { ids: number[] }
POST	/v1/login-barcode	Body: { barcode } — returns token for uploads
POST	/v1/user-app/upload-patient-reports	Bearer — body: title, file_path (data URI), file_type, category
Full request/response contracts should be maintained with the API team / OpenAPI if available.

9. Access and credentials
Item	Guidance
API access	Coordinate with YoloHealth / HealthATM platform owners for environment-specific behaviour, rate limits, and IP allowlists if any
Barcode / JWT	End-user barcode is sensitive; JWT is session-like — treat as confidential in browser memory; do not log tokens
Google Maps API keys	Configure via environment variables in local/build tooling; rotate any key that was ever committed or shared
ATM ID	Operational identifier per kiosk — distribute via secure operational runbooks, not in public wiki pages
Do not paste production secrets, tokens, or private keys into Confluence. Use your organisation’s secret manager or restricted Confluence space for credential procedures.

10. Document maintenance
Owner	Assign name / team
Last reviewed	Date
Source of truth for URLs & branches	Repository + release manager
