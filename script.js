// Edge-Based Bento Grid
// Cells are defined by edges, not dimensions
// When edges move, cells automatically reshape

const PALETTE = [
  '#22d3ee', '#38bdf8', '#60a5fa', '#3b82f6', '#2563eb',
  '#34d399', '#10b981', '#14b8a6', '#06b6d4', '#0891b2',
  '#0ea5e9', '#0284c7', '#0d9488', '#059669', '#2dd4bf', '#5eead4'
];

// ============================================
// EDGE-BASED DATA MODEL
// ============================================

class Edge {
  constructor(id, position, isHorizontal, isBoundary = false) {
    this.id = id;
    this.isHorizontal = isHorizontal;
    this.isBoundary = isBoundary;

    // Physics state
    this.rest = position;
    this.pos = position;
    this.velocity = 0;
    this.force = 0;

    // Connections to other edges
    this.connectedEdges = new Set();
  }
}

class Cell {
  constructor(id, topEdge, bottomEdge, leftEdge, rightEdge) {
    this.id = id;
    this.top = topEdge;
    this.bottom = bottomEdge;
    this.left = leftEdge;
    this.right = rightEdge;
    this.color = PALETTE[id % PALETTE.length];

    // Corner cuts: { tl, tr, bl, br } - each is a cut size ratio (0-0.5)
    this.cuts = { tl: 0, tr: 0, bl: 0, br: 0 };
  }

  get x() { return this.left.pos; }
  get y() { return this.top.pos; }
  get width() { return this.right.pos - this.left.pos; }
  get height() { return this.bottom.pos - this.top.pos; }

  get restX() { return this.left.rest; }
  get restY() { return this.top.rest; }
  get restWidth() { return this.right.rest - this.left.rest; }
  get restHeight() { return this.bottom.rest - this.top.rest; }

  // Get polygon vertices (clockwise from top-left)
  getVertices(gap = 0) {
    const halfGap = gap / 2;
    const l = this.left.pos + halfGap;
    const r = this.right.pos - halfGap;
    const t = this.top.pos + halfGap;
    const b = this.bottom.pos - halfGap;
    const w = r - l;
    const h = b - t;

    const vertices = [];

    // Top-left corner
    if (this.cuts.tl > 0) {
      const cut = Math.min(this.cuts.tl * Math.min(w, h), w * 0.4, h * 0.4);
      vertices.push({ x: l + cut, y: t });
    } else {
      vertices.push({ x: l, y: t });
    }

    // Top-right corner
    if (this.cuts.tr > 0) {
      const cut = Math.min(this.cuts.tr * Math.min(w, h), w * 0.4, h * 0.4);
      vertices.push({ x: r - cut, y: t });
      vertices.push({ x: r, y: t + cut });
    } else {
      vertices.push({ x: r, y: t });
    }

    // Bottom-right corner
    if (this.cuts.br > 0) {
      const cut = Math.min(this.cuts.br * Math.min(w, h), w * 0.4, h * 0.4);
      vertices.push({ x: r, y: b - cut });
      vertices.push({ x: r - cut, y: b });
    } else {
      vertices.push({ x: r, y: b });
    }

    // Bottom-left corner
    if (this.cuts.bl > 0) {
      const cut = Math.min(this.cuts.bl * Math.min(w, h), w * 0.4, h * 0.4);
      vertices.push({ x: l + cut, y: b });
      vertices.push({ x: l, y: b - cut });
    } else {
      vertices.push({ x: l, y: b });
    }

    // Complete top-left if cut
    if (this.cuts.tl > 0) {
      const cut = Math.min(this.cuts.tl * Math.min(w, h), w * 0.4, h * 0.4);
      vertices.push({ x: l, y: t + cut });
    }

    return vertices;
  }

  containsPoint(px, py) {
    // Simple bounding box check (could be improved for cut corners)
    return px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }
}

// ============================================
// TREEMAP SUBDIVISION
// ============================================

