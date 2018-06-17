var Mongo = function (cfg, context, onConnected) {
    this.mongodb = require('mongodb');
    this.cfg = cfg;//数据库配置
    this.logger = context.getLogger('mongo', __filename);//日志记录器
    this.db = null;//数据库实例
    this.set = {};//数据表集合
    this.connect(null, onConnected);
};
/**
 * 创建销毁
 */
Mongo.prototype.connect = function (name, callback) {
    var self = this;
    if (self.db) {
        self.onConnected(name, callback);
    } else {
        self.mongodb.MongoClient.connect(self.cfg.url, self.cfg.opts || {}, function (error, db) {
            if (!error) {
                if (self.cfg.user && self.cfg.pwd) {
                    db.authenticate(self.cfg.user, self.cfg.pwd, function (error, result) {
                        if (!error) {
                            self.logger.info('mongo authenticate success. ');
                            self.db = db;
                            self.onConnected(name, callback);
                        } else {
                            self.logger.error('mongo connect error. ', error);
                        }
                    });
                } else {
                    self.logger.info('mongo connect success. ');
                    self.db = db;
                    self.onConnected(name, callback);
                }
            } else {
                self.logger.error('mongo connect error. ', error);
            }
        });
    }
};
Mongo.prototype.destroy = function () {
    var self = this;
    if (self.db) {
        self.db.close();
    }
};
Mongo.prototype.onConnected = function (name, callback) {
    var self = this;
    if (callback) {
        if (name) {
            if (!self.set[name]) {
                self.set[name] = self.db.collection(name);
            }
            callback(self.set[name]);
        } else {
            callback(self);
        }
    }
};
/**
 * 查询函数
 */
