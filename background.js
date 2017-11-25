/* global chrome */
var contentPorts = [],
	panelPorts = [];

chrome.runtime.onConnect.addListener( function ( port ) {
	if ( 'DFPeepFromContent' !== port.name ) {
		return;
	}
	contentPorts.push( port );
	console.log('connected to content script' );
	port.postMessage( {message: 'message back from new port with background page'} );
	var extensionListener = function( message, sender, sendResponse ) {
		console.log( 'background page received:' );
		console.log( message );
		var i = contentPorts.indexOf( port );
		panelPorts[ i ].postMessage( message );
		// port.postMessage( message );
	};

	// Listens to messages sent from the content
	port.onMessage.addListener( extensionListener );

	port.onDisconnect.addListener( function( port ) {
		port.onMessage.removeListener( extensionListener );
		var i = contentPorts.indexOf( port );
		if ( -1 !== i ) {
			contentPorts.splice( i, 1 );
			panelPorts.splice( i, 1 );
		}
	} );
} );

chrome.extension.onConnect.addListener( function( port ) {
	if ( 'DFPeepFromPanel' !== port.name ) {
		return;
	}
	panelPorts.push( port );
	console.log( 'established connection with panel' );
	console.log( panelPorts[ panelPorts.length - 1 ] );

	var extensionListener = function( message, sender, sendResponse ) {
		// Sent from panel.
		console.log( 'background page heard from panel' );
		console.log( message );
		var i = panelPorts.indexOf( port );
		contentPorts[ i ].postMessage( { data:'your panel rang' } );
	};

	// Listens to messages sent from the panel
	port.onMessage.addListener( extensionListener );

	port.onDisconnect.addListener( function( port ) {
		port.onMessage.removeListener( extensionListener );
		var i = panelPorts.indexOf( port );
		if ( -1 !== i ) {
			panelPorts.splice( i, 1 );
			contentPorts.splice( i, 1 );
		}
	} );
} );
