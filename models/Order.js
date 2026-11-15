const mongoose = require("mongoose");

// Mirrors Goan Craving's FoodOrder collection and document shape.
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, index: true },
  user: mongoose.Schema.Types.ObjectId,
  items: [{ product: mongoose.Schema.Types.ObjectId, seller: mongoose.Schema.Types.ObjectId, sellerName: String, name: String, imageURL: String, quantity: Number, unitPrice: Number }],
  deliveryAddress: { fullName: String, phone: String, addressLine: String, area: String, city: String, state: String, postalCode: String, latitude: Number, longitude: Number, instructions: String },
  paymentMethod: String,
  paymentStatus: String,
  orderStatus: String,
  statusEvents: [{ status: String, actorId: mongoose.Schema.Types.ObjectId, actorRole: String, note: String, createdAt: Date }],
  total: Number,
  createdAt: Date,
  updatedAt: Date
}, { strict: false, collection: "foodorders" });

module.exports = mongoose.models.FoodOrder || mongoose.model("FoodOrder", orderSchema, "foodorders");
