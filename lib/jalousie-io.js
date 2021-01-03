#!/usr/bin/env node

'use strict';

const mqtt    = require('async-mqtt');

const Action  = require('./Action');
const Buttons = require('./Buttons');
const Dht22   = require('./Dht22');
const logger  = require('./logger');
const Regen   = require('./Regen');
const signal  = require('./signal');
const Sonne   = require('./Sonne');
const Wind    = require('./Wind');

// *************************************************************************
// main()
(async() => {
  try {
    logger.info('-----------------------------------\n' +
      '                    Starting Jalousie-io');

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
    const mqttClient = await mqtt.connectAsync('tcp://192.168.6.7:1883');

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
