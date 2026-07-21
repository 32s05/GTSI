const dns = require('node:dns'); 
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Import DB
const User = require('./models/User');
const Booking = require('./models/Booking');
const Terminal = require('./models/Terminal');
const Route = require('./models/Route');
const DB = require('./data/store');
require('dotenv').config();

const connectDB = require('./config/db');

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
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, contact } = req.body;

        const existing = await User.findOne({
            email: email.toLowerCase()
        });

        if (existing) {
            return res.status(400).json({
                error: 'Email already registered.'
            });
        }

        const user = await User.create({
            name,
            email,
            password,
            contact
        });

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                contact: user.contact
            }
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {

        const { email, password } = req.body;

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user || user.password !== password) {
            return res.status(401).json({
                error: 'Invalid email or password.'
            });
        }

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                contact: user.contact
            }
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

// --- TERMINALS & ROUTES APIs ---
app.get('/api/terminals', async (req, res) => {
    try {
        const terminals = await Terminal.find({});
        res.json({ terminals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/routes', async (req, res) => {
    try {
        const routes = await Route.find({});
        
        // Enrich routes with their respective origin and destination terminal documents
        const terminals = await Terminal.find({});
        const terminalMap = {};
        terminals.forEach(t => { terminalMap[t.code] = t; });

        const detailedRoutes = routes.map(route => {
            const routeObj = route.toObject();
            return {
                ...routeObj,
                origin: terminalMap[route.originCode] || null,
                destination: terminalMap[route.destCode] || null
            };
        });

        res.json({ routes: detailedRoutes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- TRIP SEARCH & SEATS ---
app.get('/api/trips/search', async (req, res) => {
    try {
        const { from, to, date } = req.query;
        
        // Find the active route from MongoDB
        const activeRoute = await Route.findOne({ originCode: from, destCode: to });
        
        if (!activeRoute) {
            return res.json({ route: null, trips: [] });
        }

        const originTerminal = await Terminal.findOne({ code: activeRoute.originCode });
        const destTerminal = await Terminal.findOne({ code: activeRoute.destCode });

        const detailedRoute = {
            ...activeRoute.toObject(),
            origin: originTerminal,
            destination: destTerminal
        };

        // DB.buildTrips can still use the route's string ID and date generation logic
        const generatedTrips = DB.buildTrips(activeRoute.id, date);
        res.json({ route: detailedRoute, trips: generatedTrips });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/trips/:tripId/seats', async (req, res) => {
    try {
        const { tripId } = req.params;
        const { routeId, date } = req.query;

        // Verify route exists in DB first to ensure integrity
        const activeRoute = await Route.findOne({ id: routeId });
        if (!activeRoute) {
            return res.status(404).json({ error: "Route configuration not found." });
        }

        const dayTrips = DB.buildTrips(routeId, date);
        const specificTrip = dayTrips.find(t => t.id === tripId);

        if (!specificTrip) {
            return res.status(404).json({ error: "Trip schedule could not be found." });
        }

        const matrix = DB.seatLayoutFor(specificTrip);
        res.json({ seats: matrix });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- BOOKINGS ENGINE ---

app.get('/api/bookings', async (req, res) => {

    try {

        const { userId } = req.query;

        const bookings =
            await Booking.find({ userId });

        const enrichedMatches = bookings.map(b => ({
            ...b.toObject(),
            route: DB.ROUTES
                .map(r => ({
                    ...r,
                    origin: DB.terminalByCode(r.originCode),
                    destination: DB.terminalByCode(r.destCode)
                }))
                .find(r => r.id === b.routeId)
        }));

        res.json({
            bookings: enrichedMatches
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const { userId, tripId, routeId, trip, seats, passengers, paymentMethod } = req.body;
        const totalPrice = (trip.price * seats.length) + 20;

        // Generate a random ID like GT-1A2B3
        const uniqueId = `GT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const booking = await Booking.create({ 
            _id: uniqueId, // Set custom ID
            userId, tripId, routeId, trip, seats, passengers, paymentMethod, totalPrice 
        });
        
        res.json({ booking: { ...booking.toObject(), id: booking._id } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bookings/:bookingId', async (req, res) => {
    try {
        const booking = await Booking.findOneAndUpdate(
            { _id: req.params.bookingId }, // Explicit filter object
            { status: 'cancelled' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({
                error: 'Booking not found.'
            });
        }

        res.json({ booking });
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

// 404 Fallback routing handler
app.use((req, res) => res.status(404).render('404'));

connectDB();

// Launch application lifecycle listener execution
app.listen(PORT, () => {
    console.log(`🚀 Genesis Transport Server actively running at http://localhost:${PORT}`);
    console.log(`💡 Demo Account Login Credential: email: "demo@genesistransport.ph" | password: "demo1234"`);
});