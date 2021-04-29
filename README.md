# node-red-contrib-pid-autotune

A node-red node to performe PID autotune on a brew rig

![node-red-contrib-pid-autotune CI](https://github.com/enorfelt/node-red-contrib-pid-autotune/workflows/node-red-contrib-pid-autotune%20CI/badge.svg)

# Getting started

## Install

To install the current live version, please use Node-RED's Palette Manager or issue following commands:  
```
$ cd ~/.node-red  
$ npm install node-red-contrib-pid-autotune
```

## pid-autotune node

### Input

1. On input, starts a new autotune process if not started. You can also, continuesly, set current temp with a specific topic. Send 'stop' in cmd property to stop current auto tune process.

### Outputs

There are three outputs explained in order top to botton.

1. Triggered when an autocomplete process is completed with state. msg.payload contains an object with the calculated kp, ki and kd values.
2. The element output from 0-100% where 0 is off and 100 is full on. Connect to your actor.
3. Ouputs logs from the autotune process.

### Configuration

| Setting           | Description                                                                  |
| ----------------- | -----------------------------------------------------------------------------|
| `Name`            | What ever you name the node                                                  |
| `Output step %`   | Sets the output when stepping up/down. Default 100                           |
| `Max. output %`   | Sets the max power output. Default 100                                       |
| `Lookback sec.`   | How far back to look for min/max temps. Default 30                           |
| `Set point`       | The set point temp to do autotune against. Typical mash temp . Default 65    |
| `Temp.`           | From where to read current temp from. msg, flow or global variable.          |
| `Temp. topic`     | If msg is selected for temp. Specify a topic from where current temp is from.|

## kettle-sim node

A node to simulate a kettle in a brew rig

### Input

1. Set msg.payload to a value between 0 and 100 to set heater power percentage (0-100).

### Output

1. msg.payload contains the calculated temperature of the kettle. Also msg.power is the input value heater percentage.

### Configuration

| Setting                  | Description                                                                        |
| ------------------------ | -----------------------------------------------------------------------------------|
| `Name`                   | What ever you name the node                                                        |
| `Diameter (cm)`          | The kettle diamter in centimeters. Default 35 cm                                   |
| `Volume (L)`             | The kettle volume in litres. Default 40 L                                          |
| `Initial temp (C)`       | The initial temp of the kettle content in Celcius. Default 20 C                    |
| `Heater power (kW)`      | The default heter power in kilowatts. Default 2.5 kW                               |
| `Kettle ambient temp (C)`| The ambient room temperature, in Celcius, where the kettle is located. Default 20 C|

# Contributing

1. Fork this repo
2. Write a red unit test for your change
3. Implement the code and make the test green
4. Refactor your code to make it nice
5. Make a pull request

I will probably approve it ;)

# Credits

Special thanks to https://github.com/IndyJoeA/cbpi_PIDAutoTune for the inspiration for this plugin!