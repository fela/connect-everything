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

var game = {};
game.context = context;
game.init = function() {
    this.width = 400;
    this.height = 400;
    this.rows = 4;
    this.cols = 4;
    this.elements = [];
    size = this.width / this.rows;
    for (r = 0; r < this.rows; ++r) {
        for (c = 0; c < this.cols; ++c) {
            e = new Element(r, c, size);
            this.elements.push(e);
        }
    }
    
    canvas.onclick = function(evt) {
        var res = getMousePosition(canvas, evt);
        x = res[0];
        y = res[1];
        
        var row = Math.floor(x / (game.width/game.rows));
        var col = Math.floor(y / (game.width/game.cols));
        var elem = game.elementAt(row, col);
        
        var clockwise = Math.floor(x / (game.width/game.rows/2))%2 == 1;
        
        
        if (clockwise) {
            elem.rotateClockwise();
        } else {
            elem.rotateCounterClockwise();
        }
        game.draw();

    }
    
    this.elementAt = function(row, col) {
        var i = row * this.cols + col;
        return this.elements[i];
    }
    
    this.draw = function() {
        for (var i = 0; i < this.elements.length; ++i) {
            this.elements[i].draw();
        }
    }
    
    
    this.draw();
}


///////////////////////////////////////////////////////////////////////////////
///////////////////////            Element           //////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Represents a square


function Element(row, col, size) {
    // testing function, returns mostly false but sometimes true
    this.maybe = function() {
        if (Math.random() > 0.2) {
            return false;
        }
        return true;
    };
    // default values, might be overridden
    this.x = size*row;
    this.y = size*col;
    this.width = size;
    this.height = size;
    this.background = get_random_color();
    // wether there is a cable up right down and left, respectively
    this.cables = [false,false,false,false];
    this.cables = [this.maybe(),this.maybe(),this.maybe(),this.maybe()]
    this.context = game.context;
    this.dirty = true;
    this.draw = function(){
        if (this.dirty == false) {
            return;
        }
        ctx = this.context;
        
        // draw contour and background
        ctx.strokeStyle = 'gray';
        ctx.fillStyle = 'black';
        ctx.linewidth = 1;
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        this.drawCables();
        this.dirty = false;
    }
    this.drawCables = function() {
        for (var i = 0; i<4; ++i) {
            if (this.cables[i]) this.drawCable(i);
        }
    }
    this.drawCable = function(cable) {
        var ctx = this.context;
        ctx.save();
        var times = cable;
        this.rotateCanvasMatrixAroundCenter(times);
        this.drawCableUp();
        ctx.restore();
    }
    
    // draws upward cable
    // used as a base to draw cables in all directions
    this.drawCableUp = function() {
        var lineWidth = 8; // works better if even
        var centerX = this.x + size / 2;
        var centerY = this.y + size / 2;
        ctx = this.context;
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = 'red'
        ctx.beginPath();
        // move to top
        ctx.moveTo(centerX, this.y);
        ctx.lineTo(centerX, centerY+(lineWidth/2));
        ctx.closePath();
        ctx.stroke();
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
    return [x,y];
}


game.init();