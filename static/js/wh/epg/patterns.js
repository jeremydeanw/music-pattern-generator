/**
 * @description Patterns modele.
 * @author Wouter Hisschemöller
 * @version 0.0.0
 * 
 * @namespace WH.epg
 */
 
 window.WH = window.WH || {};
 window.WH.epg = window.WH.epg || {};

(function (ns) {
    
    function createPatternData(specs) {
        specs = specs || {};
        
        var that = {
            // euclidean settings
            steps: specs.steps || 16,
            pulses: specs.pulses || 4,
            rotation: specs.rotation || 0,
            euclidPattern: [],
            
            // midi settings
            channel: specs.channel || 0,
            
            // misc settings
            name: specs.name || '',
            
            // position and duration in ticks
            position: specs.position || 0,
            duration: specs.duration || 0,
            
            isOn: false,
            isSelected: false,
            
            offPosition: 0,
            lastPosition: 0,
            
            // canvas position and size
            canvasX: specs.canvasX || 0,
            canvasY: specs.canvasY || 0,
            canvasWidth: 0,
            canvasHeight: 0
        };
        
        return that;
    }
    
    function createPatterns(specs) {
        var that,
            arrangement = specs.arrangement,
            patternCanvas = specs.patternCanvas,
            patternSettings = specs.patternSettings,
            file = specs.file,
            patterns = [],
            numPatterns = patterns.length,
            selectedPattern,
            
            /**
             * Create a Euclidean step sequence from a pattern's steps and fills data.
             * @param {Array} euclidPattern Array of 0 and 1 values indicating pulses or silent steps.
             * @return {Array} Data objects to create arrangement steps with.
             */
            createArrangementSteps = function(euclidPattern) {
                var i,
                    numSteps = euclidPattern.length,
                    steps = [],
                    stepDuration = Math.floor( WH.conf.getPPQN() / WH.conf.getStepsPerBeat() );
                for (i = 0; i < numSteps; i++) {
                    steps.push({
                        pitch: 60,
                        velocity: !!euclidPattern[i] ? 100 : 0,
                        start: stepDuration * i,
                        duration: stepDuration
                    });
                }
                return steps;
            },
            
            /**
             * Create Euclidean rhythm pattern.
             * Code from withakay/bjorklund.js
             * @see https://gist.github.com/withakay/1286731
             */
            createBjorklund = function(steps, pulses) {
                var pattern = [],
                    counts = [],
                	remainders = [],
                	divisor = steps - pulses,
                	level = 0;
                
            	steps = Math.round(steps);
            	pulses = Math.round(pulses);
                remainders.push(pulses);

            	if (pulses > steps || pulses == 0 || steps == 0) {
            		return new Array();
            	}
                
            	while(true) {
            		counts.push(Math.floor(divisor / remainders[level]));
            		remainders.push(divisor % remainders[level]);
            		divisor = remainders[level]; 
            	    level += 1;
            		if (remainders[level] <= 1) {
            			break;
            		}
            	}
            	
            	counts.push(divisor);

            	var r = 0;
            	var build = function(level) {
            		r++;
            		if (level > -1) {
            			for (var i=0; i < counts[level]; i++) {
            				build(level-1); 
            			}	
            			if (remainders[level] != 0) {
            	        	build(level-2);
            			}
            		} else if (level == -1) {
            	           pattern.push(0);	
            		} else if (level == -2) {
                       pattern.push(1);        
            		} 
            	};

            	build(level);
            	return pattern.reverse();
            }, 
            
            /**
             * Create a pattern and add it to the list.
             */
            createPattern = function(specs) {
                specs = specs || {};
                specs.channel = patterns.length;
                var patternData = createPatternData(specs),
                    euclidPattern,
                    arrangementSteps;
                
                patterns.push(patternData);
                numPatterns = patterns.length;
                
                arrangement.createTrack()
                updatePattern(patternData);
                
                // selectPattern will also redraw the canvas
                selectPattern(patternData);
                file.autoSave();
            },
            
            /**
             * Update the pattern if one of the Euclidean settings have changed.
             * @param {Object} ptrn Pattern data object.
             */
            updatePattern = function(ptrn) {    
                var ptrnIndex = patterns.indexOf(ptrn),
                    euclidPattern = createBjorklund(ptrn.steps, ptrn.pulses),
                    elementsToShift = euclidPattern.splice(euclidPattern.length - ptrn.rotation),
                    arrangementSteps;
                
                euclidPattern = elementsToShift.concat(euclidPattern);
                console.log(euclidPattern);
                
                ptrn.euclidPattern = euclidPattern;
                ptrn.duration = (ptrn.steps / WH.conf.getStepsPerBeat()) * WH.conf.getPPQN();
                
                // create arrangement steps from euclidean pattern
                arrangementSteps = createArrangementSteps(euclidPattern);
                console.log('updatePattern, patterns: ', patterns, ', ptrnIndex: ', ptrnIndex);
                arrangement.updateTrack(ptrnIndex, arrangementSteps);
                file.autoSave();
            },
            
            selectPattern = function(ptrn) {
                var i,
                    index = patterns.indexOf(ptrn);
                
                for (i = 0; i < numPatterns; i++) {
                    patterns[i].isSelected = (i === index);
                }
                
                selectedPattern = ptrn;
                
                // update view
                patternCanvas.drawB(patterns);
                patternSettings.setPattern(selectedPattern);
            },
            
            deleteSelectedPattern = function() {
                if (!selectedPattern) {
                    return;
                }
                
                var index = patterns.indexOf(selectedPattern);
                
                // remove track from arrangement
                arrangement.deleteTrack(index);
                
                // find and delete patternData
                patterns.splice(index, 1);
                numPatterns = patterns.length;
                console.log('deleteSelectedPattern, patterns: ', patterns, ', index: ', index);
                // selectPattern will also redraw the canvas
                selectPattern(null);
                file.autoSave();
            },
            
            /**
             * Get pattern occupying a given coordinate on the canvas.
             * @return {Object} Pattern data object.
             */
            getPatternByCoordinate = function(x, y) {
                var i, ptrn;
                for (i = 0; i < numPatterns; i++) {
                    ptrn = patterns[i]
                    if (x >= ptrn.canvasX && x <= ptrn.canvasX + ptrn.canvasWidth &&
                        y >= ptrn.canvasY && y <= ptrn.canvasY + ptrn.canvasHeight) {
                        return ptrn;
                    }
                }
            },
            
            /**
             * Update the value of a single property of the selected pattern.
             * @param {String} name Property name.
             * @param {Number} value Property value.
             */
            setPatternProperty = function(name, value) {
                switch (name) {
                    case 'steps':
                        value = Math.min(value, 64);
                        selectedPattern[name] = value;
                        if (selectedPattern.pulses > value) {
                            selectedPattern.pulses = value;
                            patternSettings.updateSetting('pulses', value);
                        }
                        if (selectedPattern.rotation > value) {
                            selectedPattern.rotation = value;
                            patternSettings.updateSetting('rotation', value);
                        }
                        updatePattern(selectedPattern);
                        patternSettings.updateSetting(name, value);
                        patternCanvas.drawB(patterns);
                        break;
                    case 'pulses':
                    case 'rotation':
                        value = Math.min(value, selectedPattern.steps);
                        selectedPattern[name] = value;
                        updatePattern(selectedPattern);
                        patternSettings.updateSetting(name, value);
                        patternCanvas.drawB(patterns);
                        break;
                    case 'canvasX':
                    case 'canvasY':
                        selectedPattern[name] = value;
                        patternCanvas.drawB(patterns);
                        break;
                    case 'name':
                        selectedPattern[name] = value;
                        patternSettings.updateSetting(name, value);
                        patternCanvas.drawB(patterns);
                        break;
                }
                
                file.autoSave();
            },

            /**§
             * Create an pattern data from data object.
             * @param {Object} data Data object.
             */
            setData = function(data) {
                patterns = data.patterns;
                numPatterns = patterns.length;
                selectedPattern = patterns.filter(function(ptrn){
                    return ptrn.isSelected;
                })[0];
                
                patternSettings.setPattern(selectedPattern);
                refreshCanvas();
            },

            /**
             * Collect all project data and save it in localStorage.
             */
            getData = function() {
                return {
                    patterns: patterns
                };
            },
            
            /**
             * Update pattern data and view while transport runs.
             * @param {Number} transportPosition Playhead position in ticks.
             */
            onTransportRun = function(transportPosition) {
                var i,
                    pattern;
                for (i = 0; i < numPatterns; i++) {
                    ptrn = patterns[i];
                    ptrn.position = transportPosition % ptrn.duration;
                    
                    if (ptrn.isOn && ptrn.lastPosition <= ptrn.offPosition && ptrn.position >= ptrn.offPosition) {
                        ptrn.isOn = false;
                    }
                    
                    ptrn.lastPosition = ptrn.position;
                }
                patternCanvas.drawA(patterns);
            },
            
            onTransportScan = function(playbackQueue) {
                var i,
                    numSteps = playbackQueue.length;
                for (i = 0; i < numSteps; i++) {
                    var step = playbackQueue[i],
                        ptrn = patterns[step.getTrackIndex()];
                    
                    if (step.getVelocity()) {
                        ptrn.isOn = true;
                        ptrn.offPosition = (ptrn.position + step.getDuration()) % ptrn.duration;
                    }
                }
            },
            
            /**
             * Redraw both canvasses.
             */
            refreshCanvas = function() {
                patternCanvas.drawA(patterns);
                patternCanvas.drawB(patterns);
            };
        
        that = specs.that;
        
        that.createPattern = createPattern;
        that.selectPattern = selectPattern;
        that.getPatternByCoordinate = getPatternByCoordinate;
        that.deleteSelectedPattern = deleteSelectedPattern;
        that.setPatternProperty = setPatternProperty;
        that.setData = setData;
        that.getData = getData;
        that.onTransportRun = onTransportRun;
        that.onTransportScan = onTransportScan;
        that.refreshCanvas = refreshCanvas;
        return that;
    }

    ns.createPatterns = createPatterns;

})(WH.epg);
