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
				slotIds: []
			};
			var refreshed = arguments[0];
			for ( var i = 0, length = refreshed.length; i < length; i++ ) {
				refreshData.slotIds.push( refreshed[ i ].getSlotElementId() );
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
