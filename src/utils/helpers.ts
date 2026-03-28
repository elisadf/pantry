export function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
}

export function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getCurrentWeekString(): string {
    return getWeekNumber(new Date());
}

export function parseFoodGroups(groups: string[]): string[] {
    const validGroups = ["protein", "vegetables", "grains", "legumes", "dairy/alternatives", "healthy fats", "fruit"];
    return groups.filter((g) => validGroups.includes(g.toLowerCase()));
}

export function countExtrasPlants(extras: string): number {
    if (!extras.trim()) return 0;
    return extras.split(",").filter((item) => item.trim().length > 0).length;
}

export function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function getWeekEnd(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7);
    d.setDate(diff);
    d.setHours(23, 59, 59, 999);
    return d;
}

export function isDateInWeek(date: Date, targetDate: Date): boolean {
    const weekStart = getWeekStart(targetDate);
    const weekEnd = getWeekEnd(targetDate);
    return date >= weekStart && date <= weekEnd;
}

export function formatWeekRange(startDate: Date, endDate: Date): string {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
}

export function getDateFromWeek(weekStr: string): Date | null {
    let year = new Date().getFullYear();
    let weekNumber;

    // Matches "2026-W12" or "2026-w12"
    const isoMatch = weekStr.match(/^(\d{4})-[wW](\d{1,2})$/);
    if (isoMatch) {
        year = parseInt(isoMatch[1], 10);
        weekNumber = parseInt(isoMatch[2], 10);
    } else {
        // Matches "week12", "week 12", "Week12"
        const simpleMatch = weekStr.match(/^week\s*(\d{1,2})$/i);
        if (simpleMatch) {
            weekNumber = parseInt(simpleMatch[1], 10);
        } else {
            return null; // Not a valid week string
        }
    }

    if (weekNumber < 1 || weekNumber > 53) return null;

    // January 4th is always in week 1.
    const date = new Date(year, 0, 4);
    const day = date.getDay();
    
    // Find the Monday of Week 1
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    
    // Add the required number of weeks
    date.setDate(date.getDate() + (weekNumber - 1) * 7);
    return date;
}
