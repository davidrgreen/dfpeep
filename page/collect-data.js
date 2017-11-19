/* global googletag */
var DFPeep = ( function() {
	'use strict';

	window.googletag = window.googletag || {};
	window.googletag.cmd = window.googletag.cmd || [];

	var slots = {}, // slot objects hold arrays of objects, so each refresh of a slot adds to the array
		refreshHistory = [];

	var init = function() {
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
				slotIds: []
			};
			var refreshed = arguments[0];
			for ( var i = 0, length = refreshed.length; i < length; i++ ) {
				refreshData.slotIds.push( refreshed[ i ].getSlotElementId() );
			}
			refreshHistory.push( refreshData );
			sendDataToDevTools( refreshHistory );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var sendDataToDevTools = function( data ) {
		var toSend = {
			from: 'DFPeep',
			data: data
		};
		window.postMessage( toSend, '*' );
	};

	return {
		init: init
	};
} )();
DFPeep.init();
