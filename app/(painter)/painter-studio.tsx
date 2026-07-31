import { StudioScreen } from '../../src/studio/StudioScreen';

/**
 * The painter's Studio tab — the same one the customer and the admin get.
 *
 * The layout beside this file has always described the visualizer as
 * first-class for a painter (they are usually the one in the room when the
 * customer changes their mind), but no such tab existed; this is it.
 */
export default function PainterStudio() {
  return <StudioScreen />;
}
