let selectedChatId = null;
const pageNames = { overview: "Overview", orders: "Orders & history", support: "Customer support", reports: "Reports" };
function showPage(name) {
  if (!pageNames[name]) name = "overview";
  document.querySelectorAll(".dashboard-page").forEach(page => page.classList.toggle("active-page", page.id === "page-" + name));
  document.querySelectorAll("[data-page].nav").forEach(link => link.classList.toggle("active", link.dataset.page === name));
  document.getElementById("pageTitle").textContent = pageNames[name];
  document.querySelector(".content").scrollTop = 0;
  if (name === "orders") filterOrders();
}
document.querySelectorAll("[data-page]").forEach(item => item.addEventListener("click", () => showPage(item.dataset.page)));
document.getElementById("workspaceMenuToggle").addEventListener("click", () => {
  const menu = document.getElementById("workspaceMenu");
  const open = menu.classList.toggle("menu-open");
  document.getElementById("workspaceMenuToggle").setAttribute("aria-expanded", String(open));
});
document.getElementById("workspaceMenu").classList.add("menu-open");


const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function statusClass(status) {
  return String(status || "").toLowerCase().replaceAll(" ", "-");
}

let orderSearchTimer;
async function filterOrders() {
  const q = document.getElementById("orderSearch").value.trim();
  const status = document.getElementById("statusFilter").value;
  const range = document.getElementById("dateRange").value;
  const params = new URLSearchParams({ q, status, range });
  try {
    const response = await fetch(`/api/orders?${params.toString()}`);
    const orders = await response.json();
    if (!response.ok) throw new Error(orders.error || "Could not load order history");
    const body = document.getElementById("ordersTable");
    body.innerHTML = orders.length ? orders.map(order => {
      const itemSummary = (order.items || []).map(item => `${item.name} × ${item.quantity}`).join(", ");
      const date = order.createdAt ? new Date(order.createdAt).toLocaleString() : "—";
      const pay = `${order.paymentStatus || "Pending"} · ${order.paymentMethod || "—"}`;
      return `<tr data-search="${escapeHtml([order.orderNumber,order.customerName,order.phone,order.email,itemSummary,pay].join(" ").toLowerCase())}" data-status="${escapeHtml(order.status)}">
        <td><strong class="order-id">${escapeHtml(order.orderNumber)}</strong><small>${escapeHtml(date)}</small></td>
        <td><strong>${escapeHtml(order.customerName)}</strong><small>${escapeHtml(itemSummary || "No item details")}</small></td>
        <td><strong>₹${Number(order.total||0).toLocaleString("en-IN")}</strong></td>
        <td><span class="payment">${escapeHtml(order.paymentStatus || "Pending")}</span><small>${escapeHtml(order.paymentMethod || "—")}</small></td>
        <td><span class="status ${statusClass(order.status)}">${escapeHtml(order.status)}</span></td>
        <td><button class="button tiny view-order" data-order="${escapeHtml(order._id)}" data-number="${escapeHtml(order.orderNumber)}" data-customer="${escapeHtml(order.customerName)}" data-total="${Number(order.total||0)}" data-payment="${escapeHtml(pay)}" data-status="${escapeHtml(order.status)}">Details</button></td></tr>`;
    }).join("") : '<tr><td colspan="6" class="empty">No matching orders found.</td></tr>';
    document.querySelectorAll(".view-order").forEach(button => button.addEventListener("click", () => showOrderDetails(button)));
  } catch (error) { console.error(error); }
}
function showOrderDetails(button) {
  const { number, customer, total, payment, status: currentStatus } = button.dataset;
  const id = button.dataset.order;
  document.getElementById("orderDetailBody").innerHTML = `<div class="detail-grid">
    <div class="detail-cell"><small>Order ID</small><strong>${escapeHtml(number)}</strong></div>
    <div class="detail-cell"><small>Customer</small><strong>${escapeHtml(customer)}</strong></div>
    <div class="detail-cell"><small>Order total</small><strong>₹${Number(total).toLocaleString("en-IN")}</strong></div>
    <div class="detail-cell"><small>Payment status / method</small><strong>${escapeHtml(payment)}</strong></div></div>
    <label for="statusUpdate">Order status</label><div class="status-edit"><select class="field" id="statusUpdate">${["Placed","Confirmed","Preparing","Out for delivery","Delivered","Cancelled"].map(s=>`<option ${s===currentStatus?"selected":""}>${s}</option>`).join("")}</select><button class="button primary" id="saveOrderStatus">Save status</button></div>
    <p class="notice">Payment status is displayed separately and is not changed by order-status updates.</p>`;
  document.getElementById("orderModal").classList.add("visible");
  document.getElementById("saveOrderStatus").onclick = async () => {
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}/status`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:document.getElementById("statusUpdate").value}) });
    const result = await response.json(); if (!response.ok) return alert(result.error || "Could not update order");
    document.getElementById("orderModal").classList.remove("visible"); await filterOrders();
  };
}
document.getElementById("orderSearch").addEventListener("input", () => { clearTimeout(orderSearchTimer); orderSearchTimer=setTimeout(filterOrders,250); });
document.getElementById("statusFilter").addEventListener("change", filterOrders);
document.getElementById("dateRange").addEventListener("change", filterOrders);
filterOrders();
document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("orderModal").classList.remove("visible");
});
document.getElementById("orderModal").addEventListener("click", event => {
  if (event.target.id === "orderModal") event.currentTarget.classList.remove("visible");
});

async function openChat(id, card) {
  selectedChatId = id;
  document.querySelectorAll(".chat-card").forEach(el => el.classList.toggle("selected", el === card));
  const response = await fetch(`/api/support/${encodeURIComponent(id)}/accept`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent: "Dashboard agent" })
  });
  const chat = await response.json();
  if (!response.ok) return alert(chat.error || "Unable to accept conversation");
  document.getElementById("chatPanel").classList.add("visible");
  const contextHost = document.getElementById("customerContext");
  contextHost.innerHTML = '<div class="context-loading">Loading customer profile and orders…</div>';
  try {
    const contextResponse = await fetch(`/api/support/${encodeURIComponent(id)}/context`);
    const context = await contextResponse.json();
    if (!contextResponse.ok) throw new Error(context.error || "Could not load customer details");
    const customer = context.customer || {};
    const orders = context.orders || [];
    contextHost.innerHTML = `
      <div class="context-heading"><div><small>CUSTOMER PROFILE</small><h4>${escapeHtml(customer.name || chat.customerName || "Customer")}</h4></div><span class="context-order-count">${orders.length} order(s)</span></div>
      <div class="context-details">
        <div><small>Mobile</small><strong>${escapeHtml(customer.phone || "Not provided")}</strong></div>
        <div><small>Email</small><strong>${escapeHtml(customer.email || "Not provided")}</strong></div>
        <div class="context-address"><small>Latest delivery address</small><strong>${escapeHtml(customer.address || "No saved order address")}</strong></div>
      </div>
      <div class="context-orders"><div class="context-orders-title">RECENT ORDER HISTORY</div>
        ${orders.length ? orders.map(order => `
          <article class="context-order">
            <div><strong>${escapeHtml(order.orderNumber || "Order")}</strong><small>${escapeHtml(order.createdAt ? new Date(order.createdAt).toLocaleString() : "Date unavailable")}</small></div>
            <div class="context-order-right"><strong>₹${escapeHtml(Number(order.total || 0).toLocaleString("en-IN"))}</strong><small>${escapeHtml(order.status || "Placed")}</small></div>
            <p>${escapeHtml((order.items || []).map(item => `${item.name} × ${item.quantity}`).join(", ") || "No item details")}</p>
          </article>`).join("") : '<div class="context-empty">No orders linked to this customer account.</div>'}
      </div>`;
  } catch (error) {
    contextHost.innerHTML = `<div class="context-loading">${escapeHtml(error.message || "Customer details unavailable.")}</div>`;
  }
  document.getElementById("chatHeading").textContent = `${chat.customerName} · ${chat.orderNumber || "Support request"}`;
  document.getElementById("chatMessages").innerHTML = (chat.messages || []).map(message =>
    `<div class="message ${message.sender === "agent" ? "agent" : ""}">${escapeHtml(message.text)}</div>`
  ).join("");
  document.getElementById("chatMessages").scrollTop = document.getElementById("chatMessages").scrollHeight;
}

document.querySelectorAll(".chat-card").forEach(card => card.addEventListener("click", () => openChat(card.dataset.chat, card)));

document.getElementById("replyForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedChatId) return alert("Select a conversation first.");
  const input = document.getElementById("replyText");
  const text = input.value.trim();
  if (!text) return;
  const response = await fetch(`/api/support/${encodeURIComponent(selectedChatId)}/messages`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text })
  });
  const chat = await response.json();
  if (!response.ok) return alert(chat.error || "Message could not be sent");
  input.value = "";
  document.getElementById("chatMessages").innerHTML = chat.messages.map(message =>
    `<div class="message ${message.sender === "agent" ? "agent" : ""}">${escapeHtml(message.text)}</div>`
  ).join("");
  document.getElementById("chatMessages").scrollTop = document.getElementById("chatMessages").scrollHeight;
});

document.getElementById("resolveChat").addEventListener("click", async () => {
  if (!selectedChatId) return;
  const response = await fetch(`/api/support/${encodeURIComponent(selectedChatId)}/resolve`, { method: "POST" });
  const result = await response.json();
  if (!response.ok) return alert(result.error || "Could not resolve chat");
  const card = document.querySelector(`.chat-card[data-chat="${CSS.escape(selectedChatId)}"]`);
  if (card) card.remove();
  selectedChatId = null;
  document.getElementById("chatPanel").classList.remove("visible");
});

document.getElementById("exportCsv").addEventListener("click", () => {
  const rows = [["Order","Customer","Total","Payment","Status"]];
  document.querySelectorAll("#ordersTable tr[data-search]").forEach(row => {
    if (row.hidden) return;
    rows.push(Array.from(row.querySelectorAll("td")).slice(0,5).map(cell => cell.innerText.replace(/\n/g, " ").trim()));
  });
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  link.download = "goan-craving-orders.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});
