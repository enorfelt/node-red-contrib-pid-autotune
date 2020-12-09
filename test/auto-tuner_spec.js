var should = require("should");
var deque = require("../core/deque");
var Kettle = require("./utils/kettle");
const AutoTuner = require("../core/pid-autotuner");

describe("AutoTuner", function () {
  

  describe("init", function () {
    it("should create AutoTuner", function (done) {
      const autoTuner = new AutoTuner({ setpoint: 65 });
      done();
    });

    it("should use current time if not supplied", function (done) {
      const autoTuner = new AutoTuner({ setpoint: 65 });
      var currentTimeMs = autoTuner._getTimeMs();
      should(currentTimeMs).be.above(1607437037954);
      done();
    });

    it("should use supplied current time", function (done) {
      const autoTuner = new AutoTuner({
        setpoint: 65,
        getTimeMs: function () {
          return 10;
        },
      });
      var time = autoTuner._getTimeMs();
      should(time).be.eql(10);
      done();
    });
  });

  describe("getPIDParameters", function () {
    it("should return pid parameters for brewing", function (done) {
      const autoTuner = new AutoTuner(brewingConfig);
      var params = autoTuner.getPIDParameters("brewing");
      should(params.Kp).be.eql(0);
      done();
    });
  });

  const brewingConfig = {
    setpoint: 65,
    outputstep: 100,
    lookbackSec: 30,
    outputMin: 0,
    outputMax: 100,
  };

  function sim_update(sim, timestamp, output, updateArgs) {
    sim.kettle.heat(updateArgs.heater_power * (output / 100), updateArgs.sampletime)
    sim.kettle.cool(updateArgs.sampletime, updateArgs.ambient_temp, updateArgs.heat_loss_factor)
    sim.delayed_temps.append(sim.kettle.temperature)
    sim.timestamps.push(timestamp)
    sim.outputs.push(output)
    sim.sensor_temps.push(sim.delayed_temps[0])
    sim.heater_temps.push(sim.kettle.temperature)
  }

  describe("run", function () {
    it("should run with success", function (done) {
      const sampleTime = 5;
      var now = Date.now();
      var getTimeMs = function () {
        var current = now;
        now += sampleTime * 1000;
        return current;
      };
      brewingConfig.getTimeMs = getTimeMs;

      var timestamp = 0  //# seconds
      const kettleTemp = 60;
      
      const maxlen = Math.max(1, Math.round(brewingConfig.lookbackSec / sampleTime))
      delayed_temps = new deque(maxlen)
      for (var i = 0; i < maxlen; i++) {
        delayed_temps.append(kettleTemp);
      }

      const sim = {
        name: "autotune",
        sut: new AutoTuner(brewingConfig),
        kettle: new Kettle(35, 40, kettleTemp),
        delayed_temps: delayed_temps,
        timestamps: [],
        heater_temps: [],
        sensor_temps: [],
        outputs: [],
      };

      const updateArgs = {
        heater_power: 2.8,
        sampletime: sampleTime,
        ambient_temp: 20,
        heat_loss_factor: 1
      }

      while (!sim.sut.run(sim.delayed_temps[0])) {
        timestamp += updateArgs.sampletime
        sim_update(sim, timestamp, sim.sut.output, updateArgs)
      }

      should(sim.sut.state).be.eql(AutoTuner.STATE_SUCCEEDED);

      const pidParams = sim.sut.getPIDParameters('brewing');
      should(pidParams.Kp).be.eql(75.45758866136876)
      should(pidParams.Ki).be.eql(0.08070330338114307)
      should(pidParams.Kd).be.eql(58.79403783198316)
      done();
    });
  });
});
