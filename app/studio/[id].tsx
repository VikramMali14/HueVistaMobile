import { useLocalSearchParams } from 'expo-router';
import { RoomFlow } from '../../src/studio/RoomFlow';
import type { Shade } from '../../src/shades/types';

/**
 * One room. All of it lives in `RoomFlow` so the route stays a route.
 *
 * The optional shade params are how the catalogue hands a colour over: tapping
 * "Try on your room" in the shade sheet lands here with the shade attached, and
 * it goes straight onto the selected surface rather than making the customer
 * find it again in a grid of nine thousand.
 */
export default function RoomRoute() {
  const raw = useLocalSearchParams<{
    id: string;
    code?: string;
    name?: string;
    hex?: string;
    brand?: string;
    brandSlug?: string;
    family?: string;
  }>();

  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const hex = one(raw.hex);
  const code = one(raw.code);
  const incoming: Shade | null =
    hex && code
      ? {
          code,
          name: one(raw.name) ?? code,
          hex,
          brand: one(raw.brand) ?? '',
          family: one(raw.family) ?? '',
          brandSlug: one(raw.brandSlug) || undefined,
        }
      : null;

  return <RoomFlow id={id} incoming={incoming} />;
}
