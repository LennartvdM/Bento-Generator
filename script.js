// Elastic Bento Grid Generator
// Generates a larger grid than viewport, clips to visible area
// Uses elastic density: cards scale up AND count increases with space

class ElasticBentoGrid {
  constructor(containerWidth, containerHeight) {
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;
    this.containerArea = containerWidth * containerHeight;
    
    // Elastic density calculation
    // Base reference: 1920x1080 = ~2M pixels
    const referenceArea = 1920 * 1080;
    const areaRatio = this.containerArea / referenceArea;
    
    // Base card size scales with container (fit-scale behavior)
    // But also increases density (more cards) as space increases
    const baseCardSize = Math.max(120, Math.min(400, 150 * Math.sqrt(areaRatio)));
    
    // Density multiplier: more cards per unit area as space increases
    // Small screens: ~0.7x density, Large screens: ~1.5x density
    const densityMultiplier = 0.7 + (areaRatio * 0.8);
    
    // Base grid: fine-grained grid that we'll window from
    // Make it 2-3x finer than card size for better windowing
    // Use square cells to ensure consistent aspect ratios
    const baseGridCellSize = baseCardSize * 0.4; // Fine-grained base grid
    
    // Calculate desired grid dimensions (1.5x container for bleed)
    const desiredGridWidth = containerWidth * 1.5;
    const desiredGridHeight = containerHeight * 1.5;
    
    // Calculate number of cells needed
    this.baseCols = Math.ceil(desiredGridWidth / baseGridCellSize);
    this.baseRows = Math.ceil(desiredGridHeight / baseGridCellSize);
    
    // Use the SAME cell size for both dimensions to ensure square cells
    // This ensures all cards with the same window size have identical dimensions
    this.baseCellWidth = baseGridCellSize;
    this.baseCellHeight = baseGridCellSize;
    
    // Calculate actual grid dimensions based on cell count
    // This ensures perfect alignment
    this.gridWidth = this.baseCols * this.baseCellWidth;
    this.gridHeight = this.baseRows * this.baseCellHeight;
    
    // Calculate grid offset to center the larger grid within container
    // The grid should extend equally beyond container on each side
    // Use actual grid dimensions to ensure perfect alignment
    this.gridOffsetX = (containerWidth - this.gridWidth) / 2;
    this.gridOffsetY = (containerHeight - this.gridHeight) / 2;
    
    // Window sizes: large squares/rectangles that span multiple base grid cells
    // Typical bento windows: 2x2, 3x3, 4x4, 2x4, 4x2, etc.
    this.windowSizes = [
      { cols: 2, rows: 2 }, // Small square
      { cols: 3, rows: 3 }, // Medium square
      { cols: 4, rows: 4 }, // Large square
      { cols: 2, rows: 4 }, // Tall rectangle
      { cols: 4, rows: 2 }, // Wide rectangle
      { cols: 3, rows: 2 }, // Medium wide
      { cols: 2, rows: 3 }, // Medium tall
      { cols: 4, rows: 3 }, // Large wide
      { cols: 3, rows: 4 }, // Large tall
    ];
    
    // Scale window sizes based on density (larger screens get bigger windows)
    // But preserve aspect ratios by scaling proportionally
    const windowScale = Math.max(1, Math.floor(densityMultiplier));
    const maxCols = Math.floor(this.baseCols / 2);
    const maxRows = Math.floor(this.baseRows / 2);
    
    this.windowSizes = this.windowSizes.map(w => {
      const scaledCols = w.cols * windowScale;
      const scaledRows = w.rows * windowScale;
      
      // If either dimension exceeds limit, scale both proportionally to fit
      const colRatio = scaledCols / maxCols;
      const rowRatio = scaledRows / maxRows;
      const scaleFactor = Math.min(1, 1 / Math.max(colRatio, rowRatio));
      
      return {
        cols: Math.max(2, Math.floor(scaledCols * scaleFactor)),
        rows: Math.max(2, Math.floor(scaledRows * scaleFactor))
      };
    }).filter(w => w.cols >= 2 && w.rows >= 2); // Ensure minimum size
    
    this.cards = [];
    // Color palette avoiding red-ish hues (orange to violet)
    // Using blues, greens, teals, cyans only
    this.palette = [
      '#22d3ee', // Cyan
      '#38bdf8', // Sky blue
      '#60a5fa', // Blue
      '#3b82f6', // Bright blue
      '#2563eb', // Deep blue
      '#34d399', // Emerald green
      '#10b981', // Green
      '#14b8a6', // Teal
      '#06b6d4', // Cyan
      '#0891b2', // Dark cyan
      '#0ea5e9', // Light blue
      '#0284c7', // Blue
      '#0d9488', // Teal
      '#059669', // Green
      '#2dd4bf', // Light teal
      '#5eead4'  // Pale teal
    ];
  }
  
