"use strict";
const ENV = process.env;
const ghost3a = require('../ghost3a');
const access = require('./access');
const myhome = require('./src/home');
/**
 * 初始化
 */
const app = ghost3a.context.create(__filename, ENV.MYAPP_ENV, ENV.MYAPP_NAME, ENV.MYAPP_PORT);
app.loadLogx4js(app.getBase() + '/cfgs/logx4js.json');//最先调用以便输出后续步骤的日志
app.loadConfig('mongoConfig', app.getBase() + '/cfgs/mongo.json');
app.configure('development|production', function () {
    app.set('serverConfig', {
        ssl: false,//如有ssl证书则为 ssl:{key:xxxx,cert:xxxx}
        wss: true,//创建websocket服务器，不需要websocket服务器则传fasle，可传对象来进行定制（对象属性请参考依赖库https://github.com/websockets/ws）
        webGzip: true,//web请求开启gzip压缩，不需要压缩则传false，可传对象来进行定制（对象属性请参考依赖库https://github.com/expressjs/compression）
        webApiRoot: '/test',//web接口的前缀
        webCookieKey: '1234567890'//cookie的加密口令，不需要加密则传false
        // webUploadDir:'上传文件保存的绝对路径'
        // webUploadMax:'上传文件允许的最大字节'
    });
});
app.configure('development', function () {
    app.set('maxAge', '0');
});
app.configure('production', function () {
    app.set('maxAge', '2h');
});
ghost3a.mongodb.create(app.get('mongoConfig'), app, function (mongo) {
    app.start(mongo, access, function () {
        //加载静态资源
        app.configure('development|production', 'home', function () {
            app.webapp.use('/', app.express.static('./web', {maxAge: app.get('maxAge')}));
            app.webapp.use('/files', app.express.static('./test/files', {maxAge: app.get('maxAge')}));
        });
    }, function () {
        //加载逻辑接口
        app.configure('development|production', 'home', function () {
            myhome(app, ghost3a.router(app, ENV.MYAPP_LINK, ENV.MYAPP_SEVS));
        });
    });
});
// app.logger.info("运行环境:", ENV.NODE_ENV, ENV.MYAPP_ENV, ENV.MYAPP_NAME, ENV.MYAPP_HOST, ENV.MYAPP_PORT, ENV.MYAPP_INIP, ENV.MYAPP_LINK, ENV.MYAPP_SEVS);
// app.printInfo(true, true);
/**
 * uncaughtException 捕获所有未处理的异常, 避免程序崩溃
 */
process.on('uncaughtException', function (err) {
    app.logger.error('未处理的执行异常: ' + err.stack);
});