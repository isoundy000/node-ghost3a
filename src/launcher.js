var path = require('path'),
    baseDir = path.dirname(process.argv[1]);
/**
 *
 * @type {{createApp: module.exports.createApp}}
 */
module.exports = {
    createWebApp: function () {
        return require("./context")(baseDir, process.argv[2] || "development", process.argv[3] || '8080', process.argv[4] || 'master');
    },
    createSocketApp: function () {

    }
};