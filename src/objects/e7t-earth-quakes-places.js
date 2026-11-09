// ================================================================ the living planet's quakes as places on Earth (0.26.0): EPL's hooks for e1q-earth-quakes.js
// (QK). They are added here, right after EPL is made in e7s-earth-search.js: a shared link to a quake opens at start-up (applyHash), and its
// place object must be dressed as the quake from the first frame, not as a region.
EPL.spotHooks.push(QK.dress);
EPL.findHooks.push(QK.findQ);
