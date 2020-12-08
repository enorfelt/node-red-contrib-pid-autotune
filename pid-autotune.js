module.exports = function (RED) {
  "use strict";

  function PidAutotune(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.on("input", async function (msg, send, done) {
      try {
        send(msg);
        if (done) done();
      } catch (error) {
        if (done) done(error.message || "Something went wrong!");
      }

    });
  }

  RED.nodes.registerType("pid-autotune", PidAutotune);
};
