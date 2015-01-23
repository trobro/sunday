var enLimit = 60;
var healLimit = 100;
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

// function avoidEnemies(creep) {
  // var enemy = creep.pos.findClosest(Game.HOSTILE_CREEPS);
  // if (enemy && creep.pos.inRangeTo(enemy.pos, 4)) {
    // creep.moveTo(creep.pos.x - (enemy.pos.x - creep.pos.x), creep.pos.y - (enemy.pos.y - creep.pos.y));
    // return true;
  // }
  // return false;
// }

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
var healTargets = [];
var drops = {};
var freeCarries = [];

function addToDrops(pos, energy) {
  var key = pos.x + ' ' + pos.y;
  if (key in drops) {
    drops[key] += energy;
  } else {
    drops[key] = energy;
  }
}

function posFromKey(key) {
  return {'x': parseInt(key), 'y': parseInt(key.substr(2))};
}

if (enemies.length <= healLimit || enemies.length <= enLimit) {
  for (var i in Game.creeps) {
    var creep = Game.creeps[i];
    if (enemies.length <= healLimit && creep.memory.role == 'guard' &&
      creep.hits < creep.hitsMax && creep.pos.y > 6)
    {
      var chosenIndex = 0;
      var damage = creep.hitsMax - creep.hits;
      for (var a = 0; a < healTargets; a++) {
        if (damage > healTargets[a].hitsMax - healTargets[a].hits) {
          chosenIndex = a;
          break;
        }
      }
      healTargets.splice(chosenIndex, 0, creep);
    } else if (enemies.length <= enLimit) {
      if (creep.energy > 0 && creep.memory.role == 'harvester') {
        addToDrops(creep.pos, creep.energy);
      } else if (creep.memory.role == 'carry') {
        var spaceFree = creep.energyCapacity - creep.energy;
        if (!('targetPos' in creep.memory)) {
          if (spaceFree > 0) {
            freeCarries.push(creep);
          } else {
            creep.memory.targetPos = spawn.pos;
          }
        } else if (spaceFree > 0) {
          addToDrops(creep.memory.targetPos, -spaceFree);
        }
      }
    }
  }
  var drops2 = getRoom().find(Game.DROPPED_ENERGY);
  for (var a = 0; a < drops2.length; a++) {
    if (!(drops2[a].pos.x > 16 && drops2[a].pos.x < 30 && drops2[a].pos.y < 9)) {
      addToDrops(drops2[a].pos, drops2[a].energy);
    }
  }
  for (var a = 0; a < freeCarries.length; a++) {
    var creep = freeCarries[a];
    var chosenKey = '';
    var minDistance = 100000;
    var localCreeps = creep.pos.findInRange(Game.MY_CREEPS, 1);
    for (var b = 0; b < localCreeps.length; b++) {
      if (localCreeps[b].memory.role == 'harvester') {
        minDistance = 4;
        break;
      }
    }
    for (var key in drops) {
      if (drops[key] <= 0) {
        delete drops[key];
      } else {
        var pos = posFromKey(key);
        var distance = calculateDistance(creep.pos, pos);
        if (distance < minDistance) {
          minDistance = distance;
          chosenKey = key;
        }
      }
    }
    if (chosenKey !== '') {
      creep.memory.targetPos = posFromKey(chosenKey);
      drops[chosenKey] -= creep.energyCapacity - creep.energy;
    }
  }
}

createCrp('harvester', 2, [Game.WORK, Game.WORK, Game.WORK, Game.CARRY, Game.MOVE], function(creep) {
  var sources = getRoom().find(Game.SOURCES);
  for (var a = 0; a < sources.length; a++) {
    if (sources[a].id == creep.memory.sourceKey) {
      if (creep.harvest(sources[a]) < 0) {
        creep.moveTo(sources[a]);
      }
      break;
    }
  }
  var localCreeps = creep.pos.findInRange(Game.MY_CREEPS, 1);
  for (var a = 0; a < localCreeps.length; a++) {
    var chosenIndex = -1;
    var minFree = 100000;
    if (localCreeps[a].memory.role == 'carry') {
      var freeSpace = localCreeps[a].energyCapacity - localCreeps[a].energy;
      if (freeSpace > 0 && freeSpace < minFree) {
        chosenIndex = a;
        minFree = freeSpace;
      }
    }
    if (chosenIndex >= 0) {
      creep.transferEnergy(localCreeps[chosenIndex]);
    }
  }
});

