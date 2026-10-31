const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["customer", "agent", "ai"], required: true },
  text: { type: String, required: true, trim: true, maxlength: 1200 },
  sentAt: { type: Date, default: Date.now }
});

const supportChatSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  customerName: { type: String, required: true },
  customerEmail: String,
  orderNumber: String,
  issue: { type: String, default: "Human support requested" },
  status: { type: String, enum: ["Waiting", "Active", "Resolved"], default: "Waiting", index: true },
  assignedAgent: String,
  messages: [messageSchema]
}, { timestamps: true, collection: "supportchats" });

supportChatSchema.index({ customerId: 1, status: 1, updatedAt: -1 });
module.exports = mongoose.models.SupportChat || mongoose.model("SupportChat", supportChatSchema, "supportchats");
