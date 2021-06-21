/* eslint-disable max-classes-per-file */

'use strict';

const check      = require('check-types-2');
const dayjs      = require('dayjs');
const delay      = require('delay');
const Gpio       = require('pigpio').Gpio;
// TODO const nodemailer = require('nodemailer');

const config     = require('./config');
const logger     = require('./logger');

const JALOUSIE_ON    = 1;
const JALOUSIE_OFF   = 0;

// *************************************************************************
const STATE_RUNNING  = 0;
const STATE_FINISHED = 1;
const STATE_ABORT    = 1;



let lastActionId = 0;

const logFct = function(message) {
  return () => {
    logger.info(message);
  };
};

class Executor {
  constructor(params) {
    check.assert.object(params);
    check.assert.object(params.gpioJalousieDown);
    check.assert.object(params.gpioJalousieUp);

    this.actionId         = null;
    this.gpioJalousieDown = params.gpioJalousieDown;
    this.gpioJalousieUp   = params.gpioJalousieUp;
    this.start            = null;
    this.state            = null;
  }

  gpioWriteFct(gpio, level) {
    let writeGpio;

    switch(gpio) {
      case config.GPIO_JALOUSIE_DOWN: writeGpio = this.gpioJalousieDown; break;
      case config.GPIO_JALOUSIE_UP:   writeGpio = this.gpioJalousieUp; break;

      default: throw new Error(`Unhandled gpio ${gpio}`);
    }

    return () => {
      writeGpio.digitalWrite(level);
    };
  }

