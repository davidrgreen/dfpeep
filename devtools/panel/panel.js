/**
 * Display ad data collected from page.
 *
 * @since 0.1.0
 * @package DFPeep
 * @copyright 2017 David Green
 * @license MIT
 */

/* global chrome */

var currentScreen,
	contentElement,
	menuElement,
	UIState = {
		refreshesShown: 0,
		slotsShown: 0,
		issuesShown: 0
	},
	issues = {
		warnings: {},
		errors: {}
	},
	adData = {
		slots: {},
		refreshes: [],
		enabledServices: [],
		disabledInitialLoad: [],
		enabledSingleRequest: [],
		collapseEmptyDivs: []
	},
	debug = 1,
	dash = '\u2014'; // Unicode value for an mdash.

/**
 * Take action on messages passed in from the background page through
 * devtools.js.
 *
 * @param {object} msg Message containing data or commands.
 *
 * @return {void}
 */
function handleIncomingMessage( msg ) {
	var skipDetermineIssues = 0;
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
					maybeUpdateMenuText();
					changeScreen( 'overview' );
				}
				break;
			case 'GPTRefresh':
				var refreshData = {
					timestamp: msg.payload.data.timestamp,
					slotIds: msg.payload.data.slotIds
				};
				adData.refreshes.push( refreshData );
				if ( msg.payload.data.slots ) {
					var slots = msg.payload.data.slots;
					for ( var i = 0, length = slots.length; i < length; i++ ) {
						updateSlotInfo( slots[ i ].elementId, slots[ i ] );
					}
				}
				maybeUpdateMenuText( 'refreshes' );
				maybeUpdateMenuText( 'slots' );
				maybeUpdateScreen( 'refreshes' );
				maybeUpdateScreen( 'slots' );
				break;
			case 'GPTRefreshUpdate':
				if ( 'number' === typeof msg.payload.data.index ) {
					if ( ! adData.refreshes[ msg.payload.data.index ] ) {
						adData.refreshes[ msg.payload.data.index ] = {};
					}
					if ( msg.payload.data.slot ) {
						if ( ! adData.refreshes[ msg.payload.data.index ].slotIds ) {
							adData.refreshes[ msg.payload.data.index ].slotIds = [];
						}
						adData.refreshes[ msg.payload.data.index ].slotIds.push( msg.payload.data.slot );
					}

					if ( msg.payload.data.timestamp ) {
						adData.refreshes[ msg.payload.data.index ].timestamp = msg.payload.data.timestamp;
					}
					maybeUpdateMenuText( 'refreshes' );
					maybeUpdateMenuText( 'slots' );
					maybeUpdateScreen( 'refreshes' );
					maybeUpdateScreen( 'slots' );
				}
				break;
			case 'GPTEnableServices':
				if ( msg.payload.data.time ) {
					adData.enabledServices.push( msg.payload.data.time );
					maybeUpdateScreen( 'overview' );
				}
				break;
			case 'GPTCollapseEmptyDivs':
				if ( msg.payload.data.collapsed ) {
					adData.collapseEmptyDivs = msg.payload.data.collapsed;
					maybeUpdateScreen( 'overview' );
					maybeUpdateScreen( 'issues' );
				}
				break;
			case 'GPTEnableSingleRequest':
				if ( msg.payload.data.time ) {
					adData.enabledSingleRequest.push( msg.payload.data.time );
					maybeUpdateScreen( 'overview' );
				}
				break;
			case 'GPTDisableInitialLoad':
				if ( msg.payload.data.time ) {
					adData.disabledInitialLoad.push( msg.payload.data.time );
					maybeUpdateScreen( 'overview' );
				}
				break;
			case 'slotData':
				if ( msg.payload.data.name && msg.payload.data.data ) {
					updateSlotInfo( msg.payload.data.name, msg.payload.data.data );
					maybeUpdateMenuText( 'slots' );
					maybeUpdateScreen( 'slots' );
					maybeUpdateScreen( 'refreshes' );
				}
				break;
			case 'pageTargetingData':
				if ( msg.payload.data.targets ) {
					adData.pageTargeting = msg.payload.data.targets;
					maybeUpdateScreen( 'slots' );
					maybeUpdateScreen( 'refreshes' );
					maybeUpdateScreen( 'overview' );
					skipDetermineIssues = 1;
				}
				break;
			default:
				outputDataToScreen( msg );
				break;
		}
	} else {
		outputDataToScreen( msg );
	}
	if ( ! skipDetermineIssues ) {
		determineIssues();
		maybeUpdateMenuText( 'issues' );
		maybeUpdateScreen( 'issues' );
	}
}

/**
 * Update the screen if data came in that impacts the current screen.
 *
 * @param {string} screen Name of the screen that is impacted by recently
 *                        updated data.
 * @return {void}
 */
function maybeUpdateScreen( screen ) {
	if ( screen !== currentScreen ) {
		// Only update if data coming in is for the current screen.
		return;
	}
	changeScreen( screen );
}

/**
 * Update the menu text links which can show counts, such as refresh count.
 *
 * @param {string} item Name of a menu item, corresponds to screen names.
 *
 * @return {void}
 */
