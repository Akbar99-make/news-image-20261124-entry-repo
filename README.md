# The World in One Day — Tuesday 24 November 2026

A one-page newspaper poster summing up the world's news of Tuesday
24 November 2026. Built for the make.fun bounty `news-image-20261124`.

## What the poster shows

- **36 stories, 14 illustrated features** — every feature has its own
  hand-drawn picture (factory fire, Kyiv skyline, Nvidia chart, COP31
  globe, ships, Lisbon march, Sensex chart, train, Gaza, courthouse,
  trophy, race car, chess board).
- **Top 3 = biggest impact + hard numbers**: Banten factory fire
  (24 dead, ~30 missing), Russian strikes on the Kyiv region,
  Jensen Huang back at Nvidia (+31% in a day, about $1tn added).
- **Stat strip** of 6 numbers, each tied to one story.
- **World map** with numbered pins 1–14 and continent labels.
- **The Day by Hours** timeline, **The Verdict** and
  **Markets & Money** boxes.
- **Certainty labels** on every story — REPORTED / CLAIM / FORECAST —
  with a "How sure are we?" legend, and a **Date Check** footer:
  every story happened or was first reported on 24 November 2026.

## How it works

`main.ts` (Node 22, standard library only) draws the whole poster in
code — a 5x7 bitmap font, raster shapes, a hand-rolled PNG encoder
(zlib deflate + CRC32) — and writes `entry.png` (1024x1024, < 1 MiB).
No network, no dependencies, fully deterministic: two runs produce
byte-identical output.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Sources

AP, Reuters, BBC, The Guardian, The Times of India, NYT, WSJ, Oxfam,
Naval News — all stories as reported on 24 November 2026.
