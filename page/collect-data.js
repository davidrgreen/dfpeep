/* global googletag */
var DFPeep = ( function() {
	'use strict';

	window.googletag = window.googletag || {};
	window.googletag.cmd = window.googletag.cmd || [];

	var slots = {}, // slot objects hold arrays of objects, so each refresh of a slot adds to the array
		refreshHistory = [],
		wrappedSlotFunctions;

	var adData = {
		pageLoadTimestamp: null,
		disabledInitialLoad: [],
		slots: {},
		refreshHistory: []
	};

	var init = function() {
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
				i, length, t, tlength, slotElementId;
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

				refreshData.slots.push( slotData );
			}
			adData.refreshHistory.push( refreshData );
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
			// sendDataToDevTools( 'GPTDisableInitialLoad', { time: timestamp } );
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
						// console.log( 'setTargeting called' );
						// console.log( arguments );
						// console.log( 'Called by ' + this.getAdUnitPath() );
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
						// sendDataToDevTools( 'GPTEnableServices', { time: getTimestamp() } );
						console.log( 'defineSizeMapping called' );
						console.log( arguments );
						console.log( 'Called by ' + slotElement );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End // googletag.Slot.defineSizeMapping
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

	return {
		init: init
	};
} )();
DFPeep.init();
