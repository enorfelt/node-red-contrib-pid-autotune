const helper = require("node-red-node-test-helper");
var Context = require("@node-red/runtime/lib/nodes/context");
var should = require("should");

const kettleSim = require("../kettle-sim");

helper.init(require.resolve("node-red"));

describe("kettle-sim node", function () {
  beforeEach(function (done) {
    helper.startServer(done);
  });

  afterEach(function (done) {
    helper
      .unload()
      .then(function () {
        return Context.clean({ allNodes: {} });
      })
      .then(function () {
        return Context.close();
      })
      .then(function () {
        helper.stopServer(done);
      });
  });

  function initContext(done) {
    Context.init({
      contextStorage: {
        memory0: {
          module: "memory",
        },
        memory1: {
          module: "memory",
        },
        memory2: {
          module: "memory",
        },
      },
    });
    Context.load().then(function () {
      done();
    });
  }

  it("should load node", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: 35,
        volume: 40,
        temp: 20,
        power: 2.5,
        ambientTemp: 20
      },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        should(n1).have.property("name", "kettle-sim");
        done();
      });
    });
  });

  it("should handle negative input", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: 35,
        volume: 40,
        temp: 20,
        power: 2.5,
        ambientTemp: 20,
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.power).greaterThan(-1);
          done();
        });
        n1.receive({ payload: -1 });
      });
    });
  });

  it("should handle more then 100 input", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: 35,
        volume: 40,
        temp: 20,
        power: 2.5,
        ambientTemp: 20,
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.power).eql(100);
          done();
        });
        n1.receive({ payload: 101 });
      });
    });
  });

  it("should handle invalid string input", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: 35,
        volume: 40,
        temp: 20,
        power: 2.5,
        ambientTemp: 20,
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.power).eql(0);
          done();
        });
        n1.receive({ payload: "notanumber" });
      });
    });
  });

  it("should handle valid string input", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: 35,
        volume: 40,
        temp: 20,
        power: 2.5,
        ambientTemp: 20,
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.power).eql(50.5);
          done();
        });
        n1.receive({ payload: "50.5" });
      });
    });
  });

  it("should cool when no power applied", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: 35,
        volume: 40,
        temp: 60,
        power: 2.5,
        ambientTemp: 20,
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.payload).lessThan(60);
          done();
        });
        n1.receive({ payload: 0 });
      });
    });
  });

  it("should heat when power applied", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: 35,
        volume: 40,
        temp: 60,
        power: 2.5,
        ambientTemp: 20,
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.payload).greaterThan(60);
          done();
        });
        n1.receive({ payload: 100 });
      });
    });
  });

  it("should use configured heater power and ambient temp", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: 35,
        volume: 40,
        temp: 60,
        power: 5,
        ambientTemp: 20,
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.payload).eql(60.14412263101076);
          done();
        });
        n1.receive({ payload: 100 });
      });
    });
  });

  it("should be able to use string configs", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "kettle-sim",
        name: "kettle-sim",
        diam: "35",
        volume: "40",
        temp: "60",
        power: "5",
        ambientTemp: "20",
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(kettleSim, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.payload).eql(60.14412263101076);
          done();
        });
        n1.receive({ payload: 100 });
      });
    });
  });
});
