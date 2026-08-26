import { useRouter } from 'expo-router';
import { ShadeLibrary } from '../../src/shades/ShadeLibrary';
import { useProjects } from '../../src/projects/queries';

/**
 * The catalogue.
 *
 * "Try on wall" needs a wall. The old version pushed the shade at a Studio tab
 * that had no room open, so the colour arrived somewhere it could not be
 * applied; now it goes to the room the customer was last working on, and starts
 * a new one when there is none.
 */
export default function Shades() {
  const router = useRouter();
  const projects = useProjects().data ?? [];
  const openRoom = projects.find((p) => !p.readOnly);

  return (
    <ShadeLibrary
      tryLabel={openRoom ? 'Try on your room' : 'Try on a room'}
      onTryOnWall={(s) => {
        const params = {
          code: s.shadeCode,
          name: s.name ?? s.shadeCode,
          hex: s.hexCode ?? '',
          brand: s.brandName ?? '',
          brandSlug: s.brandSlug ?? '',
          family: s.shadeFamily ?? '',
        };
        if (openRoom) {
          router.push({ pathname: '/studio/[id]', params: { id: openRoom.id, ...params } });
        } else {
          router.push({ pathname: '/studio/new', params });
        }
      }}
    />
  );
}
