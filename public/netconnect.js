var canvas = document.getElementById('gamecanvas');
var context = canvas.getContext('2d');

function get_random_color() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.round(Math.random() * 15)];
    }
    return color;
}

function randomDirection() {
    return Math.floor(Math.random()*4);
}

// gets a random element from an array
Array.prototype.random = function() {
    return this[Math.floor(Math.random() * this.length)];
}

var game = {};
game.context = context;
game.init = function() {
    
    canvas.onclick = function(evt) {
        var cellAndRotation = game.getCellAndRotation(evt);
        var cell = cellAndRotation.cell;
        var clockwise = cellAndRotation.clockwise;
        
        if (clockwise) {
            cell.rotateClockwise();
        } else {
            cell.rotateCounterClockwise();
        }
        game.updateGame();
    }
    
    this.getCellAndRotation = function(event) {
        var pos = getMousePosition(canvas, event);
        var x = pos.x;
        var y = pos.y;
        var row = Math.floor(y / (game.width/game.cols));
        var col = Math.floor(x / (game.width/game.rows));
        var cell = game.cellAt(row, col);
        
        var clockwise = Math.floor(x / (game.width/game.rows/2))%2 == 1;
        return {cell:cell, clockwise:clockwise};
    }
    
    canvas.onmousemove = function(evt) {
        var cellAndRotation = game.getCellAndRotation(evt);
        var cell = cellAndRotation.cell;
        var clockwise = cellAndRotation.clockwise;
        if (game.mouseOverCell != cell) {
            if (game.mouseOverCell) {
                game.mouseOverCell.hover = null;
                game.mouseOverCell.dirty = true;
            }
            game.mouseOverCell = cell;
        }
        var oldValue = cell.hover;
        if (oldValue !== clockwise) {
            cell.hover = clockwise;
            cell.dirty = true;
        }
        game.draw();
    }
    
    canvas.onmouseout = function() {
        if (!game.mouseOverCell) {
            return;
        }
        game.mouseOverCell.hover = null;
        game.mouseOverCell.dirty = true;
        game.mouseOverCell = null;
        game.draw();
    }
    
    this.updateGame = function() {
        var num = this.updateConnectedComponents();
        this.updateUnmatchedCables();
        this.draw();
        if (num === 1) {
            alert('Congratulations, you won the game!');
            location.reload();
        }
    }
    
    this.updateConnectedComponents = function() {
        var num = this.connectedComponents();
        for (var i = 0; i < this.cells.length; ++i) {
            var cell = this.cells[i];
            if (cell.color != cell.connectedComponent) {
                cell.color = cell.connectedComponent;
                cell.dirty = true;
            }
        }
        return num;
    }
    
    this.updateUnmatchedCables = function() {
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].updateUnmatchedCables();
        }
    }
    
    this.cellAt = function(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            return null;
        }
        var i = row * this.cols + col;
        return this.cells[i];
    }
    
    this.numOfCells = function() {
        return this.rows * this.cols;
    }
    
    this.draw = function(force) {
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].draw(force);
        }
    }
    
    this.createGame = function() {
        // create empty cells
        this.cells = [];
        var size = this.width / this.rows;
        for (var r = 0; r < this.rows; ++r) {
            for (var c = 0; c < this.cols; ++c) {
                var e = new Cell(r, c, size, this);
                this.cells.push(e);
            }
        }
        
        // cells to which cables can be added
        // empty cells are not present
        // (except for the first random empty position)
        // calls get added as soon as they get a cable
        var initialCell = this.cells.random();
        initialCell.neighborsCannotConnect();
        var incompleteCells = [initialCell];
        var emptyCells = this.rows * this.cols;
        while (emptyCells > 0 && incompleteCells.length > 0) {
            var cell = incompleteCells.random();
            var newCell = cell.addRandomCable();
            incompleteCells.push(newCell);
            // remove complete cells
            var newIncompleteCells = []
            for (var i = 0; i < incompleteCells.length; ++i) {
                if (!incompleteCells[i].isComplete()) {
                    newIncompleteCells.push(incompleteCells[i]);
                }
            }
            incompleteCells = newIncompleteCells;
            
            // debugging only
            cell.dirty = true;
            newCell.dirty = true;
            cell.draw();
            newCell.draw();
            
            emptyCells--;
        }
    }
    
    // there might be multiple solutions if the difficulty is equal to 1
    this.getDifficulty = function() {
        var difficulty = 0;
        var unmarkedCells = this.rows * this.cols;
        while (unmarkedCells > 0) {
            var prevUnmarkedCells = unmarkedCells;
            var toBeMarked = [];
            for (var i = 0; i < this.cells.length; ++i) {
                var cell = this.cells[i];
                if (cell.marked) {
                    continue; // already marked
                }
                if (this.isSolutionCell(cell)) {
                    toBeMarked.push(cell);
                    unmarkedCells--;
                }
            }
            
            for (var i = 0; i < toBeMarked.length; ++i) {
                toBeMarked[i].marked = true;
            }
            var newlyMarked = prevUnmarkedCells - unmarkedCells;
            if (newlyMarked == 0) {
                difficulty = 1;
                break;
            }
            var newDifficulty = 1 - newlyMarked / prevUnmarkedCells;
            if (newDifficulty > difficulty) {
                difficulty = newDifficulty;
            }
            this.draw(true);
            //alert(newlyMarked+' diff:'+newDifficulty);
        }
        for (var i in this.cells) {
            this.cells[i].marked = false;
        }
        return difficulty;
    }
    
    this.isSolutionCell = function(cell) {
        // try all rotations
        // for each try if it is possible by looking
        // at the marked neighbors and the border
        // if only one rotation (the current) is possible return true
        
        // it is assumed that the current rotation, if any, is the solution
        // so it will be anough to check all other rotations
        var solutions = []; // current rotation is a solution
        // check other rotations
        for (var rotation = 1; rotation < 4; ++rotation) {
            if (this.isSolutionCellRotated(cell, rotation)) {
                solutions.push(rotation);
            }
        }
        // check that all solutions are equivalent
        // return false if there is any that differs
        for (var i = 0; i < solutions.length; ++i) {
            var rotation = solutions[i];
            for (var dir = 0; dir < 4; ++dir) {
                rotatedDir = (dir - rotation + 4) % 4;
                if (cell.cables[dir] != cell.cables[rotatedDir]) {
                    return false;
                }
            }
        }
        return true;
    }
    
    // returns true if it could be a solution
    this.isSolutionCellRotated = function(cell, rotation) {
        for (var dir = 0; dir < 4; ++dir) {
            var rotatedDir = (dir - rotation + 4) % 4;
            // weather the rotated cell has a cable in the direction dir
            var cableCell = cell.cables[rotatedDir];
            var n = cell.neighbor(dir);
            
            if (n == null && cableCell == true) {
                // cable towards a border
                return false;
            }
            if (n && n.marked) {
                // weather the neighbor has a cable towards the cell
                var oppositeDir = (dir + 2) % 4;
                var cableNeighbor = n.cables[oppositeDir];
                if (cableNeighbor != cableCell) {
                    return false;
                }
            }
            // special case: two terminal cells cannot be connected
            if (n && cableCell && cell.isTerminal() && n.isTerminal()){
                return false;
            }
        }
        return true;
    }
    
    this.connectedComponents = function() {
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].connectedComponent = null;
        }
        var unmarkedCells = this.numOfCells();
        var connectedComponent = 0;
        while (unmarkedCells > 0) {
            connectedComponent++;
            // find first unmarked cell
            var cell = null;
            for (var i = 0; i < this.cells.length; ++i) {
                if (this.cells[i].connectedComponent === null) {
                    cell = this.cells[i];
                    break;
                }
            }
            var cc = this.connectedComponent(cell, connectedComponent);
            unmarkedCells -= cc.length;
        }
        return connectedComponent;
    }
    
    this.connectedComponent = function(cell, connectedComponent) {
        var cells = [cell];
        cell.connectedComponent = connectedComponent;
        for (var dir = 0; dir < 4; ++dir) {
            if (!cell.cables[dir]) {
                // no cable: do not continue search in this direction
                continue;
            }
            // there is a cable in the direction dir
            var neighbor = cell.neighbor(dir)
            if (!neighbor) {
                // border: do not continue search in this direction
                continue;
            }
            // there is a cable and a neighbor
            var oppositeDir = (dir + 2) % 4;
            if (!neighbor.cables[oppositeDir]) {
                // neighbor not connected:
                // do not continue search in this direction
                continue;
            }
            if (neighbor.connectedComponent) {
                // neigbor is already marked
                if (neighbor.connectedComponent != connectedComponent) {
                    // should never happen
                    alert('Error: two diffirent connected components are connected..!!');
                }
                continue;
            }
            // the neighbor is part of the connected component and unmarked:
            // recursive call
            var cc = this.connectedComponent(neighbor, connectedComponent);
            cells = cells.concat(cc);
        }
        return cells;
    }
    
    this.shuffle = function() {
        for (var i = 0; i < this.cells.length; ++i) {
            var cell = this.cells[i];
            cell.shuffle();
        }
    }
    
    // TODO: where should I put this actually?
    this.colors = []
    this.color = function(num) {
        if (!this.colors[num]) {
            this.colors[num] = get_random_color();
        }
        return this.colors[num];
    }
    
    this.width = 400;
    this.height = 400;
    this.rows = 5;
    this.cols = 5;
    this.cells = [];
    do {
        this.createGame();
    } while (this.getDifficulty() == 1);
    this.difficulty = this.getDifficulty();
    this.shuffle();
    this.updateGame();
    this.mouseOverCell = null;
}


