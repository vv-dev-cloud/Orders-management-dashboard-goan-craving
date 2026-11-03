require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const Employee = require("./models/Employee");
const Order = require("./models/Order");
const SupportChat = require("./models/SupportChat");
const deliveryAgentRoutes = require("./routes/deliveryAgentRoutes");
const mapRoutes = require("./routes/mapRoutes");

const app = express();
// Render terminates HTTPS at its proxy; trust the proxy so secure session cookies are issued.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  name: "gc-ops.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000
  }
}));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const requireEmployee = (req, res, next) => {
  if (req.session.employee) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Please sign in to continue." });
  return res.redirect("/login");
};
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const statusLabels = {
  placed: "Placed", confirmed: "Confirmed", preparing: "Preparing",
  out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled"
};
const toDashboardOrder = order => ({
  ...order,
  orderNumber: order.orderNumber || ("GC-" + String(order._id).slice(-8).toUpperCase()),
  customerName: order.deliveryAddress?.fullName || "Customer",
  phone: order.deliveryAddress?.phone || "",
  deliveryAddress: order.deliveryAddress
    ? [order.deliveryAddress.addressLine, order.deliveryAddress.area, order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.postalCode].filter(Boolean).join(", ")
    : "",
  items: (order.items || []).map(item => ({ name: item.name, quantity: item.quantity, price: item.unitPrice })),
  paymentMethod: String(order.paymentMethod || "cod").toUpperCase(),
  paymentStatus: String(order.paymentStatus || "pending").replace(/^./, c => c.toUpperCase()),
  status: statusLabels[order.orderStatus] || "Placed",
  createdAt: order.createdAt
});

app.get("/login", (req, res) => {
  if (req.session.employee) return res.redirect("/");
  res.render("employee-login", { error: null });
});

app.post("/login", loginLimiter, asyncRoute(async (req, res) => {
  const employeeId = String(req.body.employeeId || "").trim().toUpperCase();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!employeeId || !email || !password) {
    return res.status(400).render("employee-login", { error: "Enter your employee ID, email, and password." });
  }
  const employee = await Employee.findOne({ employeeId, email, status: "Active" }).select("+passwordHash");
  const valid = employee && await bcrypt.compare(password, employee.passwordHash);
  if (!valid) {
    return res.status(401).render("employee-login", { error: "The details are incorrect or this account is inactive." });
  }
  req.session.employee = {
    id: String(employee._id),
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    role: employee.role
  };
  employee.lastActiveAt = new Date();
  await employee.save();
  req.session.save(() => res.redirect("/"));
}));

app.use("/api/delivery-agents", requireEmployee, deliveryAgentRoutes);
// Stadia Maps requests are proxied through the server so the API key is never sent to the browser.
app.use("/api/maps", requireEmployee, mapRoutes);

app.post("/logout", requireEmployee, (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/", requireEmployee, asyncRoute(async (req, res) => {
  const [rawOrders, chats] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).limit(100).lean(),
    SupportChat.find({ status: { $ne: "Resolved" } }).sort({ updatedAt: -1 }).limit(100).lean()
  ]);
  const orders = rawOrders.map(toDashboardOrder);
  const statusCounts = {};
  for (const order of orders) statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
  res.render("dashboard", { orders, chats, statusCounts, error: null, employee: req.session.employee });
}));

