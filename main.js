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

function doAction(creep) {
    myCrp = crp[creep.memory.role];
    myCrp.count++;
    myCrp.action(creep);
}

createCrp('harvester', 4, [Game.WORK, Game.WORK, Game.CARRY, Game.CARRY, Game.MOVE], function(creep) {
    if(creep.energy < creep.energyCapacity) {
        var target = creep.pos.findClosest(Game.SOURCES);
        if (creep.harvest(target) < 0) {
          creep.moveTo(target);
        }
    } else {
        var target = creep.pos.findClosest(Game.MY_SPAWNS);
        if (creep.transferEnergy(target) < 0) {
          creep.moveTo(target);
        }
    }
});

createCrp('builder', 0, [Game.WORK, Game.WORK, Game.WORK, Game.CARRY, Game.MOVE], function(creep) {
    if(creep.energy == 0) {
        var target = creep.pos.findClosest(Game.MY_SPAWNS);
        creep.moveTo(target);
        target.transferEnergy(creep);
    } else {
        var targets = creep.room.find(Game.CONSTRUCTION_SITES);
        if(targets.length) {
            creep.moveTo(targets[0]);
            creep.build(targets[0]);
        }
    }
});

createCrp('healer', 0, [Game.MOVE, Game.MOVE, Game.HEAL, Game.HEAL], function(creep) {
    var enemy = creep.pos.findClosest(Game.HOSTILE_CREEPS);
    if (enemy && creep.pos.inRangeTo(enemy.pos, 4)) {
      creep.moveTo(creep.pos.x - (enemy.pos.x - creep.pos.x), creep.pos.y - (enemy.pos.y - creep.pos.y));
      return;
    }
    var minDistance = 100000;
    var chosenIndex = '';
    var maxDamage = 0;
    for(var i in Game.creeps) {
      var target = Game.creeps[i];
      if (target && target.hits < target.hitsMax) {
        var damage = target.hitsMax - target.hits;
        var distance = Math.max(Math.abs(target.pos.x - creep.pos.x),
          Math.abs(target.pos.y - creep.pos.y));
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
          creep.moveTo(target);
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
    var spawn = creep.pos.findClosest(Game.MY_SPAWNS);
    if (spawn && creep.pos.x - spawn.pos.x < (Object.keys(Game.creeps).length > 18 ? 13 : 10)) {
      if (spawn && spawn.pos.y - creep.pos.y < 3) {
        if (creep.room.lookAt(creep.pos.x + 1, creep.pos.y - 1).length < 2) {
          creep.move(Game.TOP_RIGHT);
        } else if (creep.room.lookAt(creep.pos.x, creep.pos.y - 1).length < 2) {
          creep.move(Game.TOP);
        } else {
          creep.move(Game.RIGHT);
        }
      } else {
        creep.move(Game.RIGHT);
      }
    }
});

for(var i in Game.creeps) {
    doAction(Game.creeps[i]);
}

if (crp['guard'].count > 0) {
  crp['harvester'].maxCount = 10;
}
crp['healer'].maxCount = Math.floor(crp['guard'].count / 4);

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
