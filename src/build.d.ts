/** When and from which commit this copy of the app was built (vite.config.ts). */
declare const __BUILD__: string;

interface ImportMetaEnv {
  /** The address the app is published at, for links and QR codes that hand it to someone else (see APP_URL). */
  readonly VITE_APP_URL?: string;
  /** Native smoke build (CI): open #/diag at start-up, and post its report to this address. */
  readonly VITE_NATIVE_SMOKE?: string;
  readonly VITE_NATIVE_REPORT_URL?: string;
}
