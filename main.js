var enLimit = 6;
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
var drops = [];
if (enemies.length < enLimit) {
  for (var key in Game.creeps) {
    var creep = Game.creeps[key];
    if (creep.energy > 0 && creep.memory.role == 'harvester') {
      creep.distance = calculateDistance(creep.pos, spawn.pos);
      var chosenIndex = 0;
      for (var a = 0; a < drops.length; a++) {
        if (drops[a].distance > creep.distance) {
          chosenIndex = a;
          break;
        }
      }
      drops.splice(chosenIndex, 0, creep);
    }
  }
  var drops2 = getRoom().find(Game.DROPPED_ENERGY);
  for (var a = 0; a < drops2.length; a++) {
    for (var b = 0; b < drops.length; b++) {
      if (drops2[a].pos.equalsTo(drops[b].pos)) {
        drops.push(drops2[a]);
        break;
      }
    }
  }
  for (var a = 0; a < drops.length; a++) {
    drops[a].carries = [];
  }
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

function doAction(creep) {
  myCrp = crp[creep.memory.role];
  if (creep.ticksToLive > 100) {
    myCrp.count++;
  }
  myCrp.action(creep);
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
});

function avoidEnemies(creep) {
  var enemy = creep.pos.findClosest(Game.HOSTILE_CREEPS);
  if (enemy && creep.pos.inRangeTo(enemy.pos, 4)) {
    creep.moveTo(creep.pos.x - (enemy.pos.x - creep.pos.x), creep.pos.y - (enemy.pos.y - creep.pos.y));
    return true;
  }
  return false;
}

createCrp('carry', 2, [Game.CARRY, Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE], function(creep) {
  if (enemies.length > enLimit) {
    return;
  }
  // if (avoidEnemies(creep)) {
  // return;
  // }
  if (creep.energy < creep.energyCapacity) {
    creep.hasTarget = false;
    for (var a = 0; a < drops.length; a++) {
      var distance = calculateDistance(drops[a].pos, creep.pos);
      var insertIndex = 0;
      for (; insertIndex < drops[a].carries.length; insertIndex++) {
        var carry = drops[a].carries[insertIndex];
        if (carry.distance > distance ||
            (carry.distance == distance && carry.energy < creep.energy))
        {
          break;
        }
      }
      drops[a].carries.splice(insertIndex, 0, {distance: distance, creep: creep});
    }
  } else {
    if (creep.transferEnergy(spawn) < 0) {
      creep.moveTo(spawn);
    }
  }
});

createCrp('healer', 0, [Game.MOVE, Game.HEAL, Game.HEAL, Game.HEAL, Game.HEAL], function(creep) {
  if (enemies.length > enLimit) {
    return;
  }
  // if (avoidEnemies(creep)) {
  // return;
  // }
  var minDistance = 100000;
  var chosenIndex = '';
  var maxDamage = 0;
  for(var i in Game.creeps) {
    var target = Game.creeps[i];
    if (target != creep && target.hits < target.hitsMax && target.pos.y > 6) {
      var damage = target.hitsMax - target.hits;
      var distance = calculateDistance(creep.pos, target.pos);
      if (distance < 4) {
        if (damage > maxDamage) {
          chosenIndex = i;
          maxDamage = damage;
        }
        minDistance = Math.min(distance, minDistance);
      } else if (distance < minDistance) {
        minDistance = distance;
        chosenIndex = i;
      }
    }
  }
  if (chosenIndex !== '') {
    var target = Game.creeps[chosenIndex];
    if (creep.heal(target) < 0) {
      creep.moveTo(target.pos.x, target.pos.y + 1);
      if (creep.rangedHeal(target) < 0) {
      }
    }
    return;
  }
  if (creep.pos.x < 21 || creep.pos.y < 10) {
    creep.moveTo(35, 20);
  }
});

createCrp('guard', 100, [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
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

for(var i in Game.creeps) {
  doAction(Game.creeps[i]);
}

//console.log('!!!');
for (var a = 0; a < drops.length; a++) {
  if (enemies.length > enLimit) {
    continue;
  }
  if (drops[a].pos.y > 27) {
    continue;
  }
  var transferred = 0;
  var carryCount = 0;
  var target = drops[a];
  //  console.log(target.pos);
  for (var b = 0; b < drops[a].carries.length; b++) {
    var creep = drops[a].carries[b].creep;
    if (!creep.hasTarget || calculateDistance(creep.pos, target.pos) < 3) {
      creep.hasTarget = true;
      if ((!target.my && creep.pickup(target) == Game.OK /*&& console.log('pickup ' + creep.name)*/) ||
          (target.my && target.transferEnergy(creep) == Game.OK))
      {
        transferred += creep.energyCapacity - creep.energy;
      } else {
        if (!target.my) {
          //console.log('move to drop ' + creep.name);
        }
        creep.moveTo(target);
      }
      carryCount++;
      if (carryCount > 1 || transferred >= target.energy) {
        break;
      }
    }
  }
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
