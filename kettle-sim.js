const Kette = require("./core/kettle");

module.exports = function (RED) {
  "use strict";

  function KettleSim(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.diam = parseFloat(config.diam);
    node.volume = parseFloat(config.volume);
    node.initTemp = parseFloat(config.temp);
    node.ambientTemp = parseFloat(config.ambientTemp);
    node.heaterPower = parseFloat(config.power);

    var kettle = new Kette(node.diam, node.volume, node.initTemp);

    node.prevPowerSetting = 0;

    function getValidPower(input) {
      var power = typeof input === "number" ? input : node.prevPowerSetting;

      if (typeof input === "string") {
        var possibleNewPower = parseFloat(input);
        if (!isNaN(possibleNewPower)) {
          power = possibleNewPower;
        }
      }

      if (power < 0) {
        return 0;
      }

      if (power > 100) {
        return 100;
      }

      node.prevPowerSetting = power;

      return power;
    }

    var lastRun = 0

    function getDurationSec() {
      if (lastRun === 0) {
        return 5;
      }
      var now = Date.now();
      var durationSec = (now - lastRun) / 1000;
      lastRun = now;

      return durationSec;
    }

    node.on("input", function (msg, send, done) {
      try {
        msg.power = getValidPower(msg.payload);

        var duration = getDurationSec();
        kettle.heat(node.heaterPower * (msg.power / 100), duration)
        kettle.cool(duration, node.ambientTemp, 1)
        msg.payload = kettle.temperature;
        send(msg);

        if (done) done();
      } catch (error) {
        if (done) done(error.message || "Something went wrong!");
      }
    });
  }

  RED.nodes.registerType("kettle-sim", KettleSim);
};
