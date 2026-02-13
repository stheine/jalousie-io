import ms from 'ms';

export default {
  ACTION_TIME_ALARM:        ms('5 seconds'),
  ACTION_TIME_FULL:         ms('3 seconds'),
  ACTION_TIME_SHADOW_DOWN:  ms('63 seconds'),
  ACTION_TIME_SHADOW_TURN:  ms('1.3 seconds'),
  ACTION_TIME_STOP:         ms('140 ms'),

  GPIO_BUTTON_DOWN:         22, // GPIO22, Pin15 - Input - Button down
  GPIO_BUTTON_UP:           27, // GPIO27, Pin13 - Input - Button up

  GPIO_JALOUSIE_DOWN:        4, // GPIO4,  Pin7  - Output - Jalousie down
  GPIO_JALOUSIE_UP:         17, // GPIO17, Pin11 - Output - Jalousie up

  GPIO_RAIN:                 7, // GPIO7,  Pin26 - Rain

  GPIO_WIND:                25, // GPIO25, Pin22 - Windmelder

  WIND_RESET_DELAY_MINUTES: 30,

  WIND_UP_THRESHOLD:        6,
};
