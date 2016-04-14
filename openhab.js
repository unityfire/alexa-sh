/* Alexa SH - Amazon Echo Smart Home API integration */

/******************************* CONFIGURATION *******************************/
var user = 'USERNAME';
var pass = 'PASSWORD';
var address = 'my.openhab.org';


/******************************* INCLUDES/MISC *******************************/
var https = require('https');
var request = require('request');

var auth = "Basic " + new Buffer(user + ":" + pass).toString("base64");
var constructErrorMsg = constructErrorMsg;

// Request module - agent configuration
var agent;
var agentOptions;
agentOptions = {
    "host": address,
    "port": "443",
    "path": "/"
    // If https is used, allow default and self signed SSL certificates
    //"rejectUnauthorized": "false"
};
agent = new https.Agent(agentOptions);


/******************************* MAIN ROUTINES *******************************/
exports.handler = function(event, context) {
    // TODO - validate payload accessToken before continuing
    switch (event.header.namespace) {
        case "Alexa.ConnectedHome.Discovery":
            handleDiscoveryEvent(event, context);
            break;
        case "Alexa.ConnectedHome.Control":
            handleControlEvent(event, context);
            break;
        case "Alexa.ConnectedHome.System":
            handleSystemEvent(event, context);
            break;
        default:
            console.log("ERROR: Unsupported namespace: " + event.header.namespace);
            context.fail("Something went wrong, unsupported namespace!");
            break;
    }
};

// Discovery, return list of available devices
function handleDiscoveryEvent(event, context) {
    var header = {
        "name": "DiscoverAppliancesResponse",
        "namespace": "Alexa.ConnectedHome.Discovery",
        "payloadVersion": "2",
        "messageId": event.header.messageId
    };
    
    var appliances = [];
    getItems(function(discovered) {
      //  TODO - failing top level
      deviceLoop:
//      for(var i = 0; i < discovered.length; i++) {
          //console.log('count: '+ i);
          //TODO item is not breaking out records properly
        
        //DEBUG
        var item = discovered;
        //var item = discovered[i];
        //console.log('Item DUMP: ', item);

        //if(discovered.name.indexOf("_") !== 0) {
            var itemLocation = "Unknown Location";
//            for (var j = 0; j < allRooms.length; j++){
//                if(Locations[j].id === device.room){
//                    itemLocation = allRooms[j].name;
//                    break;
//                }
//            }
            var itemType = item.type;
            var applicanceId = item.name;

// TODO - handling of more device types/categories
// Reference - https://github.com/openhab/openhab/wiki/Explanation-of-items#item-type
//  GroupItem / SwitchItem / DimmerItem / ColorItem / StringItem / NumberItem
//  ContactItem / DateTimeItem / RollershutterItem / LocationItem / CallItem

// TODO - consider item definitions in OpenHAB v1.x vs v2.x
// 
// OpenHAB 1.x:
//<item>
//	<type>SwitchItem</type>
//	<name>ITEM</name>
//	<state>ON</state>
//	<link>http://address:port/rest/items/ITEM</link>
//</item>

            var discoveredItem = {
                "actions": [
                        "turnOn",
                        "turnOff",
                        "incrementPercentage",
                        "decrementPercentage",
                        "setPercentage"
                        //"incrementTargetTemperature",
                        //"decrementTargetTemperature",
                        //"setTargetTemperature"
                ],
                "additionalApplianceDetails": {},
                "applianceId": applicanceId,
                //"friendlyName": "Alexa SH Virtual Device",
                "friendlyDescription": itemType + " " + applicanceId + " in " + itemLocation + " connected via OpenHAB",
                "friendlyName": applicanceId,
                //"friendlyDescription": itemType + " " + applicanceId + " connected via OpenHAB",
                "isReachable": true,
                "manufacturerName": "Alexa SH Device",
                "modelName": "Alexa SH " + itemType,
                "version": "1"
            };
            appliances.push(discoveredItem);
       //}
      //}

        var payload = {
            "discoveredAppliances": appliances
        };

        var result = {
            "header": header,
            "payload": payload
        };

        // DEBUG
        //console.log("INFO: Discovered devices found: " + JSON.stringify(result));
        context.succeed(result);
    });
    //});
}

