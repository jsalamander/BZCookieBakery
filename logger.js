const log = require('simple-node-logger').createSimpleLogger();

let logLevel = 'debug';
if (process.env.BAKERY_LOG_LEVEL) {
  logLevel = process.env.BAKERY_LOG_LEVEL;
} else {
  logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

log.setLevel(logLevel);
log.info('using log level ', logLevel);
module.exports = log;
