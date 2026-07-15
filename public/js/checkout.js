// public/js/checkout.js
const TERMINAL_FEE = 20;

document.addEventListener("DOMContentLoaded", () => {
  GT.renderNav("booking");
  GT.renderFooter();

  const user = GT.requireAuth();
  if (!user) return;

  const draft = GT.getDraft();
  if (!draft || !draft.seats || !draft.seats.length) {
    GT.toast("Please choose your seats first.", "error");
    setTimeout(() => (location.href = "booking.html"), 900);
    return;
  }

  const { route, trip, date, seats } = draft;

  document.getElementById("checkout-title").textContent = "Passenger details";
  document.getElementById("checkout-subtitle").textContent = `${route.origin.name} → ${route.destination.name} · ${GT.formatDateLong(date)} · ${trip.departure}`;
  document.getElementById("order-route").innerHTML = `<span class="stop"></span><span class="track"></span><span class="stop end"></span>`;
  document.getElementById("order-date").textContent = GT.formatDateLong(date);
  document.getElementById("order-departure").textContent = `${trip.departure} → ${trip.arrival}`;
  document.getElementById("order-bustype").textContent = trip.busType;
  document.getElementById("order-seats").textContent = seats.join(", ");
  document.getElementById("order-price-label").textContent = `${GT.peso(trip.price)} × ${seats.length} seat${seats.length > 1 ? "s" : ""}`;
  document.getElementById("order-price").textContent = GT.peso(trip.price * seats.length);
  const total = trip.price * seats.length + TERMINAL_FEE;
  document.getElementById("order-total").textContent = GT.peso(total);

  // Passenger form, one block per seat
  const form = document.getElementById("passenger-form");
  form.innerHTML = seats
    .map(
      (seat, i) => `
    <div class="passenger-block">
      <div class="passenger-block-title">Passenger ${i + 1} <span class="seat-tag">Seat ${seat}</span></div>
      <div class="passenger-grid">
        <div class="field">
          <label for="pname-${i}">Full name</label>
          <input type="text" id="pname-${i}" placeholder="e.g. Juan Dela Cruz" required value="${i === 0 ? user.name : ""}" />
        </div>
        <div class="field">
          <label for="pcontact-${i}">Contact number</label>
          <input type="tel" id="pcontact-${i}" placeholder="09XXXXXXXXX" required />
        </div>
      </div>
    </div>`
    )
    .join("");

  // Payment options
  const paymentOptions = [
    { id: "gcash", label: "GCash", sub: "Pay instantly via e-wallet" },
    { id: "card", label: "Credit / Debit card", sub: "Visa, Mastercard" },
    { id: "cash", label: "Pay at terminal", sub: "Cash, reserve now, pay on boarding" },
  ];
  document.getElementById("payment-options").innerHTML = paymentOptions
    .map(
      (p, i) => `
    <label class="payment-option">
      <input type="radio" name="payment" value="${p.id}" ${i === 0 ? "checked" : ""} />
      <div>
        <div class="label">${p.label}</div>
        <div class="sub">${p.sub}</div>
      </div>
    </label>`
    )
    .join("");

  document.getElementById("confirm-btn").addEventListener("click", async () => {
    const passengers = seats.map((seat, i) => ({
      seat,
      name: document.getElementById(`pname-${i}`).value.trim(),
      contact: document.getElementById(`pcontact-${i}`).value.trim(),
    }));

    if (passengers.some((p) => !p.name || !p.contact)) {
      GT.toast("Please fill in every passenger's name and contact number.", "error");
      return;
    }
    if (!document.getElementById("agree-terms").checked) {
      GT.toast("Please confirm the checkbox to continue.", "error");
      return;
    }
    const paymentMethod = form.parentElement.querySelector('input[name="payment"]:checked')?.value || "cash";

    const btn = document.getElementById("confirm-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Confirming booking…`;

    try {
      const { booking } = await GT.api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          tripId: trip.id,
          routeId: route.id,
          trip,
          seats,
          passengers,
          paymentMethod,
        }),
      });
      showConfirmation(booking);
      GT.clearDraft();
    } catch (err) {
      GT.toast(err.message, "error");
      btn.disabled = false;
      btn.textContent = "Confirm and pay";
    }
  });

  function showConfirmation(booking) {
    document.getElementById("checkout-step").classList.add("hide");
    document.getElementById("back-link").classList.add("hide");
    document.getElementById("checkout-title").textContent = "You're all set";
    document.getElementById("checkout-subtitle").textContent = "Your seat is reserved.";
    document.getElementById("confirmation-step").classList.remove("hide");

    document.getElementById("ticket-route").textContent = `${route.origin.name} → ${route.destination.name}`;
    document.getElementById("ticket-id").textContent = booking.id;
    const qrPayload = encodeURIComponent(`GENESIS-TRANSPORT|${booking.id}|${seats.join(",")}`);
    document.getElementById("ticket-qr-img").src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${qrPayload}`;

    document.getElementById("ticket-details").innerHTML = `
      <div class="row"><span>Date</span><strong>${GT.formatDateLong(date)}</strong></div>
      <div class="row"><span>Departure</span><strong>${trip.departure}</strong></div>
      <div class="row"><span>Bus type</span><strong>${trip.busType} · ${trip.plate}</strong></div>
      <div class="row"><span>Seats</span><strong>${seats.join(", ")}</strong></div>
      <div class="row"><span>Total paid</span><strong>${GT.peso(total)}</strong></div>
    `;
  }
});
