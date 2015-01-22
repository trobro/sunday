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
    for(var i in Game.creeps) {
      var target = Game.creeps[i];
      if(target && target.hits < target.hitsMax) {
        creep.moveTo(target);
        if (creep.heal(target) < 0) {
          creep.rangedHeal(target);
        }
        return;
      }
    }
    if (creep.pos.y < 13) {
      creep.moveTo(35, 12);
    }
});

createCrp('guard', 100, [Game.MOVE, Game.RANGED_ATTACK, Game.RANGED_ATTACK, Game.RANGED_ATTACK, Game.RANGED_ATTACK], function(creep) {
    if (creep.pos.findInRange(Game.HOSTILE_CREEPS, 1).length > 0) {
      creep.rangedMassAttack();
    } else {
      var targets = creep.pos.findInRange(Game.HOSTILE_CREEPS, 3);
      var minHits = 100000;
      var chosenIndex = 0;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].hits < minHits) {
          minHits = targets[i].hits;
          chosenIndex = i;
        }
      }
      creep.rangedAttack(targets[chosenIndex]);
    }
    var spawn = creep.pos.findClosest(Game.MY_SPAWNS);
    if (spawn && creep.pos.x - spawn.pos.x < 10) {
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
