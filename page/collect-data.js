var DFPeep = ( function() {
	'use strict';

	window.googletag = window.googletag || {};
	window.googletag.cmd = window.googletag.cmd || [];

	var slots = {};

	var init = function() {
		console.log( 'init' );
	};

	return {
		init: init
	};
} )();
DFPeep.init();
