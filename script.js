// Edge-Based Bento Grid with Diagonal Support
// Primary entities are EDGES (horizontal, vertical, and diagonal)
// Cells derive their shape from the edges they reference

const PALETTE = [
  '#22d3ee', '#38bdf8', '#60a5fa', '#3b82f6', '#2563eb',
  '#34d399', '#10b981', '#14b8a6', '#06b6d4', '#0891b2',
  '#0ea5e9', '#0284c7', '#0d9488', '#059669', '#2dd4bf', '#5eead4'
];

// ============================================
// EDGE TYPES - The primary entities
// ============================================

// Horizontal or Vertical edge (single position value)
class Edge {
  constructor(id, position, isHorizontal, isBoundary = false) {
    this.id = id;
    this.isHorizontal = isHorizontal;
    this.isBoundary = isBoundary;

    this.rest = position;
    this.pos = position;
    this.velocity = 0;
    this.force = 0;
  }
}

// Diagonal edge - two endpoints that can move
class DiagonalEdge {
  constructor(id, x1, y1, x2, y2) {
    this.id = id;

    // Rest positions
    this.restX1 = x1; this.restY1 = y1;
    this.restX2 = x2; this.restY2 = y2;

    // Current positions
    this.x1 = x1; this.y1 = y1;
    this.x2 = x2; this.y2 = y2;

    // Physics
    this.velocity = { x1: 0, y1: 0, x2: 0, y2: 0 };
    this.force = { x1: 0, y1: 0, x2: 0, y2: 0 };
  }

  // Which side of the line is a point on?
  getSide(x, y) {
    return (this.x2 - this.x1) * (y - this.y1) - (this.y2 - this.y1) * (x - this.x1);
  }
}

// ============================================
// CELL - Derives shape from edges
// ============================================

class Cell {
  constructor(id, topEdge, bottomEdge, leftEdge, rightEdge) {
    this.id = id;
    this.top = topEdge;
    this.bottom = bottomEdge;
    this.left = leftEdge;
    this.right = rightEdge;
    this.color = PALETTE[id % PALETTE.length];

    // Diagonal clips: { diagonal: DiagonalEdge, keepSide: 'positive' | 'negative' }
    // This cell's rectangle is clipped by these diagonals
    this.diagonalClips = [];

    // Image for cell (loaded on populate)
    this.image = null;
  }

  // Derived properties from edges
  get x() { return this.left.pos; }
  get y() { return this.top.pos; }
  get width() { return this.right.pos - this.left.pos; }
  get height() { return this.bottom.pos - this.top.pos; }

  get restX() { return this.left.rest; }
  get restY() { return this.top.rest; }
  get restWidth() { return this.right.rest - this.left.rest; }
  get restHeight() { return this.bottom.rest - this.top.rest; }

  // Get polygon vertices after applying diagonal clips
  getVertices(gap = 0) {
    const halfGap = gap / 2;
    const l = this.left.pos + halfGap;
    const r = this.right.pos - halfGap;
    const t = this.top.pos + halfGap;
    const b = this.bottom.pos - halfGap;

    // Start with rectangle (clockwise)
    let vertices = [
      { x: l, y: t },
      { x: r, y: t },
      { x: r, y: b },
      { x: l, y: b }
    ];

    // Clip by each diagonal
    for (const clip of this.diagonalClips) {
      vertices = this.clipByDiagonal(vertices, clip.diagonal, clip.keepSide, gap);
    }

    return vertices;
  }

