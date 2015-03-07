// (c) Blaise Kal / blaisekal.com / blaisekal@gmail.com, Aug. 2008

/**
 * Language (future use?)
 */
function LNG(string) {
	return string;
};

/**
 * Setup DOM structure
 */
$(document).ready(function() {


	// Wrapper
	$('body').empty().append('<div id="tetris"></div>');

	// Game canvas
	$('div#tetris').append('<div id="tCanvas"></div>');

	// Side
	$('div#tetris').append('<form id="tSide"></form>');

	// Next block
	$('form#tSide').append('<fieldset><legend>' + LNG('Next')
						+ '</legend><div id="nextblock"></div></fieldset>');

	// Scoreboard
	$('form#tSide').append('<fieldset><legend>' + LNG('Score') + '</legend><dl>'
						+ '<dt>' + LNG('Points') + '</dt><dd id="tScPoints" />'
						+ '<dt>' + LNG('Lines')  + '</dt><dd id="tScLines" />'
						+ '<dt>' + LNG('Level')  + '</dt><dd id="tScLevel" />'
						+ '</dl></fieldset>');

	// Message box
	$("#tCanvas").append('<div id="tMessage"><strong>' + LNG('START GAME') + '</strong> '
		+ LNG('Press Space')  + '<br><br><strong> '+ LNG('Keys') + '</strong>'
		+ '&#8679; = ' + LNG('Rotate Right') + '<br>'
		+ '&#8678; = ' + LNG('Move Left') + '<br>'
		+ '&#8680; = ' + LNG('Move Right') + '<br>'
		+ '&#8681; = ' + LNG('Fast Drop') + '<br>'
		+   'Space = ' + LNG('Pause Game')
		+ '</div>');

	// Falling block wrapper
	$("#tCanvas").append('<div id="tBlockWrap"></div>');

	// Ready to start
	new tetris.game().start();
});

/**
 * Namespace
 */
var tetris = {};

/**
 * Game functions
 */
tetris.game = function() {

	// Return singleton
	if (tetris.game.instance) {
		return tetris.game.instance;
	}

	// Settings
	this.speed	= 750;	//

	// Variables
	this.points	=   0;	// # points
	this.level	=   0;	// # level
	this.lines	=   0;	// # lines

	this.tilesX	=  10;	// # horizontal tiles
	this.tilesY =  20;	// # vertical tiles

	this.skip	=   0;	// # Lines to skip when syncing stack
	this.pause	=   1;	// Pause on start

	// New instance
	return (tetris.game.instance = this);
};

