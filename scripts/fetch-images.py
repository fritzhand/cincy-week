#!/usr/bin/env python3
"""scripts/fetch-images.py · OWNER: Agent F (directory) · STUB landed by Agent A.

Contract (engine spec §4.11): walk people.headshot_url, orgs.logo_url, works.image_url, events.image_url,
programs.logo.url; download politely (<= 2 req/s, cache in .cache/img-src/); write
site/img/p/<id>.webp (256x256, top-biased crop, q74), site/img/p/<id>-f.webp (320x400, featured only),
site/img/o/<id>.webp|.svg (trimmed, fit 320x160, tone), site/img/w/<id>-480.webp and -960.webp (q72),
and data/images.json: { "p/<id>": { file, w, h, bg, src, source_url, tone? } }.
The images committed now are the design system's specimen crops (provisional)."""
import sys
sys.stderr.write("scripts/fetch-images.py has not landed yet (Agent F).\n")
sys.exit(2)
