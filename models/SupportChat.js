const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["customer", "agent"], required: true },
  text: { type: String, required: true, trim: true },
  sentAt: { type: Date, default: Date.now }
}, { _id: true });

const supportChatSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  orderNumber: String,
  issue: { type: String, default: "Customer support request" },
  status: { type: String, enum: ["Waiting", "Active", "Resolved"], default: "Waiting" },
  assignedAgent: String,
  messages: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model("SupportChat", supportChatSchema);
