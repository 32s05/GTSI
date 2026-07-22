function calculateArrivalTime(departureTimeStr, durationMins) {
  if (!departureTimeStr || !durationMins) return "";
  
  // Parse "08:00 AM" format
  const parts = departureTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!parts) return "";
  
  let hours = parseInt(parts[1], 10);
  const minutes = parseInt(parts[2], 10);
  const modifier = parts[3].toUpperCase();
  
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  
  const date = new Date();
  date.setHours(hours, minutes + Number(durationMins), 0, 0);
  
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

async function loadSchedulesOnly(user) {
  const headers = { "Content-Type": "application/json", "x-user-id": user.id };
  try {
    const [scheduleData, routeData] = await Promise.all([
      GT.api("/api/admin/schedules", { headers }),
      GT.api("/api/routes")
    ]);

    const schedules = scheduleData.schedules || [];
    const routes = routeData.routes || [];
    const routeMap = Object.fromEntries(routes.map((route) => [route.id, route]));

    const scheduleSelect = document.getElementById("schedule-route");
    if (scheduleSelect) {
      scheduleSelect.innerHTML = routes.map((route) => `<option value="${route.id}">${route.id} — ${route.originCode} → ${route.destCode}</option>`).join("");
    }

    return { schedules, routeMap };
  } catch (err) {
    GT.toast("Failed to load schedules: " + err.message, "error");
    return { schedules: [], routeMap: {} };
  }
}

function viewScheduleDetails(id, routeLabel, date, departureTime, arrivalTime, busType, plateNumber, totalSeats, status) {
  document.getElementById("detail-schedule-id").value = id;
  document.getElementById("detail-schedule-route").value = routeLabel;
  document.getElementById("detail-schedule-date").value = date;
  document.getElementById("detail-schedule-departure").value = departureTime;
  document.getElementById("detail-schedule-arrival").value = arrivalTime || "—";
  document.getElementById("detail-schedule-bus").value = `${busType} (${plateNumber || 'No Plate'})`;
  document.getElementById("detail-schedule-seats").value = totalSeats;
  document.getElementById("detail-schedule-status").value = status;
  
  document.getElementById("schedule-details-modal").classList.remove("hide");
}

function editSchedule(id, routeId, departureTime, durationMins, busType, plateNumber, date, totalSeats, status) {
  document.getElementById("schedule-modal-title").textContent = "Edit Schedule";
  document.getElementById("schedule-submit-btn").textContent = "Update Schedule";
  document.getElementById("schedule-edit-id").value = id;
  document.getElementById("schedule-route").value = routeId;
  document.getElementById("schedule-departure-time").value = departureTime;
  document.getElementById("schedule-duration").value = durationMins;
  document.getElementById("schedule-bus-type").value = busType || "Economy";
  document.getElementById("schedule-plate-number").value = plateNumber;
  document.getElementById("schedule-date").value = date;
  document.getElementById("schedule-seats").value = totalSeats;
  document.getElementById("schedule-status").value = status;
  
  updateCalculatedArrival();
  document.getElementById("schedule-modal").classList.remove("hide");
}


// Hook up automatic arrival time updates in modal
document.getElementById("schedule-departure-time")?.addEventListener("change", updateCalculatedArrival);
document.getElementById("schedule-duration")?.addEventListener("input", updateCalculatedArrival);

function updateCalculatedArrival() {
  const depTime = document.getElementById("schedule-departure-time").value;
  const duration = document.getElementById("schedule-duration").value;
  const arrivalInput = document.getElementById("schedule-arrival-time");
  if (arrivalInput) {
    arrivalInput.value = calculateArrivalTime(depTime, duration);
  }
}

