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

createCrp('harvester', 3, [Game.WORK, Game.CARRY, Game.MOVE], function(creep) {
    if(creep.energy < creep.energyCapacity) {
        var sources = creep.room.find(Game.SOURCES);
        creep.moveTo(sources[0]);
        creep.harvest(sources[0]);
    }
    else {
        creep.moveTo(Game.spawns.Spawn1);
        creep.transferEnergy(Game.spawns.Spawn1)
    }
});

createCrp('builder', 1, [Game.WORK, Game.WORK, Game.WORK, Game.CARRY, Game.MOVE], function(creep) {
    if(creep.energy == 0) {
        creep.moveTo(Game.spawns.Spawn1);
        Game.spawns.Spawn1.transferEnergy(creep);
    }
    else {
        var targets = creep.room.find(Game.CONSTRUCTION_SITES);
        if(targets.length) {
            creep.moveTo(targets[0]);
            creep.build(targets[0]);
        }
    }
});

createCrp('guard', 100, [Game.ATTACK, Game.CARRY, Game.MOVE], function(creep) {
    var targets = creep.room.find(Game.HOSTILE_CREEPS);
    if(targets.length) {
        creep.moveTo(targets[0]);
        creep.attack(targets[0]);
    }
});

for(var name in Game.creeps) {
    doAction(Game.creeps[name]);
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
    }
}
