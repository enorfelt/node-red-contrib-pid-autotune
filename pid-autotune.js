module.exports = function (RED) {
  "use strict";

  const AutoTuner = require('./core/pid-autotuner');

  function sleep(sec) {
    return new Promise(resolve => setTimeout(resolve, sec * 1000));
  }

  async function PidAutotune(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    const sampleTime = 5;
    const waitTime = 5;
    const outstep = config.outstep || 100;
    const outmax = config.maxout || 100;
    const lookbackSec = config.lookback || 30;
    const setpoint = 65;

    function log(log) {
      node.send([null, null, log]);
    }

    function getSetpoint(msg) {
      return new Promise(function (resolve) {
        if (config.setpointType === "num") {
          resolve(config.setpoint);
        } else if (config.setpointType === "msg") {
          resolve(msg[config.setpoint]);
        } else {
          RED.util.evaluateNodeProperty(config.setpoint, config.setpointType, node, msg, (err, value) => {
            if (err) {
              resolve("");
            } else {
              resolve(value);
            }
          });
        }
      });
    }

    const atune = new AutoTuner({
      setpoint: setpoint,
      outputstep: outstep,
      sampleTimeSec: sampleTime,
      lookbackSec: lookbackSec,
      outputMin: 0,
      outputMax: outmax,
      logFn: log
    })

    node.on("input", async function (msg, send, done) {
      try {

        while (!atune.run(60)) {
          const heat_percent = atune.output;
          const heating_time = sampleTime * heat_percent / 100;
          const waitTime = sampleTime - heating_time;
          if (heating_time === sampleTime) {
            // TODO turn heater on
            await sleep(heating_time)
          } else if(waitTime === sampleTime) {
            // TODO turn heater off
            await sleep(waitTime)
          } else {
            // TODO turn heter on
            await sleep(heating_time);
            // TODO turn heater off
            await sleep(waitTime);
          }
        }
        
        if (done) done();
      } catch (error) {
        if (done) done(error.message || "Something went wrong!");
      }

    });
  }

  RED.nodes.registerType("pid-autotune", PidAutotune);
};