function maybeUpdateMenuText( item ) {
	var toUpdate,
		currentLength,
		span,
		text,
		newLabel;

	if ( ! item || 'refreshes' === item ) {
		currentLength = adData.refreshes.length;
		if ( ! UIState.refreshesShown ||
				UIState.refreshesShown !== currentLength ) {
			UIState.refreshesShown = currentLength;
			toUpdate = menuElement.querySelector( 'a[href="#refreshes"]' );
			newLabel = document.createDocumentFragment();
			span = document.createElement( 'span' );
			span.className = 'notice notice--refreshes';
			if ( currentLength > 0 ) {
				span.className += ' notice--new';
			}
			span.appendChild( document.createTextNode( currentLength ) );
			newLabel.appendChild( span );
			text = currentLength > 1 ? 'Refreshes' : 'Refresh';
			newLabel.appendChild( document.createTextNode( text ) );
			emptyElement( toUpdate );
			toUpdate.appendChild( newLabel );
		}
	}

	if ( ! item || 'slots' === item ) {
		currentLength = Object.keys( adData.slots ).length;
		if ( ! UIState.slotsShown || UIState.slotsShown !== currentLength ) {
			UIState.slotsShown = currentLength;
			toUpdate = menuElement.querySelector( 'a[href="#slots"]' );
			newLabel = document.createDocumentFragment();
			span = document.createElement( 'span' );
			span.className = 'notice notice--slots';
			if ( currentLength > 0 ) {
				span.className += ' notice--new';
			}
			span.appendChild( document.createTextNode( currentLength ) );
			newLabel.appendChild( span );
			text = currentLength > 1 ? 'Slots' : 'slot';
			newLabel.appendChild( document.createTextNode( text ) );
			emptyElement( toUpdate );
			toUpdate.appendChild( newLabel );
		}
	}

	if ( ! item || 'issues' === item ) {
		var warningsLength = Object.keys( issues.warnings ).length,
			errorsLength = Object.keys( issues.errors ).length;
		currentLength = warningsLength + errorsLength;
		if ( ! UIState.issuesShown ||
				UIState.issuesShown !== currentLength ) {
			UIState.slotsShown = currentLength;
			toUpdate = menuElement.querySelector( 'a[href="#issues"]' );
			newLabel = document.createDocumentFragment();
			span = document.createElement( 'span' );
			span.className = 'notice notice--issues';
			if ( currentLength > 0 ) {
				span.className += ' notice--new';
			}
			if ( errorsLength > 0 ) {
				span.className += ' notice--error';
			}
			span.appendChild( document.createTextNode( currentLength ) );
			newLabel.appendChild( span );
			text = currentLength > 1 ? 'Issues' : 'Issue';
			newLabel.appendChild( document.createTextNode( text ) );
			emptyElement( toUpdate );
			toUpdate.appendChild( newLabel );
		}
	}
}

/**
 * Update the data stored for a slot with the data passed into this function.
 *
 * @param {string} name The name of a slot, corresponds to slot ID.
 * @param {object} data The data to be used for the slot.
 *
 * @return {void}
 */
function updateSlotInfo( name, data ) {
	if ( ! name || ! data ) {
		return;
	}

	if ( ! adData.slots[ name ] ) {
		adData.slots[ name ] = {};
	}
	adData.slots[ name ] = data;
}

/**
 * Set variables to their default state.
 *
 * This needs to happen because a page refresh does not cause a refresh in the
 * panel, so the panel's variables must be reset to keep from carrying over
 * data from the previous page view.
 *
 * @param {object} data Optional. Data about the page at the time it was loaded.
 *
 * @return {void}
 */
function setupVariables( data ) {
	UIState = {
		refreshesShown: 0,
		slotsShown: 0,
		issuesShown: 0
	};
	issues = {
		warnings: {},
		errors: {}
	};
	adData = {
		slots: {},
		refreshes: [],
		enabledServices: [],
		disabledInitialLoad: [],
		enabledSingleRequest: [],
		collapseEmptyDivs: []
	};
	if ( data && data.pageLoadTimestamp ) {
		adData.pageLoadTimestamp = data.pageLoadTimestamp;
	}
	if ( data && data.pageURL ) {
		adData.pageURL = data.pageURL;
	}
}

/**
 * Get the menu's DOM node.
 *
 * @return {HTMLElement} The menu's DOM node.
 */
function getMenuElement() {
	return menuElement ? menuElement : document.getElementById( 'menu' );
}

/**
 * Attach the event listeners for the menu.
 *
 * @return {void}
 */
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
	} );
}

/**
 * Fallback function. Converts JSON data to a string and outputs to the panel.
 *
 * @param {object} data JSON data to display on the screen.
 *
 * @return {void}
 */
function outputDataToScreen( data ) {
	document.body.innerHTML += 'No incoming message handler for the following data:<br><br>' + JSON.stringify( data, null, 4 );
}

/**
 * Generate a document fragment containing the refresh screen DOM nodes.
 *
 * @return {DocumentFragment} The DOM nodes for the refresh screen.
 */
