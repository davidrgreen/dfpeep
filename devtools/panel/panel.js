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
				menuElement.querySelector( 'a[href="#refreshes"]' ).innerText = 'Refreshes (' + adData.refreshes.length + ')';
				changeScreen( 'refreshes' );
				break;
			case 'GPTEnableServices':
				if ( msg.payload.data.time ) {
					adData.enabledServices.push( msg.payload.data.time );
				}
				break;
			case 'GPTEnableSingleRequest':
				if ( msg.payload.data.time ) {
					adData.enabledSingleRequest.push( msg.payload.data.time );
				}
				break;
			case 'GPTDisableInitialLoad':
				if ( msg.payload.data.time ) {
					adData.disabledInitialLoad.push( msg.payload.data.time );
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
		enabledServices: [],
		disabledInitialLoad: []
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
		var noRefreshes = document.createElement( 'p' );
		var explanation = document.createTextNode( 'No ad refreshes yet.' );
		noRefreshes.appendChild( explanation );
		return noRefreshes;
	}
	var i, length, s, slots, slotCount, sizeMappings, target, refreshListItem, refreshLabel, text, refreshSlotList;

	var toReturn = document.createDocumentFragment();

	var title = document.createElement( 'h2' );
	title.appendChild( document.createTextNode( 'History of Refreshes:' ) );
	toReturn.appendChild( title );

	var refreshList = document.createElement( 'ul' );
	refreshList.className = 'tree-list';

	for ( i = 0, length = adData.refreshes.length; i < length; i++ ) {

		if ( i > 0 ) {
			refreshList.appendChild(
				buildTimeIntervalListItem( adData.refreshes, i )
			);
		}

		slots = adData.refreshes[ i ].slots;
		slotCount = slots.length;

		refreshListItem = document.createElement( 'li' );
		refreshLabel = document.createElement( 'b' );
		text = 'Refresh #' + ( i + 1 ) + ' (' + slotCount + ' slots)';
		refreshLabel.appendChild( document.createTextNode( text ) );
		refreshListItem.appendChild( refreshLabel );

		refreshSlotList = document.createElement( 'ul' );
		// Begin list of slots sent in this refresh.
		for ( s = 0; s < slotCount; s++ ) {
			refreshSlotList.appendChild( buildSlotListItem( slots[ s ] ) );
		}
		refreshListItem.appendChild( refreshSlotList );

		refreshList.appendChild( refreshListItem );
	}

	toReturn.appendChild( refreshList );

	return toReturn;
}

function buildSlotListItem( slot ) {
	var text;

	var slotListItem = document.createElement( 'li' );

	var slotName = 'Slot: ' + slot.elementId;
	slotListItem.appendChild( document.createTextNode( slotName ) );

	var slotInfoList = document.createElement( 'ul' );

	var adUnit = document.createElement( 'li' );
	text = 'Ad Unit: ' + slot.adUnitPath;
	adUnit.appendChild( document.createTextNode( text ) );
	slotInfoList.appendChild( adUnit );

	var elementId = document.createElement( 'li' );
	text = 'DOM Element ID: ' + slot.elementId;
	elementId.appendChild( document.createTextNode( text ) );
	slotInfoList.appendChild( elementId );

	var previousRefreshes = document.createElement( 'li' );
	text = 'Total times refreshed: #';
	previousRefreshes.appendChild( document.createTextNode( text ) );
	slotInfoList.appendChild( previousRefreshes );

	if ( slot.targeting ) {
		var targeting = document.createElement( 'li' );
		text = 'Key-Value Targeting:';
		targeting.appendChild( document.createTextNode( text ) );
		targeting.appendChild( buildKeyTargetingList( slot.targeting ) );
		slotInfoList.appendChild( targeting );
	}

	if ( slot.storedData && slot.storedData.sizeMappings ) {
		var sizeMapping = document.createElement( 'li' );
		text = 'Size Mapping:';
		sizeMapping.appendChild( document.createTextNode( text ) );
		sizeMapping.appendChild(
			buildSizeMappingList( slot.storedData.sizeMappings[0] )
		);
		slotInfoList.appendChild( sizeMapping );
	}

	slotListItem.appendChild( slotInfoList );

	return slotListItem;
}

