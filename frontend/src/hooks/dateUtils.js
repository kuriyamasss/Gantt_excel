// frontend/src/utils/dateUtils.js
export function isoToDate(iso) {
  if (!iso) return null;
  return new Date(iso + "T00:00:00");
}
export function dateToISO(d) {
  if (!d) return null;
  return d.toISOString().slice(0,10);
}
export function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / (24*3600*1000));
}
