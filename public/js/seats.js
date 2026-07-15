// public/js/seats.js
document.addEventListener("DOMContentLoaded", async () => {
  GT.renderNav("booking");
  GT.renderFooter();

  const draft = GT.getDraft();
  if (!draft || !draft.trip) {
    GT.toast("Please search and select a trip first.", "error");
    setTimeout(() => (location.href = "booking.html"), 900);
    return;
  }

  const { route, trip, date, passengers } = draft;
  let selectedSeats = [];

  document.getElementById("trip-title").textContent = `${route.origin.name} → ${route.destination.name}`;
  document.getElementById("trip-subtitle").textContent = `${GT.formatDateLong(date)} · Departs ${trip.departure} · Select ${passengers} seat${passengers > 1 ? "s" : ""}`;
  document.getElementById("bus-type-badge").textContent = trip.busType;
  document.getElementById("summary-date").textContent = GT.formatDateLong(date);
  document.getElementById("summary-departure").textContent = `${trip.departure} → ${trip.arrival}`;
  document.getElementById("summary-bustype").textContent = trip.busType;
  document.getElementById("summary-price").textContent = GT.peso(trip.price);
  document.getElementById("summary-route").innerHTML = `
    <span class="stop"></span><span class="track"></span><span class="stop end"></span>
  `;

  const seatGrid = document.getElementById("seat-grid");
  const continueBtn = document.getElementById("continue-btn");

  seatGrid.innerHTML = `<p class="muted">Loading seat map…</p>`;

  try {
    const { seats } = await GT.api(`/api/trips/${encodeURIComponent(trip.id)}/seats?routeId=${route.id}&date=${date || ""}`);
    renderSeats(seats);
  } catch (err) {
    GT.toast(err.message, "error");
    seatGrid.innerHTML = `<p class="muted">Couldn't load the seat map.</p>`;
  }

  function renderSeats(seats) {
    seatGrid.innerHTML = seats
      .map(
        (seat) => `
      <button type="button" class="seat ${seat.status} ${seat.aisleAfter ? "aisle-after" : ""}" data-seat="${seat.id}" ${seat.status === "booked" ? "disabled" : ""}>
        ${seat.id}
      </button>`
      )
      .join("");

    seatGrid.querySelectorAll(".seat:not(.booked)").forEach((btn) => {
      btn.addEventListener("click", () => toggleSeat(btn));
    });
  }

  function toggleSeat(btn) {
    const seatId = btn.dataset.seat;
    const isSelected = selectedSeats.includes(seatId);

    if (isSelected) {
      selectedSeats = selectedSeats.filter((s) => s !== seatId);
      btn.classList.remove("selected");
    } else {
      if (selectedSeats.length >= passengers) {
        GT.toast(`You can only select ${passengers} seat${passengers > 1 ? "s" : ""} for this trip.`, "error");
        return;
      }
      selectedSeats.push(seatId);
      btn.classList.add("selected");
    }
    updateSummary();
  }

  function updateSummary() {
    const list = document.getElementById("selected-seats-list");
    list.innerHTML = selectedSeats.length
      ? selectedSeats.map((s) => `<span class="selected-seat-chip">${s}</span>`).join("")
      : `<span class="muted" style="font-size:0.85rem;">No seats selected yet</span>`;

    const total = trip.price * selectedSeats.length;
    document.getElementById("summary-total").textContent = GT.peso(total);

    const complete = selectedSeats.length === passengers;
    continueBtn.disabled = !complete;
    continueBtn.textContent = complete
      ? "Continue to passenger details"
      : `Select ${passengers - selectedSeats.length} more seat${passengers - selectedSeats.length === 1 ? "" : "s"}`;
  }

  continueBtn.addEventListener("click", () => {
    if (selectedSeats.length !== passengers) return;
    GT.setDraft({ ...draft, seats: selectedSeats });
    location.href = "checkout.html";
  });

  updateSummary();
});
