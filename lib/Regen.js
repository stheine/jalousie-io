'use strict';

const check       = require('check-types-2');
const Gpio        = require('pigpio').Gpio;
// const millisecond = require('millisecond');

const config      = require('./config');
const logger      = require('./logger');

// The Rain sensor is connected to the Raspi GPIO_RAIN
// and is triggering an interrupt/ callback function to
// calculate the amount of rain per day.

// Pull-up, normalerweise High - beim kippen Low
// High
// High
// High - Wippe kippt
// Low  - Wippe wippt
// High - Wippe angekommen
// High
// High
class Regen {
  constructor({mqttClient}) {
    check.assert.object(mqttClient, 'mqttClient missing');

    this.mqttClient      = mqttClient;
    this.triggerLowTime  = null;
    this.triggerLastTime = new Date();

// TODO  const oldStatus = await status.read();

// TODO  level = Number(oldStatus.level) || 0;
    this.level = 0; // TODO weg

    this.trigger = this.trigger.bind(this);

    const gpio = new Gpio(config.GPIO_RAIN, {
      mode:       Gpio.INPUT,
      pullUpDown: Gpio.PUD_UP,
      alert:      true,
//      edge:       Gpio.EITHER_EDGE, // interrupt on either edge
//      timeout:     xxx milliseconds  // interrupt only
    });

    gpio.glitchFilter(10); // for alert only

    gpio.on('interrupt', level => {
      logger.debug(`trigger interrupt raw(${level})`);
    });

    gpio.on('alert', this.trigger);
  }

  trigger(triggerLevel) {
    logger.debug(`trigger(${triggerLevel})`);

    const now = new Date();
    let   triggerDuration;

    switch(triggerLevel) {
// TODO interrupt/ alert/ timeout     case Gpio.TIMEOUT:
//        logger.debug('Interrupt watchdog timeout');
//
//        return;

      case 0:
        if(this.triggerLowTime) {
          logger.warn('this.triggerLowTime set on down edge');
        }

        this.triggerLowTime = now;

        return;

      case 1:
        if(!this.triggerLowTime) {
          logger.warn('this.triggerLowTime missing on up edge');
          this.triggerLowTime = now;
        }

        triggerDuration = now.diff(this.triggerLowTime);
        this.triggerLowTime = null;

        break;

      default:
        logger.error(`Unhandled triggerLevel ${triggerLevel}`);

        return;
    }

    const diffSinceLast = now.diff(this.triggerLastTime); // milliseconds

    this.triggerLastTime = now;

//    if(diffSinceLast < millisecond('1 minute')) {
//      // Phantominterrupt (> 1/min)
//      logger.debug(`Suppressing rain phantom interrupt for diffSinceLast=${diffSinceLast}ms`);
//
//      return;
//    }
    if(triggerDuration < 50) {
      // Phantominterrupt (> 1/min)
      logger.debug(`Suppressing rain phantom interrupt for triggerDuration=${triggerDuration}ms`); // TODO comment

      return;
    }

    logger.warn(`trigger(${triggerLevel} diff=${diffSinceLast}ms duration=${triggerDuration}ms)`); // TODO comment

    this.level += 0.44;
    // TODO update status

    const result = {level: this.level};

    this.mqttClient.publish('Regen/tele/SENSOR', JSON.stringify(result));
  }
}

module.exports = Regen;