  // Check if a window can be placed at a given position
  canPlaceWindow(baseRow, baseCol, windowCols, windowRows, occupied) {
    // Check bounds
    if (baseRow + windowRows > this.baseRows || baseCol + windowCols > this.baseCols) {
      return false;
    }
    
    // Check if all cells in the window are free
    for (let r = baseRow; r < baseRow + windowRows; r++) {
      for (let c = baseCol; c < baseCol + windowCols; c++) {
        const key = `${r},${c}`;
        if (occupied.has(key)) {
          return false;
        }
      }
    }
    return true;
  }
  
  // Mark cells as occupied for a window
  markWindowOccupied(baseRow, baseCol, windowCols, windowRows, occupied) {
    for (let r = baseRow; r < baseRow + windowRows; r++) {
      for (let c = baseCol; c < baseCol + windowCols; c++) {
        occupied.add(`${r},${c}`);
      }
    }
  }
  
  // Calculate coverage percentage for container area only
  getContainerCoverage(occupied) {
    // Container bounds in base grid coordinates
    const containerStartCol = Math.floor(-this.gridOffsetX / this.baseCellWidth);
    const containerStartRow = Math.floor(-this.gridOffsetY / this.baseCellHeight);
    const containerEndCol = Math.ceil((this.containerWidth - this.gridOffsetX) / this.baseCellWidth);
    const containerEndRow = Math.ceil((this.containerHeight - this.gridOffsetY) / this.baseCellHeight);
    
    const containerCols = containerEndCol - containerStartCol;
    const containerRows = containerEndRow - containerStartRow;
    const containerTotalCells = containerCols * containerRows;
    
    if (containerTotalCells === 0) return 1;
    
    // Count occupied cells within container bounds
    let occupiedInContainer = 0;
    for (let r = containerStartRow; r < containerEndRow; r++) {
      for (let c = containerStartCol; c < containerEndCol; c++) {
        if (r >= 0 && r < this.baseRows && c >= 0 && c < this.baseCols) {
          if (occupied.has(`${r},${c}`)) {
            occupiedInContainer++;
          }
        }
      }
    }
    
    return occupiedInContainer / containerTotalCells;
  }
  
  // Check if a window overlaps with container area
  overlapsContainer(row, col, windowCols, windowRows) {
    const containerStartCol = Math.floor(-this.gridOffsetX / this.baseCellWidth);
    const containerStartRow = Math.floor(-this.gridOffsetY / this.baseCellHeight);
    const containerEndCol = Math.ceil((this.containerWidth - this.gridOffsetX) / this.baseCellWidth);
    const containerEndRow = Math.ceil((this.containerHeight - this.gridOffsetY) / this.baseCellHeight);
    
    // Check if window overlaps with container bounds
    return !(row + windowRows <= containerStartRow || row >= containerEndRow ||
             col + windowCols <= containerStartCol || col >= containerEndCol);
  }
  
