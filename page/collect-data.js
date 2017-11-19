var DFPeep = ( function() {
	'use strict';

	window.googletag = window.googletag || {};
	window.googletag.cmd = window.googletag.cmd || [];

	var slots = {},
		refreshHistory = [];

	var init = function() {
		console.log( 'init' );
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
			console.log( refreshHistory );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	return {
		init: init
	};
} )();
DFPeep.init();
