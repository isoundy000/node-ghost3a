var path = require('path'),
    baseDir = path.dirname(process.argv[1]);
module.exports = {
    logx4js: require('./src/logx4js'),
    mongodb: require('./src/mongo'),
    createApp: function () {
        return require('./src/context')(baseDir, process.argv[2] || 'development', process.argv[3] || '8080', process.argv[4] || 'master');
    }
};