  // Generate the bento grid by windowing large squares from base grid
  generate() {
    this.cards = [];
    const occupied = new Set();
    
    // Target coverage - stop when we've covered most of the grid
    const targetCoverage = 0.95; // 95% coverage is plenty
    
    // Try to place windows, preferring larger ones first
    const sortedWindowSizes = [...this.windowSizes].sort((a, b) => 
      (b.cols * b.rows) - (a.cols * a.rows) // Larger windows first
    );
    
    // Use a smarter placement strategy: fill until no empty space, avoid outside cards
    let maxAttempts = this.baseRows * this.baseCols * 2; // Safety limit
    let attempts = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 50; // Stop after many failures
    
    // Keep generating until container has no empty space
    while (attempts < maxAttempts && consecutiveFailures < maxConsecutiveFailures) {
      attempts++;
      
      // Check if we're done (no empty space in container)
      // Check every 5 placements to avoid performance issues
      if (attempts % 5 === 0 && !this.hasEmptySpace(this.containerWidth, this.containerHeight)) {
        break;
      }
      
      // Find the best window placement
      let bestPlacement = null;
      let bestScore = -Infinity;
      
      // Sample positions strategically (not every single cell)
      const step = Math.max(1, Math.floor(Math.min(this.baseRows, this.baseCols) / 10));
      
      for (let row = 0; row < this.baseRows; row += step) {
        for (let col = 0; col < this.baseCols; col += step) {
          // Try each window size at this position
          for (const windowSize of sortedWindowSizes) {
            if (this.canPlaceWindow(row, col, windowSize.cols, windowSize.rows, occupied)) {
              // Calculate card position to check if it's outside
              const x = this.gridOffsetX + col * this.baseCellWidth;
              const y = this.gridOffsetY + row * this.baseCellHeight;
              const width = windowSize.cols * this.baseCellWidth;
              const height = windowSize.rows * this.baseCellHeight;
              
              // Check if card would be fully outside container
              const cardRight = x + width;
              const cardBottom = y + height;
              const isFullyOutside = cardRight <= 0 || x >= this.containerWidth || 
                                     cardBottom <= 0 || y >= this.containerHeight;
              
              // Heavily penalize fully outside cards
              if (isFullyOutside) {
                continue; // Skip fully outside placements
              }
              
              const area = windowSize.cols * windowSize.rows;
              const newCells = this.countNewCells(row, col, windowSize.cols, windowSize.rows, occupied);
              
              // Heavily prioritize windows that overlap with container
              const inContainer = this.overlapsContainer(row, col, windowSize.cols, windowSize.rows);
              const containerBonus = inContainer ? 1000 : 100; // Bonus for container overlap
              
              // Prefer cards that are fully inside over straddling
              const cardLeft = x;
              const cardTop = y;
              const isFullyInside = cardLeft >= 0 && cardRight <= this.containerWidth && 
                                   cardTop >= 0 && cardBottom <= this.containerHeight;
              const insideBonus = isFullyInside ? 500 : 0;
              
              // Also prefer larger windows and more new coverage
              const score = containerBonus + insideBonus + area * 2 + newCells;
              
              if (score > bestScore) {
                bestScore = score;
                bestPlacement = { row, col, ...windowSize };
              }
            }
          }
        }
      }
      
      // If we found a placement, add it
      if (bestPlacement) {
        consecutiveFailures = 0; // Reset failure counter
        this.markWindowOccupied(
          bestPlacement.row, 
          bestPlacement.col, 
          bestPlacement.cols, 
          bestPlacement.rows, 
          occupied
        );
        
        // Calculate position and size
        const x = this.gridOffsetX + bestPlacement.col * this.baseCellWidth;
        const y = this.gridOffsetY + bestPlacement.row * this.baseCellHeight;
        const width = bestPlacement.cols * this.baseCellWidth;
        const height = bestPlacement.rows * this.baseCellHeight;
        
        // Add small gap between cards (bento style)
        // Fixed gap applied equally to preserve aspect ratios
        const gap = 4;
        
        this.cards.push({
          x: x + gap,
          y: y + gap,
          width: width - gap * 2,
          height: height - gap * 2,
          color: this.palette[Math.floor(Math.random() * this.palette.length)],
          opacity: 0.9 + Math.random() * 0.1
        });
      } else {
        // No valid placement found
        consecutiveFailures++;
        // If we can't find any more placements, check one more time for empty space
        if (consecutiveFailures >= 10) {
          if (!this.hasEmptySpace(this.containerWidth, this.containerHeight)) {
            break; // No empty space, we're done
          }
        }
      }
    }
    
    return this.cards;
  }
  
