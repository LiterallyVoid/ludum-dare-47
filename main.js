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
let mania = false;

class Track {
    constructor(url, beats, options) {
	options = options || {};
	this.rate = options.rate || 1;
	this.time = 0;
	this.travel = 9999;
	this.beat = [' ', ' ', ' ', ' '];
	this.volume = (options.volume || 1) * 0.05;
	this.howl = new Howl({src: [url], volume: this.volume});
    }

    tick(rate) {
	this.time += this.rate * rate;
	if (this.time > 10) {
	    this.time -= 10;
	    this.travel++;
	    if (this.travel >= this.beat.length) {
		const chars = '    #/;!';
		this.beat[Math.floor(Math.random() * 4)] = chars[Math.floor(Math.random() * chars.length)];
		this.travel = 0;
	    }
	    const note = this.beat[this.travel];
	    if (note == ' ') return;
	    if (note == '#') {
		this.howl.rate(1);
		this.howl.volume(this.volume);
	    }
	    if (note == '/') {
		this.howl.rate(1.5);
		this.howl.volume(this.volume);
	    }
	    if (note == ';') {
		this.howl.rate(1);
		this.howl.volume(this.volume * 0.5);
	    }
	    if (note == '!') {
		this.howl.rate(1);
		this.howl.volume(this.volume * 0.3);
	    }
	    this.howl.play();
	}
    }
};

class Music {
    constructor() {
	this.tracks = [
	    new Track('music/01.wav'),
	    new Track('music/02.wav'),
	    new Track('music/04.wav'),
	    new Track('music/05.wav'),
	];
	this.rate = 1;
	this.target_rate = 0.7;
    }
    
    tick() {
	this.rate = this.rate * 0.97 + this.target_rate * 0.03;
	for (const track of this.tracks) {
	    track.tick(this.rate);
	}
    }
};

let streak_amount = 0;
let streak_timer = 0;

function streak_next() {
    streak_amount += 1;
    streak_timer = 30;
    return Math.pow(2, streak_amount - 1) * 5;
}

function streak_reset() {
    streak_timer--;
    if (streak_timer < 0) {
	streak_amount = 0;
    }
}

function checkKey(l) {
    for (const key of l) {
	if (held_keys[key]) {
	    return 1;
	}
    }
    return 0;
}

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
	this.bounce = 0;
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
	    this.velocity[0] *= -this.bounce;
	    this.hit_wall = true;
	}
	this.position[1] += this.velocity[1];
	if (this.sector.colliding(this) && !start_collide) {
	    this.position[1] -= this.velocity[1];
	    this.velocity[1] *= -this.bounce;
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
	this.bounce = 0.9;

	this.timer = -1;
    }

    collide(other) {
	let offset = [other.position[0] - this.position[0], other.position[1] - this.position[1]];
	this.velocity[0] -= offset[0] * 0.2;
	this.velocity[1] -= offset[1] * 0.2;

	if (other instanceof Player) {
	    this.timer = 0;
	}
    }

    kill() {
	for (let i = 0; i < 10; i++) {
	    (() => {
		let timer = 0;
		let sz = Math.random() * 15;
		let szmax = sz * (Math.random() * 0.6 + 1);
		let x = this.position[0];
		let y = this.position[1];
		let r = Math.random() * Math.PI * 2;
		let v = Math.random() * 8;
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
	for (let i = 0; i < 3; i++) {
	    let x = this.position[0];
	    let y = this.position[1];
	    let sz = 0;
	    let lsz = 20;
	    let timer = 0;
	    let r = Math.random() * 360;
	    let s = Math.random();
	    let tsz = Math.random() * 50 + 20;
	    let amt = Math.random() * 0.05 + 0.05;
	    this.sector.particles.push(() => {
		sz = (sz * (1 - amt)) + tsz * amt;
		lsz *= 0.9;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(r);
		ctx.scale(1, s);
		ctx.strokeStyle = `rgba(0, 255, 0, ${ 1.0 - (timer / 30) })`;
		ctx.lineWidth = lsz;
		ctx.beginPath();
		ctx.arc(0, 0, sz, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();

		timer++;
		return timer > 30;
	    });
	}
	let x = this.position[0];
	let y = this.position[1];
	let vx = Math.random() * 8 - 4;
	let vy = Math.random() * 8 - 4;
	let sz = 0.3;
	let timer = 0;
	let amt = streak_next();
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
	    ctx.fillText(`+${amt}`, 0, 0);
	    ctx.restore();

	    timer++;
	    return timer > 30;
	});
	this.game.score += amt;
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
	    this.rand_vel[0] = Math.random() * 1 - 0.5;
	    this.rand_vel[1] = Math.random() * 1 - 0.5;
	}
	if (this.spottedPlayer && this.timer == -1) {
	    this.velocity[0] += this.rand_vel[0];
	    this.velocity[1] += this.rand_vel[1];
	    this.velocity[0] += offset[0] * 0.007;
	    this.velocity[1] += offset[1] * 0.007;
	}

	if (this.timer >= 0) {
	    this.timer++;
	    if (this.timer > 20) {
		explode(this, 50, 0.8, 0);
	    }
	}

	if (this.timer >= 0) {
	    if (this.timer % 4 < 2) {
    		ctx.fillStyle = "#F00";
	    } else {
    		ctx.fillStyle = "#FFF";
	    }
	} else {
    	    ctx.fillStyle = "#F00";
	}
	ctx.beginPath();
	ctx.arc(this.position[0], this.position[1], 10, 0, Math.PI * 2);
	ctx.fill();
    }
};

