import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';

/**
 * Font map passed to `useFonts` in the root layout. Keys must match the family
 * names referenced in src/theme/typography.ts.
 *
 * Inter is here now because the web sets every line of body copy in it and the
 * phone was falling back to whatever the OS shipped — so the same sentence had
 * a different colour, rhythm and figure width on the two surfaces, and the
 * tabular figures a shade code and a price depend on were not available at all.
 */
export const fontMap = {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
};
