# Animation libraries

These distribution files are stored locally so VibeLog animations work without a CDN connection. Original copyright/license headers are preserved.

- GSAP 3.15.0: https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js
- ScrollTrigger 3.15.0: https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js
- GSAP source: https://github.com/greensock/GSAP
- GSAP license: https://gsap.com/standard-license
- Lenis 1.3.26: https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js
- Lenis source and MIT license: https://github.com/darkroomengineering/lenis

Only upstream distribution files are vendored; update versions and this notice together.

## Vanta and Three.js

- Vanta NET 0.5.24: https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js
- Vanta source: https://github.com/tengbao/vanta — MIT, see vanta-LICENSE.md.
- Three.js r134: https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js
- Three.js source: https://github.com/mrdoob/three.js — MIT, see three-LICENSE.txt.
- Three.js r134 matches the Vanta README's recommended script-tag integration.

## React Bits adaptations

App-specific adaptations in ../design-effects.js and ../design-effects.css were informed by these components:

- https://github.com/DavidHDev/react-bits/tree/main/src/content/Components/SpotlightCard
- https://github.com/DavidHDev/react-bits/tree/main/src/content/TextAnimations/BlurText
- https://github.com/DavidHDev/react-bits/tree/main/src/content/TextAnimations/CountUp

Copyright (c) 2026 David Haz. License: MIT + Commons Clause, see react-bits-LICENSE.md (retrieved 2026-10-13). These adaptations are integrated into VibeLog, not distributed as a standalone component package. React/Motion dependencies were replaced with app-specific DOM/GSAP code. The licenses and attribution must remain with these adaptations.
