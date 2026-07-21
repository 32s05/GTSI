// data/store.js
// Only keeps bus tier configurations and helper functions for trip scheduling.

const BUS_TYPES = [
  { type: "Economy", multiplier: 1, perks: ["Aircon", "Reclining seat"] },
  { type: "Deluxe", multiplier: 1.35, perks: ["Aircon", "Extra legroom", "USB charging"] },
  { type: "Premium", multiplier: 1.75, perks: ["Aircon", "Wide leather seat", "USB charging", "Onboard wifi"] },
];

const DEPARTURE_HOURS = [5, 6, 7, 8, 9, 10, 12, 13, 15, 17, 19, 21];

function buildTripsForRoute(route, dateStr) {
  if (!route) return [];
  const daySeed = dateStr ? dateStr.split("-").reduce((a, n) => a + Number(n), 0) : 1;

  return DEPARTURE_HOURS.map((hour, i) => {
    const bus = BUS_TYPES[(i + daySeed) % BUS_TYPES.length];
    const seed = daySeed * 1000 + hour + route.id.length;
    const price = Math.round(route.basePrice * bus.multiplier);
    const plate = `GTI-${String(1000 + ((seed * 7) % 8999)).slice(0, 4)}`;
    return {
      id: `${route.id}-${dateStr || "any"}-${hour}`,
      routeId: route.id,
      date: dateStr || null,
      departure: `${String(hour).padStart(2, "0")}:00`,
      arrival: addMinutes(hour, route.durationMins),
      durationMins: route.durationMins,
      busType: bus.type,
      perks: bus.perks,
      plate,
      price,
      totalSeats: 40,
    };
  });
}

function addMinutes(startHour, mins) {
  const total = startHour * 60 + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

module.exports = {
  BUS_TYPES,
  buildTripsForRoute,
};