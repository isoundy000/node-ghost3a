var path = require('path'),
    baseDir = path.dirname(process.argv[1]);
module.exports = {
    logxx4j: require('./src/logxx4j'),
    mongodb: require('./src/mongo'),
    createWebApp: function () {
        return require("./src/context")(baseDir, process.argv[2] || "development", process.argv[3] || '8080', process.argv[4] || 'master');
    },
    createSocketApp: function () {

    }
};