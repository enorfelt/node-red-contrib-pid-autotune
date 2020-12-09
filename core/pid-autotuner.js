"use strict";

const deque = require("./deque");

class AutoTuner {
  static get PEAK_AMPLITUDE_TOLERANCE() {
    return 0.05;
  }
  static get STATE_OFF() {
    return "off";
  }
  static get STATE_RELAY_STEP_UP() {
    return "relay step up";
  }
  static get STATE_RELAY_STEP_DOWN() {
    return "relay step down";
  }
  static get STATE_SUCCEEDED() {
    return "succeeded";
  }
  static get STATE_FAILED() {
    return "failed";
  }

  static get _tuning_rules() {
    //rule: [Kp_divisor, Ki_divisor, Kd_divisor]
    return {
      "ziegler-nichols": [34, 40, 160],
      "tyreus-luyben": [44, 9, 126],
      "ciancone-marlin": [66, 88, 162],
      "pessen-integral": [28, 50, 133],
      "some-overshoot": [60, 40, 60],
      "no-overshoot": [100, 40, 60],
      brewing: [2.5, 6, 380],
    };
  }
  /*
{
    setpoint,
    outputstep = 10,
    sampleTimeSec = 5,
    lookbackSec = 60,
    outputMin = Number.MIN_VALUE,
    outputMax = Number.MAX_VALUE,
    noiseband = 0.5,
    getTimeMs = undefined,
    logFn = undefined
    }
*/
  constructor(config) {
    var lookbackSec = config.lookbackSec || 60;
    var sampleTimeSec = config.sampleTimeSec || 5;
    var outputstep = config.outputstep || 10;
    var outputMin = config.outputMin || Number.MIN_VALUE;
    var outputMax = config.outputMax || Number.MAX_VALUE;
    var noiseband = config.noiseband || 0.5;

    if (!config.setpoint) throw new Error("Kettle setpoint must be specified");
    if (outputstep < 1)
      throw new Error("Output step % must be greater or equal to 1");
    if (sampleTimeSec < 1)
      throw new Error("Sample Time Seconds must be greater or equal to 1");
    if (lookbackSec < sampleTimeSec)
      throw new Error(
        "Lookback Seconds must be greater or equal to Sample Time Seconds (5)"
      );
    if (outputMin >= outputMax)
      throw new Error("Min Output % must be less than Max Output %");

    this._inputs = new deque(Math.round(lookbackSec / sampleTimeSec));
    this._sampleTime = sampleTimeSec * 1000;
    this._setpoint = config.setpoint;
    this._outputstep = outputstep;
    this._noiseband = noiseband;
    this._outputMin = outputMin;
    this._outputMax = outputMax;

    this._state = AutoTuner.STATE_OFF;
    this._peakTimestamps = new deque(5);
    this._peaks = new deque(5);

    this._output = 0;
    this._lastRunTimestamp = 0;
    this._peakType = 0;
    this._peakCount = 0;
    this._initialOutput = 0;
    this._inducedAmplitude = 0;
    this._Ku = 0;
    this._Pu = 0;
    this._logFn = config.logFn || undefined;

    if (
      config.getTimeMs &&
      {}.toString.call(config.getTimeMs) === "[object Function]"
    ) {
      this._getTimeMs = config.getTimeMs;
    } else {
      this._getTimeMs = this._currentTimeMs;
    }
  }

  get state() {
    return this._state;
  }

  get output() {
    return this._output;
  }

  get tuningRules() {
    return Object.keys(AutoTuner._tuning_rules);
  }

  getPIDParameters(tuningRule = "ziegler-nichols") {
    const divisors = AutoTuner._tuning_rules[tuningRule];
    const kp = this._Ku / divisors[0];
    const ki = kp / (this._Pu / divisors[1]);
    const kd = kp * (this._Pu / divisors[2]);
    return { Kp: kp, Ki: ki, Kd: kd };
  }

  log(text) {
    var formattedDate = new Date(Date.now()).toISOString();
    var log = `${formattedDate} - ${text}`;
    if (this._logFn && {}.toString.call(this._logFn) === "[object Function]") {
      this._logFn(log);
    }
  }

