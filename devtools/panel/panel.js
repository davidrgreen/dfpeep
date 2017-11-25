/* global chrome */

var currentScreen,
	contentElement,
	menuElement,
	adData,
	UIState = {
		refreshesShown: 0,
		slotsShown: 0
	};

function handleIncomingMessage( msg ) {
	console.log( 'panel received:' );
	console.log( msg );
	if ( msg.payload && msg.payload.action ) {
		switch ( msg.payload.action ) {
			case 'newPageLoad':
				setupVariables( msg.payload.data );
				changeScreen( 'init' );
				break;
			case 'fullSync':
				if ( msg.payload.data ) {
					adData = msg.payload.data;
				}
				maybeUpdateMenuText();
				changeScreen( 'overview' );
				break;
			case 'GPTRefresh':
				adData.refreshes.push( msg.payload.data );
				var slots = msg.payload.data.slots;
				for ( var i = 0, length = slots.length; i < length; i++ ) {
					updateSlotInfo( slots[ i ].elementId, slots[ i ] );
				}
				maybeUpdateMenuText( 'refreshes' );
				maybeUpdateMenuText( 'slots' );
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
			case 'slotData':
				if ( msg.payload.data.name && msg.payload.data.data ) {
					updateSlotInfo( msg.payload.data.name, msg.payload.data.data );
				}
				maybeUpdateMenuText( 'slots' );
				break;
			default:
				outputDataToScreen( msg );
				break;
		}
	} else {
		outputDataToScreen( msg );
	}
}

function maybeUpdateMenuText( item ) {
	var toUpdate,
		currentLength;

	if ( ! item || 'refreshes' === item ) {
		currentLength = adData.refreshes.length;
		if ( ! UIState.refreshesShown ||
				UIState.refreshesShown !== currentLength ) {
			UIState.refreshesShown = currentLength;
			toUpdate = menuElement.querySelector( 'a[href="#refreshes"]' );
			toUpdate.innerText = 'Refreshes (' + currentLength + ')';
		}
	}

	if ( ! item || 'slots' === item ) {
		currentLength = Object.keys( adData.slots ).length;
		if ( ! UIState.slotsShown || UIState.slotsShown !== currentLength ) {
			UIState.slotsShown = currentLength;
			toUpdate = menuElement.querySelector( 'a[href="#slots"]' );
			toUpdate.innerText = 'Slots (' + currentLength + ')';
		}
	}
}

function updateSlotInfo( name, data ) {
	if ( ! name || ! data ) {
		return;
	}

	if ( ! adData.slots[ name ] ) {
		adData.slots[ name ] = {};
	}
	adData.slots[ name ] = data;
}