// Controls, issues commands to HA items
function handleControlEvent(event, context) {
    var name = event.header.name.replace("Request", "Confirmation");
    var namespace = event.header.namespace;
    var messageId = event.header.messageId;
            
    var header = {
        "name": name,
        "namespace": namespace,
        "payloadVersion": "2",
        "messageId": messageId
    };
    
    var payload = {
    };
    
    var result = {
        "header": header,
        "payload": payload
    };
    
    // DEBUG
    //console.log('DEBUG: handleControl hit!  Header text is: ' + header);    
    //console.log('DEBUG: Header Name:' + event.header.name);
    //console.log('DEBUG: Appliance ID:' + event.payload.appliance.applianceId);
    //console.log('DEBUG: Action:' + event.payload.switchControlAction);
        
    // TODO - Handle OAuth2
    var supportedEventNames = [ "TurnOnRequest", "TurnOffRequest", 
                                "SetPercentageRequest", "IncrementPercentageRequest", "DecrementPercentageRequest", 
                                "SetTargetTemperatureRequest", "IncrementTargetTemperatureRequest", "DecrementTargetTemperatureRequest" ];

    if (event.header.namespace !== "Alexa.ConnectedHome.Control" || supportedEventNames.indexOf(event.header.name) === -1 ) {
        console.log("FATAL: Unsupported request name: " + event.header.name);
        context.fail(constructErrorMsg(messageId, "NoSuchTargetError"));
    }

    var applianceId = event.payload.appliance.applianceId;

    if (typeof applianceId !== "string" ) {
        console.log("FATAL: Event applianceId is invalid: ", event);
        context.fail(constructErrorMsg(messageId, "NoSuchTargetError"));
    }

    if (event.header.name === "TurnOnRequest") {          
        setState(applianceId, "ON", function(err,res) {
            if(err) {
              var errorMsg = constructErrorMsg(messageId, err);
              context.done(null,errorMsg);
            } 
            else {
              context.succeed(result);
            }
        });
    } 
    else if (event.header.name === "TurnOffRequest") {
        setState(applianceId, "OFF", function(err, res) {
            if(err) {
              var errorMsg = constructErrorMsg(messageId, err);
              context.done(null,errorMsg);
            } 
            else {
              context.succeed(result);
            }
        });
    }
    else if (event.header.name === "SetPercentageRequest") {
        var targetPercentage =  event.payload.percentageState.value.toFixed();
        setState(applianceId, targetPercentage, function(err, res) {
            if(err) {
              var errorMsg = constructErrorMsg(messageId, err);
              context.done(null, errorMsg);
            } 
            else {
              context.succeed(result);
            }
        });
    }
    else if (event.header.name === "IncrementPercentageRequest") {
        getState(applianceId, function(err, currentPercentage) {
            if (err) {
                var errorMsg = constructErrorMsg(messageId, err);
                context.done(null, errorMsg);
            }
            if(isNaN(currentPercentage)) {
              var errorMsg = constructErrorMsg(messageId, "UNEXPECTED_INFORMATION_RECEIVED");
              context.done(null, errorMsg);
            } 
            else {
                var targetPercentage = +currentPercentage + +event.payload.deltaPercentage.value;
                if(targetPercentage > 100 || targetPercentage < 0) {
                    var errorMsg = constructErrorMsg(messageId, "ValueOutOfRangeError");
                    context.done(null, errorMsg);
                }
                setState(applianceId, targetPercentage, function(err, res) {
                    if(err) {
                      var errorMsg = constructErrorMsg(messageId, err);
                      context.done(null, errorMsg);
                    } 
                    else {
                      context.succeed(result);
                    }
                });
            }
        });
    } 
    else if (event.header.name === "DecrementPercentageRequest") {
        getState(applianceId, function(err, currentPercentage) {
            if (err) {
                var errorMsg = constructErrorMsg(messageId, err);
                context.done(null, errorMsg);
            }
            if(isNaN(currentPercentage)) {
              var errorMsg = constructErrorMsg(messageId, "UNEXPECTED_INFORMATION_RECEIVED");
              context.done(null, errorMsg);
            } 
            else {
                var targetPercentage = currentPercentage - event.payload.deltaPercentage.value;
                if(targetPercentage > 100 || targetPercentage < 0) {
                    var errorMsg = constructErrorMsg(messageId, "ValueOutOfRangeError");
                    context.done(null, errorMsg);
                }
                setState(applianceId, targetPercentage, function(err, res) {
                    if(err) {
                      var errorMsg = constructErrorMsg(messageId, err);
                      context.done(null, errorMsg);
                    } 
                    else {
                      context.succeed(result);
                    }
                });
            }
        });
    }
}

