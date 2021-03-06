var lifeLimit = 60;
var lifeLongLimit = 190;
var tooHighCPU = false;
var STRAT_JAN = 0;
var STRAT_FEB = 1;
var STRAT_FEB2 = 2;
var crp = {};
var minDrop = 100;

var creepName = 'Colton';
function log(creep, text) {
  if (creep.name == creepName) {
    console.log(text);
  }
}

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
    'sideCount': {true: 0, false: 0},
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
    delete creep.memory.isAvoidingEnemy;
    delete creep.memory.targetPos;
  }
}

function rotLeft2(obj, creep) {
  if (obj.dx == -1 && obj.dy < 1) {
    obj.dy++;
  } else if (obj.dy == 1 && obj.dx < 1) {
    obj.dx++;
  } else if (obj.dx == 1 && obj.dy > -1) {
    obj.dy--;
  } else {
    obj.dx--;
  }
  return isNonCombat(getObstacle(creep.pos.x + obj.dx,
      creep.pos.y + obj.dy, obj.avoidSwamp));
}

function rotLeft(obj, creep) {
  while (obj.count < 5) {
    obj.count++;
    if (rotLeft2(obj, creep)) {
      // Cannot move diagonally if blocked on both sides.
      if (obj.dx != 0 && obj.dy != 0) {
        obj2 = {'dx': obj.dx, 'dy': obj.dy};
        if (rotLeft2(obj2, creep)) {
          break;
        }
      } else {
        break;
      }
    }
  }
}

function rotRight2(obj, creep) {
  if (obj.dx == -1 && obj.dy > -1) {
    obj.dy--;
  } else if (obj.dy == 1 && obj.dx > -1) {
    obj.dx--;
  } else if (obj.dx == 1 && obj.dy < 1) {
    obj.dy++;
  } else {
    obj.dx++;
  }
  return isNonCombat(getObstacle(creep.pos.x + obj.dx,
    creep.pos.y + obj.dy, obj.avoidSwamp));
}

function rotRight(obj, creep) {
  while (obj.count < 5) {
    obj.count++;
    if (rotRight2(obj, creep)) {
      // Cannot move diagonally if blocked on both sides.
      if (obj.dx != 0 && obj.dy != 0) {
        obj2 = {'dx': obj.dx, 'dy': obj.dy};
        if (rotRight2(obj2, creep)) {
          break;
        }
      } else {
        break;
      }
    }
  }
}

function doBestRot(obj, creep, rotObjLeft, rotObjRight, avoidSwamp) {
  rotObjLeft.dx = obj.dx;
  rotObjLeft.dy = obj.dy;
  rotObjLeft.count = 0;
  rotObjLeft.avoidSwamp = avoidSwamp;
  rotObjRight.dx = obj.dx;
  rotObjRight.dy = obj.dy;
  rotObjRight.count = 0;
  rotObjRight.avoidSwamp = avoidSwamp;
  if (obj.rot == 'left') {
    rotLeft(rotObjLeft, creep);
    if (rotObjLeft.count > 4) {
      rotRight(rotObjRight, creep);
    } else {
      rotObjRight.count = 5;
    }
  } else if (obj.rot == 'right') {
    rotRight(rotObjRight, creep);
    if (rotObjRight.count > 4) {
      rotLeft(rotObjLeft, creep);
    } else {
      rotObjLeft.count = 5;
    }
  } else {
    rotLeft(rotObjLeft, creep);
    rotRight(rotObjRight, creep);
  }
}

