// server.js
// Genesis Transport — Web Prototype
// Pure Node.js (no Express, no npm deps) — static file server + small mock JSON API.
//
// Run:  node server.js
// Open: http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const store = require("./data/store");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "text/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=UTF-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy(); // 1MB guard
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);

  // prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // fall back to .html (e.g. /booking -> /booking.html)
      const htmlGuess = filePath + ".html";
      return fs.stat(htmlGuess, (err2, stats2) => {
        if (err2) return send404(res);
        streamFile(res, htmlGuess);
      });
    }
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    streamFile(res, filePath);
  });
}

function streamFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, content) => {
    if (err) return send404(res);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function send404(res) {
  const notFoundPath = path.join(PUBLIC_DIR, "404.html");
  fs.readFile(notFoundPath, (err, content) => {
    res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
    res.end(err ? "404 Not Found" : content);
  });
}

// ---------- API handlers ----------

async function handleApi(req, res, pathname, query) {
  // GET /api/terminals
  if (req.method === "GET" && pathname === "/api/terminals") {
    return sendJSON(res, 200, { terminals: store.TERMINALS });
  }

  // GET /api/routes
  if (req.method === "GET" && pathname === "/api/routes") {
    const routesWithNames = store.ROUTES.map((r) => ({
      ...r,
      origin: store.terminalByCode(r.originCode),
      destination: store.terminalByCode(r.destCode),
    }));
    return sendJSON(res, 200, { routes: routesWithNames });
  }

  // GET /api/trips/search?from=CVT&to=ALB&date=2026-07-10
  if (req.method === "GET" && pathname === "/api/trips/search") {
    const { from, to, date } = query;
    const route = store.ROUTES.find((r) => r.originCode === from && r.destCode === to);
    if (!route) {
      return sendJSON(res, 200, { route: null, trips: [] });
    }
    const trips = store.buildTrips(route.id, date);
    return sendJSON(res, 200, {
      route: { ...route, origin: store.terminalByCode(route.originCode), destination: store.terminalByCode(route.destCode) },
      trips,
    });
  }

  // GET /api/trips/:tripId/seats?routeId=&date=
  const seatsMatch = pathname.match(/^\/api\/trips\/([^/]+)\/seats$/);
  if (req.method === "GET" && seatsMatch) {
    const tripId = decodeURIComponent(seatsMatch[1]);
    const routeId = query.routeId;
    const date = query.date;
    const route = store.ROUTES.find((r) => r.id === routeId);
    if (!route) return sendJSON(res, 404, { error: "Route not found" });
    const trips = store.buildTrips(routeId, date);
    const trip = trips.find((t) => t.id === tripId) || trips[0];
    if (!trip) return sendJSON(res, 404, { error: "Trip not found" });
    const seats = store.seatLayoutFor(trip);
    return sendJSON(res, 200, { trip, seats });
  }

  // POST /api/auth/signup { name, email, password }
  if (req.method === "POST" && pathname === "/api/auth/signup") {
    const body = await readBody(req);
    const { name, email, password } = body;
    if (!name || !email || !password) {
      return sendJSON(res, 400, { error: "Name, email, and password are required." });
    }
    if (store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      return sendJSON(res, 409, { error: "An account with that email already exists." });
    }
    const user = { id: "u-" + crypto.randomBytes(4).toString("hex"), name, email, password };
    store.users.push(user);
    return sendJSON(res, 201, { user: { id: user.id, name: user.name, email: user.email } });
  }

  // POST /api/auth/login { email, password }
  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    const { email, password } = body;
    const user = store.users.find(
      (u) => u.email.toLowerCase() === String(email || "").toLowerCase() && u.password === password
    );
    if (!user) return sendJSON(res, 401, { error: "Incorrect email or password." });
    return sendJSON(res, 200, { user: { id: user.id, name: user.name, email: user.email } });
  }

  // GET /api/bookings?userId=
  if (req.method === "GET" && pathname === "/api/bookings") {
    const userBookings = store.bookings
      .filter((b) => b.userId === query.userId)
      .map((b) => {
        const route = store.ROUTES.find((r) => r.id === b.routeId);
        return {
          ...b,
          route: route
            ? { ...route, origin: store.terminalByCode(route.originCode), destination: store.terminalByCode(route.destCode) }
            : null,
        };
      })
      .sort((a, b2) => new Date(b2.createdAt) - new Date(a.createdAt));
    return sendJSON(res, 200, { bookings: userBookings });
  }

  // POST /api/bookings { userId, tripId, routeId, trip, seats, passengers, paymentMethod }
  if (req.method === "POST" && pathname === "/api/bookings") {
    const body = await readBody(req);
    const { userId, tripId, routeId, trip, seats, passengers, paymentMethod } = body;
    if (!userId || !tripId || !routeId || !seats || !seats.length) {
      return sendJSON(res, 400, { error: "Missing booking details." });
    }
    const totalPrice = (trip && trip.price ? trip.price : 0) * seats.length + 20; // + terminal fee
    const booking = store.createBooking({ userId, tripId, routeId, trip, seats, passengers, paymentMethod, totalPrice });
    return sendJSON(res, 201, { booking });
  }

  // DELETE /api/bookings/:id
  const cancelMatch = pathname.match(/^\/api\/bookings\/([^/]+)$/);
  if (req.method === "DELETE" && cancelMatch) {
    const id = decodeURIComponent(cancelMatch[1]);
    const booking = store.bookings.find((b) => b.id === id);
    if (!booking) return sendJSON(res, 404, { error: "Booking not found." });
    booking.status = "cancelled";
    return sendJSON(res, 200, { booking });
  }

  return sendJSON(res, 404, { error: "Unknown API route." });
}

// ---------- main request handler ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const query = Object.fromEntries(url.searchParams.entries());

  try {
    if (pathname.startsWith("/api/")) {
      return await handleApi(req, res, pathname, query);
    }
    if (req.method === "GET") {
      return serveStatic(req, res, pathname);
    }
    res.writeHead(405);
    res.end("Method Not Allowed");
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: "Something went wrong on the server." });
  }
});

server.listen(PORT, () => {
  console.log(`Genesis Transport prototype running at http://localhost:${PORT}`);
});
