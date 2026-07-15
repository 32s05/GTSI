// data/store.js
// Simple in-memory "database" for the Genesis Transport prototype.
// Resets every time the server restarts — this is a lab prototype, not production data.

const TERMINALS = [
  { code: "CVT", name: "Dasmariñas, Cavite", region: "Cavite" },
  { code: "ALB", name: "Alabang Terminal", region: "Muntinlupa" },
  { code: "CUB", name: "Cubao Terminal", region: "Quezon City" },
  { code: "BAC", name: "Baclaran Terminal", region: "Parañaque" },
  { code: "TAG", name: "Tagaytay Rotonda", region: "Cavite" },
  { code: "BAT", name: "Batangas Grand Terminal", region: "Batangas" },
  { code: "BAG", name: "Baguio Terminal", region: "Benguet" },
  { code: "VIG", name: "Vigan Terminal", region: "Ilocos Sur" },
];

const ROUTES = [
  { id: "R-CVT-ALB", originCode: "CVT", destCode: "ALB", durationMins: 55, basePrice: 120 },
  { id: "R-CVT-CUB", originCode: "CVT", destCode: "CUB", durationMins: 95, basePrice: 180 },
  { id: "R-CVT-BAC", originCode: "CVT", destCode: "BAC", durationMins: 70, basePrice: 140 },
  { id: "R-CVT-TAG", originCode: "CVT", destCode: "TAG", durationMins: 40, basePrice: 90 },
  { id: "R-ALB-BAT", originCode: "ALB", destCode: "BAT", durationMins: 110, basePrice: 220 },
  { id: "R-CUB-BAG", originCode: "CUB", destCode: "BAG", durationMins: 300, basePrice: 480 },
  { id: "R-CUB-VIG", originCode: "CUB", destCode: "VIG", durationMins: 480, basePrice: 620 },
  { id: "R-BAC-BAT", originCode: "BAC", destCode: "BAT", durationMins: 100, basePrice: 200 },
];

const BUS_TYPES = [
  { type: "Economy", multiplier: 1, perks: ["Aircon", "Reclining seat"] },
  { type: "Deluxe", multiplier: 1.35, perks: ["Aircon", "Extra legroom", "USB charging"] },
  { type: "Premium", multiplier: 1.75, perks: ["Aircon", "Wide leather seat", "USB charging", "Onboard wifi"] },
];

const DEPARTURE_HOURS = [5, 6, 7, 8, 9, 10, 12, 13, 15, 17, 19, 21];

function terminalByCode(code) {
  return TERMINALS.find((t) => t.code === code);
}

function seededRandom(seed) {
  // deterministic pseudo-random so seat maps/prices don't reshuffle on every request
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildTrips(routeId, dateStr) {
  const route = ROUTES.find((r) => r.id === routeId);
  if (!route) return [];
  const daySeed = dateStr ? dateStr.split("-").reduce((a, n) => a + Number(n), 0) : 1;

  return DEPARTURE_HOURS.map((hour, i) => {
    const bus = BUS_TYPES[(i + daySeed) % BUS_TYPES.length];
    const seed = daySeed * 1000 + hour + routeId.length;
    const bookedSeats = Math.floor(seededRandom(seed) * 34); // out of 40
    const price = Math.round(route.basePrice * bus.multiplier);
    const plate = `GTI-${String(1000 + ((seed * 7) % 8999)).slice(0, 4)}`;
    return {
      id: `${routeId}-${dateStr || "any"}-${hour}`,
      routeId,
      date: dateStr || null,
      departure: `${String(hour).padStart(2, "0")}:00`,
      arrival: addMinutes(hour, route.durationMins),
      durationMins: route.durationMins,
      busType: bus.type,
      perks: bus.perks,
      plate,
      price,
      totalSeats: 40,
      seatsBooked: bookedSeats,
      seatsAvailable: 40 - bookedSeats,
    };
  });
}

function addMinutes(startHour, mins) {
  const total = startHour * 60 + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function seatLayoutFor(trip) {
  // 40 seats, 2-2 configuration, 10 rows, seat ids like 1A 1B 1C 1D
  const cols = ["A", "B", "C", "D"];
  const seed = trip.date ? trip.date.split("-").reduce((a, n) => a + Number(n), 0) : 1;
  const bookedIndices = new Set();
  let idx = 0;
  while (bookedIndices.size < trip.seatsBooked && idx < 500) {
    const pseudo = Math.floor(seededRandom(seed + idx + trip.id.length) * 40);
    bookedIndices.add(pseudo);
    idx++;
  }
  const seats = [];
  let counter = 0;
  for (let row = 1; row <= 10; row++) {
    for (const col of cols) {
      const isAisleBreak = col === "B"; // aisle after B
      seats.push({
        id: `${row}${col}`,
        row,
        col,
        aisleAfter: isAisleBreak,
        status: bookedIndices.has(counter) ? "booked" : "available",
      });
      counter++;
    }
  }
  return seats;
}

// --- users & bookings (mutable, in-memory) ---
const users = [
  { id: "u-demo", name: "Lance dela Cruz", email: "demo@genesistransport.ph", password: "demo1234" },
];

const bookings = [];
let bookingSeq = 1000;

// --- seed a couple of demo bookings so the dashboard isn't empty on first run ---
(function seedDemoBookings() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const past = new Date();
  past.setDate(past.getDate() - 14);
  const pastIso = past.toISOString().slice(0, 10);
  const future = new Date();
  future.setDate(future.getDate() + 5);
  const futureIso = future.toISOString().slice(0, 10);

  const route1 = ROUTES[0]; // CVT -> ALB
  const route2 = ROUTES[3]; // CVT -> TAG

  const upcomingTrip = buildTrips(route1.id, futureIso)[2];
  const pastTrip = buildTrips(route2.id, pastIso)[1];

  bookings.push({
    id: `GT-${bookingSeq++}`,
    userId: "u-demo",
    tripId: upcomingTrip.id,
    routeId: route1.id,
    trip: upcomingTrip,
    seats: ["3A"],
    passengers: [{ seat: "3A", name: "Lance dela Cruz", contact: "09171234567" }],
    paymentMethod: "gcash",
    totalPrice: upcomingTrip.price + 20,
    status: "confirmed",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  });

  bookings.push({
    id: `GT-${bookingSeq++}`,
    userId: "u-demo",
    tripId: pastTrip.id,
    routeId: route2.id,
    trip: pastTrip,
    seats: ["7B", "7C"],
    passengers: [
      { seat: "7B", name: "Lance dela Cruz", contact: "09171234567" },
      { seat: "7C", name: "Aaliyah Santos", contact: "09179876543" },
    ],
    paymentMethod: "cash",
    totalPrice: pastTrip.price * 2 + 20,
    status: "confirmed",
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  });
})();

function createBooking({ userId, tripId, routeId, trip, seats, passengers, paymentMethod, totalPrice }) {
  const id = `GT-${bookingSeq++}`;
  const booking = {
    id,
    userId,
    tripId,
    routeId,
    trip,
    seats,
    passengers,
    paymentMethod,
    totalPrice,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  bookings.push(booking);
  return booking;
}

module.exports = {
  TERMINALS,
  ROUTES,
  BUS_TYPES,
  terminalByCode,
  buildTrips,
  seatLayoutFor,
  users,
  bookings,
  createBooking,
};