  clipByDiagonal(vertices, diag, keepSide, gap) {
    if (vertices.length < 3) return vertices;

    const halfGap = gap / 2;

    // Offset diagonal for gap
    const dx = diag.x2 - diag.x1;
    const dy = diag.y2 - diag.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return vertices;

    const perpX = -dy / len * halfGap;
    const perpY = dx / len * halfGap;
    // Each cell should be clipped to keep LESS, creating a gap
    // Positive cell: offset toward positive side (cell keeps less)
    // Negative cell: offset toward negative side (cell keeps less)
    const offsetMult = keepSide === 'positive' ? 1 : -1;

    const ox1 = diag.x1 + perpX * offsetMult;
    const oy1 = diag.y1 + perpY * offsetMult;
    const ox2 = diag.x2 + perpX * offsetMult;
    const oy2 = diag.y2 + perpY * offsetMult;

    // Sutherland-Hodgman clipping
    const result = [];
    for (let i = 0; i < vertices.length; i++) {
      const curr = vertices[i];
      const next = vertices[(i + 1) % vertices.length];

      const currSide = (ox2 - ox1) * (curr.y - oy1) - (oy2 - oy1) * (curr.x - ox1);
      const nextSide = (ox2 - ox1) * (next.y - oy1) - (oy2 - oy1) * (next.x - ox1);

      const currInside = keepSide === 'positive' ? currSide >= 0 : currSide <= 0;
      const nextInside = keepSide === 'positive' ? nextSide >= 0 : nextSide <= 0;

      if (currInside) result.push(curr);

      if (currInside !== nextInside) {
        const t = currSide / (currSide - nextSide);
        result.push({
          x: curr.x + t * (next.x - curr.x),
          y: curr.y + t * (next.y - curr.y)
        });
      }
    }

    return result;
  }

