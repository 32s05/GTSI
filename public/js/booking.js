// public/js/booking.js
document.addEventListener("DOMContentLoaded", async () => {
  GT.renderNav("booking");
  GT.renderFooter();

  const fromSelect = document.getElementById("from");
  const toSelect = document.getElementById("to");
  const dateInput = document.getElementById("date");
  const passengersSelect = document.getElementById("passengers");
  const resultsContainer = document.getElementById("results-container");
  const resultsSummary = document.getElementById("results-summary");
  const filterTypes = document.getElementById("filter-types");
  const sortSelect = document.getElementById("sort-select");

  const params = new URLSearchParams(location.search);
  const today = new Date().toISOString().slice(0, 10);
  dateInput.min = today;
  dateInput.value = params.get("date") || today;

  let terminals = [];
  let currentRoute = null;
  let currentTrips = [];
  let activeTypeFilters = new Set();

  try {
    const { terminals: t } = await GT.api("/api/terminals");
    terminals = t;
    fromSelect.innerHTML = terminals.map((x) => `<option value="${x.code}">${x.name}</option>`).join("");
    toSelect.innerHTML = terminals.map((x) => `<option value="${x.code}">${x.name}</option>`).join("");

    fromSelect.value = params.get("from") || terminals[0].code;
    toSelect.value = params.get("to") || terminals[1].code;

    await runSearch();
  } catch (err) {
    GT.toast(err.message, "error");
  }

  document.getElementById("swap").addEventListener("click", () => {
    const tmp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = tmp;
  });

  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (fromSelect.value === toSelect.value) {
      GT.toast("Origin and destination can't be the same.", "error");
      return;
    }
    runSearch();
  });

  sortSelect.addEventListener("change", renderResults);

  async function runSearch() {
    resultsContainer.innerHTML = `<div class="empty-state">Searching for trips…</div>`;
    try {
      const data = await GT.api(
        `/api/trips/search?from=${fromSelect.value}&to=${toSelect.value}&date=${dateInput.value}`
      );
      currentRoute = data.route;
      currentTrips = data.trips;
      activeTypeFilters = new Set(currentTrips.map((t) => t.busType));
      renderFilters();
      renderResults();
    } catch (err) {
      GT.toast(err.message, "error");
      resultsContainer.innerHTML = `<div class="empty-state">Something went wrong loading trips.</div>`;
    }
  }

  function renderFilters() {
    const types = [...new Set(currentTrips.map((t) => t.busType))];
    filterTypes.innerHTML = types
      .map(
        (type) => `
      <label>
        <input type="checkbox" data-type="${type}" checked />
        ${type}
      </label>`
      )
      .join("");
    filterTypes.querySelectorAll("input").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) activeTypeFilters.add(cb.dataset.type);
        else activeTypeFilters.delete(cb.dataset.type);
        renderResults();
      });
    });
  }

  function renderResults() {
    if (!currentRoute) {
      resultsSummary.innerHTML = "";
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 17V9a2 2 0 012-2h12a2 2 0 012 2v8M4 17h16" stroke="currentColor" stroke-width="1.5"/></svg>
          </div>
          <h3>No direct route yet</h3>
          <p>We don't have a direct schedule between these terminals in this prototype. Try Dasmariñas → Alabang or Cubao → Baguio.</p>
        </div>`;
      return;
    }

    const passengers = Number(passengersSelect.value);
    let trips = currentTrips.filter((t) => activeTypeFilters.has(t.busType) && t.seatsAvailable >= passengers);

    const sortMode = sortSelect.value;
    trips = trips.sort((a, b) => {
      if (sortMode === "price-asc") return a.price - b.price;
      if (sortMode === "price-desc") return b.price - a.price;
      if (sortMode === "seats") return b.seatsAvailable - a.seatsAvailable;
      return a.departure.localeCompare(b.departure);
    });

    resultsSummary.innerHTML = `<strong>${trips.length} trip${trips.length === 1 ? "" : "s"}</strong> from ${currentRoute.origin.name} to ${currentRoute.destination.name} · ${GT.formatDateLong(dateInput.value)}`;

    if (!trips.length) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.5"/></svg>
          </div>
          <h3>No trips match your filters</h3>
          <p>Try a different bus type, fewer passengers, or another date.</p>
        </div>`;
      return;
    }

    resultsContainer.innerHTML = trips
      .map((trip) => {
        const seatsLow = trip.seatsAvailable <= 6;
        return `
      <div class="trip-card">
        <div>
          <div class="trip-times">
            <div>
              <div class="time">${trip.departure}</div>
              <div class="place">${currentRoute.origin.name}</div>
            </div>
            <div class="mid">
              <div class="dur">${GT.formatDurationMins(trip.durationMins)}</div>
              <div class="route-line"><span class="stop"></span><span class="track"></span><span class="stop end"></span></div>
            </div>
            <div>
              <div class="time">${trip.arrival}</div>
              <div class="place">${currentRoute.destination.name}</div>
            </div>
          </div>
          <div class="trip-meta">
            <span class="badge badge-gold">${trip.busType}</span>
            <span class="badge ${seatsLow ? "badge-warning" : "badge-navy"}">${trip.seatsAvailable} seats left</span>
            <span class="badge" style="background:var(--surface-alt);color:var(--muted);">Plate ${trip.plate}</span>
          </div>
        </div>
        <div class="trip-action">
          <div class="price">${GT.peso(trip.price)}</div>
          <div class="per-seat">per seat</div>
          <button class="btn btn-navy btn-sm select-trip" data-trip-id="${trip.id}">Select seats</button>
        </div>
      </div>`;
      })
      .join("");

    resultsContainer.querySelectorAll(".select-trip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const trip = trips.find((t) => t.id === btn.dataset.tripId);
        GT.setDraft({
          route: currentRoute,
          trip,
          date: dateInput.value,
          passengers,
        });
        location.href = "seats.html";
      });
    });
  }
});