function moveDirection(obj, creep) {
  if (isNonCombat(getObstacle(creep.pos.x + obj.dx,
    creep.pos.y + obj.dy, true)))
  {
    // Try to avoid infinite loop.
    if (obj.rot == 'left') {
      obj.rot = 'right';
    } else if (obj.rot == 'right') {
      obj.rot = 'left';
    }
  } else {
    var rotObjLeft = {};
    var rotObjRight = {};
    doBestRot(obj, creep, rotObjLeft, rotObjRight, true);
    if (rotObjLeft.count > 2 && rotObjRight.count > 2) {
      if (isNonCombat(getObstacle(creep.pos.x + obj.dx,
        creep.pos.y + obj.dy, false)))
      {
        // Try to avoid infinite loop.
        if (obj.rot == 'left') {
          var adjRot = rotObjRight;
        } else {
          var adjRot = rotObjLeft;
        }
        adjRot.dx = obj.dx;
        adjRot.dy = obj.dy;
        adjRot.count = 0;
      } else {
        doBestRot(obj, creep, rotObjLeft, rotObjRight, false);
      }
    }
    if (rotObjLeft.count < rotObjRight.count) {
      obj.dx = rotObjLeft.dx;
      obj.dy = rotObjLeft.dy;
      obj.rot = 'left';
    } else {
      obj.dx = rotObjRight.dx;
      obj.dy = rotObjRight.dy;
      obj.rot = 'right';
    }
  }
  creep.memory.targetPos = createPos(creep.pos.x + obj.dx, creep.pos.y + obj.dy);
  creep.memory.path = [{
    'x': creep.memory.targetPos.x,
    'y': creep.memory.targetPos.y,
    'dx': obj.dx,
    'dy': obj.dy,
    'direction': creep.pos.getDirectionTo(creep.memory.targetPos)
  }];
}

function getClosest(creep, type, range) {
  var ret = null;
  var minDistance = 100000;
  var locals = creep.pos.findInRange(type, range);
  for (var a = 0; a < locals.length; a++) {
    var distance = calculateDistance(locals[a].pos, creep.pos);
    if (distance < minDistance) {
      minDistance = distance;
      ret = locals[a];
    }
  }
  return ret;
}

function createRotObj(pos1, pos2, rot) {
  return {
    'dx': (pos1.x == pos2.x ? 0 : (pos1.x - pos2.x < 0 ? -1 : 1)),
    'dy': (pos1.y == pos2.y ? 0 : (pos1.y - pos2.y < 0 ? -1 : 1)),
    'rot': rot
  };
}

function avoidEnemies(creep) {
  var enemy = getClosest(creep, Game.HOSTILE_CREEPS,
    enemySafeDistance + (creep.memory.isAvoidingEnemy ? 2 : 0));
  if (enemy) {
    var obj = createRotObj(creep.pos, enemy.pos, creep.memory.isAvoidingEnemy);
    moveDirection(obj, creep);
    creep.memory.isAvoidingEnemy = obj.rot;
    return true;
  }
  delete creep.memory.isAvoidingEnemy;
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
    } else if (creep.fatigue) {
      creep.memory.lastMoveTime = Game.time;
    }
    addToToMove(creep);
  }
}

function build(x, y, type) {
  room.createConstructionSite(x, y, (type ? type : Game.STRUCTURE_EXTENSION));
  targetStructureCount += (type == Game.STRUCTURE_SPAWN ? 9 : 1);
}