  // Count how many new cells a window would cover
  countNewCells(baseRow, baseCol, windowCols, windowRows, occupied) {
    let count = 0;
    for (let r = baseRow; r < baseRow + windowRows; r++) {
      for (let c = baseCol; c < baseCol + windowCols; c++) {
        const key = `${r},${c}`;
        if (!occupied.has(key)) {
          count++;
        }
      }
    }
    return count;
  }
  
  // Classify cards based on their position relative to container
  // Cards are positioned relative to gridOffset, but container is at (0, 0) in card coordinates
  classifyCards(containerWidth, containerHeight) {
    let fullyInside = 0;
    let straddling = 0;
    let fullyOutside = 0;
    
    // Container bounds in card coordinate system
    // The container starts at (0, 0) and extends to (containerWidth, containerHeight)
    const containerLeft = 0;
    const containerTop = 0;
    const containerRight = containerWidth;
    const containerBottom = containerHeight;
    
    this.cards.forEach(card => {
      const cardLeft = card.x;
      const cardTop = card.y;
      const cardRight = card.x + card.width;
      const cardBottom = card.y + card.height;
      
      // Check if card is fully outside container
      // Card is fully outside if it's completely to the left, right, above, or below
      if (cardRight <= containerLeft || cardLeft >= containerRight || 
          cardBottom <= containerTop || cardTop >= containerBottom) {
        fullyOutside++;
      }
      // Check if card is fully inside container
      // Card is fully inside if all edges are within container bounds
      else if (cardLeft >= containerLeft && cardRight <= containerRight && 
               cardTop >= containerTop && cardBottom <= containerBottom) {
        fullyInside++;
      }
      // Otherwise it's straddling (partially inside, partially outside)
      // This means the card overlaps with container but extends beyond at least one edge
      else {
        straddling++;
      }
    });
    
    return { fullyInside, straddling, fullyOutside };
  }
  
  // Check if container has any empty space (binary yes/no)
  hasEmptySpace(containerWidth, containerHeight) {
    // Container bounds in card coordinate system
    const containerLeft = 0;
    const containerTop = 0;
    const containerRight = containerWidth;
    const containerBottom = containerHeight;
    
    // Create a grid to track coverage within container
    // Use a fine sampling grid to check for gaps
    const sampleSize = 20; // Sample 20x20 points within container
    const stepX = containerWidth / sampleSize;
    const stepY = containerHeight / sampleSize;
    
    const covered = new Set();
    
    // Mark all sample points covered by cards
    this.cards.forEach(card => {
      const cardLeft = card.x;
      const cardTop = card.y;
      const cardRight = card.x + card.width;
      const cardBottom = card.y + card.height;
      
      // Check which sample points this card covers
      for (let sy = 0; sy < sampleSize; sy++) {
        const sampleY = containerTop + sy * stepY + stepY / 2;
        if (sampleY >= cardTop && sampleY <= cardBottom) {
          for (let sx = 0; sx < sampleSize; sx++) {
            const sampleX = containerLeft + sx * stepX + stepX / 2;
            if (sampleX >= cardLeft && sampleX <= cardRight) {
              covered.add(`${sx},${sy}`);
            }
          }
        }
      }
    });
    
    // Check if all sample points are covered
    const totalSamples = sampleSize * sampleSize;
    return covered.size < totalSamples;
  }
  