class EdgeGrid {
  constructor(width, height, gap) {
    this.width = width;
    this.height = height;
    this.gap = gap;

    this.edges = new Map();
    this.cells = [];
    this.edgeIdCounter = 0;

    // Create boundary edges (soft - can flex outward)
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

  subdivide(topEdge, bottomEdge, leftEdge, rightEdge, depth, minSize) {
    const width = rightEdge.rest - leftEdge.rest;
    const height = bottomEdge.rest - topEdge.rest;

    if (depth <= 0 || (width < minSize * 2 && height < minSize * 2)) {
      const cell = new Cell(
        this.cells.length,
        topEdge, bottomEdge, leftEdge, rightEdge
      );
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
      const horizontalBias = aspectRatio < 1 ? 0.7 : 0.3;
      splitHorizontal = Math.random() < horizontalBias;
    }

    const splitRatio = 0.3 + Math.random() * 0.4;

    if (splitHorizontal) {
      const splitY = topEdge.rest + (bottomEdge.rest - topEdge.rest) * splitRatio;
      const splitEdge = this.createEdge(splitY, true, false);

      splitEdge.connectedEdges.add(leftEdge.id);
      splitEdge.connectedEdges.add(rightEdge.id);
      leftEdge.connectedEdges.add(splitEdge.id);
      rightEdge.connectedEdges.add(splitEdge.id);

      this.subdivide(topEdge, splitEdge, leftEdge, rightEdge, depth - 1, minSize);
      this.subdivide(splitEdge, bottomEdge, leftEdge, rightEdge, depth - 1, minSize);
    } else {
      const splitX = leftEdge.rest + (rightEdge.rest - leftEdge.rest) * splitRatio;
      const splitEdge = this.createEdge(splitX, false, false);

      splitEdge.connectedEdges.add(topEdge.id);
      splitEdge.connectedEdges.add(bottomEdge.id);
      topEdge.connectedEdges.add(splitEdge.id);
      bottomEdge.connectedEdges.add(splitEdge.id);

      this.subdivide(topEdge, bottomEdge, leftEdge, splitEdge, depth - 1, minSize);
      this.subdivide(topEdge, bottomEdge, splitEdge, rightEdge, depth - 1, minSize);
    }
  }

  generate(subdivisionDepth = 5, minCellSize = 60) {
    this.cells = [];

    const boundaryIds = new Set([
      this.topBoundary.id, this.bottomBoundary.id,
      this.leftBoundary.id, this.rightBoundary.id
    ]);

    for (const [id] of this.edges) {
      if (!boundaryIds.has(id)) {
        this.edges.delete(id);
      }
    }

    this.topBoundary.connectedEdges.clear();
    this.bottomBoundary.connectedEdges.clear();
    this.leftBoundary.connectedEdges.clear();
    this.rightBoundary.connectedEdges.clear();

    this.subdivide(
      this.topBoundary, this.bottomBoundary,
      this.leftBoundary, this.rightBoundary,
      subdivisionDepth, minCellSize
    );
  }

  // Add diagonal cuts at internal corners
  addDiagonals(count) {
    if (count <= 0) return;

    // Reset all cuts
    for (const cell of this.cells) {
      cell.cuts = { tl: 0, tr: 0, bl: 0, br: 0 };
    }

    // Find all internal corners (where cells meet)
    // A corner is defined by its x,y position
    const corners = new Map(); // "x,y" -> { cells: [...], isInternal: bool }

    for (const cell of this.cells) {
      const tl = `${cell.left.rest},${cell.top.rest}`;
      const tr = `${cell.right.rest},${cell.top.rest}`;
      const bl = `${cell.left.rest},${cell.bottom.rest}`;
      const br = `${cell.right.rest},${cell.bottom.rest}`;

      // Add cell to each corner
      for (const [key, corner] of [[tl, 'tl'], [tr, 'tr'], [bl, 'bl'], [br, 'br']]) {
        if (!corners.has(key)) {
          corners.set(key, { cells: [], cornerTypes: [] });
        }
        corners.get(key).cells.push(cell);
        corners.get(key).cornerTypes.push(corner);
      }
    }

    // Filter to internal corners (not on boundary, shared by 2+ cells)
    const internalCorners = [];
    for (const [key, data] of corners) {
      const [x, y] = key.split(',').map(Number);
      const onBoundary = x === 0 || y === 0 ||
                         x === this.width || y === this.height;

      // Must have at least 2 cells sharing this corner to be interesting
      if (!onBoundary && data.cells.length >= 2) {
        internalCorners.push({ x, y, ...data });
      }
    }

    // Randomly select corners to cut
    const shuffled = internalCorners.sort(() => Math.random() - 0.5);
    const toCut = shuffled.slice(0, Math.min(count, shuffled.length));

    // Apply cuts to all cells sharing each corner
    const cutSize = 0.35; // 35% of min dimension
    for (const corner of toCut) {
      for (let i = 0; i < corner.cells.length; i++) {
        const cell = corner.cells[i];
        const type = corner.cornerTypes[i];
        cell.cuts[type] = cutSize;
      }
    }
  }
}

// ============================================
// SPRING PHYSICS ENGINE WITH INCOMPRESSIBILITY
// ============================================

class PhysicsEngine {
  constructor(edgeGrid) {
    this.grid = edgeGrid;
    this.hoveredCell = null;
    this.hoverScale = 1;

    // Track which edges belong to hovered cell (they have priority)
    this.hoveredEdges = new Set();

    // Physics parameters (exposed to UI)
    this.springStrength = 0.12;
    this.incompressibility = 0.7;
    this.minSizeRatio = 0.5;
    this.bleedZone = 50;
    this.boundaryResistance = 0.8;

    // Animation parameters (exposed to UI)
    this.scaleSpeed = 0.25;      // How fast hovered cell expands
    this.rippleSpeed = 0.10;     // How fast neighbors respond to forces
    this.overshoot = 0.15;       // Bounciness (0 = critically damped, 0.5 = very bouncy)
    this.fillRatio = 0;          // Counter aspect ratio: flat shapes grow tall, tall shapes grow wide

    this.rippleIterations = 3;
  }

