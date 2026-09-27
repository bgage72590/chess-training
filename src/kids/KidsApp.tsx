// Kids mode: a separate, full-screen app for young learners at #/kids/...
// Placeholder until the Kids mode is built.
import { navigate } from '../router';

export function KidsApp({ route }: { route: string }) {
  return (
    <div className="kids-app">
      <p>Kids mode ({route}) is coming soon.</p>
      <button onClick={() => navigate('home')}>Back</button>
    </div>
  );
}
