/* global chrome */

function handleIncomingMessage( msg ) {
	console.log( 'panel received:' );
	console.log( msg );
	if ( msg.data && msg.data.data && msg.data.data.action ) {
		switch ( msg.data.data.action ) {
			case 'newPageLoad':
				handleNewPageLoad();
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

function handleNewPageLoad() {
	document.body.innerHTML = 'New Page Load:<br><br>';
}

// document.documentElement.onclick = function() {
//     sendToBackground('Another stupid example!');
// };