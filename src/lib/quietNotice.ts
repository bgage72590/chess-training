// What the map's speaker button says when it is tapped (Kids mode, MapScreen.tsx). It is a notice
// for whoever is watching, shown as a toast and never spoken, so it lives here and not in src/kids,
// where scripts/voice/collect.ts would take every sentence for a line Pip has to be recorded saying.
export const quietNotice = (on: boolean) => (on ? 'Quiet mode on: Pip stays quiet. Tap the speaker to hear a line.' : 'Quiet mode off: Pip can talk again.');
