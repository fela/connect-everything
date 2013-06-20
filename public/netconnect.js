(function(){

var canvas = document.getElementById('gamecanvas');
var context = canvas.getContext('2d');



HSLtoRGB = function (hsl) {
    // in JS 1.7 use: var [h, s, l] = hsl;
    var h = hsl[0],
        s = hsl[1],
        l = hsl[2],

    r, g, b,

    hue2rgb = function (p, q, t){
        if (t < 0) {
            t += 1;
        }
        if (t > 1) {
            t -= 1;
        }
        if (t < 1/6) {
            return p + (q - p) * 6 * t;
        }
        if (t < 1/2) {
            return q;
        }
        if (t < 2/3) {
            return p + (q - p) * (2/3 - t) * 6;
        }
        return p;
    };

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        var
        q = l < 0.5 ? l * (1 + s) : l + s - l * s,
        p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    var res = [r * 0xFF, g * 0xFF, b * 0xFF];

    return "rgb(" + [Math.floor(res[0]), Math.floor(res[1]), Math.floor(res[2])].join(",") + ")";
};

function arrays_equal(a,b) { return !(a<b || b<a); }

function postToUrl(path, params, method) {
    method = method || "post"; // Set method to post by default, if not specified.

    // The rest of this code assumes you are not using a library.
    // It can be made less wordy if you use one.
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);

    for(var key in params) {
        if(params.hasOwnProperty(key)) {
            var hiddenField = document.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", params[key]);

            form.appendChild(hiddenField);
         }
    }

    document.body.appendChild(form);
    form.submit();
}

function randomDirection() {
    return Math.floor(Math.random()*4);
}

// gets a random element from an array
Array.prototype.random = function() {
    return this[Math.floor(Math.random() * this.length)];
};


var game = {};
game.Border = 1/4; // as a proportion of one cell
game.context = context;
game.init = function() {
    
    canvas.onclick = function(evt) {
        var cellAndRotation = game.getCellAndRotation(evt);
        var cell = cellAndRotation.cell;
        var clockwise = cellAndRotation.clockwise;
        
        if (!cell) {
            return;
        }

        if (typeof game.lastCell === 'undefined') {
            game.lastCell = cell;
            game.oldDistance = cell.normalizeMoves(cell.originalPosition);
        }

        if (game.lastClicks.length > 0 && cell != game.lastClicks[0].cell) {
            game.lastClicks[0].cell.unsetMoved();
        }
        cell.setMoved();
        cell.animate(clockwise);
    };
    // disable selection that can get triggered on double mouse click
    canvas.onselectstart = function() {return false;};

    // called after the animation finishes
    this.handleNewClick = function(cellAndRotation) {
        game.moves--;
        var cell = cellAndRotation.cell;
        if (this.lastClicks.length > 0 && cell != this.lastClicks[0].cell) {
            var oldCell = this.lastClicks[0].cell;
            // TODO: maybe move up to before the animation starts?
            var newDistance = oldCell.normalizeMoves(oldCell.originalPosition);
            // equal is bad too, because the cell has moved (lastClicks.length > 0)
            if (newDistance >= this.oldDistance) {console.log('mistake!')}
            this.lastClicks = [];
        }
        if (cell != this.lastCell) {
            this.lastCell = cell;
            this.oldDistance = cell.normalizeMoves(cell.originalPosition);
        }
        this.lastClicks.push(cellAndRotation);
        
        this.mergeClicks();
    };
    
    this.mergeClicks = function() {
        var nClicks = this.lastClicks.length;
        if (nClicks == 0) return;
        var nMoves = 0;
        var i;
        for (i = 0; i < this.lastClicks.length; ++i) {
            if (this.lastClicks[i].clockwise) {
                nMoves++;
            } else {
                nMoves--;
            }
        }
        var clockwise = nMoves >= 0;
        if (nMoves == 3 || nMoves == -3) clockwise = !clockwise;
        
        var cell = this.lastClicks[0].cell;
        nMoves = cell.normalizeMoves(nMoves);

        if (nMoves == 0)
            cell.unsetMoved();
        else
            cell.setMoved();

        // recreate lastClicks
        this.lastClicks = [];
        for (i = 0; i < nMoves; ++i) {
            this.lastClicks.push({cell: cell, clockwise: clockwise})
        }
        // give back the moves that where counted but where undone
        var clicksTooMany = nClicks - nMoves;
        this.moves += clicksTooMany;
    };
    
    
    this.getCellAndRotation = function(event) {
        var pos = getMousePosition(canvas, event);
        var size = this.calculateSize(); // cellsize
        var x = pos.x-this.Border*size;
        var y = pos.y-this.Border*size;
        size = this.calculateSize(); // cellsize
        var row = Math.floor(y/size);
        var col = Math.floor(x/size);
        var cell = game.cellAt(row, col);
        
        var clockwise = Math.floor(x / (size/2))%2 == 1;
        return {cell:cell, clockwise:clockwise};
    };
    
    canvas.onmousemove = function(evt) {
        var cellAndRotation = game.getCellAndRotation(evt);
        var cell = cellAndRotation.cell;
        var clockwise = cellAndRotation.clockwise;
        if (!cell) {
            game.mouseout();
            return;
        }
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
    };
    
    canvas.onmouseout = function() {
        game.mouseout();
    };
    
    window.onkeydown = function() {
        var cell = game.mouseOverCell;
        if (cell) {
            cell.marked = !cell.marked;
            cell.draw(true);
        }
    };
    
    this.mouseout = function() {
        if (!game.mouseOverCell) {
            return;
        }
        
        game.mouseOverCell.hover = null;
        game.mouseOverCell.dirty = true;
        game.mouseOverCell = null;
        game.draw();
        console.log('mouseout');
    };
    
    this.updateGame = function() {
        var num = this.updateConnectedComponents();
        this.updateUnmatchedCables();
        this.draw();
        if (num === 1) {
            this.winGame();
        }
    };
    
    this.winGame = function() {
        var endTime = new Date().getTime();
        var diff = (endTime - this.startTime)/1000; // time in seconds
        var mins = Math.floor(diff / 60);
        var secs = Math.floor(diff % 60);
        var secsStr = '' + secs;
        if (secs < 10) {
            secsStr = '0' + secs;
        }
        var timeStamp = '' + mins + ':' + secsStr;
        var moves = -this.moves/2;
        var points = this.calculateScore(diff);
        //console.log(this.getDifficulty());
        //console.log('aaaaaaaaaaaaaaa');
        //alert('Congratulations, you won the game in ' + timeStamp + ' and with a move penalty of ' + (-this.moves/2) + '. Your score is '+this.calculateScore(diff)+'!');
        postToUrl('/gamewon', {difficulty: this.difficulty, time: timeStamp, moves: moves, points: points})
        //location.reload();
    };
    
    this.calculateScore = function(time) {
        var nCells = this.rows * this.cols;
        var difficultyScore = Math.pow(nCells, 2);
        
        var minutes = time / 60;
        var timeScore = 1 / Math.sqrt(minutes);
        
        var movePenalty = -this.moves/2;
        var moveScore = Math.pow(1/2, Math.pow(movePenalty, 0.6));
        
        // combine the the scores
        var multFactor = 1/2;
        var score = multFactor * difficultyScore * timeScore * moveScore;
        // the square root is to decrease unneded differences between low and high scores
        
        score = Math.sqrt(score)
        if (this.difficulty == 'hard') {
            score *= 1.3;
            score += 10;
        }
        return score;
    };
    
    this.updateConnectedComponents = function() {
        var num = this.connectedComponents();
        if (num == 1) {
            this.updateColors();
            return num;
        }
        
        // we create arrays where the key is the connected component and
        // for colors the values are lists of colors of the old elements
        // for
        
        // first index is conn comp
        // second index is color
        // value is num of preferences
        // (num of colored cells based on the base colors)
        var ccToPrefs = [];
        var i, cell, cc, color;
        for (i = 0; i < this.cells.length; ++i) {
            cell = this.cells[i];
            cc = cell.connectedComponent;
            color = i%4; // base color: 4 colors repeated
            // update ccToPrefs
            if (!ccToPrefs[cc]) {
                ccToPrefs[cc] = [0, 0, 0, 0];
            }
            ccToPrefs[cc][color] += 1;
        }
        
        var voteMultipliers = [1, 1, 1, 1];
        
        // calculate the "winner" for each connected component
        var ccToColor = []
        for (cc = 0; cc < ccToPrefs.length; ++cc) {
            if (!ccToPrefs[cc]) continue;
            ccToColor[cc] = -1;
            var maxVotes = 0;
            for (color = 0; color < ccToPrefs[cc].length; ++color) {
                var votes = ccToPrefs[cc][color]
                if (!votes) continue;
                if (votes*voteMultipliers[color] >= maxVotes) {
                    maxVotes = votes*voteMultipliers[color];
                    ccToColor[cc] = color;
                }
            }
            
            //voteMultipliers[ccToColor[cc]] *= 0.99;
        }
        
        // update colors
        for (i = 0; i < this.cells.length; ++i) {
            cell = this.cells[i];
            cell.connectedComponent = ccToColor[cell.connectedComponent];
        }
        
        this.updateColors();
        return num;
    };
    
    this.updateColors = function() {
        for (var i = 0; i < this.cells.length; ++i) {
            var cell = this.cells[i];
            if (cell.color != cell.connectedComponent) {
                cell.color = cell.connectedComponent;
                cell.dirty = true;
            }
        }
    };
    
    this.updateUnmatchedCables = function() {
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].updateUnmatchedCables();
        }
    };
    
    this.cellAt = function(row, col, wrapping) {
        if (wrapping) {
            row = (row+this.rows)%this.rows;
            col = (col+this.cols)%this.cols;
        }
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            return null;
        }
        var i = row * this.cols + col;
        return this.cells[i];
    };
    
    this.numOfCells = function() {
        return this.rows * this.cols;
    };
    
    this.draw = function(force) {
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].draw(force);
        }
    };

    this.loadGame = function() {
        var cells = serializedGame.cells.split(',');
        this.rows = serializedGame.rows;
        this.cols = serializedGame.cols;
        this.wrapping = serializedGame.wrapping;
        this.difficulty = 'easy'; // TODO remove
        var size = this.calculateSize();
        var i = 0;
        for (var r = 0; r < this.rows; ++r) {
            for (var c = 0; c < this.cols; ++c) {
                var e = new Cell(r, c, size, this, cells[i]);
                this.cells.push(e);
                ++i;
            }
        }
    };

    this.createGame = function() {
        // create empty cells
        this.cells = [];
        var size = this.calculateSize();
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
            //cell.dirty = true;
            //newCell.dirty = true;
            //cell.draw();
            //newCell.draw();
            
            emptyCells--;
        }
    };
    
    this.isGameOk = function() {
        var diff = this.getDifficulty();
        if (diff[diff.length-1] == 1) {
            return false; // unsolvable by easy methods
        }
        
        var expectedEfford = 0;
        var maximumDiff = 0;
        for (var i = 0; i < diff.length; ++i) {
            expectedEfford += Math.pow(diff[i], 5);
            if (diff[i] > maximumDiff) {
                maximumDiff = diff[i];
            }
        }
        
        expectedEfford /= diff.length;
        expectedEfford *= 100; // more readable value
        
        console.log(diff);
        console.log(expectedEfford);
        console.log(maximumDiff);
        
        var minVal;
        var maxVal;
        var nCells = this.rows * this.cols;
        if (this.difficulty == 'easiest') {
            // easy
            minVal = 1;
            maxVal = 5;
        } else if (this.difficulty == 'easy') {
            // medium
            minVal = 5;
            maxVal = 20;
        } else if (this.difficulty == 'medium'){
            // difficult
            minVal = 8;
            maxVal = 20;
        } else {
            minVal = 50;
            maxVal = 70;
        }
        if (expectedEfford > minVal && expectedEfford < maxVal) {
            return true;
        } else {
            return false;
        }
    };
    
    // there might be multiple solutions if the difficulty is equal to 1
    this.getDifficulty = function() {
        var difficulty = [];
        var unmarkedCells = this.rows * this.cols;
        
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].marked = false;
        }
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
                difficulty.push(1);
                break;
            }
            var newDifficulty = 1 - newlyMarked / prevUnmarkedCells;
            difficulty.push(newDifficulty);
        }
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].marked = false;
        }
        
        return difficulty;
    };
    
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
    };
    
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
            if (n && cableCell && cell.isEndPoint() && n.isEndPoint()){
                return false;
            }
        }
        return true;
    };
    
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
    };
    
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
    };
    
    this.shuffle = function() {
        this.moves = 0;
        for (var i = 0; i < this.cells.length; ++i) {
            var cell = this.cells[i];
            this.moves += cell.shuffle();
        }
        this.originalMoves = this.moves;
        this.updateMoves();
    };
    
    this.getRandomColor = function(num) {
        var oknums = [1, 12, 16   , 15];
        num = oknums[num % oknums.length];
        var golden_ratio_conjugate = 0.618033988749895;
        var init = 0.65;
        var h = (golden_ratio_conjugate*num) + init;
        h -= Math.floor(h);
        return HSLtoRGB([h, 0.99, 0.42]);
    };
    
    this.updateWidthAndHeight = function() {
        var width = $(window).width()-10; // TODO change
        var height = $(window).height()-50;
        if (width < height) {
            height = width;
        } else {
            width = height;
        }
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        this.width = width;
        this.height = height;
    };
    
    this.calculateSize = function() {
        return this.width / (this.cols+this.Border*2);
    };
    
    
    this.resize = function() {
        this.updateWidthAndHeight();
        var size = this.calculateSize();
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].size = size;
        }
        this.draw(true);
    };
    
    this.getTimeStamp = function() {
        var endTime = new Date().getTime();
        var diff = (endTime - this.startTime)/1000; // time in seconds
        var mins = Math.floor(diff / 60);
        var secs = Math.floor(diff % 60);
        var secsStr = '' + secs;
        if (secs < 10) {
            secsStr = '0' + secs;
        }
        var timeStamp = '' + mins + ':' + secsStr;
        return timeStamp
    };
    
    var _this = this;
    this.updateTimeDisplay = function() {
        time = document.getElementById('time');
        time.innerHTML = _this.getTimeStamp();
    };
    
    this.updateMoves = function() {
        time = document.getElementById('moves');
        time.innerHTML = (this.originalMoves-this.moves)+'/'+this.originalMoves;
        if (this.moves <= 3) {
            time.className = 'average'
        }
        if (this.moves <= 0) {
            time.className = 'bad'
        }
    };
    
    
    // TODO: where should I put this actually?
    this.colors = []
    this.color = function(num) {
        if (!this.colors[num]) {
            this.colors[num] = this.getRandomColor(num);
        }
        return this.colors[num];
    };
    
 
   
    this.updateWidthAndHeight();
    this.cells = [];
    this.lastClicks = [];
    this.startTime = new Date().getTime();
    setInterval(_this.updateTimeDisplay, 1000);
    this.loadGame();
    this.shuffle();
    this.updateGame();
    this.mouseOverCell = null;
    var game = this;
    $(document).ready($(window).resize(function(){game.resize()}));
    
};


