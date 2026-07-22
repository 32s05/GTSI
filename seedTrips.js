const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://afyaangeles14_db_user:zPMoZVfwH2CyfrTu@gt.eyzdnnh.mongodb.net/?appName=GT');

const scheduleSchema = new mongoose.Schema({
  id: String,
  routeId: String,
  departureTime: String,
  arrivalTime: String,
  durationMins: Number,
  busType: String,
  plateNumber: String,
  date: String,
  totalSeats: Number,
  status: String,
}, { timestamps: true });

const Schedule = mongoose.model('Schedule', scheduleSchema);

async function generateBulkSchedules() {
  const routes = [
    { routeId: 'RT-CUB-CRK', duration: 150 },
    { routeId: 'RT-CRK-CUB', duration: 150 },
    { routeId: 'RT-TRN-CRK', duration: 90 },
    { routeId: 'RT-CRK-TRN', duration: 90 },
    { routeId: 'RT-NAT-CRK', duration: 110 },
    { routeId: 'RT-CRK-NAT', duration: 110 },
    { routeId: 'RT-PTX-CRK', duration: 120 },
    { routeId: 'RT-CRK-PTX', duration: 120 },
    { routeId: 'RT-BLN-CRK', duration: 70 },
    { routeId: 'RT-CRK-BLN', duration: 70 }
  ];
  
  const times = ['4:00 AM', '7:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '5:00 PM', '7:00 PM', '9:00 PM', '10:00 PM'];
  const dates = ['2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26'];
  
  let newTrips = [];

  for (const route of routes) {
    for (const date of dates) {
      for (const time of times) {
        // Simple helper to calculate arrival time based on duration
        const [timePart, modifier] = time.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        
        const depDate = new Date();
        depDate.setHours(hours, minutes, 0);
        const arrDate = new Date(depDate.getTime() + route.duration * 60000);
        
        let arrHours = arrDate.getHours();
        const arrModifier = arrHours >= 12 ? 'PM' : 'AM';
        arrHours = arrHours % 12 || 12;
        const arrivalTime = `${String(arrHours).padStart(2, '0')}:${String(arrDate.getMinutes()).padStart(2, '0')} ${arrModifier}`;
        
        const idTimeSuffix = time.replace(':', '').replace(' ', '');
        const randomLetters = Math.random().toString(36).substring(2, 5).toUpperCase();
        const randomNumbers = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        const busTypes = ['Economy', 'Premium', 'Deluxe'];
        
        newTrips.push({
          id: `TRIP-${route.routeId}-${idTimeSuffix}-${Math.random().toString(36).substring(2, 8)}`,
          routeId: route.routeId,
          departureTime: time,
          arrivalTime: arrivalTime,
          durationMins: route.duration,
          busType: busTypes[Math.floor(Math.random() * busTypes.length)],
          plateNumber: `${randomLetters}${randomNumbers}`,
          date: date,
          totalSeats: 40,
          status: 'active'
        });
      }
    }
  }

  await Schedule.insertMany(newTrips);
  console.log('Successfully seeded trips into Atlas!');
  mongoose.connection.close();
}

generateBulkSchedules();