Mongo.prototype.insertOneDoc = function (name, doc, options, onSuccess, onError) {
    options = options || {};
    var self = this;
    if (!doc._id) {
        doc._id = self.genID();
    }
    if (!doc._time) {
        doc._time = Date.now();
    }
    self.connect(name, function (store) {
        store.insertOne(doc, options, function (error, result) {
            if (!error) {
                if (onSuccess) {
                    onSuccess(doc, result.result.n);
                }
            } else {
                if (onError) {
                    onError(error);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.insertManyDocs = function (name, docs, options, onItem, onSuccess, onError) {
    options = options || {};
    var self = this,
        time = Date.now();
    for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        if (!doc._id) {
            doc._id = self.genID();
        }
        if (!doc._time) {
            doc._time = time;
        }
        if (onItem) {
            onItem(doc);
        }
    }
    self.connect(name, function (store) {
        store.insertMany(docs, options, function (error, result) {
            if (!error) {
                if (onSuccess) {
                    onSuccess(docs, result.result.n);
                }
            } else {
                if (onError) {
                    onError(error);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.findOneDoc = function (name, query, options, onSuccess, onError) {
    options = options || {};
    var self = this;
    self.connect(name, function (store) {
        store.findOne(query, options, function (error, doc) {
            if (!error) {
                if (doc) {
                    if (onSuccess) {
                        onSuccess(doc);
                    }
                } else {
                    if (onError) {
                        onError('找到0条记录', true);
                    }
                }
            } else {
                if (onError) {
                    onError(error, false);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.findManyDocs = function (name, query, options, sort, start, limit, join, onSuccess, onError) {
    options = options || {};
    var self = this;
    self.connect(name, function (store) {
        store.find(query, options).sort(sort).skip(start).limit(limit).toArray(function (error, docs) {
            if (!error) {
                store.count(query, function (error, total) {
                    if (!error) {
                        if (join && docs.length > 0) {
                            //模拟关系数据库join查询,当前只支持 “单个字段 双表 左外连接”
                            var or = [];
                            for (var i = 0; i < docs.length; i++) {
                                var param = {};
                                param[join.right] = docs[i][join.left];
                                or.push(param);
                            }
                            join.options = join.options || {};
                            join.sort = join.sort || {};
                            self.connect(join.target, function (target) {
                                target.find({$or: or}, join.options).sort(join.sort).toArray(function (error, items) {
                                    if (!error) {
                                        for (var i = 0; i < docs.length; i++) {
                                            var doc = docs[i];
                                            doc[join.root] = [];
                                            for (var j = 0; j < items.length; j++) {
                                                var item = items[j];
                                                if (doc[join.left] === item[join.right]) {
                                                    doc[join.root].push(item);
                                                }
                                            }
                                        }
                                        if (onSuccess) {
                                            onSuccess(docs, total);
                                        }
                                    } else {
                                        if (onError) {
                                            onError(error);
                                        }
                                        self.logger.error(error);
                                    }
                                });
                            });
                        } else {
                            if (onSuccess) {
                                onSuccess(docs, total);
                            }
                        }
                    } else {
                        if (onError) {
                            onError(error);
                        }
                        self.logger.error(error);
                    }
                });
            } else {
                if (onError) {
                    onError(error);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.updateOneDoc = function (name, filter, update, options, onSuccess, onError) {
    options = options || {};
    var self = this;
    self.connect(name, function (store) {
        store.updateOne(filter, update, options, function (error, result) {
            if (!error) {
                if (onSuccess) {
                    onSuccess(result.result.n);
                }
            } else {
                if (onError) {
                    onError(error);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.updateManyDocs = function (name, filter, update, options, onSuccess, onError) {
    options = options || {};
    var self = this;
    self.connect(name, function (store) {
        store.updateMany(filter, update, options, function (error, result) {
            if (!error) {
                if (onSuccess) {
                    onSuccess(result.result.n);
                }
            } else {
                if (onError) {
                    onError(error);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.findAndUpdateOneDoc = function (name, filter, update, options, onSuccess, onError) {
    options = options || {};
    var self = this;
    self.connect(name, function (store) {
        store.findOneAndUpdate(filter, update, options, function (error, result) {
            if (!error) {
                if (result.value) {
                    if (onSuccess) {
                        onSuccess(result.value);
                    }
                } else {
                    if (onError) {
                        onError('找到0条记录', true);
                    }
                }
            } else {
                if (onError) {
                    onError(error, false);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.deleteOneDoc = function (name, filter, options, onSuccess, onError) {
    options = options || {};
    var self = this;
    self.connect(name, function (store) {
        store.deleteOne(filter, options, function (error, result) {
            if (!error) {
                if (onSuccess) {
                    onSuccess(result.result.n);
                }
            } else {
                if (onError) {
                    onError(error);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.deleteManyDocs = function (name, filter, options, onSuccess, onError) {
    options = options || {};
    var self = this;
    self.connect(name, function (store) {
        store.deleteMany(filter, options, function (error, result) {
            if (!error) {
                if (onSuccess) {
                    onSuccess(result.result.n);
                }
            } else {
                if (onError) {
                    onError(error);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.count = function (name, query, onSuccess, onError, context) {
    var self = this;
    self.connect(name, function (store) {
        store.count(query, function (error, total) {
            if (!error) {
                if (onSuccess) {
                    onSuccess(total, context);
                }
            } else {
                if (onError) {
                    onError(error, context);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.aggregate = function (name, pipeline, options, onSuccess, onError, context) {
    options = options || {};
    var self = this;
    self.connect(name, function (store) {
        store.aggregate(pipeline, options, function (error, result) {
            if (!error) {
                if (onSuccess) {
                    onSuccess(result, context);
                }
            } else {
                if (onError) {
                    onError(error, context);
                }
                self.logger.error(error);
            }
        });
    });
};
Mongo.prototype.increment = function (name, key, step, onSuccess, onError) {
    var self = this,
        inc = {};
    inc[key] = step;
    self.connect(name, function (store) {
        store.findOneAndUpdate({}, {
            $inc: inc
        }, {
            returnOriginal: false
        }, function (error, result) {
            if (!error) {
                if (result.value) {
                    if (onSuccess) {
                        onSuccess(result.value[key]);
                    }
                } else {
                    if (onError) {
                        onError('找到0条记录', true);
                    }
                }
            } else {
                if (onError) {
                    onError(error, false);
                }
                self.logger.error(error);
            }
        });
    });
};
/**
 * 工具函数
 */
Mongo.prototype.genID = function () {
    return new this.mongodb.ObjectID().toString();
};
Mongo.prototype.genID14 = function () {
    var id = new this.mongodb.ObjectID().toString();
    return id.substring(0, 8) + id.substring(18, 24);//该方案去掉了机器号码与进程号码
};
Mongo.prototype.getDayStart = function (baseDate, offsetDay) {
    var fd = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDay).format('yyyy-MM-dd 00:00:00');
    return Date.parse(fd);
};
Mongo.prototype.getMonthStart = function (baseDate, offsetMonth) {
    var fd = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonth, 1).format('yyyy-MM-01 00:00:00');
    return Date.parse(fd);
};

module.exports = {
    /**
     * @param cfg 数据库配置
     * @param context 应用类实例
     * @param onConnected 数据库连接后的回调函数
     * @returns {Mongo} 类实例
     */
    create: function (cfg, context, onConnected) {
        return new Mongo(cfg, context, onConnected);
    }
};