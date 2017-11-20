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

function outputDataToScreen( data ) {
	document.body.innerHTML += '<br><br>' + JSON.stringify( data , null, 4 );
}

function generateNewPanel() {
	document.body.innerHTML = generateMenu() + '<div id="content"></div>';
}

function generateMenu() {
	return `
		<nav class="main-menu">
			<ul>
				<li><a href="#overview">Overview</a></li>
				<li><a href="#refreshes">Refreshes</a></li>
			</ul>
		</nav>`;
}

function generateRefreshInfo() {
	return 'refresh info here';
}

function changeScreen( screen ) {
	if ( screen !== currentScreen ) {
		switch( screen ) {
			case 'init':
				currentScreen = screen;
				generateNewPanel();
				break;
			case 'refreshes':
				currentScreen = screen;
				displayContent( generateRefreshInfo() );
				break;
			default:

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