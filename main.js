var lifeLimit = 60;
var lifeLongLimit = 190;
var allowLooting = true;
var tooHighCPU = false;
var enemySafeDistance = 6;
var STRAT_JAN = 0;
var STRAT_FEB = 1;
var crp = {};

function updateCPU() {
  Game.getUsedCpu(function(cpu) {
    if (cpu > Game.cpuLimit * 3 / 4) {
      tooHighCPU = true;
    }
  });
}

function prep4mem(pos) {
  return {'x': pos.x, 'y': pos.y};
}

function createPos(x, y) {
  x = Math.max(0, Math.min(49, x));
  y = Math.max(0, Math.min(49, y));
  return {'x': x, 'y': y};
}

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

function addToObstacles(obj) {
  if (!obj.isInObstacles) {
    obstacles.push(obj);
    obj.isInObstacles = true;
  }
}

function addToToMove(creep) {
  if (creep.memory.path && creep.memory.path.length) {
    creep.isDiag = (creep.memory.path[0].dx != 0 && creep.memory.path[0].dy != 0);
    toMove.push(creep);
  } else {
    creep.memory.isAvoidingEnemy = false;
    delete creep.memory.targetPos;
  }
}

function avoidEnemies(creep) {
  var enemy = creep.pos.findInRange(Game.HOSTILE_CREEPS, enemySafeDistance);
  if (enemy.length) {
    // if (strat == STRAT_FEB) {
      // creep.memory.targetPos = createPos(3, 44);
    // } else {
      creep.memory.targetPos = createPos(creep.pos.x - (enemy[0].pos.x -
        creep.pos.x), creep.pos.y - (enemy[0].pos.y - creep.pos.y));
    // }
    creep.memory.isAvoidingEnemy = true;
  }
  if (creep.memory.targetPos && creep.memory.isAvoidingEnemy) {
    if (calculateDistance(creep.pos, creep.memory.targetPos) < 2) {
      delete creep.memory.isAvoidingEnemy;
    } else {
      return true;
    }
  }
  return false;
}

function handleTargetPos(creep) {
  if ('targetPos' in creep.memory) {
    var targetPos = room.getPositionAt(creep.memory.targetPos.x,
      creep.memory.targetPos.y);
    if (targetPos && (!('path' in creep.memory) || !targetPos.equalsTo(
      creep.memory.path[creep.memory.path.length - 1]) ||
      calculateDistance(creep.pos, creep.memory.path[0]) > 1))
    {
      if (!tooHighCPU) {
        creep.memory.path = room.findPath(creep.pos, targetPos, {
          'ignoreCreeps': true,
          'avoid': obstacles.concat(creep.memory.isAvoidingEnemy ? [] : enemyFence)
        });
        updateCPU();
      }
    } else if (creep.pos.equalsTo(creep.memory.path[0])) {
      creep.memory.lastMoveTime = Game.time;
      if (creep.memory.path.length == 1) {
        delete creep.memory.path;
      } else {
        creep.memory.path.splice(0, 1);
      }
    }
    addToToMove(creep);
  }
}

function build(x, y, type) {
  room.createConstructionSite(x, y, (type ? type : Game.STRUCTURE_EXTENSION));
  targetStructureCount += (type == Game.STRUCTURE_SPAWN ? 9 : 1);
}

function getObstacle(x, y) {
  if (x < 0 || x > 49 || y < 0 || y > 49) {
    return {'type': 'terrain', 'terrain': 'wall'};
  }
  var o = roomGrid[y][x];
  for (var a = 0; a < o.length; a++) {
    if (o[a].type == 'creep' || (o[a].type == 'terrain' &&
      o[a].terrain == 'wall') || (o[a].type == 'structure' &&
      !(o[a].structure.structureType == 'rampart' && o[a].structure.my)))
    {
      return o[a];
    }
  }
  return null;
}

function toIndex(pos) {
  if (strat == STRAT_JAN) {
    var index = pos.x / 18 >> 0;
  } else {
    var index = 0;
    var minDistance = 100000;
    for (var a = 0; a < sources.length; a++) {
      var distance = calculateDistance(sources[a].pos, pos);
      if (distance < minDistance) {
        index = a;
        minDistance = distance;
      }
    }
  }
  return index;
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
  if (!spawn) {
    return false;
  } else if (pos.findInRange(Game.SOURCES, 1).length) {
    var sourceAreaIndex = toIndex(pos);
    var distanceRate = Math.max(1, (calculateDistance(pos, spawn.pos) /
      5 >> 0) - 1);
    return (sourceAreas[sourceAreaIndex].energy > -100 * (distanceRate - 1) ||
      sourceAreas[sourceAreaIndex].carries < distanceRate);
  } else {
    return true;
  }
}