function getObstacle(x, y, avoidSwamp) {
  if (x < 1 || x > 48 || y < 1 || y > 48) {
    return {'type': 'terrain', 'terrain': 'wall'};
  }
  var o = roomGrid[y][x];
  for (var a = 0; a < o.length; a++) {
    if (o[a].type == 'creep' || (o[a].type == 'terrain' &&
      o[a].terrain == 'wall') || (o[a].type == 'structure' &&
      !(o[a].structure.structureType == 'rampart' && o[a].structure.my)) ||
      (avoidSwamp && o[a].terrain == 'swamp') ||
      (o[a].type == 'constructionSite' && o[a].constructionSite.progress))
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

function isNonCombat(obstacle) {
  return !obstacle; // || (obstacle.type == 'creep' &&
    //obstacle.creep.my && obstacle.creep.memory.path));
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
      delete creep.memory.isAvoidingEnemy;
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
        creep.memory.isAvoidingEnemy = prevCreep.memory.isAvoidingEnemy;
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
          !obstacle.creep.memory || (obstacle.creep.memory.role != 'carry' &&
          obstacle.creep.memory.role != 'hunter'))
        {
          delete creep.memory.isAvoidingEnemy;
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

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

createCrp('harvester', 2, [Game.WORK, Game.WORK, Game.WORK, Game.CARRY, Game.MOVE], function(creep) {
  if (strat != STRAT_JAN && avoidEnemies(creep)) {
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

createCrp('heavyHarvester', 0, [Game.WORK, Game.WORK, Game.WORK, Game.WORK, Game.MOVE], function(creep) {
  if (!creep.pos.equalsTo(createPos(25, 27))) {
    creep.moveTo(createPos(25, 27));
  } else {
    var sources = creep.pos.findInRange(Game.SOURCES, 1);
    for (var a = 0; a < sources.length; a++) {
      if (sources[a].energy) {
        creep.harvest(sources[a]);
        break;
      }
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
      exts[a].energy < exts[a].energyCapacity) // && spawn.energy > 4000)
    {
      creep.transferEnergy(exts[a]);
      break;
    }
  }
  if (strat == STRAT_JAN) {
    if (creep.pos.x != spawn.pos.x + 1 || creep.pos.y != spawn.pos.y + 1) {
      creep.moveTo(spawn.pos.x + 1, spawn.pos.y + 1);
    }
  } else {
    if (creep.pos.x != spawn.pos.x - 1 || creep.pos.y != spawn.pos.y - 1) {
      creep.moveTo(spawn.pos.x - 1, spawn.pos.y - 1);
    }
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
    if (!sites.length) {
      sites = room.find(Game.CONSTRUCTION_SITES);
    }
    for (var a = 0; a < sites.length; a++) {
      if (!creep.memory.targetConstruction ||
        (creep.memory.workCenter.x > 27 &&
        sites[a].pos.x > creep.memory.targetConstruction.x) ||
        (creep.memory.workCenter.x <= 27 &&
        sites[a].pos.x < creep.memory.targetConstruction.x) ||
        (sites[a].pos.x == creep.memory.targetConstruction.x &&
        sites[a].pos.y > creep.memory.targetConstruction.y))
      {
        creep.memory.targetConstruction = prep4mem(sites[a].pos);
      }
    }
  }
  if (creep.memory.targetConstruction) {
    var distance = calculateDistance(creep.memory.targetConstruction,
      creep.pos);
    if (distance > 1) {
      creep.moveTo(creep.memory.targetConstruction.x,
        creep.memory.targetConstruction.y - (strat == STRAT_JAN ? 1 : 0));
    } else if (distance == 0) {
      creep.moveTo(creep.pos.x, creep.pos.y - 2);
    } else {
      var sites = room.getPositionAt(creep.memory.targetConstruction.x,
        creep.memory.targetConstruction.y).findInRange(
        Game.CONSTRUCTION_SITES, 0);
      if (sites.length) {
        creep.build(sites[0]);
      } else {
        delete creep.memory.targetConstruction;
      }
    }
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
  // avoidEnemies(creep);
  if (!creep.memory.isAvoidingEnemy && creep.energy == creep.energyCapacity &&
    !('assignedBuilderName' in creep.memory))
  {
    if (strat == STRAT_FEB2) {
      for (var a = 0; a < builders.length; a++) {
        if (builders[a].energy < builders[a].energyCapacity &&
          !('assignedCarryName' in builders[a].memory) &&
          ('targetConstruction' in builders[a].memory) &&
          calculateDistance(builders[a].pos, builders[a].memory.targetConstruction) < 2)
        {
          builders[a].memory.assignedCarryName = creep.name;
          creep.memory.targetPos = prep4mem(builders[a].pos);
          creep.memory.assignedBuilderName = builders[a].name;
          break;
        }
      }
      if (!creep.memory.assignedBuilderName) {
        creep.memory.targetPos = prep4mem(spawn.pos);
      }
    } else {
      creep.memory.targetPos = prep4mem(spawn.pos);
    }
  }
  if (creep.memory.targetPos) {
    var distance = calculateDistance(creep.memory.targetPos, creep.pos);
    if (distance < 2) {
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
  } else if (!creep.memory.assignedBuilderName &&
    calculateDistance(spawn.pos, creep.pos) < 4)
  {
    if (strat == STRAT_JAN) {
      creep.memory.targetPos = createPos(spawn.pos.x, spawn.pos.y + 8);
    } else {
      creep.memory.targetPos = createPos(spawn.pos.x - 8, spawn.pos.y - 8);
    }
  }
  if (creep.memory.assignedBuilderName) {
    if (!(creep.memory.assignedBuilderName in Game.creeps)) {
      delete creep.memory.assignedBuilderName;
    } else {
      var builder = Game.creeps[creep.memory.assignedBuilderName];
      if (builder.energy == builder.energyCapacity ||
        !builder.memory.targetConstruction ||
        calculateDistance(builder.pos, builder.memory.targetConstruction) > 1)
      {
        delete creep.memory.assignedBuilderName;
        delete builder.memory.assignedCarryName;
      } else if (calculateDistance(creep.pos, builder.pos) > 1) {
        creep.memory.targetPos = prep4mem(builder.pos);
      } else {
        if (creep.energy <= builder.energyCapacity - builder.energy) {
          delete creep.memory.assignedBuilderName;
          delete builder.memory.assignedCarryName;
        }
        creep.transferEnergy(builder);
      }
    }
  }
  handleTargetPos(creep);
  if (!('assignedBuilderName' in creep.memory) &&
    creep.energy < creep.energyCapacity)
  {
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

createCrp('healer', 0, [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.MOVE, Game.HEAL, Game.HEAL, Game.HEAL, Game.HEAL], function(creep) {
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
  }
  if (strat == STRAT_FEB2) {
    if (creep.memory.isLeft) {
      var endX = 21;
      var endY = 29;
      if (creep.pos.y < endY - 1) {
        creep.memory.targetPos = createPos(endX - 4, endY - 1);
        handleTargetPos(creep);
      } else {
        delete creep.memory.targetPos;
        delete creep.memory.path;
        if (creep.pos.y == endY - 1 && !getObstacle(creep.pos.x, endY)) {
          creep.move(Game.BOTTOM);
        } else if (creep.pos.x < endX) {
          creep.move(Game.RIGHT);
        }
      }
    } else {
      var endX = 27;
      var endY = 22;
      if (creep.pos.x < endX - 1) {
        creep.memory.targetPos = createPos(endX - 1, endY - 4);
        handleTargetPos(creep);
      } else {
        delete creep.memory.targetPos;
        delete creep.memory.path;
        if (creep.pos.x == endX - 1 && !getObstacle(endX, creep.pos.y)) {
          creep.move(Game.RIGHT);
        } else if (creep.pos.y < endY) {
          creep.move(Game.BOTTOM);
        }
      }
    }
  } else if (strat != STRAT_JAN) {
    delete creep.memory.path;
    delete creep.memory.targetPos;
    if (!tooHighCPU && !avoidEnemies(creep)) {
      var obj = createRotObj(creep.pos, healPos, creep.memory.rot);
      obj.dx = -obj.dx;
      obj.dy = -obj.dy;
      moveDirection(obj, creep);
      creep.memory.rot = obj.rot;
      updateCPU();
    }
    handleTargetPos(creep);
  }
});

createCrp('hunter', 0,
 [Game.RANGED_ATTACK, Game.RANGED_ATTACK, Game.MOVE, Game.MOVE],
 function(creep)
{
  delete creep.memory.path;
  delete creep.memory.targetPos;
  if (!tooHighCPU) {
    var enemy = getClosest(creep, Game.HOSTILE_CREEPS, 50);
    if (creep.hits <= (creep.hitsMax >> 1) ||
      (creep.hits < creep.hitsMax && crp.healer.count &&
      (enemies.length == 0 || calculateDistance(healPos, creep.pos) < 6)) ||
      creep.pos.findInRange(Game.HOSTILE_CREEPS, 4).length >
      creep.pos.findInRange(Game.MY_CREEPS, 4).length)
    {
      if (!avoidEnemies(creep)) {
        var obj = createRotObj(creep.pos, healPos, creep.memory.rot);
        obj.dx = -obj.dx;
        obj.dy = -obj.dy;
        moveDirection(obj, creep);
        creep.memory.rot = obj.rot;
      }
    } else {
      var otherPos = (crp.guard.count > 5 ? createPos(13, 29) : createPos(34, 34));
      if (enemy) {
        otherPos = prep4mem(enemy.pos);
      }
      var distance = calculateDistance(otherPos, creep.pos);
      if (distance && (!enemy || distance < 3 || distance > 3)) {
        var obj = createRotObj(creep.pos, otherPos, creep.memory.rot);
        if (!enemy || distance > 3) {
          obj.dx = -obj.dx;
          obj.dy = -obj.dy;
          delete creep.memory.isAvoidingEnemy;
        // } else {
          // creep.memory.isAvoidingEnemy = obj.rot;
        }
        moveDirection(obj, creep);
        creep.memory.rot = obj.rot;
      }
    }
    handleTargetPos(creep);
    updateCPU();
  }
  if (enemy && distance < 5) {
    creep.rangedAttack(enemy);
  }
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
  if (enemies.length) {
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
  }
  if (strat == STRAT_FEB2) {
    if (creep.memory.isLeft) {
      var endX = 21;
      var endY = 30;
      if (creep.pos.y < endY - 1) {
        creep.memory.targetPos = createPos(endX - 5, endY - 1);
        handleTargetPos(creep);
      } else {
        delete creep.memory.targetPos;
        delete creep.memory.path;
        if (creep.pos.y == endY - 1 && !getObstacle(creep.pos.x, endY)) {
          creep.move(Game.BOTTOM);
        } else if (creep.pos.x < endX) {
          creep.move(Game.RIGHT);
        }
      }
    } else {
      var endX = 28;
      var endY = 22;
      if (creep.pos.x < endX - 1) {
        creep.memory.targetPos = createPos(endX - 1, endY - 5);
        handleTargetPos(creep);
      } else {
        delete creep.memory.targetPos;
        delete creep.memory.path;
        if (creep.pos.x == endX - 1 && !getObstacle(endX, creep.pos.y)) {
          creep.move(Game.RIGHT);
        } else if (creep.pos.y < endY) {
          creep.move(Game.BOTTOM);
        }
      }
    }
  } else if (strat == STRAT_FEB && creep.pos.y > grY + 2) {
    creep.move(Game.TOP_RIGHT);
  } else if (strat == STRAT_JAN && spawn && spawn.pos.y > 27) {
    creep.moveTo(11, 42);
  }
});

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
var strat = (exitCount > 1 ? STRAT_FEB2 : STRAT_JAN);
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
  var enemySafeDistance = 6;
  var allowLooting = true;
} else if (strat == STRAT_FEB) {
  var grX = 6;
  var grY = 38;
  var enemySafeDistance = 5;
  var healPos = createPos(26, 25);
  var allowLooting = false;
} else {
  var grX = 6;
  var grY = 38;
  var enemySafeDistance = 7;
  var healPos = createPos(24, 21);
  var allowLooting = false;
}
var structs = room.find(Game.STRUCTURES);
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
var tmpEnemies = room.find(Game.HOSTILE_CREEPS);
var enemies = [];
var builders = [];
var leftGuardCount = 0;
var rightGuardCount = 0;
var leftHealerCount = 0;
var rightHealerCount = 0;

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
} else if (strat == STRAT_FEB && spawn) {
  build(spawn.pos.x - 1, spawn.pos.y - 2);
  build(spawn.pos.x - 2, spawn.pos.y - 2);
  build(spawn.pos.x - 2, spawn.pos.y - 1);
} else if (strat == STRAT_FEB2 && spawn) {
  // build(spawn.pos.x, spawn.pos.y - 2);
  // build(spawn.pos.x - 1, spawn.pos.y - 2);
  build(spawn.pos.x - 2, spawn.pos.y - 2);
  // build(spawn.pos.x - 2, spawn.pos.y - 1);
  // build(spawn.pos.x - 2, spawn.pos.y);
  build(18, 33, Game.STRUCTURE_WALL);
  build(19, 33, Game.STRUCTURE_WALL);
  build(18, 32, Game.STRUCTURE_WALL);
  build(19, 32, Game.STRUCTURE_WALL);
  build(21, 32, Game.STRUCTURE_WALL);
  build(21, 33, Game.STRUCTURE_WALL);
  build(22, 32, Game.STRUCTURE_WALL);
  build(23, 32, Game.STRUCTURE_WALL);
  build(24, 32, Game.STRUCTURE_WALL);
  build(25, 31, Game.STRUCTURE_WALL);
  build(26, 30, Game.STRUCTURE_WALL);
  build(31, 20, Game.STRUCTURE_WALL);
  build(30, 20, Game.STRUCTURE_WALL);
  build(30, 22, Game.STRUCTURE_WALL);
  build(31, 22, Game.STRUCTURE_WALL);
  build(30, 23, Game.STRUCTURE_WALL);
  build(30, 24, Game.STRUCTURE_WALL);
  build(30, 25, Game.STRUCTURE_WALL);
  build(29, 26, Game.STRUCTURE_WALL);
  // addToObstacles({'pos': room.getPositionAt(9, 25)});
  // addToObstacles({'pos': room.getPositionAt(8, 24)});
  // addToObstacles({'pos': room.getPositionAt(7, 23)});
  // addToObstacles({'pos': room.getPositionAt(19, 12)});
  // addToObstacles({'pos': room.getPositionAt(20, 12)});
  // addToObstacles({'pos': room.getPositionAt(21, 12)});
}
var sites = room.find(Game.CONSTRUCTION_SITES);
for (var a = 0; a < sites.length; a++) {
  if (sites[a].progress) {
    addToObstacles(sites[a]);
  }
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
  var b = 0;
  var myDamage = enemy.hitsMax - enemy.hits;;
  while (b < enemies.length) {
    if (strat == STRAT_FEB2) {
      if (enemy.attack > enemies[b].attack ||
        (enemy.attack == enemies[b].attack &&
        myDamage > enemies[b].hitsMax - enemies[b].hits))
      {
        break;
      }
    } else if (strat == STRAT_JAN && enemy.pos.y > enemies[b].pos.y - 1) {
      break;
    } else if (strat != STRAT_JAN || enemy.pos.y == enemies[b].pos.y - 1) {
      if (enemy.attack >= enemies[b].attack) {
        if (enemy.attack > enemies[b].attack) {
          break;
        } else if (enemy.tough <= enemies[b].tough) {
          if (enemy.tough < enemies[b].tough) {
            break;
          } else if (enemy.ranged > enemies[b].ranged) {
            break;
          }
        }
      }
    }
    b++;
  }
  enemies.splice(b, 0, enemy);
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
    } else if (creep.memory.role == 'healer' && creep.hits < 500) {
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
  if (creep.memory.role != 'carry' && creep.memory.role != 'hunter') {
    addToObstacles(creep);
  }
  if (creep.ticksToLive > lifeLimit && ('isLeft' in creep.memory)) {
    crp[creep.memory.role].sideCount[creep.memory.isLeft]++;
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
      builders.push(creep);
      if ('assignedCarryName' in creep.memory) {
        if (!(creep.memory.assignedCarryName in Game.creeps) ||
          Game.creeps[creep.memory.assignedCarryName
          ].memory.assignedBuilderName != creep.name)
        {
          delete creep.memory.assignedCarryName;
        }
      }
    }
  }
}

var drops2 = room.find(Game.DROPPED_ENERGY);
for (var a = 0; a < drops2.length; a++) {
  if (drops2[a].energy >= minDrop && ((allowLooting && enemies.length == 0) ||
    drops2[a].pos.findInRange(Game.SOURCES, 1).length))
  {
    addToDrops(drops2[a].pos, drops2[a].energy, false);
  }
}

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  if (creep.spawning || creep.memory.role != 'carry') {
    continue;
  }
  if (('assignedBuilderName' in creep.memory) && !creep.energy) {
    if (creep.memory.assignedBuilderName in Game.creeps) {
      delete Game.creeps[creep.memory.assignedBuilderName].memory.assignedCarryName;
    }
    delete creep.memory.assignedBuilderName;
  }
  if (creep.memory.isAvoidingEnemy) {
    delete creep.memory.targetDrop;
  } else if (!creep.memory.assignedBuilderName) {
    var spaceFree = creep.energyCapacity - creep.energy;
    if (spaceFree) {
      if ('targetDrop' in creep.memory) {
        var obstacle = getObstacle(creep.memory.targetDrop.x,
          creep.memory.targetDrop.y);
        if ((obstacle && obstacle.creep && obstacle.creep.my &&
          (obstacle.creep.memory.role == 'harvester' ||
          obstacle.creep.memory.role == 'heavyHarvester')) ||
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
  if (minDistance > 4 && creep.energy && spawn) {
    creep.memory.targetPos = prep4mem(spawn.pos);
  } else if (chosenKey !== '') {
    var targetPos = posFromKey(chosenKey);
    creep.memory.targetDrop = creep.memory.targetPos = prep4mem(targetPos);
    addToDrops(targetPos, -freeSpace, true);
  }
}

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

if (strat == STRAT_JAN) {
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
} else if (strat == STRAT_FEB) {
  crp.carry.body = [Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE];
  crp.healer.body = [Game.MOVE, Game.HEAL, Game.HEAL, Game.HEAL, Game.HEAL];
  crp.harvester.maxCount = 2;
  crp.carry.maxCount = 2;
  crp.guard.maxCount = 0;
  crp.healer.maxCount = 0;
  crp.hunter.maxCount = 30;
  if (crp.hunter.count > 0) {
    crp.heavyHarvester.maxCount = 1;
    crp.harvester.maxCount = 4;
    crp.carry.maxCount = 12;
  }
  if (crp.hunter.count > 6) {
    crp.healer.maxCount = 4;
  }
  if (crp.hunter.count > 8) {
    crp.spawnBuilder.maxCount = 1;
  }
  var extCount = 0;
  for (var a = 0; a < structs.length; a++) {
    if (structs[a].structureType == Game.STRUCTURE_EXTENSION) {
      extCount++;
      if (extCount & 1) {
        crp.hunter.body.splice(0, 0, Game.RANGED_ATTACK);
        crp.hunter.body.push(Game.MOVE);
      }
      crp.heavyHarvester.body.splice(0, 0, Game.WORK);
    }
  }
} else {
  crp.carry.body = [Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE];
  // crp.healer.body = [Game.MOVE, Game.HEAL, Game.HEAL, Game.HEAL, Game.HEAL];
  crp.harvester.maxCount = 2;
  crp.carry.maxCount = 2;
  crp.guard.maxCount = 0;
  crp.healer.maxCount = crp.guard.count;
  if (crp.guard.count < 4) {
    crp.hunter.maxCount = 10;
  }
  if (crp.hunter.count > 0 || crp.guard.count > 0) {
    crp.heavyHarvester.maxCount = 1;
    crp.harvester.maxCount = 4;
    crp.carry.maxCount = 12;
    crp.healer.maxCount = Math.max(crp.healer.maxCount, 1);
  }
  if (crp.hunter.count >= 10 || crp.guard.count > 1) {
    crp.spawnBuilder.maxCount = 1;
    if (structs.length == 9) {
      crp.builder.maxCount = 4;
      crp.carry.maxCount += 6;
    }
    crp.guard.maxCount = 100;
  }
  var extCount = 0;
  for (var a = 0; a < structs.length; a++) {
    if (structs[a].structureType == Game.STRUCTURE_EXTENSION) {
      extCount++;
      crp.carry.maxCount += 2;
      if (extCount & 1) {
        crp.hunter.body.splice(0, 0, Game.RANGED_ATTACK);
        crp.hunter.body.push(Game.MOVE);
      }
      crp.heavyHarvester.body.splice(0, 0, Game.WORK);
      if (extCount < 3) {
        crp.guard.body.splice(0, 1);
        crp.guard.body.push(Game.RANGED_ATTACK);
        crp.healer.body.push(Game.HEAL);
      }
    }
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
            if ((strat == STRAT_FEB || strat == STRAT_FEB2) &&
              sources[sourceIndex].pos.y != 47 &&
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
        } else if (myCrp.typeName == 'builder' || myCrp.typeName == 'builderCarry') {
          mem.isLeft = (myCrp.sideCount[true] < myCrp.sideCount[false]);
          if (strat == STRAT_JAN) {
            mem.workCenter = createPos((mem.isLeft ? 3 : 46), 37);
          } else {
            mem.workCenter = (mem.isLeft ? createPos(16, 37) : createPos(36, 17));
          }
        } else if (myCrp.typeName == 'healer' || myCrp.typeName == 'guard') {
          mem.isLeft = (myCrp.sideCount[true] < myCrp.sideCount[false]);
        }
        mySpawn.createCreep(myCrp.body, null, mem);
      }
     // }
    break;
  }
}
}
