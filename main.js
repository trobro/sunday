var harvester = require('harvester');

var crp;
function createCrp(typeName, count, maxCount, action) {
    crp[typeName] = {
        'typeName': typeName,
        'count': count,
        'maxCount': maxCount,
        'action': action
    };
}

function doAction(creep) {
    myCrp = crp[creep.memory.role];
    myCrp.count++;
    myCrp.action(creep);
}

createCrp('harvester', 0, 3, function(creep) {
    harvester(creep);
});

createCrp('builder', 0, 1, function(creep) {
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

createCrp('guard', 0, 1, function(creep) {
    var targets = creep.room.find(Game.HOSTILE_CREEPS);
    if(targets.length) {
        creep.moveTo(targets[0]);
        creep.attack(targets[0]);
    }
});

for(var name in Game.creeps) {
    doAction(Game.creeps[name]);
}

for (var myCrp in crp) {
    if (myCrp.count < myCrp.maxCount) {
        for(var i in Game.spawns) {
            var mySpawn = Game.spawns[i];
            if (!mySpawn.spawning) {
                mySpawn.createCreep(myCrp.body, null, {role: myCrp.typeName});
            }
        }
    }
}
