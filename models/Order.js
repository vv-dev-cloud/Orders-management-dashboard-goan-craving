const mongoose = require("mongoose");

// Mirrors Goan Craving's FoodOrder collection and document shape.
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, index: true },
  user: mongoose.Schema.Types.ObjectId,
  items: [{ name: String, quantity: Number, unitPrice: Number }],
  deliveryAddress: { fullName: String, phone: String, addressLine: String, area: String, city: String, state: String, postalCode: String, latitude: Number, longitude: Number },
  paymentMethod: String,
  paymentStatus: String,
  orderStatus: String,
  total: Number,
  createdAt: Date,
  updatedAt: Date
}, { strict: false, collection: "foodorders" });

module.exports = mongoose.models.FoodOrder || mongoose.model("FoodOrder", orderSchema, "foodorders");
