// The app is the web app in a window: everything happens in the web view (dist-native, built by
// `npm run build:native`). Nothing here talks to the system beyond opening the window.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running Tempo");
}
