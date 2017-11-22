/* global chrome */

var currentScreen,
	contentElement,
	menuElement,
	pageLoadTimestamp,
	adData;

function handleIncomingMessage( msg ) {
	console.log( 'panel received:' );
	console.log( msg );
	if ( msg.payload && msg.payload.action ) {
		switch ( msg.payload.action ) {
			case 'newPageLoad':
				setupVariables( msg.payload.data );
				changeScreen( 'init' );
				break;
			case 'GPTRefresh':
				adData.refreshes.push( msg.payload.data );
				changeScreen( 'refreshes' );
				break;
			case 'GPTEnableServices':
				if ( msg.payload.data.time ) {
					adData.enabledServices.push( msg.payload.data.time );
				}
				break;
			default:
				outputDataToScreen( msg );
				break;
		}
	} else {
		outputDataToScreen( msg );
	}
}

function setupVariables( data ) {
	if ( data && data.pageLoadTimestamp ) {
		pageLoadTimestamp = data.pageLoadTimestamp;
	}
	adData = {
		refreshes: [],
		enabledServices: []
	};
}

function getMenuElement() {
	return menuElement ? menuElement : document.getElementById( 'menu' );
}

function setupMenuEventListeners() {
	menuElement = getMenuElement();
	if ( ! menuElement ) {
		console.error( 'no menu' );
		return;
	}
	menuElement.addEventListener( 'click', function( e ) {
		if ( e.target && 'A' === e.target.nodeName ) {
			e.preventDefault();
			var targetScreen = e.target.hash.replace( '#', '' );
			changeScreen( targetScreen );
		}
	});
}

function outputDataToScreen( data ) {
	document.body.innerHTML += 'No incoming message handler for the following data:<br><br>' + JSON.stringify( data, null, 4 );
}

function generateRefreshInfo() {
	if ( ! adData || ! adData.refreshes ) {
		return 'No ad refreshes have occurred yet.';
	}
	var i, length, s, slots, slotCount, j, jlength, sizeMappings, l, llength;
	var toReturn = '<h3>History of refreshes:</h3>';
	toReturn += '<ul class="tree-list">';
	for ( i = 0, length = adData.refreshes.length; i < length; i++ ) {
		slots = adData.refreshes[ i ].slots;
		slotCount = slots.length;
		toReturn += '<li><b>Refresh #' + ( i + 1 ) + ' (' +
			slotCount + ' slots)</b>';

		// Begin list of slots.
		for ( s = 0; s < slotCount; s++ ) {
			toReturn += '<ul><li>Slot: ' + slots[ s ].elementId;
			toReturn += '<ul>';
			toReturn += '<li>Ad Unit: ' + slots[ s ].adUnitPath + '</li>';
			toReturn += '<li>Slot\'s previous refreshes: #</li>';
			toReturn += '<li>Element ID: ' + slots[ s ].elementId + '</li>';
			//adUnitPath, elementId, storedData.sizeMappings(array), targeting(objects)
			if ( slots[ s ].storedData && slots[ s ].storedData.sizeMappings ) {
				toReturn += '<li>Size Mappings: <ul>';
				sizeMappings = slots[ s ].storedData.sizeMappings[0];
				for ( j = 0, jlength = sizeMappings.length; j < jlength; j++ ) {
					// Iterating over list of sizes containing rules.
					toReturn += '<li>' + sizeMappings[ j ][0][0] + 'x' + sizeMappings[ j ][0][1] + '<ul>';
					console.log( sizeMappings[ j ][1] );
					if ( ! Array.isArray( sizeMappings[ j ][1][0] ) ) {
						toReturn += '<li>' + sizeMappings[ j ][1][0] + 'x' +
							sizeMappings[ j ][1][1] + '</li>';
					} else {
						for ( l = 0, llength = sizeMappings[ j ][1].length; l < llength; l++ ) {
							toReturn += '<li>' + sizeMappings[ j ][1][ l ][0] + 'x' +
								sizeMappings[ j ][1][ l ][1] + '</li>';
						}
					}
					toReturn += '</ul>';
						// Iterating over all ad sizes for this size.
				}
				toReturn += '</ul></li>';
			}
			toReturn += '</ul>';
			toReturn += '</li></ul>';
		}

		toReturn += '</li>';
	}

	return toReturn + '</ul>';
}

function buildIndividualRefreshInfo( count, data ) {
}


function generateSlotInfo() {
	return 'Slot info';
}

function generateOverview() {
	return 'This is the overview. There will be more here later.';
}

function changeScreen( screen ) {
	var nextScreen;
	switch ( screen ) {
		case 'init':
			nextScreen = 'overview';
			setupMenuEventListeners();
			displayContent( generateOverview() );
			break;
		case 'refreshes':
			displayContent( generateRefreshInfo() );
			break;
		case 'slots':
			displayContent( generateSlotInfo() );
			break;
		case 'overview':
			displayContent( generateOverview() );
			break;
		default:
			changeScreen( 'overview' );
			return;
	}
	nextScreen = nextScreen ? nextScreen : screen;
	changeSelectedMenuItem( nextScreen );
	currentScreen = nextScreen;
}

function changeSelectedMenuItem( menuItem ) {
	menuElement = getMenuElement();
	if ( ! menuElement ) {
		console.error( 'no menu' );
		return;
	}

	var selected = menuElement.querySelector( '.selected' );
	if ( selected ) {
		selected.classList.remove( 'selected' );
	}

	var newlySelected = menuElement.querySelector( 'a[href="#' + menuItem + '"]' );
	newlySelected.classList.add( 'selected' );
}

function displayContent( content ) {
	if ( ! content ) {
		console.error( 'No content passed to displayContent' );
		return;
	}
	if ( ! contentElement ) {
		contentElement = document.getElementById( 'content' );
		if ( ! contentElement ) {
			console.error( 'No content element to write to.' );
			return;
		}
	}
	contentElement.innerHTML = content;
}

// document.documentElement.onclick = function() {
//     sendToBackground('Another stupid example!');
// };