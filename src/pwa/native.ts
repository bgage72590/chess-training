// Built into a native app (the Mac app or the iPhone and iPad app, `vite build --mode native`): the files
// ship inside the app, so there is no service worker, no install step and no update check, and the hosted
// web app's address is what gets handed to other people. See native/README.md.
export const IS_NATIVE = import.meta.env.MODE === 'native';
