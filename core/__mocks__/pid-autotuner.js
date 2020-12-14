"use strict";


class AutoTuner {
  
  constructor(config) {
    
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
  }

  run(inputValue) {
    return true;
    
  }

  _currentTimeMs() {
    return Date.now();
  }

  _initTuner(timestamp) {
  }
}

module.exports = AutoTuner;
