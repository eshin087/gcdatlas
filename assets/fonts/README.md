# Fonts

The two fonts of gcdatlas, served from our own domain under `/fonts/` since 0.27.3 (`tools/lib/fonts.mjs`, `build.mjs`). They are the
latin sets that Google Fonts served for the page until then, downloaded from fonts.gstatic.com on 2026-11-10 and not changed.

| File | Font | Copyright |
| --- | --- | --- |
| `ibm-plex-mono-400-v20.woff2`, `-500-`, `-600-` | IBM Plex Mono 2.3 (version 20 on Google Fonts) | Copyright 2017 IBM Corp. All rights reserved, with Reserved Font Name "Plex" |
| `major-mono-display-400-v18.woff2` | Major Mono Display 2.000 (version 18 on Google Fonts) | Copyright 2018 The Major Mono Project Authors (https://github.com/googlefonts/majormono) |

Both are licensed under the SIL Open Font License, Version 1.1, which allows them to be bundled and redistributed with software.
Its text is in `OFL.txt` beside this file (from https://openfontlicense.org); each font file also carries its copyright line and the
licence's address in its own name table.

A new version of a font gets a new file name (the `v20`, `v18`), because `/fonts/` is cached for a year.