  abort() {
    if(this.state === STATE_RUNNING) {
      // Stopping any output that might be active currently
      this.gpioWriteFct(config.GPIO_JALOUSIE_UP,   JALOUSIE_OFF)();
      this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF)();

      logger.debug(`actionId=${this.actionId} Flagging abort (` +
        `task=${this.task}, start=${this.start.format('HH:mm:ss')})`);

      this.state = STATE_ABORT;
    }
  }

  delayFct(milliseconds) {
    return async() => {
      await delay(milliseconds);

      if(this.state === STATE_ABORT) {
        logger.debug(`actionId=${this.actionId} Cancelling (` +
          `task=${this.task}, ` +
          `start=${this.start.format('HH:mm:ss')})`);

        throw new Error('abort');
      }
    };
  }

  async run(task) {
    check.assert.string(task);

    this.task     = task;
    this.actionId = lastActionId;
    lastActionId++;
    this.start    = dayjs();
    this.state    = STATE_RUNNING;

//    logger.debug(`actionId=${this.actionId} Starting (` +
//      `task=${this.task}, start=${this.start.format('HH:mm:ss')})`);

    let steps;

    logger.debug(`Executor.run(${task})`);

    switch(task) {
      case 'JALOUSIE_OFF':
        steps = [
          logFct('Off: ' +
            'JALOUSIE_UP, OFF, JALOUSIE_DOWN, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_OFF),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_STOP':
        // It's ok to signal stop in either direction.
        steps = [
          logFct('Stop: JALOUSIE_UP, ON, 140ms, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_STOP),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_FULL_UP':
        steps = [
          logFct('Full up: JALOUSIE_UP, ON, 3sec, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_FULL),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_FULL_DOWN':
        steps = [
          logFct('Full down: JALOUSIE_DOWN, ON, 3sec, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_FULL),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_UP_ON':
        steps = [
          logFct('Up on, JALOUSIE_UP, ON'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_ON),
        ];
        break;

      case 'JALOUSIE_UP_OFF':
        steps = [
          logFct('Up off, JALOUSIE_UP, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_DOWN_ON':
        steps = [
          logFct('Down on, JALOUSIE_DOWN, ON'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
        ];
        break;

      case 'JALOUSIE_DOWN_OFF':
        steps = [
          logFct('Down off, JALOUSIE_DOWN, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_SHADOW':
        steps = [
          logFct('Shadow-1, down: JALOUSIE_DOWN, ON, 3sec, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_FULL),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
          this.delayFct(config.ACTION_TIME_SHADOW_DOWN),

          logFct(`Shadow-2, turn: JALOUSIE_UP, ON, 1300ms, OFF`),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_SHADOW_TURN),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_OFF),

          logFct('Shadow-3, stop: JALOUSIE_DOWN, ON, 140ms, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_STOP),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_TURN':
        steps = [
          logFct('Turn-1, down: JALOUSIE_DOWN, ON, 2*1300ms, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
          this.delayFct(2 * config.ACTION_TIME_SHADOW_TURN),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),

          logFct(`Turn-2, turn: JALOUSIE_UP, ON, 1300ms, OFF`),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_SHADOW_TURN),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_OFF),

          logFct('Turn-3, stop: JALOUSIE_DOWN, ON, 140ms, OFF'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_STOP),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_INDIVIDUAL':
        // Moves the jalousies, set to automatic mode, to their
        // individual shadow state, by immitating the double-click.
        steps = [
          logFct('Individual'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
          this.delayFct(200),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
          this.delayFct(200),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
          this.delayFct(200),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_ALL_DOWN':
        // Moves all jalousies down, by using the alarm function.
        // But this makes them move into the closed position.
        // There is no way to move the manual mode jalousies into
        // the shadown position.
        steps = [
          logFct('All down'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_ALARM),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
        ];
        break;

      case 'JALOUSIE_ALL_UP':
        // Moves all jalousies up, by using the alarm function.
        steps = [
          logFct('All up'),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_ON),
          this.delayFct(config.ACTION_TIME_ALARM),
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_OFF),
        ];
        break;

      default:
        logger.error(`Unhandled task=${task}`);
        break;
    }

    if(steps) {
      // Stop all outputs to start with a defined state,
      // even if a task was cancelled in between.
      try {
        for(const step of [
          this.gpioWriteFct(config.GPIO_JALOUSIE_UP, JALOUSIE_OFF),
          this.gpioWriteFct(config.GPIO_JALOUSIE_DOWN, JALOUSIE_OFF),
        ].concat(steps)) {
          await step();
        }

        this.state = STATE_FINISHED;

//          logger.debug(`actionId=${this.actionId} Finished (` +
//            `task=${this.task}, ` +
//            `start=${this.start.format('HH:mm:ss')})`);
      } catch(err) {
        this.state = STATE_FINISHED;

        if(err) {
          logger.debug(`actionId=${this.actionId} Aborting (` +
            `task=${this.task}, ` +
            `start=${this.start.format('HH:mm:ss')})`);

          throw err;
        }
      }
    } else {
      throw new Error('no steps');
    }
  }
}

class Action {
  constructor({mqttClient}) {
    check.assert.object(mqttClient, 'mqttClient missing');

    this.actionThread = undefined;
    this.mqttClient   = mqttClient;
    this.windAlarm    = false;

    try {
      this.gpioJalousieUp   = new Gpio(config.GPIO_JALOUSIE_UP,   {mode: Gpio.OUTPUT});
      this.gpioJalousieDown = new Gpio(config.GPIO_JALOUSIE_DOWN, {mode: Gpio.OUTPUT});
    } catch(err) {
      if(err.message === 'pigpio error -1 in gpioInitialise') {
        (async() => {
          logger.error('pigpio startup failed. Need to docker rm & docker up.');

// TODO            const transport = nodemailer.createTransport({host: 'postfix', port: 25});

// TODO            transport.sendMail({
// TODO              to:      'stefan@heine7.de',
// TODO              subject: 'Jalousie-io startup failed',
// TODO              html:    `
// TODO                <p>Jalousie-io startup failed.</p>
// TODO                <p>Probably need to docker rm & docker up.</p>
// TODO                <p><pre>${JSON.stringify(err)}</pre></p>
// TODO              `,
// TODO            });

          throw new Error('pigpio startup failed. Need to docker rm & docker up.');
        })();
      } else {
        throw err;
      }
    }

    this.mqttClient.on('message', async(topic, messageBuffer) => {
      const messageRaw = messageBuffer.toString();

      try {
        let message;

        try {
          message = JSON.parse(messageRaw);
        } catch(err) {
          // ignore
        }

        switch(topic) {
          case 'Jalousie/cmnd/down_off':
            logger.info('Jalousie/cmnd/down_off');
            await this.start('JALOUSIE_DOWN_OFF');
            break;

          case 'Jalousie/cmnd/down_on':
            logger.info('Jalousie/cmnd/down_on');
            await this.start('JALOUSIE_DOWN_ON');
            break;

          case 'Jalousie/cmnd/up_off':
            logger.info('Jalousie/cmnd/up_off');
            await this.start('JALOUSIE_UP_OFF');
            break;

          case 'Jalousie/cmnd/up_on':
            logger.info('Jalousie/cmnd/up_on');
            await this.start('JALOUSIE_UP_ON');
            break;

          case 'Jalousie/cmnd/all_down':
            logger.info('Jalousie/cmnd/all_down');
            await this.start('JALOUSIE_ALL_DOWN');
            break;

          case 'Jalousie/cmnd/all_up':
            logger.info('Jalousie/cmnd/all_up');
            await this.start('JALOUSIE_ALL_UP');
            break;

          case 'Jalousie/cmnd/full_down':
            logger.info('Jalousie/cmnd/full_down');
            await this.start('JALOUSIE_FULL_DOWN');
            break;

          case 'Jalousie/cmnd/full_up':
            logger.info('Jalousie/cmnd/full_up');
            await this.start('JALOUSIE_FULL_UP');
            break;

          case 'Jalousie/cmnd/individual':
            logger.info('Jalousie/cmnd/individual');
            await this.start('JALOUSIE_INDIVIDUAL');
            break;

          case 'Jalousie/cmnd/off':
            logger.info('Jalousie/cmnd/off');
            await this.start('JALOUSIE_OFF');
            break;

          case 'Jalousie/cmnd/shadow':
            logger.info('Jalousie/cmnd/shadow');
            await this.start('JALOUSIE_SHADOW');
            break;

          case 'Jalousie/cmnd/stop':
            logger.info('Jalousie/cmnd/stop');
            await this.start('JALOUSIE_STOP');
            break;

          case 'Jalousie/cmnd/turn':
            logger.info('Jalousie/cmnd/turn');
            await this.start('JALOUSIE_TURN');
            break;

          case 'Wind/tele/SENSOR':
            if(message.alarm && !this.windAlarm) {
              logger.info('Jalousie/tele/SENSOR - alarm - Jalousie up_on', {message});

              this.windAlarm = message.alarm;

              // To alarm, signal up and leave the level there.
              await this.start('JALOUSIE_UP_ON');
            } else if(!message.alarm && this.windAlarm) {
              logger.info('Jalousie/tele/SENSOR - no more alarm - Jalousie off', {message});

              this.windAlarm = message.alarm;

              // To stop alarm, stop the up signal.
              await this.start('JALOUSIE_OFF');
            }
            break;

          case 'Jalousie/tele/SENSOR':
            // ignore
            break;

          default:
            logger.error(`Unhandled topic '${topic}'`, message);
            break;
        }
      } catch(err) {
        logger.error(`Failed to parse mqtt message for '${topic}': ${messageBuffer.toString()}`, err);
      }
    });

    this.mqttClient.subscribe('Jalousie/#');
    this.mqttClient.subscribe('Wind/#');
  }

  async start(task) {
    check.assert.string(task);

    if(this.windAlarm && task !== 'JALOUSIE_UP_ON') {
      logger.warn(`Action.start(), skip task ${task} for windAlarm`);

      return;
    }

    if(this.actionThread) {
      this.actionThread.abort();
      this.actionThread = undefined;
    }

    this.actionThread = new Executor(this);

    try {
      await this.actionThread.run(task);
    } catch(err) {
      logger.info('task aborted', err);
    }
  }
}

module.exports = Action;
