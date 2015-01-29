var enLimit = 60;
var healLimit = 100;
var lifeLimit = 30;
var lifeLongLimit = 190;
var grX = 20;
var grY = 9;
var grXe = -1;
var grYe = -1;
var crp = {};
var allowLooting = false;

function createCrp(typeName, maxCount, body, action) {
  crp[typeName] = {
    'typeName': typeName,
    'count': 0,
    'maxCount': maxCount,
    'body': body,
    'action': action
  };
}


function calculateDistance(pos1, pos2) {
  return Math.max(Math.abs(pos1.x - pos2.x),
    Math.abs(pos1.y - pos2.y));
}

function getRoom() {
  for (var key in Game.rooms) {
    return Game.rooms[key];
  }
}

function avoidEnemies(creep) {
  if (creep.pos.y <= grY + 2) {
    var enemy = creep.pos.findInRange(Game.HOSTILE_CREEPS, 5);
    if (enemy.length) {
      delete creep.memory.targetPos;
      creep.memory.safePos = {'x': creep.pos.x - (enemy[0].pos.x - creep.pos.x),
        'y': creep.pos.y - (enemy[0].pos.y - creep.pos.y)};
    }
  }
  if ('safePos' in creep.memory) {
    if (creep.moveTo(creep.memory.safePos) != Game.OK ||
      calculateDistance(creep.pos, creep.memory.safePos) < 2)
    {
      delete creep.memory.safePos;
    }
    return true;
  }
  return false;
}

var room = getRoom();
var roomGrid = room.lookAtArea(0, 0, 49, 49);
var spawns = room.find(Game.MY_SPAWNS);
for (var a = 0; a < spawns.length; a++) {
  var spawn = spawns[a];
  if (spawns[a].pos.y < 27) {
    break;
  }
}
var structs = room.find(Game.MY_STRUCTURES);
var targetStructureCount = 9;

function build(x, y, type) {
  room.createConstructionSite(x, y, (type ? type : Game.STRUCTURE_EXTENSION));
  targetStructureCount++;
}

build(3, 41);
build(4, 41);
build(5, 41);
build(46, 42);
build(45, 42);
build(44, 42);
// build(spawn.pos.x, spawn.pos.y + 2);
// build(spawn.pos.x + 1, spawn.pos.y + 2);
// build(spawn.pos.x + 2, spawn.pos.y + 2);
// build(spawn.pos.x + 2, spawn.pos.y + 1);
// build(spawn.pos.x + 2, spawn.pos.y);
// build(spawn.pos.x, spawn.pos.y + 3, Game.STRUCTURE_SPAWN);
build(7, 41, Game.STRUCTURE_SPAWN);

var tmpEnemies = room.find(Game.HOSTILE_CREEPS);
var enemies = [];
for (var a = 0; a < tmpEnemies.length; a++) {
  var enemy = tmpEnemies[a];
  enemy.ranged = 0;
  enemy.attack = 0;
  enemy.heal = 0;
  enemy.tough = 0;
  for (var j = 0; j < enemy.body.length; j++) {
    var body = enemy.body[j];
    if (body.type == Game.RANGED_ATTACK) {
      enemy.ranged += body.hits;
    } else if (body.type == Game.ATTACK) {
      enemy.attack += body.hits;
    } else if (body.type == Game.HEAL) {
      enemy.heal += body.hits;
    } else if (body.type == Game.TOUGH) {
      enemy.tough += body.hits;
    }
  }
  var chosenIndex = 0;
  for (var b = 0; b < enemies.length; b++) {
    if (enemy.pos.y > enemies[b].pos.y - 1) {
      chosenIndex = b;
      break;
    } else if (enemy.pos.y == enemies[b].pos.y - 1) {
      if (enemy.attack >= enemies[b].attack) {
        if (enemy.attack > enemies[b].attack) {
          chosenIndex = b;
          break;
        } else if (enemy.tough <= enemies[b].tough) {
          if (enemy.tough < enemies[b].tough) {
            chosenIndex = b;
            break;
          } else if (enemy.ranged > enemies[b].ranged) {
            chosenIndex = b;
            break;
          }
        }
      }
    }
  }
  enemies.splice(chosenIndex, 0, enemy);
}

