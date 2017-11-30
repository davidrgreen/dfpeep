/**
 * Create the DFPeep dev tools panel and establish port connection with
 * background script.
 *
 * @since 0.1.0
 * @package DFPeep
 * @copyright 2017 David Green
 * @license MIT
 */

/* global chrome */

chrome.devtools.panels.create(
	'DFPeep',
	'', // Icon location.
	'devtools/panel/panel.html',
	function( extensionPanel ) {
		var panelWindow; // Reference to the panel's window object.

		var data = [];
		var port = chrome.runtime.connect( { name: 'DFPeepFromPanel'} );
		console.log( 'dev panel created new port' );
		console.log( port );
		port.onMessage.addListener( function( msg ) {
			// Write information to the panel, if exists.
			// If we don't have a panel reference (yet), queue the data.
			if ( panelWindow ) {
				panelWindow.handleIncomingMessage( msg );
			} else {
				data.push( msg );
			}
		});

		extensionPanel.onShown.addListener( function firstRun( _window ) {
			// Remove to show only once.
			extensionPanel.onShown.removeListener( firstRun );

			port.postMessage( { action: 'sync' } );

			panelWindow = _window;
			panelWindow.backgroundPort = port;
			panelWindow.changeScreen( 'init' );

			// Add a function to the panel to easily send a message
			// back to the background page.
			panelWindow.sendToBackground = function( msg ) {
				port.postMessage( msg );
			};

			// Release queued data one-by-one.
			var msg;
			while ( msg = data.shift() ) {
				panelWindow.handleIncomingMessage( msg );
			}

		} );
	}
);