function generateRefreshesScreen() {
	if ( ! adData || ! adData.refreshes ) {
		var noRefreshes = document.createElement( 'p' );
		var explanation = document.createTextNode( 'No ad refreshes yet.' );
		noRefreshes.appendChild( explanation );
		return noRefreshes;
	}
	var i, length, s, slots, slotCount, sizeMappings, target, refreshListItem,
		refreshLabel, text, refreshSlotList, pageTimeDiffMs, pageTimeDiffSecs,
		whenRefreshed;

	var toReturn = document.createDocumentFragment();

	var refreshList = document.createDocumentFragment();

	for ( i = 0, length = adData.refreshes.length; i < length; i++ ) {

		if ( i > 0 ) {
			refreshList.appendChild(
				buildTimeIntervalListItem( adData.refreshes, i )
			);
		}

		slots = adData.refreshes[ i ].slotIds;
		slotCount = slots ? slots.length : 0;

		refreshListItem = document.createElement( 'div' );
		refreshListItem.className = 'refresh-item card';
		refreshListItem.id = 'refresh-' + ( i + 1 );
		refreshLabel = document.createElement( 'h2' );
		text = 'Refresh ' + ( i + 1 ) + ' of ' + length + ' ' + dash + ' ' + slotCount + ' slots';
		refreshLabel.appendChild( document.createTextNode( text ) );
		refreshLabel.className = 'refresh-label';
		refreshListItem.appendChild( refreshLabel );

		// Time since page load.
		pageTimeDiffMs = adData.refreshes[ i ].timestamp - adData.pageLoadTimestamp;
		pageTimeDiffSecs = Math.round( pageTimeDiffMs / 1000 * 100 ) / 100;
		if ( 0 !== pageTimeDiffMs % 1000 ) {
			text = pageTimeDiffSecs + ' seconds (' + pageTimeDiffMs + 'ms)';
		} else {
			text = pageTimeDiffSecs + ' seconds';
		}
		// Might should change to since GPT loaded.
		text += ' after page load.';
		whenRefreshed = document.createElement( 'p' );
		whenRefreshed.className = 'refresh-sublabel';
		whenRefreshed.appendChild( document.createTextNode( text ) );
		refreshListItem.appendChild( whenRefreshed );

		refreshSlotList = document.createDocumentFragment();
		// Begin list of slots sent in this refresh.
		for ( s = 0; s < slotCount; s++ ) {
			refreshSlotList.appendChild(
				buildSlotListItem(
					adData.slots[ slots[ s ] ],
					i
				)
			);
		}
		refreshListItem.appendChild( refreshSlotList );

		refreshList.appendChild( refreshListItem );
	}

	toReturn.appendChild( refreshList );

	return toReturn;
}

/**
 * Build the LI node representing a slot's data.
 *
 * @param {object} slot         A slot's data.
 * @param {number} refreshIndex Optional. Index of the refreshes array that
 *                              this slot is being displayed for.
 *
 * @return {HTMLElement} LI element containing the slot's data.
 */
function buildSlotListItem( slot, refreshIndex ) {
	var text, labelValue;

	var slotListItem = document.createElement( 'div' );
	slotListItem.className = 'tree-with-children card';

	if ( refreshIndex ) {
		slotListItem.id = 'refresh-' + ( refreshIndex + 1 ) + '_' + slot.elementId;
	} else {
		slotListItem.id = slot.elementId;
	}

	var plusSign = document.createElement( 'span' );
	plusSign.className = 'tree-plus-sign';
	slotListItem.appendChild( plusSign );
	var slotName = document.createTextNode( 'Slot: ' + slot.elementId );
	slotListItem.appendChild( slotName );

	var slotOptions = document.createElement( 'div' );
	slotOptions.className = 'slot-options';

	var slotHighlightLink = document.createElement( 'span' );
	text = 'Highlight slot in page';
	slotHighlightLink.appendChild( document.createTextNode( text ) );
	slotHighlightLink.className = 'highlight-slot-link';
	slotHighlightLink.addEventListener( 'click', function() {
		sendToBackground( { action: 'highlightSlot', data: slot.elementId } );
	} );
	slotOptions.appendChild( slotHighlightLink );
	slotListItem.appendChild( slotOptions );

	var slotInfoList = document.createElement( 'ul' );

	var adUnit = document.createElement( 'li' );
	labelValue = createLabelAndValue( 'Ad Unit:', slot.adUnitPath );
	adUnit.appendChild( labelValue );
	slotInfoList.appendChild( adUnit );

	var elementId = document.createElement( 'li' );
	labelValue = createLabelAndValue( 'DOM ID:', slot.elementId );
	elementId.appendChild( labelValue );
	slotInfoList.appendChild( elementId );

	if ( slot.refreshedIndexes ) {
		var previousRefreshes = document.createElement( 'li' );

		var count = adData.slots[ slot.elementId ].refreshedIndexes.length ?
				adData.slots[ slot.elementId ].refreshedIndexes.length : 0;
		labelValue = createLabelAndValue( 'Fetches:', count );
		previousRefreshes.appendChild( labelValue );
		previousRefreshes.appendChild(
			buildRefreshResultList( slot.elementId, refreshIndex )
		);
		slotInfoList.appendChild( previousRefreshes );
	}

	if ( slot.targeting ) {
		var targeting = document.createElement( 'li' );
		labelValue = createLabelAndValue(
			'Key-Value Targeting:',
			buildKeyTargetingList( slot.targeting )
		);
		targeting.appendChild( labelValue );
		slotInfoList.appendChild( targeting );
	}

	if ( slot.sizeMappings ) {
		var sizeMapping = document.createElement( 'li' );
		labelValue = createLabelAndValue(
			'Size Mapping:',
			buildSizeMappingList( slot.sizeMappings[0] )
		);
		sizeMapping.appendChild( labelValue );
		slotInfoList.appendChild( sizeMapping );
	}

	if ( slot.fallbackSize ) {
		var fallbackSizes = document.createElement( 'li' );
		labelValue = createLabelAndValue(
			'Default Sizes:',
			buildFallbackSizeList( slot.fallbackSize )
		);
		fallbackSizes.appendChild( labelValue );
		slotInfoList.appendChild( fallbackSizes );
	}

	var collapseDiv = document.createElement( 'li' );
	if ( slot.collapseEmptyDiv || ( adData.collapseEmptyDivs &&
			adData.collapseEmptyDivs.timestamp &&
			! adData.collapseEmptyDivs.error ) ) {
		text = 'Yes';

		if ( 'before' === slot.collapseEmptyDiv || ( adData.collapseEmptyDivs &&
			adData.collapseEmptyDivs.before ) ) {
			text += ', before ad is fetched';
		}
	} else {
		text = 'No';
	}
	labelValue = createLabelAndValue( 'Collapse if Empty:', text );
	collapseDiv.appendChild( labelValue );
	slotInfoList.appendChild( collapseDiv );

	if ( slot.outOfPage ) {
		var outOfPage = document.createElement( 'li' );
		labelValue = createLabelAndValue( 'Out of Page Slot:', 'Yes' );
		outOfPage.appendChild( labelValue );
		slotInfoList.appendChild( outOfPage );
	}

	slotListItem.appendChild( slotInfoList );

	return slotListItem;
}