  // Get metrics for display
  getMetrics(containerWidth, containerHeight) {
    const classification = this.classifyCards(containerWidth, containerHeight);
    
    return {
      containerSize: `${Math.round(containerWidth)}×${Math.round(containerHeight)}`,
      baseGrid: `${this.baseCols}×${this.baseRows}`,
      cardCount: this.cards.length,
      fullyInside: classification.fullyInside,
      straddling: classification.straddling,
      fullyOutside: classification.fullyOutside,
      hasEmptySpace: this.hasEmptySpace(containerWidth, containerHeight) ? 'Yes' : 'No',
      cellSize: `${Math.round(this.baseCellWidth)}×${Math.round(this.baseCellHeight)}`,
      density: (this.cards.length / (containerWidth * containerHeight) * 1000000).toFixed(2),
      gridArea: `${Math.round(this.gridWidth)}×${Math.round(this.gridHeight)}`
    };
  }
}

// Konva rendering - fullscreen with mask overlay
class BentoRenderer {
  constructor(canvasContainerId, containerWidth, containerHeight) {
    // Fullscreen stage
    this.stage = new Konva.Stage({
      container: canvasContainerId,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    
    // Store container dimensions and position
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;
    this.updateContainerPosition();
    
    // Main layer for cards (no clipping - render everywhere)
    this.cardLayer = new Konva.Layer({ visible: true });
    this.stage.add(this.cardLayer);
    
    // Mask layer - darkens area outside container
    this.maskLayer = new Konva.Layer();
    this.stage.add(this.maskLayer);
    
    // Debug layer for grid visualization (optional)
    this.debugLayer = new Konva.Layer({ visible: false });
    this.stage.add(this.debugLayer);
    
    // Dot grid layer - added last so it renders on top
    this.dotGridLayer = new Konva.Layer({ visible: false });
    this.stage.add(this.dotGridLayer);
    
    this.dotGridScale = 1.0;
    this.currentGrid = null;
    
    this.updateMask();
  }
  
  updateContainerPosition() {
    // Calculate container position (centered, 75vw x 75vh)
    this.containerX = (window.innerWidth - this.containerWidth) / 2;
    this.containerY = (window.innerHeight - this.containerHeight) / 2;
  }
  
  updateMask() {
    // Clear existing mask
    this.maskLayer.destroyChildren();
    
    // Create mask that covers everything except the container area
    // We'll use a composite approach: cover entire screen, then cut out container
    
    // Top rectangle
    if (this.containerY > 0) {
      this.maskLayer.add(new Konva.Rect({
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: this.containerY,
        fill: 'rgba(0, 0, 0, 0.5)',
        listening: false,
      }));
    }
    
    // Bottom rectangle
    const bottomY = this.containerY + this.containerHeight;
    if (bottomY < window.innerHeight) {
      this.maskLayer.add(new Konva.Rect({
        x: 0,
        y: bottomY,
        width: window.innerWidth,
        height: window.innerHeight - bottomY,
        fill: 'rgba(0, 0, 0, 0.5)',
        listening: false,
      }));
    }
    
    // Left rectangle
    if (this.containerX > 0) {
      this.maskLayer.add(new Konva.Rect({
        x: 0,
        y: this.containerY,
        width: this.containerX,
        height: this.containerHeight,
        fill: 'rgba(0, 0, 0, 0.5)',
        listening: false,
      }));
    }
    
    // Right rectangle
    const rightX = this.containerX + this.containerWidth;
    if (rightX < window.innerWidth) {
      this.maskLayer.add(new Konva.Rect({
        x: rightX,
        y: this.containerY,
        width: window.innerWidth - rightX,
        height: this.containerHeight,
        fill: 'rgba(0, 0, 0, 0.5)',
        listening: false,
      }));
    }
    
    this.maskLayer.draw();
  }
  
  renderCards(cards) {
    // Clear existing cards
    this.cardLayer.destroyChildren();
    
    // Helper to adjust color brightness
    const adjustBrightness = (color, factor) => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
      const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
      const newB = Math.min(255, Math.max(0, Math.round(b * factor)));
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };
    
    // Offset cards to account for container position
    const offsetX = this.containerX;
    const offsetY = this.containerY;
    
    cards.forEach((card, index) => {
      // Create gradient fill (positioned relative to container, but rendered fullscreen)
      const rect = new Konva.Rect({
        x: card.x + offsetX,
        y: card.y + offsetY,
        width: card.width,
        height: card.height,
        fill: card.color,
        opacity: card.opacity || 0.9,
        cornerRadius: 8,
        shadowBlur: 8,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        shadowOffset: { x: 2, y: 2 },
      });
      
      // Add subtle gradient overlay
      const gradient = new Konva.Rect({
        x: card.x + offsetX,
        y: card.y + offsetY,
        width: card.width,
        height: card.height,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: card.width, y: card.height },
        fillLinearGradientColorStops: [
          0, card.color,
          0.5, adjustBrightness(card.color, 1.15),
          1, adjustBrightness(card.color, 0.75)
        ],
        opacity: 0.6,
        cornerRadius: 8,
        listening: false,
      });
      
      // Add border
      const border = new Konva.Rect({
        x: card.x + offsetX,
        y: card.y + offsetY,
        width: card.width,
        height: card.height,
        stroke: 'rgba(255, 255, 255, 0.15)',
        strokeWidth: 1,
        cornerRadius: 8,
        listening: false,
      });
      
      this.cardLayer.add(rect);
      this.cardLayer.add(gradient);
      this.cardLayer.add(border);
    });
    
    this.cardLayer.draw();
  }
  
