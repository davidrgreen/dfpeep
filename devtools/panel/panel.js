/* global chrome */

var currentScreen,
	contentElement,
	menuElement,
	adData;

function handleIncomingMessage( msg ) {
	console.log( 'panel received:' );
	console.log( msg );
	if ( msg.payload && msg.payload.action ) {
		switch ( msg.payload.action ) {
			case 'newPageLoad':
				setupVariables();
				changeScreen( 'init' );
				break;
			case 'GPTRefresh':
				adData.refreshes.push( msg.payload.data );
				changeScreen( 'refreshes' );
				break;
			default:
				outputDataToScreen( msg );
				break;
		}
	} else {
		outputDataToScreen( msg );
	}
}

function setupVariables() {
	adData = {
		refreshes: []
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
	var toReturn = 'History of refreshes:<br><br><pre>';
	if ( adData.refreshes ) {
		toReturn += JSON.stringify( adData.refreshes, null, 4 );
	}
	toReturn += '</pre>';

	return toReturn;
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