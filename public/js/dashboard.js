let bookings = [];
let cancelTargetId = null;

window.openTicketModal = function(bookingId) {
    const booking = bookings.find(b => b._id === bookingId);
    if (!booking) return;

    const route = booking.route || {};
    const trip = booking.trip || {};

    const ticketCardsHtml = booking.passengers.map((p) => {
        const qrPayload = encodeURIComponent(`GENESIS-TRANSPORT|${booking._id}|${p.seat}|${p.name}`);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${qrPayload}`;

        return `
        <div class="ticket-card">
              <div class="ticket-route" style="font-weight:700; text-align:center; margin-bottom:12px;">
                  ${route.origin.name.split(',')[0]} → ${route.destination.name.split(',')[0]}
              </div>
              <div style="
                  display: flex; 
                  justify-content: center; 
                  align-items: center; 
                  background: #fff; 
                  border-radius: 12px; 
                  padding: 16px; 
                  margin-bottom: 20px;
              ">
                  <img src="${qrUrl}" alt="QR for ${p.name}" style="display: block; width: 100%; max-width: 150px; height: auto;" />
              </div>
              <div class="ticket-id" style="text-align:center; margin:16px 0;"><small>ID: ${booking._id} · Seat ${p.seat}</small></div>
              <div class="ticket-divider" style="border-top:1px dashed #ccc; margin:16px 0;"></div>
              <div class="ticket-details" style="font-size:0.9rem;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>Passenger</span><strong>${p.name}</strong></div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>Date</span><strong>${GT.formatDateLong(trip.date)}</strong></div>
                  <div style="display:flex; justify-content:space-between;"><span>Departure</span><strong>${trip.departure}</strong></div>
              </div>
          </div>`;
    }).join('');

    document.getElementById("ticket-modal-content").innerHTML = `
        <div class="ticket-panel" style="background:#fff; border-radius:24px; width:90%; max-width:500px; margin:auto; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <span class="close-modal-btn" onclick="closeTicketModal()">&times;</span>

            <h2 style="text-align:center; margin:0 0 8px;">Booking confirmed!</h2>
            <p style="text-align:center; color:#666; margin-bottom:0;">Show this QR ticket at the terminal gate.</p>
            
            <div id="scroll-container" class="tickets-scroll-container">
                ${ticketCardsHtml}
            </div>
            
            <div id="pagination-dots" class="pagination-dots">
                ${booking.passengers.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
            </div>
        </div>
    `;

    const container = document.getElementById("scroll-container");
    container.addEventListener("scroll", () => {
        const index = Math.round(container.scrollLeft / container.offsetWidth);
        document.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === index));
    });

    document.getElementById("ticket-modal").classList.remove("hide");
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";
};

window.closeTicketModal = function() {
  document.getElementById("ticket-modal").classList.add("hide");
  document.body.style.overflow = "auto";
};


window.closeTicketModal = function() {
  document.getElementById("ticket-modal").classList.add("hide");
  document.body.style.overflow = "auto";
  document.body.style.height = "auto";
}

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
      : emptyState("No upcoming trips", "When you book a trip, it'll show up here with your QR ticket ready to go.", "booking.ejs", "Book a trip");

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
    <div class="booking-card" style="cursor: pointer;" onclick="openTicketModal('${b._id}')">
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
        <span class="muted" style="font-size:0.78rem;">${b._id}</span>
        ${showCancel && b.status !== "cancelled" ? `<button class="btn btn-danger-ghost btn-sm" data-cancel="${b._id}" onclick="event.stopPropagation();">Cancel</button>` : ""}
      </div>
    </div>`;
  }
  
  // Close when clicking background overlay
  document.getElementById("ticket-modal").addEventListener("click", (e) => {
    if (e.target.id === "ticket-modal") closeTicketModal();
  });

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
    try {
        await GT.api(`/api/bookings/${encodeURIComponent(cancelTargetId)}`, { method: "DELETE" });
        
        // Update local state by finding the booking by _id
        const idx = bookings.findIndex((b) => b._id === cancelTargetId);
        if (idx > -1) {
            bookings[idx].status = "cancelled";
        }
        
        GT.toast("Booking cancelled.", "success");
        renderBookingLists(); // Re-render to update badges
    } catch (err) {
        GT.toast(err.message, "error");
    } finally {
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
