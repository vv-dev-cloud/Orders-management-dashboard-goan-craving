# Goan Craving — Orders Management Dashboard

A responsive front-end prototype for the Goan Craving operations team.

## Current demo features
- Operations overview with sample order metrics
- Order table with search and status filter
- Order detail panel with customer, delivery, and payment information
- Demo status editing workflow
- Support inbox with accept, reply, and resolve interactions
- CSV export of sample order records
- Responsive desktop/mobile layout

## Run locally
Open `index.html` in a browser. No build step is needed.

## Important
This is a UI prototype using in-memory sample data. It is not connected to Goan Craving's production order/payment records, staff authentication, or live chat transport. Refreshing the page resets demo changes. Production integration should use authenticated server APIs, enforce staff roles, and treat payment status as authoritative from the payment/order backend. Never store raw card details in this dashboard.

## Suggested integration sequence
1. Add staff authentication and role-based access.
2. Create authenticated order-list/detail and status-update API endpoints.
3. Wire payment status from existing payment records (read-only from this console).
4. Add a persistent support conversation/ticket model, agent assignment, and real-time messaging.
5. Add audit logs, notifications, pagination, and reporting endpoints.
