//
//     Copyright (C) 2017  Michael Kolb
//
//     This program is free software: you can redistribute it and/or modify
//     it under the terms of the GNU General Public License as published by
//     the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.
//
//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU General Public License for more details.
//
//     You should have received a copy of the GNU General Public License
//     along with this program.  If not, see <http://www.gnu.org/licenses/>.

var request = require('request');


module.exports = function(RED) {

    //*************** Input Node ***************
    function OpenhabItemIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.server = RED.nodes.getNode(config.server);
        var usesimpleitem = config.simpleitem;

        var EventSource = require("eventsource");
        var eventSourceInitDict = {
            rejectUnauthorized: false
        };

        var url = this.server.getEventsourceUrl();
        console.log("Connecting to URL " + url)
        var es = new EventSource(url, eventSourceInitDict);
        node.status({
            fill: "green",
            shape: "dot",
            text: "online"
        });

        es.onmessage = function(msg) {
            var event = JSON.parse(msg.data);

            if (usesimpleitem) {
                var regex = /items\/(.+)\/(.+)/g;
                var matches = regex.exec(event.topic);
                event.topic = matches[1];
            }
            node.send(event);
        }
        es.onerror = function(err) {
            node.status({
                fill: "red",
                shape: "dot",
                text: "Error"
            });
            console.log("ERROR!");
            console.log(err);
        }

    }
    RED.nodes.registerType("openhab-input", OpenhabItemIn);


    //*************** State Output Node ***************
    function OpenhabOut(config) {
        RED.nodes.createNode(this, config);
        this.itemname = config.itemname;
        this.server = RED.nodes.getNode(config.server);
        var node = this;
        this.type = config.type;

        RED.httpAdmin.get("/openhab-output/itemlist", RED.auth.needsPermission('ohoutput.read'), function(req, res) {
            node.server.getItemsList(function(items) {
                res.json(items);
            });
        });


        this.on('input', function(msg) {
            var itemname = node.itemname || msg.topic;
            var options = {
                rejectUnauthorized: false,
                headers: {
                  "Content-Type": "text/plain"
                },
                uri: node.server.getUrl() + "items/" + itemname,
                method: "POST",
                body: msg.payload
            };

            if (node.type === "state") {
                options.uri += "/state";
                options.method = 'PUT';
            }
            console.log(options);

            request(options, function(error, response, body) {
                if (error) {
                  console.log(error);
                  node.status({
                      fill: "red",
                      shape: "dot",
                      text: "Error: "+error.status
                  });
                } else if(response.statusCode !== 200){
                  console.log(response);
                  node.status({
                      fill: "red",
                      shape: "dot",
                      text: "Error: HTTP "+response.statusCode
                  });
                } else {
                  console.log(body);
                  node.status({
                      fill: "green",
                      shape: "dot",
                      text: "Sent!"
                  });

                }
            });
        });
    }
    RED.nodes.registerType("openhab-output", OpenhabOut);

    //*************** Server Node ***************
    function OpenhabServerNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.url = n.url;
        this.name = n.name;


        this.getUrl = function() {
            return this.url;
        };

        this.getEventsourceUrl = function() {
            return node.getUrl() + "events";
        };

        this.getItemsList = function(callback) {
            var options = {
                url: node.url + "items",
                method: 'GET',
                json: true,
                rejectUnauthorized: false,
            }
            request(options, function(error, response, body) {

                if (error) {
                    console.log(error);
                    callback(null);
                } else {
                    callback(body.sort(function(a, b) {
                        var nameA = a.name.toLowerCase(),
                            nameB = b.name.toLowerCase();
                        if (nameA < nameB) //sort string ascending
                            return -1;
                        if (nameA > nameB)
                            return 1;
                        return 0; //default return value (no sorting)
                    }));

                }


            });
        }
    }
    RED.nodes.registerType("openhab-server", OpenhabServerNode);
}
