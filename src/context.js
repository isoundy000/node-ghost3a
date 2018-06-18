var path = require('path'),
    compress = require('compression'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    multer = require('multer'),
    fs = require('fs'),
    crypto = require('crypto'),
    logx4js = require('./logx4js');
var Context = function (base, env, port, type) {
    this.base = base;
    this.env = env;
    this.port = port;
    this.type = type;
    this.config = {
        serverConfig: {
            nameSpace: "/default",
            ssl: false,
            useGzip: false,
            cookieSecret: false,
            uploadDir: this.base + '/files',
            uploadSize: 1024 * 1024 * 10 //字节
        }
    };
    this.logcfg = null;
    this.logger = null;
    this.express = null;
    this.webapp = null;
    this.server = null;
    this.mongo = null;
    this.access = null;
    this.upload = null;
};
Context.prototype.loadLogx4js = function (filepath) {
    var logStr = fs.readFileSync(filepath, 'utf8');
    logStr = logStr.replace(new RegExp("\\$\\{opts\\:base\\}", 'gm'), this.getBase());
    logStr = logStr.replace(new RegExp("\\$\\{opts\\:type\\}", 'gm'), this.type);
    logStr = logStr.replace(new RegExp("\\$\\{opts\\:port\\}", 'gm'), this.port);
    this.logcfg = JSON.parse(logStr);
    logx4js.configure(this.logcfg);
    this.logger = this.getLogger("context", __filename);
};
Context.prototype.loadConfig = function (key, filepath) {
    this.set(key, JSON.parse(fs.readFileSync(filepath, 'utf8'))[this.env]);
};
Context.prototype.configure = function (env, type, callback) {
    if (typeof type === "function") {
        callback = type;
        type = null;
    }
    var envArr = env.split("|");
    if (envArr.indexOf(this.env) >= 0) {
        if (type) {
            var typeArr = type.split("|");
            if (typeArr.indexOf(this.type) >= 0) {
                callback();
            }
        } else {
            callback();
        }
    }
};
Context.prototype.getLogger = function (category, filename) {
    return logx4js.getLogger(category, filename, this.type + "-" + this.port);
};
Context.prototype.getBase = function () {
    return this.base;
};
Context.prototype.set = function (key, value) {
    if (key === "serverConfig") {
        if (typeof value === "object") {
            for (var k in value) {
                this.config.serverConfig[k] = value[k];
            }
        } else {
            this.logger.error("value of serverConfig must be an object");
        }
    } else {
        this.config[key] = value;
    }
};
Context.prototype.get = function (key) {
    return this.config[key];
};
Context.prototype.getIP = function (req) {
    var ip = req.headers['x-forwarded-for'] || req.ip;
    if ('::1' === ip) {
        ip = '127.0.0.1';
    }
    if (ip) {
        ip = ip.replace(new RegExp(':', 'gm'), '');
        ip = ip.replace(new RegExp('f', 'gm'), '');
    } else {
        ip = 'empty.ip';
    }
    return ip;
};
Context.prototype.getMd5 = function (strData) {
    var buf = new Buffer(strData),
        str = buf.toString("binary");//解决md5加密的中文编码不一致问题
    return crypto.createHash("md5").update(str).digest("hex").toUpperCase();
};
Context.prototype.start = function (mongo, access, onLoadModule, onRegisterApi) {
    var self = this;
    var logger = this.logger;
    var config = this.config.serverConfig;
    this.express = require('express');
    this.webapp = this.express();
    this.server = config.ssl ? require('https').createServer({
        key: fs.readFileSync(config.ssl.key, 'utf8'),
        cert: fs.readFileSync(config.ssl.cert, 'utf8')
    }, this.webapp) : require('http').createServer(this.webapp);
    this.mongo = mongo;
    this.access = access;
    this.registerUpload();
    if (config.useGzip) {
        this.webapp.use(compress());//放在最前面,这是中间件的顺序关系，这样可以保证所有内容都经过压缩（框架底层已经过滤掉图片）
    }
    if (config.cookieSecret) {
        this.webapp.use(cookieParser(config.cookieSecret));//若需要使用签名，需要指定一个secret字符串
    }
    this.webapp.use(bodyParser.json());//用于解析application/json
    this.webapp.use(bodyParser.urlencoded({extended: true}));//用户解析application/x-www-form-urlencoded
    this.webapp.all('/*', function (req, res, next) {
        logger.info(self.getIP(req), req.originalUrl);//打印出所有请求路径
        next();
    });
    if (onLoadModule) {
        onLoadModule.call(this);//加载自定义模块或静态资源
    }
    this.registerApi();
    if (onRegisterApi) {
        onRegisterApi.call(this);//加载自定义接口
    }
    this.server.listen(this.port, function () {
        logger.info(self.env, self.type, 'server', self.port, 'is running...');
    });
};
Context.prototype.registerUpload = function () {
    var self = this;
    var logger = this.logger;
    var config = this.config.serverConfig;
    var storage = multer.diskStorage({
        destination: function (req, file, callback) {
            var store = req.params.store,
                date = new Date(),
                folder = config.uploadDir + '/' + store + '/' + date.getFullYear() + '_' + (date.getMonth() + 1) + '_' + date.getDate() + '/';
            self.makeDirs(folder, null, function (dirpath) {
                logger.debug("makeDirs after:", dirpath);
                callback(null, dirpath);
            });
        },
        filename: function (req, file, callback) {
            var store = req.params.store,
                privilege = self.access.store[store];
            if (privilege && privilege.mimeType) {
                var suffix = privilege.mimeType[file.mimetype.toLowerCase()];
                if (suffix) {
                    callback(null, self.mongo.genID() + '.' + suffix);
                } else {
                    callback(new Error('不支持的文件格式'));
                }
            } else {
                callback(new Error('服务端未配置文件格式'));
            }
        }
    });
    this.upload = multer({
        storage: storage,
        limits: {
            fileSize: config.uploadSize
        }
    });
};
Context.prototype.registerApi = function () {
    var self = this;
    var logger = this.logger;
    var config = this.config.serverConfig;
    this.webapp.all(config.nameSpace + '/:store/:method', function (req, res, next) {
        logger.debug('req.params -> \n', req.params);
        logger.debug('req.body -> \n', req.body);
        logger.debug('req.query -> \n', req.query);
        logger.debug('req.cookies -> \n', req.cookies);
        logger.debug('req.signedCookies -> \n', req.signedCookies);
        if (self.access) {
            var store = req.params.store,
                method = req.params.method,
                privilege = self.access.store[store];
            if (method === 'fields' || method === 'mimeType' || !privilege || !privilege[method]) {
                res.json({
                    success: false,
                    message: '没有权限',
                    command: 401
                });
            } else {
                self.access.auth(store, method, req, function () {
                    next();
                }, function (command) {
                    res.json({
                        success: false,
                        message: '没有权限',
                        command: 401
                    });
                });
            }
        } else {
            res.json({
                success: false,
                message: '没有权限',
                command: 401
            });
        }
    });
    this.webapp.all(config.nameSpace + '/:store/upload', function (req, res) {
        var store = req.params.store;
        self.upload.single('file')(req, res, function (error) {
            if (req.file) {
                logger.debug('req.file -> \n', req.file);
                if (!error) {
                    var data = req.body;
                    data._path = req.file.path.replace(new RegExp("\\\\", 'gm'), '/').replace(config.uploadDir, '');//windows系统下分隔符为'\'
                    data._size = req.file.size;
                    data._mimetype = req.file.mimetype;
                    data._orgname = req.file.originalname;
                    logger.debug('data -> \n', data);
                    self.mongo.insertOneDoc(store, data, null, function (obj, n) {
                        res.json({
                            success: true,
                            message: '上传文件成功',
                            data: obj
                        });
                    }, function (error) {
                        res.json({
                            success: false,
                            message: error.toString(),
                            command: 500
                        });
                    });
                } else {
                    res.json({
                        success: false,
                        message: error.toString(),
                        command: 501
                    });
                }
            } else {
                res.json({
                    success: false,
                    message: error ? error.toString() : '上传文件失败',
                    command: 400
                });
            }
        });
    });//实际使用时,必须为POST请求才能收到文件
};
Context.prototype.makeDirs = function (dirpath, mode, callback) {
    var self = this;
    var logger = this.logger;
    fs.exists(dirpath, function (exists) {
        logger.debug("makeDirs check:", dirpath, exists);
        if (exists) {
            callback(dirpath);
        } else {
            self.makeDirs(path.dirname(dirpath), mode, function (parentPath) {
                logger.debug("makeDirs after:", parentPath);
                fs.mkdir(dirpath, mode, function () {
                    callback(dirpath);
                });
            });
        }
    });
};
Context.prototype.printInfo = function (printConfig, printLogCfg) {
    this.logger.info('command info ->\n', JSON.stringify({
        base: this.base,
        env: this.env,
        port: this.port,
        type: this.type
    }, null, 2));
    if (printConfig) {
        this.logger.info('context config ->\n', JSON.stringify(this.config, null, 2));
    }

    if (printLogCfg) {
        this.logger.info('logx4js config ->\n', JSON.stringify(this.logcfg, null, 2));
    }
};
/**
 * @param base 服务器根目录
 * @param env 服务器环境类型（如：development、production等自由定义）
 * @param port 服务器端口号
 * @param type 服务器种类（如：master、slave等自由定义）
 * @returns {Context} 类实例
 */
module.exports = function (base, env, port, type) {
    return new Context(base, env, port, type);
};

