/**
 * Collects data from GPT tags on page and sends to content script.
 *
 * @since 0.1.0
 * @package DFPeep
 * @copyright 2017 David Green
 * @license MIT
 */

/* global googletag */
var DFPeep = ( function() {
	'use strict';

	window.googletag = window.googletag || {};
	window.googletag.cmd = window.googletag.cmd || [];

	var wrappedSlotFunctions,
		wrappedOutOfPageSlotFunctions,
		inited,
		debug = 0,
		activeAdIds = []; // Ids which have been refreshed at least once.

	var adData = {
		pageURL: window.location.href,
		pageLoadTimestamp: null,
		enabledServices: [],
		enabledSingleRequest: [],
		disabledInitialLoad: [],
		collapseEmptyDivs: {
			timestamp: []
		},
		slots: {}, // Make each slot an array to contain instance data for each refresh
		refreshes: [],
		pageTargeting: {},
		creatives: {}
	};

	var init = function() {
		if ( inited ) {
			return;
		}
		inited = 1;
		var timestamp = getTimestamp();
		listenForMessagesFromPanel();
		sendDataToDevTools(
			'newPageLoad',
			{
				pageLoadTimestamp: timestamp,
				pageURL: adData.pageURL
			}
		);
		adData.pageLoadTimestamp = timestamp;
		wrapGPTFunctions();
		addGPTListeners();
		setupMutationObservers();
	};

	var setupMutationObservers = function() {
		var observer = new MutationObserver( function( mutations ) {
			for ( var i = 0, length = mutations.length; i < length; i++ ) {
				var m = 0, mlength = mutations[ i ].addedNodes.length;
				for ( ; m < mlength; m++ ) {
					checkIfHasAdNode( mutations[ i ].addedNodes[ m ] );
				}
			}
		} );

		observer.observe(
			document.documentElement,
			{
				childList: true,
				subtree: true
			}
		);
	};

	var checkIfHasAdNode = function( addedNode ) {
		// Only check element nodes.
		if ( 1 === addedNode.nodeType ) {

			// Doing this loop here instead of abstracting to a function to
			// avoid the cost of calling it repeatedly for mutations
			// with large subtrees.
			for ( var i = 0, length = activeAdIds.length; i < length; i++ ) {
				if ( addedNode.id === activeAdIds[ i ] ) {
					indicateAdMovedInDOM( activeAdIds[ i ] );
					break;
				}
			}

			// Need to check all child nodes so the entire subtree will be
			// checked for ads.
			if ( addedNode.childNodes ) {
				var n = 0, nlength = addedNode.childNodes.length;
				for ( ; n < nlength; n++ ) {
					checkIfHasAdNode( addedNode.childNodes[ n ] );
				}
			}
		}
	};

	var indicateAdMovedInDOM = function( id ) {
		adData.slots[ id ].movedInDOM.push( getTimestamp() );
		sendSlotDataToDevTools( id, adData.slots[ id ] );
	};

	var addGPTListeners = function() {
		googletag.cmd.push(
			function() {
				listenImpressionViewable();
				listenSlotOnLoad();
				listenSlotRenderEnded();
			}
		);
	};

	var listenSlotOnLoad = function() {
		googletag.pubads().addEventListener(
			'slotOnload',
			processSlotOnLoad
		);
		googletag.companionAds().addEventListener(
			'slotOnload',
			processSlotOnLoad
		);
		googletag.content().addEventListener(
			'slotOnload',
			processSlotOnLoad
		);
	};

	var processSlotOnLoad = function( event ) {
		var elementId = event.slot.getSlotElementId();

		if ( ! elementId ) {
			return;
		}

		var whichRefresh;
		if ( 0 !== adData.slots[ elementId ].refreshedIndexes.length ) {
			whichRefresh = adData.slots[ elementId ].refreshedIndexes.length - 1;
		} else {
			whichRefresh = 0;
			if ( ! adData.refreshes || 0 === adData.refreshes.length ) {
				adData.refreshes[0] = {
					slotIds: []
				};
			}
			if ( -1 === adData.refreshes[0].slotIds.indexOf( adData.slots[ elementId ] ) ) {
				// var copyOfSlotData = Object.assign( {}, adData.slots[ elementId ] );
				adData.refreshes[0].slotIds.push( elementId );
				sendDataToDevTools( 'GPTRefreshUpdate', { index: 0, slot: elementId } );
			}
		}

		if ( ! adData.slots[ elementId ].refreshResults[ whichRefresh ] ) {
			adData.slots[ elementId ].refreshResults[ whichRefresh ] = {};
		}
		var refresh = adData.slots[ elementId ].refreshResults[ whichRefresh ];
		refresh.onloadTimestamp = getTimestamp();
		sendSlotDataToDevTools( elementId, adData.slots[ elementId ] );
		// TODO: Store creative info / load time
	};

	var listenSlotRenderEnded = function() {
		googletag.pubads().addEventListener(
			'slotRenderEnded',
			processSlotRenderEnded
		);
		googletag.companionAds().addEventListener(
			'slotRenderEnded',
			processSlotRenderEnded
		);
		googletag.content().addEventListener(
			'slotRenderEnded',
			processSlotRenderEnded
		);
	};

	var processSlotRenderEnded = function( event ) {
		var updateRefresh = 0,
			toSend, whichRefresh, newTimestamp;
		var elementId = event.slot.getSlotElementId();
		if ( ! elementId ) {
			return;
		}

		if ( -1 === activeAdIds.indexOf( elementId ) ) {
			// Make this slot eligible to be monitored for DOM mutations.
			activeAdIds.push( elementId );
		}

		if ( 0 !== adData.slots[ elementId ].refreshedIndexes.length ) {
			whichRefresh = adData.slots[ elementId ].refreshedIndexes.length - 1;
		} else {
			// Slot got rendered without a refresh call, meaning it must have
			// loaded in the initial load, bypassing the code we normally
			// run during refresh. Should abstract this so it's in one location.
			adData.slots[ elementId ].refreshedIndexes.push( 0 );
			whichRefresh = 0;
			adData.slots[ elementId ].adUnitPath = event.slot.getAdUnitPath();
			adData.slots[ elementId ].elementId = elementId;
			if ( ! adData.slots[ elementId ].targeting ) {
				adData.slots[ elementId ].targeting = {};
			}
			if ( ! adData.refreshes || 0 === adData.refreshes.length ) {
				if ( adData.enabledServices.length > 0 ) {
					newTimestamp = adData.enabledServices[ 0 ];
				} else {
					newTimestamp = getTimestamp();
				}

				adData.refreshes[0] = {
					timestamp: newTimestamp,
					slotIds: []
				};
			}

			setCurrentTargeting( event.slot, elementId );

			if ( 0 === adData.refreshes[0].slotIds.length ) {
				// copyOfSlotData = Object.assign( {}, adData.slots[ elementId ] );
				adData.refreshes[0].slotIds.push( elementId );
				updateRefresh = 1;
			}
			var slotNotInRefresh = 1;
			for ( var i = 0, length = adData.refreshes[0].slotIds.length; i < length; i++ ) {
				if ( adData.refreshes[0].slotIds[ i ] === elementId ) {
					slotNotInRefresh = 0;
				}
			}
			if ( slotNotInRefresh ) {
				adData.refreshes[0].slotIds.push( elementId );
				updateRefresh = 1;
			}
		}
		if ( ! adData.slots[ elementId ].refreshResults[ whichRefresh ] ) {
			adData.slots[ elementId ].refreshResults[ whichRefresh ] = {};
		}
		var refresh = adData.slots[ elementId ].refreshResults[ whichRefresh ];

		refresh.renderEndedTimestamp = getTimestamp();
		refresh.advertiserId = event.advertiserId;
		refresh.isEmpty = event.isEmpty;
		refresh.isBackfill = event.isBackfill;
		refresh.serviceName = event.serviceName;
		refresh.overallRefreshIndex = adData.slots[ elementId ].refreshedIndexes[ adData.slots[ elementId ].refreshedIndexes.length - 1 ];
		if ( ! event.isEmpty ) {
			refresh.advertiserId = event.advertiserId;
			refresh.campaignId = event.campaignId;
			refresh.creativeId = event.creativeId;
			refresh.labelIds = event.labelIds;
			refresh.lineItemId = event.lineItemId;
			refresh.size = event.size;
			refresh.sourceAgnosticCreativeId = event.sourceAgnosticCreativeId;
			refresh.sourceAgnosticLineItemId = event.sourceAgnosticLineItemId;
		}
		refresh.documentWidth = document.body.clientWidth;
		refresh.documentHeight = document.body.clientHeight;
		refresh.viewed = 0;

		if ( updateRefresh ) {
			// This was a refresh caused by initial load. Need
			// to pass the info along to the panel.
			toSend = {
				index: 0,
				slot: elementId,
				timestamp: adData.refreshes[0].timestamp
			};
			sendDataToDevTools( 'GPTRefreshUpdate', toSend );
		}
		sendSlotDataToDevTools( elementId, adData.slots[ elementId ] );

		if ( event.isEmpty ) {
			// No creative delivered so no creative data to store.
			return;
		}
		if ( ! adData.creatives[ event.creativeId ] ) {
			setupNewCreative( event.creativeId );
		}
		var creative = adData.creatives[ event.creativeId ];
		creative.id = event.creativeId;
		creative.campaignId = event.campaignId;
		creative.lineItemID = event.lineItemID;
		creative.sourceAgnosticCreativeId = event.sourceAgnosticCreativeId;
		creative.sourceAgnosticLineItemId = event.sourceAgnosticLineItemId;
		creative.slotRefreshedIndexes.push( whichRefresh );
		creative.overallRefreshedIndexes.push( adData.refreshes.length - 1 );

		// Store creative info.
		// Store campaign info?
	};

	var listenImpressionViewable = function() {
		googletag.pubads().addEventListener(
			'impressionViewable',
			processImpressionViewable
		);
		googletag.companionAds().addEventListener(
			'impressionViewable',
			processImpressionViewable
		);
		googletag.content().addEventListener(
			'impressionViewable',
			processImpressionViewable
		);
	};

	var processImpressionViewable = function( viewed ) {
		var slotName = viewed.slot.getSlotElementId();
		adData.slots[ slotName ].refreshResults[ adData.slots[ slotName ].refreshResults.length - 1 ].viewed = 1;
		// TODO: Store creative viewable info.
		sendSlotDataToDevTools( slotName, adData.slots[ slotName ] );
	};

	var wrapGPTFunctions = function() {
		googletag.cmd.push(
			function() {
				wrapGPTRefresh();
				wrapGPTEnableServices();
				wrapGPTDefineSlot();
				wrapGPTDefineOutOfPageSlot();
				wrapGPTSetTargeting();
				wrapGPTEnableSingleRequest();
				wrapGPTDisplay();
				wrapGPTDisableInitialLoad();
				wrapGPTCollapseEmptyDivs();
		} );
	};

	var wrapGPTRefresh = function() {
		var oldVersion = googletag.pubads().refresh;
		googletag.pubads().refresh = function() {
			var refreshData = {
				timestamp: getTimestamp(),
				slotIds: []
			};
			var slot,
				slotsData = [],
				i,
				length,
				slotElementId;

			var slotsRefreshed = arguments[0];
			if ( ! slotsRefreshed ) {
				// In case no argument was passed and all slots were refreshed.
				slotsRefreshed = googletag.pubads().getSlots();
			}

			for ( i = 0, length = slotsRefreshed.length; i < length; i++ ) {
				if ( ! slotsRefreshed[ i ].getSlotElementId ) {
					// Not a valid slot object.
					continue;
				}
				slotElementId = slotsRefreshed[ i ].getSlotElementId();
				slot = adData.slots[ slotElementId ];
				slot.adUnitPath = slotsRefreshed[ i ].getAdUnitPath();
				slot.elementId = slotElementId;
				slot.targeting = {};
				// Use length here, no length-1, because this refresh's data
				// has not been pushed to the adData.refreshes array yet.
				slot.refreshedIndexes.push( adData.refreshes.length );

				setCurrentTargeting( slotsRefreshed[ i ], slotElementId );

				// Indicate this ad ID is active so the DFPeep mutation observer
				// will begin looking for it.
				if ( -1 === activeAdIds.indexOf( slot.elementId ) ) {
					activeAdIds.push( slot.elementId );
				}

				slotsData.push( slot );
				refreshData.slotIds.push( slot.elementId );
			}
			adData.refreshes.push( refreshData );
			var toSend = Object.assign( {}, refreshData );
			toSend.slots = slotsData;
			sendDataToDevTools( 'GPTRefresh', refreshData );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var setCurrentTargeting = function( slot, slotElementId ) {
		if ( slot.getTargetingKeys ) {
			var targetingKeys = slot.getTargetingKeys();
			for ( var t = 0, tlength = targetingKeys.length; t < tlength; t++ ) {
				adData.slots[ slotElementId ].targeting[ targetingKeys[ t ] ] = slot.getTargeting( targetingKeys[ t ] );
			}
		}

		for ( var pageTarget in adData.pageTargeting ) {
			if ( ! adData.pageTargeting.hasOwnProperty( pageTarget ) ) {
				continue;
			}
			adData.slots[ slotElementId ].targeting[ pageTarget ] = adData.pageTargeting[ pageTarget ];
		}
	};

	var wrapGPTDisableInitialLoad = function() {
		var oldVersion = googletag.pubads().disableInitialLoad;
		googletag.pubads().disableInitialLoad = function() {
			var timestamp = getTimestamp();
			adData.disabledInitialLoad.push( timestamp );
			sendDataToDevTools( 'GPTDisableInitialLoad', { time: timestamp } );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var wrapGPTEnableSingleRequest = function() {
		var oldVersion = googletag.pubads().enableSingleRequest;
		googletag.pubads().enableSingleRequest = function() {
			var timestamp = getTimestamp();
			adData.enabledSingleRequest.push( timestamp );
			sendDataToDevTools( 'GPTEnableSingleRequest', { time: timestamp } );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var wrapGPTSetTargeting = function() {
		var oldVersion = googletag.pubads().setTargeting;
		googletag.pubads().setTargeting = function() {
			adData.pageTargeting[ arguments[0] ] = arguments[1];
			sendDataToDevTools( 'pageTargetingData', { targets: adData.pageTargeting } );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var wrapGPTEnableServices = function() {
		var oldVersion = googletag.enableServices;
		googletag.enableServices = function() {
			var timestamp = getTimestamp();
			adData.enabledServices.push( timestamp );
			sendDataToDevTools( 'GPTEnableServices', { time: timestamp } );
			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var sendSlotDataToDevTools = function( slotName, data ) {
		sendDataToDevTools( 'slotData', { name: slotName, data: data } );
	};

	var wrapGPTCollapseEmptyDivs = function() {
		var oldVersion = googletag.pubads().collapseEmptyDivs;
		googletag.pubads().collapseEmptyDivs = function() {
			adData.collapseEmptyDivs.timestamp.push( getTimestamp() );
			if ( arguments.length > 0 && arguments[0] ) {
				adData.collapseEmptyDivs.before = 1;
			}
			var result = oldVersion.apply( this, arguments );
			if ( ! result ) {
				adData.collapseEmptyDivs.error = 1;
			}
			sendDataToDevTools( 'GPTCollapseEmptyDivs', { collapsed: adData.collapseEmptyDivs } );
			return result;
		};
	};

	var wrapGPTDisplay = function() {
		var oldVersion = googletag.display;
		googletag.display = function() {
			var elementId = arguments[0];
			if ( ! adData.slots[ elementId ] ) {
				setupNewSlotData( elementId );
			}
			adData.slots[ elementId ].displayCallTimestamp = getTimestamp();
			adData.slots[ elementId ].elementId = elementId;

			setCurrentTargeting( adData.slots[ elementId ], elementId );

			sendSlotDataToDevTools( elementId, adData.slots[ elementId ] );

			var result = oldVersion.apply( this, arguments );
			return result;
		};
	};

	var setupNewSlotData = function( name ) {
		adData.slots[ name ] = {
			refreshedIndexes: [],
			refreshResults: [],
			movedInDOM: [],
			targeting: {}
		};
	};

	var setupNewCreative = function( id ) {
		if ( adData.creatives[ id ] ) {
			return;
		}
		adData.creatives[ id ] = {
			slotRefreshedIndexes: [],
			overallRefreshedIndexes: [],
			refreshResults: []
		};
	};

	var wrapGPTDefineSlot = function() {
		var oldDefineVersion = googletag.defineSlot;
		googletag.defineSlot = function() {
			var definedSlot = oldDefineVersion.apply( this, arguments );
			var elementId = definedSlot.getSlotElementId();
			if ( ! adData.slots[ elementId ] ) {
				setupNewSlotData( elementId );
			}
			adData.slots[ elementId ].elementId = elementId;
			adData.slots[ elementId ].adUnitPath = definedSlot.getAdUnitPath();
			if ( arguments[1] ) {
				adData.slots[ elementId ].fallbackSize = arguments[1];
			}
			if ( ! wrappedSlotFunctions ) {
				wrappedSlotFunctions = 1;
				var proto = Object.getPrototypeOf( definedSlot );

				// googletag.Slot.setTargeting
				( function( obPrototype ) {
					var oldVersion = obPrototype.setTargeting;
					obPrototype.setTargeting = function() {
						// sendDataToDevTools( 'GPTEnableServices', { time: getTimestamp() } );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End googletag.Slot.setTargeting

				// googletag.Slot.defineSizeMapping
				( function( obPrototype ) {
					var oldVersion = obPrototype.defineSizeMapping;
					obPrototype.defineSizeMapping = function() {
						var elementId = this.getSlotElementId();
						if ( ! adData.slots[ elementId ].sizeMappings ) {
							adData.slots[ elementId ].sizeMappings = [ arguments[0] ];
						} else {
							adData.slots[ elementId ].sizeMappings.push( arguments[0] );
						}
						sendSlotDataToDevTools( elementId, adData.slots[ elementId ] );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End googletag.Slot.defineSizeMapping

				// googletag.Slot.setCollapseEmptyDiv
				( function( obPrototype ) {
					var oldVersion = obPrototype.setCollapseEmptyDiv;
					obPrototype.setCollapseEmptyDiv = function() {
						var elementId = this.getSlotElementId();
						if ( arguments[ 0 ] ) {
							adData.slots[ elementId ].collapseEmptyDiv = 1;
						}
						if ( arguments[ 1 ] ) {
							adData.slots[ elementId ].collapseEmptyDiv = 'before';
						}
						sendSlotDataToDevTools( elementId, adData.slots[ elementId ] );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End googletag.Slot.setCollapseEmptyDiv
			}
			return definedSlot;
		};
	};

	var wrapGPTDefineOutOfPageSlot = function() {
		var oldDefineVersion = googletag.defineOutOfPageSlot;
		googletag.defineOutOfPageSlot = function() {
			var definedSlot = oldDefineVersion.apply( this, arguments );
			var elementId = definedSlot.getSlotElementId();
			if ( ! adData.slots[ elementId ] ) {
				setupNewSlotData( elementId );
			}
			adData.slots[ elementId ].elementId = elementId;
			adData.slots[ elementId ].adUnitPath = definedSlot.getAdUnitPath();
			adData.slots[ elementId ].outOfPage = 1;
			if ( ! wrappedOutOfPageSlotFunctions ) {
				wrappedOutOfPageSlotFunctions = 1;
				var proto = Object.getPrototypeOf( definedSlot );

				// googletag.Slot.setTargeting
				( function( obPrototype ) {
					var oldVersion = obPrototype.setTargeting;
					obPrototype.setTargeting = function() {
						// sendDataToDevTools( 'GPTEnableServices', { time: getTimestamp() } );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End googletag.Slot.setTargeting

				// googletag.Slot.defineSizeMapping
				( function( obPrototype ) {
					var oldVersion = obPrototype.defineSizeMapping;
					obPrototype.defineSizeMapping = function() {
						var elementId = this.getSlotElementId();
						if ( ! adData.slots[ elementId ].sizeMappings ) {
							adData.slots[ elementId ].sizeMappings = [ arguments[0] ];
						} else {
							adData.slots[ elementId ].sizeMappings.push( arguments[0] );
						}
						sendSlotDataToDevTools( elementId, adData.slots[ elementId ] );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End googletag.Slot.defineSizeMapping

				// googletag.Slot.setCollapseEmptyDiv
				( function( obPrototype ) {
					var oldVersion = obPrototype.setCollapseEmptyDiv;
					obPrototype.setCollapseEmptyDiv = function() {
						var elementId = this.getSlotElementId();
						if ( arguments[ 0 ] ) {
							adData.slots[ elementId ].collapseEmptyDiv = 1;
						}
						if ( arguments[ 1 ] ) {
							adData.slots[ elementId ].collapseEmptyDiv = 'before';
						}
						sendSlotDataToDevTools( elementId, adData.slots[ elementId ] );
						var result = oldVersion.apply( this, arguments );
						return result;
					};
				} )( proto );
				// End googletag.Slot.setCollapseEmptyDiv
			}
			return definedSlot;
		};
	};

	var sendDataToDevTools = function( action, data ) {
		var toSend = {
			from: 'DFPeep',
			action: action,
			data: data
		};
		window.postMessage( toSend, '*' );
	};

	var listenForMessagesFromPanel = function(){
		window.addEventListener( 'message', function( event ) {
			if ( window !== event.source ) {
				return;
			}

			if ( event.data.from && 'DFPeepFromPanel' === event.data.from ) {
				if ( debug ) {
					console.log( 'Page received message from content script: ' );
					console.log( event.data );
				}
				if ( 'sync' === event.data.action ) {
					sendAllAdData();
				} else if ( 'highlightSlot' === event.data.action
						&& event.data.data ) {
					highlightElement( event.data.data );
				}
			}
		} );
	};

	var sendAllAdData = function() {
		sendDataToDevTools( 'fullSync', adData );
	};

	var getTimestamp = function() {
		return Math.floor( Date.now() );
	};

	var getAdData = function() {
		return adData;
	};

	var highlightElement = function( id ) {
		if ( ! id ) {
			return;
		}

		var element = document.getElementById( id );
		if ( ! element ) {
			return;
		}

		element.scrollIntoView( { block: 'center', inline: 'center' } );

		requestAnimationFrame( function() {
			element.classList.add( 'dfpeep-ad' );
			requestAnimationFrame( function() {
				element.classList.add( 'dfpeep-ad--show' );
			} );
		} );
		setTimeout(
			function() {
				element.classList.remove( 'dfpeep-ad--show' );
			},
			950
		);
	};

	var peep = function() {
		console.log( '\n MMMMMMMMMMMMMMMMMMMMMMMMd+oymMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMMMMMMMMMMm/o/omdsdMMMMMMMMMMMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMMMMMMMMMMMd/:::+hMMMMMMMMMMMMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMMMMMMMMMMMM+:::/hMMMMMMMMMMMMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMMMMMMMMms+:::::::+ymMMMdNMMMMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMMMMMNmo:::::::::::::omy::sNMMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMMNdhssssso+:::::/ossssso/::sMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMmyoso+/+osos+//ososo+++so+::/hMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMhos/     /sosyys+y-    `so+:::sMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMhoos/-::/soso/+y+oo::-:+so/::::dMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMhooysssssso/:/+y+sssssssyy:::::+MMMMMMMMMMMM\n MMMMMMMMMMMMMMMMmyoss+++++o::::ososo++++ho:::::sMMMMMMMMMMMM\n MMMMMMMMMMMMMhsNMmhsssssssy/::::+ssssssss/::::/NMMMMMMMMMMMM\n MMMMMMMMMMMMm-.:mMMNo////:::::::::://+os/::::+mMMMMMMMMMMMMM\n MMMMMMMMMMMM+...-sNy/.-::::::::::::..-:::-::+MhyMMMMMMMMMMMM\n MMMMMMMMMMMm-.....--....---..:::::.............-NMMMMMMMMMMM\n MMMMMMMMMMMd.................-:::-..............hMMMMMMMMMMM\n MMMMMMMMMMM/..................-:-...............dMMMMMMMMMMM\n MMMMMMMMMMM/...................-................dMMMMMMMMMMM\n MMMMMMMMMMM/....................................dMMMMMMMMMMM\n MMMMMMMMMMMs....................................dMMMMMMMMMMM\n MMMMMMMMMMMh....................................dMMMMMMMMMMM\n MMMMMMMMMMMN-..................................:MMMMMMMMMMMM\n MMMMMMMMMMMMy..................................hMMMMMMMMMMMM\n MMMMMMMMMMMMN/................................/MMMMMMMMMMMMM\n MMMMMMMMMMMMMm-............................../MMMMMMMMMMMMMM\n MMMMMMMMMMMMMMM+............................sMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMy:......................../mMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMMMh+-..................-+mMMMMMMMMMMMMMMMMMM\n MMMMMMMMMMMMMMMMMMMMMho+:..........:+ymMMMMMMMMMMMMMMMMMMMMM\n' );
		console.log( 'Hello! My name is Douglas Frederick Peepington. This egg-ceptional extension needs more easter eggs to find.' );
	};

	return {
		init: init,
		getAdData: getAdData,
		peep: peep
	};
} )();
DFPeep.init();
