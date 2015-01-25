var enLimit = 60;
var healLimit = 100;
var lifeLimit = 30;
var lifeLongLimit = 300;
var grX = 20;
var grY = 8;
var crp = {};
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
  var enemy = creep.pos.findInRange(Game.HOSTILE_CREEPS, 4);
  if (enemy.length) {
    delete creep.memory.targetPos;
    creep.moveTo(creep.pos.x - (enemy[0].pos.x - creep.pos.x), creep.pos.y - (enemy[0].pos.y - creep.pos.y));
    return true;
  }
  return false;
}

var room = getRoom();
room.createConstructionSite(3, 41, Game.STRUCTURE_EXTENSION);
room.createConstructionSite(4, 41, Game.STRUCTURE_EXTENSION);
room.createConstructionSite(5, 41, Game.STRUCTURE_EXTENSION);
room.createConstructionSite(46, 42, Game.STRUCTURE_EXTENSION);
room.createConstructionSite(45, 42, Game.STRUCTURE_EXTENSION);
room.createConstructionSite(44, 42, Game.STRUCTURE_EXTENSION);

var tmpEnemies = getRoom().find(Game.HOSTILE_CREEPS);
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
    if (enemy.tough < enemies[b].tough) {
      chosenIndex = b;
      break;
    } else if (enemy.heal >= enemies[b].heal) {
      if (enemy.heal > enemies[b].heal) {
        chosenIndex = b;
        break;
      } else if (enemy.ranged >= enemies[b].ranged) {
        if (enemy.ranged > enemies[b].ranged) {
          chosenIndex = b;
          break;
        } else if (enemy.attack > enemies[b].attack) {
          chosenIndex = b;
          break;
        }
      }
    }
  }
  enemies.splice(chosenIndex, 0, enemy);
}

var spawn = getRoom().find(Game.MY_SPAWNS)[0];
var sources = getRoom().find(Game.SOURCES);
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
var guardRows = [];

function toIndex(pos) {
  return pos.x / 18 >> 0;
}

function addToSourceArea(pos, energy, isCarry) {
  var sourceAreaIndex = toIndex(pos);
  sourceAreas[sourceAreaIndex].energy += energy;
  if (isCarry) {
    sourceAreas[sourceAreaIndex].carries++;
  }
}

function shouldAddCarry(pos) {
  var sourceAreaIndex = toIndex(pos);
  var distanceRate = (calculateDistance(pos, spawn.pos) / 5 >> 0) - 1;
  return (sourceAreas[sourceAreaIndex].energy > -100 * distanceRate ||
    sourceAreas[sourceAreaIndex].carries < distanceRate);
}

