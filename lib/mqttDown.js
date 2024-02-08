#!/usr/bin/env node

import os   from 'node:os';

import mqtt from 'async-mqtt';

const hostname = os.hostname();

(async() => {
  const mqttClient = await mqtt.connectAsync('tcp://192.168.6.5:1883', {clientId: hostname});

  await mqttClient.publish('Jalousie/cmnd/full_down', JSON.stringify({}));

  await mqttClient.end();
})();