/**
 * Build the UL node representing the results of a slot's refreshes.
 *
 * @param {string} slotId       The slot's element ID.
 * @param {number} refreshIndex Optional. Index of the refreshes array that
 *                              this slot is being displayed for.
 *
 * @return {HTMLElement} UL element containing the slot's refresh results.
 */
function buildRefreshResultList( slotId, refreshIndex ) {
	var item, text, detailList, detail, ms, seconds, card, refreshResultList, fragment, labelValue, label;

	if ( ! adData.slots[ slotId ] ) {
		return document.createElement( 'div' );
	}
	var refreshResults = adData.slots[ slotId ].refreshResults;

	fragment = document.createDocumentFragment();

	for ( var i = 0, length = refreshResults.length; i < length; i++ ) {
		if ( 'undefined' !== typeof refreshIndex &&
				refreshResults[ i ].overallRefreshIndex !== refreshIndex ) {
			continue;
		}
		card = document.createElement( 'div' );
		card.className = 'card';
		refreshResultList = document.createElement( 'ul' );
		item = document.createElement( 'li' );
		label = document.createElement( 'h3' );
		label.className = 'fetch-label';
		text = 'Fetch #' + ( i + 1 ) + ', part of refresh batch #' +
			( refreshResults[ i ].overallRefreshIndex + 1 );
		label.appendChild( document.createTextNode( text ) );
		card.appendChild( label );
		detailList = document.createDocumentFragment();

		if ( refreshResults[ i ].isEmpty ) {
			detail = document.createElement( 'li' );
			text = 'No creative returned.';
			detail.appendChild( document.createTextNode( text ) );
			detailList.appendChild( detail );
		} else {
			if ( refreshResults[ i ].onloadTimestamp ) {
				ms = refreshResults[ i ].onloadTimestamp -
				refreshResults[ i ].renderEndedTimestamp;
				seconds = Math.round( ms / 1000 * 100 ) / 100;
				detail = document.createElement( 'li' );
				labelValue = createLabelAndValue(
					'Load time:',
					seconds + ' seconds (' + ms + 'ms)'
				);
				detail.appendChild( labelValue );
				detailList.appendChild( detail );
			}

			detail = document.createElement( 'li' );
			labelValue = createLabelAndValue(
				'Viewed',
				refreshResults[ i ].viewed ? 'Yes' : 'No'
			);
			detail.appendChild( labelValue );
			detailList.appendChild( detail );

			detail = document.createElement( 'li' );
			labelValue = createLabelAndValue(
				'Creative ID:',
				refreshResults[ i ].creativeId
			);
			detail.appendChild( labelValue );
			detailList.appendChild( detail );

			detail = document.createElement( 'li' );
			labelValue = createLabelAndValue(
				'Line Item ID:',
				refreshResults[ i ].lineItemId
			);
			detail.appendChild( labelValue );
			detailList.appendChild( detail );

			detail = document.createElement( 'li' );
			labelValue = createLabelAndValue(
				'Advertiser ID:',
				refreshResults[ i ].advertiserId
			);
			detail.appendChild( labelValue );
			detailList.appendChild( detail );

			detail = document.createElement( 'li' );
			labelValue = createLabelAndValue(
				'Campaign ID:',
				refreshResults[ i ].campaignId
			);
			detail.appendChild( labelValue );
			detailList.appendChild( detail );

			if ( refreshResults[ i ].size &&
					Array.isArray( refreshResults[ i ].size ) ) {
				detail = document.createElement( 'li' );
				if ( refreshResults[ i ].size[0] && 0 !== refreshResults[ i ].size[0] ) {
					text = buildSizePairText(
							refreshResults[ i ].size[0],
							refreshResults[ i ].size[1]
					);
				} else {
					if ( adData.slots[ slotId ].fallbackSize &&
							-1 !== adData.slots[ slotId ].fallbackSize.indexOf( 'fluid' ) ) {
						text = 'fluid';
					} else {
						text = buildSizePairText(
								refreshResults[ i ].size[0],
								refreshResults[ i ].size[1]
						);
					}
				}
				labelValue = createLabelAndValue(
					'Creative Size:',
					text
				);
				detail.appendChild( labelValue );
				detailList.appendChild( detail );
			}

			detail = document.createElement( 'li' );
			text = refreshResults[ i ].isBackfill ? 'Yes' : 'No';
			labelValue = createLabelAndValue(
				'Backfill:',
				text
			);
			detail.appendChild( labelValue );
			detailList.appendChild( detail );

			if ( refreshResults[ i ].labelIds ) {
				detail = document.createElement( 'li' );
				if ( Array.isArray( refreshResults[ i ].labelIds ) ) {
					text = refreshResults[ i ].labelIds.join( ', ' );
				} else {
					text = refreshResults[ i ].labelIds;
				}
				labelValue = createLabelAndValue(
					'Label IDs:',
					text
				);
				detail.appendChild( labelValue );
				detailList.appendChild( detail );
			}
		}

		item.appendChild( detailList );
		refreshResultList.appendChild( item );
		card.appendChild( refreshResultList );
		fragment.appendChild( card );
	}


	return fragment;
}

