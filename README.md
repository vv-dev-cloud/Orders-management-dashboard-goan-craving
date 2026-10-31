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

## Run locally
1. Install Node.js and MongoDB.
2. Copy .env.example to .env and set MONGODB_URI.
3. Run npm install.
4. Run npm run dev (or npm start).
5. Open http://localhost:3000.

## MongoDB collections
Mongoose creates orders and supportchats collections based on models/Order.js and models/SupportChat.js.

## Add order/chat data
The dashboard reads actual documents from MongoDB. Create order documents with orderNumber, customerName, items, total, paymentMethod, paymentStatus, and status. Support requests can be created in the supportchats collection with customer name, issue, order number, and messages.

## Scope and important notes
- This project is separate from the customer-facing Goan Craving app.
- No login/signup is included, as requested. Keep this dashboard on a trusted/private environment; do not expose its write APIs publicly without adding staff authentication and authorization.
- This is a basic support inbox, not a real-time chat transport. It stores agent responses in MongoDB; customer-side chat integration and live updates still need to be connected.
- Payment status is separate from order status. Updating an order status does not modify or imply payment success.
- Do not store full card numbers, CVVs, or other raw card credentials in this dashboard.