function addToDrops(pos, energy, isCarry) {
  if (strat == STRAT_JAN && spawn && pos.y > 27 != spawn.pos.y > 27) {
    return;
  }
  if (!isCarry) {
    var pos2 = {}
    for (var y = -1; y < 2; y++) {
      for (var x = -1; x < 2; x++) {
        pos2.x = pos.x + x;
        pos2.y = pos.y + y;
        var obstacle = getObstacle(pos2.x, pos2.y);
        if (!obstacle || (obstacle.type == 'creep' && obstacle.creep.my &&
          obstacle.creep.memory.role == 'carry'))
        {
          var key = pos2key(pos2);
          if (key in dropsArea) {
            dropsArea[key] += energy;
          } else {
            dropsArea[key] = energy;
          }
        }
      }
    }
  }

  var key = pos2key(pos);
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

function pos2key(pos) {
  return pos.x + ' ' + pos.y;
}

function addToGrid(obj) {
  grXe = Math.max(grXe, obj.pos.x);
  grYe = Math.max(grYe, obj.pos.y);
}

function getMovable(x, y) {
  var o = getObstacle(x, y);
  var c = (o ? o.creep : null);
  return (c && c.my && (c.memory.role == 'healer' ||
    c.memory.role == 'guard') && !c.fatigue) ? c : null;
}

function updateRoomGrid(creep, x, y, dx, dy) {
  var arr = roomGrid[y][x];
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type == 'creep' && arr[a].creep == creep) {
      arr.splice(a, 1);
      break;
    }
  }
  roomGrid[y + dy][x + dx].push({
    'type': 'creep',
    'creep': creep
  });
}

function moveCreep(creep, dx, dy) {
  if (creep.move(creep.pos.getDirectionTo(creep.pos.x + dx,
    creep.pos.y + dy)) == Game.OK)
  {
    updateRoomGrid(creep, creep.pos.x, creep.pos.y, dx, dy);
  }
}

function doChainLocalMove(creep, moveIndex, firstCreep) {
  if (creep.memory.path.length) {
    var node = creep.memory.path[0];
    var obstacle = getObstacle(node.x, node.y);
    if (!obstacle || obstacle.type == 'creep' && doChainMove(obstacle.creep,
      moveIndex, firstCreep, creep))
    {
      moveCreep(creep, node.dx, node.dy);
      return null;
    }
    return obstacle;
  }
  return creep;
}

function doChainMove(creep, moveIndex, firstCreep, prevCreep) {
  if (creep.my && ('targetPos' in creep.memory)) {
    if (!('path' in creep.memory) || !creep.memory.path.length) {
      creep.memory.isAvoidingEnemy = false;
      delete creep.memory.targetPos;
    } else if ('moveIndex' in creep) {
      // Circular movement => true
      return (creep.moveIndex == moveIndex && creep == firstCreep);
    } else if (!firstCreep.isDiag && creep.isDiag) {
      // Chain of moves depend on a diagonal movement, save
      // it until all non-diagonal movements have been made.
      firstCreep.isDiag = true;
    } else {
      creep.moveIndex = moveIndex;
      if (prevCreep && prevCreep.memory.isAvoidingEnemy &&
        !creep.memory.isAvoidingEnemy && prevCreep.memory.path.length > 1)
      {
        creep.memory.isAvoidingEnemy = true;
        creep.memory.path = [];
        for (var a = 1; a < prevCreep.memory.path.length; a++) {
          creep.memory.path.push(prevCreep.memory.path[a]);
        }
        var node = prevCreep.memory.path[prevCreep.memory.path.length - 1];
        creep.memory.path.push({
          'x': node.x + node.dx,
          'y': node.y + node.dy,
          'dx': node.dx,
          'dy': node.dy,
          'direction': node.direction
        });
      }
      var obstacle = doChainLocalMove(creep, moveIndex, firstCreep);
      if (obstacle) {
        // creep.say(Game.time - creep.memory.lastMoveTime);
        if (!obstacle.creep || !obstacle.creep.my ||
          !obstacle.creep.memory || obstacle.creep.memory.role != 'carry')
        {
          creep.memory.isAvoidingEnemy = false;
          delete creep.memory.path;
          delete creep.memory.targetPos;
        } else if (!creep.memory.lastMoveTime) {
          creep.memory.lastMoveTime = Game.time;
        } else if (!tooHighCPU) {
          var find1 = (creep.memory.isAvoidingEnemy ||
            Game.time - creep.memory.lastMoveTime > 3);
          if (find1) {
            var targetPos = room.getPositionAt(creep.memory.targetPos.x,
              creep.memory.targetPos.y);
            if (targetPos) {
              var path = room.findPath(creep.pos, targetPos, {
                'ignoreCreeps': !find1,
                'avoid': obstacles.concat(obstacle[obstacle.type]
                  ).concat(creep.memory.isAvoidingEnemy ? [] : enemyFence)
              });
              updateCPU();
              if (path.length) {
                creep.memory.path = path;
                obstacle = doChainLocalMove(creep, moveIndex, firstCreep);
              }
            }
          }
        }
      }
      if (obstacle) {
        delete creep.moveIndex;
      } else {
        return true;
      }
    }
  }
  return false;
}