var sources = room.find(Game.SOURCES);
var sourceByKey = {};
for (var a = 0; a < sources.length; a++) {
  sources[a].assCount = 0;
  sourceByKey[sources[a].id] = sources[a];
}
var healTargets = [];
var drops = {};
var freeCarries = [];
var sourceAreas = [];
for (var a = 0; a < 3; a++) {
  sourceAreas.push({'carries': 0, 'energy': 0});
}
var hasLeftBuilder = false;
var hasLeftBuilderCarry = false;

function getObstacle(x, y) {
  var o = roomGrid[y][x];
  for (var a = 0; a < o.length; a++) {
    if ((o[a].type != 'terrain' && !(o[a].type == 'structure' &&
      o[a].structure == 'rampart' && o[a].my)) || o[a].terrain == 'wall')
    {
      return o[a];
    }
  }
  return null;
}

function toIndex(pos) {
  return pos.x / 18 >> 0;
}

function addToSourceArea(pos, energy, isCarry) {
  if (room.getPositionAt(pos.x, pos.y).findInRange(Game.SOURCES, 1).length) {
    var sourceAreaIndex = toIndex(pos);
    sourceAreas[sourceAreaIndex].energy += energy;
    if (isCarry) {
      sourceAreas[sourceAreaIndex].carries++;
    }
  }
}

function shouldAddCarry(pos) {
  if (pos.findInRange(Game.SOURCES, 1).length) {
    var sourceAreaIndex = toIndex(pos);
    var distanceRate = (calculateDistance(pos, spawn.pos) / 5 >> 0) - 1;
    return (sourceAreas[sourceAreaIndex].energy > -100 * distanceRate ||
      sourceAreas[sourceAreaIndex].carries < distanceRate);
  } else {
    return true;
  }
}

function addToDrops(pos, energy, isCarry) {
  if (pos.y > 27 != spawn.pos.y > 27) {
    return;
  }
  var key = pos.x + ' ' + pos.y;
  if (key in drops) {
    drops[key] += energy;
  } else if (!isCarry) {
    drops[key] = energy;
  }

  addToSourceArea(pos, energy, isCarry);
}

function posFromKey(key) {
  return room.getPositionAt(parseInt(key), parseInt(key.substr(2)));
}

function addToGrid(obj) {
  grXe = Math.max(grXe, obj.pos.x);
  grYe = Math.max(grYe, obj.pos.y);
}

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  if (enemies.length <= healLimit && creep.hits < creep.hitsMax) {
    var damage = creep.hitsMax - creep.hits;
    if (damage < 200) {
      damage -= 4000;
    } else if (creep.memory.role == 'healer') {
      damage += 4000;
    }
    creep.damage = damage;
    var chosenIndex = 0;
    for (; chosenIndex < healTargets.length; chosenIndex++) {
      if (damage > healTargets[chosenIndex].damage) {
        break;
      }
    }
    healTargets.splice(chosenIndex, 0, creep);
  }
  if ((creep.memory.role == 'guard' || creep.memory.role == 'healer') &&
    !creep.spawning)
  {
    addToGrid(creep);
  } else if (enemies.length <= enLimit) {
    if (creep.memory.role == 'harvester') {
      if (creep.ticksToLive > (creep.pos.y > 27 != spawn.pos.y > 27 ?
        lifeLongLimit : lifeLimit))
      {
        sourceByKey[creep.memory.sourceKey].assCount++;
      }
      if (creep.energy) {
        addToDrops(creep.pos, creep.energy, false);
      }
    } else if (creep.memory.role == 'carry') {
      if (!('safePos' in creep.memory)) {
        var spaceFree = creep.energyCapacity - creep.energy;
        if (!('targetPos' in creep.memory)) {
          if (spaceFree > 0) {
            freeCarries.push(creep);
          } else {
            creep.memory.targetPos = spawn.pos;
          }
        } else if (spaceFree > 0) {
          addToDrops(creep.memory.targetPos, -spaceFree, true);
        }
      }
    } else if (creep.memory.role == 'builder') {
      if (creep.ticksToLive > lifeLongLimit && creep.memory.workCenter.x < 27) {
        hasLeftBuilder = true;
      }
    } else if (creep.memory.role == 'builderCarry') {
      if (creep.ticksToLive > lifeLongLimit && creep.memory.workCenter.x < 27) {
        hasLeftBuilderCarry = true;
      }
    }
  }
}

