const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorRole: { type: String, enum: ['seller', 'delivery', 'employee', 'admin', 'system'], default: 'system' },
  note: { type: String, maxlength: 500, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const schema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', required: true, unique: true, index: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  deliveryPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryAgent', default: null, index: true },
  assignmentId: { type: String, unique: true, sparse: true, index: true },
  status: { type: String, enum: ['pending_assignment', 'assigned', 'accepted', 'at_restaurant', 'picked_up', 'en_route', 'delivered', 'assignment_failed', 'delivery_failed', 'cancelled', 'returned'], default: 'pending_assignment', index: true },
  pickup: { address: { type: String, default: '' }, latitude: Number, longitude: Number },
  dropoff: { address: { type: String, default: '' }, latitude: Number, longitude: Number },
  assignedAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  pickedUpAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  attemptCount: { type: Number, default: 0 },
  failureReason: { type: String, maxlength: 500, default: '' },
  events: { type: [eventSchema], default: [] }
}, { timestamps: true, collection: 'deliverytasks' });

module.exports = mongoose.models.DeliveryTask || mongoose.model('DeliveryTask', schema, 'deliverytasks');
