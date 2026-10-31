let selectedChatId = null;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function statusClass(status) {
  return String(status || "").toLowerCase().replaceAll(" ", "-");
}

function filterOrders() {
  const query = document.getElementById("orderSearch").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  document.querySelectorAll("#ordersTable tr[data-search]").forEach(row => {
    const matchesQuery = row.dataset.search.includes(query);
    const matchesStatus = status === "all" || row.dataset.status === status;
    row.hidden = !(matchesQuery && matchesStatus);
  });
}

document.getElementById("orderSearch").addEventListener("input", filterOrders);
document.getElementById("statusFilter").addEventListener("change", filterOrders);

document.querySelectorAll(".view-order").forEach(button => {
  button.addEventListener("click", async () => {
    const row = button.closest("tr");
    const cells = row.querySelectorAll("td");
    const id = button.dataset.order;
    const orderNumber = cells[0].innerText.split("\n")[0];
    const customer = cells[1].innerText.split("\n")[0];
    const total = cells[2].innerText;
    const payment = cells[3].innerText;
    const currentStatus = cells[4].innerText;
    document.getElementById("orderDetailBody").innerHTML = `
      <div class="detail-grid">
        <div class="detail-cell"><small>Order</small><strong>${escapeHtml(orderNumber)}</strong></div>
        <div class="detail-cell"><small>Customer</small><strong>${escapeHtml(customer)}</strong></div>
        <div class="detail-cell"><small>Total</small><strong>${escapeHtml(total)}</strong></div>
        <div class="detail-cell"><small>Payment status / method</small><strong>${escapeHtml(payment)}</strong></div>
      </div>
      <label for="statusUpdate">Order status</label>
      <div class="status-edit"><select class="field" id="statusUpdate">
        ${["Placed","Confirmed","Preparing","Out for delivery","Delivered","Cancelled"].map(s => `<option ${s === currentStatus ? "selected" : ""}>${s}</option>`).join("")}
      </select><button class="button primary" id="saveOrderStatus">Save status</button></div>
      <p class="notice">Order status is updated in MongoDB. Payment status is kept separate and is not changed here.</p>`;
    document.getElementById("orderModal").classList.add("visible");
    document.getElementById("saveOrderStatus").addEventListener("click", async () => {
      const status = document.getElementById("statusUpdate").value;
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (!response.ok) return alert(result.error || "Could not update order status");
      cells[4].innerHTML = `<span class="status ${statusClass(result.status)}">${escapeHtml(result.status)}</span>`;
      row.dataset.status = result.status;
      document.getElementById("orderModal").classList.remove("visible");
      filterOrders();
    });
  });
});

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