// #############################################################

// console.log('#######################################');

for (var key in Memory.creeps) {
  if (!(key in Game.creeps)) {
    delete Memory.creeps[key];
  }
}

for (var key in Memory.rooms) {
  if (!(key in Game.rooms)) {
    delete Memory.rooms[key];
  }
}

for (var roomKey in Game.rooms) {
var room = Game.rooms[roomKey];
var exitCount = 0;
exitCount += (room.find(Game.EXIT_TOP).length ? 1 : 0);
exitCount += (room.find(Game.EXIT_RIGHT).length ? 1 : 0);
exitCount += (room.find(Game.EXIT_BOTTOM).length ? 1 : 0);
exitCount += (room.find(Game.EXIT_LEFT).length ? 1 : 0);
var strat = (exitCount > 1 ? STRAT_FEB : STRAT_JAN);
var grXe = -1;
var grYe = -1;
var roomGrid = room.lookAtArea(0, 0, 49, 49);
var toMove = [];
var obstacles = [];
var enemyFence = [];
var spawns = room.find(Game.MY_SPAWNS);
for (var a = 0; a < spawns.length; a++) {
  var spawn = spawns[a];
  if (spawns[a].pos.y < 27) {
    break;
  }
}
if (strat == STRAT_JAN) {
  var grX = 21;
  var grY = 9;
} else {
  var grX = 6;
  var grY = 38;
}
var structs = room.find(Game.MY_STRUCTURES);
var targetStructureCount = 9;
var sources = room.find(Game.SOURCES);
var sourceByKey = {};
var sourceAreas = [];
for (var a = 0; a < sources.length; a++) {
  sources[a].assCount = 0;
  sourceByKey[sources[a].id] = sources[a];
  sourceAreas.push({'carries': 0, 'energy': 0});
}
var healTargets = [];
var drops = {};
var dropsArea = {};
var freeCarries = [];
var hasLeftBuilder = false;
var hasLeftBuilderCarry = false;
var tmpEnemies = room.find(Game.HOSTILE_CREEPS);
var enemies = [];

if (strat == STRAT_JAN && spawn) {
  build(3, 41);
  build(4, 41);
  build(5, 41);
  build(46, 42);
  build(45, 42);
  build(44, 42);
  // build(spawn.pos.x, spawn.pos.y + 2);
  build(spawn.pos.x + 1, spawn.pos.y + 2);
  build(spawn.pos.x + 2, spawn.pos.y + 2);
  build(spawn.pos.x + 2, spawn.pos.y + 1);
  // build(spawn.pos.x + 2, spawn.pos.y);
  // build(spawn.pos.x, spawn.pos.y + 3, Game.STRUCTURE_SPAWN);
  build(7, 41, Game.STRUCTURE_SPAWN);
}

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

if (enemies.length) {
  var yStart = Math.max(0, enemies[0].pos.y - enemySafeDistance);
  var yEnd = Math.min(49, enemies[0].pos.y + enemySafeDistance);
  var xStart = Math.max(0, enemies[0].pos.x - enemySafeDistance);
  var xEnd = Math.min(49, enemies[0].pos.x + enemySafeDistance);
  for (var x = xStart; x <= xEnd; x++) {
    enemyFence.push(room.getPositionAt(x, yStart));
  }
  for (var y = yStart + 1; y < yEnd; y++) {
    enemyFence.push(room.getPositionAt(xStart, y));
    enemyFence.push(room.getPositionAt(xEnd, y));
  }
  for (var x = xStart; x <= xEnd; x++) {
    enemyFence.push(room.getPositionAt(x, yEnd));
  }
}

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  if (creep.spawning) {
    continue;
  }
  if (creep.hits < creep.hitsMax) {
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
  if (creep.memory.role != 'carry') {
    addToObstacles(creep);
  }
  if (creep.memory.role == 'guard' || creep.memory.role == 'healer') {
    addToGrid(creep);
  } else {
    if (creep.memory.role == 'harvester') {
      if (creep.ticksToLive > (spawn && creep.pos.y > 27 != spawn.pos.y > 27 ?
        lifeLongLimit : lifeLimit))
      {
        sourceByKey[creep.memory.sourceKey].assCount++;
      }
      if (creep.energy) {
        addToDrops(creep.pos, creep.energy, false);
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
  if (strat == STRAT_FEB || (allowLooting && enemies.length == 0) ||
    !(drops2[a].pos.x > 16 && drops2[a].pos.x < 30 && drops2[a].pos.y < 9))
  {
    addToDrops(drops2[a].pos, drops2[a].energy, false);
  }
}

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  if (creep.spawning || creep.memory.role != 'carry') {
    continue;
  }
  if ('safePos' in creep.memory) {
    delete creep.memory.targetDrop;
  } else {
    var spaceFree = creep.energyCapacity - creep.energy;
    if (spaceFree) {
      if ('targetDrop' in creep.memory) {
        var obstacle = getObstacle(creep.memory.targetDrop.x,
          creep.memory.targetDrop.y);
        if ((obstacle && obstacle.creep && obstacle.creep.my &&
          obstacle.creep.memory.role == 'harvester') ||
          dropsArea[pos2key(creep.memory.targetDrop)] > 0)
        {
          creep.memory.targetPos = creep.memory.targetDrop;
        } else {
          delete creep.memory.targetDrop;
        }
      }
      if (!('targetDrop' in creep.memory)) {
        freeCarries.push(creep);
      } else {
        addToDrops(creep.memory.targetDrop, -spaceFree, true);
      }
    } else {
      delete creep.memory.targetDrop;
    }
  }
}

for (var a = 0; a < freeCarries.length; a++) {
  var creep = freeCarries[a];
  var freeSpace = creep.energyCapacity - creep.energy
  var chosenKey = '';
  var minDistance = 100000;
  for (var key in drops) {
    var pos = posFromKey(key);
    var distance = calculateDistance(creep.pos, pos);
    if (drops[key] < freeSpace) {
      distance += 3;
    }
    if (distance < minDistance && (distance < 2 && creep.energy ||
      shouldAddCarry(pos)))
    {
      minDistance = distance;
      chosenKey = key;
    }
  }
  if (minDistance > 4 && creep.energy) {
    creep.memory.targetPos = prep4mem(spawn.pos);
  } else if (chosenKey !== '') {
    var targetPos = posFromKey(chosenKey);
    creep.memory.targetDrop = creep.memory.targetPos = prep4mem(targetPos);
    addToDrops(targetPos, -freeSpace, true);
  }
}

createCrp('harvester', 2, [Game.WORK, Game.WORK, Game.WORK, Game.CARRY, Game.MOVE], function(creep) {
  if (strat == STRAT_FEB && avoidEnemies(creep)) {
    handleTargetPos(creep);
    return;
  }
  if (creep.harvest(sourceByKey[creep.memory.sourceKey]) < 0) {
    creep.moveTo(sourceByKey[creep.memory.sourceKey]);
  } else if (strat == STRAT_JAN) {
    if (creep.pos.y == 36 || (creep.pos.x == 47 && creep.pos.y == 37)) {
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
  if (structs.length == targetStructureCount) {
    creep.suicide();
  }
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
        creep.memory.targetConstruction = prep4mem(sites[a].pos);
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
  if (!spawn) {
    return;
  }
  spawn.transferEnergy(creep);
  var sites = spawn.pos.findInRange(Game.CONSTRUCTION_SITES, 5);
  if (sites.length) {
    creep.build(sites[0]);
  }
  var exts = spawn.pos.findInRange(Game.MY_STRUCTURES, 5);
  for (var a = 0; a < exts.length; a++) {
    if (exts[a].structureType == Game.STRUCTURE_EXTENSION &&
      exts[a].energy < exts[a].energyCapacity && spawn.energy > 4000)
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
  if (!spawn) {
    return;
  }
  if (creep.hitsMax - creep.hits >= 300) {
    creep.suicide();
    return;
  }
  avoidEnemies(creep);
  if (!creep.memory.isAvoidingEnemy && creep.energy == creep.energyCapacity) {
    creep.memory.targetPos = prep4mem(spawn.pos);
  }
  if ('targetPos' in creep.memory) {
    if (calculateDistance(creep.memory.targetPos, creep.pos) < 2) {
      if (spawn.pos.equalsTo(creep.memory.targetPos) &&
        creep.transferEnergy(spawn) != Game.OK)
      {
        creep.memory.targetPos.x -= 2 * (creep.memory.targetPos.x - creep.pos.x);
        creep.memory.targetPos.y -= 2 * (creep.memory.targetPos.y - creep.pos.y);
      } else if (creep.pos.equalsTo(creep.memory.targetPos) ||
        getObstacle(creep.memory.targetPos.x, creep.memory.targetPos.y))
      {
        delete creep.memory.targetPos;
        delete creep.memory.path;
        delete creep.memory.lastMoveTime;
      }
    }
  } else if (strat == STRAT_JAN && calculateDistance(spawn.pos, creep.pos) < 4) {
    creep.memory.targetPos = createPos(spawn.pos.x, spawn.pos.y + 8);
  }
  handleTargetPos(creep);
  if (creep.energy < creep.energyCapacity) {
    if (!('targetPos' in creep.memory)) {
      var maxEnergy = 0;
      var pos = {};
      var bestPos = prep4mem(creep.pos);
      for (var y = -1; y < 2; y++) {
        for (var x = -1; x < 2; x++) {
          pos.x = creep.pos.x + x;
          pos.y = creep.pos.y + y;
          var key = pos2key(pos);
          if (key in dropsArea && dropsArea[key] > maxEnergy) {
            maxEnergy = dropsArea[key];
            bestPos = prep4mem(pos);
          }
        }
      }
      var key = pos2key(creep.pos);
      if (maxEnergy > ((key in dropsArea) ? dropsArea[key] : 0)) {
        creep.move(creep.pos.getDirectionTo(bestPos));
        creep.memory.targetDrop = bestPos;
      }
    }
    var localDrops = creep.pos.findInRange(Game.DROPPED_ENERGY, 1);
    for (var a = 0; a < localDrops.length; a++) {
      creep.pickup(localDrops[a]);
    }
  }
});

createCrp('builderCarry', 0, [Game.CARRY, Game.CARRY, Game.CARRY, Game.CARRY, Game.MOVE], function(creep) {
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
        creep.memory.targetObj = prep4mem(localCreeps[a].pos);
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
            creep.memory.targetObj = prep4mem(exts[a].pos);
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
        creep.memory.sourceObj = prep4mem(localDrops[a].pos);
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
            creep.memory.sourceObj = prep4mem(localCreeps[a].pos);
          }
        }
      }
    }
  }
});

createCrp('healer', 0, [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.MOVE, Game.HEAL, Game.HEAL, Game.HEAL, Game.HEAL], function(creep) {
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
  if (strat == STRAT_FEB) {
    if (creep.pos.y > grY + 4 && creep.pos.x < 9) {
      creep.move(Game.TOP_RIGHT);
    } else if (creep.pos.y > grY + 2) {
      creep.move(Game.TOP);
    }
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
  if (strat == STRAT_FEB && creep.pos.y > grY + 2) {
    creep.move(Game.TOP_RIGHT);
  }
  if (strat == STRAT_JAN && spawn && spawn.pos.y > 27) {
    creep.moveTo(11, 42);
  }
});

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  var myCrp = crp[typeName];
  if (creep.ticksToLive > (spawn && creep.pos.y > 27 != spawn.pos.y > 27 ?
    lifeLongLimit : lifeLimit))
  {
    crp[creep.memory.role].count++;
  }
  if (crp[creep.memory.role] && !creep.spawning) {
    crp[creep.memory.role].action(creep);
  }
}

if (crp.guard.count > 11) {
  grX--;
}
if (crp.guard.count > 13) {
  grX--;
}

for (var y = grY; y <= (strat == STRAT_JAN ? grYe : grY + 3); y++) {
  for (var x = grX; x <= grXe; x++) {
    if (!getObstacle(x, y)) {
      var m = getMovable(x + 1, y);
      if (m && (strat != STRAT_JAN || x - grX >= y - grY) &&
        (y - grY < 2 || m.memory.role == 'healer'))
      {
        moveCreep(m, -1, 0);
      } else {
        m = getMovable(x, y + 1);
        if (m && (y - grY > 1 || m.memory.role == 'guard')) {
          moveCreep(m, 0, -1);
        } else if (strat == STRAT_JAN) {
          m = getMovable(x + 1, y + 1);
          if (m && (!getObstacle(x, y + 1) || !getObstacle(x + 1, y)) &&
            (y - grY > 1 || m.memory.role == 'guard'))
          {
            moveCreep(m, -1, -1);
          }
        }
      }
    }
  }
}

var moveIndex = 0;
var isAvoidingEnemy = true;
for (var a = 0; a < 2; a++) {
  var isDiag = false;
  for (var b = 0; b < 2; b++) {
    for (var c = 0; c < toMove.length; c++) {
      moveIndex++;
      var creep = toMove[c];
      if (creep.memory && !!creep.memory.isAvoidingEnemy == isAvoidingEnemy &&
        creep.isDiag == isDiag)
      {
        doChainMove(creep, moveIndex, creep);
      }
    }
    isDiag = true;
  }
  isAvoidingEnemy = false;
}

if (strat == STRAT_JAN) {
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
    crp.builder.maxCount = Math.max(0, Math.min(2, targetStructureCount -
      structs.length - 8));
    crp.builderCarry.maxCount = 2;
  }
  if (crp.guard.count > 4) {
    crp.spawnBuilder.maxCount = 1;
  }
  if (crp.guard.count > 6) {
    crp.healer.maxCount = 4;
  }
  if (crp.guard.count > 10) {
    crp.healer.maxCount = 8;
  }
  if (crp.guard.count > 100) {
    crp.healer.maxCount = 20;
  }
  if (spawn && spawn.pos.y > 27) {
    crp.harvester.maxCount = 4;
    crp.carry.maxCount = 0;
    crp.builderCarry.maxCount = 0;
    crp.healer.maxCount = 0;
    crp.guard.body = [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.MOVE];
  }
  var extCount = 0;
  var limit = (spawn && spawn.pos.y > 27 ? 0 : (targetStructureCount > structs.length ?
    Math.max(2, 5 - Math.max(0, targetStructureCount - structs.length - 10)) : 5));
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
} else {
  crp.carry.body = [Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE];
  crp.harvester.maxCount = 2;
  crp.carry.maxCount = 1;
  if (crp.guard.count > 0) {
    crp.harvester.maxCount = 4;
    crp.carry.maxCount = 5;
    crp.healer.maxCount = 1;
  }
  if (crp.guard.count > 1) {
  } else {
    crp.guard.body = [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
      Game.TOUGH, Game.MOVE, Game.RANGED_ATTACK, Game.RANGED_ATTACK,
      Game.RANGED_ATTACK, Game.RANGED_ATTACK];
  }
  if (crp.guard.count > 6) {
    crp.healer.maxCount = 4;
  }
  if (crp.guard.count > 10) {
    crp.healer.maxCount = 8;
  }
  if (crp.guard.count > 100) {
    crp.healer.maxCount = 20;
  }
}

for (var typeName in crp) {
  var myCrp = crp[typeName];
  if (spawn && myCrp.count < myCrp.maxCount) {
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
            if (strat == STRAT_FEB && sources[sourceIndex].pos.y != 47 &&
              sources[sourceIndex].pos.y != 2)
            {
              continue;
            }
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
          if (strat == STRAT_FEB && chosenIndex < 0 && chosenBottom >= 0) {
            myCrp.body = [Game.WORK, Game.WORK, Game.MOVE, Game.MOVE];
          }
        } else if (myCrp.typeName == 'builder') {
          mem.workCenter = createPos((hasLeftBuilder ? 46 : 3), 37);
          mem.targetConstruction = null;
        } else if (myCrp.typeName == 'builderCarry') {
          mem.workCenter = createPos((hasLeftBuilderCarry ? 46 : 3), 37);
        }
        mySpawn.createCreep(myCrp.body, null, mem);
      }
     // }
    break;
  }
}
}
