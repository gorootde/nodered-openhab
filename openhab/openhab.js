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
  RED.httpAdmin.get('/openhab/*', function(req, res) {
    var options = {
      root: __dirname + '/static/',
      dotfiles: 'deny'
    };
    res.sendFile(req.params[0], options);
  });


  //*************** Input Node ***************
  function OpenhabItemIn(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    this.server = RED.nodes.getNode(config.server);
    var usesimpleitem = config.simpleitem;
    var filter = config.filter;

    RED.httpAdmin.get("/openhab-input/itemlist", RED.auth.needsPermission('ohinput.read'), function(req, res) {
      node.server.getItemsList(function(items) {
        res.json(items);
      });
    });

    var es = node.server.connectToEventSource()


    node.status({
      fill: "green",
      shape: "dot",
      text: "online"
    });

    es.onmessage = function(msg) {
      var event = JSON.parse(msg.data);

      node.log("received openhab event '"+event.type+"' for topic " + event.topic);
      try {
        event.payload = JSON.parse(event.payload);
      } catch (e) {
        node.warn("Event-payload '" + event.payload + "' could not be parsed as JSON");
      }
      var regex = /(items|things)\/(.+)\/(.+)/g;
      var matches = regex.exec(event.topic);
      if (matches) {
        var simpleItemName = matches[2];
        if (usesimpleitem) {
          event.topic = simpleItemName;
        }
      

        var doSend = true;
        if (filter && filter.constructor === Array) {
          var isValid = filter.indexOf(simpleItemName) !== -1;
          doSend = isValid;
        }

        if (doSend) {
          node.send(event);
        }
      }
    }
    es.onerror = function(err) {
      node.status({
        fill: "red",
        shape: "dot",
        text: "Error"
      });
      node.error(err);
    }

  }
  RED.nodes.registerType("openhab-input", OpenhabItemIn);


  //*************** State Output Node ***************
  function OpenhabOut(config) {
    RED.nodes.createNode(this, config);
    this.itemname = config.itemname === "msg.topic" ? undefined : config.itemname;
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
      var url = "items/" + itemname;
      var options = {
        headers: {
          "Content-Type": "text/plain"
        },
        method: "POST",
        body: msg.payload
      };

      if (node.type === "state") {
        url += "/state";
        options.method = 'PUT';
      }

      node.server.doRequest(url, options, function(error, response, body) {
        if (error) {
          node.error(error);
          node.status({
            fill: "red",
            shape: "dot",
            text: "Error: " + error.status
          });
        } else if (response.statusCode !== 200) {
          node.error(response);
          node.status({
            fill: "red",
            shape: "dot",
            text: "Error: HTTP " + response.statusCode
          });
        } else {
          node.log(body);
          node.status({
            fill: "green",
            shape: "dot",
            text: "Sent!"
          });
        }
        setTimeout(function() {
          node.status({});
        }, 1000);

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
    this.rejectUnauthorized = !n.allowuntrusted;

    this.connectToEventSource = function() {
      var EventSource = require("eventsource");
      var eventSourceInitDict = {
        rejectUnauthorized: node.rejectUnauthorized
      };
      var url = node.getUrl() + "events";
      node.log("Connecting to URL " + url);
      var es = new EventSource(url, eventSourceInitDict);
      return es;
    }

    this.doRequest = function(urlpart, options, callback) {
      options.rejectUnauthorized = node.rejectUnauthorized;
      options.uri = node.url + urlpart;
      node.log("Requesting URI " + options.uri + " with method " + options.method);
      request(options, callback);
    }

    this.getUrl = function() {
      return node.url;
    };

    this.getItemsList = function(callback) {
      var options = {
        method: 'GET',
        json: true,
        rejectUnauthorized: false,
      }
      node.doRequest("items", options, function(error, response, body) {

        if (error) {
          node.error(error);
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
