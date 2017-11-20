/**
 * Insert a script into the page.
 */
function injectJS( link ) {
	var script = document.createElement( 'script' );
	script.type = 'text/javascript';
	script.src = link;
	document.documentElement.appendChild( script );
}

injectJS( chrome.extension.getURL( 'page/collect-data.js' ) );

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
		port.postMessage( { payload: event.data } );
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


var port = chrome.runtime.connect( { name: 'DFPeepFromContent' } );
port.onMessage.addListener( function( message, sender ) {
} );
