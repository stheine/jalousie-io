import fs      from 'fs';

import _       from 'lodash';
import fsExtra from 'fs-extra';

import logger  from './logger.js';

let status = {};

export default {
  dump() {
    return status;
  },

  update(changes) {
    status = _.merge(status, changes);
  },

  async write() {
    try {
      await fsExtra.writeJson('/var/jalousie/status-io.json.tmp', status, {spaces: 2});
      await fsExtra.move('/var/jalousie/status-io.json.tmp', '/var/jalousie/status-io.json', {overwrite: true});
    } catch(err) {
      logger.error('Failed to write status-io', err.message);
    }
  },

  async read() {
    try {
      await fsExtra.access('/var/jalousie/status-io.json', fs.constants.R_OK);
      const oldStatus = await fsExtra.readJson('/var/jalousie/status-io.json');

      return oldStatus;
    } catch(err) {
      logger.error('Failed to read status-io', err.message);

      // ignore
      return {};
    }
  },
};
