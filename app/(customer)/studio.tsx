import { StudioScreen } from '../../src/studio/StudioScreen';

/**
 * The customer's Studio tab. All of it lives in the shared `StudioScreen` so the
 * admin tab and this one cannot drift.
 */
export default function Studio() {
  return <StudioScreen />;
}
