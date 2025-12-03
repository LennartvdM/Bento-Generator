# Bento-Generator

Konva-Based Bento Generator

## Infinite Bento Field demo
Open `index.html` in a browser or serve the repo root (for example, `python -m http.server 8000`) to see the Konva-based Infinite Bento Field concept. The script seeds a card, grows outward by attaching rectangles along exposed edges, prioritizes uncovered viewport regions, and stops once coverage plus a small bleed past the viewport are satisfied.