/**
 * Build the LI node showing the time that passed between refreshes.
 *
 * @param {array}  refreshes Refreshes data,
 * @param {number} i         Index of the current refresh.
 *
 * @return {HTMLElement} LI element showing the time between refreshes.
 */
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

	timeListItem = document.createElement( 'div' );
	timeListItem.className = 'tree-time-diff';
	timeListItem.appendChild( document.createTextNode( timeDiffText ) );

	return timeListItem;
}

/**
 * Build a nested list from targeting data passed into it.
 *
 * @param {object} targets Key-value targeting data.
 *
 * @return {HTMLElement} UL element listing key-value targets.
 */
function buildKeyTargetingList( targets ) {
	var targetingList = document.createElement( 'ul' ),
		targetingItem, text, valueList, valueItem,
		i, length;

	targetingList.className = 'bulleted';

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

/**
 * Build an UL list containing the sizes an ad will use if no sizeMapping is
 * set.
 *
 * @param {array} sizes List of sizes.
 *
 * @return {HTMLElement} UL element listing the sizes.
 */
function buildFallbackSizeList( sizes ) {
	var sizeList = document.createElement( 'ul' ),
		sizeItem, size;

	sizeList.className = 'bulleted';

	if ( ! Array.isArray( sizes ) ) {
		sizeItem = document.createElement( 'li' );
		sizeItem.appendChild( document.createTextNode( sizes ) );
		sizeList.appendChild( sizeItem );
	} else {
		for ( var i = 0, length = sizes.length; i < length; i++ ) {
			sizeItem = document.createElement( 'li' );
			if ( ! Array.isArray( sizes[ i ] ) ) {
				size = sizes[ i ];
				if ( sizes[ i + 1 ] ) {
					size = buildSizePairText( sizes[ i ], sizes[ i + 1 ] );
				}
				i = length;
			} else {
				size = buildSizePairText( sizes[ i ][0], sizes[ i ][1] );
			}
			sizeItem.appendChild( document.createTextNode( size ) );

			sizeList.appendChild( sizeItem );
		}
	}

	return sizeList;
}

/**
 * Build the string representation of a sizing pair.
 *
 * @param {number} first  First size.
 * @param {number} second Second size.
 *
 * @param {string} String representation of the sizing pair.
 */
function buildSizePairText( first, second ) {
	if ( ! first ) {
		return 'No size. Do not show ad.';
	} else {
		return first + 'x' + second;
	}
}

/**
 * Build an UL list containing the size mapping set for a slot.
 *
 * @param {array} sizes List of sizes. Very deeply nested.
 *
 * @return {HTMLElement} UL element listing the sizes.
 */
function buildSizeMappingList( sizeMapping ) {
	var screenSizeList = document.createElement( 'ul' ),
		screenSizeItem, screenSize, adSize, adSizeList, adSizeItem;

	screenSizeList.className = 'bulleted';

	for ( var j = 0, jlength = sizeMapping.length; j < jlength; j++ ) {
		screenSizeItem = document.createElement( 'li' );
		screenSize = sizeMapping[ j ][0][0] + 'x' + sizeMapping[ j ][0][1] + ':';
		screenSizeItem.appendChild( document.createTextNode( screenSize ) );

		adSizeList = document.createElement( 'ul' );
		if ( ! Array.isArray( sizeMapping[ j ][1][0] ) ) {
			adSizeItem = document.createElement( 'li' );
			adSize = buildSizePairText(
				sizeMapping[ j ][1][0],
				sizeMapping[ j ][1][1]
			);
			adSizeItem.appendChild( document.createTextNode( adSize ) );
			adSizeList.appendChild( adSizeItem );
		} else {
			for ( var l = 0, llength = sizeMapping[ j ][1].length; l < llength; l++ ) {
				adSizeItem = document.createElement( 'li' );
				adSize = sizeMapping[ j ][1][ l ][0] + 'x' + sizeMapping[ j ][1][ l ][1];
				adSize = buildSizePairText(
					sizeMapping[ j ][1][ l ][0],
					sizeMapping[ j ][1][ l ][1]
				);
				adSizeItem.appendChild( document.createTextNode( adSize ) );
				adSizeList.appendChild( adSizeItem );
			}
		}
		screenSizeItem.appendChild( adSizeList );
		screenSizeList.appendChild( screenSizeItem );
	}

	return screenSizeList;
}

/**
 * Generate a document fragment containing the slots screen DOM nodes.
 *
 * @return {DocumentFragment} The DOM nodes for the slots screen.
 */
function generateSlotsScreen() {
	var toReturn = document.createDocumentFragment();

	if ( ! adData || ! adData.slots || 0 === Object.keys( adData.slots ).length ) {
		var noSlots = document.createElement( 'p' );
		var explanation = document.createTextNode( 'No slot data received yet.' );
		noSlots.appendChild( explanation );
		return noSlots;
	}

	var slotList = document.createElement( 'div' );
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

/**
 * Generate a document fragment containing the overview screen DOM nodes.
 *
 * @return {DocumentFragment} The DOM nodes for the overview screen.
 */
function generateOverviewScreen() {
	var text, list, item;
	var fragment = document.createDocumentFragment();
	var overview = document.createElement( 'div' );
	overview.className = 'card';

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

	var enabledSingleRequest = 'No';
	if ( adData.enabledSingleRequest && adData.enabledSingleRequest.length > 0 ) {
		enabledSingleRequest = 'Yes';
		if ( adData.enabledServices && adData.enabledServices.length > 0 &&
				adData.enabledSingleRequest[0] > adData.enabledServices[0] ) {
			enabledSingleRequest = 'No, error detected. See issues.';
		}
	}
	item = document.createElement( 'li' );
	item.appendChild( createLabelAndValue( 'Single Request Mode? ', enabledSingleRequest ) );
	list.appendChild( item );

	if ( adData.pageTargeting &&
			Object.keys( adData.pageTargeting ).length > 0 ) {
		item = document.createElement( 'li' );
		text = 'Page-wide Key-Value Targeting:';
		var targeting = buildKeyTargetingList( adData.pageTargeting );
		item.appendChild(
			createLabelAndValue( text, targeting )
		);

		list.appendChild( item );
	}

	overview.appendChild( list );
	fragment.appendChild( overview );

	var img = document.createElement( 'img' );
	img.src = 'img/dfpeep-logo.svg';
	img.className = 'logo';
	fragment.appendChild( img );


	return fragment;
}

/**
 * Generate a document fragment containing the issues screen DOM nodes.
 *
 * @return {DocumentFragment} The DOM nodes for the issues screen.
 */
function generateIssuesScreen() {
	var title, text, intro,
		toReturn = document.createDocumentFragment(),
		errorCount = Object.keys( issues.errors ).length,
		warningCount = Object.keys( issues.warnings ).length;

	title = document.createElement( 'h2' );
	title.appendChild( document.createTextNode( 'Issues:' ) );
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
		title.className = 'issue-section-title';
		toReturn.appendChild( title );
		toReturn.appendChild(
			buildIssueList( issues.errors, 'error' )
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
		title.className = 'issue-section-title';
		toReturn.appendChild( title );
		toReturn.appendChild(
			buildIssueList( issues.warnings, 'warning' )
		);
	}

	return toReturn;
}

/**
 * Build an UL list representing the currently discovered issues.
 *
 * @param {object} issueData An object representing a subset of the data on
 *                           the issues found.
 * @param {string} type      The type of issue. warning or error.
 *
 * @return {HTMLElement} UL element listing the errors.
 */
function buildIssueList( issueData, type ) {
	var listItem, title;
	var list = document.createElement( 'div' );
	list.className = type + '-list issue-list';

	for ( var issue in issueData ) {
		if ( ! issueData.hasOwnProperty( issue ) ) {
			continue;
		}

		listItem = document.createElement( 'div' );
		listItem.className = 'card';

		title = document.createElement( 'h4' );
		title.className = type + '-title issue-title';
		title.appendChild( document.createTextNode( issueData[ issue ].title ) );
		listItem.appendChild( title );

		listItem.appendChild( issueData[ issue ].description.cloneNode( true ) );
		list.appendChild( listItem );
	}

	return list;
}

/**
 * Change the screen being displayed.
 *
 * @param {string} screen Name of the screen to show.
 *
 * @return {void}
 */
function changeScreen( screen ) {
	var nextScreen = screen;
	switch ( screen ) {
		case 'init':
			nextScreen = 'overview';
			setupMenuEventListeners();
			displayContent( generateOverviewScreen(), nextScreen );
			break;
		case 'refreshes':
			displayContent( generateRefreshesScreen(), nextScreen );
			break;
		case 'slots':
			displayContent( generateSlotsScreen(), nextScreen );
			break;
		case 'issues':
			displayContent( generateIssuesScreen(), nextScreen );
			break;
		case 'overview':
			displayContent( generateOverviewScreen(), nextScreen );
			break;
		default:
			changeScreen( 'overview' );
			return;
	}
	nextScreen = nextScreen ? nextScreen : screen;
	changeSelectedMenuItem( nextScreen );
	currentScreen = nextScreen;
}

/**
 * Change the visual representation of which menu item is selected.
 *
 * @param {string} menuItem Name of the menu item.
 *
 * @return {void}
 */
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

	var notice = newlySelected.querySelector( '.notice' );
	if ( notice ) {
		if ( notice.classList.contains( 'notice--new' ) ) {
			notice.classList.remove( 'notice--new' );
		}
	}
}

/**
 * Display content within the content area.
 *
 * If this is outputting data for the same screen that is already being
 * displayed then preserve expanded elements and make the screen update
 * as smooth as possible.
 *
 * @param {DocumentFragment} content    The DOM nodes to insert into the content
 *                                      element.
 * @param {string}           nextScreen Name of screen being changed to.
 */
function displayContent( content, nextScreen ) {
	var expandedElementIds;
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
	if ( nextScreen === currentScreen ) {
		expandedElementIds = getExpandedElementIds( contentElement );
	}
	emptyElement( contentElement );
	makeCollapsible( content, nextScreen );
	if ( nextScreen === currentScreen && expandedElementIds ) {
		reExpandElements( content, expandedElementIds );
	}
	contentElement.appendChild( content );
}

/**
 * Get a list of DOM element IDs that represent expanded items within a tree
 * list.
 *
 * @param {HTMLElement} content The content to search for expanded tree items.
 *
 * @return {array} List of element IDs.
 */
function getExpandedElementIds( content ) {
	var expandedIds = [];
	var expandedElements = content.querySelectorAll( '.tree-plus-sign--expanded' );
	if ( ! expandedElements ) {
		return;
	}
	for ( var i = 0, length = expandedElements.length; i < length; i++ ) {
		expandedIds.push( expandedElements[ i ].parentElement.id );
	}
	return expandedIds;
}

/**
 * Expand tree element list items within a piece of content.
 *
 * This is used on content being inserted into the panel so that the new content
 * will preserve the expanded elements.
 *
 * @param {DocumentFragment} content            The content in which to
 *                                              expand items.
 * @param {array}            expandedElementIds The list of element ids.
 *
 * @return {void}
 */
function reExpandElements( content, expandedElementIds ) {
	var element, plusSign, hidden;

	for ( var i = 0, length = expandedElementIds.length; i < length; i++ ) {
		element = content.getElementById( expandedElementIds[ i ] );
		if ( ! element ) {
			continue;
		}

		plusSign = element.querySelector( '.tree-plus-sign' );
		if ( plusSign ) {
			plusSign.className += ' tree-plus-sign--expanded';
		}

		hidden = element.querySelector( '.tree-hidden' );
		if ( hidden ) {
			hidden.classList.remove( 'tree-hidden' );
		}
	}
}

/**
 * Initialize the content area.
 *
 * Adds event listeners and stored a reference to the content element.
 *
 * @return {void}
 */
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

	contentElement.addEventListener( 'click', function( e ) {
		if ( e.target && 'A' === e.target.nodeName ) {
			var rel = e.target.getAttribute( 'rel' );
			if ( ! rel || 'panel' !== rel ) {
				return;
			}
			e.preventDefault();
			var targetScreen = e.target.hash.replace( '#', '' );
			var id = e.target.getAttribute( 'data-ref' );
			if ( id ) {
				changeScreen( targetScreen, id );
			} else {
				changeScreen( targetScreen );
			}
		}
	} );
}

