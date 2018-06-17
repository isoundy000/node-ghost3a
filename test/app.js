var ghost3a = require("../ghost3a"),
    access = require("./access");
/**
 * 初始化
 */
var app = ghost3a.createWebApp();
app.configure("production|development", function () {
    app.set("serverConfig", {
        nameSpace: '/test',
        useGzip: true,
        cookieSecret: '1234567890'
    });
    app.set("maxAge", "0");
    app.loadConfig('mongoConfig', app.getBase() + '/config/mongo.json');
});
ghost3a.mongodb.create(app.get('mongoConfig'), app, function (mongo) {
    app.start(mongo, access, function () {
        app.configure("production|development", function () {
            app.webapp.use('/', app.express.static('./test/web', {
                maxAge: app.get("maxAge")
            }));
            app.webapp.use('/files', app.express.static('./files', {
                maxAge: app.get("maxAge")
            }));
        });
    }, function () {

    });
});
app.printInfo(false, false);
/**
 * uncaughtException 捕获所有未处理的异常, 避免程序崩溃
 */
process.on('uncaughtException', function (err) {
    app.logger.error('uncaughtException exception: ' + err.stack);
});