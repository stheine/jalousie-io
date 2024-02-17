import check  from 'check-types-2';
import ms     from 'ms';
import pigpio from 'pigpio';

import config from './config.js';
import logger from './logger.js';

const {Gpio} = pigpio;

export default class Buttons {
  constructor({action}) {
    check.assert.object(action, 'action missing');

    this.action     = action;

    // initialize GPIO for Jalousie buttons
    // input, pull-up
    this.gpioDown = new Gpio(config.GPIO_BUTTON_DOWN, {
      mode:       Gpio.INPUT,
      pullUpDown: Gpio.PUD_UP,
      alert:      true,
//      edge:       Gpio.EITHER_EDGE, // interrupt on either edge
//      timeout:    xxx milliseconds  // interrupt only
    });
    this.gpioDown.glitchFilter(10);

    this.gpioUp = new Gpio(config.GPIO_BUTTON_UP, {
      mode:       Gpio.INPUT,
      pullUpDown: Gpio.PUD_UP,
      alert:      true,
//      edge:       Gpio.EITHER_EDGE, // interrupt on either edge
//      timeout:    xxx milliseconds  // interrupt only
    });
    this.gpioUp.glitchFilter(10);

    // and attach trigger() to the alert
    this.gpioDown.on('alert', level => this.trigger({gpio: config.GPIO_BUTTON_DOWN, level}));
    this.gpioUp.on('alert',   level => this.trigger({gpio: config.GPIO_BUTTON_UP, level}));

    this.alertButtonLastDate    = null;
    this.alertButtonTriggerDate = null;

    this.stateTasterDown = 1;
    this.stateTasterUp   = 1;

    setInterval(() => {
      this.checkStates();
    }, ms('0.5 seconds'));
  }

  checkStates() {
    const readLevelDown = this.gpioDown.digitalRead();
    const readLevelUp   = this.gpioUp.digitalRead();

    if(this.stateTasterDown !== readLevelDown) {
      logger.warn(`Fix button Down state`, {readLevelDown, stateTasterDown: this.stateTasterDown});

      this.trigger({gpio: config.GPIO_BUTTON_DOWN, level: readLevelDown});
    }
    if(this.stateTasterUp   !== readLevelUp) {
      logger.warn(`Fix button Up state`, {readLevelUp, stateTasterUp: this.stateTasterUp});

      this.trigger({gpio: config.GPIO_BUTTON_UP, level: readLevelUp});
    }
  }

  // *************************************************************************
  // trigger() - alert handler for Jalousie Inputs
  async trigger({gpio, level}) {
    check.assert.assigned(gpio, 'gpio missing');
    check.assert.assigned(level, 'level missing');

//    logger.debug(`trigger(${gpio} ${level})`);

    const now = new Date();

    const sinceLast    = now - this.alertButtonLastDate;
    const sinceTrigger = now - this.alertButtonTriggerDate;

    this.alertButtonLastDate = now;

    // logger.debug(`button ${command} sinceLast=${sinceLast}`);

    // Debounce buttons causing alerts within a short time period.
    if(sinceLast < 100) { // 0.1 second
      // within debounceTime limit
      return;
    }

    // Did they press the Stop button?
    // This causes a 140ms OFF pulse, no matter how long it's pressed,
    // so I can determine this on release.
    if(level && sinceTrigger > 135 && sinceTrigger < 150) {
      // Stop
      logger.info(`Button JALOUSIE_STOP, ${sinceTrigger}`);
    }

    let command;

    switch(gpio) {
      case config.GPIO_BUTTON_UP:
        command = 'JALOUSIE_UP_';
        break;

      case config.GPIO_BUTTON_DOWN:
        command = 'JALOUSIE_DOWN_';
        break;

      default:
        logger.error(`Unhandled alert trigger gpio=${gpio}`);

        return;
    }

    command += level ? 'OFF' : 'ON';

    // Phantom alert, triggering the current value.
    if(gpio === config.GPIO_BUTTON_UP) {
      if(this.stateTasterUp === level) {
        logger.info(`phantom (${command}) ${sinceLast}`);

        return;
      }

      this.stateTasterUp = level;
    } else if(gpio === config.GPIO_BUTTON_DOWN) {
      if(this.stateTasterDown === level) {
        logger.info(`phantom (${command}) ${sinceLast}`);

        return;
      }

      this.stateTasterDown = level;
    }

    // Now I can pass on and handle the trigger.
    logger.info(`Button ${command} sinceLast=${sinceLast}`);

    await this.action.start(command);

    this.alertButtonTriggerDate = now;
  }
}
