# Goan Craving — Food Delivery Website & Operations Dashboard

Goan Craving is a food-delivery project with a customer-facing ordering experience and operational dashboards. This repository contains the **employee order-management and customer-support dashboard** built with Node.js, Express, EJS, JavaScript, CSS, and MongoDB.

> **Scope note:** This README documents the behavior visible in this repository and describes the intended end-to-end workflow. Customer checkout, admin account management, delivery-staff operations, payment-provider processing, and live customer chat may live in separate Goan Craving projects. They are not claimed as implemented here unless explicitly listed below.

## Project areas and dashboard roles

| Area | Purpose | Data / connection |
|---|---|---|
| Customer website | Browse food, manage account/address/payment preferences, place and track orders | Creates customer/order data in the shared application backend (separate project) |
| Admin dashboard | Manage operational settings and employee accounts/credentials | Employee records are shared through MongoDB; this dashboard reads active employee records |
| Employee operations dashboard (this repository) | Review orders, update order progress, respond to support requests | Reads and updates the shared MongoDB `foodorders` collection; reads/writes `supportchats` |
| Delivery dashboard (separate project) | Delivery staff workflow, assignment, pickup and delivery reporting | Requires integration with the same order database and employee verification workflow |

The employee dashboard authenticates employees, not customer accounts. Customer sign-in/sign-up and Google OAuth are handled by the customer application, not by this dashboard.

## Features in this repository

### Employee sign-in and session
- Employee login using **employee ID + email + password**.
- Looks up an employee whose account status is `Active`.
- Verifies the stored password hash with bcrypt.
- Rate-limits login attempts (8 requests per 15 minutes).
- Session-based access control for dashboard and API endpoints.
- HTTP-only, SameSite=Lax session cookie; secure cookie in production.
- Session expires after 8 hours.
- Sign-out destroys the active session.
- Login records the employee's last-active timestamp.

### Order management
- Dashboard summary counts by order status.
- Lists recent orders and displays order number, customer, items, quantities, total, payment method/status, delivery address, and creation time.
- Search by order number, customer name, phone, email, item, payment method, or payment status.
- Search normalizes common order-number formats and supports older orders without a stored order number.
- Filter orders by status and date range (today, yesterday, last 7/30 days, this month, last month, or all).
- Updates official order status to one of:
  - Placed
  - Confirmed
  - Preparing
  - Out for delivery
  - Delivered
  - Cancelled
- Order status is stored in the shared database; payment status is a separate field.

### Customer support inbox
- Shows unresolved support conversations.
- Accepts/assigns a conversation to an agent.
- Loads conversation details and customer context, including recent orders and the latest available delivery address.
- Adds agent replies to the conversation history.
- Marks a conversation as resolved.
- Prevents replying to a resolved conversation.
- Stores support messages in MongoDB. This is **not a live WebSocket/chat transport**; customer-side message synchronization still requires integration.

### Interface and exports
- Responsive EJS dashboard and employee login screen.
- Client-side dashboard interactions and API-backed order/support actions.
- CSV export is available in the dashboard UI.

## End-to-end order logic chain

The intended customer-to-operations sequence is:

1. **Customer account** — customer signs in or creates an account in the customer website. Customer authentication is separate from employee login.
2. **Browse and checkout** — customer chooses food, delivery address, and payment method, then places an order through the customer application.
3. **Order persistence** — the application writes an order document to the shared MongoDB `foodorders` collection. The order contains items, address, total, payment fields, status, and timestamps.
4. **Employee login** — employee signs in using credentials provisioned by the admin dashboard. The employee must be Active and the credentials must match the stored bcrypt hash.
5. **Order review** — the employee dashboard reads recent order documents, calculates status counts, and displays order/customer/order details.
6. **Order progress** — an authorized signed-in employee updates the order status. The server validates the status against the allowed values and persists it to MongoDB.
7. **Delivery handoff** — when an order is marked Out for delivery, the delivery workflow should use the shared order record and a separate delivery assignment/report. The separate delivery dashboard must be connected to this same database/schema for end-to-end behavior.
8. **Delivery completion verification** — a delivery report should be treated as a delivery claim/proof, not automatically as the official order status. The employee/admin verification workflow should confirm delivery before setting the official status to Delivered.
9. **Customer tracking** — the customer website should read the current official order status from the same backend/database and show it to the customer. Customer-side live updates/notifications require a connected implementation.
10. **Support follow-up** — customer support requests are stored as support conversations; employees can accept, review context, reply, and resolve them in this dashboard.

**Important:** Steps involving customer checkout, delivery assignment/proof verification, customer-facing tracking, payment-provider confirmation, and real-time notifications depend on their respective application integrations. This employee dashboard alone does not implement those separate systems.

## Data and MongoDB connection

This dashboard expects the same MongoDB database used by the Goan Craving application/admin system.

### Collections used
- `foodorders` — actual order records (the model is named `FoodOrder` and explicitly maps to this collection).
- `supportchats` — customer support conversations.
- `employees` — employee accounts created/managed by the admin dashboard.

### Order fields read by the dashboard
- `orderNumber` (optional; older records can use a generated display ID)
- `user`
- `items[]` with `name`, `quantity`, `unitPrice`
- `deliveryAddress` with recipient, phone, address, area, city, state, and postal code
- `total`
- `paymentMethod`, `paymentStatus`
- `orderStatus`
- `createdAt`, `updatedAt`

The order model uses `strict: false` to tolerate additional fields from the main application. Ensure the main application's schema and field names remain compatible.