function addToDrops(pos, energy, isCarry) {
  if (pos.y > 27) {
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
  return {'x': parseInt(key), 'y': parseInt(key.substr(2))};
}

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  if (enemies.length <= healLimit && creep.hits < creep.hitsMax) {
    var chosenIndex = 0;
    var damage = creep.hitsMax - creep.hits;
    if (creep.memory.role != 'guard') {
      damage -= 4000;
    }
    creep.damage = damage;
    for (var a = 0; a < healTargets.length; a++) {
      if (damage > healTargets[a].damage) {
        chosenIndex = a;
        break;
      }
    }
    healTargets.splice(chosenIndex, 0, creep);
  }
  if (creep.memory.role == 'guard' && !creep.spawning) {
    var x = creep.pos.x - grX;
    var y = creep.pos.y - grY;
    while (guardRows.length - 2 < y) {
      guardRows.push([]);
    }
    var maxLength = x + 2;
    for (var b = 0; b < guardRows.length; b++) {
      if (guardRows[b].length > maxLength) {
        maxLength = guardRows[b].length;
      }
    }
    for (var b = 0; b < guardRows.length; b++) {
      for (var a = guardRows[b].length; a < maxLength; a++) {
        guardRows[b].push(null);
      }
    }
    guardRows[y][x] = creep;
  } else if (enemies.length <= enLimit) {
    if (creep.memory.role == 'harvester') {
      if (creep.ticksToLive > (creep.pos.y > 27 ? lifeLongLimit : lifeLimit)) {
        sourceByKey[creep.memory.sourceKey].assCount++;
      }
      if (creep.energy) {
        addToDrops(creep.pos, creep.energy, false);
      }
    } else if (creep.memory.role == 'carry') {
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
  }
}

var drops2 = getRoom().find(Game.DROPPED_ENERGY);
for (var a = 0; a < drops2.length; a++) {
  if (enemies.length == 0 || !(drops2[a].pos.x > 16 &&
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
  } else if (creep.pos.y == 36) {
    creep.move(Game.BOTTOM);
  } else if (creep.pos.x == 2) {
    creep.move(Game.RIGHT);
  } else if (creep.pos.x == 47) {
    creep.move(Game.LEFT);
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
    var sites = getRoom().getPositionAt(
      creep.memory.workCenter.x, creep.memory.workCenter.y).findInRange(
      Game.CONSTRUCTION_SITES, 10);
    if (sites.length) {
      creep.memory.targetConstruction = sites[0].pos;
    }
  }
  if (creep.memory.targetConstruction) {
    creep.moveTo(creep.memory.targetConstruction.x,
      creep.memory.targetConstruction.y - 1);
    var sites = getRoom().getPositionAt(creep.memory.targetConstruction.x,
      creep.memory.targetConstruction.y).findInRange(
      Game.CONSTRUCTION_SITES, 0);
    if (sites.length) {
      creep.build(sites[0]);
    } else {
      delete creep.memory.targetConstruction;
    }
  }
});

createCrp('carry', 2, [Game.CARRY, Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE], function(creep) {
  if (enemies.length > enLimit) {
    return;
  }
  if (creep.hitsMax - creep.hits > 200) {
    creep.suicide();
    return;
  }
  if (avoidEnemies(creep)) {
    return;
  }
  if (creep.energy == creep.energyCapacity) {
    creep.memory.targetPos = spawn.pos;
  }
  if ('targetPos' in creep.memory) {
    if (calculateDistance(creep.memory.targetPos, creep.pos) < 2) {
      creep.transferEnergy(spawn);
      delete creep.memory.targetPos;
    } else {
      creep.moveTo(creep.memory.targetPos);
    }
  } else if (calculateDistance(spawn.pos, creep.pos) < 4) {
    creep.moveTo(spawn.pos.x, spawn.pos.y + 4);
  }
  var localDrops = creep.pos.findInRange(Game.DROPPED_ENERGY, 1);
  if (localDrops.length) {
    creep.pickup(localDrops[0]);
  }
});

createCrp('builderCarry', 0, [Game.CARRY, Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE], function(creep) {
  if (enemies.length > enLimit) {
    return;
  }
  var localDrops = creep.pos.findInRange(Game.DROPPED_ENERGY, 1);
  if (localDrops.length) {
    creep.pickup(localDrops[0]);
  }
  var workCenter = getRoom().getPositionAt(creep.memory.workCenter.x,
    creep.memory.workCenter.y);
  if ('targetObj' in creep.memory) {
    if (calculateDistance(creep.memory.targetObj, creep.pos) < 2) {
      var obj = getRoom().getPositionAt(creep.memory.targetObj.x,
        creep.memory.targetObj.y).findInRange(Game.MY_CREEPS, 0)[0];
      if (!obj) {
        obj = getRoom().getPositionAt(creep.memory.targetObj.x,
          creep.memory.targetObj.y).findInRange(Game.MY_STRUCTURES, 0)[0];
      }
      creep.transferEnergy(obj);
      delete creep.memory.targetObj;
    } else {
      creep.moveTo(creep.memory.targetObj);
    }
  } else if ('sourceObj' in creep.memory) {
    if (calculateDistance(creep.pos, creep.memory.sourceObj) < 2) {
      delete creep.memory.sourceObj;
    } else {
      creep.moveTo(creep.memory.sourceObj.x, creep.memory.sourceObj.y + 1);
    }
  } else if (creep.energy) {
    var exts = workCenter.findInRange(Game.MY_STRUCTURES, 10);
    for (var a = 0; a < exts.length; a++) {
      if (exts[a].energy < exts[a].energyCapacity) {
        creep.memory.targetObj = exts[a].pos;
        break;
      }
    }
    if (!('targetObj' in creep.memory)) {
      var localCreeps = workCenter.findInRange(Game.MY_CREEPS, 10);
      for (var a = 0; a < localCreeps.length; a++) {
        if (localCreeps[a].memory.role == 'builder' &&
          localCreeps[a].energy < localCreeps[a].energyCapacity)
        {
          creep.memory.targetObj = localCreeps[a].pos;
          break;
        }
      }
    }
  } else {
    var localCreeps = workCenter.findInRange(Game.MY_CREEPS, 10);
    for (var a = 0; a < localCreeps.length; a++) {
      if (localCreeps[a].memory.role == 'harvester') {
        creep.memory.sourceObj = localCreeps[a].pos;
        break;
      }
    }
  }
});

createCrp('healer', 0, [Game.MOVE, Game.HEAL, Game.HEAL, Game.HEAL, Game.HEAL], function(creep) {
  if (enemies.length > healLimit) {
    return;
  }
  // if (avoidEnemies(creep)) {
  // return;
  // }
  var chosenIndex = -1;
  var minDistance = 100000;
  for (var a = 0; a < healTargets.length; a++) {
    distance = calculateDistance(creep.pos, healTargets[a].pos);
    if (distance < minDistance) {
      minDistance = distance;
      chosenIndex = a;
      if (distance < 4) {
        break;
      }
    }
  }
  if (chosenIndex > -1) {
    var target = healTargets[chosenIndex];
    if (creep.heal(target) < 0) {
      if (creep.rangedHeal(target) < 0) {
        creep.moveTo(target.pos.x, grY + 3);
      }
    }
    return;
  }
  if (creep.pos.y - grY < 3 || calculateDistance(spawn.pos, creep.pos) < 3) {
    creep.moveTo(grX + 2, grY + 3);
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
});

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  var myCrp = crp[typeName];
  if (creep.ticksToLive > (creep.pos.y > 27 ? lifeLongLimit : lifeLimit)) {
    crp[creep.memory.role].count++;
  }
  if (crp[creep.memory.role]) {
    crp[creep.memory.role].action(creep);
  }
}

var thestring = '';
for (var b = 0; b < guardRows.length - 1; b++) {
  for (var a = 1; a < guardRows[b].length - 1; a++) {
      thestring += (!guardRows[b][a] ? '0' : '1');
    if (!guardRows[b][a]) {
      if (guardRows[b+1][a+1] && !guardRows[b+1][a+1].fatigue &&
        !guardRows[b][a+1])
      {
          // console.log('move TL ' + guardRows[b+1][a+1].name);
        guardRows[b+1][a+1].move(Game.TOP_LEFT);
        guardRows[b][a] = guardRows[b+1][a+1];
        guardRows[b+1][a+1] = null;
      } else if (guardRows[b+1][a] && !guardRows[b+1][a].fatigue) {
          // console.log('move TOP ' + guardRows[b+1][a].name);
        guardRows[b+1][a].move(Game.TOP);
        guardRows[b][a] = guardRows[b+1][a];
        guardRows[b+1][a] = null;
      } else if (guardRows[b][a+1] && !guardRows[b][a+1].fatigue) {
          // console.log('move LEFT ' + guardRows[b][a+1].name);
        guardRows[b][a+1].move(Game.LEFT);
        guardRows[b][a] = guardRows[b][a+1];
        guardRows[b][a+1] = null;
      }
    }
  }
  thestring += '\n';
}
// console.log('################################\n' + thestring);

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
  if (getRoom().find(Game.CONSTRUCTION_SITES).length) {
    crp.builder.maxCount = 2;
  }
  crp.builderCarry.maxCount = 2;
}
if (crp.guard.count > 20) {
  crp.healer.maxCount = 4;
}
if (crp.guard.count > 40) {
  crp.healer.maxCount = 6;
}

