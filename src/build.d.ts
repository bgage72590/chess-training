/** When and from which commit this copy of the app was built (vite.config.ts). */
declare const __BUILD__: string;

interface ImportMetaEnv {
  /** The address the app is published at, for links and QR codes that hand it to someone else (see APP_URL). */
  readonly VITE_APP_URL?: string;
}