/**
 * Empty the children from a DOM element.
 *
 * @param {HTMLElement} element DOM element to have its children removed.
 *
 * @return {void}
 */
function emptyElement( element ) {
	while ( element.firstChild ) {
		element.removeChild( element.firstChild );
	}
}

/**
 * For screens possibly having collapsible items, hide any children that should
 * be collapsed.
 *
 * @param {HTMLElement} content DOM node holding the content.
 * @param {string}      screen  Name of the screen being displayed.
 *
 * @return {void}
 */
function makeCollapsible( content, screen ) {
	var exclude = [ 'issues' ];
	if ( screen && -1 !== exclude.indexOf( screen ) ) {
		return;
	}
	if ( ! content ) {
		content = document;
	}
	var listsToHide = content.querySelectorAll( '.tree-with-children' );
	for ( var i = 0, length = listsToHide.length; i < length; i++ ) {
		listsToHide[ i ].querySelector( 'ul' ).classList.add( 'tree-hidden' );
	}
}

/**
 * Call all functions necessary for checking for ad implementation issues.
 *
 * @return {void}
 */
function determineIssues() {
	checkForLateDisableInitialLoad();
	checkForLateCollapseEmptyDivs();
	checkForMoveAfterRender();
	checkForLateEnableSingleRequest();
	checkForDuplicateFetches();
	checkForCreativesWiderThanViewport();
}