async function setupSchedulesPage(user) {
  const modal = document.getElementById("schedule-modal");
  const detailsModal = document.getElementById("schedule-details-modal");
  const form = document.getElementById("schedule-form");
  const openBtn = document.getElementById("open-schedule-modal-btn");
  const closeBtn = document.getElementById("close-schedule-modal-btn");
  const closeDetailsBtn = document.getElementById("close-details-modal-btn");
  const routeSelect = document.getElementById("schedule-route");
  const durationInput = document.getElementById("schedule-duration");
  const scheduleSearchInput = document.getElementById("schedule-search-input");
  const scheduleRowsPerPageSelect = document.getElementById("schedule-rows-per-page");
  const schedulePrevPageButton = document.getElementById("schedule-prev-page");
  const scheduleNextPageButton = document.getElementById("schedule-next-page");
  const schedulePageInfo = document.getElementById("schedule-page-info");

  let routes = [];
  let allSchedules = [];
  let routeMap = {};
  let currentSchedulePage = 1;
  let scheduleRowsPerPage = Number(scheduleRowsPerPageSelect?.value) || 25;

  function updateTablePaginationControls(totalItems) {
    const pageCount = Math.max(1, Math.ceil(totalItems / scheduleRowsPerPage));
    if (currentSchedulePage > pageCount) currentSchedulePage = pageCount;
    if (schedulePageInfo) schedulePageInfo.textContent = `Page ${currentSchedulePage} of ${pageCount}`;
    if (schedulePrevPageButton) schedulePrevPageButton.disabled = currentSchedulePage <= 1;
    if (scheduleNextPageButton) scheduleNextPageButton.disabled = currentSchedulePage >= pageCount;
    const controls = document.getElementById("schedule-pagination-controls");
    if (controls) {
      controls.classList.toggle("hidden", totalItems === 0);
    }
    return pageCount;
  }

  function renderScheduleTable() {
    const searchTerm = scheduleSearchInput?.value.trim().toLowerCase() || "";
    const filteredSchedules = allSchedules.filter((schedule) => {
      const routeLabel = routeMap[schedule.routeId] ? `${routeMap[schedule.routeId].originCode} → ${routeMap[schedule.routeId].destCode}` : schedule.routeId;
      const searchText = `${routeLabel} ${schedule.date} ${schedule.departureTime} ${schedule.plateNumber || ''}`.toLowerCase();
      return searchText.includes(searchTerm);
    });

    const totalItems = filteredSchedules.length;
    const pageCount = updateTablePaginationControls(totalItems);
    const start = (currentSchedulePage - 1) * scheduleRowsPerPage;
    const end = start + scheduleRowsPerPage;
    const pageItems = filteredSchedules.slice(start, end);

    const table = document.getElementById("schedules-table-body");
    table.innerHTML = pageItems.map((schedule) => {
      const routeLabel = routeMap[schedule.routeId] ? `${routeMap[schedule.routeId].originCode} → ${routeMap[schedule.routeId].destCode}` : schedule.routeId;
      const searchText = `${routeLabel} ${schedule.date} ${schedule.departureTime} ${schedule.plateNumber || ''}`.toLowerCase();
      return `
        <tr class="schedule-row" data-search="${searchText}">
          <td><strong>${routeLabel}</strong></td>
          <td>${schedule.date}</td>
          <td>${schedule.departureTime}</td>
          <td>${schedule.plateNumber || "—"}</td>
          <td><span class="badge ${schedule.status === 'cancelled' ? 'badge-danger' : schedule.status === 'delayed' ? 'badge-gold' : 'badge-success'}">${schedule.status}</span></td>
          <td>
            <div style="display: flex; gap: 0.6rem; align-items: center;">
              <button class="btn btn-ghost btn-sm" title="View Details" onclick="viewScheduleDetails('${schedule.id}', '${routeLabel}', '${schedule.date}', '${schedule.departureTime}', '${schedule.arrivalTime || ''}', '${schedule.busType || 'Economy'}', '${schedule.plateNumber || ''}', ${schedule.totalSeats}, '${schedule.status}')" style="padding: 0.4rem 0.6rem;">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-ghost btn-sm" title="Edit" onclick="editSchedule('${schedule.id}', '${schedule.routeId}', '${schedule.departureTime}', '${schedule.durationMins || 120}', '${schedule.busType || 'Economy'}', '${schedule.plateNumber || ''}', '${schedule.date}', ${schedule.totalSeats}, '${schedule.status}')" style="padding: 0.4rem 0.6rem;">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-danger-ghost btn-sm" title="Delete" onclick="deleteSchedule('${schedule.id}')" style="padding: 0.4rem 0.6rem;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // Fetch routes to get duration when route is selected
  async function fetchRoutes() {
    try {
      const { routes: r } = await GT.api("/api/routes");
      routes = r || [];
    } catch (err) {
      console.error("Failed to fetch routes:", err);
    }
  }

  // Auto-populate duration when route is selected
  routeSelect?.addEventListener("change", () => {
    const selectedRouteId = routeSelect.value;
    const selectedRoute = routes.find(r => r.id === selectedRouteId);
    if (selectedRoute) {
      durationInput.value = selectedRoute.durationMins;
      updateCalculatedArrival();
    }
  });

  if (scheduleRowsPerPageSelect) {
    scheduleRowsPerPageSelect.addEventListener("change", () => {
      scheduleRowsPerPage = Number(scheduleRowsPerPageSelect.value) || 25;
      currentSchedulePage = 1;
      renderScheduleTable();
    });
  }

  if (schedulePrevPageButton) {
    schedulePrevPageButton.addEventListener("click", () => {
      if (currentSchedulePage > 1) {
        currentSchedulePage -= 1;
        renderScheduleTable();
      }
    });
  }

  if (scheduleNextPageButton) {
    scheduleNextPageButton.addEventListener("click", () => {
      currentSchedulePage += 1;
      renderScheduleTable();
    });
  }

  if (scheduleSearchInput) {
    scheduleSearchInput.addEventListener("input", () => {
      currentSchedulePage = 1;
      renderScheduleTable();
    });
  }

  populateScheduleBusTypeOptions();
  await fetchRoutes();

  openBtn?.addEventListener("click", () => {
    document.getElementById("schedule-modal-title").textContent = "Add New Schedule";
    document.getElementById("schedule-submit-btn").textContent = "Save Schedule";
    form.reset();
    document.getElementById("schedule-edit-id").value = "";
    document.getElementById("schedule-status").value = "active";
    updateCalculatedArrival();
    modal.classList.remove("hide");
  });

  closeBtn?.addEventListener("click", () => modal.classList.add("hide"));
  closeDetailsBtn?.addEventListener("click", () => detailsModal.classList.add("hide"));

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = document.getElementById("schedule-edit-id").value;
    const routeId = document.getElementById("schedule-route").value;
    const departureTime = document.getElementById("schedule-departure-time").value;
    
    let generatedId = editId;
    if (!generatedId) {
      const timeCode = departureTime.replace(/[:\s]/g, "").slice(0, 4) + (departureTime.includes("PM") ? "PM" : "AM");
      generatedId = `TRIP-${routeId}-${timeCode}`;
    }

    const payload = {
      id: generatedId,
      routeId: routeId,
      departureTime: departureTime,
      arrivalTime: document.getElementById("schedule-arrival-time").value.trim(),
      durationMins: Number(document.getElementById("schedule-duration").value),
      busType: document.getElementById("schedule-bus-type").value,
      plateNumber: document.getElementById("schedule-plate-number").value.trim(),
      date: document.getElementById("schedule-date").value,
      totalSeats: Number(document.getElementById("schedule-seats").value),
      status: document.getElementById("schedule-status").value
    };

    try {
      const endpoint = editId ? `/api/admin/schedules/${editId}` : "/api/admin/schedules";
      const method = editId ? "PUT" : "POST";
      await GT.api(endpoint, {
        method,
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify(payload)
      });
      GT.toast(editId ? "Schedule updated successfully." : "Schedule added successfully!", "success");
      modal.classList.add("hide");
      form.reset();
      const loaded = await loadSchedulesOnly(user);
      allSchedules = loaded.schedules;
      routeMap = loaded.routeMap;
      currentSchedulePage = 1;
      renderScheduleTable();
    } catch (err) {
      GT.toast(err.message, "error");
    }
  });

  const loaded = await loadSchedulesOnly(user);
  allSchedules = loaded.schedules;
  routeMap = loaded.routeMap;
  renderScheduleTable();
}

function setupScheduleSearch() {
  const searchInput = document.getElementById("schedule-search-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll(".schedule-row");
    
    rows.forEach(row => {
      const searchText = row.getAttribute("data-search");
      row.style.display = searchText.includes(searchTerm) ? "" : "none";
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  GT.renderNav("admin");
  GT.renderFooter();

  const user = GT.getUser();
  if (!user || user.role !== "admin") {
    GT.toast("Unauthorized access. Administrator rights required.", "error");
    setTimeout(() => { location.href = "/index.ejs"; }, 1000);
    return;
  }

  const path = window.location.pathname;

  if (path.includes("admin-routes.ejs")) {
    setupRoutePage(user);
    return;
  }

  if (path.includes("admin-terminals.ejs")) {
    setupTerminalPage(user);
    return;
  }

  if (path.includes("admin-bookings.ejs")) {
    setupBookingsPage(user);
    return;
  }

  if (path.includes("admin-users.ejs")) {
    setupUsersPage(user);
    return;
  }

  if (path.includes("admin-schedules.ejs")) {
    setupSchedulesPage(user);
    return;
  }

  await loadAdminData(user);
});

async function setupRoutePage(user) {
  const modal = document.getElementById("route-modal");
  const form = document.getElementById("route-form");
  const openBtn = document.getElementById("open-route-modal-btn");
  const closeBtn = document.getElementById("close-modal-btn");
  const originSelect = document.getElementById("origin-code");
  const destSelect = document.getElementById("dest-code");
  const routeIdInput = document.getElementById("route-id");
  const durationInput = document.getElementById("duration");
  const basePriceInput = document.getElementById("base-price");

  let terminals = [];

  // Fetch terminals and populate dropdowns
  async function populateTerminalDropdowns() {
    try {
      const { terminals: t } = await GT.api("/api/terminals");
      terminals = t || [];
      const options = terminals.map((t) => `<option value="${t.code}">${t.name} (${t.code})</option>`).join("");
      originSelect.innerHTML = `<option value="">Select origin...</option>${options}`;
      destSelect.innerHTML = `<option value="">Select destination...</option>${options}`;
    } catch (err) {
      GT.toast("Failed to load terminals: " + err.message, "error");
    }
  }

  // Auto-generate Route ID
  function generateRouteId() {
    const origin = originSelect.value;
    const dest = destSelect.value;
    if (origin && dest) {
      routeIdInput.value = `RT-${origin}-${dest}`;
    } else {
      routeIdInput.value = "";
    }
  }

  // Calculate base price based on duration
  function calculateBasePrice() {
    const duration = Number(durationInput.value);
    if (duration > 0) {
      const price = Math.ceil(duration * 3.5);
      basePriceInput.value = price;
    }
  }

  // Add event listeners to dropdowns
  originSelect.addEventListener("change", () => {
    generateRouteId();
    if (originSelect.value === destSelect.value) {
      destSelect.value = "";
      GT.toast("Destination must be different from origin.", "warning");
    }
  });

  destSelect.addEventListener("change", () => {
    generateRouteId();
    if (originSelect.value === destSelect.value) {
      GT.toast("Destination must be different from origin.", "warning");
      destSelect.value = "";
    }
  });

  durationInput.addEventListener("change", calculateBasePrice);

  openBtn?.addEventListener("click", () => {
    document.getElementById("route-modal-title").textContent = "Add New Route";
    document.getElementById("route-submit-btn").textContent = "Save Route";
    form.reset();
    document.getElementById("route-edit-id").value = "";
    routeIdInput.value = "";
    modal.classList.remove("hide");
  });

  closeBtn?.addEventListener("click", () => modal.classList.add("hide"));

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (originSelect.value === destSelect.value) {
      GT.toast("Origin and destination must be different.", "error");
      return;
    }

    const editId = document.getElementById("route-edit-id").value;
    const payload = {
      id: routeIdInput.value.trim(),
      originCode: originSelect.value.trim().toUpperCase(),
      destCode: destSelect.value.trim().toUpperCase(),
      durationMins: Number(durationInput.value),
      basePrice: Number(basePriceInput.value)
    };

    try {
      const endpoint = editId ? `/api/admin/routes/${editId}` : "/api/admin/routes";
      const method = editId ? "PUT" : "POST";
      await GT.api(endpoint, {
        method,
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify(payload)
      });
      GT.toast(editId ? "Route updated successfully." : "Route added successfully!", "success");
      modal.classList.add("hide");
      form.reset();
      routeIdInput.value = "";
      await loadRoutesOnly(user);
    } catch (err) {
      GT.toast(err.message, "error");
    }
  });

  await populateTerminalDropdowns();
  await loadRoutesOnly(user);
}

async function setupTerminalPage(user) {
  const modal = document.getElementById("terminal-modal");
  const form = document.getElementById("terminal-form");
  const openBtn = document.getElementById("open-terminal-modal-btn");
  const closeBtn = document.getElementById("close-terminal-modal-btn");

  openBtn?.addEventListener("click", () => {
    document.getElementById("terminal-modal-title").textContent = "Add New Terminal";
    document.getElementById("terminal-submit-btn").textContent = "Save Terminal";
    form.reset();
    document.getElementById("terminal-edit-id").value = "";
    modal.classList.remove("hide");
  });

  closeBtn?.addEventListener("click", () => modal.classList.add("hide"));

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = document.getElementById("terminal-edit-id").value;
    const payload = {
      code: document.getElementById("terminal-code").value.trim().toUpperCase(),
      name: document.getElementById("terminal-name").value.trim(),
      region: document.getElementById("terminal-region").value.trim()
    };

    try {
      const endpoint = editId ? `/api/admin/terminals/${editId}` : "/api/admin/terminals";
      const method = editId ? "PUT" : "POST";
      await GT.api(endpoint, {
        method,
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify(payload)
      });
      GT.toast(editId ? "Terminal updated successfully." : "Terminal added successfully!", "success");
      modal.classList.add("hide");
      form.reset();
      await loadTerminalsOnly(user);
    } catch (err) {
      GT.toast(err.message, "error");
    }
  });

  await loadTerminalsOnly(user);
}

async function setupBookingsPage(user) {
  const downloadBtn = document.getElementById("download-bookings-btn");
  downloadBtn?.addEventListener("click", () => exportBookingsReport());
  await loadBookingsOnly(user);
}

function populateScheduleBusTypeOptions() {
  const select = document.getElementById("schedule-bus-type");
  if (!select) return;

  const busTypes = window.BUS_TYPES || ["Economy", "Deluxe", "Premium"];
  select.innerHTML = busTypes.map((type) => `<option value="${type}">${type}</option>`).join("");
  select.value = "Economy";
}

async function setupUsersPage(user) {
  const modal = document.getElementById("user-modal");
  const form = document.getElementById("user-form");
  const openBtn = document.getElementById("open-user-modal-btn");
  const closeBtn = document.getElementById("close-user-modal-btn");

  openBtn?.addEventListener("click", () => {
    document.getElementById("user-modal-title").textContent = "Add New User";
    document.getElementById("user-submit-btn").textContent = "Save User";
    form.reset();
    document.getElementById("user-edit-id").value = "";
    document.getElementById("user-password").required = true;
    modal.classList.remove("hide");
  });

  closeBtn?.addEventListener("click", () => modal.classList.add("hide"));

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = document.getElementById("user-edit-id").value;
    const payload = {
      name: document.getElementById("user-name").value.trim(),
      email: document.getElementById("user-email").value.trim().toLowerCase(),
      contact: document.getElementById("user-contact").value.trim(),
      role: document.getElementById("user-role").value,
      password: document.getElementById("user-password").value
    };

    if (!editId && !payload.password) {
      GT.toast("Password is required for new users.", "error");
      return;
    }

    try {
      const endpoint = editId ? `/api/admin/users/${editId}` : "/api/admin/users";
      const method = editId ? "PUT" : "POST";
      await GT.api(endpoint, {
        method,
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify(payload)
      });
      GT.toast(editId ? "User updated successfully." : "User added successfully!", "success");
      modal.classList.add("hide");
      form.reset();
      await loadUsersOnly(user);
    } catch (err) {
      GT.toast(err.message, "error");
    }
  });

  await loadUsersOnly(user);
}

async function loadAdminData(user) {
  const headers = { "Content-Type": "application/json", "x-user-id": user.id };

  try {
    const routeData = await GT.api("/api/routes");
    const termData = await GT.api("/api/terminals");
    const bookingData = await GT.api("/api/admin/bookings", { headers });
    const userData = await GT.api("/api/admin/users", { headers });

    const routes = routeData.routes || [];
    const terminals = termData.terminals || [];
    const bookings = bookingData.bookings || [];
    const users = userData.users || [];

    const totalRevenue = bookings.reduce((sum, b) => sum + (Number(b.totalPrice) || 0), 0);
    const confirmedBookings = bookings.filter((b) => b.status !== "cancelled").length;
    const otherBookings = Math.max(bookings.length - confirmedBookings, 0);

    const statusBars = [
      { label: "Confirmed", value: confirmedBookings, color: "var(--success)" },
      { label: "Other", value: otherBookings, color: "var(--warning)" }
    ];
    const maxStatus = Math.max(...statusBars.map((item) => item.value), 1);

    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      const value = bookings.filter((b) => b.createdAt && b.createdAt.slice(0, 10) === key).length;
      return {
        label: date.toLocaleDateString("en-PH", { weekday: "short" }),
        value,
      };
    });
    const maxTrend = Math.max(...trend.map((item) => item.value), 1);

    document.getElementById("admin-stats-grid").innerHTML = `
      <a href="/admin-routes.ejs" class="stat-card stat-card--link">
        <div class="stat-card-top">
          <div class="stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 3v4M17 3v4M6 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/></svg></div>
          <span class="stat-chip">Manage</span>
        </div>
        <div class="stat-value">${routes.length}</div>
        <div class="stat-label">Active routes</div>
        <div class="stat-meta">Live route inventory</div>
      </a>
      <a href="/admin-terminals.ejs" class="stat-card stat-card--link">
        <div class="stat-card-top">
          <div class="stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V9l7-4 7 4v12M9 21v-6h6v6"/></svg></div>
          <span class="stat-chip">Open</span>
        </div>
        <div class="stat-value">${terminals.length}</div>
        <div class="stat-label">Active terminals</div>
        <div class="stat-meta">Connected service points</div>
      </a>
      <a href="/admin-users.ejs" class="stat-card stat-card--link">
        <div class="stat-card-top">
          <div class="stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19a4 4 0 0 0-8 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg></div>
          <span class="stat-chip">Manage</span>
        </div>
        <div class="stat-value">${users.length}</div>
        <div class="stat-label">Active users</div>
        <div class="stat-meta">Staff and customer accounts</div>
      </a>
      <a href="/admin-bookings.ejs" class="stat-card stat-card--link">
        <div class="stat-card-top">
          <div class="stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h5"/></svg></div>
          <span class="stat-chip">View</span>
        </div>
        <div class="stat-value">${bookings.length}</div>
        <div class="stat-label">Total bookings</div>
        <div class="stat-meta">All passenger reservations</div>
      </a>
      <article class="stat-card stat-card--revenue">
        <div class="stat-card-top">
          <div class="stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/><path d="M7 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm10 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg></div>
          <span class="stat-chip stat-chip--gold">Revenue</span>
          <button class="icon-btn revenue-report-btn" type="button" aria-label="Generate revenue report"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10M12 13l4-4M12 13l-4-4M5 19h14"/></svg></button>
        </div>
        <div class="stat-value">${GT.peso(totalRevenue)}</div>
        <div class="stat-label">Confirmed revenue</div>
        <div class="stat-meta">Revenue from active bookings</div>
        <div class="stat-report-status" id="revenue-report-status">Download CSV report</div>
        <div class="revenue-bars">
          ${trend.slice(-4).map((item) => `<div class="revenue-bar-group"><div class="revenue-bar-track"><div class="revenue-bar-fill" style="height:${Math.max((item.value / maxTrend) * 100, 10)}%"></div></div><span>${item.label}</span></div>`).join("")}
        </div>
      </article>
    `;

    document.getElementById("dashboard-visuals").innerHTML = `
      <div class="dashboard-visuals-grid">
        <article class="admin-card chart-card">
          <div class="admin-card-header">
            <h3>Booking status mix</h3>
            <span class="muted">${bookings.length} total</span>
          </div>
          <div class="status-chart">
            ${statusBars.map((item) => `
              <div class="status-row">
                <div class="status-meta">
                  <span class="status-dot" style="background:${item.color}"></span>
                  <span>${item.label}</span>
                </div>
                <div class="status-bar-track">
                  <div class="status-bar-fill" style="width:${Math.max((item.value / maxStatus) * 100, 6)}%; background:${item.color}"></div>
                </div>
                <strong>${item.value}</strong>
              </div>
            `).join("")}
          </div>
          <div class="insight-footnote">Last updated at ${new Date().toLocaleString("en-PH")}</div>
        </article>

        <article class="admin-card chart-card">
          <div class="admin-card-header">
            <h3>Weekly activity</h3>
            <span class="muted">Last 7 days</span>
          </div>
          <div class="mini-bars">
            ${trend.map((item) => `
              <div class="mini-bar-group">
                <div class="mini-bar-track">
                  <div class="mini-bar-fill" style="height:${Math.max((item.value / maxTrend) * 100, 8)}%"></div>
                </div>
                <span>${item.label}</span>
                <strong>${item.value}</strong>
              </div>
            `).join("")}
          </div>
          <div class="insight-footnote">Last updated at ${new Date().toLocaleString("en-PH")}</div>
        </article>
      </div>
    `;

    const revenueCard = document.querySelector(".stat-card--revenue");
    const revenueStatus = document.getElementById("revenue-report-status");

    revenueCard?.addEventListener("click", (event) => {
      if (event.target.closest("button")) {
        event.preventDefault();
        generateRevenueReport(bookings);
        if (revenueStatus) {
          revenueStatus.textContent = "Report downloaded • CSV ready";
          revenueStatus.classList.add("is-active");
        }
      }
    });

    document.querySelector(".revenue-report-btn")?.addEventListener("click", (event) => {
      event.preventDefault();
      generateRevenueReport(bookings);
      if (revenueStatus) {
        revenueStatus.textContent = "Report downloaded • CSV ready";
        revenueStatus.classList.add("is-active");
      }
    });

    const ticker = document.getElementById("live-ticker");
    if (ticker) {
      const tick = () => {
        const now = new Date();
        const date = now.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
        const time = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        ticker.textContent = `${date} | ${time}`;
      };
      tick();
      setInterval(tick, 1000);
    }
  } catch (err) {
    GT.toast("Failed to load admin data: " + err.message, "error");
  }
}

async function loadRoutesOnly(user) {
  const headers = { "Content-Type": "application/json", "x-user-id": user.id };
  try {
    const routeData = await GT.api("/api/routes");
    const routes = routeData.routes || [];
    const routesTable = document.getElementById("routes-table-body");
    routesTable.innerHTML = routes.map((r) => `
      <tr>
        <td><strong>${r.id}</strong></td>
        <td>${r.originCode}</td>
        <td>${r.destCode}</td>
        <td>${r.durationMins} mins</td>
        <td>${GT.peso(r.basePrice)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editRoute('${r.id}', '${r.originCode}', '${r.destCode}', ${r.durationMins}, ${r.basePrice})">Edit</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="deleteRoute('${r.id}')">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    GT.toast("Failed to load routes: " + err.message, "error");
  }
}

async function loadTerminalsOnly(user) {
  const headers = { "Content-Type": "application/json", "x-user-id": user.id };
  try {
    const termData = await GT.api("/api/terminals");
    const terminals = termData.terminals || [];
    const termTable = document.getElementById("terminals-table-body");
    termTable.innerHTML = terminals.map((t) => `
      <tr>
        <td><strong>${t.code}</strong></td>
        <td>${t.name}</td>
        <td>${t.region}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editTerminal('${t.code}', '${t.name}', '${t.region}')">Edit</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="deleteTerminal('${t.code}')">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    GT.toast("Failed to load terminals: " + err.message, "error");
  }
}

async function loadBookingsOnly(user) {
  const headers = { "Content-Type": "application/json", "x-user-id": user.id };
  try {
    const bookingData = await GT.api("/api/admin/bookings", { headers });
    const bookings = bookingData.bookings || [];
    const bookingTable = document.getElementById("bookings-table-body");
    bookingTable.innerHTML = bookings.map((b) => `
      <tr>
        <td><code>${b._id}</code></td>
        <td><small>${b.tripId}</small></td>
        <td>${Array.isArray(b.seats) ? b.seats.join(", ") : ""}</td>
        <td>${GT.peso(b.totalPrice)}</td>
        <td><span class="badge ${b.status === 'cancelled' ? 'badge-danger' : 'badge-success'}">${b.status}</span></td>
      </tr>
    `).join("");
  } catch (err) {
    GT.toast("Failed to load bookings: " + err.message, "error");
  }
}

async function loadUsersOnly(user) {
  const headers = { "Content-Type": "application/json", "x-user-id": user.id };
  try {
    const userData = await GT.api("/api/admin/users", { headers });
    const users = userData.users || [];
    const table = document.getElementById("users-table-body");
    table.innerHTML = users.map((u) => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>${u.contact}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-navy' : 'badge-gold'}">${u.role}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editUser('${u._id}', '${u.name.replace(/'/g, "\\'")}', '${u.email}', '${u.contact}', '${u.role}')">Edit</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="deleteUser('${u._id}')">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    GT.toast("Failed to load users: " + err.message, "error");
  }
}

function generateRevenueReport(bookings) {
  const generatedAt = new Date().toLocaleString();
  const totalRevenue = bookings.reduce((sum, booking) => sum + (Number(booking.totalPrice) || 0), 0);
  const confirmedBookings = bookings.filter((booking) => booking.status !== "cancelled").length;
  const cancelledBookings = bookings.filter((booking) => booking.status === "cancelled").length;

  const csvRows = [
    ["Genesis Transport Revenue Report"],
    ["Generated At", generatedAt],
    ["Total Bookings", bookings.length],
    ["Confirmed Bookings", confirmedBookings],
    ["Cancelled Bookings", cancelledBookings],
    ["Total Revenue", totalRevenue],
    [],
    ["Booking ID", "Trip ID", "Seats", "Total Price", "Status"]
  ];

  bookings.forEach((booking) => {
    csvRows.push([
      booking._id || "",
      booking.tripId || "",
      Array.isArray(booking.seats) ? booking.seats.join(" ") : booking.seats || "",
      Number(booking.totalPrice) || 0,
      booking.status || ""
    ]);
  });

  const csvContent = csvRows.map((row) => row.map((value) => {
    const stringValue = String(value ?? "");
    return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
  }).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const fileName = `genesis-revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);

  GT.toast("Revenue report downloaded.", "success");
}

function editRoute(id, originCode, destCode, durationMins, basePrice) {
  const originSelect = document.getElementById("origin-code");
  const destSelect = document.getElementById("dest-code");
  
  document.getElementById("route-modal-title").textContent = "Edit Route";
  document.getElementById("route-submit-btn").textContent = "Update Route";
  document.getElementById("route-edit-id").value = id;
  document.getElementById("route-id").value = id;
  document.getElementById("origin-code").value = originCode;
  document.getElementById("dest-code").value = destCode;
  document.getElementById("duration").value = durationMins;
  document.getElementById("base-price").value = basePrice;
  document.getElementById("route-modal").classList.remove("hide");
}

function editTerminal(code, name, region) {
  document.getElementById("terminal-modal-title").textContent = "Edit Terminal";
  document.getElementById("terminal-submit-btn").textContent = "Update Terminal";
  document.getElementById("terminal-edit-id").value = code;
  document.getElementById("terminal-code").value = code;
  document.getElementById("terminal-name").value = name;
  document.getElementById("terminal-region").value = region;
  document.getElementById("terminal-modal").classList.remove("hide");
}



function editUser(id, name, email, contact, role) {
  document.getElementById("user-modal-title").textContent = "Edit User";
  document.getElementById("user-submit-btn").textContent = "Update User";
  document.getElementById("user-edit-id").value = id;
  document.getElementById("user-name").value = name;
  document.getElementById("user-email").value = email;
  document.getElementById("user-contact").value = contact;
  document.getElementById("user-role").value = role;
  document.getElementById("user-password").value = "";
  document.getElementById("user-password").required = false;
  document.getElementById("user-modal").classList.remove("hide");
}

async function deleteRoute(routeId) {
  if (!confirm(`Are you sure you want to delete route ${routeId}?`)) return;
  const user = GT.getUser();
  try {
    await GT.api(`/api/admin/routes/${routeId}`, { 
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-user-id": user.id }
    });
    GT.toast("Route deleted.");
    await loadRoutesOnly(user);
  } catch (err) {
    GT.toast(err.message, "error");
  }
}

async function deleteTerminal(code) {
  if (!confirm(`Are you sure you want to delete terminal ${code}?`)) return;
  const user = GT.getUser();
  try {
    await GT.api(`/api/admin/terminals/${code}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-user-id": user.id }
    });
    GT.toast("Terminal deleted.");
    await loadTerminalsOnly(user);
  } catch (err) {
    GT.toast(err.message, "error");
  }
}

async function deleteSchedule(scheduleId) {
  if (!confirm(`Are you sure you want to delete schedule ${scheduleId}?`)) return;
  const user = GT.getUser();
  try {
    await GT.api(`/api/admin/schedules/${scheduleId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-user-id": user.id }
    });
    GT.toast("Schedule deleted.");
    await loadSchedulesOnly(user);
  } catch (err) {
    GT.toast(err.message, "error");
  }
}

async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;
  const user = GT.getUser();
  try {
    await GT.api(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-user-id": user.id }
    });
    GT.toast("User deleted.");
    await loadUsersOnly(user);
  } catch (err) {
    GT.toast(err.message, "error");
  }
}

function exportBookingsReport() {
  const rows = Array.from(document.querySelectorAll("#bookings-table-body tr"));
  const bookings = rows.map((row) => ({
    id: row.cells[0]?.textContent?.trim() || "",
    tripId: row.cells[1]?.textContent?.trim() || "",
    seats: row.cells[2]?.textContent?.trim() || "",
    totalPrice: row.cells[3]?.textContent?.trim() || "",
    status: row.cells[4]?.textContent?.trim() || ""
  }));
  const csvRows = [
    ["Booking ID", "Trip ID", "Seats", "Total Price", "Status"],
    ...bookings.map((booking) => [booking.id, booking.tripId, booking.seats, booking.totalPrice, booking.status])
  ];
  const csvContent = csvRows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "genesis-bookings-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  GT.toast("Bookings report downloaded.", "success");
}