// crp.healer.maxCount = Math.floor(crp['guard'].count / 4);

var exts = getRoom().find(Game.MY_STRUCTURES);
for (var a = 0; a < exts.length; a++) {
  if (exts[a].structureType == Game.STRUCTURE_EXTENSION) {
  // &&
    // exts[a].energy == exts[a].energyCapacity)
  // {
    crp.guard.body.splice(0, 1);
    crp.guard.body.push(Game.RANGED_ATTACK);
  }
}

for (var typeName in crp) {
  var myCrp = crp[typeName];
  if (myCrp.count < myCrp.maxCount) {
    for(var i in Game.spawns) {
      var mySpawn = Game.spawns[i];
      if (!mySpawn.spawning) {
        var mem = {role: myCrp.typeName};
        if (myCrp.typeName == 'harvester') {
          var minDistance = 100000;
          var chosenIndex = -1;
          var chosenBottom = -1;
          for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
            var distance = calculateDistance(mySpawn.pos, sources[sourceIndex].pos);
            if (sources[sourceIndex].assCount < 2 && distance < minDistance) {
              if (sources[sourceIndex].pos.y > 27) {
                chosenBottom = sourceIndex;
              } else {
                minDistance = distance;
                chosenIndex = sourceIndex;
              }
            }
          }
          mem.sourceKey = sources[chosenIndex >= 0 ? chosenIndex : chosenBottom].id;
        } else if (myCrp.typeName == 'builder' || myCrp.typeName == 'builderCarry') {
          mem.workCenter = {'x': (myCrp.count ? 3 : 46), 'y': 37};
          mem.targetConstruction = null;
        }
        mySpawn.createCreep(myCrp.body, null, mem);
      }
    }
    break;
  }
}