function buildTimeIntervalListItem( refreshes, i ) {
	var timeDiffMs, timeDiffSecs, timeDiffText, timeListItem,
		pageTimeDiffMs, pageTimeDiffSecs;

	// Show time passed between refreshes.
	timeDiffMs = adData.refreshes[ i ].timestamp - adData.refreshes[ i - 1 ].timestamp;
	timeDiffSecs = Math.round( timeDiffMs / 1000 * 100 ) / 100;
	if ( 0 !== timeDiffMs % 1000 ) {
		timeDiffText = timeDiffSecs + ' seconds (' + timeDiffMs + 'ms)';
	} else {
		timeDiffText = timeDiffSecs + ' seconds';
	}

	// Unicode for mdash html entity.
	timeDiffText += ' later \u2014 ';

	// Time since page load.
	pageTimeDiffMs = adData.refreshes[ i ].timestamp - pageLoadTimestamp;
	pageTimeDiffSecs = Math.round( pageTimeDiffMs / 1000 * 100 ) / 100;
	if ( 0 !== pageTimeDiffMs % 1000 ) {
		timeDiffText += pageTimeDiffSecs + ' seconds (' + pageTimeDiffMs + 'ms)';
	} else {
		timeDiffText += pageTimeDiffSecs + ' seconds';
	}
	// Might should change to since GPT loaded.
	timeDiffText += ' since page load.';

	timeListItem = document.createElement( 'li' );
	timeListItem.className = 'tree-time-diff';
	timeListItem.appendChild( document.createTextNode( timeDiffText ) );

	return timeListItem;
}

/**
 * Build a nested list from targeting data passed into it.
 */
function buildKeyTargetingList( targets ) {
	var targetingList = document.createElement( 'ul' ),
		targetingItem, text, valueList, valueItem,
		i, length;

	for ( var target in targets ) {
		if ( ! targets.hasOwnProperty( target ) ) {
			continue;
		}

		targetingItem = document.createElement( 'li' );

		if ( ! Array.isArray( targets[ target ] ) ||
				1 === targets[ target ].length ) {
			text = target + ': ' + targets[ target ];
			targetingItem.appendChild( document.createTextNode( text ) );
		} else {
			text = target + ': ';
			targetingItem.appendChild( document.createTextNode( text ) );

			valueList = document.createElement( 'ul' );
			for ( i = 0, length = targets[ target ].length; i < length; i++ ) {
				valueItem = document.createElement( 'li' );
				valueItem.appendChild(
					document.createTextNode( targets[ target ][ i ] )
				);
				valueList.appendChild( valueItem );
			}

			targetingItem.appendChild( valueList );
		}

		targetingList.appendChild( targetingItem );
	}

	return targetingList;
}

function buildSizeMappingList( sizeMapping ) {
	var screenSizeList = document.createElement( 'ul' ),
		screenSizeItem, screenSize, adSize, adSizeList, adSizeItem;

	for ( var j = 0, jlength = sizeMapping.length; j < jlength; j++ ) {
		screenSizeItem = document.createElement( 'li' );
		screenSize = sizeMapping[ j ][0][0] + 'x' + sizeMapping[ j ][0][1] + ':';
		screenSizeItem.appendChild( document.createTextNode( screenSize ) );

		adSizeList = document.createElement( 'ul' );
		if ( ! Array.isArray( sizeMapping[ j ][1][0] ) ) {
			adSizeItem = document.createElement( 'li' );
			adSize = sizeMapping[ j ][1][0] + 'x' + sizeMapping[ j ][1][1];
			adSizeItem.appendChild( document.createTextNode( adSize ) );
			adSizeList.appendChild( adSizeItem );
		} else {
			for ( var l = 0, llength = sizeMapping[ j ][1].length; l < llength; l++ ) {
				adSizeItem = document.createElement( 'li' );
				adSize = sizeMapping[ j ][1][ l ][0] + 'x' + sizeMapping[ j ][1][ l ][1];
				adSizeItem.appendChild( document.createTextNode( adSize ) );
				adSizeList.appendChild( adSizeItem );
			}
		}
		screenSizeItem.appendChild( adSizeList );
		screenSizeList.appendChild( screenSizeItem );
	}

	return screenSizeList;
}


function generateSlotInfo() {
	var toReturn = document.createDocumentFragment();
	var intro = document.createElement( 'p' );
	var text = 'Slot info will go here';
	intro.appendChild( document.createTextNode( text ) );
	return toReturn;
}

function generateOverview() {
	var overview = document.createDocumentFragment();
	var intro = document.createElement( 'p' );
	var text = 'This is the overview. There will be more here later.';
	intro.appendChild( document.createTextNode( text ) );
	overview.appendChild( intro );

	return overview;
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
	emptyElement( contentElement );
	contentElement.appendChild( content );
}

function emptyElement( element ) {
	while ( element.firstChild ) {
		element.removeChild( element.firstChild );
	}
}

// document.documentElement.onclick = function() {
//     sendToBackground('Another stupid example!');
// };