function setupVariables( data ) {
	adData = {
		slots: {},
		refreshes: [],
		enabledServices: [],
		disabledInitialLoad: [],
		enabledSingleRequest: []
	};
	if ( data && data.pageLoadTimestamp ) {
		adData.pageLoadTimestamp = data.pageLoadTimestamp;
	}
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
	var i, length, s, slots, slotCount, sizeMappings, target, refreshListItem,
		refreshLabel, text, refreshSlotList, pageTimeDiffMs, pageTimeDiffSecs;

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
		// Unicode for mdash html entity.
		text += ' \u2014 ';

		// Time since page load.
		pageTimeDiffMs = adData.refreshes[ i ].timestamp - adData.pageLoadTimestamp;
		pageTimeDiffSecs = Math.round( pageTimeDiffMs / 1000 * 100 ) / 100;
		if ( 0 !== pageTimeDiffMs % 1000 ) {
			text += pageTimeDiffSecs + ' seconds (' + pageTimeDiffMs + 'ms)';
		} else {
			text += pageTimeDiffSecs + ' seconds';
		}
		// Might should change to since GPT loaded.
		text += ' after page load.';
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
	slotListItem.className = 'tree-with-children';

	var plusSign = document.createElement( 'span' );
	plusSign.className = 'tree-plus-sign';
	slotListItem.appendChild( plusSign );
	var slotName = document.createTextNode( 'Slot: ' + slot.elementId );
	slotListItem.appendChild( slotName );

	var slotInfoList = document.createElement( 'ul' );

	var adUnit = document.createElement( 'li' );
	text = 'Ad Unit: ' + slot.adUnitPath;
	adUnit.appendChild( document.createTextNode( text ) );
	slotInfoList.appendChild( adUnit );

	var elementId = document.createElement( 'li' );
	text = 'DOM Element ID: ' + slot.elementId;
	elementId.appendChild( document.createTextNode( text ) );
	slotInfoList.appendChild( elementId );

	if ( slot.refreshedIndexes ) {
		var previousRefreshes = document.createElement( 'li' );

		if ( adData.slots[ slot.elementId ] ) {
			if ( adData.slots[ slot.elementId ].refreshedIndexes &&
					1 === adData.slots[ slot.elementId ].refreshedIndexes.length ) {
				text = 'Fetches: 1';
			} else {
				text = 'Fetches: ' + slot.refreshedIndexes.length + ' of ' +
					adData.slots[ slot.elementId ].refreshedIndexes.length +
					' total.';
			}
		} else {
			text = 'Fetches: 0';
		}

		previousRefreshes.appendChild( document.createTextNode( text ) );
		slotInfoList.appendChild( previousRefreshes );
	}

	if ( slot.targeting ) {
		var targeting = document.createElement( 'li' );
		text = 'Key-Value Targeting:';
		targeting.appendChild( document.createTextNode( text ) );
		targeting.appendChild( buildKeyTargetingList( slot.targeting ) );
		slotInfoList.appendChild( targeting );
	}

	if ( slot.sizeMappings ) {
		var sizeMapping = document.createElement( 'li' );
		text = 'Size Mapping:';
		sizeMapping.appendChild( document.createTextNode( text ) );
		sizeMapping.appendChild(
			buildSizeMappingList( slot.sizeMappings[0] )
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

	timeDiffText += ' passed';

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

	if ( ! adData || ! adData.slots || 0 === Object.keys( adData.slots ).length ) {
		var noSlots = document.createElement( 'p' );
		var explanation = document.createTextNode( 'No slot data received yet.' );
		noSlots.appendChild( explanation );
		return noSlots;
	}

	var title = document.createElement( 'h2' );
	title.appendChild( document.createTextNode( 'Slots:' ) );
	toReturn.appendChild( title );


	var slotList = document.createElement( 'ul' );
	slotList.className = 'tree-list';

	var slotNames = Object.keys( adData.slots ).sort();

	for ( var i = 0, length = slotNames.length; i < length; i++ ) {
		slotList.appendChild(
			buildSlotListItem( adData.slots[ slotNames[ i ] ] )
		);
	}

	toReturn.appendChild( slotList );

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
	var nextScreen = screen;
	switch ( screen ) {
		case 'init':
			nextScreen = 'overview';
			setupMenuEventListeners();
			displayContent( generateOverview(), nextScreen );
			break;
		case 'refreshes':
			displayContent( generateRefreshInfo(), nextScreen );
			break;
		case 'slots':
			displayContent( generateSlotInfo(), nextScreen );
			break;
		case 'overview':
			displayContent( generateOverview(), nextScreen );
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

function displayContent( content, screen ) {
	if ( ! content ) {
		console.error( 'No content passed to displayContent' );
		return;
	}
	if ( ! contentElement ) {
		setupContentArea();
		if ( ! contentElement ) {
			console.error( 'No content element to write to.' );
			return;
		}
	}
	emptyElement( contentElement );
	makeCollapsible( content, screen );
	contentElement.appendChild( content );
}

function setupContentArea() {
	contentElement = document.getElementById( 'content' );
	if ( ! contentElement ) {
		console.error( 'No content element to write to.' );
		return;
	}
	contentElement.addEventListener( 'click', function( e ) {
		if ( e.target && 'SPAN' === e.target.nodeName && e.target.classList.contains( 'tree-plus-sign' ) ) {
			e.preventDefault();
			e.target.classList.toggle( 'tree-plus-sign--expanded' );
			var parentToggle = e.target.parentElement.querySelector( 'ul' );
			if ( parentToggle ) {
				parentToggle.classList.toggle( 'tree-hidden' );
			}
		}
	} );
}

function emptyElement( element ) {
	while ( element.firstChild ) {
		element.removeChild( element.firstChild );
	}
}

function makeCollapsible( dom ) {
	if ( ! dom ) {
		dom = document;
	}
	var listsToHide = dom.querySelectorAll( '.tree-with-children' );
	for ( var i = 0, length = listsToHide.length; i < length; i++ ) {
		listsToHide[ i ].querySelector( 'ul' ).classList.add( 'tree-hidden' );
	}
}

// document.documentElement.onclick = function() {
//     sendToBackground('Another stupid example!');
// };