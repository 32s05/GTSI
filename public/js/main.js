// public/js/main.js
// Shared helpers used across every page: auth state, nav rendering, toast, API fetch.

const GT = (() => {
  const USER_KEY = "gt_user";
  const BOOKING_DRAFT_KEY = "gt_booking_draft";

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  }
  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearUser() {
    localStorage.removeItem(USER_KEY);
  }

  function setDraft(draft) {
    sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft));
  }
  function getDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(BOOKING_DRAFT_KEY));
    } catch {
      return null;
    }
  }
  function clearDraft() {
    sessionStorage.removeItem(BOOKING_DRAFT_KEY);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* no body */
    }
    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  function peso(n) {
    return "₱" + Number(n || 0).toLocaleString("en-PH");
  }

  function formatDurationMins(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function formatDateLong(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
  }

  function initials(name) {
    if (!name) return "?";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join("");
  }

  function toast(message, type = "default") {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.className = `toast ${type}`;
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function requireAuth(redirectTo = "login.ejs") {
    const user = getUser();
    if (!user) {
      sessionStorage.setItem("gt_redirect_after_login", location.pathname.split("/").pop());
      const target = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
      location.href = target;
      return null;
    }
    return user;
  }

  // 10-Minute Inactivity Logout Feature
  function initInactivityTimer() {
    let inactivityTimer;
    const timeoutLimit = 10 * 60 * 1000; // 10 minutes in milliseconds

    function resetTimer() {
      clearTimeout(inactivityTimer);
      // Only monitor idle state if a user is actively logged in
      if (getUser()) {
        inactivityTimer = setTimeout(() => {
          clearUser();
          toast("You have been logged out due to inactivity.", "default");
          setTimeout(() => {
            location.href = "/login.ejs";
          }, 1500); // Give user a moment to see the toast notification
        }, timeoutLimit);
      }
    }

    // Monitor common user interaction events across the page
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keypress", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    // Initial check on load
    resetTimer();
  }

  function renderNav(activePage) {
    let mount = document.getElementById("site-nav");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "site-nav";
      document.body.prepend(mount);
    }
    if (!mount) return;

    mount.innerHTML = `
      <nav class="navbar">
        <div class="container">
          <a href="/index.ejs" class="brand"><span class="brand-mark"><img src="/css/genesis-logo.png" alt="Genesis Logo" style="height: 100%; width: auto; object-fit: contain;" /></span>Genesis Transport</a>
          <div class="nav-links" id="nav-links-container"></div>
          <div class="nav-actions" id="nav-actions-container"></div>
          <button class="nav-toggle" id="nav-toggle">Menu</button>
        </div>
      </nav>
      <div id="mobile-menu" style="background:#fff;border-bottom:1px solid var(--border);padding:16px 24px;display:none;"></div>
    `;

    const linksMount = document.getElementById("nav-links-container");
    const actionsMount = document.getElementById("nav-actions-container");
    const mobileMount = document.getElementById("mobile-menu");
    if (!linksMount) return;

    const user = getUser();
    let links = [
      { href: "/index.ejs", label: "Home", key: "home" },
      { href: "/booking.ejs", label: "Book a Trip", key: "booking" },
    ];
    if (user) links.push({ href: "/dashboard.ejs", label: "My Trips", key: "dashboard" });

    const linksHtml = links.map(l => `<a href="${l.href}" class="${l.key === activePage ? "active" : ""}">${l.label}</a>`).join("");
    const actionsHtml = user
      ? `<div class="nav-user"><div class="avatar">${initials(user.name)}</div><span>${user.name.split(" ")[0]}</span></div><button class="btn btn-ghost btn-sm nav-logout">Log out</button>`
      : `<a href="/login.ejs" class="btn btn-ghost btn-sm">Log in</a><a href="/signup.ejs" class="btn btn-primary btn-sm">Sign up</a>`;

    // Update containers instead of replacing the whole navbar
    linksMount.innerHTML = linksHtml;
    actionsMount.innerHTML = actionsHtml;
    mobileMount.innerHTML = `${links.map((l) => `<a href="${l.href}" style="display:block;padding:12px 0;font-weight:600;color:var(--navy-900);">${l.label}</a>`).join("")}<div style="display:flex;gap:10px;margin-top:10px;">${actionsHtml}</div>`;

    // Re-attach listeners...
    document.getElementById("nav-toggle")?.addEventListener("click", () => {
      mobileMount.style.display = mobileMount.style.display === "block" ? "none" : "block";
    });

    // Attach logout handlers to any logout buttons (desktop + mobile)
    document.querySelectorAll('.nav-logout').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        clearUser();
        location.href = '/index.ejs';
      });
    });
  }

  function renderFooter() {
    let mount = document.getElementById("site-footer");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "site-footer";
      document.body.appendChild(mount);
    }
    if (!mount) return;
    mount.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div style="max-width:280px;">
            <div class="brand" style="color:#fff;margin-bottom:12px;">
              <span class="brand-mark">
                <img src="/css/genesis-logo.png" alt="Genesis Logo" style="height: 100%; width: auto; object-fit: contain;" />
              </span>
              Genesis Transport
            </div>  
            <p style="color:#8b96b5;">Peer-to-peer intercity bus booking for the Filipino commuter — built as a DLSU-D capstone project.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="/booking.ejs">Book a trip</a>
            <a href="/dashboard.ejs">My trips</a>
            <a href="/index.ejs#routes">Routes</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="/index.ejs#about">About</a>
            <a href="/index.ejs#faq">FAQ</a>
          </div>
          <div>
            <h4>Account</h4>
            <a href="/login.ejs">Log in</a>
            <a href="/signup.ejs">Sign up</a>
          </div>
        </div>
        <div class="footer-bottom">© ${new Date().getFullYear()} Genesis Transport Service, Inc. — Prototype build for academic use.</div>
      </footer>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Extract the page name from the URL, e.g., 'booking.ejs' -> 'booking'
    const path = window.location.pathname.split("/").pop();
    const pageKey = path.split(".")[0] || "home";
    
    GT.renderNav(pageKey);
    GT.renderFooter(); 
    
    initInactivityTimer();
  });

  return {
    getUser, setUser, clearUser,
    setDraft, getDraft, clearDraft,
    api, peso, formatDurationMins, formatDateLong, initials,
    toast, requireAuth, renderNav, renderFooter,
  };
})();