  // Point-in-polygon test using ray casting algorithm
  containsPoint(px, py, gap = 0) {
    // First do quick bounding box check
    if (px < this.x || px > this.x + this.width ||
        py < this.y || py > this.y + this.height) {
      return false;
    }

    // If no diagonal clips, bounding box is sufficient
    if (this.diagonalClips.length === 0) {
      return true;
    }

    // Use actual polygon for precise hit testing
    const vertices = this.getVertices(gap);
    if (vertices.length < 3) return false;

    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;

      if (((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
}

// ============================================
// EDGE GRID - Manages all edges and cells
// ============================================

class EdgeGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.edges = new Map();        // id -> Edge
    this.diagonals = new Map();    // id -> DiagonalEdge
    this.cells = [];

    this.edgeIdCounter = 0;
    this.diagonalIdCounter = 0;

    // Boundary edges
    this.topBoundary = this.createEdge(0, true, true);
    this.bottomBoundary = this.createEdge(height, true, true);
    this.leftBoundary = this.createEdge(0, false, true);
    this.rightBoundary = this.createEdge(width, false, true);
  }

  createEdge(position, isHorizontal, isBoundary = false) {
    const id = `e${this.edgeIdCounter++}`;
    const edge = new Edge(id, position, isHorizontal, isBoundary);
    this.edges.set(id, edge);
    return edge;
  }

  createDiagonal(x1, y1, x2, y2) {
    const id = `d${this.diagonalIdCounter++}`;
    const diag = new DiagonalEdge(id, x1, y1, x2, y2);
    this.diagonals.set(id, diag);
    return diag;
  }

  generate(depth = 5, minSize = 60, diagonalCount = 0, maxHoverScale = 1.5) {
    // Reset
    const boundaryIds = new Set([
      this.topBoundary.id, this.bottomBoundary.id,
      this.leftBoundary.id, this.rightBoundary.id
    ]);

    for (const [id] of this.edges) {
      if (!boundaryIds.has(id)) this.edges.delete(id);
    }
    this.diagonals.clear();
    this.cells = [];

    // Subdivide
    this.subdivide(
      this.topBoundary, this.bottomBoundary,
      this.leftBoundary, this.rightBoundary,
      depth, minSize
    );

    // Add diagonals between eligible adjacent cell pairs
    this.addDiagonals(diagonalCount, maxHoverScale);
  }

  subdivide(topEdge, bottomEdge, leftEdge, rightEdge, depth, minSize) {
    const width = rightEdge.rest - leftEdge.rest;
    const height = bottomEdge.rest - topEdge.rest;

    if (depth <= 0 || (width < minSize * 2 && height < minSize * 2)) {
      const cell = new Cell(this.cells.length, topEdge, bottomEdge, leftEdge, rightEdge);
      this.cells.push(cell);
      return;
    }

    const aspectRatio = width / height;
    let splitHorizontal;

    if (width < minSize * 1.5) {
      splitHorizontal = true;
    } else if (height < minSize * 1.5) {
      splitHorizontal = false;
    } else {
      splitHorizontal = Math.random() < (aspectRatio < 1 ? 0.7 : 0.3);
    }

    const splitRatio = 0.3 + Math.random() * 0.4;

    if (splitHorizontal) {
      const splitY = topEdge.rest + height * splitRatio;
      const splitEdge = this.createEdge(splitY, true);

      this.subdivide(topEdge, splitEdge, leftEdge, rightEdge, depth - 1, minSize);
      this.subdivide(splitEdge, bottomEdge, leftEdge, rightEdge, depth - 1, minSize);
    } else {
      const splitX = leftEdge.rest + width * splitRatio;
      const splitEdge = this.createEdge(splitX, false);

      this.subdivide(topEdge, bottomEdge, leftEdge, splitEdge, depth - 1, minSize);
      this.subdivide(topEdge, bottomEdge, splitEdge, rightEdge, depth - 1, minSize);
    }
  }

  // Find pairs of adjacent cells and add diagonal edges between them
  addDiagonals(count, maxHoverScale = 1.5) {
    if (count <= 0) return;

    // Calculate overlap fraction based on max hover scale
    // For scale S, expansion per side = (S-1)/2, plus 10% buffer for safety
    const overlapFraction = (maxHoverScale - 1) / 2 + 0.1;

    // Find all pairs of cells that share an edge and are aligned
    const pairs = [];

    for (let i = 0; i < this.cells.length; i++) {
      for (let j = i + 1; j < this.cells.length; j++) {
        const a = this.cells[i];
        const b = this.cells[j];

        // Check for horizontal neighbors (share vertical edge)
        if (a.right === b.left &&
            Math.abs(a.top.rest - b.top.rest) < 1 &&
            Math.abs(a.bottom.rest - b.bottom.rest) < 1) {
          pairs.push({ type: 'horizontal', left: a, right: b });
        } else if (b.right === a.left &&
                   Math.abs(a.top.rest - b.top.rest) < 1 &&
                   Math.abs(a.bottom.rest - b.bottom.rest) < 1) {
          pairs.push({ type: 'horizontal', left: b, right: a });
        }

        // Check for vertical neighbors (share horizontal edge)
        if (a.bottom === b.top &&
            Math.abs(a.left.rest - b.left.rest) < 1 &&
            Math.abs(a.right.rest - b.right.rest) < 1) {
          pairs.push({ type: 'vertical', top: a, bottom: b });
        } else if (b.bottom === a.top &&
                   Math.abs(a.left.rest - b.left.rest) < 1 &&
                   Math.abs(a.right.rest - b.right.rest) < 1) {
          pairs.push({ type: 'vertical', top: b, bottom: a });
        }
      }
    }

    // Shuffle and pick
    const shuffled = pairs.sort(() => Math.random() - 0.5);
    const cellsWithDiagonals = new Set();
    let added = 0;

    for (const pair of shuffled) {
      if (added >= count) break;

      if (pair.type === 'horizontal') {
        const { left, right } = pair;
        if (cellsWithDiagonals.has(left) || cellsWithDiagonals.has(right)) continue;

        // Shared vertical edge position
        const sharedX = left.right.rest;
        const topY = left.top.rest;
        const bottomY = left.bottom.rest;
        const height = bottomY - topY;
        const leftWidth = left.right.rest - left.left.rest;
        const rightWidth = right.right.rest - right.left.rest;

        // Skip cells that are too small or too thin (would create "duds")
        // Increase minDim based on overlap to ensure visible pentagons
        const minDim = 120;
        const maxAspect = 2.5;
        if (leftWidth < minDim || rightWidth < minDim || height < minDim) continue;
        if (leftWidth / height > maxAspect || height / leftWidth > maxAspect) continue;
        if (rightWidth / height > maxAspect || height / rightWidth > maxAspect) continue;

        // Overlap based on max hover scale to guarantee coverage during expansion
        const maxOverlap = Math.min(leftWidth * overlapFraction, rightWidth * overlapFraction, height * overlapFraction);
        const halfH = maxOverlap;

        const diagonalDown = Math.random() < 0.5;

        // Diagonal spans FULL height (no inset) to avoid clipping artifacts
        let diag;
        if (diagonalDown) {
          diag = this.createDiagonal(sharedX - halfH, topY, sharedX + halfH, bottomY);
        } else {
          diag = this.createDiagonal(sharedX + halfH, topY, sharedX - halfH, bottomY);
        }

        // Extend both cells' bounds into the overlap region
        // Left cell extends right, right cell extends left
        left.right = this.createEdge(sharedX + halfH, false);
        right.left = this.createEdge(sharedX - halfH, false);

        // Both cells clip by the diagonal
        left.diagonalClips.push({ diagonal: diag, keepSide: 'positive' });
        right.diagonalClips.push({ diagonal: diag, keepSide: 'negative' });

        cellsWithDiagonals.add(left);
        cellsWithDiagonals.add(right);
        added++;

      } else if (pair.type === 'vertical') {
        const { top, bottom } = pair;
        if (cellsWithDiagonals.has(top) || cellsWithDiagonals.has(bottom)) continue;

        // Shared horizontal edge position
        const sharedY = top.bottom.rest;
        const leftX = top.left.rest;
        const rightX = top.right.rest;
        const width = rightX - leftX;
        const topHeight = top.bottom.rest - top.top.rest;
        const bottomHeight = bottom.bottom.rest - bottom.top.rest;

        // Skip cells that are too small or too thin (would create "duds")
        // Increase minDim based on overlap to ensure visible pentagons
        const minDim = 120;
        const maxAspect = 2.5;
        if (topHeight < minDim || bottomHeight < minDim || width < minDim) continue;
        if (width / topHeight > maxAspect || topHeight / width > maxAspect) continue;
        if (width / bottomHeight > maxAspect || bottomHeight / width > maxAspect) continue;

        // Overlap based on max hover scale to guarantee coverage during expansion
        const maxOverlap = Math.min(topHeight * overlapFraction, bottomHeight * overlapFraction, width * overlapFraction);
        const halfW = maxOverlap;

        const diagonalRight = Math.random() < 0.5;

        // Diagonal spans FULL width (no inset) to avoid clipping artifacts
        let diag;
        if (diagonalRight) {
          diag = this.createDiagonal(leftX, sharedY - halfW, rightX, sharedY + halfW);
        } else {
          diag = this.createDiagonal(rightX, sharedY - halfW, leftX, sharedY + halfW);
        }

        // Extend bounds into overlap
        top.bottom = this.createEdge(sharedY + halfW, true);
        bottom.top = this.createEdge(sharedY - halfW, true);

        top.diagonalClips.push({ diagonal: diag, keepSide: 'positive' });
        bottom.diagonalClips.push({ diagonal: diag, keepSide: 'negative' });

        cellsWithDiagonals.add(top);
        cellsWithDiagonals.add(bottom);
        added++;
      }
    }
  }
}

// ============================================
// PHYSICS ENGINE
// ============================================

class PhysicsEngine {
  constructor(grid) {
    this.grid = grid;
    this.hoveredCell = null;
    this.hoverScale = 1;
    this.hoveredEdges = new Set();

    // Parameters
    this.springStrength = 0.12;
    this.damping = 0.88;
    this.incompressibility = 0.7;
    this.minSizeRatio = 0.5;
    this.bleedZone = 50;

    this.scaleSpeed = 0.25;
    this.rippleSpeed = 0.10;
    this.overshoot = 0.15;
    this.fillRatio = 0;
  }

  applyHoverForce(cell, scale) {
    if (!cell) return;
    this.hoveredCell = cell;
    this.hoverScale = scale;

    this.hoveredEdges.clear();
    this.hoveredEdges.add(cell.top);
    this.hoveredEdges.add(cell.bottom);
    this.hoveredEdges.add(cell.left);
    this.hoveredEdges.add(cell.right);

    const cx = cell.restX + cell.restWidth / 2;
    const cy = cell.restY + cell.restHeight / 2;

    // Fill ratio adjustment
    const aspect = cell.restWidth / cell.restHeight;
    let scaleX = scale, scaleY = scale;

    if (this.fillRatio > 0) {
      if (aspect > 1) {
        scaleY = 1 + (scale - 1) * (1 + (aspect - 1) * this.fillRatio);
      } else if (aspect < 1) {
        scaleX = 1 + (scale - 1) * (1 + (1/aspect - 1) * this.fillRatio);
      }
    }

    const targetHalfW = (cell.restWidth * scaleX) / 2;
    const targetHalfH = (cell.restHeight * scaleY) / 2;

    // Move edges directly (authoritative)
    if (!cell.top.isBoundary) {
      cell.top.pos += (cy - targetHalfH - cell.top.pos) * this.scaleSpeed;
      cell.top.velocity = 0;
    }
    if (!cell.bottom.isBoundary) {
      cell.bottom.pos += (cy + targetHalfH - cell.bottom.pos) * this.scaleSpeed;
      cell.bottom.velocity = 0;
    }
    if (!cell.left.isBoundary) {
      cell.left.pos += (cx - targetHalfW - cell.left.pos) * this.scaleSpeed;
      cell.left.velocity = 0;
    }
    if (!cell.right.isBoundary) {
      cell.right.pos += (cx + targetHalfW - cell.right.pos) * this.scaleSpeed;
      cell.right.velocity = 0;
    }

    // Also scale diagonal edges connected to this cell
    for (const clip of cell.diagonalClips) {
      const diag = clip.diagonal;
      const diagCx = (diag.restX1 + diag.restX2) / 2;
      const diagCy = (diag.restY1 + diag.restY2) / 2;

      // Scale diagonal endpoints around cell center
      const scale2 = (scaleX + scaleY) / 2;
      diag.x1 += (cx + (diag.restX1 - cx) * scale2 - diag.x1) * this.scaleSpeed;
      diag.y1 += (cy + (diag.restY1 - cy) * scale2 - diag.y1) * this.scaleSpeed;
      diag.x2 += (cx + (diag.restX2 - cx) * scale2 - diag.x2) * this.scaleSpeed;
      diag.y2 += (cy + (diag.restY2 - cy) * scale2 - diag.y2) * this.scaleSpeed;
    }
  }

  applyIncompressibility() {
    if (!this.hoveredCell) return;

    const hoverCx = this.hoveredCell.restX + this.hoveredCell.restWidth / 2;
    const hoverCy = this.hoveredCell.restY + this.hoveredCell.restHeight / 2;

    for (const cell of this.grid.cells) {
      if (cell === this.hoveredCell) continue;

      const widthRatio = cell.width / cell.restWidth;
      const heightRatio = cell.height / cell.restHeight;

      const cellCx = cell.restX + cell.restWidth / 2;
      const cellCy = cell.restY + cell.restHeight / 2;
      const dirX = cellCx - hoverCx;
      const dirY = cellCy - hoverCy;

      if (widthRatio < this.minSizeRatio) {
        const deficit = cell.restWidth * this.minSizeRatio - cell.width;
        const force = deficit * this.incompressibility * 1.5;

        if (!this.hoveredEdges.has(cell.left) && dirX <= 0) cell.left.force -= force;
        if (!this.hoveredEdges.has(cell.right) && dirX >= 0) cell.right.force += force;
      }

      if (heightRatio < this.minSizeRatio) {
        const deficit = cell.restHeight * this.minSizeRatio - cell.height;
        const force = deficit * this.incompressibility * 1.5;

        if (!this.hoveredEdges.has(cell.top) && dirY <= 0) cell.top.force -= force;
        if (!this.hoveredEdges.has(cell.bottom) && dirY >= 0) cell.bottom.force += force;
      }
    }
  }

  integrateForces() {
    const effectiveDamping = this.damping - this.overshoot * 0.3;

    // Regular edges
    for (const [, edge] of this.grid.edges) {
      if (this.hoveredEdges.has(edge)) {
        edge.force = 0;
        continue;
      }

      const springMult = edge.isBoundary ? 3 : 1;
      const springForce = (edge.rest - edge.pos) * this.springStrength * springMult;

      edge.velocity += (edge.force + springForce) * this.rippleSpeed;
      edge.velocity *= effectiveDamping;
      edge.pos += edge.velocity;

      if (edge.isBoundary) {
        const bleed = this.bleedZone;
        if (edge === this.grid.topBoundary || edge === this.grid.leftBoundary) {
          edge.pos = Math.max(edge.rest - bleed, Math.min(edge.rest, edge.pos));
        } else {
          edge.pos = Math.min(edge.rest + bleed, Math.max(edge.rest, edge.pos));
        }
      }

      edge.force = 0;
    }

    // Diagonal edges - spring back to rest
    for (const [, diag] of this.grid.diagonals) {
      diag.velocity.x1 += (diag.restX1 - diag.x1) * this.springStrength * this.rippleSpeed;
      diag.velocity.y1 += (diag.restY1 - diag.y1) * this.springStrength * this.rippleSpeed;
      diag.velocity.x2 += (diag.restX2 - diag.x2) * this.springStrength * this.rippleSpeed;
      diag.velocity.y2 += (diag.restY2 - diag.y2) * this.springStrength * this.rippleSpeed;

      diag.velocity.x1 *= effectiveDamping;
      diag.velocity.y1 *= effectiveDamping;
      diag.velocity.x2 *= effectiveDamping;
      diag.velocity.y2 *= effectiveDamping;

      diag.x1 += diag.velocity.x1;
      diag.y1 += diag.velocity.y1;
      diag.x2 += diag.velocity.x2;
      diag.y2 += diag.velocity.y2;
    }
  }

  update() {
    this.applyIncompressibility();
    this.integrateForces();
  }

  clearHover() {
    this.hoveredCell = null;
    this.hoverScale = 1;
    this.hoveredEdges.clear();
  }

  reset() {
    this.clearHover();
    for (const [, edge] of this.grid.edges) {
      edge.pos = edge.rest;
      edge.velocity = 0;
      edge.force = 0;
    }
    for (const [, diag] of this.grid.diagonals) {
      diag.x1 = diag.restX1;
      diag.y1 = diag.restY1;
      diag.x2 = diag.restX2;
      diag.y2 = diag.restY2;
      diag.velocity = { x1: 0, y1: 0, x2: 0, y2: 0 };
    }
  }
}

// ============================================
// MAIN APPLICATION
// ============================================

class BentoGrid {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.gap = 8;
    this.hoverScale = 1.4;
    this.subdivisionDepth = 5;
    this.minCellSize = 80;
    this.diagonalCount = 0;

    this.grid = null;
    this.physics = null;
    this.hoveredCell = null;
    this.canvasOffsetX = 0;
    this.canvasOffsetY = 0;

    this.updateDimensions();
    this.setupEventListeners();
    this.regenerate();
    this.startAnimation();
  }

  updateDimensions() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    const padding = 200;
    this.canvas.width = this.width + padding * 2;
    this.canvas.height = this.height + padding * 2;
    this.canvasOffsetX = padding;
    this.canvasOffsetY = padding;

    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `-${padding}px`;
    this.canvas.style.top = `-${padding}px`;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.updateDimensions();
      this.regenerate();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - this.canvasOffsetX;
      const my = e.clientY - rect.top - this.canvasOffsetY;

      this.hoveredCell = null;
      for (const cell of this.grid.cells) {
        // Use gap for accurate polygon hit testing on diagonal cells
        if (cell.containsPoint(mx, my, this.gap)) {
          this.hoveredCell = cell;
          break;
        }
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredCell = null;
    });
  }

  regenerate() {
    this.grid = new EdgeGrid(this.width, this.height);
    this.grid.generate(this.subdivisionDepth, this.minCellSize, this.diagonalCount, this.hoverScale);
    this.physics = new PhysicsEngine(this.grid);
    this.physics.reset();
  }

  startAnimation() {
    const tick = () => {
      if (this.hoveredCell) {
        this.physics.applyHoverForce(this.hoveredCell, this.hoverScale);
      } else {
        this.physics.clearHover();
      }
      this.physics.update();
      this.render();
      requestAnimationFrame(tick);
    };
    tick();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.canvasOffsetX, this.canvasOffsetY);

    const radius = 6;

    for (const cell of this.grid.cells) {
      const vertices = cell.getVertices(this.gap);
      if (vertices.length < 3) continue;

      const minX = Math.min(...vertices.map(v => v.x));
      const minY = Math.min(...vertices.map(v => v.y));
      const maxX = Math.max(...vertices.map(v => v.x));
      const maxY = Math.max(...vertices.map(v => v.y));

      if (maxX - minX <= 0 || maxY - minY <= 0) continue;

      const isHovered = cell === this.hoveredCell;
      const isOutside = minX < 0 || minY < 0 || maxX > this.width || maxY > this.height;

      ctx.globalAlpha = isOutside ? 0.5 : 1;

      // Build rounded polygon path
      ctx.beginPath();
      const n = vertices.length;
      for (let i = 0; i < n; i++) {
        const curr = vertices[i];
        const next = vertices[(i + 1) % n];
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.001) continue;

        const r = Math.min(radius, len / 3);

        if (i === 0) {
          ctx.moveTo(curr.x + (dx / len) * r, curr.y + (dy / len) * r);
        }

        ctx.lineTo(next.x - (dx / len) * r, next.y - (dy / len) * r);

        const afterNext = vertices[(i + 2) % n];
        const dx2 = afterNext.x - next.x;
        const dy2 = afterNext.y - next.y;
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (len2 > 0.001) {
          const r2 = Math.min(radius, len2 / 3);
          ctx.quadraticCurveTo(next.x, next.y, next.x + (dx2 / len2) * r2, next.y + (dy2 / len2) * r2);
        }
      }
      ctx.closePath();

      // Draw image or color
      if (cell.image && cell.image.complete && cell.image.naturalWidth > 0) {
        ctx.save();
        ctx.clip();

        // Image zoom: zoomed in by default, zooms out on hover
        // Calculate based on maximum cell size (when fully expanded)
        const maxCellW = cell.restWidth * this.hoverScale;
        const maxCellH = cell.restHeight * this.hoverScale;

        const defaultZoom = 1.3; // Extra zoom in for bleed
        const hoverZoom = 1.0;   // Fits expanded cell perfectly
        const zoom = isHovered ? hoverZoom : defaultZoom;

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Size image based on max expanded size × zoom
        const imgAspect = cell.image.naturalWidth / cell.image.naturalHeight;
        const cellAspect = maxCellW / maxCellH;

        let drawW, drawH;
        if (imgAspect > cellAspect) {
          // Image is wider - fit to height
          drawH = maxCellH * zoom;
          drawW = drawH * imgAspect;
        } else {
          // Image is taller - fit to width
          drawW = maxCellW * zoom;
          drawH = drawW / imgAspect;
        }

        const drawX = centerX - drawW / 2;
        const drawY = centerY - drawH / 2;

        ctx.drawImage(cell.image, drawX, drawY, drawW, drawH);
        ctx.restore();
      } else {
        ctx.fillStyle = isHovered ? '#ef4444' : cell.color;
        ctx.fill();
      }

      // Stroke
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Public API
  getShapeCount() { return this.grid ? this.grid.cells.length : 0; }
  getDiagonalCount() { return this.grid ? this.grid.diagonals.size : 0; }

  setGap(v) { this.gap = v; }
  setHoverScale(v) { this.hoverScale = v; }
  setSubdivisionDepth(v) { this.subdivisionDepth = v; this.regenerate(); }
  setDiagonalCount(v) { this.diagonalCount = v; }
  setIncompressibility(v) { if (this.physics) this.physics.incompressibility = v; }
  setMinSizeRatio(v) { if (this.physics) this.physics.minSizeRatio = v; }
  setBleedZone(v) { if (this.physics) this.physics.bleedZone = v; }
  setScaleSpeed(v) { if (this.physics) this.physics.scaleSpeed = v; }
  setRippleSpeed(v) { if (this.physics) this.physics.rippleSpeed = v; }
  setOvershoot(v) { if (this.physics) this.physics.overshoot = v; }
  setFillRatio(v) { if (this.physics) this.physics.fillRatio = v; }

  // Populate cells with random Unsplash images
  populateImages() {
    if (!this.grid) return;

    for (const cell of this.grid.cells) {
      // Use rest dimensions for image sizing (add extra for zoom buffer)
      const w = Math.ceil(cell.restWidth * 1.3);
      const h = Math.ceil(cell.restHeight * 1.3);
      const seed = Math.random().toString(36).substring(7);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `https://picsum.photos/seed/${seed}/${w}/${h}`;
      cell.image = img;
    }
  }
}

