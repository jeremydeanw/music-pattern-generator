/**
 * MIDI network processor in connector.
 */
export default function createMIDIConnectorIn(specs, my) {
    var that,
        sources = [],
        numSources = 0,
        
        /**
         * Collects data from all processors this input is connected to.
         * @return {Array} MIDI event data from all connected processors.
         */
        getInputData = function() {
            var outputData = [], 
                data = [];
            for (var i = 0; i < numSources; i++) {
                data = sources[i].getOutputData();
                outputData = outputData.concat(data);
                data.length = 0;
            }
            return outputData;
        },
        
        /**
         * Connect a processor as source for this processor.
         * @param  {Object} processor Network MIDI processor.
         */
        addConnection = function(processor) {
            sources.push(processor);
            numSources = sources.length;
            console.log('Connect ' + processor.getType() + ' (id ' + processor.getID() + ') to ' + that.getType() + ' (id ' + that.getID() + ')');
        },
        
        /**
         * Remove a processor as source for this processor.
         * @param  {Object} processor Network MIDI processor.
         */
        removeConnection = function(processor) {
            var n = sources.length;
            while (--n >= 0) {
                if (processor === sources[n]) {
                    sources.splice(n, 1);
                    numSources = sources.length;
                    console.log('Disconnect ' + processor.getType() + ' (id ' + processor.getID() + ') from ' + that.getType() + ' (id ' + that.getID() + ')');
                    break;
                }
            }
        },
        
        /**
         * Get number of connections.
         * Used by the output port module to determine if 
         * @return {Number} Number of connections to this output processor.
         */
        hasInputConnections = function() {
            return numSources > 0;
        };
    
    my = my || {};
    my.getInputData = getInputData;

    that = specs.that || {};
    that.addConnection = addConnection;
    that.removeConnection = removeConnection;
    that.hasInputConnections = hasInputConnections;
    return that;
}