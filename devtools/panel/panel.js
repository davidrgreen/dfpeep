/* global chrome */

var currentScreen,
	contentElement,
	menuElement,
	adData,
	UIState = {
		refreshesShown: 0,
		slotsShown: 0,
		recommendationsShown: 0
	},
	recommendations = {
		warnings: {},
		errors: {}
	}, // code: { 'text', [slots/creatives] }
	debug = 1;

function handleIncomingMessage( msg ) {
	if ( debug ) {
		console.log( 'panel received:' );
		console.log( msg );
	}
	if ( msg.payload && msg.payload.action ) {
		switch ( msg.payload.action ) {
			case 'newPageLoad':
				setupVariables( msg.payload.data );
				maybeUpdateMenuText();
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
	determineRecommendations();
	maybeUpdateMenuText( 'recommendations' );
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

	if ( ! item || 'recommendations' === item ) {
		currentLength = Object.keys( recommendations.warnings ).length +
			Object.keys( recommendations.errors ).length;
		if ( ! UIState.recommendationsShown ||
				UIState.recommendationsShown !== currentLength ) {
			UIState.slotsShown = currentLength;
			toUpdate = menuElement.querySelector( 'a[href="#recommendations"]' );
			toUpdate.innerText = 'Recommendations (' + currentLength + ')';
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
	UIState = {
		refreshesShown: 0,
		slotsShown: 0,
		recommendationsShown: 0
	};
	recommendations = {
		warnings: {},
		errors: {}
	};
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
	if ( data && data.pageURL ) {
		adData.pageURL = data.pageURL;
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
	var slotName = document.createTextNode( 'Slot: ' + slot.elementId + ' \u2014 ' );
	slotListItem.appendChild( slotName );

	var slotHighlightLink = document.createElement( 'span' );
	text = 'Highlight slot in page';
	slotHighlightLink.appendChild( document.createTextNode( text ) );
	slotHighlightLink.className = 'highlight-slot-link';
	slotHighlightLink.addEventListener( 'click', function() {
		sendToBackground( { action: 'highlightSlot', data: slot.elementId } );
	} );
	slotListItem.appendChild( slotHighlightLink );

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
				text = 'Fetches: #1';
			} else {
				text = 'Fetches: ' + slot.refreshedIndexes.length + ' of ' +
					adData.slots[ slot.elementId ].refreshedIndexes.length +
					' total.';
			}
		} else {
			text = 'Fetches: 0';
		}


		previousRefreshes.appendChild( document.createTextNode( text ) );
		previousRefreshes.appendChild(
			buildRefreshResultList( slot.elementId )
		);
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

	if ( slot.fallbackSize ) {
		var fallbackSizes = document.createElement( 'li' );
		text = 'Fallback sizes:';
		fallbackSizes.appendChild( document.createTextNode( text ) );
		fallbackSizes.appendChild(
			buildFallbackSizeList( slot.fallbackSize )
		);
		slotInfoList.appendChild( fallbackSizes );
	}

	var collapseDiv = document.createElement( 'li' );
	text = 'Collapse if Empty: ';
	if ( slot.collapseEmptyDiv || ( adData.collapseEmptyDivs &&
			adData.collapseEmptyDivs.timestamp &&
			! adData.collapseEmptyDivs.error ) ) {
		text += 'Yes';

		if ( 'before' === slot.collapseEmptyDiv || ( adData.collapseEmptyDivs &&
			adData.collapseEmptyDivs.before ) ) {
			text += ', before ad is fetched';
		}
	} else {
		text += 'No';
	}
	collapseDiv.appendChild( document.createTextNode( text ) );
	slotInfoList.appendChild( collapseDiv );

	slotListItem.appendChild( slotInfoList );

	return slotListItem;
}

function buildRefreshResultList( slotId ) {
	var item, text, detailList, detail;
	var refreshResultList = document.createElement( 'ul' );

	var refreshResults = adData.slots[ slotId ].refreshResults;

	for ( var i = 0, length = refreshResults.length; i < length; i++ ) {
		item = document.createElement( 'li' );
		text = 'Fetch #' + ( i + 1 ) + ', part of refresh batch #' +
			( refreshResults[ i ].overallRefreshIndex + 1 );
		item.appendChild( document.createTextNode( text ) );
		detailList = document.createElement( 'ul' );

		if ( refreshResults[ i ].isEmpty ) {
			detail = document.createElement( 'li' );
			text = 'No creative returned.';
			detail.appendChild( document.createTextNode( text ) );
			detailList.appendChild( detail );
		} else {
			if ( refreshResults[ i ].onloadTimestamp ) {
				detail = document.createElement( 'li' );
				text = 'Load time: ' + ( refreshResults[ i ].onloadTimestamp -
					refreshResults[ i ].renderEndedTimestamp ) + 'ms';
				detail.appendChild( document.createTextNode( text ) );
				detailList.appendChild( detail );
			}

			detail = document.createElement( 'li' );
			text = 'Creative ID: ' + refreshResults[ i ].creativeId;
			detail.appendChild( document.createTextNode( text ) );
			detailList.appendChild( detail );

			detail = document.createElement( 'li' );
			text = 'Line Item ID: ' + refreshResults[ i ].lineItemId;
			detail.appendChild( document.createTextNode( text ) );
			detailList.appendChild( detail );

			detail = document.createElement( 'li' );
			text = 'Advertiser ID: ' + refreshResults[ i ].advertiserId;
			detail.appendChild( document.createTextNode( text ) );
			detailList.appendChild( detail );

			detail = document.createElement( 'li' );
			text = 'Campaign ID: ' + refreshResults[ i ].campaignId;
			detail.appendChild( document.createTextNode( text ) );
			detailList.appendChild( detail );

			if ( refreshResults[ i ].size &&
					Array.isArray( refreshResults[ i ].size ) ) {
				detail = document.createElement( 'li' );
				text = 'Creative Size: ' + refreshResults[ i ].size[0] +
					'x' + refreshResults[ i ].size[1];
				detail.appendChild( document.createTextNode( text ) );
				detailList.appendChild( detail );
			}

			detail = document.createElement( 'li' );
			text = 'Backfill? ' + ( refreshResults[ i ].isBackfill ? 'Yes' : 'No' );
			detail.appendChild( document.createTextNode( text ) );
			detailList.appendChild( detail );

			if ( refreshResults[ i ].labelIds ) {
				detail = document.createElement( 'li' );
				text = 'Label IDs: ';
				if ( Array.isArray( refreshResults[ i ].labelIds ) ) {
					text += refreshResults[ i ].labelIds.join( ', ' );
				} else {
					text += refreshResults[ i ].labelIds;
				}
				detail.appendChild( document.createTextNode( text ) );
				detailList.appendChild( detail );
			}
		}

		item.appendChild( detailList );
		refreshResultList.appendChild( item );
	}

	return refreshResultList;
}

function buildTimeIntervalListItem( refreshes, i ) {
	var timeDiffMs, timeDiffSecs, timeDiffText, timeListItem;

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

function buildFallbackSizeList( sizes ) {
	var sizeList = document.createElement( 'ul' ),
		sizeItem, size;

	for ( var i = 0, length = sizes.length; i < length; i++ ) {
		sizeItem = document.createElement( 'li' );
		if ( ! Array.isArray( sizes[ i ] ) ) {
			size = sizes[ i ];
			if ( sizes[ i + 1 ] ) {
				size += 'x' + sizes[ i + 1 ];
			}
			i = length;
		} else {
			size = sizes[ i ][0] + 'x' + sizes[ i ][1];
		}
		sizeItem.appendChild( document.createTextNode( size ) );

		sizeList.appendChild( sizeItem );
	}

	return sizeList;
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
	var text, list, item;
	var overview = document.createDocumentFragment();

	var title = document.createElement( 'h2' );
	text = 'Overview';
	title.appendChild( document.createTextNode( text ) );
	overview.appendChild( title );

	if ( ! adData ) {

		return overview;
	}

	list = document.createElement( 'ul' );

	if ( adData.pageURL ) {
		item = document.createElement( 'li' );
		item.appendChild( createLabelAndValue( 'Page URL: ', adData.pageURL ) );
		list.appendChild( item );
	}

	if ( adData.pageLoadTimestamp ) {
		item = document.createElement( 'li' );
		var dateObj = new Date( adData.pageLoadTimestamp );
		item.appendChild( createLabelAndValue( 'Page Loaded: ', dateObj ) );
		list.appendChild( item );
	}

	var disabledInitialLoad = 'No';
	if ( adData.disabledInitialLoad && adData.disabledInitialLoad.length > 0 ) {
		disabledInitialLoad = 'Yes';
	}
	item = document.createElement( 'li' );
	item.appendChild( createLabelAndValue( 'Disabled Initial Load? ', disabledInitialLoad ) );
	list.appendChild( item );

	overview.appendChild( list );

	return overview;
}

function generateRecommendationsScreen() {
	var title, text, intro,
		toReturn = document.createDocumentFragment(),
		errorCount = Object.keys( recommendations.errors ).length,
		warningCount = Object.keys( recommendations.warnings ).length;

	title = document.createElement( 'h2' );
	title.appendChild( document.createTextNode( 'Recommendations:' ) );
	toReturn.appendChild( title );

	intro = document.createElement( 'p' );
	if ( errorCount || warningCount ) {
		text = 'DFPeep suggests the following issues be examined.';
	} else {
		text = 'DFPeep has no suggestions to make at this time.';
	}
	intro.appendChild( document.createTextNode( text ) );
	toReturn.appendChild( intro );

	if ( errorCount > 0 ) {
		title = document.createElement( 'h3' );
		text = errorCount + ' Error';
		if ( 1 === errorCount ) {
			text += ':';
		} else {
			text += 's:';
		}
		title.appendChild( document.createTextNode( text ) );
		title.className = 'recommendation-section-title';
		toReturn.appendChild( title );
		toReturn.appendChild(
			buildRecommendationList( recommendations.errors, 'error' )
		);
	}

	if ( warningCount > 0 ) {
		title = document.createElement( 'h3' );
		text = warningCount + ' Warning';
		if ( 1 === warningCount ) {
			text += ':';
		} else {
			text += 's:';
		}
		title.appendChild( document.createTextNode( text ) );
		title.className = 'recommendation-section-title';
		toReturn.appendChild( title );
		toReturn.appendChild(
			buildRecommendationList( recommendations.warnings, 'warning' )
		);
	}

	return toReturn;
}

function buildRecommendationList( recs, type ) {
	var listItem, title;
	var list = document.createElement( 'ul' );
	list.className = type + '-list recommendation-list';

	for ( var rec in recs ) {
		if ( ! recs.hasOwnProperty( rec ) ) {
			continue;
		}

		listItem = document.createElement( 'li' );

		title = document.createElement( 'h4' );
		title.className = type + '-title recommendation-title';
		title.appendChild( document.createTextNode( recs[ rec ].title ) );
		listItem.appendChild( title );

		listItem.appendChild( recs[ rec ].description.cloneNode( true ) );
		list.appendChild( listItem );
	}

	return list;
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
		case 'recommendations':
			displayContent( generateRecommendationsScreen(), nextScreen );
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

function makeCollapsible( dom, screen ) {
	var exclude = [ 'recommendations' ];
	if ( screen && -1 !== exclude.indexOf( screen ) ) {
		return;
	}
	if ( ! dom ) {
		dom = document;
	}
	var listsToHide = dom.querySelectorAll( '.tree-with-children' );
	for ( var i = 0, length = listsToHide.length; i < length; i++ ) {
		listsToHide[ i ].querySelector( 'ul' ).classList.add( 'tree-hidden' );
	}
}

function determineRecommendations() {
	checkForLateDisableInitialLoad();
	checkForMoveAfterRender();
	checkForLateEnableSingleRequest();
}

function checkForLateDisableInitialLoad() {
	if ( recommendations.errors.lateDisableInitialLoad ) {
		return;
	}

	if ( 0 === adData.disabledInitialLoad.length ||
			0 === adData.enabledServices.length ) {
		return;
	}

	if ( adData.enabledServices[0] < adData.disabledInitialLoad[0] ) {
		var description = document.createElement( 'p' );
		var text = 'googletag.pubads().disableInitialLoad() likely had no effect because it was called after googletag.enableServices().';
		description.appendChild( document.createTextNode( text ) );

		recommendations.errors.lateDisableInitialLoad = {
			title: 'Disabled Initial Load Too Late',
			description: description
		};
	}
}

function checkForLateEnableSingleRequest() {
	if ( recommendations.errors.lateEnableSingleRequest ) {
		return;
	}

	if ( 0 === adData.enabledSingleRequest.length ||
			0 === adData.enabledServices.length ) {
		return;
	}

	if ( adData.enabledServices[0] < adData.enabledSingleRequest[0] ) {
		var description = document.createElement( 'p' );
		var text = 'googletag.pubads().enableSingleRequest() had no effect because it was called after googletag.enableServices().';
		description.appendChild( document.createTextNode( text ) );

		recommendations.errors.lateEnableSingleRequest = {
			title: 'Enabled Single Request Mode Too Late',
			description: description
		};
	}
}

function checkForMoveAfterRender() {
	var refreshResults, slot,
		offendingSlots = [],
		slotNames = Object.keys( adData.slots ).sort();

	for ( var i = 0, length = slotNames.length; i < length; i++ ) {
		slot = adData.slots[ slotNames[ i ] ];
		if ( ! slot.movedInDOM || ! Array.isArray( slot.movedInDOM ) ) {
			continue;
		}

		refreshResults = slot.refreshResults;

		if ( ! refreshResults && 0 === refreshResults.length ) {
			continue;
		}

		for ( var r = 0, rlength = refreshResults.length; r < rlength; r++ ) {
			if ( refreshResults[ r ].renderEndedTimestamp &&
				refreshResults[ r ].renderEndedTimestamp < slot.movedInDOM[0] ) {
				offendingSlots.push( slotNames[ i ] );
				break;
			}
		}
	}

	if ( offendingSlots.length > 0 ) {
		var fragment = document.createDocumentFragment();
		var description = document.createElement( 'p' );
		var text = 'When an ad slot element is moved in the DOM after the initial fetching of the ad it will force the ad\'s iframe to refresh, resulting in a blank slot. The following slots have been detected as having been moved in the DOM after the initial fetching of their ads:';
		description.appendChild( document.createTextNode( text ) );
		fragment.appendChild( description );

		var list = document.createElement( 'ul' ),
			listItem;

		for ( var d = 0, dlength = offendingSlots.length; d < dlength; d++ ) {
			listItem = document.createElement( 'li' );
			listItem.appendChild( document.createTextNode( offendingSlots[ d ] ) );
			list.appendChild( listItem );
		}
		fragment.appendChild( list );

		description = document.createElement( 'p' );
		text = 'If you need to move the slot element, such as moving a sidebar ad inline on mobile, then you need to ensure the slot element is moved before the ad is fetched. A sure-fire way of doing this is to use googletag.pubads().disableInitialLoad(), allowing you to manually fetch the ad with googletag.pubads().refresh() only after the slot element has been moved in the DOM.';
		description.appendChild( document.createTextNode( text ) );
		fragment.appendChild( description );
		recommendations.warnings.lateDisableInitialLoad = {
			title: 'Moved Slot Element After Rendered In DOM',
			description: fragment
		};

		return fragment;
	}
}

function createLabelAndValue( label, value ) {
	var fragment = document.createDocumentFragment();
	var labelElement = document.createElement( 'span' );
	labelElement.className = 'info-label';
	labelElement.appendChild( document.createTextNode( label ) );
	fragment.appendChild( labelElement );

	if ( value instanceof HTMLElement ) {
		fragment.appendChild( value );
	} else {
		fragment.appendChild( document.createTextNode( value ) );
	}
	return fragment;
}
