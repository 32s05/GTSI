const mongoose = require('mongoose');

const TerminalSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    region: { type: String, required: true }
});

module.exports = mongoose.model('Terminal', TerminalSchema);