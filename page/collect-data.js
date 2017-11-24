/* global googletag */
var DFPeep = ( function() {
	'use strict';

	window.googletag = window.googletag || {};
	window.googletag.cmd = window.googletag.cmd || [];

	var wrappedSlotFunctions,
		inited;

	var adData = {
		pageLoadTimestamp: null,
		enabledSingleRequest: [],
		disabledInitialLoad: [],
		slots: {}, // Make each slot an array to contain instance data for each refresh
		refreshes: [],
		pageTargeting: {}
	};

	var init = function() {
		if ( inited ) {
			return;
		}
		inited = 1;
		var timestamp = getTimestamp();
		sendDataToDevTools(
			'newPageLoad',
			{ pageLoadTimestamp: timestamp }
		);
		adData.pageLoadTimestamp = timestamp;
		wrapGPTFunctions();
	};

	var wrapGPTFunctions = function() {
		googletag.cmd.push(
			function() {
				wrapGPTRefresh();
				wrapGPTEnableServices();
				wrapGPTDefineSlot();
				wrapGPTSetTargeting();
				wrapGPTEnableSingleRequest();
				wrapGPTDisplay();
		} );
	};

	var wrapGPTRefresh = function() {
		var oldVersion = googletag.pubads().refresh;
		googletag.pubads().refresh = function() {
			var refreshData = {
				timestamp: getTimestamp(),
				slots: []
			};
			var slotData,
				targetingKeys,
				i, length, t, tlength, slotElementId,
				pageTarget;
			var slotsRefreshed = arguments[0];
			for ( i = 0, length = slotsRefreshed.length; i < length; i++ ) {
				slotElementId = slotsRefreshed[ i ].getSlotElementId();
				slotData = {
					adUnitPath: slotsRefreshed[ i ].getAdUnitPath(),
					elementId: slotElementId,
					targeting: {},
					storedData: adData.slots[ slotElementId ]
				};
				targetingKeys = slotsRefreshed[ i ].getTargetingKeys();
				for ( t = 0, tlength = targetingKeys.length; t < tlength; t++ ) {
					slotData.targeting[ targetingKeys[ t ] ] = slotsRefreshed[ i ].getTargeting( targetingKeys[ t ] );
				}

				for ( pageTarget in adData.pageTargeting ) {
					if ( ! adData.pageTargeting.hasOwnProperty( pageTarget ) ) {
						continue;
					}

					slotData.targeting[ pageTarget ] = adData.pageTargeting[ pageTarget ];
				}

				refreshData.slots.push( slotData );
			}
			adData.refreshes.push( refreshData );
			sendDataToDevTools( 'GPTRefresh', refreshData );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var wrapGPTDisableInitialLoad = function() {
		var oldVersion = googletag.pubads().disabledInitialLoad;
		googletag.pubads().disabledInitialLoad = function() {
			var timestamp = getTimestamp();
			adData.disabledInitialLoad.push( timestamp );
			sendDataToDevTools( 'GPTDisableInitialLoad', { time: timestamp } );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var wrapGPTEnableSingleRequest = function() {
		var oldVersion = googletag.pubads().enableSingleRequest;
		googletag.pubads().enableSingleRequest = function() {
			var timestamp = getTimestamp();
			adData.enabledSingleRequest.push( timestamp );
			sendDataToDevTools( 'GPTEnableSingleRequest', { time: timestamp } );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var wrapGPTSetTargeting = function() {
		var oldVersion = googletag.pubads().setTargeting;
		googletag.pubads().setTargeting = function() {
			adData.pageTargeting[ arguments[0] ] = arguments[1];
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var wrapGPTEnableServices = function() {
		var oldVersion = googletag.enableServices;
		googletag.enableServices = function() {
			sendDataToDevTools( 'GPTEnableServices', { time: getTimestamp() } );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var sendSlotDataToDevTools = function( slotName, data ) {
		sendDataToDevTools( 'slotData', { name: slotName, data: data } );
	};

	var wrapGPTDisplay = function() {
		var oldVersion = googletag.display;
		googletag.display = function() {
			var elementId = arguments[0];
			if ( ! adData.slots[ elementId ] ) {
				adData.slots[ elementId ] = {};
			}
			adData.slots[ elementId ].displayCallTimestamp = getTimestamp();
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var wrapGPTDefineSlot = function() {
		var oldDefineVersion = googletag.defineSlot;
		googletag.defineSlot = function() {
			console.log( 'defined slot with following arguments:' );
			console.log( arguments );
			// sendDataToDevTools( 'GPTEnableServices', { time: getTimestamp() } );
			var definedSlot = oldDefineVersion.apply( this, arguments );
			var elementId = definedSlot.getSlotElementId();
			if ( ! adData.slots[ elementId ] ) {
				adData.slots[ elementId ] = {};
			}
			if ( ! wrappedSlotFunctions ) {
				wrappedSlotFunctions = 1;
				var proto = Object.getPrototypeOf( definedSlot );

				// googletag.Slot.setTargeting
				( function( obPrototype ) {
					var oldVersion = obPrototype.setTargeting;
					obPrototype.setTargeting = function() {
						// sendDataToDevTools( 'GPTEnableServices', { time: getTimestamp() } );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End googletag.Slot.setTargeting

				// googletag.Slot.defineSizeMapping
				( function( obPrototype ) {
					var oldVersion = obPrototype.defineSizeMapping;
					obPrototype.defineSizeMapping = function() {
						var slotElement = this.getSlotElementId();
						if ( ! adData.slots[ slotElement ].sizeMappings ) {
							adData.slots[ slotElement ].sizeMappings = [ arguments[0] ];
						} else {
							adData.slots[ slotElement ].sizeMappings.push( arguments[0] );
						}
						sendSlotDataToDevTools( slotElement, adData.slots[ slotElement ] );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End googletag.Slot.defineSizeMapping
			}
			return definedSlot;
		};
	};

	var sendDataToDevTools = function( action, data ) {
		var toSend = {
			from: 'DFPeep',
			action: action,
			data: data
		};
		window.postMessage( toSend, '*' );
	};

	var getTimestamp = function() {
		return Math.floor( Date.now() );
	};

	var getAdData = function() {
		return adData;
	};

	return {
		init: init,
		getAdData: getAdData
	};
} )();
DFPeep.init();
