const pino = require('pino');
const pinoPretty = require('pino-pretty');

const logger = pino({
  level: 'info',
  useOnlyCustomLevels: true,
  customLevels: {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

module.exports = logger;
