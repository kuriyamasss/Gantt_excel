// frontend/src/hooks/useGanttCoords.js
/**
 * useGanttCoords - tiny helper functions for date <-> x conversions
 * Not a React hook stateful; just utility exported as functions
 *
 * Usage: import useGanttCoords from "../hooks/useGanttCoords"; const { dateToX, daysBetween, xToDate } = useGanttCoords({minDate,maxDate});
 */
export default function useGanttCoords({ minDate, maxDate }) {

  function parseISO(d) {
    if (!d) return null;
    return new Date(d + "T00:00:00");
  }

  function daysBetween(a,b) {
    const da = parseISO(a); const db = parseISO(b);
    if (!da || !db) return 0;
    return Math.round((db - da) / (24*3600*1000));
  }

  // dateToX accepts iso string OR base iso + offsetDays (if second param is number)
  function dateToX(baseOrIso, offsetDaysOrIso) {
    // we will accept (iso) or (baseIso, offsetDays)
    let baseIso = minDate;
    if (offsetDaysOrIso === undefined) {
      // called as dateToX(isoString)
      const iso = baseOrIso;
      const d0 = parseISO(minDate);
      const d1 = parseISO(maxDate);
      if (!d0 || !d1) return 160;
      const total = (d1 - d0) / (24*3600*1000);
      const pos = (parseISO(iso) - d0) / (24*3600*1000);
      const left = 160;
      const usable = 1200;
      return left + (pos / Math.max(1,total)) * usable;
    } else {
      // called as dateToX(baseIso, offsetDays)
      const offsetDays = offsetDaysOrIso;
      const d0 = parseISO(minDate);
      const d1 = parseISO(maxDate);
      if (!d0 || !d1) return 160 + offsetDays * 18;
      const total = (d1 - d0) / (24*3600*1000);
      const left = 160;
      const usable = 1200;
      return left + (offsetDays / Math.max(1,total)) * usable;
    }
  }

  // xToDate approximate (inverse)
  function xToDate(x) {
    const left = 160;
    const usable = 1200;
    const d0 = parseISO(minDate);
    const d1 = parseISO(maxDate);
    if (!d0 || !d1) return "";
    const total = (d1 - d0) / (24*3600*1000);
    const ratio = (x - left) / usable;
    const days = Math.round(ratio * total);
    const dt = new Date(d0); dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0,10);
  }

  return { dateToX, daysBetween, xToDate };
}
