
const request = require('request');
const process = require('process');
const child_process = require('child_process');

// const DEBUG = true
const DEBUG = false

var Service, Characteristic

module.exports = function (homebridge) {
    Service        = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    homebridge.registerAccessory('homebridge-my', 'MyHome', MyHome)
};

function MyHome(log, config) {
    this.log = log

    this.name           = config['name']
    this.service        = config['service']

    this.lightState = {
        switch:     true,
        brightness: 100,
        lastBrightness: 100,
    }
    this.airconState = {
        active:       Characteristic.Active.INACTIVE,
        currentState: Characteristic.CurrentHeaterCoolerState.INACTIVE,
        targetState:  Characteristic.TargetHeaterCoolerState.AUTO,
        temperature:  28,
        swing:        Characteristic.SwingMode.SWING_DISABLED,
        speed:        0,
    }
    this.fanState = {
        active:        false,
        speed:         1,
        speedUpdated:  false,
        swing:         false,
        swingUpdated:  false,
        rhythm:        false,
    }
}

MyHome.prototype = {

    getServices: function () {
        let informationService = new Service.AccessoryInformation()
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'My home')
            .setCharacteristic(Characteristic.Model, 'My home')
            .setCharacteristic(Characteristic.SerialNumber, '000')

        this.informationService = informationService

        switch (this.service) {
        case 'Light':
            this.lightbulbService = new Service.Lightbulb(this.name)
            this.lightbulbService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getSwitch.bind(this))
                .on('set', this.setSwitch.bind(this))
            this.lightbulbService
                .addCharacteristic(new Characteristic.Brightness)
                .on('get', this.getBrightness.bind(this))
                .on('set', this.setBrightness.bind(this))
            return [informationService, this.lightbulbService]

        case 'AirCon':
            this.heaterCoolerService = new Service.HeaterCooler(this.name)
            this.heaterCoolerService
                .getCharacteristic(Characteristic.Active)
                .on('get', this.getActive.bind(this))
                .on('set', this.setActive.bind(this))
            this.heaterCoolerService
                .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
                .on('get', this.getCurrentHeaterCoolerState.bind(this))
                .on('set', this.setCurrentHeaterCoolerState.bind(this))
            this.heaterCoolerService
                .getCharacteristic(Characteristic.TargetHeaterCoolerState)
                .on('get', this.getTargetHeaterCoolerState.bind(this))
                .on('set', this.setTargetHeaterCoolerState.bind(this))
            this.heaterCoolerService
                .getCharacteristic(Characteristic.CurrentTemperature)
                .on('get', this.getCurrentTemperature.bind(this))
                .on('set', this.setCurrentTemperature.bind(this))
            this.heaterCoolerService
                .addCharacteristic(new Characteristic.SwingMode)
                .on('get', this.getSwingMode.bind(this))
                .on('set', this.setSwingMode.bind(this))
            this.heaterCoolerService
                .addCharacteristic(new Characteristic.RotationSpeed)
                .on('get', this.getRotationSpeed.bind(this))
                .on('set', this.setRotationSpeed.bind(this))

            return [informationService, this.heaterCoolerService]

        case 'Fan':
            this.fanService = new Service.Fanv2(this.name)
            this.fanService
                .getCharacteristic(Characteristic.Active)
                .on('get', this.getFanActive.bind(this))
                .on('set', this.setFanActive.bind(this))
            this.fanService
                .getCharacteristic(Characteristic.TargetFanState)
                .on('get', this.getFanState.bind(this))
                .on('set', this.setFanState.bind(this))
            this.fanService
                .addCharacteristic(new Characteristic.RotationSpeed)
                .on('get', this.getFanSpeed.bind(this))
                .on('set', this.setFanSpeed.bind(this))
                .setProps({
                    minValue: 0,
                    maxValue: 3,
                })
            this.fanService
                .addCharacteristic(new Characteristic.SwingMode)
                .on('get', this.getFanSwingMode.bind(this))
                .on('set', this.setFanSwingMode.bind(this))
            return [informationService, this.fanService]

        default:
        }
    },
    getActive: function (next) {
        next(null, this.airconState.active)
    },
    setActive: function (active, next) {
        this.airconState.active = active
        next()
    },
    getCurrentHeaterCoolerState: function (next) {
        next(null, this.airconState.currentState)
    },
    setCurrentHeaterCoolerState: function (state, next) {
        this.airconState.currentState = state
        next()
    },
    getTargetHeaterCoolerState: function (next) {
        next(null, this.airconState.targetState)
    },
    setTargetHeaterCoolerState: function (state, next) {
        this.airconState.targetState = state
        next()
    },
    getCurrentTemperature: function (next) {
        next(null, this.airconState.temperature)
    },
    setCurrentTemperature: function (temperature, next) {
        this.airconState.temperature = temperature
        next()
    },
    getSwingMode: function (next) {
        next(null, this.airconState.swing)
    },
    setSwingMode: function (swing, next) {
        this.airconState.swing = swing
        next()
    },
    getRotationSpeed: function (next) {
        next(null, this.airconState.speed)
    },
    setRotationSpeed: function (speed, next) {
        this.airconState.speed = speed
        next()
    },

    // Light ===================================================================

    getSwitch: function (next) {
        next(null, this.lightState.switch)
    },
    setSwitch: function (on, next) {
        console.log('set switch', on);

        if (this.lightState.switch != on) {
            if (this.lightState.brightness == 100)
                this.send('light', on ? 'on' : 'off')
            else this.send('light', on ? 'eco' : 'off')
            this.lightState.switch = on
        }

        next()
    },
    getBrightness: function (next) {
        next(null, this.lightState.brightness)
    },
    setBrightness: function (level, next) {
        console.log('set brightness', level)

        if      (level == 100) this.send('light', 'on')
        else if (level == 0)   this.send('light', 'off')
        else if (level < 10)   this.send('light', 'night')
        else {
            let commands = []

            if (!this.lightState.switch || this.lightState.brightness < 10) {
                if (100 - level <
                    Math.abs(level - this.lightState.lastBrightness)) {
                    commands.push('on')
                    this.lightState.brightness = 100
                }
                else {
                    commands.push('eco')
                    this.lightState.brightness = this.lightState.lastBrightness
                }
            }

            let current = Math.floor(this.lightState.brightness / 10)
            const target  = Math.floor(level / 10)

            if (target != current)
                this.lightState.lastBrightness = level

            while (target > current) {
                commands.push('up')
                current++
            }
            while (target < current) {
                commands.push('down')
                current--
            }

            this.send('light', commands)
        }

        this.lightState.brightness = level
        next()
    },

    // Fan =====================================================================

    getFanActive: function (next) {
        next(null,
             this.fanState.active ?
             Characteristic.Active.ACTIVE :
             Characteristic.Active.INACTIVE)
    },
    setFanActive: function (active_, next) {
        const active = active_ == Characteristic.Active.ACTIVE
        if (active != this.fanState.active) {
            const commands = ['power']
            if (active) {
                if (this.fanState.swingUpdated) commands.push('swing')
                if (this.fanState.rhythm)       commands.push('rhythm')
            }

            this.send('fan', commands)

            this.fanState.swingUpdated  = false
            this.fanState.active        = active
        }

        if (DEBUG) console.log('set active', this.fanState)
        next()
    },
    getFanSpeed: function (next) {
        next(null, this.fanState.speed == -1 ? 1 : this.fanState.speed)
    },
    setFanSpeed: function (speed, next) {
        if (speed == 0 && this.fanState.active) {
            this.send('fan', 'power')
            this.fanState.active = false
        }
        else if (speed > 0) {
            let commands = []
            if (!this.fanState.active) {
                commands.push('power')
                if (this.fanState.swingUpdated) commands.push('swing')
                if (this.fanState.rhythm)       commands.push('rhythm')
                this.fanState.swingUpdated  = false
                this.fanState.active        = true
            }

            if (this.fanState.rhythm) {
                this.fanState.speedUpdated = true
            }
            else {
                switch (speed) {
                case 1:
                    commands.push('low')
                    break
                case 2:
                    commands.push('mid')
                    break
                case 3:
                    commands.push('high')
                    break
                }

            }
            this.send('fan', commands)
        }

        this.fanState.speed = speed

        if (DEBUG) console.log('set speed', this.fanState)
        next()
    },
    getFanState: function (next) {
        next(null,
             this.fanState.rhythm ?
             Characteristic.TargetFanState.AUTO :
             Characteristic.TargetFanState.MANUAL)
    },
    setFanState: function (state, next) {
        const rhythm = state == Characteristic.TargetFanState.AUTO
        if (this.fanState.active) {
            if (this.fanState.rhythm != rhythm) {
                if (!rhythm && this.fanState.speedUpdated) {
                    switch (this.fanState.speed) {
                    case 1:
                        this.send('fan', 'low')
                        break
                    case 2:
                        this.send('fan', 'mid')
                        break
                    case 3:
                        this.send('fan', 'high')
                        break
                    }
                    this.fanState.speedUpdated = false
                }
                else {
                    this.send('fan', 'rhythm')
                }
            }
        }

        this.fanState.rhythm = rhythm


        if (DEBUG) console.log('set state', this.fanState)
        next()
    },
    getFanSwingMode: function (next) {
        next(null, this.fanState.swing ?
             Characteristic.SwingMode.SWING_ENABLED :
             Characteristic.SwingMode.SWING_DISABLED)
    },
    setFanSwingMode: function (swing_, next) {
        const swing = swing_ == Characteristic.SwingMode.SWING_ENABLED
        if (this.fanState.active) {
            if (swing != this.fanState.swing) this.send('fan', 'swing')
        }
        else this.fanState.swingUpdated = true

        this.fanState.swing = swing


        if (DEBUG) console.log('set swing', this.fanState)
        next()
    },





    send: function(accessory, command, repeat) {
        if (Array.isArray(command)) {
            if (command.length == 0) return
            command = command.join(' ')
        }
        if (repeat !== undefined) {
            if      (repeat == 0) return
            else if (repeat > 1)  command = (command + ' ').repeat(repeat)
        }
        console.log('send', accessory, command)
        child_process.execSync(
            `python3 irrp.py -p -g14 --gap 300 -f${accessory} ${command}`,
            { cwd: '/home/pi/ir', shell: '/bin/bash'})
    },
    request: function(opts, callback, next) {
        const self = this;
        request(opts, function (error, response, body) {
            if (error) {
                self.log('STATUS: ' + response);
                self.log(error.message);
                return next(error);
            }
            else return callback(body)
        })
    }
};
