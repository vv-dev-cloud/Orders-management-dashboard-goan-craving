require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const Order = require("./models/Order");
const SupportChat = require("./models/SupportChat");

const app = express();
const PORT = process.env.PORT || 3000;
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get("/", asyncRoute(async (req, res) => {
  const [orders, chats, counts] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).limit(50).lean(),
    SupportChat.find({ status: { $ne: "Resolved" } }).sort({ updatedAt: -1 }).lean(),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
  ]);
  res.render("dashboard", { orders, chats, statusCounts: Object.fromEntries(counts.map(x => [x._id, x.count])), error: null });
}));
app.get("/api/orders", asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  if (req.query.q) { const q = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); filter.$or = [{ orderNumber: q }, { customerName: q }]; }
  res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(100).lean());
}));
app.patch("/api/orders/:id/status", asyncRoute(async (req, res) => {
  const allowed = ["Placed", "Confirmed", "Preparing", "Out for delivery", "Delivered", "Cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid order status" });
  const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!order) return res.status(404).json({ error: "Order not found" }); res.json(order);
}));
app.post("/api/support/:id/accept", asyncRoute(async (req, res) => {
  const chat = await SupportChat.findOneAndUpdate({ _id: req.params.id, status: { $ne: "Resolved" } }, { status: "Active", assignedAgent: String(req.body.agent || "Dashboard agent").slice(0, 100) }, { new: true });
  if (!chat) return res.status(404).json({ error: "Conversation not found or resolved" }); res.json(chat);
}));
app.post("/api/support/:id/messages", asyncRoute(async (req, res) => {
  const text = String(req.body.text || "").trim().slice(0, 1200);
  if (!text) return res.status(400).json({ error: "Message cannot be empty" });
  const chat = await SupportChat.findById(req.params.id);
  if (!chat) return res.status(404).json({ error: "Conversation not found" });
  if (chat.status === "Resolved") return res.status(409).json({ error: "Conversation is resolved" });
  chat.messages.push({ sender: "agent", text }); chat.status = "Active"; await chat.save(); res.json(chat);
}));
app.get("/api/support/:id", asyncRoute(async (req, res) => {
  const chat = await SupportChat.findById(req.params.id).lean();
  if (!chat) return res.status(404).json({ error: "Conversation not found" }); res.json(chat);
}));
app.post("/api/support/:id/resolve", asyncRoute(async (req, res) => {
  const chat = await SupportChat.findByIdAndUpdate(req.params.id, { status: "Resolved" }, { new: true });
  if (!chat) return res.status(404).json({ error: "Conversation not found" }); res.json(chat);
}));
app.use((err, req, res, next) => { console.error(err); if (req.path.startsWith("/api/")) return res.status(500).json({ error: "Something went wrong" }); res.status(500).send("Dashboard error. Check server logs."); });
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/goan_craving_dashboard")
  .then(() => app.listen(PORT, () => console.log(`Dashboard running at http://localhost:${PORT}`)))
  .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
