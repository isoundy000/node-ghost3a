"use strict";
const fs = require('fs');
const path = require('path');
const Pm2cfg = function (processArgv, bootfile, configfile, logLevel) {
    this.logLevel = logLevel;
    this.env = processArgv[processArgv.length - 1];//最后一个参数是应用环境类型
    this.dir = path.dirname(bootfile);
    this.data = JSON.parse(fs.readFileSync(this.dir + configfile, 'utf8'));
    if (this.logLevel > 0) console.log('env:', this.env);
    if (this.logLevel > 0) console.log('dir:', this.dir);
};

Pm2cfg.prototype.getPm2Apps = function () {
    if (this.env === 'project') {
        return null;
    }
    const cfg = this.data[this.env];
    if (!cfg) {
        return null;
    }
    const pro = this.data['project'] || {};
    const apps = [];
    const sevs = {};
    for (let key in cfg) {
        let group = cfg[key];
        sevs[key] = [];
        for (let i = 0; i < group.length; i++) {
            let item = group[i];
            //pm2进程属性
            let inst = {
                name: item.name || ((pro.name ? pro.name + '-' : "") + key),
                script: item.script || pro.script || 'app.js',
                instances: item.instances || pro.instances || '1',
                exec_mode: item.exec_mode || pro.exec_mode || 'cluster',
                output: item.output || pro.output || '/dev/null',
                error: item.error || pro.error || (this.dir + '/logs/pm2-error.log')
            };
            //app进行属性
            inst['env_' + this.env] = {
                NODE_ENV: this.env === 'development' ? this.env : 'production',//nodejs运行环境(定义为production有利于提高性能)
                MYAPP_ENV: this.env,//应用运行环境
                MYAPP_NAME: key,//分组类型
                MYAPP_HOST: item.host,//外网地址
                MYAPP_PORT: item.port,//端口号码
                MYAPP_INIP: item.inip || '',//内网ip
                MYAPP_LINK: item.link || [],//需要连接的进程分组
                MYAPP_SEVS: sevs//同种分组类型的地址列表
            };
            sevs[key].push({
                host: item.host,
                inip: item.inip || '',
                port: item.port,
                ssls: pro.ssls[this.env].indexOf(key) >= 0
            });
            apps.push(inst);
        }
    }
    if (this.logLevel > 2) console.log('apps:\n', JSON.stringify(apps, null, 2));
    else if (this.logLevel > 1) console.log('apps:\n', apps);
    return apps;
};
module.exports = {
    /**
     * @param processArgv 进程启动命令参数列表
     * @param bootfile PM2启动文件ecosystem.config.js的路径
     * @param configfile 服务器配置文件相对路径
     * @param logLevel 打印调试信息级别
     * @returns {Pm2cfg} 类实例
     */
    create: function (processArgv, bootfile, configfile, logLevel) {
        return new Pm2cfg(processArgv, bootfile, configfile, logLevel);
    }
};