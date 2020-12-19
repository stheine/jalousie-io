'use strict';

const check       = require('check-types-2');
const isEqual     = require('lodash/isEqual');
const millisecond = require('millisecond');
const pigpioDht   = require('pigpio-dht');

const config      = require('./config');
const logger      = require('./logger');

class Dht22 {
  constructor({mqttClient}) {
    check.assert.object(mqttClient, 'mqttClient missing');

    this.dht22Failures = 0;
    this.lastResult    = null;
    this.mqttClient    = mqttClient;

    this.getData = this.getData.bind(this);

    setInterval(() => {
      this.getData();
    }, millisecond('30 seconds'));

    this.getData();
  }

  async getData() {
    try {
      const result = await new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          reject(new Error('Timeout'));
        }, millisecond('3 seconds'));

        const sensor = pigpioDht(config.DHT_PIN, config.DHT_TYPE);

        sensor.on('result', raw => {
          if(timeout) {
            clearTimeout(timeout);
            timeout = null;
          }

          resolve({
            ...raw,
            humidity:    Math.round(raw.humidity * 10) / 10,
            temperature: Math.round(raw.temperature * 10) / 10,
          });
        });

        sensor.on('badChecksum', () => {
          if(timeout) {
            clearTimeout(timeout);
            timeout = null;
          }

          reject(new Error('badChecksum'));
        });

        sensor.read();
      });

      this.dht22Failures = 0;

//      if(!isEqual(this.lastResult, result)) {
      if(!this.lastResult ||
        Math.abs(this.lastResult.humidity    - result.humidity) >= 1 ||
        Math.abs(this.lastResult.temperature - result.temperature) >= 1
      ) {
        logger.debug('Wohnzimmer', result);
        this.lastResult = result;
      }

      this.mqttClient.publish('Wohnzimmer/tele/SENSOR', JSON.stringify(result), {retain: true});
    } catch(err) {
      this.dht22Failures++;

      if(this.dht22Failures > 5) {
        logger.info(`Failed to get data from DHT22. Error=${err.message}`);
      }
    }
  }
}

module.exports = Dht22;
