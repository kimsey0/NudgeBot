const useBusinessDays = process.env.BUSINESS_DAYS && process.env.BUSINESS_HOURS;
const businessDays = useBusinessDays && process.env.BUSINESS_DAYS.split(",").map(n => parseInt(n, 10));
const businessHours = useBusinessDays && process.env.BUSINESS_HOURS.split(",").map(n => parseInt(n, 10));

const millisecondsPerHour = 60 * 60 * 1000;
const millisecondsPerDay = millisecondsPerHour * 24;

const isBusinessHour = date => businessDays.includes(date.getDay()) && businessHours.includes(date.getHours());

const calculateAge = function(date, now) {
    if (now <= date) {
        return 0;
    }

    const fullAge = date - now;
    if (!useBusinessDays || fullAge / millisecondsPerDay > 30) {
        return Math.floor(fullAge / millisecondsPerHour);
    }

    var temp = new Date(date);
    var hours = 0;
    while (temp < now) {
        if (isBusinessHour(temp)) {
            hours += 1;
        }

        temp.setTime(temp.getTime() + millisecondsPerHour);
    }
    return hours;
}

module.exports = calculateAge;
