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
            node.send(JSON.parse(msg.data));
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
    /*function OpenhabStateOut(config) {
        RED.nodes.createNode(this, config);

    }
    RED.nodes.registerType("openhab-output-state", OpenhabStateOut);
*/

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
