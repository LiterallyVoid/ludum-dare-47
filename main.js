const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const width = 800;
const height = 600;
const arena_size = 300; // radius
const grid_size = 24;
const quadrant_cell_width = Math.ceil(arena_size / grid_size);

const held_keys = {};
const held_mouse_buttons = {};

// returns diff between -pi and pi
function angleDiff(a, b) {
    var diff = (b - a);
    return ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

class Entity {
    constructor(options) {
	this.game = options.game;
	this.position = [options.pos[0], options.pos[1]];
	this.velocity = [0, 0];
	this.size = 0;
	this.sector = options.sector;
	options.sector.entities.push(this);
    }

    tick() {
	ctx.fillStyle = "#804";
	ctx.beginPath();
	ctx.arc(this.position[0], this.position[1], 10, 0, Math.PI * 2);
	ctx.fill();

	this.position[0] += this.velocity[0];
	this.position[1] += this.velocity[1];
    }
};

class Player extends Entity {
    constructor(options) {
	super(options);

	this.refire = 0;
    }

    tick() {
	super.tick();
	this.velocity[0] *= 0.8;
	this.velocity[1] *= 0.8;
	this.velocity[0] += (held_keys['D'] || 0) - (held_keys['A'] || 0);
	this.velocity[1] += (held_keys['S'] || 0) - (held_keys['W'] || 0);
	
	this.refire++;

	if (this.refire > 30 && held_mouse_buttons[0]) {
	    this.refire = 0;
	    this.game.shake += 4;
	}
    }
};

class Sector {
    // angle: integer between 0 and 3
    constructor(game, angle) {
	this.game = game;
	
	this.angle = angle;
	this.entities = [];
	this.shade = Math.random();
	this.grid = [];

	switch (this.angle) {
	case 0:
	    this.grid_offset = [0, 0];
	    break;
	case 1:
	    this.grid_offset = [-quadrant_cell_width, 0];
	    break;
	case 2:
	    this.grid_offset = [-quadrant_cell_width, -quadrant_cell_width];
	    break;
	case 3:
	    this.grid_offset = [0, -quadrant_cell_width];
	    break;
	default:
	    throw "Angle is not 0, 1, 2, or 3!";
	}
	
	for (let i = 0; i < quadrant_cell_width; i++) {
	    this.grid.push([]);
	    for (let j = 0; j < quadrant_cell_width; j++) {
		this.grid[i].push(Math.random() < 0.5 ? 0 : 1);
	    }
	}
    }

    contains(entity) {
	const ent_angle = Math.atan2(entity.position[1], entity.position[0]);
	const diff = angleDiff(this.angle * Math.PI * 0.5, ent_angle);
	if (diff > 0 && diff < Math.PI * 0.5) {
	    return true;
	}
	return false;
    }

    moveEntityTo(ent, other) {
	this.entities.splice(this.entities.indexOf(ent), 1);
	other.entities.push(ent);
	ent.sector = other;
    }

    getCell(x, y) {
	const prev = this.game.prevSector(this);
	const next = this.game.nextSector(this);

	let quadrant = 0;
	if (x < 0 && y >= 0) {
	    quadrant = 1;
	} else if (x < 0 && y < 0) {
	    quadrant = 2;
	} else if (x >= 0 && y < 0) {
	    quadrant = 3;
	}

	if (quadrant == this.angle) {
	    return this.grid[x - this.grid_offset[0]][y - this.grid_offset[1]];
	} else if (quadrant == (this.angle + 1) % 4) {
	    if (next) {
		return next.getCell(x, y);
	    }
	} else if (quadrant == (this.angle + 3) % 4) {
	    if (prev) {
		return prev.getCell(x, y);
	    }
	}
	return 0;
    }

    // different function because all sectors must render before any entities
    render() {
	ctx.fillStyle = `rgb(${this.shade * 255}, ${this.shade * 255}, ${this.shade * 255})`;
	
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.arc(0, 0, arena_size, this.angle * Math.PI * 0.5, (this.angle + 1) * Math.PI * 0.5);
	ctx.lineTo(0, 0);
	ctx.fill();
	ctx.fillStyle = '#000';
	ctx.fillText(this.angle, Math.cos((this.angle + 0.5) * Math.PI * 0.5) * 100, Math.sin((this.angle + 0.5) * Math.PI * 0.5) * 100);

	const neighbors = [
	    [-1, 0],
	    [0, -1],
	    [1, 0],
	    [0, 1],
	    [-1, -1],
	    [1, -1],
	    [1, 1],
	    [-1, 1],
	];
	for (let i = 0; i < quadrant_cell_width; i++) {
	    for (let j = 0; j < quadrant_cell_width; j++) {
		const x = i + this.grid_offset[0];
		const y = j + this.grid_offset[1];
		const dist = Math.max(Math.abs(x), Math.abs(y));
		if (dist <= 2 || dist >= (quadrant_cell_width - 1)) {
		    continue;
		}
		const cell = this.getCell(x, y);
		if (cell == 1) {
		    ctx.fillStyle = '#804';
		    ctx.fillRect(x * grid_size, y * grid_size, grid_size, grid_size);
		    ctx.fillStyle = '#F08';
		    for (let i = 0; i < neighbors.length; i++) {
			const new_cell = this.getCell(x + neighbors[i][0], y + neighbors[i][1]);
			if (new_cell == 0) {
			    const rect = [0, 0, 1, 1];
			    if (neighbors[i][0] == -1) {
				rect[2] = 0.25;
			    } else if (neighbors[i][0] == 1) {
				rect[0] = 0.75;
				rect[2] = 0.25;
			    }
			    
			    if (neighbors[i][1] == -1) {
				rect[3] = 0.25;
			    } else if (neighbors[i][1] == 1) {
				rect[1] = 0.75;
				rect[3] = 0.25;
			    }			    
			    ctx.fillRect((x + rect[0]) * grid_size, (y + rect[1]) * grid_size, rect[2] * grid_size, rect[3] * grid_size);
			}
		    }
		}
	    }
	}
    }
    
    tick() {
	for (const entity of this.entities) {
	    entity.tick();
	}
    }
};

class Game {
    constructor() {
	this.sectors = [];
	this.entities = [];

	this.addSector();
	this.addSector();
	this.addSector();
	this.addSector();

	this.player = new Player({
	    pos: [50, 50],
	    sector: this.sectors[3],
	    game: this,
	});
	this.entities.push(this.player);

	this.shake = 0;
    }

    /// Returns `true` if the sector should be rendered
    setClipFor(sector) {
	if (sector === this.player.sector) {
	    return true;
	}
	const this_index = this.sectors.indexOf(sector);
	const player_index = this.sectors.indexOf(this.player.sector);
	const offset = player_index - this_index;
	const cutoff = Math.atan2(this.player.position[1], this.player.position[0]) + Math.PI;
	if (offset === -1 || offset === 1) {
	    return true;
	}
	if (offset < -2 || offset > 2) {
	    return false;
	}
	ctx.beginPath();
	ctx.moveTo(0, 0);
	if (offset > 0) {
	    ctx.arc(0, 0, arena_size * 2, cutoff, cutoff + Math.PI);
	} else {
	    ctx.arc(0, 0, arena_size * 2, cutoff - Math.PI, cutoff);
	}
	ctx.lineTo(0, 0);
	ctx.clip();
	return true;
    }
    
    tick() {
	var player_index = this.sectors.indexOf(this.player.sector);
	while (player_index > (this.sectors.length - 3)) {
	    this.addSector();
	}
	while (player_index > 4) {
	    this.removeSector();
	    player_index--;
	}

	ctx.clearRect(0, 0, width, height);
	ctx.save();
	ctx.translate(width / 2, height / 2);
	
	this.shake *= 0.8;
	var shake = this.shake * this.shake;
	ctx.translate(Math.round((Math.random() * 2 - 1) * shake), Math.round((Math.random() * 2 - 1) * shake));
	
	for (const sector of this.sectors) {
	    ctx.save();
	    if (this.setClipFor(sector)) {
		sector.render();
	    }
	    ctx.restore();
	}
	for (const sector of this.sectors) {
	    ctx.save();
	    if (this.setClipFor(sector)) {
		sector.tick();
	    }
	    ctx.restore();
	}
	for (const entity of this.entities) {
	    if (!entity.sector.contains(entity)) {
		const prev = this.prevSector(entity.sector);
		const next = this.nextSector(entity.sector);
		if (prev && prev.contains(entity)) {
		    entity.sector.moveEntityTo(entity, prev);
		} else if (next && next.contains(entity)) {
		    entity.sector.moveEntityTo(entity, next);
		}
	    }
	}
	ctx.restore();
    }

    prevSector(ref) {
	const index = this.sectors.indexOf(ref);
	if (index > 0) {
	    return this.sectors[index - 1];
	}
    }

    nextSector(ref) {
	const index = this.sectors.indexOf(ref);
	if (index < this.sectors.length - 1) {
	    return this.sectors[index + 1];
	}
    }

    // add another sector after the last sector
    addSector() {
	if (this.sectors.length == 0) {
	    this.sectors.push(new Sector(this, 0));
	    return;
	}
	this.sectors.push(new Sector(this,
	    (this.sectors[this.sectors.length - 1].angle + 1) % 4
	));
    }

    removeSector() {
	var sector = this.sectors.shift();
	for (const entity of sector.entities) {
	    this.entities.splice(this.entities.indexOf(entity), 1);
	}
    }
};

const game = new Game();

function tick() {
    game.tick();
    requestAnimationFrame(tick);
}

tick();

window.addEventListener('keydown', (e) => {
    held_keys[e.keyCode || e.which || 0] = true;
    held_keys[String.fromCharCode(e.keyCode || e.which || 0)] = true;
});

window.addEventListener('keyup', (e) => {
    delete held_keys[e.keyCode || e.which || 0];
    delete held_keys[String.fromCharCode(e.keyCode || e.which || 0)];
});

window.addEventListener('mousedown', (e) => {
    held_mouse_buttons[e.button] = true;
});

window.addEventListener('mouseup', (e) => {
    delete held_mouse_buttons[e.button];
});