$.extend(tetris.game.prototype, {

	/**
	 * Start the game
	 */
	start : function() {

		// Setup
		this.allowMove = false;
		tetris.ui.updateScore();
		tetris.interaction.setupKeys();

		// Set next block
		this.setNextBlock(tetris.block.getRandom());

		// Setup empty stack
		this.emptyStack();
	},

	/**
	 * Start new block
	 */
	startNewBlock : function() {

		// Sync current state
		tetris.ui.syncStack(this.stack, [0, this.tilesY - this.skip]);

		// New block
		this.setBlock(this.nextBlock);
		this.setNextBlock(tetris.block.getRandom());
		this.spawnBlock(true);
	},

	/**
	 * Create empty stack
	 */
	emptyStack : function() {
		this.stack = [];
		for (var i=0; i<this.tilesY; i++) {
			this.stack[i] = new Array(this.tilesX);
		}
	},

	/**
	 * Set current block
	 */
	setBlock : function(block) {
		this.block = block;
	},

	/**
	 * Set next block
	 */
	setNextBlock : function(block) {
		this.nextBlock = block;
		tetris.ui.setBlock('nextblock', block);
	},

	/**
	 * Spawn block
	 */
	spawnBlock : function() {

		// Create block
		tetris.ui.setBlock('tBlockWrap', this.block);

		// Find center
		this.loc = {};
		this.loc.X = Math.floor((this.tilesX / 2)) - Math.ceil((this.block.W / 2));
		this.loc.Y = this.tilesY + 1;

		// Move block to default spawn position
		tetris.ui.moveBlock(this.loc.X, this.loc.Y);

		// Drop block
		this.startDrop();
	},

	/**
	 * Drop block start
	 */
	startDrop : function() {
		this.tmpspeed	= 0;
		this.allowMove	= true;
		this.dropBlock();
	},

	/**
	 * Drop block, 1 tile lower
	 */
	dropBlock : function() {

		// 1 tile lower
		this.loc.Y--;
		var scope = this;

		// Speed
		clearTimeout(window.drop);
		var speed = (this.tmpspeed) ? this.tmpspeed : this.speed - ((this.level / 1.2) * 70);

		// Stop when there is a collision next drop
		if (this.collision(this.block, this.loc.X, this.loc.Y)) {
			this.stopBlock();
		}

		// Let's do that again!
		else {
			window.drop = setTimeout(function(){scope.dropBlock()}, speed);
			tetris.ui.moveBlock(this.loc.X, this.loc.Y);
		}
	},

	/**
	 * Stop block
	 */
	stopBlock : function() {

		// Don't allow any more moving
		this.allowMove = false;

		// Game over?
		if (this.loc.Y + this.block.H >= this.tilesY) {
			tetris.ui.gameOver();
			this.gameOver();
			return;
		}

		// Add block to stack
		this.addBlockToStack();

		// Sync UI; only affected lines
		tetris.ui.syncStack(this.stack, [this.loc.Y, this.loc.Y + this.block.H]);

		// Score update
		this.points++;
		lines = this.checkLines();

		// Level update
		this.level = Math.floor((this.points + 100) / 100);

		// Apply changes to UI
		tetris.ui.updateScore();

		// Next block
		var nextBlockTimeout = 0;

		if (lines.length) {
			tetris.ui.highlight(lines);
			nextBlockTimeout = 300 - (this.level * 12);
		}

		var scope = this;
		setTimeout(function(){
			scope.startNewBlock();
		}, nextBlockTimeout);
	},

	/**
	 * Check for hits
	 * returns true/false
	 */
	collision : function(B, X, Y) {

		var crash = false;

		if (typeof B == 'undefined') B = this.block;
		if (typeof X == 'undefined') X = this.loc.X;
		if (typeof Y == 'undefined') Y = this.loc.Y;

		var W = B.W;
		var H = B.H;

		// Floor Collision
		if (Y < 0) {
			crash = true;
		}

		// Wall Collision
		else if (X < 0 || X + B.W > this.tilesX) {
			crash = true;
		}

		// Check every block-tile for overlaps with stack
		else {
			for (var i=0; i<H; i++) {
				for (var j=0; j<W; j++) {
					if (this.stack[Y+i] !== undefined && this.stack[Y+i][X+j] !== undefined && B.raw[H-1-i][j]) {
						crash = true;
						break;
					}
				}
			}
		}

		return crash;
	},

	/**
	 * Add Block to Stack
	 */
	addBlockToStack : function() {

		// Cycle through tiles
		for (var i=0; i<this.block.H; i++) {
			for (var j=0; j<this.block.W; j++) {

				// Solid tile
				if (this.block.raw[i][j]) {
					var X = this.loc.X + j;
					var Y = this.loc.Y + (this.block.H-i);
					this.stack[Y][X] = this.block.color;
				}
			}
		}
	},

	/**
	 * Check for complete lines
	 */
	checkLines : function() {

		var lines = [];
		var solid = [];

		// Check all lines
		for (var i=0; i<this.tilesY; i++) {

			solid[i] = 0;

			// Check if complete line is filled
			for (var j=0; j<this.tilesX; j++) {
				if (this.stack[i][j]) solid[i]++;
			}

			// Complete line solid?
			if (solid[i] == this.tilesX) {
				this.lines++;
				lines.push(i);
			}
		}

		// How many lines completely empty
		this.skip = 0;
		var i = this.tilesY;
		while (i--) {
			if (solid[i] == 0) this.skip++;
			else break;
		}

		// We have complete lines
		if (lines.length) {

			// Update score
			switch (lines.length) {
				case 1 : this.points += 10;  break;
				case 2 : this.points += 30;  break;
				case 3 : this.points += 50;  break;
				case 4 : this.points += 100; break;
			}

			// Remove lines from stack
			var i = lines.length;
			while (i--) {
				// Drop all tiles above this line with 1 tile
				this.stack.splice(lines[i], 1);
				this.stack.push(new Array(this.tilesX));
			}
		}

		return lines;
	},

	/**
	 * OHNOES!
	 */
	gameOver : function() {
		// show last block
		this.addBlockToStack();
		tetris.ui.syncStack(this.stack, [0, this.tilesY - this.skip]);
		this.done = true;
	}

});


/**
 * User interaction
 */
