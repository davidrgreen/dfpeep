/* global chrome */

/**
 * Insert a script into the page.
 */
function injectJS( link ) {
	var script = document.createElement( 'script' );
	script.type = 'text/javascript';
	script.src = link;
	document.documentElement.appendChild( script );
}

function preloadImages() {
	var img = document.createElement( 'img' );
	img.src = chrome.extension.getURL( 'img/dfpeep.png' );
}

function init() {
	injectJS( chrome.extension.getURL( 'page/collect-data.js' ) );
	preloadImages();
}
init();

/**
 * Listen for messages from the page.
 */
window.addEventListener( 'message', function( event ) {
	if ( window !== event.source ) {
		return;
	}

	if ( event.data.from && 'DFPeep' === event.data.from ) {
		console.log( 'Content script received message: ' );
		console.log( event.data );
		DFPort.postMessage( { payload: event.data } );
		// chrome.runtime.sendMessage({greeting: "hello"}, function(response) {
			// console.log(response.farewell);
		//   });
	}
} );

/**
 * Send message to panel.
 */
// chrome.runtime.sendMessage({greeting: "hello"}, function(response) {
// 	// console.log(response.farewell);
//   });


var DFPort = chrome.runtime.connect( { name: 'DFPeepFromContent' } );
DFPort.onMessage.addListener(
	function( message, sender ) {
		console.log( 'content script got message from panel:' );
		console.log( message );
		var toSend = {
			from: 'DFPeepFromPanel',
			data: message
		};
		window.postMessage( toSend, '*' );
	}
);
