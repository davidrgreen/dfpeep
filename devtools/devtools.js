chrome.devtools.panels.create(
	'DFPeep',
	'', // Icon location.
	'devtools/panel/panel.html',
	function(extensionPanel) {
		var panelWindow; // Reference to the panel's window object.

		var data = [];
		var port = chrome.runtime.connect( { name: 'DFPeepFromPanel'} );
		port.onMessage.addListener(function(msg) {
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

			panelWindow = _window;
			panelWindow.backgroundPort = port;
			panelWindow.changeScreen( 'init' );

			// Release queued data one-by-one.
			var msg;
			while ( msg = data.shift() ) {
				panelWindow.handleIncomingMessage( msg );
			}

			// Add a function to the panel to easily send a message
			// back to the background page.
			panelWindow.sendToBackground = function( msg ) {
				port.postMessage( msg );
			};
		} );
	}
);
