module.exports = function(RED) {

    //*************** Input Node ***************
    function OpenhabItemIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.server = RED.nodes.getNode(config.server);


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

            var message = {
                raw: event,

            };
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
        this.server = RED.nodes.getNode(config.server);
        var node = this;
        this.type = config.type;
        // this.on('input', function(msg) {
        //     var options = {
        //         url: url,
        //         method: "POST",
        //         json: msg.payload
        //     };
        //     var url = server.getUrl() + "items/" + msg.topic;
        //     if (type === "state") {
        //         url += "/state";
        //         options.method = 'PUT';
        //     }
        //
        //
        //     request(options, function(error, response, body) {
        //         if (error) {
        //             console.log(error);
        //             node.status({
        //                 fill: "green",
        //                 shape: "dot",
        //                 text: "Sent!"
        //             });
        //         } else {
        //             console.log(body);
        //             node.status({
        //                 fill: "red",
        //                 shape: "dot",
        //                 text: "Error!"
        //             });
        //         }
        //     });
        // });
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

        this.getItemsList = function() {
            var options = {
                url: node.url,
                method: 'GET',
                json: true
            }
            request(options, function(error, response, body) {
                if (error) console.log(error);
                else console.log(body);
            });
        }
    }
    RED.nodes.registerType("openhab-server", OpenhabServerNode);
}