/**
 * Check to see if googletag.pubads().disableInitialLoad() was called
 * after googletag.enableServices().
 *
 * @return {void}
 */
function checkForLateDisableInitialLoad() {
	if ( issues.warnings.lateDisableInitialLoad ) {
		return;
	}

	if ( 0 === adData.disabledInitialLoad.length ||
			0 === adData.enabledServices.length ) {
		return;
	}

	if ( adData.enabledServices[0] < adData.disabledInitialLoad[0] ) {
		var description = document.createElement( 'p' );
		var text = 'googletag.pubads().disableInitialLoad() likely had no effect because it was called after googletag.enableServices(), but it could have still worked for any slots that called googletag.display() after googletag.pubads().disableInitialLoad().';
		description.appendChild( document.createTextNode( text ) );

		issues.warnings.lateDisableInitialLoad = {
			title: 'Disabled Initial Load Too Late',
			description: description
		};
	}
}

/**
 * Check to see if googletag.pubads().enableSingleRequest() was called
 * after googletag.enableServices().
 *
 * @return {void}
 */
function checkForLateEnableSingleRequest() {
	if ( issues.errors.lateEnableSingleRequest ) {
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

		issues.errors.lateEnableSingleRequest = {
			title: 'Enabled Single Request Mode Too Late',
			description: description
		};
	}
}