  // Damping derived from overshoot (more overshoot = less damping)
  get damping() {
    return 0.92 - this.overshoot * 0.3;
  }

  applyHoverForce(cell, scale) {
    if (!cell) return;
    this.hoveredCell = cell;
    this.hoverScale = scale;

    // Mark hovered cell's edges
    this.hoveredEdges.clear();
    this.hoveredEdges.add(cell.top);
    this.hoveredEdges.add(cell.bottom);
    this.hoveredEdges.add(cell.left);
    this.hoveredEdges.add(cell.right);

    // Calculate target positions for hovered cell's edges
    const cx = cell.restX + cell.restWidth / 2;
    const cy = cell.restY + cell.restHeight / 2;

    // Apply fill ratio: counteract aspect ratio
    // Flat shapes (aspect > 1) grow more vertically
    // Tall shapes (aspect < 1) grow more horizontally
    const aspect = cell.restWidth / cell.restHeight;
    let scaleX = scale;
    let scaleY = scale;

    if (this.fillRatio > 0) {
      if (aspect > 1) {
        // Wide/flat shape - boost vertical scaling
        const boost = 1 + (aspect - 1) * this.fillRatio;
        scaleY = 1 + (scale - 1) * boost;
      } else if (aspect < 1) {
        // Tall shape - boost horizontal scaling
        const boost = 1 + (1 / aspect - 1) * this.fillRatio;
        scaleX = 1 + (scale - 1) * boost;
      }
    }

    const targetHalfW = (cell.restWidth * scaleX) / 2;
    const targetHalfH = (cell.restHeight * scaleY) / 2;

    // Move hovered edges DIRECTLY toward targets (authoritative, no fighting)
    if (!cell.top.isBoundary) {
      const targetY = cy - targetHalfH;
      cell.top.pos += (targetY - cell.top.pos) * this.scaleSpeed;
      cell.top.velocity = 0;
    }
    if (!cell.bottom.isBoundary) {
      const targetY = cy + targetHalfH;
      cell.bottom.pos += (targetY - cell.bottom.pos) * this.scaleSpeed;
      cell.bottom.velocity = 0;
    }
    if (!cell.left.isBoundary) {
      const targetX = cx - targetHalfW;
      cell.left.pos += (targetX - cell.left.pos) * this.scaleSpeed;
      cell.left.velocity = 0;
    }
    if (!cell.right.isBoundary) {
      const targetX = cx + targetHalfW;
      cell.right.pos += (targetX - cell.right.pos) * this.scaleSpeed;
      cell.right.velocity = 0;
    }
  }

