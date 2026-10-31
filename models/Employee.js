const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ["Order manager", "Kitchen staff", "Delivery coordinator"], default: "Order manager" },
  passwordHash: { type: String, required: true, select: false },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  mustChangePassword: { type: Boolean, default: true },
  lastActiveAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model("Employee", employeeSchema);
