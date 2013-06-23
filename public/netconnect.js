(function(){

var canvas = document.getElementById('gamecanvas');
var context = canvas.getContext('2d');


// gets a random element from an array
Array.prototype.random = function() {
    return this[Math.floor(Math.random() * this.length)];
};


var game = {};
game.Border = 1/4; // as a proportion of one cell
game.context = context;
game.init = function() {
    
    canvas.onclick = function(evt) {
        if (!game.gameActive) {
            return;
        }
        var cellAndRotation = game.getCellAndRotation(evt);
        var cell = cellAndRotation.cell;
        var clockwise = cellAndRotation.clockwise;
        
        if (!cell) {
            return;
        }

        if (typeof game.lastCell === 'undefined') {
            game.lastCell = cell;
            game.oldDistance = cell.absNormalizeMoves(cell.originalPosition);
        }

        if (game.lastClicks.length > 0 && cell != game.lastClicks[0].cell) {
            game.lastClicks[0].cell.unsetMoved();
            game.updateScore();
        }
        cell.setMoved();
        cell.animate(clockwise);
    };
    // disable selection that can get triggered on double mouse click
    canvas.onselectstart = function() {return false;};

    // called after the animation finishes
    this.handleNewClick = function(cellAndRotation) {
        if (!game.gameActive) return;
        game.moves--;
        var cell = cellAndRotation.cell;
        if (this.lastClicks.length > 0 && cell != this.lastClicks[0].cell) {
            var oldCell = this.lastClicks[0].cell;
            // TODO: maybe move up to before the animation starts?
            var newDistance = oldCell.absNormalizeMoves(oldCell.originalPosition);
            // equal distance makes you lose too,
            // because the cell has moved (lastClicks.length > 0)
            // 0.5 added to make rounding problems are avoided
            if (newDistance+0.5 >= this.oldDistance) {

                game.disableGame();
                oldCell.reset(0.6);
                setTimeout(function() {game.gameOver()}, 2000);
            }
            this.lastClicks = [];
        }
        if (cell != this.lastCell) {
            this.lastCell = cell;
            this.oldDistance = cell.absNormalizeMoves(cell.originalPosition);
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
        nMoves = cell.absNormalizeMoves(nMoves);

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
        var size = this.cellSize; // cellsize
        var x = pos.x-this.Border*size;
        var y = pos.y-this.Border*size;
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
        if (!game.gameActive) return;
        game.mouseout();
    };
    
    window.onkeydown = function() {
        if (!game.gameActive) return;
        var cell = game.mouseOverCell;
        if (cell) {
            cell.marked = !cell.marked;
            cell.draw(true);
        }
    };
    
    this.mouseout = function() {
        if (!game.gameActive) return;
        if (!game.mouseOverCell) {
            return;
        }
        
        game.mouseOverCell.hover = null;
        game.mouseOverCell.dirty = true;
        game.mouseOverCell = null;
        game.draw();
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
        if (!game.gameActive) {return;} // don't win after the game over animation
        this.disableGame();
        this.level++;
        $('.level-num').text(this.level);
        this.loadGame();
    };

    this.gameOver = function() {
        game.disableGame();
        for (var i = 0; i < this.cells.length; ++i) {
             this.cells[i].reset(0.6);
        }

        var score = this.calculateScore();
        score = Math.round(score * 10)/10; // round to 1 digit
        var level = this.level;
        game.updateScore();
        setTimeout( function() {
            var dialog = $('#game-over');
            dialog.find('.points-number').text(score);
            dialog.find('.level-number').text(level);
            dialog.find('input[name=score]').val(score);
            dialog.find('input[name=level]').val(level);
            dialog.modal();
        }, 1000);
    };

    this.disableGame = function() {
        this.gameActive = false;
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
        var ccToColor = [];
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


        // load new game data
        $.ajax({
            dataType: "json",
            url: '/level',
            data: {level: this.level},
            success: function(response) {
                game.finishLoadingGame(response)
            },
            error: function() {
                game.gameOver();
            }
        });
    };

    this.finishLoadingGame = function(serializedGame) {
        var i;
        if (this.cells) {
            for (i = 0; i < this.cells.length; ++i) {
                this.cells[i].destroy();
            }
        }
        // initializations
        this.cells = [];
        this.lastClicks = [];
        var cells = serializedGame.cells.split(',');
        this.rows = serializedGame.rows;
        this.cols = serializedGame.cols;
        this.wrapping = serializedGame.wrapping;
        this.difficulty = 'easy'; // TODO remove
        this.endTime = new Date().getTime() + serializedGame.time*1000;
        this.gameActive = true;
        this.updateTimeDisplay();
        var size = 1;
        i = 0;
        for (var r = 0; r < this.rows; ++r) {
            for (var c = 0; c < this.cols; ++c) {
                var e = new Cell(r, c, size, this, cells[i]);
                this.cells.push(e);
                ++i;
            }
        }


        this.shuffle();
        this.updateGame();
        this.mouseOverCell = null;
        this.resize();
        this.updateScore();
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
        var i, cell;
        var unmarkedCells = this.numOfCells();
        for (i = 0; i < this.cells.length; ++i) {
            cell = this.cells[i]
            cell.connectedComponent = null;
            if (cell.numOfCables() == 0) {
                cell.connectedComponent = 1; // assign arbitrary color
                unmarkedCells--;
            }
        }
        var connectedComponent = 0;
        while (unmarkedCells > 0) {
            connectedComponent++;
            // find first unmarked cell
            cell = null;
            for (i = 0; i < this.cells.length; ++i) {
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
    };
    
    this.updateWidthAndHeight = function() {
        var width = $(window).width()-200;
        var height = $(window).height()-50;
        this.canvasSize = Math.min(width, height);
        this.width = width;
        this.height = height;
        var max_width = this.width / (this.cols+this.Border*2);
        var max_height = this.height / (this.rows+this.Border*2);
        var cellSize =  Math.min(max_width, max_height);

        canvas.setAttribute('width', cellSize *(this.cols+this.Border*2));
        canvas.setAttribute('height', cellSize *(this.rows+this.Border*2));
        this.cellSize = cellSize;
        return cellSize;
    };
    
    
    this.resize = function() {
        size = this.updateWidthAndHeight();
        for (var i = 0; i < this.cells.length; ++i) {
            this.cells[i].size = size;
        }
        this.draw(true);
    };
    
    this.getTimeStamp = function() {
        var nowTime = new Date().getTime();
        var diff = (this.endTime - nowTime)/1000; // time in seconds
        var mins = Math.floor(diff / 60);
        var secs = Math.floor(diff % 60);
        var secsStr = '' + secs;
        if (secs < 10) {
            secsStr = '0' + secs;
        }
        var timeStamp = '' + mins + ':' + secsStr;
        return timeStamp;
    };
    
    var _this = this;
    this.updateTimeDisplay = function() {
        if (!game.gameActive) return;

        if (new Date().getTime() >=  game.endTime) {
            // game over handling and animation
            game.disableGame();
            $('#time').animate( {
                    backgroundColor: 'red'
                },
                {
                duration: 2000,
                easing: 'easeOutBounce',
                complete: function() {
                    game.gameOver();
                }
            });
        } else {
            // default behaviour
            $('#time').text(_this.getTimeStamp());
        }
    };

    this.updateScore = function() {
        var score = Math.round(this.calculateScore()*10)/10;
        $('#score').text(score);
    };

    this.calculateScore = function() {
        var score = 5 * (this.level-1);
        var movesDone = (this.originalMoves-this.moves)-this.lastClicks.length;
        score += 5 * movesDone / this.originalMoves;
        return score;
    };


    this.colors = ["rgb(84,213,1)",
                   "rgb(213,85,1)",
                   "rgb(1,164,213)",
                   "rgb(213,1,102)"];



    // first time initializations
    this.level = 1;
    this.loadGame();
    $(document).ready($(window).resize(function(){game.resize()}));
    setInterval(_this.updateTimeDisplay, 1000);
};


///////////////////////////////////////////////////////////////////////////////
///////////////////////             Cell             //////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Represents a square


function Cell(row, col, size, game, binary) {

    this.destroy = function() {
        if (this.animationInterval)
            clearInterval(this.animationInterval);
        this.draw = function(){}; // do not draw anymore
    };

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

    
    this.neighborsCannotConnect = function() {
        for (var dir = 0; dir < 4; ++dir) {
            if (this.neighbor(dir)) {
                var oppositeDir = (dir + 2) % 4;
                this.neighbor(dir).canAddCable[oppositeDir] = false;
            }
        }
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
    this.draw = function(force){
        if (this.dirty == false && !force) {
            return;
        }
        this.drawCell();
        
        if (this.game.wrapping) {
            var x = null;
            var y = null;
            if (this.row == 0) {
                this.drawCell(0, this.size*this.game.rows);
            }
            if (this.col == 0) {
                this.drawCell(this.size*this.game.cols, 0);
            }
            if (this.row == this.game.rows-1) {
                this.drawCell(0, -this.size*this.game.rows);
            }
            if (this.col == this.game.cols-1) {
                this.drawCell(-this.size*this.game.cols, 0);
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
        if (!this.moved || !game.gameActive) return;

        var ctx = this.context;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.rect(0, 0, this.size, this.size);
        ctx.closePath();
        ctx.fill();

        /*var size = this.size;
        var b = size/20; // border
        var b2 = size-b;
        var s = size/5;  // size
        this.fillTriangle(b, b,  b+s, b,  b, b+s);
        this.fillTriangle(b, b2,  b+s, b2,  b, b2-s);
        this.fillTriangle(b2, b,  b2-s, b,  b2, b+s);
        this.fillTriangle(b2, b2,  b2-s, b2,  b2, b2-s);*/
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
        if (!game.gameActive) {return}
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
        ctx.fillStyle = this.game.colors[this.color];
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
        ctx.fillStyle = this.game.colors[this.color];
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
        this.originalPosition = this.normalizeMoves(this.originalPosition-1);
        var last = this.cables.pop();
        this.cables.unshift(last);
        this.dirty = true;
    };
    this.rotateCounterClockwise = function() {
        this.originalPosition = this.normalizeMoves(this.originalPosition+1);
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
    
    this.animate = function(clockwise, time) {
        this.isRotating = true;
        this.clicks.push(clockwise);
        time = time || 0.3;
        
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
        game.updateGame();
        this.draw(true);
    };

    this.reset = function(time) {
        var origPos = this.originalPosition;
        var cw = origPos > 0;
        for (var j = 0; j < Math.abs(origPos); ++j) {
            this.animate(cw, time);
        }
    };
    
    this.neighbor = function(direction) {
        var wrapping = this.game.wrapping;
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
        var rotations;

        if (this.isStraightCable()) {
            // change in 70% of cases
            rotations = 1;
            if (Math.random() < 0.3) rotations = 0;
        } else {
            // change in 85% of cases
            rotations = Math.floor((Math.random()*4)) + 1;
            if (Math.random() < 0.15) rotation = 0;
        }
        for (var i = 0; i < rotations; ++i) {
            this.rotateClockwise();
        }
        
        var moves = this.absNormalizeMoves(rotations);
        
        if (moves != 0) {
            this.dirty = true;
        }
        return moves;
    };
    
    // receives the number of rotations (optionally negative, max -4)
    // and returns the number of equivalent moves from 0 to 2
    // (the result is independent of the direction)
    this.normalizeMoves = function(moves) {
        moves = (moves + 5) % 4 - 1; // (from -1 to +2)
        var nCables = this.numOfCables();
        if (nCables == 0 || nCables == 4) moves = 0;
        if (this.isStraightCable()) moves %= 2;
        return moves;
    };

    this.absNormalizeMoves = function(moves) {
        return Math.abs(this.normalizeMoves(moves));
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

})();