import { useRouter } from 'expo-router';
import { ShadeLibrary } from '../../src/shades/ShadeLibrary';

/**
 * The catalogue, for an admin.
 *
 * "Try on a wall" starts a real room rather than the sample wall: an admin
 * opening this is usually checking that a company's shades actually render, and
 * the sample room cannot answer that.
 */
export default function AdminShades() {
  const router = useRouter();
  return (
    <ShadeLibrary
      headerTitle="Shades"
      tryLabel="Try on a wall"
      onTryOnWall={() => router.push('/new-project')}
    />
  );
}
