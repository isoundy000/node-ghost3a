"use strict";
const ghost3a = require('../ghost3a');
const access = require('./access');
/**
 * 初始化
 */
const app = ghost3a.context.create(__filename, process.argv[2], process.argv[3], process.argv[4], '0');
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
    console.log(mongo.formatDate(new Date(mongo.getDayStart(new Date(), 0)), 'yyyy-MM-dd HH:mm:ss'), mongo.getDayStart(new Date(), 0));
    console.log(mongo.formatDate(new Date(mongo.getMonthStart(new Date(), 0)), 'yyyy-MM-dd HH:mm:ss'), mongo.getMonthStart(new Date(), 0));
    console.log(mongo.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss'), new Date(), new Date().toLocaleString());
    mongo.insertOneDoc('test', {time: Date.now()});
    mongo.countDocs('test', {}, null, function (n) {
        app.logger.info('test count:', n);
    });
    mongo.findManyDocs('test', {}, null, {}, 0, 100, null, function (docs, total) {
        app.logger.info('test total:', total);
    });
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
        const router = ghost3a.router(app);
        router.start({
            onLogin: function (session, pack) {
                session.bindUid(pack.message.uid);
                router.response(session, pack, '登录成功');
            },
            onJoinRoom: function (session, pack) {
                router.joinChannel(session, pack.message.rid);
                router.response(session, pack, '进入房间成功');
            },
            onQuitRoom: function (session, pack) {
                router.quitChannel(session, pack.message.rid);
                router.response(session, pack, '退出房间成功');
            },
            onPushRoom: function (session, pack) {
                router.pushChannel(pack.message.rid, 'onPushRoom', '大家好' + new Date());
            },
            onDeleteRoom: function (session, pack) {
                router.pushChannel(pack.message.rid, 'onDeleteRoom', '删除前置');
                router.deleteChannel(pack.message.rid);
                router.pushChannel(pack.message.rid, 'onDeleteRoom', '删除后置');
            },
            onBroadcast: function (session, pack) {
                router.broadcast('onBroadcast', '大家好' + new Date());
            },
            onBeClose: function (session, pack) {
                router.pushData(session, 'onBeClose', "即将被动关闭");
                // session.socket.close();
                session.socket.terminate();
            }
        }, 3000, 10000);
    });
});
// app.printInfo(true, true);
/**
 * uncaughtException 捕获所有未处理的异常, 避免程序崩溃
 */
process.on('uncaughtException', function (err) {
    app.logger.error('uncaughtException exception: ' + err.stack);
});