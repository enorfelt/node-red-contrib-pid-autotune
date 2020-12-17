const autoTuner = require("./core/pid-autotuner");

module.exports = function (RED) {
  "use strict";

  function PidAutotune(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.sampleTime = 5;
    node.waitTime = 5;
    node.outstep = config.outstep || 100;
    node.outmax = config.maxout || 100;
    node.lookbackSec = config.lookback || 30;
    node.sleep = config.sleep || sleep;

    node.tempVariable = config.tempVariable || "payload";
    node.tempVariableType = config.tempVariableType || "msg";
    node.tempVariableMsgTopic = config.tempVariableMsgTopic || "temp-BK";

    node.isRunning = false;

    node.latestTempReading = -1;

    function log(log) {
      node.send([null, null, { payload: log }]);
    }

    function sleep(sec) {
      return new Promise((resolve) => setTimeout(resolve, sec * 1000));
    }

    function getSetpoint(msg) {
      return new Promise(function (resolve) {
        if (config.setpointType === "num") {
          resolve(config.setpoint);
        } else if (config.setpointType === "msg") {
          resolve(msg[config.setpoint]);
        } else {
          RED.util.evaluateNodeProperty(
            config.setpoint,
            config.setpointType,
            node,
            msg,
            (err, value) => {
              if (err) {
                resolve("");
              } else {
                resolve(value);
              }
            }
          );
        }
      });
    }

    function getCurrentTemp() {
      return new Promise(function (resolve, reject) {
        if (node.tempVariableType === "msg") {
          node.latestTempReading > -1
            ? resolve(node.latestTempReading)
            : reject("No temp. reading registered");
        } else {
          RED.util.evaluateNodeProperty(
            config.tempVariable,
            config.tempVariableType,
            node,
            {},
            (err, value) => {
              if (err) {
                reject("Unable to read temperature");
              } else {
                resolve(value);
              }
            }
          );
        }
      });
    }

    function startAutoTune(msg) {
      return new Promise(async (resolve, reject) => {
        try {
          const setpoint = await getSetpoint(msg);
          autoTuner.init({
            setpoint: setpoint,
            outputstep: node.outstep,
            sampleTimeSec: node.sampleTime,
            lookbackSec: node.lookbackSec,
            outputMin: 0,
            outputMax: node.outmax,
            logFn: log,
          });
          while (!autoTuner.run(await getCurrentTemp())) {
            const heat_percent = autoTuner.output;
            const heating_time = (node.sampleTime * heat_percent) / 100;
            const waitTime = node.sampleTime - heating_time;
            if (heating_time === node.sampleTime) {
              node.send([null, { payload: 100}, null]);
              await node.sleep(heating_time);
            } else if (waitTime === node.sampleTime) {
              node.send([null, { payload: 0 }, null]);
              await node.sleep(waitTime);
            } else {
              node.send([null, { payload: 100}, null]);
              await node.sleep(heating_time);
              node.send([null, { payload: 0}, null]);
              await node.sleep(waitTime);
            }
          }
          resolve({ state: autoTuner.state, params: autoTuner.getPIDParameters() });
        } catch (e) {
          reject(e);
        }
      });
    }

    node.on("input", function (msg, send, done) {
      try {
        if (msg.topic === node.tempVariableMsgTopic) {
          node.latestTempReading = msg.payload;
        }

        if (node.isRunning === false) {
          var failReason = '';
          var autoTuneResult = null;
          startAutoTune(msg)
            .then(function (result) {
              autoTuneResult = result;
            })
            .catch(function (reason) {
              failReason = reason;
            })
            .finally(function () {
              if (autoTuneResult !== null) {
                msg.state = autoTuneResult.state;
                msg.payload = autoTuneResult.params;
                send([msg, { payload: 0 }, null]);  
              } else {
                send([null, { payload: 0 }, null]);
              }
              node.isRunning = false;
              if (done) {
                failReason === '' ? done() : done(failReason);
              }
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