var drops2 = room.find(Game.DROPPED_ENERGY);
for (var a = 0; a < drops2.length; a++) {
  if ((allowLooting && enemies.length == 0) || !(drops2[a].pos.x > 16 &&
    drops2[a].pos.x < 30 && drops2[a].pos.y < 9))
  {
    addToDrops(drops2[a].pos, drops2[a].energy, false);
  }
}
for (var a = 0; a < freeCarries.length; a++) {
  var creep = freeCarries[a];
  var chosenKey = '';
  var minDistance = 100000;
  var stayPut = false;
  for (var key in drops) {
    var pos = posFromKey(key);
    var distance = calculateDistance(creep.pos, pos);
    if (distance < 2) {
      stayPut = true;
    }
    if (distance < minDistance && distance > 1 &&
      (distance < 4 || shouldAddCarry(pos)))
    {
      minDistance = distance;
      chosenKey = key;
    }
  }
  var freeSpace = creep.energyCapacity - creep.energy
  if (minDistance > 4 && creep.energy) {
    var localSources = creep.pos.findInRange(Game.SOURCES, 4);
    if (localSources.length == 0 || !localSources[0].energy) {
      creep.memory.targetPos = spawn.pos;
    }
  } else if (chosenKey !== '' && (minDistance < 4 || stayPut == false)) {
    // creep.say(chosenKey);
    creep.memory.targetPos = posFromKey(chosenKey);
    drops[chosenKey] -= freeSpace;
    addToSourceArea(creep.memory.targetPos, -freeSpace, true);
  } else if (stayPut) {
    addToSourceArea(creep.pos, -freeSpace, true);
  }
}

createCrp('harvester', 2, [Game.WORK, Game.WORK, Game.WORK, Game.CARRY, Game.MOVE], function(creep) {
  if (avoidEnemies(creep)) {
    return;
  }
  if (creep.harvest(sourceByKey[creep.memory.sourceKey]) < 0) {
    creep.moveTo(sourceByKey[creep.memory.sourceKey]);
  } else if (creep.pos.y == 36 || (creep.pos.x == 47 && creep.pos.y == 37)) {
    creep.move(Game.BOTTOM);
  } else if (creep.pos.x == 2 || creep.pos.x == 3) {
    creep.move(Game.RIGHT);
  } else if (creep.pos.x == 47) {
    creep.move(Game.LEFT);
  } else if ((creep.pos.x < 9 && creep.pos.y < 8) ||
    (creep.pos.x < 10 && creep.pos.y < 5))
  {
    creep.moveTo(9, 6);
  }
  var chosenIndex = -1;
  var minFree = 100000;
  var localCreeps = creep.pos.findInRange(Game.MY_CREEPS, 1);
  for (var a = 0; a < localCreeps.length; a++) {
    if ((localCreeps[a].memory.role == 'carry' ||
      localCreeps[a].memory.role == 'builderCarry') &&
      (!('targetPos' in localCreeps[a]) ||
      calculateDistance(creep.pos, localCreeps[a].targetPos) < 4))
    {
      var freeSpace = localCreeps[a].energyCapacity - localCreeps[a].energy;
      if (freeSpace > 0 && freeSpace < minFree) {
        chosenIndex = a;
        minFree = freeSpace;
      }
    }
  }
  if (chosenIndex >= 0) {
    creep.transferEnergy(localCreeps[chosenIndex]);
  }
});

createCrp('builder', 0, [Game.WORK, Game.WORK, Game.CARRY, Game.CARRY, Game.MOVE], function(creep) {
  if (!creep.memory.targetConstruction) {
    var sites = room.getPositionAt(
      creep.memory.workCenter.x, creep.memory.workCenter.y).findInRange(
      Game.CONSTRUCTION_SITES, 10);
    for (var a = 0; a < sites.length; a++) {
      if (!creep.memory.targetConstruction ||
        (creep.memory.workCenter.x > 27 &&
        sites[a].pos.x > creep.memory.targetConstruction.x) ||
        (creep.memory.workCenter.x <= 27 &&
        sites[a].pos.x < creep.memory.targetConstruction.x))
      {
        creep.memory.targetConstruction = sites[a].pos;
      }
    }
  }
  if (creep.memory.targetConstruction) {
    creep.moveTo(creep.memory.targetConstruction.x,
      creep.memory.targetConstruction.y - 1);
    var sites = room.getPositionAt(creep.memory.targetConstruction.x,
      creep.memory.targetConstruction.y).findInRange(
      Game.CONSTRUCTION_SITES, 0);
    if (sites.length) {
      creep.build(sites[0]);
    } else {
      delete creep.memory.targetConstruction;
    }
  }
});

