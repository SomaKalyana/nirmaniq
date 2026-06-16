// Format as Indian Rupees — full number with 2 decimal places
// Uses Indian numbering system (lakhs/crores) for display but keeps decimals
export const fmtINR = (n) => {
    if (n === undefined || n === null || isNaN(n)) return '₹0.000';
    const num = Number(n);
    // Full number with Indian locale and 3 decimal places
    return '₹' + num.toLocaleString('en-IN', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });
};

// Compact format for summaries (Cr/L/K) — still 2 decimal places
export const fmtINRCompact = (n) => {
    if (!n) return '₹0.00';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
    if (n >= 1000)     return `₹${(n / 1000).toFixed(2)}K`;
    return `₹${Number(n).toFixed(3)}`;
};

export const fmtDate = () =>
    new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

export const fmtTime = () =>
    new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    });

export const pct = (done, total) =>
    total > 0 ? Math.round((done / total) * 100) : 0;

export const clamp = (val, min = 0, max = 100) =>
    Math.min(max, Math.max(min, val));

