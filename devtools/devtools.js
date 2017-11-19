chrome.devtools.panels.create(
	'DFPeep',
	'', // Icon location.
	'devtools/panel/panel.html',
	function(extensionPanel) {
		/*
		 window.DFPeepPort = chrome.extension.connect({name:"DFPeepFromPanel"});
		chrome.extension.onMessage.addListener(function(message,sender){
			console.log( 'panel received message via port.onMessage' );
		});
		*/

		var _window; // Going to hold the reference to panel.html's `window`

		var data = [];
		var port = chrome.runtime.connect({name: 'DFPeepFromPanel'});
		port.onMessage.addListener(function(msg) {
			console.log( 'panel got message:' );
			console.log(msg);
			// Write information to the panel, if exists.
			// If we don't have a panel reference (yet), queue the data.
			if (_window) {
				_window.do_something(msg);
			} else {
				data.push(msg);
			}
		});

		extensionPanel.onShown.addListener(function tmp(panelWindow) {
			extensionPanel.onShown.removeListener(tmp); // Run once only
			_window = panelWindow;
			_window.reload();

			// Release queued data
			var msg;
			while (msg = data.shift())
				_window.do_something(msg);
			// Just to show that it's easy to talk to pass a message back:
			_window.sendToBackground = function(msg) {
				port.postMessage(msg);
			};
		});
	}
);