tetris.interaction = {

	/**
	 * Setup keys (directional)
	 */
	setupKeys : function() {

		// Key down
		$(document).keydown(function(event){

			switch (event.keyCode) {
				case 37 : // Left
					tetris.interaction.move(-1);
					return false;
				break;
				case 38 : // Up
					tetris.interaction.rotate();
					return false;
				break;
				case 39 : // Right
					tetris.interaction.move(+1);
					return false;
				break;
				case 40 : // Down
					tetris.interaction.faster(true);
					return false;
				break;
				case 32 : // Space
				case 80 : // P
				case 19 : // Pause/Break
					tetris.interaction.pause();
					return false;
				break;
			}
		});

		// Key up
		$(document).keyup(function(event){
			switch (event.keyCode) {
				case 40 : tetris.interaction.faster(false); break;
			}
		});
	},

	/**
	 * Move block left/right
	 */
	move : function(direction) {

		// Get game instance
		game = new tetris.game();

		// Move allowed?
		if (game.allowMove) {

			newX = game.loc.X + direction;

			// No scratches?
			if (!game.collision(game.block, newX, game.loc.Y)) {
				game.loc.X = newX;
				tetris.ui.moveBlock(game.loc.X = newX, game.loc.Y);
			}
		}
	},

	/**
	 * Drop faster
	 */
	faster : function(start) {

		// Get game instance
		game = new tetris.game();

		// Move allowed?
		if (game.allowMove) {
			if (start) {
				game.tmpspeed = 30;
				game.dropBlock();
			}
			else {
				game.tmpspeed = 0;
			}
		}
	},

	/**
	 * Rotate block
	 */
	rotate : function() {

		// Get game instance
		game = new tetris.game();

		// Move allowed?
		if (game.allowMove) {

			// Virtual block + location
			var VBlock = $.extend({}, game.block);
			var VLoc = $.extend({}, game.loc);

			// Adjust turning point to center
			if (VBlock.W > VBlock.H) {
				VLoc.X++;
			} else if (VBlock.W < VBlock.H) {
				VLoc.X--;
			}

			// Update data
			VBlock.raw	= tetris.lib.rotateArray(VBlock.raw, 1);
			VBlock.W	= VBlock.raw[0].length;
			VBlock.H	= VBlock.raw.length;

			// Try multiple X-offsets for validity
			var offsets = [0, 1, -1, 2, -2];
			for (var i=0; i<offsets.length; i++) {
				if (!game.collision(VBlock, VLoc.X + offsets[i], VLoc.Y)) {
					VLoc.X += offsets[i];	// Apply offset to virtual block
					game.block = VBlock;	// Overwrite block with virtual block proved valid
					game.loc = VLoc;
					tetris.ui.setBlock('tBlockWrap', VBlock, VLoc.X, VLoc.Y);
					break;
				}
			}
		}
	},

	/**
	 * Pause game (toggle)
	 */
	pause : function() {
		game = new tetris.game();
		if (!game.pause) {
			game.pause = true;
			game.allowMove = false;
			clearTimeout(window.drop);
		} else {

			// Game not started yet
			if (game.block === undefined) {
				game.setBlock(game.nextBlock);
				game.setNextBlock(tetris.block.getRandom());
				game.spawnBlock();
			}

			game.pause = false;
			game.allowMove = true;
			game.dropBlock();
		}

		tetris.ui.pause(game.pause);
	}
}



/**
 * User Interface - functions / resources
 */
