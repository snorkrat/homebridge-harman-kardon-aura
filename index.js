var request = require("request");
var Service, Characteristic;
var exec = require('child_process').exec;
var net = require('net');
var inherits = require('util').inherits;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
    
  //fixInheritance(HarmanKardonAuraAccessory.Volume, Characteristic);    
  fixInheritance(HarmanKardonAuraAccessory.Mute, Characteristic);
  fixInheritance(HarmanKardonAuraAccessory.AudioService, Service);    

  homebridge.registerAccessory("homebridge-harman-kardon-aura", "harman-kardon-aura", "Harman Kardon Aura", HarmanKardonAuraAccessory);
};

function fixInheritance(subclass, superclass) {
    var proto = subclass.prototype;
    inherits(subclass, superclass);
    subclass.prototype.parent = superclass.prototype;
    for (var mn in proto) {
        subclass.prototype[mn] = proto[mn];
    }
};

function buildRequest(cmd,para) {
   var text = '';
   var payload = '<?xml version="1.0" encoding="UTF-8"?> <harman> <avr> <common> <control> <name>'+cmd+'</name> <zone>Main Zone</zone> <para>'+para+'</para> </control> </common> </avr> </harman>';
   text += 'POST HK_APP HTTP/1.1\r\n';
   text += 'Host: :' + this.ip + '\r\n';
   text += 'User-Agent: Harman Kardon Aura Controller/1.0\r\n';
   text += 'Content-Length: ' + payload.length + '\r\n';
   text += '\r\n';
   text += payload;
   //console.log(text);
   return text;
};

function HarmanKardonAuraAccessory(log, config) {
  this.log          = log;
  this.name         = config["name"];
  this.ip           = config["ip"];
  this.port         = config["port"];    
  this.model_name   = config["model_name"] || "Aura";
  this.manufacturer = config["manufacturer"] || "Harman Kardon";    
};

//custom characteristics
HarmanKardonAuraAccessory.Volume = function setBrightness(volume, callback) {
    Characteristic.call(this, 'Volume', '00001001-0000-1000-8000-135D67EC4377');
    this.setProps({
        format: Characteristic.Formats.UINT8,
        unit: Characteristic.Units.PERCENTAGE,
        maxValue: 100,
        minValue: 0,
        minStep: 1,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};

HarmanKardonAuraAccessory.Mute = function () {
    Characteristic.call(this, 'Outlet In Use', '00000026-0000-1000-8000-0026BB765291');
  this.setProps({
    format: Characteristic.Formats.BOOL,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
  });
    this.value = this.getDefaultValue();
};


HarmanKardonAuraAccessory.AudioService = function (displayName, subtype) {
    Service.call(this, displayName, '48a7057e-cb08-407f-bf03-6317700b3085', subtype);
    //this.addCharacteristic(HarmanKardonAuraAccessory.Volume);
    this.addOptionalCharacteristic(HarmanKardonAuraAccessory.Mute);
};


HarmanKardonAuraAccessory.prototype = {
    
  setPowerState: function(powerOn, callback) {
    var that        = this;
    if (powerOn) {
        var client = new net.Socket();
        client.connect(this.port, this.ip, function() {
        client.write(buildRequest('power-on'));
        client.destroy();   
        });
    } else {
        var client = new net.Socket();
        client.connect(this.port, this.ip, function() {
        client.write(buildRequest('power-off'));
        client.destroy();   
        });
    }
    client.on('error', function(err){
    that.log("Error setting Powerstate: "+err.message);
        
     })  
      
    callback()
  },
      
  getPowerState: function(callback) {
    var that        = this;
    var state       = false;   

    exec("ping -c 2 -W 1 " +this.ip+ " | grep -i '2 received'", function(error, stdout, stderr) {
        state = stdout ? true : false;
        that.log("Current state: " + (state ? "On." : "Off."));
        callback(null, state);
    });
  },
    
  setInput: function(input, callback) {
    var that        = this;
    this.log("Set Input:" + input);  
    var client = new net.Socket();
      if(input){
            this.log("Change input to Cable/Sat");
            client.connect(this.port, this.ip, function() {
            client.write(buildRequest('source-selection','Cable Sat'));
            client.write(buildRequest('source-selection','Cable Sat'));
            client.destroy();
            });
      } else {
            this.log("Change input to STB");
            client.connect(this.port, this.ip, function() {
            client.write(buildRequest('source-selection','STB'));
            client.write(buildRequest('source-selection','STB'));    
            client.destroy();
            });
      }
      client.on('error', function(err){
        that.log("Error change input: "+err.message);
      })
      
      callback()
  },    
    
  identify: function(callback) {
      this.log('Identify requested!');
      callback(); // success
    },    
    
  getServices: function() {
      
    var availableServices = [];  
    var informationService = new Service.AccessoryInformation();
    
    availableServices.push(informationService);
      
    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model_name)
     //.setCharacteristic(Characteristic.SerialNumber, this.model_name);
           
    
    var lightService = new Service.Lightbulb(this.name);
      availableServices.push(lightService); 
      
    lightService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setBrightness.bind(this))
      .on('get', this.getBrightness.bind(this));
    
    var switchService = new Service.Switch('Sat/STB');
      availableServices.push(switchService);    

    switchService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setInput.bind(this))

      
     /* var audioService = new HarmanKardonAuraAccessory.AudioService('Input');
    availableServices.push(audioService);
      audioService
      .getCharacteristic(HarmanKardonAuraAccessory.Mute)
      .on('set', this.setInput.bind(this));*/

      
      return availableServices;
  }
}
