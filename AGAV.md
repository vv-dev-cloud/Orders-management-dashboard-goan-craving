# Agav project instructions — Goan Craving Order Management

## Project role
This repository is the operational control center for Goan Craving orders, employees, delivery assignment, customer-facing tracker control, and support handoff.

## Non-negotiable safety rules
- Start with read-only inspection of the existing server, routes, models, UI, sessions, and deployment configuration.
- Preserve working employee login, generated employee credentials, shared session behavior, existing order search, and current MongoDB integration unless explicitly tasked otherwise.
- Never expose or commit .env values, API keys, session secrets, database credentials, or customer personal data in logs or documentation.
- Never delete or rewrite production order records. Make schema changes backward-compatible.
- Use feature branches and pull requests. Never push to main, force-push, merge, or deploy without human approval.
- Require confirmation before changing authentication, authorization, payment-related records, or database migrations.

## Core ownership and workflow
- This repository owns employee operational actions, delivery assignment decisions, and the employee-approved customer tracker status.
- Preserve the same orderId created by Goan Craving. Use a distinct assignmentId for each delivery assignment attempt.
- Do not create duplicate orders when receiving retried events. Use idempotency keys and unique constraints.
- Keep separate orderStatus, agentStatus, and customerTrackingStatus fields. Agent-reported status is not final order verification.
- Record an append-only audit trail for employee and agent actions, including actor, timestamp, previous state, new state, reason, and related assignmentId.
- Validate every state transition server-side. Reject stale or out-of-order updates.
- Agents must only receive assignments intended for them. Employees must have role-appropriate permissions.
- Delivery assignment must consider agent online state, freshness of location, current assignments, and estimated availability. Do not assign one agent to conflicting jobs unless explicit safe batching is implemented.
- Customer tracker messages must be deliberately mapped from internal states; never expose internal notes.

## Delivery management roadmap
1. Audit current order ingestion, MongoDB models, employee sessions, search, and status updates.
2. Build reliable order receiving and reconciliation using the original orderId.
3. Add delivery management queue, address verification, pickup/drop details, instructions, and assignment lifecycle.
4. Add available/busy/offline agent visibility with last-location timestamps and permission checks.
5. Calculate ETA from preparation time, agent-to-restaurant travel, restaurant-to-customer route, and handover buffer. Show uncertainty rather than false precision.
6. Receive agent accept/reject/delivered/returned/unable-to-reach reports and require employee verification for final outcomes.
7. Add customer tracker controls and employee activity/audit history.
8. Provide authenticated APIs and real-time events for the website and delivery dashboard.

## Required workflow for each task
1. Audit before editing and identify existing contracts.
2. Plan exact model, route, UI, event, and test changes.
3. Implement the smallest compatible change.
4. Test duplicate events, invalid transitions, unauthorized access, offline/retry behavior, and normal flows.
5. Run available checks and inspect the diff.
6. Report files changed, test results, migration/rollout notes, and unresolved risks.
7. Leave changes on the feature branch for human review; do not merge or deploy.
