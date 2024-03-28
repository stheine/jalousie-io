import check      from 'check-types-2';
import dayjs      from 'dayjs';
import {logger}   from '@stheine/helpers';
import ms         from 'ms';
import Ringbuffer from '@stheine/ringbufferjs';

import mcp3204    from './mcp3204.js';

const RINGBUFFER_LENGTH = 5;

// The sensor is connected to the MCP3204 A-D converter,
// connected to the Raspi on the SPI channel, opened in spiChannel,
// and on the MCP channel mcpChannel.

export default class Sonne {
  constructor({mqttClient}) {
    check.assert.object(mqttClient, 'mqttClient missing');

    this.lastLevel  = null;
    this.mqttClient = mqttClient;
    this.ringbuffer = new Ringbuffer(RINGBUFFER_LENGTH);

    this.getLevel = this.getLevel.bind(this);

    setInterval(() => {
      this.getLevel();
    }, ms('15 seconds'));

    this.getLevel();
  }

  async getLevel() {
    const a2dValueRaw = await mcp3204();
    const a2dValue    = a2dValueRaw.rawValue;
    const now         = new Date();

    // logger.debug(`Sonne a2dValue=${a2dValue}`, a2dValueRaw);

    this.ringbuffer.enq({a2dValue, timestamp: now});

    // Remove outdated values from the ringbuffer.
    while(
      this.ringbuffer.size() &&
      (now - this.ringbuffer.peek().timestamp) > (RINGBUFFER_LENGTH + 15) * 1000
    ) {
      // logger.debug('Removing outdated value from ringbuffer');
      this.ringbuffer.deq();
    }

    // if(this.ringbuffer.size() < RINGBUFFER_LENGTH) {
    //   logger.debug(`RINGBUFFER size=${this.ringbuffer.size()}`);
    // }

    const a2dValues = this.ringbuffer.dump().map(entry => entry.a2dValue);
    const averageA2dValue = a2dValues.reduce((prev, curr) => prev + curr) / this.ringbuffer.size();
    let   level;

    // logger.debug(`${a2dValues} => avg()=${averageA2dValue}`);

    /* eslint-disable max-len */
    // http://www.statistikpaket.de/x-y-plot/x-y-plot.php?a[]=0&b[]=3990&a[]=1&b[]=3675&a[]=2&b[]=3530&a[]=3&b[]=3250&a[]=4&b[]=2750&a[]=5&b[]=2500&a[]=6&b[]=2100&a[]=7&b[]=1800&a[]=8&b[]=1500&a[]=9&b[]=1100&a[]=10&b[]=700&a[]=11&b[]=350&a[]=12&b[]=200&a[]=13&b[]=150&a[]=14&b[]=100&a[]=15&b[]=50
    /* eslint-enable max-len */
    if(averageA2dValue > 3990) {
      level = 0;
    } else if(averageA2dValue > 3675) {
      level = 1;
    } else if(averageA2dValue > 3530) {
      level = 2;
    } else if(averageA2dValue > 3250) {
      level = 3;
    } else if(averageA2dValue > 2750) {
      level = 4;
    } else if(averageA2dValue > 2500) {
      level = 5;
    } else if(averageA2dValue > 2100) {
      level = 6;
    } else if(averageA2dValue > 1800) {
      level = 7;
    } else if(averageA2dValue > 1500) {
      level = 8;
    } else if(averageA2dValue > 1100) {
      level = 9;
    } else if(averageA2dValue >  700) {
      level = 10;
    } else if(averageA2dValue >  350) {
      level = 11;
    } else if(averageA2dValue >  200) {
      level = 12;
    } else if(averageA2dValue >  150) {
      level = 13;
    } else if(averageA2dValue >  100) {
      level = 14;
    } else if(averageA2dValue >  50) {
      level = 15;
    } else if(averageA2dValue > 0) {
      level = 20;
    } else {
      // Don't set an error code (like 999),
      // as otherwise this would trigger the level always.
      level = 0;
    }

    // logger.debug(`Sonne: size=${this.ringbuffer.size()} averageA2dValue=${averageA2dValue} level=${level}`);

    if(this.lastLevel !== level) {
      logger.debug(`Sonne level: ${level}`);
      this.lastLevel = level;
    }

    const result = {
      level,
      timestamp: dayjs(),
    };

    // logger.debug('Sonne/tele/SENSOR', level);

    this.mqttClient.publish('Sonne/tele/SENSOR', JSON.stringify(result), {retain: true});
  }
}
