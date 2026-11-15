const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const DeliveryAgent = require('../models/DeliveryAgent');
const DeliveryTask = require('../models/DeliveryTask');
const DeliveryReport = require('../models/DeliveryReport');

const router = express.Router();
const requireOperationsRole = (req, res, next) => {
  if (!['Order manager', 'Delivery coordinator'].includes(req.session.employee?.role)) {
    return res.status(403).json({ error: 'Only order managers and delivery coordinators can manage delivery assignments.' });
  }
  next();
};
router.use(requireOperationsRole);
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/tasks', asyncRoute(async (req, res) => {
  const status = String(req.query.status || '').trim();
  const filter = status ? { status } : {};
  const tasks = await DeliveryTask.find(filter).sort({ updatedAt: -1 }).limit(200).populate('order', 'orderNumber orderStatus deliveryAddress total createdAt').populate('deliveryPerson', 'name agentId phone').lean();
  res.json({ tasks });
}));

router.post('/orders/:orderId/assign', asyncRoute(async (req, res) => {
  const { orderId } = req.params;
  const agentId = String(req.body.agentId || '').trim();
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(agentId)) {
    return res.status(400).json({ error: 'A valid order ID and delivery-agent ID are required.' });
  }
  const [order, agent] = await Promise.all([
    Order.findById(orderId).lean(),
    DeliveryAgent.findOne({ _id: agentId, role: 'delivery', isActive: true }).lean()
  ]);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (!agent) return res.status(404).json({ error: 'Active delivery agent not found.' });
  const existing = await DeliveryTask.findOne({ order: order._id });
  const currentOrderStatus = String(order.orderStatus || '').toLowerCase();
  const retryingFailedDelivery = currentOrderStatus === 'out_for_delivery' && existing &&
    ['assignment_failed', 'delivery_failed', 'returned'].includes(existing.status);
  if (!['confirmed', 'preparing', 'ready_for_pickup'].includes(currentOrderStatus) && !retryingFailedDelivery) {
    return res.status(409).json({ error: 'This order is not ready for delivery assignment or retry.' });
  }
  const sellers = [...new Set((order.items || []).map(item => String(item.seller || '')).filter(Boolean))];
  if (sellers.length !== 1) {
    return res.status(422).json({ error: 'The order must contain items from exactly one registered restaurant before it can be assigned.' });
  }
  if (existing && !['pending_assignment', 'assignment_failed', 'delivery_failed', 'returned'].includes(existing.status)) {
    return res.status(409).json({ error: 'This order already has an active delivery assignment.' });
  }
  const now = new Date();
  const assignmentId = 'GCA-' + crypto.randomUUID();
  const dropoff = order.deliveryAddress || {};
  const address = [dropoff.addressLine, dropoff.area, dropoff.city, dropoff.state, dropoff.postalCode].filter(Boolean).join(', ');
  const event = { status: 'assigned', actorId: req.session.employee.id, actorRole: 'employee', note: 'Assigned by ' + req.session.employee.employeeId, createdAt: now };
  let task;
  if (existing) {
    existing.deliveryPerson = agent._id;
    existing.restaurant = sellers[0];
    existing.assignmentId = assignmentId;
    existing.status = 'assigned';
    existing.assignedAt = now;
    existing.acceptedAt = null;
    existing.pickedUpAt = null;
    existing.deliveredAt = null;
    existing.failureReason = '';
    existing.attemptCount = Number(existing.attemptCount || 0) + 1;
    existing.dropoff = { address, latitude: dropoff.latitude, longitude: dropoff.longitude };
    existing.events.push(event);
    task = await existing.save();
  } else {
    task = await DeliveryTask.create({
      order: order._id, restaurant: sellers[0], deliveryPerson: agent._id,
      assignmentId, status: 'assigned', assignedAt: now, attemptCount: 1,
      pickup: {}, dropoff: { address, latitude: dropoff.latitude, longitude: dropoff.longitude },
      events: [event]
    });
  }
  res.status(201).json({ task: { id: String(task._id), orderId: String(order._id), assignmentId: task.assignmentId, agentId: String(agent._id), status: task.status } });
}));