// ============================================
// INITIALIZATION
// ============================================

function updateMetrics() {
  if (!bentoGrid) return;
  const el = document.getElementById('metrics');
  if (el) {
    el.innerHTML = `
      <div><span style="opacity:0.5">Cells:</span> ${bentoGrid.getShapeCount()}</div>
      <div><span style="opacity:0.5">Diagonals:</span> ${bentoGrid.getDiagonalCount()}</div>
    `;
  }
}

let bentoGrid;

function init() {
  bentoGrid = new BentoGrid('container');

  const controls = {
    subdivisions: { el: 'subdivisions', handler: v => { bentoGrid.setSubdivisionDepth(+v); updateMetrics(); }, format: v => v },
    gap: { el: 'gap', handler: v => bentoGrid.setGap(+v), format: v => v },
    hoverScale: { el: 'hoverScale', handler: v => bentoGrid.setHoverScale(+v), format: v => (+v).toFixed(1) + 'x' },
    incompress: { el: 'incompress', handler: v => bentoGrid.setIncompressibility(+v), format: v => (+v).toFixed(2) },
    minSize: { el: 'minSize', handler: v => bentoGrid.setMinSizeRatio(+v), format: v => Math.round(+v * 100) + '%' },
    bleed: { el: 'bleed', handler: v => bentoGrid.setBleedZone(+v), format: v => v + 'px' },
    scaleSpeed: { el: 'scaleSpeed', handler: v => bentoGrid.setScaleSpeed(+v), format: v => (+v).toFixed(2) },
    ripple: { el: 'ripple', handler: v => bentoGrid.setRippleSpeed(+v), format: v => (+v).toFixed(2) },
    overshoot: { el: 'overshoot', handler: v => bentoGrid.setOvershoot(+v), format: v => (+v).toFixed(2) },
    fillRatio: { el: 'fillRatio', handler: v => bentoGrid.setFillRatio(+v), format: v => (+v).toFixed(1) },
    diagonals: { el: 'diagonals', handler: v => { bentoGrid.setDiagonalCount(+v); bentoGrid.regenerate(); updateMetrics(); }, format: v => v }
  };

  for (const [name, ctrl] of Object.entries(controls)) {
    const el = document.getElementById(ctrl.el);
    const display = document.getElementById(ctrl.el + 'Value');
    if (el) {
      el.addEventListener('input', e => {
        ctrl.handler(e.target.value);
        if (display) display.textContent = ctrl.format(e.target.value);
      });
    }
  }

  document.getElementById('regen').addEventListener('click', () => {
    bentoGrid.regenerate();
    updateMetrics();
  });

  document.getElementById('populate').addEventListener('click', () => {
    bentoGrid.populateImages();
  });

  updateMetrics();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
