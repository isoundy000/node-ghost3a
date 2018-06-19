var ghost3a = require('../ghost3a');
var access = require('./access');
/**
 * 初始化
 */
var app = ghost3a.context.create(__filename, process.argv[2], process.argv[3], process.argv[4], '0');
app.loadLogx4js(app.getBase() + '/config/logx4js.json');//最先调用以便输出后续步骤的日志
app.loadConfig('mongoConfig', app.getBase() + '/config/mongo.json');
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
            app.webapp.use('/', app.express.static('./test/web', {
                maxAge: app.get('maxAge')
            }));
            app.webapp.use('/files', app.express.static('./test/files', {
                maxAge: app.get('maxAge')
            }));
        });
    }, function () {
        //加载逻辑接口
        app.wssapp.on('connection', function (socket) {
            app.logger.info('on connection');
            socket.on('message', function (message) {
                app.logger.info('on message: %s', message);
                socket.send('时间: ' + new Date() + ', md5 = ' + app.getMd5(message));
            });
            socket.on('close', function () {
                app.logger.info('on close');
            });
            socket.on('error', function (error) {
                app.logger.info('on error', error);
            });
        });
    });
});
app.printInfo(true, true);
/**
 * uncaughtException 捕获所有未处理的异常, 避免程序崩溃
 */
process.on('uncaughtException', function (err) {
    app.logger.error('uncaughtException exception: ' + err.stack);
});