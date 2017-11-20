/* global googletag */
var DFPeep = ( function() {
	'use strict';

	window.googletag = window.googletag || {};
	window.googletag.cmd = window.googletag.cmd || [];

	var slots = {}, // slot objects hold arrays of objects, so each refresh of a slot adds to the array
		refreshHistory = [];

	var init = function() {
		sendDataToDevTools( 'newPageLoad', {} );
		wrapGPTFunctions();
	};

	var wrapGPTFunctions = function() {
		googletag.cmd.push(
			function() {
				wrapGPTRefresh();
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
				i, length, t, tlength;
			var slotsRefreshed = arguments[0];
			for ( i = 0, length = slotsRefreshed.length; i < length; i++ ) {
				slotData = {
					adUnitPath: slotsRefreshed[ i ].getAdUnitPath(),
					elementId: slotsRefreshed[ i ].getSlotElementId(),
					targeting: {}
				};
				targetingKeys = slotsRefreshed[ i ].getTargetingKeys();
				for ( t = 0, tlength = targetingKeys.length; t < tlength; t++ ) {
					slotData.targeting[ targetingKeys[ t ] ] = slotsRefreshed[ i ].getTargeting( targetingKeys[ t ] );
				}

				refreshData.slots.push( slotData );
			}
			refreshHistory.push( refreshData );
			sendDataToDevTools( 'GPTRefresh', refreshData );
			var result = oldVersion.apply( this, arguments );
			return result;
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
