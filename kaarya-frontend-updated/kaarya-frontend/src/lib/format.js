export function inr(value) {
  const n = Number(value || 0);
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function pct(confidence) {
  return Math.round(Number(confidence || 0) * 100) + '%';
}

/** Compact lakh notation for GMV figures, e.g. ₹14.2L. */
export function lakhs(value) {
  const n = Number(value || 0);
  return '₹' + (n / 100000).toFixed(1) + 'L';
}

export function clockTime(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function dayLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
