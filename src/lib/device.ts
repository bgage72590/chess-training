// Telling an iPhone or iPad from a Mac, including an iPad that asks for desktop sites and a
// touchscreen Mac, which both say "Macintosh" and have touch points.

/** iOS WebKit's `navigator.standalone`: present on every iPhone and iPad browser, absent on a Mac. */
export const hasStandaloneApi = () => typeof navigator !== 'undefined' && 'standalone' in navigator;

/** An iPad asking for the desktop site says "Macintosh" and has a touch screen; so does a touchscreen
 *  Mac, which tells itself apart by lacking iOS's `navigator.standalone`. */
export function isIosDevice(ua: string, touchPoints: number, standaloneApi = hasStandaloneApi()): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1 && standaloneApi);
}
