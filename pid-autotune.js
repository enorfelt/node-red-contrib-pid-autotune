module.exports = function (RED) {
  "use strict";

  const AutoTuner = require('./core/pid-autotuner');

  function PidAutotune(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.sampleTime = 5;
    node.waitTime = 5;
    node.outstep = config.outstep || 100;
    node.outmax = config.maxout || 100;
    node.lookbackSec = config.lookback || 30;
    node.sleep = config.sleep || sleep;

    node.isRunning = false;

    function log(log) {
      node.send([null, null, log]);
    }

    function sleep(sec) {
      return new Promise(resolve => setTimeout(resolve, sec * 1000));
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

    function startAutoTune(msg) {
      return new Promise(async (reslove, reject) => {
        const setpoint = await getSetpoint(msg);
        const atune = new AutoTuner({
          setpoint: setpoint,
          outputstep: node.outstep,
          sampleTimeSec: node.sampleTime,
          lookbackSec: node.lookbackSec,
          outputMin: 0,
          outputMax: node.outmax,
          logFn: log
        });
        while (!atune.run(60)) {
          const heat_percent = atune.output;
          const heating_time = node.sampleTime * heat_percent / 100;
          const waitTime = node.sampleTime - heating_time;
          if (heating_time === node.sampleTime) {
            // TODO turn heater on
            await node.sleep(heating_time)
          } else if(waitTime === node.sampleTime) {
            // TODO turn heater off
            await node.sleep(waitTime)
          } else {
            // TODO turn heter on
            await node.sleep(heating_time);
            // TODO turn heater off
            await node.sleep(waitTime);
          }
        }
      });
    }

    node.on("input", function (msg, send, done) {
      try {
        
        if (node.isRunning === false) {
          startAutoTune(msg)
            .then(function(result) {
              send([result, null, null]);
              node.isRunning = false;
              if (done) done();
            })
            .catch(function(reason) {
              if (done) done(reason);
            });
            node.isRunning = true;
        }
        
        if (done) done();
      } catch (error) {
        if (done) done(error.message || "Something went wrong!");
      }

    });
  }

  RED.nodes.registerType("pid-autotune", PidAutotune);
};