## Routes / API behavior

| Method | Path | Purpose |
|---|---|---|
| GET | `/login` | Render employee login |
| POST | `/login` | Validate employee credentials and create session |
| POST | `/logout` | Destroy employee session |
| GET | `/` | Render dashboard with recent orders and unresolved support |
| GET | `/api/orders` | Search/filter orders |
| PATCH | `/api/orders/:id/status` | Validate and update official order status |
| GET | `/api/maps/search?q=...` | Search Indian addresses and places through Stadia Maps |
| GET | `/api/maps/reverse?lat=...&lon=...` | Resolve map coordinates to a nearby address |
| POST | `/api/maps/route` | Calculate a route for 2–10 coordinates; accepts `costing` (`auto`, `motorcycle`, `bicycle`, `pedestrian`) |
| POST | `/api/support/:id/accept` | Accept/assign a support conversation |
| GET | `/api/support/:id` | Load a support conversation |
| GET | `/api/support/:id/context` | Load related customer and order context |
| POST | `/api/support/:id/messages` | Add an employee reply |
| POST | `/api/support/:id/resolve` | Resolve a support conversation |

Dashboard/API routes require an authenticated employee session. Unauthenticated API requests receive a 401 response.

## Configuration and settings

Create a local `.env` file from `.env.example`:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
SESSION_SECRET=<long-random-unique-secret>
NODE_ENV=development
PORT=3000
```

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string for the shared application database |
| `SESSION_SECRET` | Secret used to sign session cookies; use a long, unique value |
| `NODE_ENV` | Set to `production` for production cookie/proxy behavior |
| `PORT` | Server port; defaults to 3000 |
| `STADIA_MAPS_API_KEY` | Private Stadia Maps key used by authenticated backend map endpoints |

Do not commit `.env`, database credentials, session secrets, or employee passwords. Use your hosting provider's environment-variable settings for deployment. The production server trusts the hosting proxy so secure cookies can work behind HTTPS termination.

## Run locally

Requirements: Node.js and access to the shared MongoDB database.

```bash
npm install
npm run dev
# or
npm start
```

Open `http://localhost:3000/login`.

An employee account must already exist in the shared `employees` collection and have `status: "Active"`. Create/manage employee accounts through the admin dashboard's intended workflow. Login requires the generated employee ID, email, and password.

## Security and data handling
- Employee authentication is distinct from customer authentication.
- Keep the dashboard's MongoDB URI and session secret private.
- Login attempts are rate-limited and password hashes are checked with bcrypt.
- Dashboard and API operations require a signed-in employee session.
- Status updates are validated server-side.
- Payment status and order status are independent; changing one does not confirm the other.
- Do not store raw credit-card numbers, CVVs, or other payment credentials in this dashboard. Use a payment provider/tokenized payment method.
- This repository currently does not document granular role-based authorization between employee roles or forced password-change flows; do not assume those controls exist.

## Known integration boundaries / follow-up work
- Connect and verify the customer website's checkout and order tracking against the same `foodorders` collection.
- Confirm exact shared schema and field names against the production customer application.
- Connect delivery assignment and delivery reports to the same order records.
- Add employee/admin verification for delivery reports before official Delivered status.
- Connect customer-side support messages and live updates (WebSocket/SSE/polling) if real-time chat is required.
- Confirm role-based permissions for employee/admin/delivery roles.
- Add automated tests and run a deployment-level end-to-end test with test orders.

## Repository structure

```
.
├── server.js
├── package.json
├── .env.example
├── models/
│   ├── Employee.js
│   ├── Order.js
│   └── SupportChat.js
├── views/
│   ├── employee-login.ejs
│   └── dashboard.ejs
└── public/
    ├── css/style.css
    └── js/dashboard.js
```

## Related project

- [Goan Craving Delivery System Dashboard](https://github.com/vv-dev-cloud/goan.craving-delivery-system-dashboard-) — separate delivery dashboard project; shared database/schema and verification integration are required for a complete end-to-end delivery workflow.


## Stadia Maps integration

The employee dashboard exposes authenticated server-side map endpoints. The Stadia Maps API key is read only from `STADIA_MAPS_API_KEY` and is sent to Stadia using the `Authorization: Stadia-Auth ...` header. It is never returned to browser JavaScript.

Configure `STADIA_MAPS_API_KEY` in your Render service environment variables (and in local `.env` for development). Do not commit the real key. Restart/redeploy the service after setting it.

Example requests (must be signed in as an employee):
```http
GET /api/maps/search?q=Panaji%20Goa
GET /api/maps/reverse?lat=15.4909&lon=73.8278
POST /api/maps/route
Content-Type: application/json

{
  "locations": [
    { "lat": 15.4909, "lon": 73.8278 },
    { "lat": 15.2993, "lon": 74.1240 }
  ],
  "costing": "motorcycle"
}
```

Search and reverse responses are normalized for the dashboard. Route responses retain Stadia's route geometry, distance, duration, and maneuver data. Requests validate coordinates and limit route requests to 2–10 points. Provider errors are translated to safe API errors; usage-limit responses return HTTP 429.

Order delivery addresses now accept optional `latitude` and `longitude` fields. Existing orders remain valid; these fields can be populated by a future customer checkout or employee map-picker UI.

**Plan/licensing note:** Stadia's Free plan is restricted to non-commercial use. Goan Craving is intended as a commercial food-delivery service, so use this integration for development/evaluation only unless Stadia confirms your use is covered or you move to an appropriate commercial plan. The free allowance is not permission for production commercial usage.
