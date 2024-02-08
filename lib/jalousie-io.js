#!/usr/bin/env node

import os      from 'node:os';

import fsExtra from 'fs-extra';
import mqtt    from 'async-mqtt';

import Action  from './Action.js';
import Buttons from './Buttons.js';
import Dht22   from './Dht22.js';
import logger  from './logger.js';
import Regen   from './Regen.js';
import signal  from './signal.js';
import Sonne   from './Sonne.js';
import Wind    from './Wind.js';

const hostname = os.hostname();

// *************************************************************************
// main()
(async() => {
  try {
    logger.info('-----------------------------------\n' +
      '                    Starting Jalousie-io');

    try {
      await fsExtra.access('/var/run/pigpio.pid', fsExtra.constants.F_OK);
      logger.info('Cleanup pid file of previous run');
      await fsExtra.rm('/var/run/pigpio.pid');
    } catch{
      // File does not exist. Nothing to clean up. Fine.
    }

    // Register handler for uncaught exceptions and rejections.
    process.on('uncaughtException', err => {
      logger.error(`Uncaught exception`, err);
      process.exit(10);
    });

    process.on('unhandledRejection', reason => {
      logger.error(`Unhandled rejection`, reason);
      process.exit(11);
    });

    // Init MQTT connection
    const mqttClient = await mqtt.connectAsync('tcp://192.168.6.5:1883', {clientId: hostname});

    // Set the jalousie outputs to the initial state.
    const action = new Action({mqttClient});

// TODO nur wenn nicht gerade alarm
    logger.info('Init: JALOUSIE_OFF');
    await action.start('JALOUSIE_OFF');

    // Set buttons to trigger actions.
    // eslint-disable-next-line no-new
    new Buttons({action});

    // Enable the wind sensor.
    // eslint-disable-next-line no-new
    new Wind({mqttClient});

    // Enable the rain sensor.
    // eslint-disable-next-line no-new
    new Regen({mqttClient});

    // Enable the sun sensor.
    // eslint-disable-next-line no-new
    new Sonne({mqttClient});

    // Enable the temperature sensor.
    // eslint-disable-next-line no-new
    new Dht22({mqttClient});

    // Initialize the signal handler to properly cleanup on shutdown.
    signal.installCleanupOnStop({mqttClient});
  } catch(err) {
    /* eslint-disable no-console */
    console.error(err);
    /* eslint-enable no-console */
    logger.error(err);

    process.exit(1);
  }
})();
