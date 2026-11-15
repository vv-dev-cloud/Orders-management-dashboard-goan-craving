const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', required: true, index: true },
  deliveryBoy: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  result: { type: String, enum: ['DELIVERED', 'UNABLE_TO_DELIVER'], required: true },
  customerOtp: { type: String, select: false },
  proofNote: { type: String, maxlength: 1000 },
  verificationStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION'], default: 'PENDING', index: true },
  employeeNote: String,
  verifiedBy: mongoose.Schema.Types.ObjectId,
  verifiedAt: Date
}, { timestamps: true, collection: 'deliveryreports' });

module.exports = mongoose.models.DeliveryReport || mongoose.model('DeliveryReport', schema, 'deliveryreports');