  toggleCards() {
    const isVisible = this.cardLayer.visible();
    this.cardLayer.visible(!isVisible);
    this.cardLayer.draw();
    return !isVisible;
  }
  
  renderGrid(grid) {
    // Optional: render grid visualization
    this.debugLayer.destroyChildren();
    
    const offsetX = this.containerX;
    const offsetY = this.containerY;
    
    const gridRect = new Konva.Rect({
      x: grid.gridOffsetX + offsetX,
      y: grid.gridOffsetY + offsetY,
      width: grid.gridWidth,
      height: grid.gridHeight,
      stroke: 'rgba(59, 130, 246, 0.3)',
      strokeWidth: 1,
      dash: [4, 4],
    });
    this.debugLayer.add(gridRect);
    
    // Container outline
    const containerRect = new Konva.Rect({
      x: this.containerX,
      y: this.containerY,
      width: this.containerWidth,
      height: this.containerHeight,
      stroke: 'rgba(244, 114, 182, 0.5)',
      strokeWidth: 2,
    });
    this.debugLayer.add(containerRect);
    
    this.debugLayer.draw();
  }
  
  renderDotGrid(grid) {
    // Store grid reference for scaling updates
    this.currentGrid = grid;
    
    // Render a dot at each base grid cell position
    this.updateDotGrid();
  }
  
  updateDotGrid() {
    if (!this.currentGrid) return;
    
    this.dotGridLayer.destroyChildren();
    
    // Scale the grid cell size - this changes the spacing between dots
    const scaledCellWidth = this.currentGrid.baseCellWidth * this.dotGridScale;
    const scaledCellHeight = this.currentGrid.baseCellHeight * this.dotGridScale;
    
    // Calculate grid origin in screen coordinates
    // Use the same grid offset as the cards, but in screen space
    const gridOriginX = this.currentGrid.gridOffsetX + this.containerX;
    const gridOriginY = this.currentGrid.gridOffsetY + this.containerY;
    
    // Calculate how many dots to show to cover the entire viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Find the starting grid position (may be negative)
    const startCol = Math.floor((0 - gridOriginX) / scaledCellWidth);
    const startRow = Math.floor((0 - gridOriginY) / scaledCellHeight);
    
    // Find the ending grid position
    const endCol = Math.ceil((viewportWidth - gridOriginX) / scaledCellWidth);
    const endRow = Math.ceil((viewportHeight - gridOriginY) / scaledCellHeight);
    
    // Draw dots across the entire viewport
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const x = gridOriginX + (col + 0.5) * scaledCellWidth;
        const y = gridOriginY + (row + 0.5) * scaledCellHeight;
        
        // Only draw if within viewport bounds
        if (x >= 0 && x <= viewportWidth && y >= 0 && y <= viewportHeight) {
          const dot = new Konva.Circle({
            x: x,
            y: y,
            radius: 2,
            fill: 'rgba(255, 255, 255, 0.6)',
            stroke: 'rgba(255, 255, 255, 0.3)',
            strokeWidth: 0.5,
            listening: false,
          });
          this.dotGridLayer.add(dot);
        }
      }
    }
    
    this.dotGridLayer.draw();
  }
  
  setDotGridScale(scale) {
    this.dotGridScale = scale;
    if (this.dotGridLayer.visible() && this.currentGrid) {
      this.updateDotGrid();
    }
  }
  
  toggleDotGrid() {
    const isVisible = this.dotGridLayer.visible();
    this.dotGridLayer.visible(!isVisible);
    this.dotGridLayer.draw();
    return !isVisible;
  }
  
  toggleDebug() {
    this.debugLayer.visible(!this.debugLayer.visible());
    this.debugLayer.draw();
  }
  
  resize(containerWidth, containerHeight) {
    this.stage.width(window.innerWidth);
    this.stage.height(window.innerHeight);
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;
    this.updateContainerPosition();
    this.updateMask();
    this.cardLayer.draw();
  }
}

