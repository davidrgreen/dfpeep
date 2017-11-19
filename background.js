var contentPort;
chrome.runtime.onConnect.addListener(function (port) {
	if ( 'DFPeepFromContent' !== port.name ) return;
	contentPort = port;
	console.log('connected to content script' );
	port.postMessage( {message: 'message back from new port with background page'} );
	var extensionListener = function (message, sender, sendResponse) {
		console.log( 'background page received:' );
		console.log( message );
		if ( panelPort ) {
			console.log( 'panel exists' );
			panelPort.postMessage( message );
		}
		// port.postMessage( message );
	}

	// Listens to messages sent from the content
	port.onMessage.addListener(extensionListener);

	port.onDisconnect.addListener(function(port) {
		port.onMessage.removeListener(extensionListener);
	});

});

var panelPort;
chrome.extension.onConnect.addListener(function (port) {
	if ( 'DFPeepFromPanel' !== port.name ) return;
	panelPort = port;
	console.log( 'established connection with panel' );
	console.log( panelPort );

	var extensionListener = function (message, sender, sendResponse) {
		// Sent from panel.
		console.log( 'background page heard from panel' );
		console.log( message );
		port.postMessage({data:'heard ya panel'});
	}

	// Listens to messages sent from the panel
	port.onMessage.addListener(extensionListener);

	port.onDisconnect.addListener(function(port) {
		port.onMessage.removeListener(extensionListener);
	});

});