const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Import your custom in-memory store
const DB = require('./data/store');

// Set up EJS templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. FRONTEND ROUTING (Serving EJS views)
// ==========================================
app.get('/', (req, res) => res.render('index'));
app.get('/index.ejs', (req, res) => res.render('index'));
app.get('/booking.ejs', (req, res) => res.render('booking'));
app.get('/seats.ejs', (req, res) => res.render('seats'));
app.get('/checkout.ejs', (req, res) => res.render('checkout'));
app.get('/dashboard.ejs', (req, res) => res.render('dashboard'));
app.get('/login.ejs', (req, res) => res.render('login'));
app.get('/signup.ejs', (req, res) => res.render('signup'));

// ==========================================
// 2. BACKEND API ROUTES (Wired to data/store.js)
// ==========================================

// --- AUTH APIs ---
app.post('/api/auth/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Please fill out all fields." });
    }
    
    // Check if user already exists
    const existing = DB.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) return res.status(400).json({ error: "Email is already registered." });

    const newUser = { id: `u-${Date.now()}`, name, email, password };
    DB.users.push(newUser);
    
    res.json({ user: { id: newUser.id, name: newUser.name, email: newUser.email } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = DB.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: "Invalid email or password." });
    }
    
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

// --- TERMINALS & ROUTES APIs ---
app.get('/api/terminals', (req, res) => {
    res.json({ terminals: DB.TERMINALS });
});

app.get('/api/routes', (req, res) => {
    // Enrich routes with full origin and destination data objects for the UI tiles
    const detailedRoutes = DB.ROUTES.map(route => ({
        ...route,
        origin: DB.terminalByCode(route.originCode),
        destination: DB.terminalByCode(route.destCode)
    }));
    res.json({ routes: detailedRoutes });
});

// --- TRIP SEARCH & SEATS ---
app.get('/api/trips/search', (req, res) => {
    const { from, to, date } = req.query;
    
    // Look for a route matching the requested origin and destination codes
    const activeRoute = DB.ROUTES.find(r => r.originCode === from && r.destCode === to);
    
    if (!activeRoute) {
        return res.json({ route: null, trips: [] });
    }

    const detailedRoute = {
        ...activeRoute,
        origin: DB.terminalByCode(activeRoute.originCode),
        destination: DB.terminalByCode(activeRoute.destCode)
    };

    // Build the dynamic trips for that route and date using the store logic
    const generatedTrips = DB.buildTrips(activeRoute.id, date);
    res.json({ route: detailedRoute, trips: generatedTrips });
});

app.get('/api/trips/:tripId/seats', (req, res) => {
    const { tripId } = req.params;
    const { routeId, date } = req.query;

    // Regenerate the specific trip instance parameters
    const dayTrips = DB.buildTrips(routeId, date);
    const specificTrip = dayTrips.find(t => t.id === tripId);

    if (!specificTrip) {
        return res.status(404).json({ error: "Trip schedule could not be found." });
    }

    // Get the matrix of seats mapping out dynamic layout statuses
    const matrix = DB.seatLayoutFor(specificTrip);
    res.json({ seats: matrix });
});

// --- BOOKINGS ENGINE ---
app.post('/api/bookings', (req, res) => {
    const { userId, tripId, routeId, trip, seats, passengers, paymentMethod } = req.body;
    
    // Calculate total pricing based on selected seats and the flat ₱20 terminal fee
    const totalPrice = (trip.price * seats.length) + 20;

    // Use the store's core instance creation function
    const booking = DB.createBooking({
        userId,
        tripId,
        routeId,
        trip,
        seats,
        passengers,
        paymentMethod,
        totalPrice
    });

    res.json({ booking });
});

app.get('/api/bookings', (req, res) => {
    const { userId } = req.query;
    
    // Filter the bookings list tracking entries belonging to this specific ID
    const matches = DB.bookings.filter(b => b.userId === userId);
    
    // Enrich each booking object with structural data before returning
    const enrichedMatches = matches.map(b => ({
        ...b,
        route: DB.ROUTES.map(r => ({
            ...r,
            origin: DB.terminalByCode(r.originCode),
            destination: DB.terminalByCode(r.destCode)
        })).find(r => r.id === b.routeId)
    }));

    res.json({ bookings: enrichedMatches });
});

app.delete('/api/bookings/:bookingId', (req, res) => {
    const { bookingId } = req.params;
    const target = DB.bookings.find(b => b.id === bookingId);
    
    if (!target) {
        return res.status(404).json({ error: "Booking reservation not found." });
    }

    target.status = "cancelled";
    res.json({ booking: target });
});

// 404 Fallback routing handler
app.use((req, res) => res.status(404).render('404'));

// Launch application lifecycle listener execution
app.listen(PORT, () => {
    console.log(`🚀 Genesis Transport Server actively listening at http://localhost:${PORT}`);
    console.log(`💡 Demo Account Login Credential: email: "demo@genesistransport.ph" | password: "demo1234"`);
});