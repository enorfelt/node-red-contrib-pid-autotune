class Kettle {
  /*
    """A simulated brewing kettle.

    Args:
        diameter (float): Kettle diameter in centimeters.
        volume (float): Content volume in liters.
        temp (float): Initial content temperature in degree celsius.
        density (float): Content density.
    """
    */
  // specific heat capacity of water: c = 4.182 kJ / kg * K
  static get SPECIFIC_HEAT_CAP_WATER() {
    return 4.182;
  }

  // thermal conductivity of steel: lambda = 15 W / m * K
  static get THERMAL_CONDUCTIVITY_STEEL() {
    return 15;
  }

  constructor(diameter, volume, temp, density = 1) {
    this._mass = volume * density;
    this._temp = temp;
    const radius = diameter / 2;

    // height in cm
    const height = (volume * 1000) / (Math.PI * Math.pow(radius, 2));

    // surface in m^2
    this._surface =
      (2 * Math.PI * Math.pow(radius, 2) + 2 * Math.PI * radius * height) /
      10000;
  }

  get temperature() {
    // """Get the content's temperature"""
    return this._temp;
  }

  heat(power, duration, efficiency = 0.98) {
    /* """Heat the kettle's content.

        Args:
            power (float): The power in kW.
            duration (float): The duration in seconds.
            efficiency (float): The efficiency as number between 0 and 1.
        """*/
    this._temp += this._get_deltaT(power * efficiency, duration);
    return this._temp;
  }

  cool(duration, ambient_temp, heat_loss_factor = 1) {
    /*"""Make the content loose heat.

        Args:
            duration (float): The duration in seconds.
            ambient_temp (float): The ambient temperature in degree celsius.
            heat_loss_factor (float): Increase or decrease the heat loss by a
            specified factor.
        """*/
    // Q = k_w * A * (T_kettle - T_ambient)
    // P = Q / t
    var power =
      (Kettle.THERMAL_CONDUCTIVITY_STEEL *
        this._surface *
        (this._temp - ambient_temp)) /
      duration;

    // W to kW
    power /= 1000;
    this._temp -= this._get_deltaT(power, duration) * heat_loss_factor;
    return this._temp;
  }

  _get_deltaT(power, duration) {
    // P = Q / t
    // Q = c * m * delta T
    // => delta(T) = (P * t) / (c * m)
    return (power * duration) / (Kettle.SPECIFIC_HEAT_CAP_WATER * this._mass);
  }
}

module.exports = Kettle;