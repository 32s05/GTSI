require('dotenv').config(); // Or require('dotenv').config({ path: './.env' });

console.log("Checking Mongo URI:", process.env.MONGODB_URI); // Debug log to see if it's undefined

const mongoose = require('mongoose');
const Terminal = require('./models/Terminal');
const Route = require('./models/Route');
const { TERMINALS, ROUTES } = require('./data/store');

async function migrateData() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from your environment variables or .env file.');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for migration...");

    // 1. Clear existing Terminals and Routes
    await Terminal.deleteMany({});
    await Route.deleteMany({});
    console.log("Cleared old terminal and route documents.");

    // 2. Insert Terminals
    await Terminal.insertMany(TERMINALS);
    console.log(`Successfully migrated ${TERMINALS.length} terminals.`);

    // 3. Insert Routes
    await Route.insertMany(ROUTES);
    console.log(`Successfully migrated ${ROUTES.length} routes.`);

    console.log("Data migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}

migrateData();