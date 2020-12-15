const rewiremock =  require('./rewiremock');
const helper = require("node-red-node-test-helper");
var Context = require("@node-red/runtime/lib/nodes/context");
var should = require("should");

// rewiremock('../core/pid-autotuner').with({}).toBeUsed();

const pidAutotune = rewiremock.proxy(() => require("../pid-autotune"));
rewiremock('../core/deque').disable();

helper.init(require.resolve("node-red"));


describe("pid-autotune node", function () {
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
        wires: [["n2"]]
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", (function(msg) {
          should(msg.payload).have.ownProperty("Kp");
          should(msg.payload).have.ownProperty("Ki");
          should(msg.payload).have.ownProperty("Kd");
          done();
        }));

        n1.receive({ payload: {} });
        n1.receive({ payload: {} });
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
        wires: [[],[],["n2"]]
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", (function(msg) {
          should(msg.payload).startWith("inputValue ");
          done();
        }));

        n1.receive({ payload: {} });
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
        wires: [[],[],["n2"]]
      },
      { id: "n2", type: "helper" },
    ];
    helper.load(pidAutotune, flow, function () {
      initContext(function () {
        var n1 = helper.getNode("n1");
        var n2 = helper.getNode("n2");
        n2.on("input", (function(msg) {
          should(msg.payload).startWith("inputValue 65");
          done();
        }));

        n1.receive({ payload: 65, topic: "temp-BK" });
      });
    });
  });
});