  applyIncompressibility() {
    if (!this.hoveredCell) return;

    // Get hover cell center for directional reference
    const hoverCx = this.hoveredCell.restX + this.hoveredCell.restWidth / 2;
    const hoverCy = this.hoveredCell.restY + this.hoveredCell.restHeight / 2;

    for (const cell of this.grid.cells) {
      if (cell === this.hoveredCell) continue;

      const widthRatio = cell.width / cell.restWidth;
      const heightRatio = cell.height / cell.restHeight;

      // Cell center for direction calculation
      const cellCx = cell.restX + cell.restWidth / 2;
      const cellCy = cell.restY + cell.restHeight / 2;

      // Direction FROM hover TO this cell (this is the allowed push direction)
      const dirX = cellCx - hoverCx;
      const dirY = cellCy - hoverCy;

      // Hard limit: push back strongly when below minimum
      if (widthRatio < this.minSizeRatio) {
        const deficit = cell.restWidth * this.minSizeRatio - cell.width;
        const force = deficit * this.incompressibility * 1.5;

        // Only push edges in the direction AWAY from hover
        if (!this.hoveredEdges.has(cell.left)) {
          // Left edge can only move left (negative) if cell is left of hover
          if (dirX < 0) cell.left.force -= force;
        }
        if (!this.hoveredEdges.has(cell.right)) {
          // Right edge can only move right (positive) if cell is right of hover
          if (dirX > 0) cell.right.force += force;
        }
        // If neither direction works, allow both (edge case)
        if (dirX === 0) {
          if (!this.hoveredEdges.has(cell.left)) cell.left.force -= force * 0.5;
          if (!this.hoveredEdges.has(cell.right)) cell.right.force += force * 0.5;
        }
      }

      if (heightRatio < this.minSizeRatio) {
        const deficit = cell.restHeight * this.minSizeRatio - cell.height;
        const force = deficit * this.incompressibility * 1.5;

        if (!this.hoveredEdges.has(cell.top)) {
          if (dirY < 0) cell.top.force -= force;
        }
        if (!this.hoveredEdges.has(cell.bottom)) {
          if (dirY > 0) cell.bottom.force += force;
        }
        if (dirY === 0) {
          if (!this.hoveredEdges.has(cell.top)) cell.top.force -= force * 0.5;
          if (!this.hoveredEdges.has(cell.bottom)) cell.bottom.force += force * 0.5;
        }
      }

      // Soft resistance (same directional logic)
      if (widthRatio < 1.0) {
        const compression = 1.0 - widthRatio;
        const softForce = compression * cell.restWidth * this.incompressibility * 0.4;

        if (!this.hoveredEdges.has(cell.left) && dirX <= 0) {
          cell.left.force -= softForce;
        }
        if (!this.hoveredEdges.has(cell.right) && dirX >= 0) {
          cell.right.force += softForce;
        }
      }

      if (heightRatio < 1.0) {
        const compression = 1.0 - heightRatio;
        const softForce = compression * cell.restHeight * this.incompressibility * 0.4;

        if (!this.hoveredEdges.has(cell.top) && dirY <= 0) {
          cell.top.force -= softForce;
        }
        if (!this.hoveredEdges.has(cell.bottom) && dirY >= 0) {
          cell.bottom.force += softForce;
        }
      }
    }
  }

  integrateForces() {
    for (const [, edge] of this.grid.edges) {
      // Skip hovered cell's edges - they move directly, not through forces
      if (this.hoveredEdges.has(edge)) {
        edge.force = 0;
        continue;
      }

      // Boundaries use stronger spring to resist movement
      const springMult = edge.isBoundary ? this.boundaryResistance * 3 : 1;
      const springForce = (edge.rest - edge.pos) * this.springStrength * springMult;

      const totalForce = edge.force + springForce;

      edge.velocity += totalForce * this.rippleSpeed;
      edge.velocity *= this.damping;
      edge.pos += edge.velocity;

      // Clamp boundaries to bleed zone
      if (edge.isBoundary) {
        if (edge === this.grid.topBoundary) {
          edge.pos = Math.max(edge.rest - this.bleedZone, Math.min(edge.rest, edge.pos));
        } else if (edge === this.grid.bottomBoundary) {
          edge.pos = Math.min(edge.rest + this.bleedZone, Math.max(edge.rest, edge.pos));
        } else if (edge === this.grid.leftBoundary) {
          edge.pos = Math.max(edge.rest - this.bleedZone, Math.min(edge.rest, edge.pos));
        } else if (edge === this.grid.rightBoundary) {
          edge.pos = Math.min(edge.rest + this.bleedZone, Math.max(edge.rest, edge.pos));
        }

        if (Math.abs(edge.pos - edge.rest) >= this.bleedZone * 0.95) {
          edge.velocity *= 0.3;
        }
      } else {
        const maxDisp = 200;
        const disp = edge.pos - edge.rest;
        if (Math.abs(disp) > maxDisp) {
          edge.pos = edge.rest + Math.sign(disp) * maxDisp;
          edge.velocity *= 0.3;
        }
      }

      edge.force = 0;
    }
  }