createCrp('carry', 2, [Game.CARRY, Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE], function(creep) {
  if (enemies.length > enLimit) {
    return;
  }
  // if (avoidEnemies(creep)) {
  // return;
  // }
  if (creep.energy == creep.energyCapacity) {
    if (creep.transferEnergy(spawn) == Game.OK) {
      delete creep.memory.targetPos;
    } else {
      creep.moveTo(spawn);
    }
  } else {
    if ('targetPos' in creep.memory) {
      if (calculateDistance(creep.memory.targetPos, creep.pos) < 2) {
        delete creep.memory.targetPos;
      } else {
        creep.moveTo(creep.memory.targetPos);
      }
    }
    var localDrops = creep.pos.findInRange(Game.DROPPED_ENERGY, 1);
    if (localDrops.length) {
      creep.pickup(localDrops[0]);
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
        creep.moveTo(target.pos.x, target.pos.y + 1);
      }
    }
    return;
  }
  if (creep.pos.x < 21 || creep.pos.y < 10) {
    creep.moveTo(35, 20);
  }
});

createCrp('guard', 100, [
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.MOVE, Game.RANGED_ATTACK, Game.RANGED_ATTACK, Game.RANGED_ATTACK,
  Game.RANGED_ATTACK], function(creep)
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
  if (creep.pos.x < (Object.keys(Game.creeps).length > 18 ? 27 : 25)) {
    if (creep.pos.x == 18 && creep.room.lookAt(19, 7).length > 1 &&
        creep.room.lookAt(creep.pos.x, creep.pos.y - 1).length < 2)
    {
      creep.move(Game.TOP);
    } else if (creep.pos.y > 7) {
      if (creep.room.lookAt(creep.pos.x + 1, creep.pos.y - 1).length < 2) {
        creep.move(Game.TOP_RIGHT);
      } else if (creep.room.lookAt(creep.pos.x, creep.pos.y - 1).length < 2) {
        creep.move(Game.TOP);
      } else {
        creep.move(Game.RIGHT);
      }
    } else if (creep.pos.y == 7) {
      if (creep.id==='') {
        console.log('move right');
      }
      creep.move(Game.RIGHT);
    }
  }
});

for (var i in Game.creeps) {
  var creep = Game.creeps[i];
  myCrp = crp[creep.memory.role];
  if (creep.ticksToLive > 100) {
    myCrp.count++;
  }
  myCrp.action(creep);
}

if (crp.guard.count > 1) {
  crp.harvester.maxCount = 4;
  crp.carry.maxCount = 4;
  crp.healer.maxCount = 1;
}
if (crp.guard.count > 4) {
  crp.harvester.maxCount = 4;
}
if (crp.guard.count > 6) {
  crp.harvester.maxCount = 6;
  crp.carry.maxCount = 12;
}
if (crp.guard.count > 20) {
  crp.healer.maxCount = 4;
}
if (crp.guard.count > 25) {
  crp.healer.maxCount = 8;
}
if (crp.guard.count > 30) {
  crp.healer.maxCount = 12;
}
// crp.healer.maxCount = Math.floor(crp['guard'].count / 4);

for (var typeName in crp) {
  var myCrp = crp[typeName];
  if (myCrp.count < myCrp.maxCount) {
    for(var i in Game.spawns) {
      var mySpawn = Game.spawns[i];
      if (!mySpawn.spawning) {
        var mem = {role: myCrp.typeName};
        if (myCrp.typeName == 'harvester') {
          var assCount = {};
          for (key in Game.creeps) {
            var creep = Game.creeps[key];
            if (creep.memory.role == 'harvester' && creep.ticksToLive > 100) {
              if (creep.memory.sourceKey in assCount) {
                assCount[creep.memory.sourceKey]++;
              } else {
                assCount[creep.memory.sourceKey] = 1;
              }
            }
          }
          var sources = getRoom().find(Game.SOURCES);
          var minDistance = 100000;
          var chosenIndex = -1;
          for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
            if (sources[sourceIndex].pos.y > 27) {
              continue;
            }
            var distance = calculateDistance(mySpawn.pos, sources[sourceIndex].pos);
            if ((!assCount[sources[sourceIndex].id] ||
                  assCount[sources[sourceIndex].id] < 2) &&
                distance < minDistance)
            {
              minDistance = distance;
              chosenIndex = sourceIndex;
            }
          }
          mem.sourceKey = sources[chosenIndex].id;
        }
        mySpawn.createCreep(myCrp.body, null, mem);
      }
    }
    break;
  }
}
