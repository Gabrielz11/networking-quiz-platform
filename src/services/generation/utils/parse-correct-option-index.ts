export function parseCorrectOptionIndex(raw: unknown): number {
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
        const str = raw.trim().toUpperCase();
        if (str === "0" || str === "A") return 0;
        if (str === "1" || str === "B") return 1;
        if (str === "2" || str === "C") return 2;
        if (str === "3" || str === "D") return 3;
    }
    return -1;
}
