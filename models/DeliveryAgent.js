const mongoose = require("mongoose");

// Explicit collection name keeps these accounts shared with the delivery portal's User model.
const deliveryAgentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  agentId: { type: String, required: true, unique: true, sparse: true, uppercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["delivery", "employee", "admin"], default: "delivery", index: true },
  isActive: { type: Boolean, default: true },
  phone: { type: String, trim: true }
}, { timestamps: true, collection: "users" });

module.exports = mongoose.model("DeliveryAgent", deliveryAgentSchema, "users");
