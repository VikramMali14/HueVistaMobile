import { useLocalSearchParams } from 'expo-router';
import { RoomEditor } from '../../src/studio/RoomEditor';

/**
 * One room. All of it lives in `RoomEditor` so the route stays a route: the
 * screen is shared with nothing today, but it is 700 lines of editor and the
 * separation is what let the canvas, the dock and the marking popup be split
 * into testable pieces underneath it.
 */
export default function ProjectRoute() {
  const raw = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  return <RoomEditor id={id} />;
}
