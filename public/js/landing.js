// public/js/landing.js
document.addEventListener("DOMContentLoaded", async () => {
  GT.renderNav("home");
  GT.renderFooter();

  const fromSelect = document.getElementById("hero-from");
  const toSelect = document.getElementById("hero-to");
  const dateInput = document.getElementById("hero-date");
  const marquee = document.getElementById("terminal-marquee");
  const routesGrid = document.getElementById("routes-grid");

  // sensible default date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.value = tomorrow.toISOString().slice(0, 10);
  dateInput.min = new Date().toISOString().slice(0, 10);

  try {
    const [{ terminals }, { routes }] = await Promise.all([
      GT.api("/api/terminals"),
      GT.api("/api/routes"),
    ]);

    fromSelect.innerHTML = terminals.map((t) => `<option value="${t.code}">${t.name}</option>`).join("");
    toSelect.innerHTML = terminals.map((t) => `<option value="${t.code}">${t.name}</option>`).join("");
    toSelect.value = terminals[1]?.code || terminals[0].code;

    marquee.innerHTML = terminals.map((t) => `<span>${t.name}</span>`).join("");

    routesGrid.innerHTML = routes
      .slice(0, 6)
      .map(
        (r) => `
      <a class="route-tile" href="booking.html?from=${r.originCode}&to=${r.destCode}">
        <span class="badge badge-navy">${r.origin.region}</span>
        <div class="route-line">
          <span class="stop"></span>
          <span class="track"></span>
          <span class="stop end"></span>
        </div>
        <div class="route-tile-names">
          <span>${r.origin.name}</span>
          <span>${r.destination.name}</span>
        </div>
        <div class="route-tile-footer">
          <span>${GT.formatDurationMins(r.durationMins)}</span>
          <strong>from ${GT.peso(r.basePrice)}</strong>
        </div>
      </a>`
      )
      .join("");
  } catch (err) {
    GT.toast(err.message, "error");
  }

  document.getElementById("hero-swap").addEventListener("click", () => {
    const tmp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = tmp;
  });

  document.getElementById("hero-search").addEventListener("submit", (e) => {
    e.preventDefault();
    if (fromSelect.value === toSelect.value) {
      GT.toast("Origin and destination can't be the same.", "error");
      return;
    }
    const params = new URLSearchParams({
      from: fromSelect.value,
      to: toSelect.value,
      date: dateInput.value,
    });
    location.href = `booking.html?${params.toString()}`;
  });
});
