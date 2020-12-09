const helper = require("node-red-node-test-helper");
var Context = require("@node-red/runtime/lib/nodes/context");
var should = require('should');
const pidAutotune = require('../pid-autotune');

helper.init(require.resolve("node-red"));

describe("pid-autotune node", function () {
  beforeEach(function (done) {
    helper.startServer(done);
  });

  afterEach(function (done) {
    helper.unload().then(function () {
      return Context.clean({ allNodes: {} });
    }).then(function () {
      return Context.close();
    }).then(function () {
      helper.stopServer(done);
    });
  });

  function initContext(done) {
    Context.init({
      contextStorage: {
        memory0: {
          module: "memory"
        },
        memory1: {
          module: "memory"
        },
        memory2: {
          module: "memory"
        }
      }
    });
    Context.load().then(function () {
      done();
    });
  }

  it("should load node", function (done) {
    var flow = [{ id: "n1", type: "pid-autotune", name: "pid-autotune" }];
    helper.load(pidAutotune, flow, function () {
      var n1 = helper.getNode("n1");
      should(n1).have.property("name", "pid-autotune");
      done();
    });
  });
});
