# Goan Craving — Order Management Dashboard

Node.js + Express + EJS + JavaScript + CSS + MongoDB dashboard for managing food orders and customer support conversations.

## Features
- Overview counts and order-status summary from MongoDB
- Order list with search and status filter
- Order status editing (Placed, Confirmed, Preparing, Out for delivery, Delivered, Cancelled)
- Customer details, items, delivery address, total and payment status fields
- Support inbox: accept a request, send agent replies, and resolve conversations
- CSV export
- Responsive layout
- Employee sign-in using the employee ID, email, and temporary password generated in the admin dashboard
- Session-based authentication with sign-out; dashboard and API routes require an active employee session

## Run locally
1. Install Node.js and MongoDB.
2. Copy .env.example to .env and set `MONGODB_URI` to the same database used by the Goan Craving admin dashboard, plus a strong unique `SESSION_SECRET`.
3. Run npm install.
4. Run npm run dev (or npm start).
5. Open http://localhost:3000/login. Employees sign in with their generated employee ID, email address, and temporary password.

## MongoDB collections
Mongoose uses the `orders` and `supportchats` collections for order/support data. Employee accounts are read from the shared `employees` collection created by the admin dashboard; this project uses the same employee schema and checks the stored bcrypt password hash.

## Add order/chat data
The dashboard reads actual documents from MongoDB. Create order documents with orderNumber, customerName, items, total, paymentMethod, paymentStatus, and status. Support requests can be created in the supportchats collection with customer name, issue, order number, and messages.

## Scope and important notes
- This project is separate from the customer-facing Goan Craving app.
- Employee sign-in only works when this dashboard and the admin dashboard use the same MongoDB database. Ensure `SESSION_SECRET` is configured in the deployment environment.
- Employee accounts must be Active. Login requires all three generated credentials; password hashes are checked with bcrypt. Never put the temporary password in source code or a committed environment file.
- The login is an employee authentication layer; role-based access restrictions and a forced password-change screen are not yet implemented.
- This is a basic support inbox, not a real-time chat transport. It stores agent responses in MongoDB; customer-side chat integration and live updates still need to be connected.
- Payment status is separate from order status. Updating an order status does not modify or imply payment success.
- Do not store full card numbers, CVVs, or other raw card credentials in this dashboard.
