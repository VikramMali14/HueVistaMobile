import { useRouter } from 'expo-router';
import { ShadeLibrary } from '../../src/shades/ShadeLibrary';

/**
 * The catalogue, for a painter.
 *
 * The same library the customer and the shop use — scoped, like theirs, to the
 * companies this account may work with — because a painter on site is asked
 * "what's this colour?" more often than anyone.
 *
 * "Try on a wall" starts a real room rather than the sample visualizer: a
 * painter reaching for this is standing in the room they mean.
 */
export default function PainterShades() {
  const router = useRouter();
  return (
    <ShadeLibrary
      headerTitle="Shades"
      tryLabel="Try on a wall"
      onTryOnWall={() => router.push('/new-project')}
    />
  );
}
