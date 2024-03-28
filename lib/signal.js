import check    from 'check-types-2';
import {logger} from '@stheine/helpers';
import pigpio   from 'pigpio';

const cleanup = async function({mqttClient}) {
  logger.info('Quit process');

  mqttClient.end();

  pigpio.terminate();
};

const handleCleanupAndExit = async function({mqttClient}) {
  await cleanup({mqttClient});

  logger.info('Exit process after cleanup\n\n\n');

  // Stop the node process listen on stdin.
  // Otherwise the process would not properly end.
  if(process.stdin.isTTY) {
    process.stdin.end();
  }

  // Exit
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit();
};

export default {
  installCleanupOnStop({mqttClient}) {
    check.assert.object(mqttClient, 'mqttClient missing');

    // Make the node process listen on stdin.
    // This is required to make CTRL-C trigger a SIGINT that can be handled.
    if(process.stdin.isTTY) {
      process.stdin.resume();
    } else {
      // Started as daemon, no stdin
      logger.info('No stdin listener');
    }

    process.on('SIGINT', () => {
      logger.debug('Caught SIGINT');

      handleCleanupAndExit({mqttClient});
    });

    process.on('SIGTERM', () => {
      logger.debug('Caught SIGTERM');

      handleCleanupAndExit({mqttClient});
    });

    logger.debug('Signal handler installed');
  },
};
