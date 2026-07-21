const dns = require('node:dns'); 
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Import DB Models & Store
const User = require('./models/User');
const Booking = require('./models/Booking');
const Terminal = require('./models/Terminal');
const Route = require('./models/Route');
const Schedule = require('./models/Schedule');
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
// RBAC SECURITY MIDDLEWARE
// ==========================================
const requireAdmin = async (req, res, next) => {
    try {
        const userId = req.headers['x-user-id'] || req.query.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

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
app.get('/admin.ejs', (req, res) => res.render('admin')); // Secured admin view template
app.get('/admin-routes.ejs', (req, res) => res.render('admin-routes'));
app.get('/admin-terminals.ejs', (req, res) => res.render('admin-terminals'));
app.get('/admin-users.ejs', (req, res) => res.render('admin-users'));
app.get('/admin-bookings.ejs', (req, res) => res.render('admin-bookings'));
app.get('/admin-schedules.ejs', (req, res) => res.render('admin-schedules', {
    busTypes: DB.BUS_TYPES.map((bus) => bus.type),
    busTypeOptions: DB.BUS_TYPES.map((bus) => bus.type)
}));

// ==========================================
// 2. BACKEND API ROUTES
// ==========================================

// --- AUTH APIs (Updated to include role) ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, contact } = req.body;
        const existing = await User.findOne({ email: email.toLowerCase() });

        if (existing) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const user = await User.create({ name, email, password, contact });

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                contact: user.contact,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                contact: user.contact,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

        // Query live schedules from MongoDB instead of static store helper
        const dbSchedules = await Schedule.find({ routeId: activeRoute.id, date });

        const liveTrips = await Promise.all(dbSchedules.map(async (sched) => {
            // Skip cancelled trips from search results if desired
            if (sched.status === 'cancelled') return null;

            const tripBookings = await Booking.find({ 
                tripId: sched.id, 
                status: { $ne: 'cancelled' } 
            });

            let totalBookedSeats = 0;
            tripBookings.forEach(b => {
                if (b.seats && Array.isArray(b.seats)) {
                    totalBookedSeats += b.seats.length;
                }
            });

            return {
                id: sched.id,
                routeId: sched.routeId,
                departure: sched.departureTime,
                departureTime: sched.departureTime,
                arrival: sched.arrivalTime,
                durationMins: sched.durationMins,
                busType: sched.busType,
                plate: sched.plateNumber,
                plateNumber: sched.plateNumber,
                price: activeRoute.basePrice,
                totalSeats: sched.totalSeats,
                status: sched.status,
                seatsBooked: totalBookedSeats,
                seatsAvailable: Math.max(0, sched.totalSeats - totalBookedSeats)
            };
        }));

        // Filter out nulls (in case we skipped cancelled trips)
        res.json({ route: detailedRoute, trips: liveTrips.filter(Boolean) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/trips/:tripId/seats', async (req, res) => {
    try {
        const { tripId } = req.params;
        const { routeId } = req.query;

        const activeRoute = await Route.findOne({ id: routeId });
        if (!activeRoute) {
            return res.status(404).json({ error: "Route configuration not found." });
        }

        const existingBookings = await Booking.find({ 
            tripId, 
            status: { $ne: 'cancelled' } 
        });

        const bookedSeatsSet = new Set();
        existingBookings.forEach(b => {
            if (b.seats) {
                b.seats.forEach(seatNum => bookedSeatsSet.add(seatNum));
            }
        });

        const cols = ["A", "B", "C", "D"];
        const seats = [];
        for (let row = 1; row <= 10; row++) {
            for (const col of cols) {
                const seatId = `${row}${col}`;
                const isBooked = bookedSeatsSet.has(seatId);
                seats.push({
                    id: seatId,
                    row,
                    col,
                    aisleAfter: col === "B",
                    status: isBooked ? "booked" : "available",
                });
            }
        }

        res.json({ seats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- BOOKINGS ENGINE ---
app.get('/api/bookings', async (req, res) => {
    try {
        const { userId } = req.query;
        const bookings = await Booking.find({ userId });

        const routes = await Route.find({});
        const terminals = await Terminal.find({});
        const terminalMap = {};
        terminals.forEach(t => { terminalMap[t.code] = t; });

        const enrichedMatches = bookings.map(b => {
            const matchedRoute = routes.find(r => r.id === b.routeId);
            let routeEnriched = null;
            if (matchedRoute) {
                routeEnriched = {
                    ...matchedRoute.toObject(),
                    origin: terminalMap[matchedRoute.originCode] || null,
                    destination: terminalMap[matchedRoute.destCode] || null
                };
            }
            return {
                ...b.toObject(),
                route: routeEnriched
            };
        });

        res.json({ bookings: enrichedMatches });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const { userId, tripId, routeId, trip, seats, passengers, paymentMethod } = req.body;
        const totalPrice = (trip.price * seats.length) + 20; 

        const uniqueId = `GT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const booking = await Booking.create({ 
            _id: uniqueId,
            userId, 
            tripId, 
            routeId, 
            trip, 
            seats, 
            passengers, 
            paymentMethod, 
            totalPrice,
            status: 'confirmed'
        });
        
        res.json({ booking: { ...booking.toObject(), id: booking._id } });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.delete('/api/bookings/:bookingId', async (req, res) => {
    try {
        const booking = await Booking.findOneAndUpdate(
            { _id: req.params.bookingId },
            { status: 'cancelled' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        res.json({ booking });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. SECURED ADMIN MANAGEMENT APIs (RBAC)
// ==========================================
app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
    try {
        const bookings = await Booking.find({}).sort({ createdAt: -1 });
        res.json({ bookings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { name, email, contact, password, role } = req.body;
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered.' });
        }
        const user = await User.create({ name, email, password, contact, role: role || 'user' });
        res.json({ user: { ...user.toObject(), password: undefined } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const update = { ...req.body };
        if (!update.password) delete update.password;
        if (update.email) update.email = update.email.toLowerCase();
        const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ success: true, message: 'User removed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/routes', requireAdmin, async (req, res) => {
    try {
        const { id, originCode, destCode, durationMins, basePrice } = req.body;
        const existing = await Route.findOne({ id });
        if (existing) {
            return res.status(400).json({ error: 'Route ID already exists.' });
        }

        const newRoute = await Route.create({ id, originCode, destCode, durationMins, basePrice });
        res.json({ route: newRoute });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/routes/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await Route.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ error: 'Route not found.' });
        }
        res.json({ route: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/routes/:id', requireAdmin, async (req, res) => {
    try {
        const deleted = await Route.findOneAndDelete({ id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ error: 'Route not found.' });
        }
        res.json({ success: true, message: 'Route removed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/terminals', requireAdmin, async (req, res) => {
    try {
        const { code, name, region } = req.body;
        const existing = await Terminal.findOne({ code });
        if (existing) {
            return res.status(400).json({ error: 'Terminal code already exists.' });
        }

        const terminal = await Terminal.create({ code, name, region });
        res.json({ terminal });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/terminals/:code', requireAdmin, async (req, res) => {
    try {
        const updated = await Terminal.findOneAndUpdate(
            { code: req.params.code },
            req.body,
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ error: 'Terminal not found.' });
        }
        res.json({ terminal: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/terminals/:code', requireAdmin, async (req, res) => {
    try {
        const deleted = await Terminal.findOneAndDelete({ code: req.params.code });
        if (!deleted) {
            return res.status(404).json({ error: 'Terminal not found.' });
        }
        res.json({ success: true, message: 'Terminal removed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN SCHEDULE MANAGEMENT ---

app.get('/api/admin/schedules', requireAdmin, async (req, res) => {
    try {
        const schedules = await Schedule.find({}).sort({ date: 1, departureTime: 1 });
        res.json({ schedules });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/schedules', requireAdmin, async (req, res) => {
    try {
        const { id, routeId, departureTime, arrivalTime, durationMins, busType, plateNumber, date, totalSeats, status } = req.body;
        const existing = await Schedule.findOne({ id });
        if (existing) {
            return res.status(400).json({ error: 'Schedule ID already exists.' });
        }

        const newSchedule = await Schedule.create({
            id,
            routeId,
            departureTime,
            arrivalTime: arrivalTime || '',
            durationMins: durationMins || 0,
            busType: busType || 'Economy',
            plateNumber: plateNumber || '',
            date,
            totalSeats: totalSeats || 40,
            status: status || 'active'
        });
        res.json({ schedule: newSchedule });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/schedules/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await Schedule.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }
        res.json({ schedule: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/schedules/:id', requireAdmin, async (req, res) => {
    try {
        const deleted = await Schedule.findOneAndDelete({ id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }
        res.json({ success: true, message: 'Schedule removed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/schedules/:id/status', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await Schedule.findOneAndUpdate(
            { id: req.params.id },
            { status },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }
        res.json({ schedule: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 404 Fallback routing handler
app.use((req, res) => res.status(404).render('404'));

connectDB();

app.listen(PORT, () => {
    console.log(`🚀 Genesis Transport Server actively running at http://localhost:${PORT}`);
    console.log(`💡 Demo Account Login Credential: email: "demo@genesistransport.ph" | password: "demo1234"`);
});