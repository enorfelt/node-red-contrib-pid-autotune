"use strict";

class deque {
  constructor(maxlen) {
    this._maxlen = maxlen;
  }
}

class AutoTuner {
//   static get PIDParams() {
//     return new namedtuple("PIDParams", ["Kp", "Ki", "Kd"]);
//   } // TODO

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
      "brewing": [2.5, 3, 3600],
    };
  }

  constructor(
    setpoint,
    outputstep = 10,
    sampleTimeSec = 5,
    lookbackSec = 60,
    outputMin = Number.MIN_VALUE,
    outputMax = Number.MAX_VALUE,
    noiseband = 0.5,
    getTimeMs = undefined
  ) {
    if (!setpoint) throw new Error("Kettle setpoint must be specified");
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
    this._setpoint = setpoint;
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

    if (getTimeMs && {}.toString.call(getTimeMs) === "[object Function]") {
      this._getTimeMs = getTimeMs;
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
    return {Kp: kp, Ki: ki, Kd: kd};
  }

  log(text) {
    //TODO
    // filename = "./logs/autotune.log"
    // formatted_time = strftime("%Y-%m-%d %H:%M:%S", localtime())
    // with open(filename, "a") as file:
    //     file.write("%s,%s\n" % (formatted_time, text))
  }

  run(inputValue) {
    const now = this._getTimeMs();

    if (
      this._state == AutoTuner.STATE_OFF ||
      this._state == AutoTuner.STATE_SUCCEEDED ||
      this._state == AutoTuner.STATE_FAILED
    )
      this._initTuner(now);
    else if (now - this._lastRunTimestamp < this._sampleTime) return False;

    this._lastRunTimestamp = now;

    // check input and change relay state if necessary
    if (
      this._state == AutoTuner.STATE_RELAY_STEP_UP &&
      inputValue > this._setpoint + this._noiseband
    ) {
      this._state = AutoTuner.STATE_RELAY_STEP_DOWN;
      this.log("switched state: {0}".format(this._state)); // TODO format
      this.log("input: {0}".format(inputValue)); // TODO Format
    } else if (
      this._state == AutoTuner.STATE_RELAY_STEP_DOWN &&
      inputValue < this._setpoint - this._noiseband
    ) {
      this._state = AutoTuner.STATE_RELAY_STEP_UP;
      this.log("switched state: {0}".format(this._state)); // TODO Format
      this.log("input: {0}".format(inputValue)); // TODO Format
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

    this._inputs.append(inputValue); //TODO Append

    // we don't want to trust the maxes or mins until the input array is full
    if (this._inputs.length < this._inputs.maxlen)
      //TODO
      return false;

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
      this._peaks.append(inputValue); // TODO Append
      this._peakTimestamps.append(now); // TODO APPEND
      this.log("found peak: {0}".format(inputValue)); // TODO Format
      this.log("peak count: {0}".format(this._peakCount)); // TODO Format
    }

    // check for convergence of induced oscillation
    // convergence of amplitude assessed on last 4 peaks (1.5 cycles)
    this._inducedAmplitude = 0;

    if (inflection && this._peakCount > 4) {
      var absMax = this._peaks[-2];
      var absMin = this._peaks[-2];
      for (var i in range(0, len(this._peaks) - 2)) {
        this._inducedAmplitude += Math.abs(this._peaks[i] - this._peaks[i + 1]);
        absMax = Math.max(this._peaks[i], absMax);
        absMin = Math.min(this._peaks[i], absMin);
      }

      this._inducedAmplitude /= 6.0;

      // check convergence criterion for amplitude of induced oscillation
      const amplitudeDev =
        (0.5 * (absMax - absMin) - this._inducedAmplitude) /
        this._inducedAmplitude;

      this.log("amplitude: {0}".format(this._inducedAmplitude)); // TODO Format
      this.log("amplitude deviation: {0}".format(amplitudeDev)); // TODO Format

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
      this._Ku = (4.0 * this._outputstep) / (this._inducedAmplitude * math.pi);

      // calculate ultimate period in seconds
      period1 = this._peakTimestamps[3] - this._peakTimestamps[1];
      period2 = this._peakTimestamps[4] - this._peakTimestamps[2];
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