///////////////////////////////////////////////////////////////////////////////
///////////////////////             Cell             //////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Represents a square


function Cell(row, col, size, game, binary) {
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
    this.size = size;
    this.background = 'black';
    this.moved = false;
    this.game = game;
    // wether there is a cable up right down and left, respectively
    this.Up = 0;
    this.Right = 1;
    this.Down = 2;
    this.Left = 3;
    this.cables = [false,false,false,false];
    this.originalPosition = 0;
    if (binary) {
        var cables = binary.split('')
        this.cables = binary.split('').map(function(val) {return val === '1'; });
    }
    this.unmatchedCables = [false, false, false, false];
    
    // for game creation
    // wether a new cable could be added up, right, down, left, respertively
    this.canAddCable = [true, true, true, true];
    if (this.row == 0 && !this.game.wrapping) {
        this.canAddCable[this.Up] = false;
    }

    if (this.col == 0 && !this.game.wrapping) {
        this.canAddCable[this.Left] = false;
    }

    if (this.row == game.rows-1 && !this.game.wrapping) {
        this.canAddCable[this.Down] = false;
    }

    if (this.col == game.cols-1 && !this.game.wrapping) {
        this.canAddCable[this.Right] = false;
    }
    
    this.x = function() {
        return this.size*(this.col+game.Border);
    };

    this.y = function() {
        return this.size*(this.row+game.Border);
    };

    this.setMoved = function() {
        this.moved = true;
        this.draw(true);
    };

    this.unsetMoved = function() {
        this.moved = false;
        this.draw(true);
    };
    
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
    };
    
    this.neighborsCannotConnect = function() {
        for (var dir = 0; dir < 4; ++dir) {
            if (this.neighbor(dir)) {
                var oppositeDir = (dir + 2) % 4;
                this.neighbor(dir).canAddCable[oppositeDir] = false;
            }
        }
    };
    
    // for game construction
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
    };
    
    this.numOfCables = function() {
        var num = 0;
        for (var i = 0; i < 4; ++i) {
            if (this.cables[i]) ++num;
        }
        return num;
    };
    
    this.isStraightCable = function() {
        return (!this.cables[0] && this.cables[1] && !this.cables[2] && this.cables[3]) ||
               (this.cables[0] && !this.cables[1] && this.cables[2] && !this.cables[3])
    };
    
    this.isEndPoint = function() {
        return this.numOfCables() == 1;
    };
    
    this.updateUnmatchedCables = function() {
        for (var dir = 0; dir < 4; ++dir) {
            var unmatchedCable = (this.cables[dir] && !this.hasOpposingCable(dir));
            if (unmatchedCable != this.unmatchedCables[dir]) {
                this.unmatchedCables[dir] = unmatchedCable;
                this.dirty = true;
            }
        }
    };
    
    this.hasOpposingCable = function(dir) {
        var neighbor = this.neighbor(dir);
        if (!neighbor) {
            // border
            return false;
        }
        var opposingDir = (dir + 2) % 4;
        return neighbor.cables[opposingDir];
    };
    
    
    this.context = game.context;
    this.dirty = true;
    this.color = 0;
    this.draw = function(force){
        if (this.dirty == false && !force) {
            return;
        }
        this.drawCell();
        
        if (this.game.wrapping) {
            var x = null;
            var y = null;
            if (this.row == 0) {
                this.drawCell(0, this.size*this.game.cols);
            }
            if (this.col == 0) {
                this.drawCell(this.size*this.game.rows, 0);
            }
            if (this.row == this.game.rows-1) {
                this.drawCell(0, -this.size*this.game.cols);
            }
            if (this.col == this.game.cols-1) {
                this.drawCell(-this.size*this.game.rows, 0);
            }
        }
        this.dirty = false;
    };
    
    this.drawCell = function(x, y) {
        if (!x) x = 0;
        if (!y) y = 0;
        var ctx = this.context;
        ctx.save();
        ctx.translate(x, y);
        ctx.save();
        ctx.translate(this.x(), this.y());
        if (this.isRotating) {
            this.drawAnimationBackground();
            for (var dir = 0; dir < 4; ++dir) {
                var n = this.neighbor(dir);
                if (n && !n.isRotating) {
                    ctx.restore();
                    n.draw(true);
                    ctx.save();
                    ctx.translate(this.x(), this.y());
                }
            }
            this.rotateCanvasMatrixAroundCenter(this.rotation);
        }
        this.drawBackground();
        this.drawCables();
        if (this.normalizeMoves(this.originalPosition) == 0)
            this.drawMoved();
        this.drawBorder();
        ctx.restore();
        ctx.restore();
        this.dirty = false;
        this.drawHover();
    };
    
    this.drawBackground = function() {
        var ctx = this.context;
        
        // draw contour and background
        ctx.strokeStyle = 'gray';
        if (this.marked) {
            ctx.fillStyle = 'rgb(100,100,100)';
        } else {
            ctx.fillStyle = this.background;
        }
        ctx.beginPath();
        ctx.rect(0, 0, this.size, this.size);
        ctx.closePath();
        ctx.fill();
    };

    this.drawMoved = function() {
        //if (!this.moved) return;
        var size = this.size;
        var b = size/20; // border
        var b2 = size-b;
        var s = size/5;  // size
        this.fillTriangle(b, b,  b+s, b,  b, b+s);
        this.fillTriangle(b, b2,  b+s, b2,  b, b2-s);
        this.fillTriangle(b2, b,  b2-s, b,  b2, b+s);
        this.fillTriangle(b2, b2,  b2-s, b2,  b2, b2-s);
    };

    this.fillTriangle = function(x1, y1, x2, y2, x3, y3) {
        var ctx = this.context;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fillStyle = 'rgb(50, 50, 50)';
        ctx.fill();
    };

    this.drawBorder = function() {
        var ctx = this.context;
        ctx.strokeStyle = 'gray';
        var lw = 1;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.rect(lw/2, lw/2, this.size-lw, this.size-lw);
        ctx.closePath();
        ctx.stroke();
    };
    
    this.drawAnimationBackground = function() {
        var ctx = this.context;
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.fillRect(-this.size/2, 0, 2*this.size, this.size);
            ctx.fillRect(0, -this.size/2, this.size, 2*this.size);
            ctx.closePath();
            ctx.fill();
        
    };
    
    this.drawHover = function() {
        if (this.hover === null || typeof this.hover === 'undefined') {
            return;
        }
        var ctx = this.context;
        
        var lineWidth = this.size/5; // works better if even
        var centerX = this.x() + this.size / 2;
        var centerY = this.y() + this.size / 2;
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
        ctx.arc(centerX, centerY, this.size/3, begin, end, false);
        ctx.stroke();
        
        // triangle
        var y1 = y2 = centerY;
        var y3 = centerY + lineWidth/2;
        var x3 = null;
        if (this.hover) {
            //clockwise
            x3 = centerX + this.size/3;
        } else {
            x3 = centerX - this.size/3;
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
    };
    
    this.drawCables = function() {
        for (var dir = 0; dir < 4; ++dir) {
            var unmatched = this.unmatchedCables[dir];
            if (this.cables[dir]) this.drawCable(dir, unmatched);
        }
        if (this.isEndPoint()) {
            this.drawEndPoint();
        }
    };
    
    this.drawEndPoint = function() {
        var ctx = this.context;
        ctx.fillStyle = this.game.color(this.color);
        ctx.beginPath();
        var centerX = this.size / 2;
        var centerY = this.size / 2;
        ctx.arc(centerX, centerY, this.size/5, 0, 2*Math.PI);
        ctx.closePath();
        ctx.fill();
    };
    
    this.drawCable = function(cable, unmatched) {
        var ctx = this.context;
        ctx.save();
        var times = cable;
        this.rotateCanvasMatrixAroundCenter(times*Math.PI/2.0);
        this.drawCableUp(unmatched);
        
        ctx.restore();
    };
    
    // draws upward cable
    // used as a base to draw cables in all directions
    this.drawCableUp = function(unmatched) {
        var lineWidth = this.size / 5;
        var centerX = this.size / 2;
        //var centerY = this.y() + this.size / 2;
        var ctx = this.context;
        ctx.lineWidth = lineWidth;
        ctx.fillStyle = this.game.color(this.color);
        ctx.beginPath();
        ctx.fillRect(centerX-lineWidth/2, 0, lineWidth, this.size/2+lineWidth/2);
        //ctx.moveTo(centerX, this.y);
        //ctx.lineTo(centerX, centerY+(lineWidth/2));
        ctx.closePath();
        ctx.fill();
        
        if (unmatched) {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.fillRect(centerX-lineWidth/2, 0, lineWidth, lineWidth/2);
            ctx.closePath();
            ctx.fill();
        }
    };
    
    this.drawCableWrappingUp = function(unmatched) {
        var lineWidth = this.size/5;
        var centerX = this.size / 2;
        ctx = this.context;
        ctx.fillStyle = this.game.color(this.color);
        ctx.beginPath();
        ctx.fillRect(centerX-lineWidth/2, this.y()-lineWidth, lineWidth, lineWidth);
        ctx.closePath();
        ctx.fill();
    };
    
    // helper function
    // rotates times times 90 degree
    this.rotateCanvasMatrixAroundCenter = function(rotation) {
        var ctx = this.context;
        var centerX = this.size / 2;
        var centerY = this.size / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);
    };
    
    this.rotateClockwise = function() {
        this.originalPosition = (this.originalPosition-1) % 4;
        var last = this.cables.pop();
        this.cables.unshift(last);
        this.dirty = true;
    };
    this.rotateCounterClockwise = function() {
        this.originalPosition = (this.originalPosition+1) % 4;
        var first = this.cables.shift();
        this.cables.push(first);
        this.dirty = true;
    };
    
    // radiants
    this.rotation = 0;
    this.endRotation = 0;
    this.speed = 0.7; // radiants/s
    this.fps = 50;
    this.framesLeft = 100;
    this.clicks = []; // boolean clockwise or not
    
    this.animate = function(clockwise) {
        this.isRotating = true;
        this.clicks.push(clockwise);
        var time = 0.3;
        
        // update rotations
        var diff = Math.PI/2;
        if (!clockwise) diff *= -1;
        this.endRotation += diff;
        
        var dist = this.endRotation - this.rotation;
        // speed in radiants/s 
        this.speed = dist/time;
        this.framesLeft = Math.floor(time * this.fps);
        clearInterval(this.animationInterval);
        this.startAnimation();
    };
    
    this.drawFrame = function() {
        this.updatePosition();
        this.draw(true);
        //this.rotateCanvasMatrixAroundCenter(this.rotation);
        //this.rotateCanvasMatrixAroundCenter(-this.rotation);
        this.framesLeft--;
        if (this.framesLeft <= 0) {
            this.stopAnimation();
        }
    };
    
    this.updatePosition = function() {
        this.rotation += this.speed/this.fps;
    };

    this.startAnimation = function() {
        var _this = this;
        this.animationInterval = setInterval(function(){_this.drawFrame()}, 1000/this.fps);
    };

    this.stopAnimation = function() {
        clearInterval(this.animationInterval);
        for (var i = 0; i < this.clicks.length; ++i) {
            var clockwise = this.clicks[i];
            game.handleNewClick({cell:this, clockwise:clockwise});
            if (clockwise) {
                this.rotateClockwise();
            } else {
                this.rotateCounterClockwise();
            }
        }
        this.clicks = [];
        this.rotation = 0;
        this.endRotation = 0;
        this.isRotating = false;
        game.updateMoves();
        game.updateGame();
        this.draw(true);
    };
    
    this.neighbor = function(direction) {
        var wrapping = this.game.wrapping
        switch (direction) {
            case this.Up:
                return this.game.cellAt(row-1, col, wrapping);
            case this.Left:
                return this.game.cellAt(row, col-1, wrapping);
            case this.Down:
                return this.game.cellAt(row+1, col, wrapping);
            case this.Right:
                return this.game.cellAt(row, col+1, wrapping);
            default:
                return null;
        }
    };
    
    this.shuffle = function() {
        var rotations = Math.floor(Math.random()*4);
        for (var i = 0; i < rotations; ++i) {
            this.rotateClockwise();
        }
        
        var moves = this.normalizeMoves(rotations);
        
        if (moves != 0) {
            this.dirty = true;
        }
        return moves;
    };
    
    // receives the number of rotations (optionally negative, max -4)
    // and returns the number of equivalent moves from 0 to 2
    // (the result is independent of the direction)
    this.normalizeMoves = function(moves) {
        moves = (moves + 4) % 4;
        if (moves == 3) moves = 1;
        var nCables = this.numOfCables();
        if (nCables == 0 || nCables == 4) moves = 0;
        if (this.isStraightCable()) moves %= 2;
        return moves;
    };
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

// browser update
var $buoop = {vs:{i:9,f:12,o:11,s:5,n:9}} 
$buoop.ol = window.onload; 
window.onload=function(){ 
 try {if ($buoop.ol) $buoop.ol();}catch (e) {} 
 var e = document.createElement("script"); 
 e.setAttribute("type", "text/javascript"); 
 e.setAttribute("src", "http://browser-update.org/update.js"); 
 document.body.appendChild(e); 
}

})();