function bullet(ent, angle, limit, pen) {
    let end = 0;
    for (let j = 0; j < 100; j++) {
	if (limit && end > limit) break;
	let pos = [
	    ent.position[0] + Math.cos(angle) * end,
	    ent.position[1] + Math.sin(angle) * end,
	];
	if (ent.sector.collidingPoint(pos)) {
	    pen -= 8;
	    if (pen < 0) break;
	}
	ent.sector.entitiesAt(pos, (o) => {
	    if (o == ent) {
		return;
	    }
	    if (o instanceof Enemy || o instanceof Player) {
		if (o instanceof Enemy) {
		    if (o.timer < 0) {
			o.timer = 0;
		    } else {
			o.timer -= 1;
			if (o.timer < 0) {
			    o.timer = 0;
			}
		    }
		} else {
		    o.dead = true;
		}
	    }
	});
	end += 8;
    }
    (() => {
	let start = 0;
	let new_end = end;
	let timer = 0;
	let x = ent.position[0];
	let y = ent.position[1];
	ent.sector.particles.push(() => {
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

const explode_sound = new Howl({
    src: ['explode.wav'],
    volume: 0.4,
});

function explode(ent, shake, radius, pen) {
    ent.game.shake += shake;
    ent.dead = true;
    explode_sound.play();
    for (let i = 0; i < 30; i++) {
	bullet(ent, Math.random() * 360, (Math.random() * 60 + 30) * radius, pen);
    }
}

class Grenade extends Entity {
    constructor(options) {
	super(options);
	this.size = 1;
	this.bounce = 0.9;

	this.timer = 20;
    }

    tick() {
	super.tick();
	this.velocity[0] *= 0.9;
	this.velocity[1] *= 0.9;
    	ctx.fillStyle = "#999";
	ctx.beginPath();
	ctx.arc(this.position[0], this.position[1], 8, 0, Math.PI * 2);
	ctx.fill();
	this.timer--;
	if (this.timer < 0) {
	    explode(this, 35, 1, 30);
	}
    }
}

class Player extends Entity {
    constructor(options) {
	super(options);

	this.attack_sound = new Howl({
	    src: ['attack.wav'],
	    volume: 0.2,
	});
	
	this.size = 12;
	
	this.refire = 6030;
	this.grenade_refire = 600;
	this.grenade_prime = -1;

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
    
    tick() {
	super.tick();
	this.velocity[0] *= 0.5;
	this.velocity[1] *= 0.5;
	this.velocity[0] += (checkKey(['D', 39]) - checkKey(['A', 37])) * 1.6;
	this.velocity[1] += (checkKey(['S', 40]) - checkKey(['W', 38])) * 1.6;;
	
	this.refire++;
	if (this.grenade_prime == -1) {
	    this.grenade_refire++;
	}

	if (this.refire > 4 && held_mouse_buttons[0]) {
	    this.attack_sound.play();
	    this.refire = 0;
	    this.game.shake += 5;
	    music.rate = 1;
	    let angle = Math.atan2(
		mouse_position[1] - (this.position[1] + height / 2),
		mouse_position[0] - (this.position[0] + width / 2)
	    );
	    angle += (Math.random() * 2 - 1) * 0.1;
	    this.game.target_offset[0] -= Math.cos(angle) * 20;
	    this.game.target_offset[1] -= Math.sin(angle) * 20;
	    bullet(this, angle, 0, 0);
	}

	if (this.grenade_refire > 60 && held_mouse_buttons[2]) {
	    this.grenade_prime = 0;
	    this.grenade_refire = 0;
	}
	if (this.grenade_prime >= 0) {
	    let angle = Math.atan2(
		mouse_position[1] - (this.position[1] + height / 2),
		mouse_position[0] - (this.position[0] + width / 2)
	    );
	    let curv = this.grenade_prime / 30;
	    curv = 1 - Math.pow(1 - curv, 2.0);
	    this.game.target_offset[0] += Math.cos(angle) * curv * 10;
	    this.game.target_offset[1] += Math.sin(angle) * curv * 10;
	    this.grenade_prime += 1;
	    if (!held_mouse_buttons[2] || this.grenade_prime > 40) {
		this.attack_sound.play();
		this.refire = 0;
		let g = new Grenade({
		    pos: [this.position[0], this.position[1]],
		    game: this.game,
		    sector: this.sector,
		});
		g.timer = 10 + this.grenade_prime;
		let offset = [
		    mouse_position[0] - (this.position[0] + width / 2),
		    mouse_position[1] - (this.position[1] + height / 2),
		];
		let dist = Math.sqrt(offset[0] * offset[0] + offset[1] * offset[1]);
		let spd = this.grenade_prime * 0.7 + 8;
		g.velocity = [
		    Math.cos(angle) * spd,
		    Math.sin(angle) * spd,
		];
		this.grenade_prime = -1;
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
	
	this.angle = prev ? ((prev.angle + 1) % 4) : Math.floor(Math.random() * 4);
	this.hue_offset = 20;
	this.hue = prev ? ((prev.hue + this.hue_offset) % 360) : (Math.random() * 360);
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
			for (let i = 0; i < (mania ? 35 : 1); i++) {
			    let ent = new Enemy({
				pos: pos,
				game: this.game,
				sector: this,
			    });
			    ent.velocity[0] = Math.random() * 20 - 10;
			    ent.velocity[1] = Math.random() * 20 - 10;
			}
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
	    if (!sec) continue;
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
	return 1;
    }

    hueAt(x, y) {
	const diff = angleDiff(this.angle * Math.PI * 0.5, Math.atan2(y + 0.5, x + 0.5));
	return this.hue + (diff / (Math.PI * 0.5)) * this.hue_offset;
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
		const hue = this.hueAt(x, y);
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
	const prev = this.game.prevSector(this);
	if (!prev && Math.random() < 0.1) {
	    let timer = 0;
	    let sz = Math.random() * arena_size * 1.414;
	    let a = (Math.random() + this.angle) * Math.PI * 0.5 + 0.2;
	    let v = Math.random() * 0.003;
	    this.particles.push(() => {
		a += v;
		ctx.save();
		ctx.rotate(a);
		ctx.strokeStyle = ctx.fillStyle = `rgba(0, 255, 0, ${(timer/50) * ((100-timer)/50)})`;
		ctx.lineWidth = 10;
		ctx.beginPath();
		ctx.arc(0, 0, sz, -0.2, 0);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(sz - 20, 0);
		ctx.lineTo(sz, 20);
		ctx.lineTo(sz + 20, 0);
		ctx.fill();
		ctx.restore();
		timer++;
		return timer > 100;
	    });
	}
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

function warntext(txt) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'Bold 50px Oxygen';
    ctx.shadowColor = '#000';
    if (Date.now() % 600 < 300) {
	ctx.fillStyle = '#F60';
    } else {
	ctx.fillStyle = '#888';
    }
    ctx.shadowBlur = 3;
    ctx.fillText(txt, width / 2, 40);
    ctx.restore();
}

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
	this.offset = [0, 0];
	this.target_offset = [0, 0];
	this.score = 0;
	music.target_rate = 0.7;
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

	if (player_index == 0 && !this.player.dead) {
	    this.shake /= 0.8;
	    this.shake += 0.1;
	}
	
	ctx.save();
	ctx.translate(width / 2, height / 2);
	
	this.shake *= 0.8;
	if (this.player.dead) {
	    this.shake *= 0.5;
	}
	this.target_offset[0] *= 0.85;
	this.target_offset[1] *= 0.85;
	{
	    const lerp = 0.5;
	    this.offset[0] = (this.offset[0] * (1 - lerp) + this.target_offset[0] * lerp);
	    this.offset[1] = (this.offset[1] * (1 - lerp) + this.target_offset[1] * lerp);
	}
	var shake = this.shake;// * this.shake;
	ctx.translate(Math.round((Math.random() * 2 - 1) * shake), Math.round((Math.random() * 2 - 1) * shake));
	ctx.translate(Math.round(this.offset[0]), Math.round(this.offset[1]));
	
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
	ctx.save();
	const hue = this.player.sector.hueAt(this.player.position[0], this.player.position[1]);
	ctx.fillStyle = `hsl(${hue}, 50%, 30%)`;
	ctx.beginPath();
	const center_sz = 20;
	ctx.arc(0, 0, center_sz, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	const angle = Math.atan2(this.player.position[1], this.player.position[0]);
	let points = [
	    [
		Math.cos(angle + Math.PI * 0.5) * center_sz,
		Math.sin(angle + Math.PI * 0.5) * center_sz,
	    ],
	    [
		Math.cos(angle - Math.PI * 0.5) * center_sz,
		Math.sin(angle - Math.PI * 0.5) * center_sz,
	    ],
	];
	for (const i of [1, 0]) {
	    let p = this.player.position;
	    let pt = points[i];
	    points.push([(pt[0] - p[0]) * 1000 + p[0], (pt[1] - p[1]) * 1000 + p[1]]);
	}
	//console.log(points);
	ctx.moveTo(points[points.length - 1][0], points[points.length - 1][1]);
	for (let i = 0; i < points.length; i++) {
	    ctx.lineTo(points[i][0], points[i][1]);
	}
	ctx.fill();
	ctx.restore();
	ctx.restore();
	if (this.player.dead) {
	    show_start_button = 'Restart';
	    music.target_rate = 0.4;
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
	    if (player_index == 0) {
		warntext("[INTENTIONAL GAME DESIGN]");
	    }
	    ctx.restore();
	}
	ctx.save();
	ctx.textAlign = 'right';
	ctx.textBaseline = 'top';
	ctx.fillStyle = '#FFF';
	ctx.font = 'Bold 50px Oxygen';
	ctx.fillText(`${this.score}`, width - 20, 20);
	ctx.shadowColor = '#000';
	ctx.shadowBlur = 3;
	ctx.textAlign = 'center';
	if (streak_amount > 1) {
	    const alpha = 1.0 - Math.pow(1.0 - (streak_timer / 30), 4.0);
	    const size = 1.0 + Math.pow((streak_timer / 30), 8.0) * 0.5;
	    ctx.save();
	    ctx.translate(width / 2, 43);
	    ctx.scale(size, size);
	    ctx.fillStyle = `hsla(${(Date.now()/2)%360}, 50%, 50%, ${0.3 * alpha})`;
	    ctx.fillRect(-width, -33, width * 2, 66);
	    ctx.fillStyle = `hsla(${(Date.now()/2)%360}, 50%, 50%, ${alpha})`;
	    ctx.fillText(`COMBO x${streak_amount}`, 0, -23);
	    ctx.restore();
	}
	if (!this.player.dead && player_index == 0) {
	    if (this.shake > 20) {
		this.player.dead = true;
	    }
	    warntext("GO THE OTHER WAY, PLEASE");
	}
	ctx.restore();
	streak_reset();
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
    requestAnimationFrame(tick);
}

let current_start_button = null;
let music = new Music();
let budget = 0;
let time = undefined;
function realtick() {
    music.tick();
    
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
	ctx.font = '14px Oxygen';
	ctx.fillText("Click to shoot | Right-click to throw grenade | WASD or arrow keys to move | Go clockwise", width / 2, height / 2.5);
	ctx.restore();
    }
}

const target_mspf = 1000 / 60;

function tick(timestamp) {
    if (time === undefined) time = timestamp - (1000 / 60);
    const delta = timestamp - time;
    time = timestamp;

    budget += delta;
    let amt = Math.floor(budget / target_mspf);
    budget -= target_mspf * amt;
    if (amt > 2) {
	amt = 2;
    }
    for (let i = 0; i < amt; i++) {
	realtick();
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
    e.preventDefault();
    held_mouse_buttons[e.button] = true;
});

window.addEventListener('mouseup', (e) => {
    if (!handle_events) return;
    e.preventDefault();
    delete held_mouse_buttons[e.button];
});

window.addEventListener('contextmenu', (e) => {
    if (!handle_events) return;
    e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
    if (!handle_events) return;
    mouse_position[0] = e.clientX;
    mouse_position[1] = e.clientY;
});