///////////////////////////////////////////////////////////////////////////////
///////////////////////             Cell             //////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Represents a square


function Cell(row, col, size, game) {
    // testing function, returns mostly false but sometimes true
    this.maybe = function() {
        if (Math.random() > 0.2) {
            return false;
        }
        return true;
    };
    // default values, might be overridden
    this.row = row;
    this.col = col;
    this.x = size*col;
    this.y = size*row;
    this.width = size;
    this.height = size;
    //this.background = get_random_color();
    this.game = game;
    // wether there is a cable up right down and left, respectively
    this.Up = 0
    this.Right = 1
    this.Down = 2
    this.Left = 3
    this.cables = [false,false,false,false];
    this.unmatchedCables = [false, false, false, false];
    
    // for game creation
    // wether a new cable could be added up, right, down, left, respertively
    this.canAddCable = [true, true, true, true];
    if (this.row == 0) {
        this.canAddCable[this.Up] = false;
    }
    if (this.col == 0) {
        this.canAddCable[this.Left] = false;
    }
    if (this.row == game.rows-1) {
        this.canAddCable[this.Down] = false;
    }
    if (this.col == game.cols-1) {
        this.canAddCable[this.Right] = false;
    }
    
    this.addRandomCable = function() {
        var validDirection = false;
        var direction = null;
        if (this.isComplete()) {
            // error: if this gets displayed
            // something is wrong in the algorithm!
            alert('error: cannot add cable to complete cell!!!');
        }
        while (!validDirection) {
            direction = randomDirection();
            validDirection = this.canAddCable[direction];
        }
        this.cables[direction] = true;
        this.canAddCable[direction] = false;
        var oppositeDirection = (direction + 2) % 4;
        var n = this.neighbor(direction);
        n.cables[oppositeDirection] = true;
        n.canAddCable[oppositeDirection] = false;
        // to avoid loops avoid possibility to connect to the
        // newly connected cell
        n.neighborsCannotConnect();
        return n;
    }
    
    this.neighborsCannotConnect = function() {
        for (var dir = 0; dir < 4; ++dir) {
            if (this.neighbor(dir)) {
                var oppositeDir = (dir + 2) % 4;
                this.neighbor(dir).canAddCable[oppositeDir] = false;
            }
        }
    }
    this.isComplete = function() {
        return this.canAddCable[0] == false &&
               this.canAddCable[1] == false &&
               this.canAddCable[2] == false &&
               this.canAddCable[3] == false
        /*for (el in this.canAddCable) {
            if (el) {
                // can add a cable
                return false;
            }
        }
        // cannot add any cable
        return true;*/
    }
    
    this.updateUnmatchedCables = function() {
        for (var dir = 0; dir < 4; ++dir) {
            var unmatchedCable = (this.cables[dir] && !this.hasOpposingCable(dir));
            if (unmatchedCable != this.unmatchedCables[dir]) {
                this.unmatchedCables[dir] = unmatchedCable;
                this.dirty = true;
            }
        }
    }
    
    this.hasOpposingCable = function(dir) {
        var neighbor = this.neighbor(dir);
        if (!neighbor) {
            // border
            return false;
        }
        var opposingDir = (dir + 2) % 4;
        return neighbor.cables[opposingDir];
    }
    
    
    this.context = game.context;
    this.dirty = true;
    this.color = 0;
    this.draw = function(force){
        if (this.dirty == false && !force) {
            return;
        }
        this.drawBackground();
        this.drawCables();
        this.drawHover();
        this.dirty = false;
    }
    this.drawBackground = function() {
        ctx = this.context;
        
        // draw contour and background
        ctx.strokeStyle = 'gray';
        if (this.marked) {
            ctx.fillStyle = 'blue';
        } else {
            ctx.fillStyle = 'black';
        }
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    this.drawHover = function() {
        if (this.hover === null || typeof this.hover === 'undefined') {
            return;
        }
        
        
        var lineWidth = this.width/5; // works better if even
        var centerX = this.x + size / 2;
        var centerY = this.y + size / 2;
        ctx.lineWidth = lineWidth/2;
        ctx.strokeStyle = 'gray';
        ctx.beginPath();
        var begin = null;
        var end = null;
        if (this.hover) {
            // clockwise
            begin = Math.PI*1.5;
            end = Math.PI*2;
        } else {
            begin = Math.PI*1;
            end = Math.PI*1.5;
        }
        ctx.arc(centerX, centerY, size/3, begin, end, false);
        ctx.stroke();
        
        // triangle
        var y1 = y2 = centerY;
        var y3 = centerY + lineWidth/2;
        var x3 = null;
        if (this.hover) {
            //clockwise
            x3 = centerX + size/3;
        } else {
            x3 = centerX - size/3;
        }
        var x1 = x3 - lineWidth/2;
        var x2 = x3 + lineWidth/2;
        ctx.lineWidth = 0;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fillStyle = 'gray';
        ctx.fill();
    }
    
    this.drawCables = function() {
        for (var i = 0; i<4; ++i) {
            var unmatched = this.unmatchedCables[i];
            if (this.cables[i]) this.drawCable(i, unmatched);
        }
    }
    this.drawCable = function(cable, unmatched) {
        var ctx = this.context;
        ctx.save();
        var times = cable;
        this.rotateCanvasMatrixAroundCenter(times);
        this.drawCableUp(unmatched);
        ctx.restore();
    }
    
    // draws upward cable
    // used as a base to draw cables in all directions
    this.drawCableUp = function(unmatched) {
        var lineWidth = this.width/5; // works better if even
        var centerX = this.x + size / 2;
        var centerY = this.y + size / 2;
        ctx = this.context;
        ctx.lineWidth = lineWidth;
        ctx.fillStyle = this.game.color(this.color%2);
        ctx.beginPath();
        // move to top
        ctx.fillRect(centerX-lineWidth/2, this.y, lineWidth, size/2+lineWidth/2);
        //ctx.moveTo(centerX, this.y);
        //ctx.lineTo(centerX, centerY+(lineWidth/2));
        ctx.closePath();
        ctx.fill();
        
        if (unmatched) {
            ctx.fillStyle = 'white'
            ctx.beginPath();
            ctx.fillRect(centerX-lineWidth/2, this.y, lineWidth, lineWidth/2);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    // helper function
    // rotates times times 90 degree
    this.rotateCanvasMatrixAroundCenter = function(times) {
        var ctx = this.context;
        var rotation = times*Math.PI/2.0;
        var centerX = this.x + size / 2;
        var centerY = this.y + size / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);
    }
    
    this.rotateClockwise = function() {
        var last = this.cables.pop();
        this.cables.unshift(last);
        this.dirty = true;
    }
    this.rotateCounterClockwise = function() {
        var first = this.cables.shift();
        this.cables.push(first);
        this.dirty = true;
    }
    this.neighbor = function(direction) {
        switch (direction) {
            case this.Up:
                return this.game.cellAt(row-1, col);
            case this.Left:
                return this.game.cellAt(row, col-1);
            case this.Down:
                return this.game.cellAt(row+1, col);
            case this.Right:
                return this.game.cellAt(row, col+1);
            default:
                return null;
        }
    }
    this.isTerminal = function() {
        var numCables = 0;
        for (var i = 0; i < this.cables.length; ++i) {
            if (this.cables[i]) {
                numCables++;
            }
        }
        return numCables == 1;
    }
    this.shuffle = function() {
        var rotations = Math.floor(Math.random()*4);
        for (var i = 0; i < rotations; ++i) {
            this.rotateClockwise();
        }
        this.dirty = true;
    }
}


function getMousePosition(canvas, event) {
    var element = canvas;
    var offsetX = 0, offsetY = 0;

    if (element.offsetParent) {
      do {
        offsetX += element.offsetLeft;
        offsetY += element.offsetTop;
      } while ((element = element.offsetParent));
    }
    
    x = event.pageX - offsetX;
    y = event.pageY - offsetY;
    return {x:x,y:y};
}


game.init();