  run(inputValue) {
    const now = this._getTimeMs();

    if (
      this._state == AutoTuner.STATE_OFF ||
      this._state == AutoTuner.STATE_SUCCEEDED ||
      this._state == AutoTuner.STATE_FAILED
    )
      this._initTuner(now);
    else if (now - this._lastRunTimestamp < this._sampleTime) return false;

    this._lastRunTimestamp = now;

    // check input and change relay state if necessary
    if (
      this._state == AutoTuner.STATE_RELAY_STEP_UP &&
      inputValue > this._setpoint + this._noiseband
    ) {
      this._state = AutoTuner.STATE_RELAY_STEP_DOWN;
      this.log(`switched state: ${this._state}`);
      this.log(`input: ${inputValue}`);
    } else if (
      this._state == AutoTuner.STATE_RELAY_STEP_DOWN &&
      inputValue < this._setpoint - this._noiseband
    ) {
      this._state = AutoTuner.STATE_RELAY_STEP_UP;
      this.log(`switched state: ${this._state}`);
      this.log(`input: ${inputValue}`);
    }

    // set output
    if (this._state === AutoTuner.STATE_RELAY_STEP_UP)
      this._output = this._initialOutput + this._outputstep;
    else if (this._state === AutoTuner.STATE_RELAY_STEP_DOWN)
      this._output = this._initialOutput - this._outputstep;

    // respect output limits
    this._output = Math.min(this._output, this._outputMax);
    this._output = Math.max(this._output, this._outputMin);

    // identify peaks
    var isMax = true;
    var isMin = true;

    this._inputs.forEach((val) => {
      isMax = isMax && inputValue > val;
      isMin = isMin && inputValue < val;
    });

    this._inputs.append(inputValue);

    // we don't want to trust the maxes or mins until the input array is full
    if (this._inputs.length < this._inputs.maxlen) return false;

    // increment peak count and record peak time for maxima and minima
    var inflection = false;

    // peak types:
    // -1: minimum
    // +1: maximum
    if (isMax) {
      if (this._peakType === -1) inflection = true;
      this._peakType = 1;
    } else if (isMin) {
      if (this._peakType === 1) inflection = true;
      this._peakType = -1;
    }

    // update peak times and values
    if (inflection) {
      this._peakCount += 1;
      this._peaks.append(inputValue);
      this._peakTimestamps.append(now);
      this.log(`found peak: ${inputValue}`);
      this.log(`peak count: ${this._peakCount}`);
    }

    // check for convergence of induced oscillation
    // convergence of amplitude assessed on last 4 peaks (1.5 cycles)
    this._inducedAmplitude = 0;

    if (inflection && this._peakCount > 4) {
      var absMax = this._peaks[this._peaks.length - 2];
      var absMin = this._peaks[this._peaks.length - 2];
      for (var i = 0; i < this._peaks.length - 2; i++) {
        // in range(0, len(this._peaks) - 2)) {
        this._inducedAmplitude += Math.abs(this._peaks[i] - this._peaks[i + 1]);
        absMax = Math.max(this._peaks[i], absMax);
        absMin = Math.min(this._peaks[i], absMin);
      }

      this._inducedAmplitude /= 6.0;

      // check convergence criterion for amplitude of induced oscillation
      const amplitudeDev =
        (0.5 * (absMax - absMin) - this._inducedAmplitude) /
        this._inducedAmplitude;

      this.log(`amplitude: ${this._inducedAmplitude}`);
      this.log(`amplitude deviation: ${amplitudeDev}`);

      if (amplitudeDev < AutoTuner.PEAK_AMPLITUDE_TOLERANCE)
        this._state = AutoTuner.STATE_SUCCEEDED;
    }

    // if the autotune has not already converged
    // terminate after 10 cycles
    if (this._peakCount >= 20) {
      this._output = 0;
      this._state = AutoTuner.STATE_FAILED;
      return true;
    }

    if (this._state === AutoTuner.STATE_SUCCEEDED) {
      this._output = 0;

      // calculate ultimate gain
      this._Ku = (4.0 * this._outputstep) / (this._inducedAmplitude * Math.PI);

      // calculate ultimate period in seconds
      const period1 = this._peakTimestamps[3] - this._peakTimestamps[1];
      const period2 = this._peakTimestamps[4] - this._peakTimestamps[2];
      this._Pu = (0.5 * (period1 + period2)) / 1000.0;
      return true;
    }

    return false;
  }

  _currentTimeMs() {
    return Date.now();
  }

  _initTuner(timestamp) {
    this._peakType = 0;
    this._peakCount = 0;
    this._output = 0;
    this._initialOutput = 0;
    this._Ku = 0;
    this._Pu = 0;
    this._inputs.clear();
    this._peaks.clear();
    this._peakTimestamps.clear();
    this._peakTimestamps.append(timestamp);
    this._state = AutoTuner.STATE_RELAY_STEP_UP;
  }
}

module.exports = AutoTuner;
