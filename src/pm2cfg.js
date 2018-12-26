"use strict";
const fs = require('fs');
const path = require("path");
const Pm2cfg = function (processArgv, bootfile, configfile, debug) {
    this.debug = debug;
    this.env = processArgv[processArgv.length - 1];//最后一个参数是运行环境类型
    this.dir = path.dirname(bootfile);
    this.data = JSON.parse(fs.readFileSync(this.dir + configfile, 'utf8'));
    if (this.debug) console.log(this.env, this.dir);
};

Pm2cfg.prototype.getPm2Apps = function () {
    if (this.env === "project") {
        return null;
    }
    let cfg = this.data[this.env];
    if (!cfg) {
        return null;
    }
    let pro = this.data["project"] || {};
    let res = [];
    for (let key in cfg) {
        let group = cfg[key];
        for (let i = 0; i < group.length; i++) {
            let item = group[i];
            let inst = {
                name: item.name || ((pro.name ? pro.name + "-" : "") + key),
                script: item.script || pro.script || "app.js",
                instances: item.instances || pro.instances || "1",
                exec_mode: item.exec_mode || pro.exec_mode || "cluster",
                output: item.output || pro.output || "/dev/null",
                error: item.error || pro.error || (this.dir + "/logs/pm2-error.log")
            };
            inst["env_" + this.env] = {
                NODE_ENV: this.env === "development" ? this.env : "production",
                MYAPP_NAME: key,
                MYAPP_HOST: item.host,
                MYAPP_PORT: item.port,
                MYAPP_INIP: item.inip
            };
            res.push(inst);
        }
    }
    if (this.debug) console.log(res);
    return res;
};

module.exports = {
    /**
     *
     * @param processArgv 进程启动命令参数列表
     * @param bootfile PM2启动文件ecosystem.config.js的路径
     * @param configfile 服务器配置文件相对路径
     * @param debug 是否打印调试信息
     * @returns {Pm2cfg} 类实例
     */
    create: function (processArgv, bootfile, configfile, debug) {
        return new Pm2cfg(processArgv, bootfile, configfile, debug);
    }
};