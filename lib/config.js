'use strict';

const millisecond = require('millisecond');

module.exports = {
  ACTION_TIME_ALARM:        millisecond('5 seconds'),
  ACTION_TIME_FULL:         millisecond('3 seconds'),
  ACTION_TIME_SHADOW_DOWN:  millisecond('63 seconds'),
  ACTION_TIME_SHADOW_TURN:  millisecond('1.3 seconds'),
  ACTION_TIME_STOP:         millisecond('140 ms'),

  DHT_PIN:                  18,
  DHT_TYPE:                 22,

  GPIO_BUTTON_DOWN:         22, // GPIO22, Pin15 - Input - Button down
  GPIO_BUTTON_UP:           27, // GPIO27, Pin13 - Input - Button up

  GPIO_JALOUSIE_DOWN:        4, // GPIO4,  Pin7  - Output - Jalousie down
  GPIO_JALOUSIE_UP:         17, // GPIO17, Pin11 - Output - Jalousie up

  GPIO_RAIN:                 7, // GPIO7,  Pin26 - Rain

  GPIO_WIND:                25, // GPIO25, Pin22 - Windmelder

  LATITUDE:                 48.6207,
  LONGITUDE:                8.8988,

  NIGHT_UP:                 '08:30',

  NIGHT_WINDCHECK_END:      '23:00',
  NIGHT_WINDCHECK_START:    '22:45',
  NIGHT_WINDCHECK_LIMIT:    14,

  OPENWEATHER_LOCATION_APPID:  '5999e1fe8e38f12312140f827ff126fd',
  OPENWEATHER_LOCATION_CITYID: 6555401,
  OPENWEATHER_LOCATION_CITY:   'Nufringen',

  SUN_DOWN_TEMP_DEGREE:     23.5,
  SUN_DOWN_TEMP_THRESHOLD:  8,

  SUN_DOWN_DELAY_MINUTES:   15,
  SUN_DOWN_THRESHOLD:       13,

  SUN_UP_DELAY_MINUTES:     25,
  SUN_UP_THRESHOLD:         6,

  WEBSERVER_PORT:           9124,

  WIND_RESET_DELAY_MINUTES: 30,

  WIND_UP_THRESHOLD:        6,
};
