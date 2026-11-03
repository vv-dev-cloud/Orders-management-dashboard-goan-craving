const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const DeliveryAgent = require("../models/DeliveryAgent");
const router = express.Router();

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const makePassword = () => crypto.randomBytes(9).toString("base64url") + "Gc!";
const makeAgentId = () => "GCDA-" + crypto.randomBytes(4).toString("hex").toUpperCase();

router.get("/", asyncRoute(async (req, res) => {
  const agents = await DeliveryAgent.find({ role: "delivery" }).select("-passwordHash").sort({ createdAt: -1 }).limit(300).lean();
  res.json(agents);
}));

router.post("/", asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 100);
  const email = String(req.body.email || "").trim().toLowerCase().slice(0, 160);
  const phone = String(req.body.phone || "").trim().slice(0, 30);
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a name and valid email address." });
  if (await DeliveryAgent.exists({ email })) return res.status(409).json({ error: "An account already uses this email." });
  const password = makePassword();
  let agentId;
  for (let attempt = 0; attempt < 5; attempt++) {
    agentId = makeAgentId();
    if (!(await DeliveryAgent.exists({ agentId }))) break;
    agentId = null;
  }
  if (!agentId) return res.status(503).json({ error: "Could not generate a unique agent ID. Try again." });
  const agent = await DeliveryAgent.create({ name, email, phone, agentId, passwordHash: await bcrypt.hash(password, 12), role: "delivery", isActive: true });
  res.status(201).json({ agent: { id: String(agent._id), name: agent.name, email: agent.email, phone: agent.phone, agentId: agent.agentId, isActive: agent.isActive }, password });
}));

router.patch("/:id/status", asyncRoute(async (req, res) => {
  const isActive = req.body.isActive;
  if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive must be true or false." });
  const agent = await DeliveryAgent.findOneAndUpdate({ _id: req.params.id, role: "delivery" }, { isActive }, { new: true }).select("-passwordHash").lean();
  if (!agent) return res.status(404).json({ error: "Delivery agent not found." });
  res.json(agent);
}));

router.post("/:id/reset-password", asyncRoute(async (req, res) => {
  const password = makePassword();
  const agent = await DeliveryAgent.findOneAndUpdate({ _id: req.params.id, role: "delivery" }, { passwordHash: await bcrypt.hash(password, 12) }, { new: true }).select("-passwordHash").lean();
  if (!agent) return res.status(404).json({ error: "Delivery agent not found." });
  res.json({ agentId: agent.agentId, password });
}));

module.exports = router;
