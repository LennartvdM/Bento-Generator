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
    
  }
  
  // Bento shape definitions - typical rectangular bento box shapes + L-shaped corners
  // Each shape is defined by width, height, and block positions
  getBentoShapes() {
    const shapes = [];
    
    // Common bento rectangle sizes (width x height in grid cells)
    const sizes = [
      // Small squares
      { w: 1, h: 1 },
      { w: 2, h: 2 },
      { w: 3, h: 3 },
      
      // Horizontal rectangles
      { w: 2, h: 1 },
      { w: 3, h: 1 },
      { w: 4, h: 1 },
      { w: 2, h: 3 },
      { w: 3, h: 2 },
      { w: 4, h: 2 },
      
      // Vertical rectangles
      { w: 1, h: 2 },
      { w: 1, h: 3 },
      { w: 1, h: 4 },
      { w: 2, h: 4 },
      { w: 3, h: 4 },
      
      // Larger rectangles
      { w: 4, h: 3 },
      { w: 3, h: 4 },
      { w: 4, h: 4 },
    ];
    
    // Generate blocks for each rectangular size
    sizes.forEach(size => {
      const blocks = [];
      for (let y = 0; y < size.h; y++) {
        for (let x = 0; x < size.w; x++) {
          blocks.push([x, y]);
        }
      }
      shapes.push({
        name: `${size.w}x${size.h}`,
        blocks: blocks,
        width: size.w,
        height: size.h
      });
    });
    
    // Add balanced 3-block L-shapes (corner pieces) in all 4 rotations
    // Balanced means: horizontal and vertical parts have same width/height
    // Example: 1-block corner with 1-block horizontal and 1-block vertical
    const lShapes3Block = [
      // L pointing right-down: corner + 1 horizontal + 1 vertical (balanced)
      { name: 'L-3-0', blocks: [[0,0], [1,0], [0,1]], width: 2, height: 2 },
      // L pointing down-left: corner + 1 vertical + 1 horizontal (balanced)
      { name: 'L-3-90', blocks: [[0,0], [0,1], [1,1]], width: 2, height: 2 },
      // L pointing left-up: corner + 1 horizontal + 1 vertical (balanced)
      { name: 'L-3-180', blocks: [[1,0], [0,1], [1,1]], width: 2, height: 2 },
      // L pointing up-right: corner + 1 horizontal + 1 vertical (balanced)
      { name: 'L-3-270', blocks: [[0,0], [1,0], [1,1]], width: 2, height: 2 },
    ];
    shapes.push(...lShapes3Block);
    
    // Add balanced scaled-up L-shapes (2x2 units)
    // Balanced: 2x2 corner with 2x2 horizontal and 2x2 vertical parts
    const lShapesScaled = [
      // Large L pointing right-down: 2x2 corner + 2x2 horizontal + 2x2 vertical
      { 
        name: 'L-scaled-0', 
        blocks: [
          [0,0], [1,0], [0,1], [1,1],  // 2x2 corner
          [2,0], [3,0], [2,1], [3,1],  // 2x2 horizontal part
          [0,2], [1,2], [0,3], [1,3]   // 2x2 vertical part
        ], 
        width: 4, 
        height: 4 
      },
      // Large L pointing down-left: 2x2 corner + 2x2 vertical + 2x2 horizontal
      { 
        name: 'L-scaled-90', 
        blocks: [
          [0,0], [1,0], [0,1], [1,1],  // 2x2 corner
          [0,2], [1,2], [0,3], [1,3],  // 2x2 vertical part
          [2,2], [3,2], [2,3], [3,3]   // 2x2 horizontal part
        ], 
        width: 4, 
        height: 4 
      },
      // Large L pointing left-up: 2x2 corner + 2x2 horizontal + 2x2 vertical
      { 
        name: 'L-scaled-180', 
        blocks: [
          [2,0], [3,0], [2,1], [3,1],  // 2x2 corner
          [0,1], [1,1], [0,2], [1,2],  // 2x2 horizontal part
          [2,2], [3,2], [2,3], [3,3]   // 2x2 vertical part
        ], 
        width: 4, 
        height: 4 
      },
      // Large L pointing up-right: 2x2 corner + 2x2 horizontal + 2x2 vertical
      { 
        name: 'L-scaled-270', 
        blocks: [
          [0,0], [1,0], [0,1], [1,1],  // 2x2 corner
          [2,0], [3,0], [2,1], [3,1],  // 2x2 horizontal part
          [0,2], [1,2], [0,3], [1,3]   // 2x2 vertical part
        ], 
        width: 4, 
        height: 4 
      },
    ];
    shapes.push(...lShapesScaled);
    
    // Sort by area (larger first) to prioritize filling
    return shapes.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  }
  
  // Generate Bento shapes that connect grid dots
  // Only shapes within or straddling container, no fully outside, no empty space
  generateSquares(gridScale = 1.0) {
    const shapes = [];
    const occupied = new Set();
    
    // Use scaled cell size (matches dot grid)
    const scaledCellWidth = this.baseCellWidth * gridScale;
    const scaledCellHeight = this.baseCellHeight * gridScale;
    
    // Calculate grid bounds in container coordinates
    const gridOriginX = this.gridOffsetX;
    const gridOriginY = this.gridOffsetY;
    
    // Container bounds in grid coordinates
    const containerLeft = 0;
    const containerTop = 0;
    const containerRight = this.containerWidth;
    const containerBottom = this.containerHeight;
    
    // Calculate how many scaled cells fit in the grid
    const scaledCols = Math.ceil(this.gridWidth / scaledCellWidth);
    const scaledRows = Math.ceil(this.gridHeight / scaledCellHeight);
    
    // Get all Bento shape templates
    const bentoShapes = this.getBentoShapes();
    
    // Keep placing until container is completely filled (no deficits allowed)
    // Use much more reasonable limits to avoid freezing
    let maxAttempts = Math.min(3000, scaledRows * scaledCols * 2); // Cap at 3000 for better performance
    let attempts = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 40; // Reduced failure tolerance
    
    while (attempts < maxAttempts && consecutiveFailures < maxConsecutiveFailures) {
      attempts++;
      
      // Check for empty space less frequently (it's still expensive)
      if (attempts % 20 === 0) {
        const hasEmpty = this.hasEmptySpace(shapes, containerLeft, containerTop, containerRight, containerBottom, scaledCellWidth, scaledCellHeight, gridOriginX, gridOriginY);
        if (!hasEmpty) {
          // No empty space found - we're done
          break;
        }
      }
      
      // Try to find a placement - use smarter search strategy
      let bestPlacement = null;
      let bestScore = -Infinity;
      
      // Generate candidate positions more efficiently
      // Sample positions rather than checking every single one
      const candidates = [];
      const maxCandidates = 300; // Reduced for better performance
      
      // Create a list of potential positions (prioritize unoccupied areas)
      for (let i = 0; i < maxCandidates; i++) {
        const row = Math.floor(Math.random() * scaledRows);
        const col = Math.floor(Math.random() * scaledCols);
        candidates.push({ row, col });
      }
      
      // Also add some edge positions for better filling
      for (let edge = 0; edge < Math.min(20, scaledRows); edge++) {
        candidates.push({ row: scaledRows - 1 - edge, col: Math.floor(Math.random() * scaledCols) });
        candidates.push({ row: Math.floor(Math.random() * scaledRows), col: scaledCols - 1 - edge });
      }
      
      // Try each candidate position with each shape
      for (const { row, col } of candidates) {
        for (const shapeTemplate of bentoShapes) {
          // Check if shape fits within grid bounds (using width/height for rectangles)
          if (row + shapeTemplate.height > scaledRows || col + shapeTemplate.width > scaledCols) continue;
          
          // Check if all blocks in shape are unoccupied
          let canPlace = true;
          const blockPositions = [];
          for (const block of shapeTemplate.blocks) {
            const blockRow = row + block[1];
            const blockCol = col + block[0];
            const key = `${blockRow},${blockCol}`;
            if (occupied.has(key)) {
              canPlace = false;
              break;
            }
            blockPositions.push({ row: blockRow, col: blockCol, key });
          }
          
          if (!canPlace) continue;
          
          // Calculate shape bounding box to connect dots
          // For L-shapes, calculate from actual block positions
          const minCol = Math.min(...shapeTemplate.blocks.map(b => b[0]));
          const minRow = Math.min(...shapeTemplate.blocks.map(b => b[1]));
          const maxCol = Math.max(...shapeTemplate.blocks.map(b => b[0]));
          const maxRow = Math.max(...shapeTemplate.blocks.map(b => b[1]));
          
          const x = gridOriginX + (col + minCol + 0.5) * scaledCellWidth;
          const y = gridOriginY + (row + minRow + 0.5) * scaledCellHeight;
          const width = (maxCol - minCol + 1) * scaledCellWidth;
          const height = (maxRow - minRow + 1) * scaledCellHeight;
          
          // Check if fully outside container
          const shapeRight = x + width;
          const shapeBottom = y + height;
          const isFullyOutside = shapeRight <= containerLeft || x >= containerRight ||
                                shapeBottom <= containerTop || y >= containerBottom;
          
          if (isFullyOutside) continue;
          
          // Score: prioritize filling empty space
          const shapeLeft = x;
          const shapeTop = y;
          const isFullyInside = shapeLeft >= containerLeft && shapeRight <= containerRight &&
                               shapeTop >= containerTop && shapeBottom <= containerBottom;
          const isStraddling = !isFullyInside && !isFullyOutside;
          
          // Calculate overlap area with container
          const overlapLeft = Math.max(shapeLeft, containerLeft);
          const overlapRight = Math.min(shapeRight, containerRight);
          const overlapTop = Math.max(shapeTop, containerTop);
          const overlapBottom = Math.min(shapeBottom, containerBottom);
          const overlapWidth = Math.max(0, overlapRight - overlapLeft);
          const overlapHeight = Math.max(0, overlapBottom - overlapTop);
          const overlapArea = overlapWidth * overlapHeight;
          
          // Prioritize bottom/right edges
          const distToBottom = Math.abs(shapeBottom - containerBottom);
          const distToRight = Math.abs(shapeRight - containerRight);
          const bottomEdgeBonus = distToBottom < scaledCellWidth * 3 ? 500 : 0;
          const rightEdgeBonus = distToRight < scaledCellWidth * 3 ? 300 : 0;
          
          // Base score: fully inside > straddling, overlap area is important
          const baseScore = (isFullyInside ? 1000 : isStraddling ? 800 : 0);
          const score = baseScore + overlapArea * 0.1 + bottomEdgeBonus + rightEdgeBonus;
          
          if (score > bestScore) {
            bestScore = score;
            bestPlacement = { 
              row, 
              col, 
              shapeTemplate, 
              blockPositions,
              x, 
              y, 
              width, 
              height,
              blocks: shapeTemplate.blocks
            };
          }
        }
      }
      
      if (bestPlacement) {
        consecutiveFailures = 0;
        
        // Double-check all blocks are still unoccupied (race condition protection)
        let allFree = true;
        for (const blockPos of bestPlacement.blockPositions) {
          if (occupied.has(blockPos.key)) {
            allFree = false;
            break;
          }
        }
        
        if (!allFree) {
          // Skip this placement if blocks were occupied between check and placement
          consecutiveFailures++;
          // Don't place this shape, but continue the loop
        } else {
          // Mark all blocks in shape as occupied
        for (const blockPos of bestPlacement.blockPositions) {
          occupied.add(blockPos.key);
        }
        
        // Calculate block positions relative to shape origin
        // For rectangular shapes, we can use the bounding box
        // For L-shapes, we need individual block positions
        const isRectangular = bestPlacement.shapeTemplate.blocks.length === (bestPlacement.shapeTemplate.width * bestPlacement.shapeTemplate.height);
        
        shapes.push({
          x: bestPlacement.x,
          y: bestPlacement.y,
          width: bestPlacement.width,
          height: bestPlacement.height,
          blocks: bestPlacement.blocks.map(b => {
            // Each block is positioned at a dot center
            const blockCol = bestPlacement.col + b[0];
            const blockRow = bestPlacement.row + b[1];
            return {
              x: gridOriginX + (blockCol + 0.5) * scaledCellWidth,
              y: gridOriginY + (blockRow + 0.5) * scaledCellHeight,
              width: scaledCellWidth,
              height: scaledCellHeight
            };
          }),
          shapeName: bestPlacement.shapeTemplate.name,
          isRectangular: isRectangular // Flag to know if we can render as single rect
        });
        
          consecutiveFailures = 0; // Reset on successful placement
        }
      } else {
        consecutiveFailures++;
        // If we can't find placements, check for empty space more aggressively
        if (consecutiveFailures >= 20) {
          const hasEmpty = this.hasEmptySpace(shapes, containerLeft, containerTop, containerRight, containerBottom, scaledCellWidth, scaledCellHeight, gridOriginX, gridOriginY);
          if (!hasEmpty) {
            // No empty space - we're done
            break;
          }
          // Still has empty space - reset failure counter and keep trying
          consecutiveFailures = 0;
        }
      }
    }
    
    return shapes;
  }
  
  // Physics-based gap adjustment: shapes float freely after initial grid placement
  adjustGapsWithPhysics(shapes, gapSize, iterations = 50, damping = 0.8) {
    if (shapes.length === 0) return shapes;
    
    // Create a copy of shapes with velocity and force tracking
    // Shapes are now free to float - not constrained to grid
    const physicsShapes = shapes.map(shape => ({
      ...shape,
      vx: 0, // velocity x
      vy: 0, // velocity y
      fx: 0, // force x
      fy: 0, // force y
      centerX: shape.x + shape.width / 2,
      centerY: shape.y + shape.height / 2,
      // Store original block positions for L-shapes (will be updated as shape moves)
      originalBlocks: shape.blocks ? shape.blocks.map(b => ({...b})) : null
    }));
    
    const containerCenterX = this.containerWidth / 2;
    const containerCenterY = this.containerHeight / 2;
    
    // Physics constants - shapes float freely, not constrained to grid
    const repulsionStrength = 1.5; // Strong enough to break free from grid positions
    const centralPushStrength = 0.08; // Stronger central push to distribute shapes
    const minDistance = gapSize + 20; // Desired gap + buffer for consistent spacing
    const timeStep = 0.2; // Larger time step for faster movement
    
    // Run physics simulation
    for (let iter = 0; iter < iterations; iter++) {
      // Reset forces
      physicsShapes.forEach(shape => {
        shape.fx = 0;
        shape.fy = 0;
      });
      
      // Calculate repulsion forces between all pairs of shapes
      for (let i = 0; i < physicsShapes.length; i++) {
        const shapeA = physicsShapes[i];
        
        // Central push force (outward from center)
        const dxFromCenter = shapeA.centerX - containerCenterX;
        const dyFromCenter = shapeA.centerY - containerCenterY;
        const distFromCenter = Math.sqrt(dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter);
        if (distFromCenter > 0) {
          const pushForce = centralPushStrength * distFromCenter;
          shapeA.fx += (dxFromCenter / distFromCenter) * pushForce;
          shapeA.fy += (dyFromCenter / distFromCenter) * pushForce;
        }
        
        // Repulsion from other shapes
        for (let j = i + 1; j < physicsShapes.length; j++) {
          const shapeB = physicsShapes[j];
          
          // Calculate actual closest distance between shape boundaries
          const aLeft = shapeA.x;
          const aRight = shapeA.x + shapeA.width;
          const aTop = shapeA.y;
          const aBottom = shapeA.y + shapeA.height;
          
          const bLeft = shapeB.x;
          const bRight = shapeB.x + shapeB.width;
          const bTop = shapeB.y;
          const bBottom = shapeB.y + shapeB.height;
          
          // Calculate overlap or gap
          const overlapX = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));
          const overlapY = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop));
          
          let distance, dx, dy;
          
          if (overlapX > 0 && overlapY > 0) {
            // Shapes overlap - strong repulsion
            distance = -Math.min(overlapX, overlapY);
            dx = shapeB.centerX - shapeA.centerX;
            dy = shapeB.centerY - shapeA.centerY;
            const centerDist = Math.sqrt(dx * dx + dy * dy);
            if (centerDist > 0) {
              dx = dx / centerDist;
              dy = dy / centerDist;
            } else {
              dx = 1; dy = 0; // Default direction if centers coincide
            }
          } else {
            // Shapes don't overlap - calculate closest edge distance
            const gapX = overlapX > 0 ? 0 : (aRight < bLeft ? bLeft - aRight : aLeft - bRight);
            const gapY = overlapY > 0 ? 0 : (aBottom < bTop ? bTop - aBottom : aTop - bBottom);
            distance = Math.sqrt(gapX * gapX + gapY * gapY);
            
            // Direction from A to B
            dx = shapeB.centerX - shapeA.centerX;
            dy = shapeB.centerY - shapeA.centerY;
            const centerDist = Math.sqrt(dx * dx + dy * dy);
            if (centerDist > 0) {
              dx = dx / centerDist;
              dy = dy / centerDist;
            } else {
              dx = 1; dy = 0;
            }
          }
          
          // Apply repulsion force based on desired gap
          const desiredGap = gapSize;
          const forceMagnitude = distance < desiredGap 
            ? repulsionStrength * (desiredGap - distance) * 2 // Strong repulsion when too close
            : 0; // No force when gap is adequate
          
          if (forceMagnitude > 0 || distance < 0) {
            const fx = dx * forceMagnitude;
            const fy = dy * forceMagnitude;
            
            // Apply equal and opposite forces
            shapeA.fx -= fx;
            shapeA.fy -= fy;
            shapeB.fx += fx;
            shapeB.fy += fy;
          }
        }
      }
      
      // Update velocities and positions with collision detection
      physicsShapes.forEach((shape, idx) => {
        // Store original position for block updates
        const originalX = shape.x;
        const originalY = shape.y;
        
        // Update velocity with damping
        shape.vx = (shape.vx + shape.fx * timeStep) * damping;
        shape.vy = (shape.vy + shape.fy * timeStep) * damping;
        
        // Limit velocity to prevent overshooting
        const maxVelocity = 5;
        shape.vx = Math.max(-maxVelocity, Math.min(maxVelocity, shape.vx));
        shape.vy = Math.max(-maxVelocity, Math.min(maxVelocity, shape.vy));
        
        // Update position
        const newCenterX = shape.centerX + shape.vx * timeStep;
        const newCenterY = shape.centerY + shape.vy * timeStep;
        
        // Calculate new shape position (maintain shape dimensions)
        let newX = newCenterX - shape.width / 2;
        let newY = newCenterY - shape.height / 2;
        
        // Check for collisions with other shapes
        let hasCollision = false;
        for (let j = 0; j < physicsShapes.length; j++) {
          if (j === idx) continue;
          const otherShape = physicsShapes[j];
          
          const newRight = newX + shape.width;
          const newBottom = newY + shape.height;
          const otherRight = otherShape.x + otherShape.width;
          const otherBottom = otherShape.y + otherShape.height;
          
          // Check for overlap
          if (newX < otherRight && newRight > otherShape.x &&
              newY < otherBottom && newBottom > otherShape.y) {
            hasCollision = true;
            break;
          }
        }
        
        // If collision detected, allow gradual separation (shapes can float freely)
        if (hasCollision) {
          // Reduce velocity but allow some movement for gradual separation
          shape.vx *= 0.4;
          shape.vy *= 0.4;
          // Allow small movement to help shapes separate
          newX = originalX + shape.vx * timeStep * 0.5;
          newY = originalY + shape.vy * timeStep * 0.5;
        }
        
        // Boundary constraints (keep shapes within container or allow slight overflow for straddling)
        const margin = 50; // Allow some overflow for shapes that can straddle
        const clampedX = Math.max(-margin, Math.min(this.containerWidth - shape.width + margin, newX));
        const clampedY = Math.max(-margin, Math.min(this.containerHeight - shape.height + margin, newY));
        
        // Calculate movement delta
        const dx = clampedX - originalX;
        const dy = clampedY - originalY;
        
        shape.x = clampedX;
        shape.y = clampedY;
        shape.centerX = clampedX + shape.width / 2;
        shape.centerY = clampedY + shape.height / 2;
        
        // Update block positions for L-shapes (maintain relative positions as shape floats)
        if (!shape.isRectangular && shape.blocks && shape.originalBlocks) {
          shape.blocks.forEach((block, blockIdx) => {
            // Maintain relative position from shape origin
            const relX = shape.originalBlocks[blockIdx].x - (shape.originalBlocks[0]?.x || 0);
            const relY = shape.originalBlocks[blockIdx].y - (shape.originalBlocks[0]?.y || 0);
            // Update block position relative to new shape position
            block.x = shape.x + relX;
            block.y = shape.y + relY;
          });
        }
      });
    }
    
    // Return updated shapes
    return physicsShapes.map(shape => {
      const { vx, vy, fx, fy, centerX, centerY, ...shapeData } = shape;
      return shapeData;
    });
  }
  
  // Check if container has empty space - optimized grid-based approach
  hasEmptySpace(shapes, containerLeft, containerTop, containerRight, containerBottom, cellWidth, cellHeight, gridOriginX, gridOriginY) {
    // Use a coarser grid for faster checking - still accurate enough
    const gridCols = Math.ceil((containerRight - containerLeft) / cellWidth);
    const gridRows = Math.ceil((containerBottom - containerTop) / cellHeight);
    
    // Create a coverage grid (much faster than point sampling)
    const covered = new Set();
    
    // Mark grid cells covered by shape blocks
    shapes.forEach(shape => {
      shape.blocks.forEach(block => {
        // Calculate which grid cells this block covers
        const blockLeft = block.x;
        const blockRight = block.x + block.width;
        const blockTop = block.y;
        const blockBottom = block.y + block.height;
        
        // Find grid cell range
        const startCol = Math.max(0, Math.floor((blockLeft - containerLeft) / cellWidth));
        const endCol = Math.min(gridCols - 1, Math.floor((blockRight - containerLeft) / cellWidth));
        const startRow = Math.max(0, Math.floor((blockTop - containerTop) / cellHeight));
        const endRow = Math.min(gridRows - 1, Math.floor((blockBottom - containerTop) / cellHeight));
        
        // Mark all covered cells
        for (let row = startRow; row <= endRow; row++) {
          for (let col = startCol; col <= endCol; col++) {
            covered.add(`${row},${col}`);
          }
        }
      });
    });
    
    const totalCells = gridCols * gridRows;
    const coveredCount = covered.size;
    
    // Check bottom edge (last 2 rows)
    const bottomEdgeCells = new Set();
    for (let row = Math.max(0, gridRows - 2); row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        if (covered.has(`${row},${col}`)) {
          bottomEdgeCells.add(`${row},${col}`);
        }
      }
    }
    const bottomEdgeCoverage = bottomEdgeCells.size / (gridCols * Math.min(2, gridRows));
    
    // Check right edge (last 2 columns)
    const rightEdgeCells = new Set();
    for (let col = Math.max(0, gridCols - 2); col < gridCols; col++) {
      for (let row = 0; row < gridRows; row++) {
        if (covered.has(`${row},${col}`)) {
          rightEdgeCells.add(`${row},${col}`);
        }
      }
    }
    const rightEdgeCoverage = rightEdgeCells.size / (gridRows * Math.min(2, gridCols));
    
    // Check overall coverage
    const overallCoverage = coveredCount / totalCells;
    
    // Return true if ANY area has gaps (no deficits allowed)
    // Use 99% threshold to account for edge cases and floating point precision
    return overallCoverage < 0.99 || bottomEdgeCoverage < 0.95 || rightEdgeCoverage < 0.95;
  }
  
  // Get metrics for display
  getMetrics(containerWidth, containerHeight) {
    return {
      containerSize: `${Math.round(containerWidth)}×${Math.round(containerHeight)}`,
      baseGrid: `${this.baseCols}×${this.baseRows}`,
      cellSize: `${Math.round(this.baseCellWidth)}×${Math.round(this.baseCellHeight)}`,
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
    
    // Mask layer - darkens area outside container
    this.maskLayer = new Konva.Layer();
    this.stage.add(this.maskLayer);
    
    // Debug layer for grid visualization (optional)
    this.debugLayer = new Konva.Layer({ visible: false });
    this.stage.add(this.debugLayer);
    
    // Dot grid layer - added last so it renders on top
    this.dotGridLayer = new Konva.Layer({ visible: false });
    this.stage.add(this.dotGridLayer);
    
    // Squares layer - renders squares that connect grid dots
    this.squaresLayer = new Konva.Layer({ visible: true });
    this.stage.add(this.squaresLayer);
    
    this.dotGridScale = 1.0;
    this.gapSpacing = 0;
    this.currentGrid = null;
    this.currentSquares = [];
    
    this.updateMask();
  }
  
  updateContainerPosition() {
    // Calculate container position (centered, 75vw x 75vh)
    this.containerX = (window.innerWidth - this.containerWidth) / 2;
    this.containerY = (window.innerHeight - this.containerHeight) / 2;
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
    
    // Also render squares
    this.renderSquares(grid);
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
    // Only update if user is not actively interacting with slider
    if (typeof isUserInteractingWithSlider !== 'undefined' && isUserInteractingWithSlider) {
      return; // Don't update if user is dragging
    }
    
    this.dotGridScale = scale;
    if (this.dotGridLayer.visible() && this.currentGrid) {
      this.updateDotGrid();
    }
    // Regenerate and render squares when scale changes
    if (this.currentGrid) {
      // Use requestAnimationFrame to allow UI to update
      requestAnimationFrame(() => {
        this.renderSquares(this.currentGrid);
      });
    }
  }
  
  renderSquares(grid, shapes = null) {
    // Generate Bento shapes if not provided (for regeneration)
    // If shapes are provided, just re-render them (for gap changes)
    if (shapes === null) {
      shapes = grid.generateSquares(this.dotGridScale);
      
      // Apply physics-based gap adjustment if gap spacing is set
      // Shapes float freely after initial grid placement
      if (this.gapSpacing > 0) {
        shapes = grid.adjustGapsWithPhysics(shapes, this.gapSpacing, 80, 0.92); // More iterations, less damping for free floating
      }
      
      this.currentSquares = shapes;
    }
    
    // Clear existing shapes
    this.squaresLayer.destroyChildren();
    
    // Color palette (avoiding red-ish hues)
    const palette = [
      '#22d3ee', '#38bdf8', '#60a5fa', '#3b82f6', '#2563eb',
      '#34d399', '#10b981', '#14b8a6', '#06b6d4', '#0891b2',
      '#0ea5e9', '#0284c7', '#0d9488', '#059669', '#2dd4bf', '#5eead4'
    ];
    
    // Render Bento shapes (rectangles and L-shapes)
    shapes.forEach((shape, shapeIndex) => {
      const shapeColor = palette[shapeIndex % palette.length];
      
      // Determine if shape is fully inside or straddling
      const shapeRight = shape.x + shape.width;
      const shapeBottom = shape.y + shape.height;
      const isFullyInside = shape.x >= 0 && shapeRight <= this.containerWidth &&
                           shape.y >= 0 && shapeBottom <= this.containerHeight;
      
      // Use different opacity for inside vs straddling
      const opacity = isFullyInside ? 0.85 : 0.6;
      
      // Apply gap spacing to the entire shape (not individual blocks)
      // Shapes are independent elements, gaps go between shapes, not within shapes
      const gap = this.gapSpacing;
      const shapeOffsetX = gap / 2;
      const shapeOffsetY = gap / 2;
      const shapeWidthReduction = gap;
      const shapeHeightReduction = gap;
      
      // Render rectangular shapes as a single rect
      if (shape.isRectangular) {
        const x = shape.x + this.containerX + shapeOffsetX;
        const y = shape.y + this.containerY + shapeOffsetY;
        
        const rect = new Konva.Rect({
          x: x,
          y: y,
          width: shape.width - shapeWidthReduction,
          height: shape.height - shapeHeightReduction,
          fill: shapeColor,
          opacity: opacity,
          cornerRadius: 4,
          stroke: 'white',
          strokeWidth: 2,
          strokeAlign: 'inside',
          shadowBlur: 4,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          shadowOffset: { x: 1, y: 1 },
          listening: false,
        });
        
        this.squaresLayer.add(rect);
      } else {
        // Render L-shapes: blocks stay together as one unit, gap applied to outer perimeter only
        // Calculate the shape's bounding box
        const minBlockX = Math.min(...shape.blocks.map(b => b.x));
        const minBlockY = Math.min(...shape.blocks.map(b => b.y));
        const maxBlockX = Math.max(...shape.blocks.map(b => b.x + b.width));
        const maxBlockY = Math.max(...shape.blocks.map(b => b.y + b.height));
        
        const originalWidth = maxBlockX - minBlockX;
        const originalHeight = maxBlockY - minBlockY;
        
        // Apply gap to the entire shape bounding box (not individual blocks)
        const shapeX = minBlockX + this.containerX + shapeOffsetX;
        const shapeY = minBlockY + this.containerY + shapeOffsetY;
        const shapeWidth = originalWidth - shapeWidthReduction;
        const shapeHeight = originalHeight - shapeHeightReduction;
        
        // Scale factors to shrink the entire shape uniformly
        const scaleX = shapeWidth / originalWidth;
        const scaleY = shapeHeight / originalHeight;
        
        // Render each block, scaled uniformly to maintain shape structure
        shape.blocks.forEach((block) => {
          // Calculate block position relative to shape origin
          const relX = block.x - minBlockX;
          const relY = block.y - minBlockY;
          
          // Apply uniform scaling to maintain block relationships
          const x = shapeX + relX * scaleX;
          const y = shapeY + relY * scaleY;
          const width = block.width * scaleX;
          const height = block.height * scaleY;
          
          const rect = new Konva.Rect({
            x: x,
            y: y,
            width: width,
            height: height,
            fill: shapeColor,
            opacity: opacity,
            cornerRadius: 2,
            shadowBlur: 4,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            shadowOffset: { x: 1, y: 1 },
            listening: false,
          });
          
          this.squaresLayer.add(rect);
        });
        
        // Add outline around the entire L-shape - trace the actual perimeter
        // Draw outline by checking which edges are on the perimeter
        shape.blocks.forEach((block) => {
          const relX = block.x - minBlockX;
          const relY = block.y - minBlockY;
          // Apply same scaling as blocks
          const blockX = shapeX + relX * scaleX;
          const blockY = shapeY + relY * scaleY;
          const blockW = block.width * scaleX;
          const blockH = block.height * scaleY;
          
          // Check which edges are on the perimeter by checking if adjacent blocks exist
          const checkBlock = (dx, dy) => {
            const checkX = block.x + dx * block.width;
            const checkY = block.y + dy * block.height;
            return shape.blocks.some(b => 
              Math.abs(b.x - checkX) < 1 && Math.abs(b.y - checkY) < 1
            );
          };
          
          // Draw only perimeter edges with inner stroke
          // Offset by half stroke width to make it inner
          const strokeOffset = 1; // Half of strokeWidth (2)
          
          if (!checkBlock(0, -1)) { // Top edge
            const line = new Konva.Line({
              points: [blockX + strokeOffset, blockY + strokeOffset, blockX + blockW - strokeOffset, blockY + strokeOffset],
              stroke: 'white',
              strokeWidth: 2,
              lineCap: 'round',
              listening: false,
            });
            this.squaresLayer.add(line);
          }
          if (!checkBlock(1, 0)) { // Right edge
            const line = new Konva.Line({
              points: [blockX + blockW - strokeOffset, blockY + strokeOffset, blockX + blockW - strokeOffset, blockY + blockH - strokeOffset],
              stroke: 'white',
              strokeWidth: 2,
              lineCap: 'round',
              listening: false,
            });
            this.squaresLayer.add(line);
          }
          if (!checkBlock(0, 1)) { // Bottom edge
            const line = new Konva.Line({
              points: [blockX + blockW - strokeOffset, blockY + blockH - strokeOffset, blockX + strokeOffset, blockY + blockH - strokeOffset],
              stroke: 'white',
              strokeWidth: 2,
              lineCap: 'round',
              listening: false,
            });
            this.squaresLayer.add(line);
          }
          if (!checkBlock(-1, 0)) { // Left edge
            const line = new Konva.Line({
              points: [blockX + strokeOffset, blockY + blockH - strokeOffset, blockX + strokeOffset, blockY + strokeOffset],
              stroke: 'white',
              strokeWidth: 2,
              lineCap: 'round',
              listening: false,
            });
            this.squaresLayer.add(line);
          }
        });
      }
    });
    
    this.squaresLayer.draw();
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
    // Regenerate squares if grid exists
    if (this.currentGrid) {
      this.renderSquares(this.currentGrid);
    }
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
  // Don't interfere with slider if user is interacting
  if (typeof isUserInteractingWithSlider !== 'undefined' && isUserInteractingWithSlider) {
    return;
  }
  
  const { width, height } = getContainerSize();
  grid = new ElasticBentoGrid(width, height);
  renderer.renderGrid(grid);
  renderer.renderDotGrid(grid);
  updateMetrics();
}

function updateMetrics() {
  // Don't update metrics if user is interacting with slider
  if (typeof isUserInteractingWithSlider !== 'undefined' && isUserInteractingWithSlider) {
    return;
  }
  
  const { width, height } = getContainerSize();
  const metrics = grid.getMetrics(width, height);
  const metricsEl = document.getElementById('metrics');
  metricsEl.innerHTML = `
    <div>Container</div><div>${metrics.containerSize}</div>
    <div>Base Grid</div><div>${metrics.baseGrid} cells</div>
    <div>Cell Size</div><div>${metrics.cellSize}</div>
    <div>Grid Area</div><div>${metrics.gridArea}</div>
  `;
}

// Handle resize - but don't interfere with slider interaction
let resizeTimeout;
window.addEventListener('resize', () => {
  // Don't resize if user is actively interacting with slider
  if (typeof isUserInteractingWithSlider !== 'undefined' && isUserInteractingWithSlider) {
    return;
  }
  
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const { width, height } = getContainerSize();
    grid = new ElasticBentoGrid(width, height);
    renderer.resize(width, height);
    renderer.renderGrid(grid);
    renderer.renderDotGrid(grid);
    updateMetrics();
  }, 150);
});

