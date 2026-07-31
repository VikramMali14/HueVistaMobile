import { useRouter } from 'expo-router';
import { ShadeLibrary } from '../../src/shades/ShadeLibrary';

/**
 * Customer shade library. The catalogue UI lives in the shared `ShadeLibrary`;
 * here "Try on wall" hands the shade to the Studio via a route param.
 */
export default function Shades() {
  const router = useRouter();
  return (
    <ShadeLibrary
      onTryOnWall={(s) =>
        router.push({
          pathname: '/studio',
          params: {
            code: s.shadeCode,
            name: s.name ?? s.shadeCode,
            hex: s.hexCode ?? '',
            brand: s.brandName ?? '',
            brandSlug: s.brandSlug ?? '',
            family: s.shadeFamily ?? '',
          },
        })
      }
    />
  );
}
