"use strict";


class AutoTuner {
  
  constructor(config) {
    this._logFn = config.logFn;
  }

  get state() {
    return '';
  }

  get output() { 
    return 100;
  }

  get tuningRules() {
    return [];
  }

  getPIDParameters(tuningRule = "ziegler-nichols") {
    return { Kp: 50, Ki: 1, Kd: 200 };
  }

  log(text) {
    this._logFn(text);
  }

  run(inputValue) {
    this.log(`inputValue ${inputValue}`);
    return true;
  }

  _currentTimeMs() {
    return Date.now();
  }

  _initTuner(timestamp) {
  }
}

module.exports = AutoTuner;
