// public/js/dashboard.js
document.addEventListener("DOMContentLoaded", async () => {
  GT.renderNav("dashboard");
  GT.renderFooter();

  const user = GT.requireAuth();
  if (!user) return;

  document.getElementById("welcome-heading").textContent = `Welcome back, ${user.name.split(" ")[0]}`;

  const favKey = `gt_favorites_${user.id}`;
  function getFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem(favKey)) || []);
    } catch {
      return new Set();
    }
  }
  function saveFavorites(set) {
    localStorage.setItem(favKey, JSON.stringify([...set]));
  }

  let bookings = [];
  let cancelTargetId = null;

  try {
    const data = await GT.api(`/api/bookings?userId=${encodeURIComponent(user.id)}`);
    bookings = data.bookings;
  } catch (err) {
    GT.toast(err.message, "error");
  }

  renderStats();
  renderBookingLists();

  // -------- tabs --------
  document.querySelectorAll(".dash-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".dash-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hide"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hide");
      if (tab.dataset.tab === "favorites") renderFavorites();
    });
  });

  function renderStats() {
    const active = bookings.filter((b) => b.status !== "cancelled");
    const totalTrips = active.length;
    const totalSpent = active.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const totalDistanceKm = active.reduce((sum, b) => {
      const mins = b.trip?.durationMins || b.route?.durationMins || 0;
      return sum + Math.round((mins / 60) * 55);
    }, 0);

    const routeCounts = {};
    active.forEach((b) => {
      routeCounts[b.routeId] = (routeCounts[b.routeId] || 0) + 1;
    });
    const topRouteId = Object.keys(routeCounts).sort((a, b) => routeCounts[b] - routeCounts[a])[0];
    const topRoute = active.find((b) => b.routeId === topRouteId)?.route;

    const stats = [
      { icon: iconTicket(), value: totalTrips, label: "Total trips booked" },
      { icon: iconRoad(), value: `${totalDistanceKm.toLocaleString()} km`, label: "Distance travelled" },
      { icon: iconWallet(), value: GT.peso(totalSpent), label: "Total spent" },
      { icon: iconHeart(), value: topRoute ? `${topRoute.origin.name.split(",")[0]} → ${topRoute.destination.name.split(",")[0]}` : "—", label: "Most travelled route" },
    ];

    document.getElementById("stats-grid").innerHTML = stats
      .map(
        (s) => `
      <div class="stat-card">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`
      )
      .join("");
  }

  function isUpcoming(b) {
    if (b.status === "cancelled") return false;
    const dateStr = b.trip?.date;
    if (!dateStr) return true;
    return new Date(dateStr + "T23:59:59") >= new Date();
  }

  function renderBookingLists() {
    const upcoming = bookings.filter(isUpcoming);
    const past = bookings.filter((b) => !isUpcoming(b));

    document.getElementById("upcoming-list").innerHTML = upcoming.length
      ? upcoming.map((b) => bookingCard(b, true)).join("")
      : emptyState("No upcoming trips", "When you book a trip, it'll show up here with your QR ticket ready to go.", "booking.html", "Book a trip");

    document.getElementById("past-list").innerHTML = past.length
      ? past.map((b) => bookingCard(b, false)).join("")
      : emptyState("No past trips yet", "Your completed and cancelled trips will appear here.");

    document.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cancelTargetId = btn.dataset.cancel;
        document.getElementById("cancel-modal").classList.remove("hide");
      });
    });
  }

  function bookingCard(b, showCancel) {
    const route = b.route;
    const trip = b.trip || {};
    const statusBadge =
      b.status === "cancelled"
        ? `<span class="badge badge-danger">Cancelled</span>`
        : showCancel
        ? `<span class="badge badge-success">Confirmed</span>`
        : `<span class="badge" style="background:var(--surface-alt);color:var(--muted);">Completed</span>`;

    return `
    <div class="booking-card">
      <div>
        <div class="flex-between" style="max-width:400px;">
          <strong>${route ? route.origin.name.split(",")[0] : ""} → ${route ? route.destination.name.split(",")[0] : ""}</strong>
          ${statusBadge}
        </div>
        <div class="route-line"><span class="stop"></span><span class="track"></span><span class="stop end"></span></div>
        <div class="booking-card-meta">
          <span class="badge badge-gold">${trip.busType || ""}</span>
          <span class="badge badge-navy">Seats ${b.seats.join(", ")}</span>
          <span class="muted" style="font-size:0.82rem;">${GT.formatDateLong(trip.date)} · ${trip.departure || ""}</span>
        </div>
      </div>
      <div class="booking-card-actions">
        <span class="price">${GT.peso(b.totalPrice)}</span>
        <span class="muted" style="font-size:0.78rem;">${b.id}</span>
        ${showCancel && b.status !== "cancelled" ? `<button class="btn btn-danger-ghost btn-sm" data-cancel="${b.id}">Cancel</button>` : ""}
      </div>
    </div>`;
  }

  function emptyState(title, sub, href, cta) {
    return `
    <div class="empty-state">
      <div class="icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 17V9a2 2 0 012-2h12a2 2 0 012 2v8M4 17h16" stroke="currentColor" stroke-width="1.5"/></svg></div>
      <h3>${title}</h3>
      <p>${sub}</p>
      ${href ? `<a href="${href}" class="btn btn-primary btn-sm mt-8">${cta}</a>` : ""}
    </div>`;
  }

  document.getElementById("cancel-dismiss").addEventListener("click", closeCancelModal);
  document.getElementById("cancel-confirm").addEventListener("click", async () => {
    if (!cancelTargetId) return;
    const btn = document.getElementById("cancel-confirm");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Cancelling…`;
    try {
      const { booking } = await GT.api(`/api/bookings/${encodeURIComponent(cancelTargetId)}`, { method: "DELETE" });
      const idx = bookings.findIndex((b) => b.id === booking.id);
      if (idx > -1) bookings[idx] = { ...bookings[idx], status: "cancelled" };
      GT.toast("Booking cancelled.", "success");
      renderStats();
      renderBookingLists();
    } catch (err) {
      GT.toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Cancel booking";
      closeCancelModal();
    }
  });
  function closeCancelModal() {
    cancelTargetId = null;
    document.getElementById("cancel-modal").classList.add("hide");
  }

  // -------- favorites --------
  let allRoutes = [];
  async function renderFavorites() {
    const list = document.getElementById("favorites-list");
    if (!allRoutes.length) {
      try {
        const { routes } = await GT.api("/api/routes");
        allRoutes = routes;
      } catch (err) {
        GT.toast(err.message, "error");
        return;
      }
    }
    const favorites = getFavorites();
    list.innerHTML = allRoutes
      .map((r) => {
        const isFav = favorites.has(r.id);
        return `
      <div class="route-tile" style="position:relative;">
        <button class="fav-toggle" data-route="${r.id}" aria-label="Toggle favorite" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? "#D4AF37" : "none"}"><path d="M12 21s-7-4.35-9.5-8.5C.8 8.5 3 5 6.5 5c2 0 3.3 1.1 4 2 .7-.9 2-2 4-2 3.5 0 5.7 3.5 4 7.5C19 16.65 12 21 12 21z" stroke="#D4AF37" stroke-width="1.5"/></svg>
        </button>
        <span class="badge badge-navy">${r.origin.region}</span>
        <div class="route-line">
          <span class="stop"></span><span class="track"></span><span class="stop end"></span>
        </div>
        <div class="route-tile-names">
          <span>${r.origin.name}</span>
          <span>${r.destination.name}</span>
        </div>
        <div class="route-tile-footer">
          <span>${GT.formatDurationMins(r.durationMins)}</span>
          <a href="booking.ejs?from=${r.originCode}&to=${r.destCode}" style="color:var(--gold-600);font-weight:600;">Book →</a>
        </div>
      </div>`;
      })
      .join("");

    list.querySelectorAll(".fav-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.route;
        const favs = getFavorites();
        if (favs.has(id)) {
          favs.delete(id);
          GT.toast("Removed from favorites.");
        } else {
          favs.add(id);
          GT.toast("Added to favorites.", "success");
        }
        saveFavorites(favs);
        renderFavorites();
      });
    });
  }

  function iconTicket() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" stroke="#0B1E3D" stroke-width="1.5"/></svg>`;
  }
  function iconRoad() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 3L4 21M15 3l5 18M11 10h2M10.2 14h3.6" stroke="#0B1E3D" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  function iconWallet() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h13a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="#0B1E3D" stroke-width="1.5"/><path d="M16 12h3" stroke="#0B1E3D" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  function iconHeart() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.35-9.5-8.5C.8 8.5 3 5 6.5 5c2 0 3.3 1.1 4 2 .7-.9 2-2 4-2 3.5 0 5.7 3.5 4 7.5C19 16.65 12 21 12 21z" stroke="#0B1E3D" stroke-width="1.5"/></svg>`;
  }
});
