module.exports = {
    apps: require('../ghost3a').pm2cfg.create(process.argv, __filename, '/cfgs/pm2cfg.json', false).getPm2Apps()
};
