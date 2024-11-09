import check      from 'check-types-2';
import dayjs      from 'dayjs';
import {logger}   from '@stheine/helpers';
import ms         from 'ms';
import pigpio     from 'pigpio';
import Ringbuffer from '@stheine/ringbufferjs';

import config     from './config.js';

const {Gpio} = pigpio;

const RINGBUFFER_LENGTH = 50;

// The Wind sensor is connected to the Raspi GPIO_WIND
// and is triggering an interrupt/ callback function to count
// the number of events, calculating the rate per second.

export default class Wind {
  constructor({mqttClient}) {
    check.assert.object(mqttClient, 'mqttClient missing');

    this.lastLevel   = null;
    this.lastTrigger = null;
    this.level       = null;
    this.mqttClient  = mqttClient;
    this.ringbuffer  = new Ringbuffer(RINGBUFFER_LENGTH);
    this.timerWind   = null;
    this.windAlarm   = false;

    this.triggerWind = this.triggerWind.bind(this);

    this.gpioWind = new Gpio(config.GPIO_WIND, {
      mode:       Gpio.INPUT,
      pullUpDown: Gpio.PUD_UP,
      alert:      true,              // alert on any level change
//      edge:       Gpio.FALLING_EDGE, // interrupt on falling edge
//      timeout:    xxx milliseconds  // interrupt only
    });
    this.gpioWind.glitchFilter(10); // for alert only
    this.gpioWind.on('alert', this.triggerWind);

    setInterval(() => {
      this.sendLevel();
    }, ms('15 seconds'));
  }

  cleanRingbuffer() {
    // Remove outdated values from the ringbuffer, all dates older then 2 seconds.
    const now = new Date();

    while(this.ringbuffer.size() && (now - this.ringbuffer.peek()) > 2000) {
      // logger.debug('Removing outdated value from wind ringbuffer');
      this.ringbuffer.deq();
    }
  }

  async sendLevel() {
    const now = new Date();

    if(this.level === null) {
      return;
    }

    this.cleanRingbuffer();

    if(!this.ringbuffer.size()) {
      this.level = 0;
    }

    if(this.lastLevel !== this.level) {
      logger.debug(`Wind level: ${this.level}`);
      this.lastLevel = this.level;
    }

    if(this.windAlarm &&
      (now - this.timerWind) / 1000 / 60 >= config.WIND_RESET_DELAY_MINUTES
    ) {
      logger.info(`windThreshold(${this.level}) < WIND_UP_THRESHOLD(${config.WIND_UP_THRESHOLD})`);
      logger.info(`timerWind >= WIND_RESET_DELAY_MINUTES(${config.WIND_RESET_DELAY_MINUTES})`);
      this.timerWind = null;
      this.windAlarm = false;

      logger.warn('Wind ALARM stop');
    }

    const result = {
      alarm:      this.windAlarm,
      alarmTimer: this.timerWind,
      level:      this.level,
      timestamp:  dayjs(),
    };

    // logger.debug('Wind/tele/SENSOR', level);

    await this.mqttClient.publishAsync('Wind/tele/SENSOR', JSON.stringify(result), {retain: true});
  }

  async triggerWind(triggerLevel /* , tick */) {
    // logger.debug(`triggerWind alert raw(${triggerLevel}, ${tick})`);

    if(triggerLevel) {
      // Ignore rising, count only falling edge.
      return;
    }

    const now = new Date();

    if(!this.lastTrigger) {
      this.lastTrigger = now;

      return;
    }

    const msSinceLast = now - this.lastTrigger;

    this.lastTrigger  = now;

    if(msSinceLast < 10) {
      // Phantom interrupt (> 100Hz)
      logger.debug('Suppressing wind phantom interrupt', msSinceLast);

      return;
    }

    this.ringbuffer.enq(now);

    // logger.debug(`triggerWind()`, {msSinceLast});

    this.cleanRingbuffer();

    if(msSinceLast > 1000) {
      // Stop further calculation
      return;
    }

// TODO    // Versuche Ausreisser (wilde Interrupts) zu erkennen, indem ich den neuen
//    // Wert mit der Summe der letzten Werte vergleiche.
//    // Ist er > 10 (damit nicht alle Werte ausgeschlossen werden, da die
//    // initiale Summe 0 ist) und höher, als die Summe der letzten Werte,
//    // so nehme ich an, das es ein Ausreisser ist.
//    let summeWindCounterVals;
//
//    if(!this.ringbuffer.size()) {
//      logger.info('RingBuffer leer, keine Prüfung auf Ausreisser.');
//    } else {
//      summeWindCounterVals = this.ringbufferCounter.sum();
//
//      if(windCounterCurrent > 10 &&
//         windCounterCurrent > (summeWindCounterVals * 2)
//      ) {
//        // Ausreisser
//        logger.info(`WindCounter Ausreisser ${windCounterCurrent} ` +
//          `(summeWindCounterVals*2=${summeWindCounterVals * 2}, ` +
//          `size=${this.ringbufferCounter.size()})\n` +
//          `ringbufferCounter = ` +
//          `${JSON.stringify(this.ringbufferCounter.dump(), null, '  ')}`);
//
//        return;
//      }
//    }

    // Kein Ausreisser, also im RingBuffer speichern.

    if(this.ringbuffer.size() === 1) {
      return;
    }

    const msSinceTop  = now - this.ringbuffer.peek();
    const secSinceTop = msSinceTop / 1000;
    const windHertz   = Math.round(this.ringbuffer.size() / secSinceTop * 10) / 10;

    if(windHertz <= 2.00) {
      this.level = 0;
    } else if(windHertz <= 5.78) {
      this.level = 1;
    } else if(windHertz <= 9.56) {
      this.level = 2;
    } else if(windHertz <= 13.34) {
      this.level = 3;
    } else if(windHertz <= 17.12) {
      this.level = 4;
    } else if(windHertz <= 20.90) {
      this.level = 5;
    } else if(windHertz <= 24.68) {
      this.level = 6;
    } else if(windHertz <= 28.46) {
      this.level = 7;
    } else if(windHertz <= 32.24) {
      this.level = 8;
    } else if(windHertz <= 36.02) {
      this.level = 9;
    } else if(windHertz <= 39.80) {
      this.level = 10;
    } else {
      this.level = 11;
    }

//    if(this.ringbuffer.size() > 4 && this.level > 1) {
//      logger.debug(`triggerWind()\n` +
//        `  level=${this.level}\n` +
//        `  size=${this.ringbuffer.size()}\n` +
//        `  secSinceTop=${secSinceTop}\n` +
//        `  windHertz=${windHertz}`);
//    }

    if(this.level >= config.WIND_UP_THRESHOLD && this.ringbuffer.size() > 3) {
      logger.info(`triggerWind() - windAlarm, start timerWind\n` +
        `  level = ${this.level} >= WIND_UP_THRESHOLD(${config.WIND_UP_THRESHOLD})` +
        `  size = ${this.ringbuffer.size()}\n` +
        `  secSinceTop = ${secSinceTop}\n` +
        `  windHertz = ${windHertz}`);
//        `\n` +
//        `  ringbuffer = ${JSON.stringify(_.compact(this.ringbuffer.dump()), null, '  ')}`);

      this.timerWind = new Date();
      this.windAlarm = true;
    }

    if(this.level > 1) {
      await this.sendLevel();
    }
  }
}
