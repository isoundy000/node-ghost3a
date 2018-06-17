var log4js = require('log4js');
var logConfig = {};
var lineDebug = false;
var Logxx4j = function (category, filename, serverTag) {
    this.logger = log4js.getLogger(category);
    this.category = category;
    this.filename = filename ? "[" + filename + "] " : "";
    this.serverTag = serverTag ? "[" + serverTag + "] " : "";
};
Logxx4j.prototype.trace = function () {
    arguments[0] = this.getPrefix("trace") + arguments[0];
    this.logger.trace.apply(this.logger, arguments);
};
Logxx4j.prototype.debug = function () {
    arguments[0] = this.getPrefix("debug") + arguments[0];
    this.logger.debug.apply(this.logger, arguments);
};
Logxx4j.prototype.info = function () {
    arguments[0] = this.getPrefix("info") + arguments[0];
    this.logger.info.apply(this.logger, arguments);

};
Logxx4j.prototype.warn = function () {
    arguments[0] = this.getPrefix("warn") + arguments[0];
    this.logger.warn.apply(this.logger, arguments);
};
Logxx4j.prototype.error = function () {
    arguments[0] = this.getPrefix("error") + arguments[0];
    this.logger.error.apply(this.logger, arguments);
};
Logxx4j.prototype.fatal = function () {
    arguments[0] = this.getPrefix("fatal") + arguments[0];
    this.logger.fatal.apply(this.logger, arguments);
};
Logxx4j.prototype.getPrefix = function (level) {
    return colorize((lineDebug ? (getLine() + ": ") : "") + this.filename, colours[level]) + this.serverTag;
};
/**
 * 输出颜色相关
 */
var styles = {
    //styles
    'bold': [1, 22],
    'italic': [3, 23],
    'underline': [4, 24],
    'inverse': [7, 27],
    //grayscale
    'white': [37, 39],
    'grey': [90, 39],
    'black': [90, 39],
    //colors
    'blue': [34, 39],
    'cyan': [36, 39],
    'green': [32, 39],
    'magenta': [35, 39],
    'red': [31, 39],
    'yellow': [33, 39]
};

var colours = {
    'all': "grey",
    'trace': "blue",
    'debug': "cyan",
    'info': "green",
    'warn': "yellow",
    'error': "red",
    'fatal': "magenta",
    'off': "grey"
};

function getLine() {
    return new Error().stack.split('\n')[4].split(':')[1];
}

function colorize(str, style) {
    return colorizeStart(style) + str + colorizeEnd(style);
}

function colorizeStart(style) {
    return style ? '\x1B[' + styles[style][0] + 'm' : '';
}

function colorizeEnd(style) {
    return style ? '\x1B[' + styles[style][1] + 'm' : '';
}

module.exports = {
    /**
     * @param cfg 日志配置文件
     */
    configure: function (cfg) {
        logConfig = cfg;
        lineDebug = !!cfg.lineDebug;
        log4js.configure(cfg);
    },
    /**
     * @param category 日志分类
     * @param filename 调用层文件名
     * @param serverTag 服务器标签
     * @returns {Logxx4j} 类实例
     */
    getLogger: function (category, filename, serverTag) {
        return new Logxx4j(category, filename, serverTag);
    }
};