// Regenerate button with loading indicator
document.getElementById('regen').addEventListener('click', () => {
  loadingIndicator.style.visibility = 'visible';
  // Use setTimeout to allow UI to update before heavy computation
  setTimeout(() => {
    generate();
    loadingIndicator.style.visibility = 'hidden';
  }, 10);
});

// Toggle dot grid button
document.getElementById('toggleDotGrid').addEventListener('click', () => {
  const isVisible = renderer.toggleDotGrid();
  document.getElementById('toggleDotGrid').textContent = isVisible ? 'Hide Dot Grid' : 'Show Dot Grid';
});

// Dot grid scale slider with debouncing and isolation
const dotGridScaleSlider = document.getElementById('dotGridScale');
const dotGridScaleValue = document.getElementById('dotGridScaleValue');
const loadingIndicator = document.getElementById('loadingIndicator');

let scaleUpdateTimeout = null;
let isUserInteractingWithSlider = false; // Track user interaction

// Prevent any programmatic updates while user is interacting
dotGridScaleSlider.addEventListener('mousedown', () => {
  isUserInteractingWithSlider = true;
});

dotGridScaleSlider.addEventListener('touchstart', () => {
  isUserInteractingWithSlider = true;
});

dotGridScaleSlider.addEventListener('input', (e) => {
  // Stop event propagation to prevent any canvas interference
  e.stopPropagation();
  
  const scale = parseFloat(e.target.value);
  dotGridScaleValue.textContent = scale.toFixed(1);
  
  // Show loading indicator using visibility (doesn't affect layout)
  loadingIndicator.style.visibility = 'visible';
  
  // Clear previous timeout
  if (scaleUpdateTimeout) {
    clearTimeout(scaleUpdateTimeout);
  }
  
  // Debounce: wait 300ms after user stops sliding before regenerating
  scaleUpdateTimeout = setTimeout(() => {
    renderer.setDotGridScale(scale);
    loadingIndicator.style.visibility = 'hidden';
  }, 300);
});