tetris.ui = {

	// Settings
	tsize : 24, // Tile size (px)

	/**
	 * Show pause message
	 */
	pause : function(pause) {
		if (pause) {
			$('#tMessage').empty().append('<strong>' + LNG('Game paused') + '</strong> ' + LNG('Press Space to continue'));
			$('#tMessage').show('fast');
		}
		else {
			$('#tMessage').hide('fast');
		}
	},

	/**
	 * Show gameover message
	 */
	gameOver : function() {
		$('#nextBlock').empty();
		$('#tBlockWrap').empty();
		$('#tMessage').empty().append('<strong>' + LNG('Game Over!') + '</strong><br>'
		+ LNG('Press F5 to start again'));
		$('#tMessage').show('fast');
	},

	/**
	 * Tetris block colors
	 */
	blockColors : function() {
		return [
			'#2952a5',	// J
			'#13a08e',	// I
			'#eb4800',	// L
			'#777777',	// O
			'#b50000',	// S
			'#8100db',	// T
			'#0d8700'	// Z
		];
	},

	/**
	 * Refresh Block (after rotation or when starting with new block)
	 * param : string	: Parent ID
	 * param : string	: HTML
	 * param : bool		: [replace]
	 * param : bool		: [hide]
	 * param : int		: [X]
	 * param : int		: [Y]
	 */
	setBlock : function(parent, block, X, Y) {
		$('#' + parent).empty().append(this.renderBlock(block));
		if (typeof X == 'number' && typeof Y == 'number') {
			this.moveBlock(X, Y);
		}
	},

	/**
	 * Move block
	 * param : int : X
	 * param : int : Y
	 */
	moveBlock : function(X, Y) {
		Xpx = X * this.tsize + 'px';
		Ypx = Y * this.tsize + 'px';
		$('#tBlockWrap .block').css({left : Xpx, bottom : Ypx});
	},

	/**
	 * Update scoreboard
	 */
	updateScore : function() {
		game = new tetris.game();
		$('dd#tScPoints').text(game.points);
		$('dd#tScLevel').text(game.level);
		$('dd#tScLines').text(game.lines);
	},

	/**
	 * Render block
	 * param : block
	 * Returns html
	 */
	renderBlock : function(block) {
		var H = block.H * this.tsize;
		html = '<div class="block" style="height:' + H + 'px">';
		for (var i=0; i<block.H; i++) {
			var Y = (i * this.tsize) - 1;
			html += '<div class="row" style="top:' + Y + 'px">';
				for (j=0; j<block.W; j++) {
					if (block.raw[i][j]) {
						var X = (j * this.tsize) - 1;
						html += '<div class="tile" style="background-color:' +
						block['color'] + ';left:' + X + 'px"><div></div></div>';
					}
				}
			html += '</div>';
		}

		html += '</div>';
		return html;
	},

	/**
	 * Synchronize UI with stack
	 */
	syncStack : function(stack, rows) {

		if (!rows) rows = [0, stack.length];

		// Cycle through tiles
		for (var i=0; i<stack.length; i++) {
			if (i >= rows[0] && i <= rows[1]) {
				var Y = (i * this.tsize) - 1;
				for (var j=0; j<stack[0].length; j++) {

					var X = (j * this.tsize) - 1;
					var O = 'tile' + i + '_' + j;
					var obj = document.getElementById(O);

					// Tile Repaint
					if (obj && stack[i][j]) {
						$(obj).css({backgroundColor : stack[i][j], visibility : 'visible'});
					}

					// Tile Hide
					else if (obj){
						$(obj).css({visibility : 'hidden'});
					}

					// Tile Create
					else if (!obj && stack[i][j]) {
						$('#tCanvas').append('' +
							'<div id="' + O + '" class="tile"'
							+ 'style="left:' + X + 'px;bottom:' + Y + 'px;'
							+ 'background-color:' + stack[i][j] + ';"><div></div></div>');
					}
				}
			}
		}
	},

	/**
	 * Highlight complete line
	 */
	highlight : function(lines) {

		// Get game instance
		game = new tetris.game();

		// Walk through lines
		var i = lines.length;
		while (i--) {

			for (var j=0; j<game.tilesX; j++) {

				// Find tile
				var O = 'tile' + lines[i] + '_' + j;
				var obj = document.getElementById(O);

				// Highlight tile
				if (obj) {
					$(obj).css({backgroundColor : '#aaa'});
				}
			}
		}
	}
}


/**
 * General JS functions
 */
tetris.lib = {

	/**
	 * Rotate array (clock-wise)
	 */
	rotateArray : function(array, rotations) {

		if (!rotations) rotations = 0;

		// Rotate function
		this.CW90 = function(array) {

			var X = array[0].length;	// X : becomes Y
			var Y = array.length;		// Y : becomes X
			var n = new Array(X);		// n : rotated array

			for(var i = 0; i < X; i++){
				var r = new Array(Y);
				for (var j = 0; j < Y; j++){
					r[j] = array[Y - 1 - j][i];
				}
				n[i] = r;
			}
			return n;
		};

		// Apply n rotations
		for (var i=0; i<rotations; i++) {
			array = this.CW90(array);
		};

		return array;
	}
}


/**
 * Block - functions / resources
 */
tetris.block = {

	/**
	 * Tetris blocks (7 total)
	 */
	blocks : function(){
		return [
			[[1,1,1],		// J,0
			 [0,0,1]],
			[[1,1,1,1]],	// I,1
			[[1,1,1],		// L,2
			 [1,0,0]],
			[[1,1],			// O,3
			 [1,1]],
			[[0,1,1],		// S,4
			 [1,1,0]],
			[[1,1,1],		// T,5
			 [0,1,0]],
			[[1,1,0],		// Z,6
			 [0,1,1]]
		];
	},

	/**
	 * Get random block
	 * var : rotations : int : 0|1|2|3
	 * returns : object
	 */
	getRandom : function(rotations) {

		blockID = Math.floor(Math.random() * this.blocks().length);
		if (typeof rotations == 'undefined') rotations = Math.floor((Math.random() * 4));

		var block = tetris.lib.rotateArray(this.blocks()[blockID], rotations);
		var color = tetris.ui.blockColors()[blockID];

		return {
			raw			: block,
			W			: block[0].length, // Block width (live)
			H			: block.length,
			color		: color
		};
	}
};