// Main application
let grid;
let renderer;

function getContainerSize() {
  const container = document.getElementById('container');
  return {
    width: container.clientWidth,
    height: container.clientHeight
  };
}

function init() {
  const { width, height } = getContainerSize();
  
  grid = new ElasticBentoGrid(width, height);
  renderer = new BentoRenderer('canvas-container', width, height);
  
  generate();
}

function generate() {
  const cards = grid.generate();
  renderer.renderCards(cards);
  renderer.renderGrid(grid);
  renderer.renderDotGrid(grid);
  updateMetrics();
}

function updateMetrics() {
  const { width, height } = getContainerSize();
  const metrics = grid.getMetrics(width, height);
  const metricsEl = document.getElementById('metrics');
  metricsEl.innerHTML = `
    <div>Container</div><div>${metrics.containerSize}</div>
    <div>Base Grid</div><div>${metrics.baseGrid} cells</div>
    <div>Total Cards</div><div>${metrics.cardCount}</div>
    <div>Inside</div><div>${metrics.fullyInside}</div>
    <div>Straddling</div><div>${metrics.straddling}</div>
    <div>Outside</div><div>${metrics.fullyOutside}</div>
    <div>Empty Space</div><div>${metrics.hasEmptySpace}</div>
    <div>Cell Size</div><div>${metrics.cellSize}</div>
    <div>Density</div><div>${metrics.density} cards/M²</div>
    <div>Grid Area</div><div>${metrics.gridArea}</div>
  `;
}

// Handle resize
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const { width, height } = getContainerSize();
    grid = new ElasticBentoGrid(width, height);
    renderer.resize(width, height);
    generate();
  }, 150);
});

// Regenerate button
document.getElementById('regen').addEventListener('click', generate);

// Toggle cards button
document.getElementById('toggleCards').addEventListener('click', () => {
  const isVisible = renderer.toggleCards();
  document.getElementById('toggleCards').textContent = isVisible ? 'Hide Cards' : 'Show Cards';
});

// Toggle dot grid button
document.getElementById('toggleDotGrid').addEventListener('click', () => {
  const isVisible = renderer.toggleDotGrid();
  document.getElementById('toggleDotGrid').textContent = isVisible ? 'Hide Dot Grid' : 'Show Dot Grid';
});

// Dot grid scale slider
const dotGridScaleSlider = document.getElementById('dotGridScale');
const dotGridScaleValue = document.getElementById('dotGridScaleValue');

dotGridScaleSlider.addEventListener('input', (e) => {
  const scale = parseFloat(e.target.value);
  dotGridScaleValue.textContent = scale.toFixed(1);
  renderer.setDotGridScale(scale);
});

// Toggle debug view (optional)
document.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') {
    renderer.toggleDebug();
  }
});

// Initialize
init();
