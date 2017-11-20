/* global chrome */

var currentScreen,
	contentElement;

function handleIncomingMessage( msg ) {
	console.log( 'panel received:' );
	console.log( msg );
	if ( msg.payload && msg.payload.action ) {
		switch ( msg.payload.action ) {
			case 'newPageLoad':
				changeScreen( 'init' );
				break;
			case 'GPTRefresh':
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

function setupMenuEventListeners() {
	var menu = document.getElementById( 'menu' );
	if ( ! menu ) {
		console.error( 'no menu' );
		return;
	}
	menu.addEventListener( 'click', function( e ) {
		if ( e.target && 'A' === e.target.nodeName ) {
			e.preventDefault();
			var targetScreen = e.target.hash.replace( '#', '' );
			changeScreen( targetScreen );
		}
	});
}

function outputDataToScreen( data ) {
	document.body.innerHTML += '<br><br>' + JSON.stringify( data , null, 4 );
}

function generateNewPanel() {
	contentElement = null;
	document.body.innerHTML = generateMenu() + '<div id="content"></div>';
}

function generateMenu() {
	return `
		<nav id="menu">
			<ul>
				<li><a href="#overview">Overview</a></li>
				<li><a href="#refreshes">Refreshes</a></li>
				<li><a href="#slots">Slots</a></li>
			</ul>
		</nav>`;
}

function generateRefreshInfo() {
	return 'refresh info here';
}

function generateSlotInfo() {
	return 'Slot info';
}

function generateOverview() {
	return 'This is the overview. There will be more here later.';
}

function changeScreen( screen ) {
	if ( screen !== currentScreen ) {
		switch( screen ) {
			case 'init':
				currentScreen = 'overview';
				generateNewPanel();
				setupMenuEventListeners();
				displayContent( generateOverview() );
				break;
			case 'refreshes':
				currentScreen = screen;
				displayContent( generateRefreshInfo() );
				break;
				case 'slots':
				currentScreen = screen;
				displayContent( generateSlotInfo() );
				break;
			case 'overview':
				currentScreen = screen;
				displayContent( generateOverview() );
				break;
			default:
				changeScreen( 'overview' );
				break;
		}
	}
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