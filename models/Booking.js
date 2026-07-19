const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tripId: String,
    routeId: String,
    trip: Object,
    seats: [String],
    passengers: [{ seat: String, name: String, contact: String }],
    paymentMethod: String,
    totalPrice: Number,
    status: { type: String, default: 'confirmed' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);