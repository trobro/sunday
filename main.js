var harvester = require('harvester');

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

createCrp('harvester', 5, [Game.WORK, Game.WORK, Game.CARRY, Game.CARRY, Game.MOVE], function(creep) {
    if(creep.energy < creep.energyCapacity) {
        var target = creep.pos.findNearest(Game.SOURCES);
        creep.moveTo(target);
        creep.harvest(target);
    } else {
        var target = creep.pos.findNearest(Game.MY_SPAWNS);
        creep.moveTo(target);
        creep.transferEnergy(target);
    }
});

createCrp('builder', 0, [Game.WORK, Game.WORK, Game.WORK, Game.CARRY, Game.MOVE], function(creep) {
    if(creep.energy == 0) {
        var target = creep.pos.findNearest(Game.MY_SPAWNS);
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

var hostileTarget = false;
var leader = false;
createCrp('guard', 100, [Game.TOUGH, Game.TOUGH, Game.TOUGH, Game.MOVE, Game.RANGED_ATTACK], function(creep) {
    if (!hostileTarget) {
        hostileTarget = creep.pos.findNearest(Game.HOSTILE_CREEPS);
    }
    if (hostileTarget) {
        if (!creep.pos.inRangeTo(hostileTarget, 3)) {
            creep.moveTo(hostileTarget);
        }
        if (creep.rangedAttack(hostileTarget) < 0) {
            creep.rangedAttack(creep.pos.findNearest(Game.HOSTILE_CREEPS));
        }
    } else if (creep.pos.findInRange(Game.MY_SPAWNS, 4).length > 0) {
        creep.moveTo(27, 27);
    } else if (!leader) {
        leader = creep;
    } else {
        if (creep.moveTo(leader) < 0) {
            creep.moveTo(leader, {ignoreCreeps: true});
        }
    }
});

for(var i in Game.creeps) {
    doAction(Game.creeps[i]);
}

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
