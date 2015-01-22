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

function doAction(creep) {
    myCrp = crp[creep.memory.role];
    if (creep.ticksToLive > 100) {
      myCrp.count++;
    }
    myCrp.action(creep);
}

createCrp('harvester', 1, [Game.WORK, Game.WORK, Game.WORK, Game.MOVE], function(creep) {
    var target = creep.pos.findClosest(Game.SOURCES);
    if (creep.harvest(target) < 0) {
      creep.moveTo(target);
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

var drops = getRoom().find(Game.DROPPED_ENERGY);
for (var a = 0; a < drops.length; a++) {
  drops[a].energyRemaining = drops[a].energy;
}

createCrp('carry', 2, [Game.CARRY, Game.CARRY, Game.MOVE, Game.MOVE], function(creep) {
  if (avoidEnemies(creep)) {
    return;
  }
  if (creep.energy < creep.energyCapacity) {
    var minDistance = 100000;
    var chosenIndex = -1;
    var mostEnergyRemaining = -100000;
    var enIndex = -1;
    for (var a = 0; a < drops.length; a++) {
      var distance = calculateDistance(drops[a].pos, creep.pos);
      if (distance < minDistance && drops[a].energyRemaining > 0) {
        minDistance = distance;
        chosenIndex = a;
      } else if (drops[a].energyRemaining > mostEnergyRemaining) {
        mostEnergyRemaining = drops[a].energyRemaining;
        enIndex = a;
      }
    }
    if (chosenIndex < 0) {
      chosenIndex = enIndex;
    }
    if (chosenIndex >= 0) {
      var target = drops[chosenIndex];
      if (creep.pickup(target) == Game.OK) {
        drops[chosenIndex].energyRemaining -= creep.energyCapacity - creep.energy;
      } else {
        creep.moveTo(target);
      }
      return;
    }
  }
  var target = creep.pos.findClosest(Game.MY_SPAWNS);
  if (creep.transferEnergy(target) < 0) {
    creep.moveTo(target);
  }
});

createCrp('healer', 0, [Game.MOVE, Game.MOVE, Game.HEAL, Game.HEAL], function(creep) {
    if (avoidEnemies(creep)) {
      return;
    }
    var minDistance = 100000;
    var chosenIndex = '';
    var maxDamage = 0;
    for(var i in Game.creeps) {
      var target = Game.creeps[i];
      if (target && target.hits < target.hitsMax) {
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
    if (chosenIndex != '') {
      var target = Game.creeps[chosenIndex];
      if (creep.heal(target) < 0) {
        if (creep.rangedHeal(target) < 0) {
          creep.moveTo(target.pos.x, Math.max(target.pos.y, 8));
        }
      }
      return;
    }
    if (creep.pos.x < 25 || creep.pos.y < 10) {
      creep.moveTo(35, 20);
    }
});

createCrp('guard', 100, [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.TOUGH,
  Game.MOVE, Game.RANGED_ATTACK, Game.RANGED_ATTACK, Game.RANGED_ATTACK,
  Game.RANGED_ATTACK], function(creep)
{
    if (creep.pos.findInRange(Game.HOSTILE_CREEPS, 1).length > 0) {
      creep.rangedMassAttack();
    } else {
      var targets = creep.pos.findInRange(Game.HOSTILE_CREEPS, 3);
      var chosenIndex = 0;
      var maxRanged = 0;
      var maxAttack = 0;
      var maxHeal = 0;
      for (var i = 0; i < targets.length; i++) {
        var ranged = 0;
        var attack = 0;
        var heal = 0;
        for (var j = 0; j < targets[i].body.length; j++) {
          var body = targets[i].body[j];
          if (body.type == Game.RANGED_ATTACK) {
            ranged += body.hits;
          } else if (body.type == Game.ATTACK) {
            attack += body.hits;
          } else if (body.type == Game.HEAL) {
            heal += body.hits;
          }
        }
        if (ranged >= maxRanged) {
          if (ranged > maxRanged) {
            maxRanged = ranged;
            chosenIndex = i;
          } else if (attack >= maxAttack) {
            if (attack > maxAttack) {
              maxAttack = attack;
              chosenIndex = i;
            } else if (heal > maxHeal) {
              maxHeal = heal;
              chosenIndex = i;
            }
          }
        }
      }
      creep.rangedAttack(targets[chosenIndex]);
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
        } else if (creep.pos.x < 25) {
          creep.move(Game.RIGHT);
        }
      } else if (creep.pos.y == 7) {
        creep.move(Game.RIGHT);
      }
    }
});

for(var i in Game.creeps) {
    doAction(Game.creeps[i]);
}

if (crp.guard.count > 1) {
  crp.harvester.maxCount = 2;
  crp.carry.maxCount = 4;
}
crp.healer.maxCount = Math.floor(crp['guard'].count / 4);

for (var typeName in crp) {
    var myCrp = crp[typeName];
    if (myCrp.count < myCrp.maxCount) {
        for(var i in Game.spawns) {
            var mySpawn = Game.spawns[i];
            if (!mySpawn.spawning) {
                mySpawn.createCreep(myCrp.body, null, {role: myCrp.typeName});
            }
        }
        break;
    }
}