// System, handles health check related requests
function handleSystemEvent(event, context) {
    // TODO always return healthy; currently does not handle unhealthy responses.  Needs detect and handle offline bridge, outdated firmware, etc...
    if(event.header.name === "HealthCheckRequest") {
        var header = {
            "name": "HealthCheckResponse",
            "namespace": "Alexa.ConnectedHome.System",
            "payloadVersion": "2",
            "messageId": event.header.messageId
        };
        var payload = {
            "description": "The system is currently healthy",
            "isHealthy": true
        };
        var result = {
            header: header,
            payload: payload
        };

        context.succeed(result);
    }
    else {
        console.log("ERROR: Unsupported System request: " + event.header.name);
        context.fail("Something went wrong");
    }
}


/******************************* OPENHAB API *******************************/

// Get all OpenHAB items (i.e. during item discovery)
function getItems(callback) {
    var uri = "https://" + address + "/rest/items?type=json";
    
    request({
        "uri": uri,
        "method": "GET",
        "agent": agent,
        "headers": {
            'Authorization': auth
        }
    }, function (err, res) {
        if (err) {
            console.log("There was a fatal error communicating with the HA bridge (during getItems)! ERROR: ", err);
            callback("DriverInternalError");
        } else if (res.statusCode !== 200) {
            callback(statusCodeHelper(res.statusCode));
        } else {
            callback(res.body);
        }
    });
}

// Get state of an OpenHAB item
function getState(itemName, callback) {
    var uri = "https://" + address + "/rest/items/" + itemName + "/state";
    
    request({
        "uri": uri,
        "method": "GET",
        "agent": agent,
        "headers": {
            'Authorization': auth
        }
    }, function (err, res) {
        if (err) {
            console.log("There was a fatal error communicating with the HA bridge (during getState)! ERROR: ", err);
            callback("DriverInternalError");
        } else if (res.statusCode !== 200) {
            callback(statusCodeHelper(res.statusCode));
        } else {
            callback(null, res.body);
        }
    });
}

// Set state of an OpenHAB item
function setState(applianceId, targetState, callback) {
    var uri = "https://" + address + "/rest/items/" + applianceId;
    
    request.post({
        "uri": uri,
        "method": "POST",
        "agent": agent,
        "headers": {
            "Authorization": auth,
            "Content-Type": "text/plain",
            "Content-Length": targetState.length
        },
        "body": targetState.toString()
    }, function(err,res){
        if (err) {
            console.log("There was a fatal error communicating with the HA bridge (during setState)! ERROR: ", err);
            callback("DriverInternalError");
        }
        else if (res.statusCode !== 201) {
            callback(statusCodeHelper(res.statusCode));
        }
        else {
            callback(null,res);
        }
    });
}


/******************************* HELPER FUNCTIONS *******************************/
// Parse JSON Messages
function parseJson(jsonMessage, requestType) {
    try {
        return JSON.parse(jsonMessage);
    } catch (ex) {
        console.log("ERROR: parsing JSON message of type " + requestType + ": ", jsonMessage);
    }
}

// Create error message - consisting of Smart Home API header/payload
function constructErrorMsg(messageId, name) {
    var header = {
        "name": name,
        "namespace": "Alexa.ConnectedHome.Control",
        "payloadVersion": "2",
        "messageId": messageId
    };

    var payload = {};
// TODO - Handle populating payload for:
//  DependentServiceUnavailableError / TargetFirmwareOutdatedError / TargetBridgeFirmwareOutdatedError / UnwillingToSetValueError
    
//    var payload = {
//        "errorInfo": {
//          "code": code,
//          "description": description
//        }
//    };

    var result = {
        "header": header,
        "payload": payload
    };

    return result;
}

// Map OpenHAB HTTP response status codes to Smart Home API error messages
function statusCodeHelper(statusCode) {
// TODO: Smart Home API ERRORS (user) & FAULTS (Skill Adapter):
// ERRORS: TargetOfflineError / NoSuchTargetError / BridgeOfflineError
// FAULTS: DriverInternalError / DependentServiceUnavailableError
//  TargetConnectivityUnstableError / TargetBridgeConnectivityUnstableError / TargetFirmwareOutdatedError / TargetBridgeFirmwareOutdatedError
//  TargetHardwareMalfunctionError / TargetBridgeHardwareMalfunctionError / UnwillingToSetValueError

    if (statusCode === 404) {
        console.log("The target device has not been configured on the bridge! HTTP code: " + statusCode);
        return "NoSuchTargetError";
    }
    else if (statusCode === 401) {
        console.log("The request was not authorized by the bridge! HTTP code: " + statusCode);
        return "DependentServiceUnavailableError";
    }
    else if (statusCode !== 201) {
        console.log("There was an error communicating with the target device! HTTP code: " + statusCode);
        return "TargetConnectivityUnstableError";
    }
    else {
        console.log("An unknown error occured! HTTP code: " + statusCode);
        return "TargetBridgeConnectivityUnstableError";
    }
}
