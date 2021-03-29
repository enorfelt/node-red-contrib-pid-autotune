const helper = require("node-red-node-test-helper");
var Context = require("@node-red/runtime/lib/nodes/context");
var should = require("should");

var sinon = require("sinon");

const pidAutotune = require("../pid-autotune");
const autoTuner = require("../core/pid-autotuner");

helper.init(require.resolve("node-red"));

describe("pid-autotune node", function () {
  var runFake = function (inputValue) {
    autoTuner.log(`inputValue ${inputValue}`);
    return true;
  };
  beforeEach(function (done) {
    sinon.stub(autoTuner, "run").callsFake(runFake);
    sinon.stub(autoTuner, "state").value("succeeded");
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
        sinon.restore();
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
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
      },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        should(n1).have.property("name", "pid-autotune");
        done();
      });
    });
  });

  it("should start autotune on msg", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariableMsgTopic: "temp-BK",
        wires: [["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.state).eql("succeeded");
          should(msg.payload).have.ownProperty("Kp");
          should(msg.payload).have.ownProperty("Ki");
          should(msg.payload).have.ownProperty("Kd");
          done();
        });

        n1.receive({ payload: 65, topic: "temp-BK" });
      });
    });
  });

  it("should send log on third output", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariableMsgTopic: "temp-BK",
        wires: [[], [], ["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.payload).endWith("inputValue 65");
          done();
        });

        n1.receive({ payload: 65, topic: "temp-BK" });
      });
    });
  });

  it("should get current temp from input message", function (done) {
    var flow = [
      {
        id: "n1",
        // z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariable: "payload",
        tempVariableType: "msg",
        tempVariableMsgTopic: "temp-BK",
        wires: [[], [], ["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.payload).endWith("inputValue 65");
          done();
        });

        n1.receive({ payload: 65, topic: "temp-BK" });
      });
    });
  });

  it("should get current temp from flow variable", function (done) {
    var flow = [
      {
        id: "n1",
        z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariable: "#:(memory1)::temp-BK",
        tempVariableType: "flow",
        tempVariableMsgTopic: "temp-BK",
        wires: [[], [], ["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.payload).endWith("inputValue 75");
          done();
        });
        var context = n1.context();
        var f = context.flow;
        f.set("temp-BK", 75, "memory1", function () {
          n1.receive({});
        });
      });
    });
  });

  it("should get current temp from global variable", function (done) {
    var flow = [
      {
        id: "n1",
        z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariable: "#:(memory1)::temp-BK",
        tempVariableType: "global",
        tempVariableMsgTopic: "temp-BK",
        wires: [[], [], ["n2"]],
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", function (msg) {
          should(msg.payload).endWith("inputValue 72");
          done();
        });
        var context = n1.context();
        var g = context.global;
        g.set("temp-BK", 72, "memory1", function () {
          n1.receive({});
        });
      });
    });
  });

  it("should start heater and sleep", function (done) {
    var nrOfSleeps = 0;
    var flow = [
      {
        id: "n1",
        z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariable: "#:(memory1)::temp-BK",
        tempVariableType: "global",
        tempVariableMsgTopic: "temp-BK",
        wires: [["n2"], ["n3"], []],
        nextRun: function (sec, callback) {
          nrOfSleeps++;
          setTimeout(callback, 1);
        },
      },
      { id: "n2", type: "helper" },
      { id: "n3", type: "helper" },
    ];
    var nrOfRuns = 0;
    runFake = function (inputValue) {
      var result = false;
      if (nrOfRuns > 0) {
        result = true;
      }
      nrOfRuns++;
      return result;
    };
    sinon.restore();
    sinon.stub(autoTuner, "run").callsFake(runFake);
    sinon.stub(autoTuner, "output").value(100);

    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        var n3 = helper.getNode("n3");
        var heaterPayload = 0;
        n2.on("input", function (msg) {
          should(nrOfSleeps).eql(1);
          should(heaterPayload).eql(100);
          done();
        });
        n3.on("input", function (msg) {
          heaterPayload = msg.payload;
        });
        var context = n1.context();
        var g = context.global;
        g.set("temp-BK", 60, "memory1", function () {
          n1.receive({});
        });
      });
    });
  });

  it("should turn heater off and sleep", function (done) {
    var nrOfSleeps = 0;
    var flow = [
      {
        id: "n1",
        z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariable: "#:(memory1)::temp-BK",
        tempVariableType: "global",
        tempVariableMsgTopic: "temp-BK",
        wires: [["n2"], ["n3"], []],
        nextRun: function (sec, callback) {
          nrOfSleeps++;
          setTimeout(callback, 1);
        },
      },
      { id: "n2", type: "helper" },
      { id: "n3", type: "helper" },
    ];
    var nrOfRuns = 0;
    runFake = function (inputValue) {
      var result = false;
      if (nrOfRuns > 0) {
        result = true;
      }
      nrOfRuns++;
      return result;
    };

    sinon.restore();
    sinon.stub(autoTuner, "run").callsFake(runFake);
    sinon.stub(autoTuner, "output").value(0);

    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        var n3 = helper.getNode("n3");
        var heaterPayload = -1;
        n2.on("input", function (msg) {
          should(nrOfSleeps).eql(1);
          should(heaterPayload).eql(0);
          done();
        });
        n3.on("input", function (msg) {
          heaterPayload = msg.payload;
        });
        var context = n1.context();
        var g = context.global;
        g.set("temp-BK", 60, "memory1", function () {
          n1.receive({});
        });
      });
    });
  });

  it("should turn heater on and of and sleep two times", function (done) {
    var nrOfSleeps = 0;
    var flow = [
      {
        id: "n1",
        z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 100,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariable: "#:(memory1)::temp-BK",
        tempVariableType: "global",
        tempVariableMsgTopic: "temp-BK",
        wires: [["n2"], ["n3"], []],
        nextRun: function (sec, callback) {
          nrOfSleeps++;
          setTimeout(callback, 1);
        },
      },
      { id: "n2", type: "helper" },
      { id: "n3", type: "helper" },
    ];
    var nrOfRuns = 0;
    runFake = function (inputValue) {
      var result = false;
      if (nrOfRuns > 0) {
        result = true;
      }
      nrOfRuns++;
      return result;
    };

    sinon.restore();
    sinon.stub(autoTuner, "run").callsFake(runFake);
    sinon.stub(autoTuner, "output").value(50);

    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        var n3 = helper.getNode("n3");
        var elementCycle = 0;
        n2.on("input", function (msg) {
          should(nrOfSleeps).eql(2);
          should(elementCycle).eql(2);
          done();
        });
        n3.on("input", function (msg) {
          elementCycle++;
        });
        var context = n1.context();
        var g = context.global;
        g.set("temp-BK", 60, "memory1", function () {
          n1.receive({});
        });
      });
    });
  });

  it("should start heater and sleep with maxout set to 50", function (done) {
    var nrOfSleeps = 0;
    var flow = [
      {
        id: "n1",
        z: "flow",
        type: "pid-autotune",
        name: "pid-autotune",
        outstep: 100,
        maxout: 50,
        lookback: 30,
        setpoint: 65,
        setpointType: "num",
        tempVariable: "#:(memory1)::temp-BK",
        tempVariableType: "global",
        tempVariableMsgTopic: "temp-BK",
        wires: [["n2"], ["n3"], []],
        nextRun: function (sec, callback) {
          nrOfSleeps++;
          setTimeout(callback, 1);
        },
      },
      { id: "n2", type: "helper" },
      { id: "n3", type: "helper" },
    ];
    var nrOfRuns = 0;
    runFake = function (inputValue) {
      var result = false;
      if (nrOfRuns > 0) {
        result = true;
      }
      nrOfRuns++;
      return result;
    };
    sinon.restore();
    sinon.stub(autoTuner, "run").callsFake(runFake);
    sinon.stub(autoTuner, "output").value(50);

    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        var n3 = helper.getNode("n3");
        var maxHeaterPayload = 0;
        n2.on("input", function (msg) {
          should(maxHeaterPayload).eql(50);
          done();
        });
        n3.on("input", function (msg) {
          maxHeaterPayload = msg.payload > maxHeaterPayload ? msg.payload : maxHeaterPayload;
        });
        var context = n1.context();
        var g = context.global;
        g.set("temp-BK", 60, "memory1", function () {
          n1.receive({});
        });
      });
    });
  });
});
