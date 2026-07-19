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
    setTimeout(() => (location.href = "booking.ejs"), 900);
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
          <input type="text" id="pname-${i}" placeholder="e.g. Juan Dela Cruz" required value="${i === 0 ? (user.name || "") : ""}" />
        </div>
        <div class="field">
          <label for="pcontact-${i}">Contact number</label>
          <!-- ADD THIS value attribute to pull the user's contact -->
          <input type="tel" id="pcontact-${i}" placeholder="09XXXXXXXXX" required value="${i === 0 ? (user.contact || "") : ""}" />
        </div>
      </div>
    </div>`
    )
    .join("");

  // Payment options
  const paymentOptions = [
    { id: "gcash", label: "GCash", sub: "Pay instantly via e-wallet" },
    { id: "card", label: "Credit / Debit card", sub: "Visa, Mastercard" },
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

    const container = document.getElementById("tickets-container");
    container.innerHTML = ""; // Clear previous

    booking.passengers.forEach((p, index) => {
      const qrPayload = encodeURIComponent(`GENESIS-TRANSPORT|${booking.id}|${p.seat}|${p.name}`);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${qrPayload}`;

      const card = document.createElement("div");
      card.className = "ticket-card";
      card.innerHTML = `
        <div class="ticket-route">${route.origin.name} → ${route.destination.name}</div>
        <div class="ticket-qr"><img src="${qrUrl}" alt="QR for ${p.name}" width="150" height="150" /></div>
        <div class="ticket-id">ID: ${booking.id} · Seat ${p.seat}</div>
        <div class="ticket-divider"></div>
        <div class="ticket-details">
          <div class="row"><span>Passenger</span><strong>${p.name}</strong></div>
          <div class="row"><span>Date</span><strong>${GT.formatDateLong(date)}</strong></div>
          <div class="row"><span>Departure</span><strong>${trip.departure}</strong></div>
        </div>
      `;
      container.appendChild(card);
    });

    GT.clearDraft();
    initPdfExport();
  }

  async function initPdfExport() {
    const exportBtn = document.getElementById('export-pdf-btn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', async () => {
      if (typeof window.jspdf === 'undefined' && !window.jsPDF) {
        GT.toast("Library still loading, please wait...", "warning");
        return;
      }

      const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      
      const ticketCards = document.querySelectorAll('#tickets-container .ticket-card');
      
      ticketCards.forEach((card, index) => {
        if (index > 0) doc.addPage();
        
        const x = 50; // Horizontal offset for center
        const y = 30; // Vertical offset
        const w = 110; // Card width
        const h = 140; // Card height

        // 1. Draw Card Background (matches your UI's light grey)
        doc.setFillColor(243, 244, 246);
        doc.roundedRect(x, y, w, h, 5, 5, 'F');
        
        // 2. Route Text
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(card.querySelector('.ticket-route').textContent, x + w/2, y + 15, { align: 'center' });
        
        // 3. QR Code
        const qrImg = card.querySelector('img').src;
        doc.addImage(qrImg, 'PNG', x + (w - 60)/2, y + 25, 60, 60);
        
        // 4. ID & Seat
        doc.setFontSize(12);
        doc.text(card.querySelector('.ticket-id').textContent, x + w/2, y + 100, { align: 'center' });
        
        // 5. Divider
        doc.setDrawColor(200, 200, 200);
        doc.line(x + 10, y + 108, x + w - 10, y + 108);
        
        // 6. Details (Passenger, Date, Departure)
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(11);
        const rows = card.querySelectorAll('.ticket-details .row');
        rows.forEach((row, rIdx) => {
          const spans = row.querySelectorAll('span, strong');
          // Label on the left
          doc.text(spans[0].textContent, x + 10, y + 120 + (rIdx * 7));
          // Value on the right
          doc.text(spans[1].textContent, x + w - 10, y + 120 + (rIdx * 7), { align: 'right' });
        });
      });

      doc.save('Genesis_Tickets.pdf');
    });
  }

});
