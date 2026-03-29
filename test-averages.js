const dailyBreakdown = [
    { date: '2024-03-25', aggregate: { calories: 100, protein: 10, fat: 5, carbs: 10, fibre: 2 } },
    { date: '2024-03-26', aggregate: { calories: 200, protein: 20, fat: 10, carbs: 20, fibre: 4 } },
    { date: '2024-03-27', aggregate: { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 } },
    { date: '2024-03-29', aggregate: { calories: 150, protein: 15, fat: 7, carbs: 15, fibre: 3 } }
];

const today = new Date('2024-03-28T12:00:00Z');
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const todayStr = `${year}-${month}-${day}`;
console.log('todayStr:', todayStr);

const validDays = dailyBreakdown.filter(day => {
    const isValidDate = day.date <= todayStr;
    const hasMacros = day.aggregate.calories > 0 || 
           day.aggregate.protein > 0 || 
           day.aggregate.fat > 0 || 
           day.aggregate.carbs > 0 || 
           day.aggregate.fibre > 0;
    return isValidDate && hasMacros;
});

console.log('validDays:', validDays);
