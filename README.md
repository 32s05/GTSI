# Genesis Transport — Web Prototype

A vanilla **HTML / CSS / JS + Node.js** prototype of the Genesis Transport P2P bus booking web app, styled to match the navy/gold brand used in the Flutter mobile app and React admin panel. No frameworks, no npm dependencies — just the Node.js standard library (`http`, `fs`, `path`).

## Run it

```bash
node server.js
```

Then open **http://localhost:3000**

No `npm install` needed — there are zero external dependencies.

## Demo login

```
Email:    demo@genesistransport.ph
Password: demo1234
```

(or create your own account via Sign up — accounts are stored in memory)

## Pages

| Page | File | Description |
|---|---|---|
| Landing | `public/index.html` | Hero search, features, popular routes, FAQ |
| Login | `public/login.html` | Mock authentication |
| Sign up | `public/signup.html` | Mock account creation |
| Book a trip | `public/booking.html` | Search trips, filter by bus type, sort |
| Choose seat | `public/seats.html` | Interactive 2-2 seat map |
| Checkout | `public/checkout.html` | Passenger details, payment method, QR ticket confirmation |
| My Trips | `public/dashboard.html` | Travel stats, upcoming/past bookings, cancel, favorite routes |

## API (mock, in-memory)

All data resets when the server restarts — this is a prototype, not a production backend.

```
GET  /api/terminals
GET  /api/routes
GET  /api/trips/search?from=CODE&to=CODE&date=YYYY-MM-DD
GET  /api/trips/:tripId/seats?routeId=&date=
POST /api/auth/signup      { name, email, password }
POST /api/auth/login       { email, password }
GET  /api/bookings?userId=
POST /api/bookings         { userId, tripId, routeId, trip, seats, passengers, paymentMethod }
DELETE /api/bookings/:id
```

## Project structure

```
genesis-transport-web/
├── server.js               # Plain Node http server: static files + API
├── data/store.js            # In-memory mock data (routes, trips, users, bookings)
├── package.json
└── public/
    ├── index.html / login.html / signup.html
    ├── booking.html / seats.html / checkout.html / dashboard.html
    ├── css/styles.css       # Shared navy/gold design system
    └── js/
        ├── main.js          # Shared nav/footer/auth-state/toast/API helpers
        ├── landing.js / auth.js / booking.js / seats.js / checkout.js / dashboard.js
```

## Notes for the lab writeup

- Auth is intentionally simple (plaintext compare, in-memory user array) — fine for a prototype, **not** how you'd do it in production (bcrypt + a real DB).
- Booking/user state uses `localStorage` (logged-in user) and `sessionStorage` (in-progress booking draft) on the client, plus the in-memory API on the server.
- Seat maps and schedules are deterministically generated per route/date so refreshing doesn't reshuffle already-rendered data mid-session.
- QR codes on the confirmation ticket are generated via a public QR image API (`api.qrserver.com`) purely for visual demonstration.
