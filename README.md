# node-ghost3a

分布式服务器集成框架，适用于快速搭建web服务器、websocket服务器，支持ssl加密、数据压缩、文件上传，可扩展性强，轻量级整合。

温馨提示：本框架推荐使用pm2进行进程管理，本框架依赖mongo数据库，未安装mongo数据库的请先安装。

安装pm2命令： npm install pm2 -g

安装本框架命令：npm install node-ghost3a

### 通过本项目test文件中的测试工程可快速入门

 先：git clone git@github.com:yangfanyu/node-ghost3a.git

 然后进入test目录，使用命令：pm2 start ecosystem.config.js --env development  启动测试工程

 然后使用命令：pm2 log 可查看调试日志

 浏览器输入 http://localhost:8081/multiple.html http://localhost:8082/multiple.html 可测试多进程聊天室功能

 浏览器输入 http://localhost:8081/single.html http://localhost:8082/single.html 可测试单进程api功能

### 作者已经使用该框架完成了稳定运行的十多个棋牌游戏

 可搜索微信公众号：舞溪手游