/**
 * Check to see if googletag.pubads().collapseEmptyDivs() was called
 * after googletag.enableServices().
 *
 * @return {void}
 */
function checkForLateCollapseEmptyDivs() {
	if ( issues.errors.lateCollapseEmptyDivs ) {
		return;
	}

	if ( ! adData.collapseEmptyDivs.timestamp ||
			0 === adData.collapseEmptyDivs.timestamp.length ||
			0 === adData.enabledServices.length ) {
		return;
	}

	if ( adData.enabledServices[0] < adData.collapseEmptyDivs.timestamp[0] ) {
		var description = document.createElement( 'p' );
		var text = 'googletag.pubads().collapseEmptyDivs() had no effect because it was called after googletag.enableServices().';
		description.appendChild( document.createTextNode( text ) );

		issues.errors.lateCollapseEmptyDivs = {
			title: 'Enabled Collapsing of Slot Divs if Empty Too Late',
			description: description
		};
	}
}

/**
 * Check to see if a slot was moved within the DOM after the slot was fetched,
 * causing the slot's iFrame to reload and no longer display the creative.
 *
 * @return {void}
 */
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
		issues.warnings.lateDisableInitialLoad = {
			title: 'Moved Slot Element After Rendered In DOM',
			description: fragment
		};

		return fragment;
	}
}

/**
 * Check to see if any slots have been fetched more than once.
 *
 * @return {void}
 */
function checkForDuplicateFetches() {
	var slot, text,
		offendingSlots = [],
		slotNames = Object.keys( adData.slots ).sort();

	for ( var i = 0, length = slotNames.length; i < length; i++ ) {
		slot = adData.slots[ slotNames[ i ] ];
		if ( Array.isArray( slot.refreshedIndexes ) && slot.refreshedIndexes.length > 1 ) {
			offendingSlots.push(
				{ id: slotNames[ i ], count: slot.refreshedIndexes.length }
			);
		}
	}

	if ( offendingSlots.length > 0 ) {
		var fragment = document.createDocumentFragment();
		var description = document.createElement( 'p' );
		text = 'The following slots were fetched more than once. You should confirm that this was intentional.';
		description.appendChild( document.createTextNode( text ) );
		fragment.appendChild( description );

		var list = document.createElement( 'ul' ),
			listItem;

		for ( var d = 0, dlength = offendingSlots.length; d < dlength; d++ ) {
			listItem = document.createElement( 'li' );
			text = offendingSlots[ d ].id + ' ' + dash + ' ' +
				offendingSlots[ d ].count + ' fetches';
			listItem.appendChild( document.createTextNode( text ) );
			list.appendChild( listItem );
		}
		fragment.appendChild( list );

		issues.warnings.duplicateAdFetch = {
			title: 'Duplicate Ad Slot Fetches',
			description: fragment
		};

		return fragment;
	}
}

/**
 * Check to see if any creatives came in wider than the viewport width.
 *
 * @return {void}
 */
function checkForCreativesWiderThanViewport() {
	var slot, text, i, length, r, rlength,
		offendingSlots = {},
		slotNames = Object.keys( adData.slots ).sort();

	for ( i = 0, length = slotNames.length; i < length; i++ ) {
		slot = adData.slots[ slotNames[ i ] ];
		if ( ! Array.isArray( slot.refreshResults ) ) {
			continue;
		}
		for ( r = 0, rlength = slot.refreshResults.length; r < rlength; r++ ) {
			if ( slot.refreshResults[ r ].isEmpty ) {
				continue;
			}
			if ( slot.refreshResults[ r ].size[0] > slot.refreshResults[ r ].documentWidth ) {
				if ( ! offendingSlots[ slotNames[ i ] ] ) {
					offendingSlots[ slotNames[ i ] ] = { refreshes: [] };
				}
				offendingSlots[ slotNames[ i ] ].refreshes.push( ( r + 1 ) );
			}
		}
	}

	var offendingNames = Object.keys( offendingSlots ).sort();

	if ( offendingNames.length > 0 ) {
		var fragment = document.createDocumentFragment();
		var description = document.createElement( 'p' );
		text = 'The following slots received creatives wider than the viewport, limiting the percentage viewable for the ad.';
		description.appendChild( document.createTextNode( text ) );
		fragment.appendChild( description );

		var list = document.createElement( 'ul' ),
			listItem;

		for ( var d = 0, dlength = offendingNames.length; d < dlength; d++ ) {
			listItem = document.createElement( 'li' );
			text = offendingNames[ d ] + ' during following fetches: ' +
			offendingSlots[ offendingNames[ d ] ].refreshes.join( ', ' );
			listItem.appendChild( document.createTextNode( text ) );
			list.appendChild( listItem );
		}
		fragment.appendChild( list );

		issues.warnings.tooWidecreative = {
			title: 'Creatives Wider Than Viewport',
			description: fragment
		};

		return fragment;
	}
}

/**
 * Create a document fragment representing a value and its label.
 *
 * @param {string}           label Label for the data.
 * @param {DocumentFragment} value A document fragment containing the value.
 *
 * @return {DocumentFragment} The label-value document fragment.
 */
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
