const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // e.g., TRIP-CVT-BAG-0800
    routeId: { type: String, required: true },
    departureTime: { type: String, required: true }, // e.g., "08:00 AM"
    arrivalTime: { type: String, default: '' }, // e.g., "10:30 AM"
    durationMins: { type: Number, default: 0 },
    busType: { type: String, default: 'Economy' },
    plateNumber: { type: String, default: '' },
    date: { type: String, required: true },          // e.g., "2026-07-22"
    totalSeats: { type: Number, default: 40 },
    status: { 
        type: String, 
        enum: ['active', 'cancelled', 'delayed'], 
        default: 'active' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);