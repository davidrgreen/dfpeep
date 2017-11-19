/**
 * Insert a script into the page.
 */
function injectJS( link ) {
	var script = document.createElement( 'script' );
	script.type = 'text/javascript';
	script.src = link;
	document.documentElement.appendChild( script );
}

injectJS( chrome.extension.getURL( 'page/collect-data.js' ) );
