const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    originCode: { type: String, required: true },
    destCode: { type: String, required: true },
    durationMins: { type: Number, required: true },
    basePrice: { type: Number, required: true }
});

module.exports = mongoose.model('Route', RouteSchema);