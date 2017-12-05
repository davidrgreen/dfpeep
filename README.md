Hello! I'm Douglas Frederick Peepington, DFPeep for short. I'm a Chrome extension that collects data about DoubleClick for Publishers(DFP) ads that are implemented with Google Publisher Tags(GPT) for Doubleclick. Beyond collecting the data and presenting it to you in a Chrome dev tools panel for easy review, I also make recommendations based on the data collected.

## Issues I Can Recognize
Issues are categorized as either warnings or errors. Warnings are most likely a problem, but there are cases where it may not be a concern. Errors are most definitely an issue.

### Errors
- Enabled single request mode after enabling services.
- Set key-value targeting values as comma dilineated strings instead of arrays of strings.
- Enabled collapseEmptyDivs too late.

### Warnings
- Disabled initial load too late.
- Moved an ad slot in the DOM after the slot was fetched.
- Fetched the same slot more than once.
- Fetched a slot before its previous fetch was marked viewable.
- Ad slot was defined but never fetched.
- Fetches for a slot occurred less than 10 seconds apart.
- Refreshed ad slot(s) when the page was not in focus.
- A creative is wider than the viewport when rendered.
- Page-wide key-value targeting set after enabling services.

## How to Install
1. Download the zip file from https://github.com/davidrgreen/dfpeep/archive/master.zip and unzip it or git clone this locally: git clone https://github.com/davidrgreen/dfpeep.git
3. Click the "Developer mode" checkbox in the top-right.
4. Click "Load unpacked extensions..."
5. Select the folder holding the extension(the unzipped folder or folder created when you ran git clone).
6. Click to Enable the extension.