router.patch('/tasks/:taskId/dispatch', asyncRoute(async (req, res) => {
  const { taskId } = req.params;
  if (!mongoose.isValidObjectId(taskId)) return res.status(400).json({ error: 'Invalid delivery task ID.' });
  const task = await DeliveryTask.findOne({ _id: taskId, status: 'picked_up' });
  if (!task) return res.status(404).json({ error: 'A picked-up task was not found.' });
  const order = await Order.findById(task.order).select('orderStatus').lean();
  if (!order || String(order.orderStatus || '').toLowerCase() !== 'ready_for_pickup') {
    return res.status(409).json({ error: 'The order must be marked ready for pickup before dispatch can be confirmed.' });
  }
  const now = new Date();
  task.status = 'en_route';
  task.events.push({ status: 'en_route', actorId: req.session.employee.id, actorRole: 'employee', note: 'Employee confirmed dispatch.', createdAt: now });
  await task.save();
  await Order.updateOne({ _id: task.order, orderStatus: { $ne: 'delivered' } }, {
    $set: { orderStatus: 'out_for_delivery' },
    $push: { statusEvents: { status: 'out_for_delivery', actorId: req.session.employee.id, actorRole: 'employee', note: 'Dispatch confirmed by operations.', createdAt: now } }
  });
  res.json({ ok: true, taskId: String(task._id), status: task.status });
}));

router.get('/reports', asyncRoute(async (req, res) => {
  const status = String(req.query.status || 'PENDING').toUpperCase();
  const allowed = ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid verification status.' });
  const reports = await DeliveryReport.find({ verificationStatus: status })
    .sort({ createdAt: -1 }).limit(200)
    .populate('order', 'orderNumber orderStatus deliveryAddress total')
    .populate('deliveryBoy', 'name agentId phone')
    .lean();
  res.json({ reports });
}));

router.patch('/reports/:reportId/verify', asyncRoute(async (req, res) => {
  const { reportId } = req.params;
  const verificationStatus = String(req.body.verificationStatus || '').toUpperCase();
  const employeeNote = String(req.body.employeeNote || '').trim().slice(0, 500);
  if (!mongoose.isValidObjectId(reportId)) return res.status(400).json({ error: 'Invalid report ID.' });
  if (!['APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION'].includes(verificationStatus)) {
    return res.status(400).json({ error: 'Choose APPROVED, REJECTED, or NEEDS_CLARIFICATION.' });
  }
  const report = await DeliveryReport.findOne({ _id: reportId, verificationStatus: 'PENDING' });
  if (!report) return res.status(404).json({ error: 'Pending delivery report not found.' });
  const now = new Date();
  const orderRecord = await Order.findById(report.order).select('orderStatus').lean();
  if (!orderRecord) return res.status(404).json({ error: 'The linked customer order no longer exists.' });
  if (report.result === 'DELIVERED' && ['cancelled', 'rejected'].includes(String(orderRecord.orderStatus || '').toLowerCase())) {
    return res.status(409).json({ error: 'A cancelled or rejected order cannot be verified as delivered.' });
  }
  const task = await DeliveryTask.findOne({ order: report.order, deliveryPerson: report.deliveryBoy });
  if (!task) return res.status(409).json({ error: 'The delivery assignment no longer matches this agent. Reconcile the assignment before verification.' });

  // Apply idempotent operational changes before closing the report. If a write fails,
  // the report remains pending and an employee can safely retry the verification.
  if (verificationStatus === 'APPROVED' && task) {
    if (report.result === 'DELIVERED') {
      if (task.status !== 'delivered') {
        task.status = 'delivered';
        task.deliveredAt = now;
        task.events.push({ status: 'delivered', actorId: req.session.employee.id, actorRole: 'employee', note: employeeNote || 'Delivery verified by employee.', createdAt: now });
        await task.save();
      }
      await Order.updateOne({ _id: report.order, orderStatus: { $ne: 'delivered' } }, {
        $set: { orderStatus: 'delivered' },
        $push: { statusEvents: { status: 'delivered', actorId: req.session.employee.id, actorRole: 'employee', note: employeeNote || 'Delivery verified by employee.', createdAt: now } }
      });
    } else if (task.status !== 'delivery_failed') {
      task.status = 'delivery_failed';
      task.failureReason = employeeNote || 'Agent reported unable to deliver; employee verified the report.';
      task.events.push({ status: 'delivery_failed', actorId: req.session.employee.id, actorRole: 'employee', note: task.failureReason, createdAt: now });
      await task.save();
    }
  }

  const closed = await DeliveryReport.findOneAndUpdate(
    { _id: reportId, verificationStatus: 'PENDING' },
    { $set: { verificationStatus, employeeNote, verifiedBy: req.session.employee.id, verifiedAt: now } },
    { new: true }
  );
  if (!closed) return res.status(409).json({ error: 'This report was verified by another employee. Refresh and review its latest status.' });
  res.json({ ok: true, report: { id: String(closed._id), verificationStatus: closed.verificationStatus }, taskStatus: task?.status || null });
}));

module.exports = router;
