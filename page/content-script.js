/**
 * Inserts assets into page. Passes messages from page to background script.
 *
 * @since 0.1.0
 * @package DFPeep
 * @copyright 2017 David Green <https://davidrg.com>
 * @license MIT
 */

/* global chrome */

var debug = 0;

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
	img.src = chrome.extension.getURL( 'img/dfpeep-chicken.svg' );
}

function init() {
	injectJS( chrome.extension.getURL( 'page/page.js' ) );
	preloadImages();
}
init();

/**
 * Listen for messages from the page and send it along to the background page
 * to pass to the panel.
 */
window.addEventListener( 'message', function( event ) {
	if ( window !== event.source ) {
		return;
	}

	if ( event.data.from && 'DFPeep' === event.data.from ) {
		if ( debug ) {
			console.log( 'Content script received message: ' );
			console.log( event.data );
		}
		DFPort.postMessage( { payload: event.data } );
	}
} );

var DFPort = chrome.runtime.connect( { name: 'DFPeepFromContent' } );
DFPort.onMessage.addListener(
	function( message, sender ) {
		if ( debug ) {
			console.log( 'content script got message from panel:' );
			console.log( message );
		}
		var toSend = {
			from: 'DFPeepFromPanel'
		};
		if ( message.action ) {
			toSend.action = message.action;
		}
		if ( message.data ) {
			toSend.data = message.data;
		}
		window.postMessage( toSend, '*' );
	}
);