// Reset interaction flag when user releases
dotGridScaleSlider.addEventListener('mouseup', () => {
  isUserInteractingWithSlider = false;
});

dotGridScaleSlider.addEventListener('touchend', () => {
  isUserInteractingWithSlider = false;
});

// Also reset on mouse leave (in case user drags outside)
dotGridScaleSlider.addEventListener('mouseleave', () => {
  isUserInteractingWithSlider = false;
});

// Gap spacing slider
const gapSpacingSlider = document.getElementById('gapSpacing');
const gapSpacingValue = document.getElementById('gapSpacingValue');

let gapUpdateTimeout = null;
let lastGapValue = -1; // Initialize to -1 to force first regeneration

gapSpacingSlider.addEventListener('input', (e) => {
  e.stopPropagation();
  
  const gap = parseFloat(e.target.value);
  gapSpacingValue.textContent = gap.toFixed(1);
  
  // Clear previous timeout
  if (gapUpdateTimeout) {
    clearTimeout(gapUpdateTimeout);
  }
  
  // Debounce physics simulation (it's computationally intensive)
  gapUpdateTimeout = setTimeout(() => {
    if (renderer && renderer.currentGrid) {
      // Always regenerate when gap value changes (increases or decreases)
      // This ensures physics is applied correctly for any gap value
      if (Math.abs(gap - lastGapValue) > 0.05) { // Regenerate if gap changed by more than 0.05
        renderer.gapSpacing = gap;
        renderer.renderSquares(renderer.currentGrid);
        lastGapValue = gap;
      }
    }
  }, 200);
});

// Toggle debug view (optional)
document.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') {
    renderer.toggleDebug();
  }
});

// Initialize
init();