  enforceConstraints() {
    const minCellSize = 20;

    for (const cell of this.grid.cells) {
      // Don't constrain hovered cell
      if (cell === this.hoveredCell) continue;

      if (cell.width < minCellSize) {
        const mid = (cell.left.pos + cell.right.pos) / 2;
        if (!cell.left.isBoundary && !this.hoveredEdges.has(cell.left)) {
          cell.left.pos = mid - minCellSize / 2;
        }
        if (!cell.right.isBoundary && !this.hoveredEdges.has(cell.right)) {
          cell.right.pos = mid + minCellSize / 2;
        }
      }

      if (cell.height < minCellSize) {
        const mid = (cell.top.pos + cell.bottom.pos) / 2;
        if (!cell.top.isBoundary && !this.hoveredEdges.has(cell.top)) {
          cell.top.pos = mid - minCellSize / 2;
        }
        if (!cell.bottom.isBoundary && !this.hoveredEdges.has(cell.bottom)) {
          cell.bottom.pos = mid + minCellSize / 2;
        }
      }
    }
  }

  update() {
    for (let i = 0; i < this.rippleIterations; i++) {
      this.applyIncompressibility();
      this.integrateForces();
    }
    this.enforceConstraints();
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

    // Settings
    this.gap = 8;
    this.hoverScale = 1.4;
    this.subdivisionDepth = 5;
    this.minCellSize = 80;
    this.diagonalCount = 0;

    // State
    this.edgeGrid = null;
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
      for (const cell of this.edgeGrid.cells) {
        if (cell.containsPoint(mx, my)) {
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
    this.edgeGrid = new EdgeGrid(this.width, this.height, this.gap);
    this.edgeGrid.generate(this.subdivisionDepth, this.minCellSize);
    this.edgeGrid.addDiagonals(this.diagonalCount);
    this.physics = new PhysicsEngine(this.edgeGrid);
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

    const gap = this.gap;
    const radius = 6;

    for (const cell of this.edgeGrid.cells) {
      const vertices = cell.getVertices(gap);
      if (vertices.length < 3) continue;

      // Bounding box for outside check
      const minX = Math.min(...vertices.map(v => v.x));
      const minY = Math.min(...vertices.map(v => v.y));
      const maxX = Math.max(...vertices.map(v => v.x));
      const maxY = Math.max(...vertices.map(v => v.y));

      if (maxX - minX <= 0 || maxY - minY <= 0) continue;

      const isHovered = cell === this.hoveredCell;
      const isOutside = minX < 0 || minY < 0 || maxX > this.width || maxY > this.height;

      ctx.fillStyle = isHovered ? '#ef4444' : cell.color;
      ctx.globalAlpha = isOutside ? 0.5 : 0.9;

      // Draw polygon with rounded corners
      ctx.beginPath();
      const n = vertices.length;
      for (let i = 0; i < n; i++) {
        const curr = vertices[i];
        const next = vertices[(i + 1) % n];

        // Vector to next vertex
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        // Use smaller radius for short edges
        const r = Math.min(radius, len / 3);

        if (i === 0) {
          // Move to first point (offset by radius toward next)
          ctx.moveTo(curr.x + (dx / len) * r, curr.y + (dy / len) * r);
        }

        // Line to just before next corner
        const endX = next.x - (dx / len) * r;
        const endY = next.y - (dy / len) * r;
        ctx.lineTo(endX, endY);

        // Rounded corner at next vertex
        const afterNext = vertices[(i + 2) % n];
        const dx2 = afterNext.x - next.x;
        const dy2 = afterNext.y - next.y;
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const r2 = Math.min(radius, len2 / 3);

        const cornerEndX = next.x + (dx2 / len2) * r2;
        const cornerEndY = next.y + (dy2 / len2) * r2;

        ctx.quadraticCurveTo(next.x, next.y, cornerEndX, cornerEndY);
      }
      ctx.closePath();

      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Public API
  getShapeCount() {
    return this.edgeGrid ? this.edgeGrid.cells.length : 0;
  }

  getEdgeCount() {
    return this.edgeGrid ? this.edgeGrid.edges.size : 0;
  }

  setGap(gap) {
    this.gap = gap;
    if (this.edgeGrid) this.edgeGrid.gap = gap;
  }

  setHoverScale(scale) {
    this.hoverScale = scale;
  }

  setSubdivisionDepth(depth) {
    this.subdivisionDepth = depth;
    this.regenerate();
  }

  setIncompressibility(value) {
    if (this.physics) this.physics.incompressibility = value;
  }

  setMinSizeRatio(value) {
    if (this.physics) this.physics.minSizeRatio = value;
  }

  setBleedZone(value) {
    if (this.physics) this.physics.bleedZone = value;
  }

  setScaleSpeed(value) {
    if (this.physics) this.physics.scaleSpeed = value;
  }

  setRippleSpeed(value) {
    if (this.physics) this.physics.rippleSpeed = value;
  }

  setOvershoot(value) {
    if (this.physics) this.physics.overshoot = value;
  }

  setFillRatio(value) {
    if (this.physics) this.physics.fillRatio = value;
  }

  setDiagonalCount(value) {
    this.diagonalCount = value;
    // Note: Requires regenerate() to take effect
  }
}

// ============================================
// INITIALIZATION
// ============================================

function updateMetrics() {
  if (!bentoGrid) return;

  const metricsEl = document.getElementById('metrics');
  if (metricsEl) {
    metricsEl.innerHTML = `
      <div><span style="opacity:0.5">Cells:</span> ${bentoGrid.getShapeCount()}</div>
      <div><span style="opacity:0.5">Edges:</span> ${bentoGrid.getEdgeCount()}</div>
    `;
  }
}

let bentoGrid;

function init() {
  bentoGrid = new BentoGrid('container');

  // Wire up all controls
  const controls = {
    subdivisions: {
      el: document.getElementById('subdivisions'),
      display: document.getElementById('subdivisionsValue'),
      handler: (val) => {
        bentoGrid.setSubdivisionDepth(parseInt(val));
        updateMetrics();
      },
      format: (val) => val
    },
    gap: {
      el: document.getElementById('gap'),
      display: document.getElementById('gapValue'),
      handler: (val) => bentoGrid.setGap(parseFloat(val)),
      format: (val) => val
    },
    hoverScale: {
      el: document.getElementById('hoverScale'),
      display: document.getElementById('hoverScaleValue'),
      handler: (val) => bentoGrid.setHoverScale(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(1) + 'x'
    },
    incompress: {
      el: document.getElementById('incompress'),
      display: document.getElementById('incompressValue'),
      handler: (val) => bentoGrid.setIncompressibility(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(2)
    },
    minSize: {
      el: document.getElementById('minSize'),
      display: document.getElementById('minSizeValue'),
      handler: (val) => bentoGrid.setMinSizeRatio(parseFloat(val)),
      format: (val) => Math.round(parseFloat(val) * 100) + '%'
    },
    bleed: {
      el: document.getElementById('bleed'),
      display: document.getElementById('bleedValue'),
      handler: (val) => bentoGrid.setBleedZone(parseFloat(val)),
      format: (val) => val + 'px'
    },
    scaleSpeed: {
      el: document.getElementById('scaleSpeed'),
      display: document.getElementById('scaleSpeedValue'),
      handler: (val) => bentoGrid.setScaleSpeed(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(2)
    },
    ripple: {
      el: document.getElementById('ripple'),
      display: document.getElementById('rippleValue'),
      handler: (val) => bentoGrid.setRippleSpeed(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(2)
    },
    overshoot: {
      el: document.getElementById('overshoot'),
      display: document.getElementById('overshootValue'),
      handler: (val) => bentoGrid.setOvershoot(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(2)
    },
    fillRatio: {
      el: document.getElementById('fillRatio'),
      display: document.getElementById('fillRatioValue'),
      handler: (val) => bentoGrid.setFillRatio(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(1)
    },
    diagonals: {
      el: document.getElementById('diagonals'),
      display: document.getElementById('diagonalsValue'),
      handler: (val) => {
        bentoGrid.setDiagonalCount(parseInt(val));
        bentoGrid.regenerate();
        updateMetrics();
      },
      format: (val) => val
    }
  };

  // Setup each control
  for (const [, ctrl] of Object.entries(controls)) {
    if (ctrl.el) {
      ctrl.el.addEventListener('input', (e) => {
        ctrl.handler(e.target.value);
        if (ctrl.display) ctrl.display.textContent = ctrl.format(e.target.value);
      });
    }
  }

  // Regenerate button
  document.getElementById('regen').addEventListener('click', () => {
    bentoGrid.regenerate();
    updateMetrics();
  });

  updateMetrics();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
