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
  let routes = [];
  let currentRoute = null;
  let currentTrips = [];
  let activeTypeFilters = new Set();
  let currentPage = 1;
  let rowsPerPage = 25;
  const pageSizes = [10, 25, 50, 100];

  const rowsPerPageSelect = document.getElementById("rows-per-page");
  const prevPageButton = document.getElementById("prev-page");
  const nextPageButton = document.getElementById("next-page");
  const pageInfo = document.getElementById("page-info");

  // Fetch routes to filter destinations
  async function fetchRoutes() {
    try {
      const { routes: r } = await GT.api("/api/routes");
      routes = r || [];
    } catch (err) {
      console.error("Failed to fetch routes:", err);
    }
  }

  // Update destination options based on selected origin
  function updateDestinationOptions() {
    const selectedOrigin = fromSelect.value;
    const availableDestinations = [...new Set(routes.filter(r => r.originCode === selectedOrigin).map(r => r.destCode))];
    
    const toValue = toSelect.value;
    toSelect.innerHTML = terminals
      .filter(t => availableDestinations.includes(t.code))
      .map((x) => `<option value="${x.code}">${x.name}</option>`)
      .join("");

    // If the previously selected destination is still available, keep it. Otherwise, select the first one.
    if (toSelect.options.length > 0) {
      if (Array.from(toSelect.options).some(opt => opt.value === toValue)) {
        toSelect.value = toValue;
      } else {
        toSelect.value = toSelect.options[0]?.value || "";
      }
    }
  }

  // Display all active schedules on first load
  async function displayAllSchedules() {
    try {
      const { trips: allTrips } = await GT.api("/api/trips/active");
      currentRoute = null;
      currentTrips = allTrips || [];
      currentPage = 1;
      activeTypeFilters = new Set(currentTrips.map((t) => t.busType));
      renderFilters();
      renderResults();
    } catch (err) {
      console.error("Failed to load schedules:", err);
    }
  }

  // Fetch alternative trips when no results found
  async function fetchAlternativeTrips() {
    try {
      const allSchedules = [];
      for (const origin of terminals) {
        for (const dest of terminals) {
          if (origin.code !== dest.code) {
            try {
              const today = new Date().toISOString().slice(0, 10);
              const { trips: trips } = await GT.api(`/api/trips/search?from=${origin.code}&to=${dest.code}&date=${today}`);
              allSchedules.push(...(trips || []));
            } catch (e) {
              // Skip on error
            }
          }
        }
      }
      return allSchedules;
    } catch (err) {
      console.error("Failed to fetch alternatives:", err);
      return [];
    }
  }

  try {
    const { terminals: t } = await GT.api("/api/terminals");
    terminals = t;
    fromSelect.innerHTML = terminals.map((x) => `<option value="${x.code}">${x.name}</option>`).join("");

    await fetchRoutes();

    fromSelect.value = params.get("from") || terminals[0].code;
    updateDestinationOptions();
    toSelect.value = params.get("to") || toSelect.options[0]?.value || terminals[1].code;

    if (params.get("from") && params.get("to")) {
      await runSearch();
    } else {
      // Display all schedules on page load
      await displayAllSchedules();
    }
  } catch (err) {
    GT.toast(err.message, "error");
  }

  // Filter destinations when origin changes
  fromSelect.addEventListener("change", () => {
    updateDestinationOptions();
    runSearch();
  });

  toSelect.addEventListener("change", () => {
    runSearch();
  });

  document.getElementById("swap").addEventListener("click", () => {
    const tmp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = tmp;
    updateDestinationOptions();
    runSearch();
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
  if (rowsPerPageSelect) {
    rowsPerPageSelect.addEventListener("change", () => {
      rowsPerPage = Number(rowsPerPageSelect.value) || 25;
      currentPage = 1;
      renderResults();
    });
  }
  if (prevPageButton) {
    prevPageButton.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderResults();
      }
    });
  }
  if (nextPageButton) {
    nextPageButton.addEventListener("click", () => {
      currentPage += 1;
      renderResults();
    });
  }

  async function runSearch() {
    currentPage = 1;
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

  function updatePaginationControls(totalItems) {
    const pageCount = Math.max(1, Math.ceil(totalItems / rowsPerPage));
    if (currentPage > pageCount) currentPage = pageCount;
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${pageCount}`;
    if (prevPageButton) prevPageButton.disabled = currentPage <= 1;
    if (nextPageButton) nextPageButton.disabled = currentPage >= pageCount;
    const controls = document.getElementById("booking-pagination-controls");
    if (controls) {
      controls.classList.toggle("hidden", totalItems === 0);
    }
    return pageCount;
  }

  function getPagedTrips(trips) {
    const totalItems = trips.length;
    const pageCount = updatePaginationControls(totalItems);
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return trips.slice(start, end);
  }

  function renderResults() {
    if (!currentRoute && !currentTrips.length) {
      resultsSummary.innerHTML = "";
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 17V9a2 2 0 012-2h12a2 2 0 012 2v8M4 17h16" stroke="currentColor" stroke-width="1.5"/></svg>
          </div>
          <h3>No active schedules yet</h3>
          <p>There are no active schedules available right now.</p>
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

    const summaryText = currentRoute
      ? `<strong>${trips.length} trip${trips.length === 1 ? "" : "s"}</strong> from ${currentRoute.origin.name} to ${currentRoute.destination.name} · ${GT.formatDateLong(dateInput.value)}`
      : `<strong>${trips.length} active schedule${trips.length === 1 ? "" : "s"}</strong> across all available routes`;
    resultsSummary.innerHTML = summaryText;
    const pagedTrips = getPagedTrips(trips);

    if (!trips.length) {
      // Show no results message with alternative trips
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.5"/></svg>
          </div>
          <h3>No trips match your filters</h3>
          <p>Try a different bus type, fewer passengers, or another date.</p>
          <button class="btn btn-secondary" id="show-alternatives-btn" style="margin-top: 1rem;">Show other available trips</button>
        </div>`;
      
      // Add click handler to show alternatives
      document.getElementById("show-alternatives-btn")?.addEventListener("click", async () => {
        resultsContainer.innerHTML = `<div class="empty-state">Loading alternative trips…</div>`;
        const altTrips = await fetchAlternativeTrips();
        const passengers = Number(passengersSelect.value);
        const filtered = altTrips
          .filter((t) => t.seatsAvailable >= passengers)
          .sort(() => Math.random() - 0.5)
          .slice(0, 5);
        
        if (!filtered.length) {
          resultsContainer.innerHTML = `
            <div class="empty-state">
              <h3>No alternative trips available</h3>
              <p>Sorry, there are currently no other trips with available seats.</p>
            </div>`;
          return;
        }

        resultsSummary.innerHTML = `<strong>Other available trips</strong> · Would you like to book one of these instead?`;
        
        resultsContainer.innerHTML = filtered
          .map((trip) => {
            const seatsLow = trip.seatsAvailable <= 6;
            const routeName = `${trip.routeId || '—'}`;
            return `
          <div class="trip-card">
            <div>
              <div class="trip-times">
                <div>
                  <div class="time">${trip.departure}</div>
                  <div class="place">${routeName}</div>
                </div>
                <div class="mid">
                  <div class="dur">${GT.formatDurationMins(trip.durationMins)}</div>
                  <div class="route-line"><span class="stop"></span><span class="track"></span><span class="stop end"></span></div>
                </div>
                <div>
                  <div class="time">${trip.arrival}</div>
                  <div class="place"></div>
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
              <button class="btn btn-navy btn-sm select-alt-trip" data-trip-id="${trip.id}" data-trip-data='${JSON.stringify(trip)}'>Select</button>
            </div>
          </div>`;
          })
          .join("");

        resultsContainer.querySelectorAll(".select-alt-trip").forEach((btn) => {
          btn.addEventListener("click", () => {
            const trip = JSON.parse(btn.dataset.tripData);
            GT.setDraft({
              route: { origin: { name: "Various" }, destination: { name: "Various" } },
              trip,
              date: dateInput.value,
              passengers,
            });
            location.href = "seats.ejs";
          });
        });
      });
      return;
    }

    resultsContainer.innerHTML = pagedTrips
      .map((trip) => {
        const seatsLow = trip.seatsAvailable <= 6;
        const routeOrigin = currentRoute?.origin?.name || trip.route?.origin?.name || "Route origin";
        const routeDestination = currentRoute?.destination?.name || trip.route?.destination?.name || "Route destination";
        return `
      <div class="trip-card">
        <div>
          <div class="trip-times">
            <div>
              <div class="time">${trip.departure}</div>
              <div class="place">${routeOrigin}</div>
            </div>
            <div class="mid">
              <div class="dur">${GT.formatDurationMins(trip.durationMins)}</div>
              <div class="route-line"><span class="stop"></span><span class="track"></span><span class="stop end"></span></div>
            </div>
            <div>
              <div class="time">${trip.arrival}</div>
              <div class="place">${routeDestination}</div>
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
          route: currentRoute || trip.route,
          trip,
          date: dateInput.value,
          passengers,
        });
        location.href = "seats.ejs";
      });
    });
  }

  // Hide the sticky results summary when the results list scrolls past its top
  function setupSummaryVisibility() {
    const resultsListParent = resultsContainer.parentElement; // .results-list
    if (!resultsSummary || !resultsContainer || window.innerWidth <= 900) return;

    // Add a sentinel before the results container to observe when it crosses the navbar line
    let sentinel = document.getElementById('results-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'results-sentinel';
      resultsContainer.parentNode.insertBefore(sentinel, resultsContainer);
      sentinel.style.width = '1px';
      sentinel.style.height = '1px';
      sentinel.style.margin = '0';
      sentinel.style.padding = '0';
    }

    const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 76;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // When the sentinel scrolls out of view (we've scrolled past the summary position),
        // make the summary a fixed overlay so trip cards scroll underneath and get cropped.
        if (!entry.isIntersecting) {
          // compute bounds for the results column so the fixed overlay lines up
          const colRect = resultsListParent.getBoundingClientRect();
          const summaryHeight = resultsSummary.offsetHeight || 56;

          // Make a spacer (sentinel) take up the summary height in the flow
          sentinel.style.height = summaryHeight + 'px';

          resultsSummary.classList.add('fixed-summary');
          resultsSummary.classList.remove('hide-summary');
          resultsSummary.style.position = 'fixed';
          resultsSummary.style.top = (navbarHeight + 12) + 'px';
          resultsSummary.style.left = colRect.left + 'px';
          resultsSummary.style.width = colRect.width + 'px';
          resultsSummary.style.zIndex = 900;
        } else {
          // restore normal (non-fixed) behavior
          sentinel.style.height = '0px';
          resultsSummary.classList.remove('fixed-summary');
          resultsSummary.classList.remove('hide-summary');
          resultsSummary.style.position = '';
          resultsSummary.style.top = '';
          resultsSummary.style.left = '';
          resultsSummary.style.width = '';
          resultsSummary.style.zIndex = '';
        }
      });
    }, { root: null, rootMargin: `-${navbarHeight}px 0px 0px 0px`, threshold: 0 });

    observer.observe(sentinel);

    // Re-evaluate on resize so navbar height and column width stay correct
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth <= 900) {
          sentinel.style.height = '0px';
          resultsSummary.classList.remove('fixed-summary');
          resultsSummary.style.position = '';
          resultsSummary.style.top = '';
          resultsSummary.style.left = '';
          resultsSummary.style.width = '';
          resultsSummary.style.zIndex = '';
        } else {
          // force a recalculation by triggering the observer with a small scroll
          window.dispatchEvent(new Event('scroll'));
        }
      }, 120);
    });
  }

  // Initialize the visibility observer once
  setupSummaryVisibility();
});
