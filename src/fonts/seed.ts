// 内置示例配对：从第一版起就带好备用链，不再靠页面写死 Georgia/Arial。

import { defaultFallbackChain } from './catalog';
import { DEFAULT_TUNING, type Pair } from './model';

export const SEED_PAIRS: Pair[] = [
  {
    id: 1,
    title: 'Editorial calm',
    heading: 'A slower way to see',
    body: 'Good typography creates space for ideas to breathe. Pair a confident display face with a quiet, generous text face.',
    category: 'Editorial',
    favorite: true,
    headingFont: { family: 'Fraunces', fallback: defaultFallbackChain('Fraunces', 'heading') },
    bodyFont: { family: 'DM Sans', fallback: defaultFallbackChain('DM Sans', 'body') },
    tuning: { ...DEFAULT_TUNING },
  },
  {
    id: 2,
    title: 'Studio notes',
    heading: 'Make room for the unexpected',
    body: 'A thoughtful pairing can add rhythm to even the simplest interface. Try contrast in shape, not just size.',
    category: 'Portfolio',
    favorite: false,
    headingFont: {
      family: 'Playfair Display',
      fallback: defaultFallbackChain('Playfair Display', 'heading'),
    },
    bodyFont: { family: 'IBM Plex Sans', fallback: defaultFallbackChain('IBM Plex Sans', 'body') },
    tuning: { ...DEFAULT_TUNING },
  },
  {
    id: 3,
    title: 'Field guide',
    heading: 'Small details, lasting impressions',
    body: 'Typography is the voice of a page. Find a combination that feels clear, warm and distinctly yours.',
    category: 'Brand',
    favorite: false,
    headingFont: { family: 'Newsreader', fallback: defaultFallbackChain('Newsreader', 'heading') },
    bodyFont: { family: 'Space Grotesk', fallback: defaultFallbackChain('Space Grotesk', 'body') },
    tuning: { ...DEFAULT_TUNING },
  },
];
