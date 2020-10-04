const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const width = 800;
const height = 600;
const arena_size = 300; // radius
const grid_size = 24;
const quadrant_cell_width = Math.floor(arena_size / grid_size);

let held_keys = {};
let held_mouse_buttons = {};
const mouse_position = [0, 0];

let load_max = 0;
let load_done = 0;

let show_start_button = 'Start';

function resource_load(func) {
    load_max += 1;
    func(() => {
	load_done += 1;
	if (load_done == load_max) {
	    begin();
	}
    });
}

let level_data = null;

resource_load((finish) => {
    fetch("levels.json")
	.then(response => response.json())
	.then(data => {
	    level_data = data;
	    setTimeout(finish, 100);
	});
});

// returns diff between -pi and pi
function angleDiff(a, b) {
    var diff = (b - a);
    return ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

class Entity {
    constructor(options) {
	this.game = options.game;
	this.game.entities.push(this);
	this.position = [options.pos[0], options.pos[1]];
	this.velocity = [0, 0];
	this.size = 0; // diameter
	this.sector = options.sector;
	this.hit_wall = false;
	options.sector.entities.push(this);
    }

    kill() {}

    tick() {
	// ctx.fillStyle = "#804";
	// ctx.beginPath();
	// ctx.arc(this.position[0], this.position[1], this.size / 2, 0, Math.PI * 2);
	// ctx.fill();

	const start_collide = this.sector.colliding(this);
	this.hit_wall = false;
	this.position[0] += this.velocity[0];
	if (this.sector.colliding(this) && !start_collide) {
	    this.position[0] -= this.velocity[0];
	    this.velocity[0] = 0;
	    this.hit_wall = true;
	}
	this.position[1] += this.velocity[1];
	if (this.sector.colliding(this) && !start_collide) {
	    this.position[1] -= this.velocity[1];
	    this.velocity[1] = 0;
	    this.hit_wall = true;
	}
    }

    checkCollide(other) {
	const offset = [
	    this.position[0] - other.position[0],
	    this.position[1] - other.position[1],	
	];
	const dist = Math.sqrt(offset[0] * offset[0] + offset[1] * offset[1]);
	if (dist < (this.size + other.size) * 0.5) {
	    this.collide(other);
	    other.collide(this);
	}
    }

    collide(other) {}
};

class Enemy extends Entity {
    constructor(options) {
	super(options);

	this.size = 12;
	this.spottedPlayer = false;
	this.rand_vel = [0, 0];
    }

    collide(other) {
	let offset = [other.position[0] - this.position[0], other.position[1] - this.position[1]];
	this.velocity[0] -= offset[0] * 0.2;
	this.velocity[1] -= offset[1] * 0.2;
    }

    kill() {
	for (let i = 0; i < 10; i++) {
	    (() => {
		let timer = 0;
		let sz = Math.random() * 10;
		let szmax = sz * (Math.random() * 0.6 + 1);
		let x = this.position[0];
		let y = this.position[1];
		let r = Math.random() * Math.PI * 2;
		let v = Math.random() * 4;
		let hit = Math.random() * 20;
		let c = Math.random() * 255;
		this.sector.particles.push(() => {
		    x += Math.cos(r) * v;
		    y += Math.sin(r) * v;
		    hit--;
		    if (hit > 0) {
			v *= 0.9;
		    } else {
			v *= 0.7;
			let l = 0.05;
			sz = sz * (1 - l) + szmax * l;
		    }
		    ctx.save();
		    ctx.translate(x, y);
		    ctx.rotate(r);
		    ctx.scale(1, 0.6);
		    ctx.beginPath();
		    ctx.arc(0, 0, sz, 0, Math.PI * 2);
		    ctx.fillStyle = `rgba(0, ${c}, 0, ${1.0 - (timer / 100)})`;
		    ctx.fill();
		    ctx.restore();
		    timer++;
		    return timer > 100;
		});
	    })();
	}
	let x = this.position[0];
	let y = this.position[1];
	let vx = Math.random() * 8 - 4;
	let vy = Math.random() * 8 - 4;
	let sz = 0.3;
	let timer = 0;
	this.sector.particles.push(() => {
	    x += vx;
	    y += vy;
	    vx *= 0.8;
	    vy *= 0.8;
	    ctx.save();
	    ctx.translate(x, y);
	    sz = (sz * 0.6) + 0.4;
	    ctx.scale(sz, sz);
	    ctx.textAlign = 'center';
	    ctx.textBaseline = 'middle';
	    ctx.font = 'Bold 18px Oxygen';
	    ctx.fillStyle = `rgba(255, 255, 255, ${1.0 - Math.pow(timer / 30, 4.0)})`;
	    ctx.fillText('+10', 0, 0);
	    ctx.restore();

	    timer++;
	    return timer > 30;
	});
    }

    tick() {
	super.tick();

	this.velocity[0] *= 0.7;
	this.velocity[1] *= 0.7;
	
	const offset = [
	    this.game.player.position[0] - this.position[0],
	    this.game.player.position[1] - this.position[1],
	];
	const player_next = this.game.nextSector(this.game.player.sector);
	if (this.sector == this.game.player.sector || this.sector == player_next) {
	    let dist = Math.sqrt(offset[0] * offset[0] + offset[1] * offset[1]);
	    if (dist < 250) {
		this.spottedPlayer = true;
	    }
	}

	if (Math.random() < 0.5) {
	    this.rand_vel[0] = Math.random() * 2 - 1;
	    this.rand_vel[1] = Math.random() * 2 - 1;
	}
	if (this.spottedPlayer) {
	    this.velocity[0] += this.rand_vel[0];
	    this.velocity[1] += this.rand_vel[1];
	    this.velocity[0] += offset[0] * 0.007;
	    this.velocity[1] += offset[1] * 0.007;
	}

    	ctx.fillStyle = "#F00";
	ctx.beginPath();
	ctx.arc(this.position[0], this.position[1], 10, 0, Math.PI * 2);
	ctx.fill();
    }
};

class Player extends Entity {
    constructor(options) {
	super(options);

	this.size = 12;
	
	this.refire = 0;

	for (let i = 0; i < 4; i++) {
	    let x = this.position[0];
	    let y = this.position[1];
	    let timer = -i * 10;
	    let sz = 0;
	    let lsz = 25;
	    this.sector.particles.push(() => {
		timer++;
		if (timer < 0) return false;
		const alpha = 1 - (timer / 50);
		sz = (sz * 0.9) + 200 * 0.1;
		ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
		lsz *= 0.9;
		ctx.lineWidth = lsz;

		ctx.beginPath();
		ctx.arc(x, y, sz, 0, Math.PI * 2);
		ctx.stroke();
		return timer > 50;
	    });
	}
    }

    collide(ent) {
	if (ent && ent instanceof Enemy) {
	    this.dead = true;
	    console.log('player ded');
	}
    }

    tick() {
	super.tick();
	this.velocity[0] *= 0.5;
	this.velocity[1] *= 0.5;
	this.velocity[0] += ((held_keys['D'] || 0) - (held_keys['A'] || 0)) * 1.6;
	this.velocity[1] += ((held_keys['S'] || 0) - (held_keys['W'] || 0)) * 1.6;
	
	this.refire++;

	if (this.refire > 30 && held_mouse_buttons[0]) {
	    this.refire = 0;
	    this.game.shake += 20;
	    for (let i = 0; i < 4; i++) {
		let angle = Math.atan2(
		    mouse_position[1] - (this.position[1] + height / 2),
		    mouse_position[0] - (this.position[0] + width / 2)
		);
		angle += (Math.random() * 2 - 1) * 0.15;
		let end = 0;
		for (let j = 0; j < 100; j++) {
		    let pos = [
			this.position[0] + Math.cos(angle) * end,
			this.position[1] + Math.sin(angle) * end,
		    ];
		    if (this.sector.collidingPoint(pos)) {
			break;
		    }
		    this.sector.entitiesAt(pos, (ent) => {
			if (ent instanceof Enemy) {
			    ent.dead = true;
			}
		    });
		    end += 8;
		}
		(() => {
		    let start = 0;
		    let new_end = end;
		    let timer = 0;
		    let x = this.position[0];
		    let y = this.position[1];
		    this.sector.particles.push(() => {
			ctx.save();
			ctx.translate(x, y);
			//ctx.rotate(angle);
			if (timer === 0 || timer === 2) {
			    ctx.strokeStyle = '#FF4';
			} else if (timer === 1 || timer === 3) {
			    ctx.strokeStyle = '#F00';
			} else {
			    ctx.strokeStyle = `rgba(192, 192, 192, ${ (1.0 - (timer / 30)) * 0.3 })`;
			}
			ctx.lineWidth = 2;
			ctx.beginPath();
			start = start * 0.99 + new_end * 0.01;
			ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
			ctx.lineTo(Math.cos(angle) * new_end, Math.sin(angle) * new_end);
			ctx.stroke();
			ctx.restore();
			timer += 1;
			return timer > 30;
		    });
		})();
	    }
	}

    	ctx.fillStyle = "#0F0";
	ctx.beginPath();
	ctx.arc(this.position[0], this.position[1], this.size / 2, 0, Math.PI * 2);
	ctx.fill();
    }
};

class Sector {
    // angle: integer between 0 and 3
    constructor(game, spawn, prev) {
	this.game = game;
	
	this.angle = prev ? ((prev.angle + 1) % 4) : 0;
	this.hue_offset = 20;
	this.hue = prev ? ((prev.hue + this.hue_offset) % 360) : 0;
	this.entities = [];
	//this.shade = Math.random();
	this.grid = [];

	this.particles = [];

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

	let chosen_sector = null;
	if (level_data == null) {
	    chosen_sector = [];
	    for (let i = 0; i <= quadrant_cell_width; i++) {
		chosen_sector.push([]);
		for (let j = 0; j <= quadrant_cell_width; j++) {
		    chosen_sector[i].push(0);
		}
	    }
	} else {
	    chosen_sector = level_data[Math.floor(Math.random() * 6)];
	}

	const mirror = Math.random() < 0.5 ? false : true;
	
	for (let i = 0; i < quadrant_cell_width; i++) {
	    this.grid.push([]);
	    for (let j = 0; j < quadrant_cell_width; j++) {
		let new_i = i;
		let new_j = j;
		if (this.angle == 1 || this.angle == 2) {
		    new_i++;
		}
		if (this.angle == 2 || this.angle == 3) {
		    new_j++;
		}
		let tmp_new_i = new_i;
		let tmp_new_j = new_j;
		switch (this.angle) {
		case 0:
		    new_i = new_j;
		    new_j = 12 - tmp_new_i;
		    break;
		case 1:
		    new_i = 12 - new_i;
		    new_j = 12 - new_j;
		    break;
		case 2:
		    new_i = 12 - new_j;
		    new_j = tmp_new_i;
		    break;
		case 3:
		    break;
		}
		if (mirror) {
		    const tmp = new_i;
		    new_i = 12 - new_j;
		    new_j = 12 - tmp;
		}
		const template_cell = chosen_sector[new_i][new_j]
		let cell = 0;
		if (template_cell >= 0 && template_cell <= 1) {
		    cell = Math.random() < template_cell ? 1 : 0;
		}
		const pos = [(i + this.grid_offset[0] + 0.5) * grid_size, (j + this.grid_offset[1] + 0.5) * grid_size];
		if (spawn.enemy) {
		    if (template_cell == 2) {
			let ent = new Enemy({
			    pos: pos,
			    game: this.game,
			    sector: this,
			});
			ent.velocity[0] = Math.random() * 20 - 10;
			ent.velocity[1] = Math.random() * 20 - 10;
		    }
		}
		if (spawn.player) {
		    if (template_cell == 3) {
			let ent = new Player({
			    pos: pos,
			    game: this.game,
			    sector: this,
			});
		    }
		}
		this.grid[i].push(cell);
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

    collidingPoint(pos) {
	if (this.getCell(Math.floor(pos[0] / grid_size), Math.floor(pos[1] / grid_size)) == 1) {
	    return true;
	}
	return false;
    }

    entitiesAt(pos, callback) {
	const prev = this.game.prevSector(this);
	const next = this.game.nextSector(this);
	for (const sec of [prev, next, this]) {
	    for (let i = 0; i < sec.entities.length; i++) {
		const ent = sec.entities[i];
		const offset = [
		    ent.position[0] - pos[0],
		    ent.position[1] - pos[1],
		];
		const dist = Math.sqrt(offset[0] * offset[0] + offset[1] * offset[1]);
		if (dist < ent.size) {
		    callback(ent);
		}
	    }
	}
    }
    
    colliding(ent) {
	for (let x = -1; x <= 1; x += 2) {
	    for (let y = -1; y <= 1; y += 2) {
		const pos = [
		    ent.position[0] + ent.size * x * 0.5,
		    ent.position[1] + ent.size * y * 0.5,
		];
		if (this.collidingPoint(pos)) {
		    return true;
		}
	    }
	}
	return false;
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
	    const new_x = x - this.grid_offset[0];
	    const new_y = y - this.grid_offset[1];
	    if (new_x < 0 || new_x >= quadrant_cell_width ||
		new_y < 0 || new_y >= quadrant_cell_width) {
		return 1;
	    }
	    return this.grid[new_x][new_y];
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
	// ctx.fillStyle = `rgb(${this.shade * 255}, ${this.shade * 255}, ${this.shade * 255})`;
	
	// ctx.beginPath();
	// ctx.moveTo(0, 0);
	// ctx.arc(0, 0, arena_size, this.angle * Math.PI * 0.5, (this.angle + 1) * Math.PI * 0.5);
	// ctx.lineTo(0, 0);
	// ctx.fill();

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
		// if (dist <= 1 || dist >= (quadrant_cell_width)) {
		//     continue;
		// }
		const cell = this.getCell(x, y);
		const diff = angleDiff(this.angle * Math.PI * 0.5, Math.atan2(y + 0.5, x + 0.5));
		const hue = this.hue + (diff / (Math.PI * 0.5)) * this.hue_offset;
		const sat = 50;
		if (cell == 1) {
		    ctx.fillStyle = `hsl(${hue}, ${sat}%, 30%)`;
		    ctx.fillRect(x * grid_size, y * grid_size, grid_size, grid_size);
		    ctx.fillStyle = `hsl(${hue}, ${sat}%, 50%)`;
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

    renderParticles() {
	for (let i = 0; i < this.particles.length; i++) {
	    if ((this.particles[i])()) {
		this.particles.splice(i, 1);
		i--;
	    }
	}
    }
    
    tick() {
	const next = this.game.nextSector(this);
	for (let i = 0; i < this.entities.length; i++) {
	    const entity = this.entities[i];
	    entity.tick();
	    for (let j = i + 1; j < this.entities.length; j++) {
		entity.checkCollide(this.entities[j]);
	    }
	    if (next) {
		for (let j = 0; j < next.entities.length; j++) {
		    entity.checkCollide(next.entities[j]);
		}
	    }
	    if (entity.dead) {
		entity.kill();
		this.entities.splice(i, 1);
		i--;
		this.game.entities.splice(this.game.entities.indexOf(entity), 1);
	    }
	}
    }
};

class Game {
    constructor() {
	this.sectors = [];
	this.entities = [];

	this.addSector({enemy: false, player: false});
	this.addSector({enemy: false, player: false});
	this.addSector({enemy: false, player: false});
	this.addSector({enemy: false, player: true});
	this.player = this.entities[0]; // hope this works haha

	this.shake = 0;
	this.score = 0;
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
	    //return true;
	}
	if (offset < -2 || offset > 2) {
	    return false;
	}
	ctx.beginPath();
	ctx.moveTo(0, 0);
	if (offset > 0) {
	    ctx.arc(0, 0, arena_size * 2, cutoff, cutoff + Math.PI * 1.5);
	} else {
	    ctx.arc(0, 0, arena_size * 2, cutoff - Math.PI * 1.5, cutoff);
	}
	ctx.lineTo(0, 0);
	ctx.clip();
	return true;
    }
    
    tick() {
	var player_index = this.sectors.indexOf(this.player.sector);
	while (player_index > (this.sectors.length - 4)) {
	    this.addSector({enemy: true, player: false});
	}
	while (player_index > 4) {
	    this.removeSector();
	    player_index--;
	}

	ctx.save();
	ctx.translate(width / 2, height / 2);
	
	this.shake *= 0.6;
	var shake = this.shake;// * this.shake;
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
		sector.renderParticles();
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
	if (this.player.dead) {
	    show_start_button = 'Restart';
	    ctx.save();
	    ctx.textAlign = 'center';
	    ctx.textBaseline = 'middle';
	    ctx.fillStyle = '#FFF';
	    ctx.shadowColor = '#000';
	    ctx.shadowBlur = 5;
	    ctx.font = '100px Oxygen';
	    ctx.fillText("You Died", width / 2, height / 4);
	    ctx.font = '50px Oxygen';
	    ctx.fillText(`Score: ${this.score}`, width / 2, height / 2.5);
	    ctx.restore();
	}
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
    addSector(spawn) {
	if (this.sectors.length == 0) {
	    this.sectors.push(new Sector(this, spawn, null));
	    return;
	}
	this.sectors.push(new Sector(this, spawn, this.sectors[this.sectors.length - 1]));
    }

    removeSector() {
	var sector = this.sectors.shift();
	for (const entity of sector.entities) {
	    this.entities.splice(this.entities.indexOf(entity), 1);
	}
    }
};

let game;
let handle_events = true;

function begin() {
    let spinner = document.querySelector('#loading');
    if (spinner) spinner.className += ' done';
    setTimeout(() => {
	if (spinner) spinner.parentElement.removeChild(spinner);
    }, 1000);
    tick();
}

let current_start_button = null;
function tick() {
    if (current_start_button != show_start_button) {
	current_start_button = show_start_button;
	if (show_start_button == null) {
	    document.querySelector('#start').style.display = 'none';
	} else {
	    document.querySelector('#start').style.display = 'block';
	    document.querySelector('#start').textContent = show_start_button;
	}
    }
    ctx.clearRect(0, 0, width, height);
    if (game) {
	game.tick();
    } else {
	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#FFF';
	ctx.shadowColor = '#000';
	ctx.shadowBlur = 5;
	ctx.font = '100px Oxygen';
	ctx.fillText("{{game name}}", width / 2, height / 4);
	ctx.font = '20px Oxygen';
	ctx.fillText("Click to shoot | WASD or arrow keys to move | Go clockwise", width / 2, height / 2.5);
	ctx.restore();
    }
    requestAnimationFrame(tick);
}

function blur() {
    held_keys = {};
    held_mouse_buttons = {};
}

document.querySelector('#start').addEventListener('mousedown', (e) => {
    handle_events = false;
    blur();
    setTimeout(() => {
	handle_events = true;
    }, 50);
});

document.querySelector('#start').addEventListener('click', (e) => {
    game = new Game();
    show_start_button = null;
});

window.addEventListener('blur', (e) => {
    blur();
});

window.addEventListener('keydown', (e) => {
    if (!handle_events) return;
    held_keys[e.keyCode || e.which || 0] = true;
    held_keys[String.fromCharCode(e.keyCode || e.which || 0)] = true;
});

window.addEventListener('keyup', (e) => {
    if (!handle_events) return;
    delete held_keys[e.keyCode || e.which || 0];
    delete held_keys[String.fromCharCode(e.keyCode || e.which || 0)];
});

window.addEventListener('mousedown', (e) => {
    if (!handle_events) return;
    held_mouse_buttons[e.button] = true;
});

window.addEventListener('mouseup', (e) => {
    if (!handle_events) return;
    delete held_mouse_buttons[e.button];
});

window.addEventListener('mousemove', (e) => {
    if (!handle_events) return;
    mouse_position[0] = e.clientX;
    mouse_position[1] = e.clientY;
});