createCrp('spawnBuilder', 0, [Game.WORK, Game.WORK, Game.CARRY, Game.CARRY, Game.MOVE], function(creep) {
  if (spawn.energy > 4000 || room.find(Game.MY_STRUCTURES).length <
    targetStructureCount)
  {
    spawn.transferEnergy(creep);
  }
  var sites = spawn.pos.findInRange(Game.CONSTRUCTION_SITES, 5);
  if (sites.length) {
    creep.build(sites[0]);
  }
  var exts = spawn.pos.findInRange(Game.MY_STRUCTURES, 5);
  for (var a = 0; a < exts.length; a++) {
    if (exts[a].structureType == Game.STRUCTURE_EXTENSION &&
      exts[a].energy < exts[a].energyCapacity)
    {
      creep.transferEnergy(exts[a]);
      break;
    }
  }
  if (creep.pos.x != spawn.pos.x + 1 || creep.pos.y != spawn.pos.y + 1) {
    creep.moveTo(spawn.pos.x + 1, spawn.pos.y + 1);
  }
});

createCrp('carry', 2, [Game.CARRY, Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE], function(creep) {
  if (enemies.length > enLimit) {
    return;
  }
  // if (creep.hitsMax - creep.hits > 400) {
    // creep.suicide();
    // return;
  // }
  if (avoidEnemies(creep)) {
    return;
  }
  if (creep.energy == creep.energyCapacity) {
    creep.memory.targetPos = spawn.pos;
  }
  if ('targetPos' in creep.memory) {
    if (calculateDistance(creep.memory.targetPos, creep.pos) < 2) {
      if (spawn.pos.equalsTo(creep.memory.targetPos) &&
        creep.transferEnergy(spawn) != Game.OK)
      {
        creep.move(spawn.pos.getDirectionTo(creep));
      }
      delete creep.memory.targetPos;
    } else {
      creep.moveTo(creep.memory.targetPos, {'reusePath': 2});
    }
  } else if (calculateDistance(spawn.pos, creep.pos) < 4) {
    // creep.say('#');
    creep.moveTo(spawn.pos.x, spawn.pos.y + 4);
  }
  var localDrops = creep.pos.findInRange(Game.DROPPED_ENERGY, 1);
  if (localDrops.length) {
    creep.pickup(localDrops[0]);
  }
});

createCrp('builderCarry', 0, [Game.CARRY, Game.CARRY, Game.CARRY, Game.CARRY, Game.MOVE], function(creep) {
  if (enemies.length > enLimit) {
    return;
  }
  var localDrops = creep.pos.findInRange(Game.DROPPED_ENERGY, 1);
  if (localDrops.length) {
    creep.pickup(localDrops[0]);
  }
  var workCenter = room.getPositionAt(creep.memory.workCenter.x,
    creep.memory.workCenter.y);
  if ('targetObj' in creep.memory) {
    if (calculateDistance(creep.memory.targetObj, creep.pos) < 2) {
      var obj = room.getPositionAt(creep.memory.targetObj.x,
        creep.memory.targetObj.y).findInRange(Game.MY_CREEPS, 0)[0];
      if (!obj) {
        obj = room.getPositionAt(creep.memory.targetObj.x,
          creep.memory.targetObj.y).findInRange(Game.MY_STRUCTURES, 0)[0];
      }
      creep.transferEnergy(obj);
      delete creep.memory.targetObj;
    } else {
      if (creep.moveTo(creep.memory.targetObj) != Game.OK) {
        delete creep.memory.targetObj;
      }
    }
  } else if ('sourceObj' in creep.memory) {
    if (calculateDistance(creep.pos, creep.memory.sourceObj) < 2 ||
      creep.moveTo(creep.memory.sourceObj.x, creep.memory.sourceObj.y) != Game.OK)
    {
      delete creep.memory.sourceObj;
    }
  } else if (creep.energy && creep.pos.findInRange(
    Game.CONSTRUCTION_SITES, 0).length == 0)
  {
    var minDistance = 100000;
    var localCreeps = workCenter.findInRange(Game.MY_CREEPS, 10);
    for (var a = 0; a < localCreeps.length; a++) {
      if (localCreeps[a].memory.role == 'builder' &&
        localCreeps[a].energy == 0)
      {
        creep.memory.targetObj = localCreeps[a].pos;
        break;
      }
    }
    if (!('targetObj' in creep.memory)) {
      var exts = workCenter.findInRange(Game.MY_STRUCTURES, 10);
      for (var a = 0; a < exts.length; a++) {
        if (exts[a].structureType == (spawn.pos.y > 27 ?
          Game.STRUCTURE_SPAWN : Game.STRUCTURE_EXTENSION) &&
          exts[a].energy < exts[a].energyCapacity)
        {
          var distance = calculateDistance(creep.pos, exts[a].pos);
          if (distance < minDistance) {
            creep.memory.targetObj = exts[a].pos;
          }
        }
      }
    }
  } else {
    var minDistance = 100000;
    localDrops = workCenter.findInRange(Game.DROPPED_ENERGY, 10);
    for (var a = 0; a < localDrops.length; a++) {
      var distance = (localDrops[a].energy > 200 ? 0 :
        calculateDistance(creep.pos, localDrops[a].pos));
      if (distance < minDistance) {
        minDistance = distance;
        creep.memory.sourceObj = localDrops[a].pos;
      }
    }
    if (minDistance > 0) {
      var localCreeps = workCenter.findInRange(Game.MY_CREEPS, 10);
      for (var a = 0; a < localCreeps.length; a++) {
        if (localCreeps[a].memory.role == 'harvester' &&
          localCreeps[a].energy)
        {
          var distance = calculateDistance(creep.pos, localCreeps[a].pos);
          if (distance < minDistance) {
            minDistance = distance;
            creep.memory.sourceObj = localCreeps[a].pos;
          }
        }
      }
    }
  }
});

