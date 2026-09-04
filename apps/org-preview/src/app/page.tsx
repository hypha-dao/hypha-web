import { ENTRIES } from '@/lib/entries';
import { App } from './app';

/** `/` — Hypha Energy's Overview, as a member. */
export default function Page() {
  return <App entry={ENTRIES.overview} />;
}
