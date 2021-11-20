// Reads the data of an MCP3204 A-D converter

import mcpSpiAdc from 'mcp-spi-adc';

const channel = 0;
let   adc;

export default async function mcp3204() {
  return await new Promise(async(resolve, reject) => {
    if(!adc) {
      await new Promise((resolveInit, rejectInit) => {
        const newAdc = mcpSpiAdc.openMcp3204(channel, errOpen => {
          if(errOpen) {
            return rejectInit(errOpen);
          }

          adc = newAdc;

          resolveInit();
        });
      });
    }

    adc.read((errRead, value) => {
      if(errRead) {
        return reject(errRead);
      }

      resolve(value);
    });
  });
}
