import check    from 'check-types-2';
import {logger} from '@stheine/helpers';
import ms       from 'ms';
import pigpio   from 'pigpio';

import config   from './config.js';
import status   from './status.js';

const {Gpio} = pigpio;

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
export default class Regen {
  constructor({mqttClient}) {
    check.assert.object(mqttClient, 'mqttClient missing');

    this.mqttClient      = mqttClient;
    this.triggerLowTime  = null;
    this.triggerLastTime = new Date();

    this.level = null;

    (async() => {
      const oldStatus = await status.read();

      this.level = Number(oldStatus.rainLevel);

      logger.debug(`Regen: read old level ${this.level}`);
    })();

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
      logger.debug(`Regen: trigger interrupt raw(${level})`);
    });

    gpio.on('alert', this.trigger);

    setInterval(() => {
      this.sendLevel();
    }, ms('60 seconds'));
  }

  async sendLevel() {
    if(this.level === null) {
      return;
    }

    const result = {level: this.level};

    await this.mqttClient.publishAsync('Regen/tele/SENSOR', JSON.stringify(result), {retain: true});
  }

  async trigger(triggerLevel) {
    // logger.debug(`Regen: trigger(${triggerLevel})`);

    if(this.level === null) {
      logger.warn('Regen: this.trigger but this.level missing');

      return;
    }

    const now = new Date();
    let   triggerDuration;

    switch(triggerLevel) {
// TODO interrupt/ alert/ timeout     case Gpio.TIMEOUT:
//        logger.debug('Regen: interrupt watchdog timeout');
//
//        return;

      case 0:
        if(this.triggerLowTime) {
          logger.warn('Regen: this.triggerLowTime set on down edge');
        }

        this.triggerLowTime = now;

        return;

      case 1:
        if(!this.triggerLowTime) {
          logger.warn('Regen: this.triggerLowTime missing on up edge');
          this.triggerLowTime = now;
        }

        triggerDuration = now - this.triggerLowTime;
        this.triggerLowTime = null;

        break;

      default:
        logger.error(`Regen: unhandled triggerLevel ${triggerLevel}`);

        return;
    }

    const diffSinceLast = now - this.triggerLastTime; // milliseconds

    this.triggerLastTime = now;

    if(diffSinceLast < ms('1 minute')) {
      // Phantominterrupt (> 1/min)
      logger.debug(`Regen: suppressing phantom interrupt for diffSinceLast=${diffSinceLast}ms`);

      return;
    }
    if(triggerDuration < 50) {
      // Phantominterrupt (> 1/min)
      logger.debug(`Regen: Suppressing phantom interrupt for triggerDuration=${triggerDuration}ms`);

      return;
    }

    this.level += 1; // 0.44;

    logger.warn(`Regen: diff=${diffSinceLast}ms duration=${triggerDuration}ms level=${this.level}`);

    status.update({rainLevel: this.level});
    await status.write();

    await this.sendLevel();
  }
}
