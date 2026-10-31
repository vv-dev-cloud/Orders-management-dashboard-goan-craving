const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true },
  phone: String,
  deliveryAddress: String,
  items: [{ name: String, quantity: Number, price: Number }],
  total: { type: Number, default: 0 },
  paymentMethod: { type: String, default: "COD" },
  paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed", "Refunded"], default: "Pending" },
  status: { type: String, enum: ["Placed", "Confirmed", "Preparing", "Out for delivery", "Delivered", "Cancelled"], default: "Placed" },
  deliveryDate: Date,
  notes: String
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