createCrp('healer', 0, [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.MOVE, Game.HEAL, Game.HEAL, Game.HEAL, Game.HEAL], function(creep) {
  if (enemies.length > healLimit) {
    return;
  }
  // if (avoidEnemies(creep)) {
  // return;
  // }
  var chosenIndex = -1;
  for (var a = 0; a < healTargets.length; a++) {
    if (healTargets[a] != creep) {
      distance = calculateDistance(creep.pos, healTargets[a].pos);
      if (distance < 4) {
        chosenIndex = a;
        break;
      // } else if (chosenIndex < 0 && distance < 4) {
        // chosenIndex = a;
      }
    }
  }
  if (chosenIndex > -1) {
    var target = healTargets[chosenIndex];
    if (creep.heal(target) < 0) {
      creep.rangedHeal(target);
    }
    // var index = (healTargets[0] == creep ? chosenIndex : 0);
    // if (calculateDistance(creep.pos, healTargets[index].pos) > 2) {
      // creep.moveTo(healTargets[index].pos.x, grY + 2);
    // }
    return;
  }
  // if (creep.pos.y - grY < 3 || calculateDistance(spawn.pos, creep.pos) < 3) {
    // creep.moveTo(grX + 2, grY + 3);
  // }
});

createCrp('guard', 100, [
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.MOVE, Game.RANGED_ATTACK, Game.RANGED_ATTACK, Game.RANGED_ATTACK,
  Game.RANGED_ATTACK],
  function(creep)
{
  if (creep.pos.findInRange(Game.HOSTILE_CREEPS, 1).length > 0) {
    creep.rangedMassAttack();
  } else {
    for (var a = 0; a < enemies.length; a++) {
      if (calculateDistance(creep.pos, enemies[a].pos) < 4) {
        creep.rangedAttack(enemies[a]);
        break;
      }
    }
  }
  if (spawn.pos.y > 27) {
    creep.moveTo(11, 42);
  }
});

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  var myCrp = crp[typeName];
  if (creep.ticksToLive > (creep.pos.y > 27 != spawn.pos.y > 27 ?
    lifeLongLimit : lifeLimit))
  {
    crp[creep.memory.role].count++;
  }
  if (crp[creep.memory.role] && !creep.spawning) {
    crp[creep.memory.role].action(creep);
  }
}

function getMovable(x, y) {
  var o = getObstacle(x, y);
  var c = (o ? o.creep : null);
  return (c && c.my && (c.memory.role == 'healer' ||
    c.memory.role == 'guard') && !c.fatigue) ? c : null;
}

function moveMovable(m, d) {
  var arr = roomGrid[m.pos.y][m.pos.x];
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type == 'creep') {
      arr.splice(a, 1);
      break;
    }
  }
  roomGrid[y - (d == Game.LEFT ? 0 : 1)][x - (d == Game.TOP ? 0 : 1)].push(m);
  m.move(d);
}

