/**
 * Listens to messages from content scripts and panel scripts using long-running
 * ports. Directs messages between them appropriately. Messages flow from
 * in-page to contet script to background page to panel and back.
 *
 * @since 0.1.0
 * @package DFPeep
 * @copyright 2017 David Green
 * @license MIT
 */

/* global chrome */
var contentPorts = {},
	panelPorts = {},
	debug = 1; // If 1 then enable console logs.

chrome.runtime.onConnect.addListener( function( port ) {
	if ( 'DFPeepFromContent' !== port.name ) {
		return;
	}
	var tabId = port.sender.tab.id;
	contentPorts[ tabId ] = port;
	if ( debug ) {
		console.log('connected to content script' );
		console.log( port );
	}
	port.postMessage( {message: 'message back from new port with background page'} );
	var extensionListener = function( message, sender, sendResponse ) {
		if ( debug ) {
			console.log( 'background page received:' );
			console.log( sender );
			console.log( message );
		}
		if ( panelPorts[ sender.sender.tab.id ] ) {
			panelPorts[ sender.sender.tab.id ].postMessage( message );
		}
	};

	// Listens to messages sent from the content
	port.onMessage.addListener( extensionListener );

	port.onDisconnect.addListener( function( port ) {
		port.onMessage.removeListener( extensionListener );
		var tabId = port.sender.tab.id;
		if ( contentPorts[ tabId ] ) {
			delete contentPorts[ tabId ];
		}
	} );
} );

chrome.extension.onConnect.addListener( function( port ) {
	if ( 'DFPeepFromPanel' !== port.name ) {
		return;
	}
	if ( debug ) {
		console.log( port );
		console.log( 'established connection with panel' );
	}
	chrome.tabs.query(
		{ active: true, currentWindow: true },
		function( tabs ) {
			var currentTab = tabs[0];
			panelPorts[ currentTab.id ] = port;

		}
	);


	var extensionListener = function( message, sender, sendResponse ) {
		// Sent from panel, pass along to content script.

		if ( debug ) {
			console.log( 'background page heard from panel' );
			console.log( message );
		}
		var tabId;
		if ( sender.sender.tab && sender.sender.tab.id ) {
			tabId = sender.sender.tab.id;
			if ( contentPorts[ tabId ] ) {
				contentPorts[ tabId ].postMessage( message );
			}
		} else {
			// NOTE: This may be a bad idea because if the panel passively sends
			// a request on a timeout then the user may have changed to another
			// tab, resulting in the messaging going the wrong page.
			// Right now with what I need it should be fine.
			chrome.tabs.query(
				{ active: true, currentWindow: true },
				function( tabs ) {
					tabId = tabs[0].id;
					if ( contentPorts[ tabId ] ) {
						contentPorts[ tabId ].postMessage( message );
					}
				}
			);
		}
	};

	// Listens to messages sent from the panel
	port.onMessage.addListener( extensionListener );

	port.onDisconnect.addListener( function( port ) {
		if ( debug ) {
			console.log( 'disconnecting panel' );
			console.log( port );
		}
		port.onMessage.removeListener( extensionListener );
		chrome.tabs.query(
			{ active: true, currentWindow: true },
			function( tabs ) {
				var currentTab = tabs[0];
				if ( panelPorts[ currentTab.id ] ) {
					delete panelPorts[ currentTab.id ];
				}
			}
		);
	} );
} );
