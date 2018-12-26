"use strict";
const ghost3a = require('../ghost3a');
const access = require('./access');
const myhome = require('./src/home');
/**
 * 初始化
 */
const app = ghost3a.context.create(__filename, process.env.NODE_ENV, process.env.MYAPP_NAME, process.env.MYAPP_PORT);
app.loadLogx4js(app.getBase() + '/cfgs/logx4js.json');//最先调用以便输出后续步骤的日志
app.loadConfig('mongoConfig', app.getBase() + '/cfgs/mongo.json');
app.configure('development|production', function () {
    app.set('serverConfig', {
        wss: true,
        webGzip: true,
        webApiRoot: '/test',
        webCookieKey: '1234567890'
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
        app.configure('development|production', function () {
            app.webapp.use('/', app.express.static('./test/web', {maxAge: app.get('maxAge')}));
            app.webapp.use('/files', app.express.static('./test/files', {maxAge: app.get('maxAge')}));
        });
    }, function () {
        //加载逻辑接口
        app.configure('development|production', 'home', function () {
            myhome(app, ghost3a.router(app));
        });
    });
});
app.logger.info('运行环境:', process.env.NODE_ENV, process.env.MYAPP_NAME, process.env.MYAPP_HOST, process.env.MYAPP_PORT);
// app.printInfo(true, true);
/**
 * uncaughtException 捕获所有未处理的异常, 避免程序崩溃
 */
process.on('uncaughtException', function (err) {
    app.logger.error('未处理的执行异常: ' + err.stack);
});