for (var y = grY; y <= grYe; y++) {
  for (var x = grX; x <= grXe; x++) {
    if (!getObstacle(x, y)) {
      var m = getMovable(x + 1, y);
      if (m && (y - grY < 2 || m.memory.role == 'healer')) {
          console.log('left ');
        moveMovable(m, Game.LEFT);
      } else {
        m = getMovable(x + 1, y + 1);
        if (m && (!getObstacle(x, y + 1) || !getObstacle(x + 1, y)) &&
          (y - grY > 1 || m.memory.role == 'guard'))
        {
          console.log('topleft ');
          moveMovable(m, Game.TOP_LEFT);
        } else {
          m = getMovable(x, y + 1);
          if (m && (y - grY > 1 || m.memory.role == 'guard')) {
            console.log('top');
            moveMovable(m, Game.TOP);
          }
        }
      }
    }
  }
}

crp.harvester.maxCount = 2;
crp.carry.maxCount = 2;
if (crp.guard.count > 0) {
  crp.harvester.maxCount = 6;
  crp.carry.maxCount = 8;
  crp.healer.maxCount = 1;
}
if (crp.guard.count > 1) {
  crp.carry.maxCount = 12;
} else {
  crp.guard.body = [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
    Game.TOUGH, Game.MOVE, Game.RANGED_ATTACK, Game.RANGED_ATTACK,
    Game.RANGED_ATTACK, Game.RANGED_ATTACK];
}
if (crp.guard.count > 2) {
  crp.harvester.maxCount = 10;
}
if (crp.guard.count > 3) {
  if (structs.length + crp.builder.count < targetStructureCount) {
    crp.builder.maxCount = 2;
  }
  crp.builderCarry.maxCount = 2;
}
// if (crp.guard.count > 4) {
  // crp.spawnBuilder.maxCount = 1;
// }
if (crp.guard.count > 6) {
  crp.healer.maxCount = 4;
}
if (crp.guard.count > 10) {
  crp.healer.maxCount = 9;
}
if (crp.guard.count > 100) {
  crp.healer.maxCount = 20;
}
if (spawn.pos.y > 27) {
  crp.harvester.maxCount = 4;
  crp.carry.maxCount = 0;
  crp.builderCarry.maxCount = 0;
  crp.healer.maxCount = 0;
  crp.guard.body = [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.MOVE];
}

var extCount = 0;
var limit = (spawn.pos.y > 27 ? 0 : (targetStructureCount > structs.length ? 2 : 5));
for (var a = 0; a < structs.length && extCount < limit; a++) {
  if (structs[a].structureType == Game.STRUCTURE_EXTENSION) {
    extCount++;
    crp.guard.body.splice(0, 1);
    crp.guard.body.push(Game.RANGED_ATTACK);
    crp.healer.body.push(Game.HEAL);
    if (crp.carry.body.length < 6) {
      crp.carry.body.push(Game.MOVE);
      // crp.carry.maxCount = 8;
    }
    if (crp.builderCarry.body.length < 6) {
      crp.builderCarry.body.push(Game.MOVE);
    }
  }
}

for (var typeName in crp) {
  var myCrp = crp[typeName];
  if (myCrp.count < myCrp.maxCount) {
    // for(var i in Game.spawns) {
      // var mySpawn = Game.spawns[i];
      var mySpawn = spawn;
      if (!mySpawn.spawning) {
        var mem = {role: myCrp.typeName};
        if (myCrp.typeName == 'harvester') {
          var minDistance = 100000;
          var chosenIndex = -1;
          var chosenBottom = -1;
          for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
            var distance = calculateDistance(mySpawn.pos, sources[sourceIndex].pos);
            if (sources[sourceIndex].assCount < 2 && distance < minDistance) {
              if (sources[sourceIndex].pos.y > 27 != spawn.pos.y > 27) {
                chosenBottom = sourceIndex;
              } else {
                minDistance = distance;
                chosenIndex = sourceIndex;
              }
            }
          }
          mem.sourceKey = sources[chosenIndex >= 0 ? chosenIndex : chosenBottom].id;
        } else if (myCrp.typeName == 'builder') {
          mem.workCenter = {'x': (hasLeftBuilder ? 46 : 3), 'y': 37};
          mem.targetConstruction = null;
        } else if (myCrp.typeName == 'builderCarry') {
          mem.workCenter = {'x': (hasLeftBuilderCarry ? 46 : 3), 'y': 37};
        }
        mySpawn.createCreep(myCrp.body, null, mem);
      }
     // }
    break;
  }
}