app.get("/api/orders", requireEmployee, asyncRoute(async (req, res) => {
  // Normalize common order-ID input formats such as "#GC-ABC12345" and "GCABC12345".
  const q = String(req.query.q || "").trim().slice(0, 160);
  const normalizedOrderQuery = q.toUpperCase().replace(/[\s#]/g, "").replace(/^GC-?/, "");
  const status = String(req.query.status || "all");
  const range = String(req.query.range || "all");
  const now = new Date();
  let from = null, to = null;
  const day = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  if (range === "today") from = day(now);
  if (range === "yesterday") { from = day(new Date(now.getTime()-86400000)); to = day(now); }
  if (range === "7days") from = new Date(now.getTime()-7*86400000);
  if (range === "30days") from = new Date(now.getTime()-30*86400000);
  if (range === "thisMonth") from = new Date(now.getFullYear(),now.getMonth(),1);
  if (range === "lastMonth") { from = new Date(now.getFullYear(),now.getMonth()-1,1); to = new Date(now.getFullYear(),now.getMonth(),1); }
  const filter = {};
  if (from || to) filter.createdAt = Object.assign({}, from ? { $gte: from } : {}, to ? { $lt: to } : {});
  const key = status.toLowerCase().replaceAll(" ","_");
  if (status !== "all" && statusLabels[key]) filter.orderStatus = key;
  if (q) {
    // Escape user input before constructing a regular expression.
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    filter.$or = [
      { orderNumber: rx },
      { "deliveryAddress.fullName": rx }, { "deliveryAddress.phone": rx },
      { email: rx }, { customerEmail: rx }, { username: rx }, { userName: rx },
      { "items.name": rx }, { paymentMethod: rx }, { paymentStatus: rx }
    ];
    // Match the deterministic display ID for older records without a saved orderNumber.
    if (/^[A-F0-9]{1,24}$/.test(normalizedOrderQuery)) {
      filter.$or.push({ $expr: { $regexMatch: {
        input: { $concat: ["GC-", { $substrBytes: [{ $toString: "$_id" }, 16, 8] }] },
        regex: normalizedOrderQuery,
        options: "i"
      } } });
    }
    if (mongoose.Types.ObjectId.isValid(q)) filter.$or.push({ _id: new mongoose.Types.ObjectId(q) });
  }
  const found = await Order.find(filter).sort({ createdAt: -1 }).limit(250).lean();
  res.json(found.map(toDashboardOrder));
}));

app.patch("/api/orders/:id/status", requireEmployee, asyncRoute(async (req, res) => {
  const allowed = {
    "Placed": "placed", "Confirmed": "confirmed", "Preparing": "preparing",
    "Out for delivery": "out_for_delivery", "Delivered": "delivered", "Cancelled": "cancelled"
  };
  if (!allowed[req.body.status]) return res.status(400).json({ error: "Invalid order status" });
  const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: allowed[req.body.status] }, { new: true, runValidators: true }).lean();
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(toDashboardOrder(order));
}));

app.post("/api/support/:id/accept", requireEmployee, asyncRoute(async (req, res) => {
  const chat = await SupportChat.findOneAndUpdate(
    { _id: req.params.id, status: { $ne: "Resolved" } },
    { status: "Active", assignedAgent: String(req.body.agent || "Dashboard agent").slice(0, 100) },
    { new: true }
  );
  if (!chat) return res.status(404).json({ error: "Conversation not found or resolved" });
  res.json(chat);
}));

app.post("/api/support/:id/messages", requireEmployee, asyncRoute(async (req, res) => {
  const text = String(req.body.text || "").trim().slice(0, 1200);
  if (!text) return res.status(400).json({ error: "Message cannot be empty" });
  const chat = await SupportChat.findById(req.params.id);
  if (!chat) return res.status(404).json({ error: "Conversation not found" });
  if (chat.status === "Resolved") return res.status(409).json({ error: "Conversation is resolved" });
  chat.messages.push({ sender: "agent", text });
  chat.status = "Active";
  await chat.save();
  res.json(chat);
}));

app.get("/api/support/:id/context", requireEmployee, asyncRoute(async (req, res) => {
  const chat = await SupportChat.findById(req.params.id).lean();
  if (!chat) return res.status(404).json({ error: "Conversation not found" });

  // Customer context is limited to the account linked to this support conversation.
  const rawOrders = await Order.find({ user: chat.customerId }).sort({ createdAt: -1 }).limit(30).lean();
  const orders = rawOrders.map(toDashboardOrder);
  const latestAddress = rawOrders.find(order => order.deliveryAddress)?.deliveryAddress || {};
  const customer = {
    id: String(chat.customerId),
    name: chat.customerName || latestAddress.fullName || "Customer",
    email: chat.customerEmail || "",
    phone: latestAddress.phone || "",
    address: [latestAddress.addressLine, latestAddress.area, latestAddress.city, latestAddress.state, latestAddress.postalCode].filter(Boolean).join(", ")
  };
  res.json({ customer, orders });
}));

app.get("/api/support/:id", requireEmployee, asyncRoute(async (req, res) => {
  const chat = await SupportChat.findById(req.params.id).lean();
  if (!chat) return res.status(404).json({ error: "Conversation not found" });
  res.json(chat);
}));

app.post("/api/support/:id/resolve", requireEmployee, asyncRoute(async (req, res) => {
  const chat = await SupportChat.findByIdAndUpdate(req.params.id, { status: "Resolved" }, { new: true });
  if (!chat) return res.status(404).json({ error: "Conversation not found" });
  res.json(chat);
}));

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith("/api/")) {
    const status = Number(err.status) >= 400 && Number(err.status) <= 599 ? Number(err.status) : 500;
    const message = status === 500 ? "Something went wrong" : String(err.message || "Map request failed");
    return res.status(status).json({ error: message });
  }
  res.status(500).send("Dashboard error. Check server logs.");
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log("Dashboard connected to MongoDB and listening on " + PORT)))
  .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
