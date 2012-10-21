// ==UserScript==
// @name EZTV Autocomplete
// @description Replace EZTV's dropdown with a clever search autocomplete
// @namespace ffx
// @version 1
// @match http://eztv.it/
// ==/UserScript==

// TODO: Binary search
function lowerBound(arr, key) {
  var idx = 0;
  while (key > arr[idx]) {
    idx++;
  }
  return idx;
}

function upperBound(arr, key) {
  key = key.substr(0, key.length - 1) + String.fromCharCode(key.charCodeAt(key.length - 1) + 1);
  return lowerBound(arr, key);
}

function canonicalTerms(term) {
  // TODO: Spend more time on this
  term = term.replace('&', 'and').replace(/[^A-Za-z0-9 ]/g, '').toLowerCase();
  return term;
}

var searchForm = document.getElementById('search');
var searchSelect = searchForm.getElementsByTagName('select')[0];
var selectOptions = searchSelect.getElementsByTagName('option');

// TODO: Less hacky
var searchInput = searchForm.getElementsByTagName('div')[0];
searchInput.parentNode.removeChild(searchInput);

searchSelect.style.display = 'none';

var showTokens = [];
var invertedIndex = {};
var showIndex = {};

// Extract the data values
for (var i = 1; i < selectOptions.length; i++) {
  var showId = selectOptions[i].getAttribute('value');
  var showTitle = selectOptions[i].text;
  showIndex[showId] = showTitle;

  showTitleWords = canonicalTerms(showTitle).split(' ');
  for (var j = 0; j < showTitleWords.length; j++) {
    var word = showTitleWords[j];
    if (word in invertedIndex) {
      invertedIndex[word].push(showId);
    } else {
      invertedIndex[word] = [ showId ];
    }
  }
}

showTokens = Object.keys(invertedIndex);
showTokens.sort();

// CSS stuff
var autocompleteCss = (
'.dropdown-entry {' +
'  padding: 2px 4px 2px 4px;' +
'  min-height: 20px;' +
'}' +

'.dropdown-entry:hover {' +
'  background: blue;' +
'}');

var autoStyle = document.createElement('style');
autoStyle.type = 'text/css';
autoStyle.appendChild(document.createTextNode(autocompleteCss));
document.head.appendChild(autoStyle);

// DOM stuff
searchForm.style.position = 'relative';

var newInput = document.createElement('input');
newInput.setAttribute('type', 'text');
newInput.setAttribute('id', 'felix');
newInput.style.float = 'left';
newInput.style.width = '400px';

var dropdown = document.createElement('div');
dropdown.setAttribute('id', 'felixd');
dropdown.style.width = '390px';
dropdown.style.position = 'absolute';
dropdown.style.background = 'white';
dropdown.style.padding = '2px 0 2px 0';
dropdown.style.border = '1px solid';
dropdown.style.top = '24px';
dropdown.style.left = '0px';
dropdown.style.display = 'none';

dropdown.addEventListener('click', function() {
  console.log('dropdown clicked');
});

// TODO: arrow key navigation

newInput.addEventListener('focus', function() {
  dropdown.style.display = 'block';
});

newInput.addEventListener('blur', function() {
  // this is wrong
  dropdown.style.display = 'none';
});

// Major sites poll input repeatedly for better feel
newInput.addEventListener('keyup', function() {
  var value = canonicalTerms(newInput.value);
  if (!value) {
    return;
  }

  if (dropdown.firstChild) {
    dropdown.removeChild(dropdown.firstChild);
  }

  // This wrapper allows us to remove all entries at once
  var dropdownEntryWrapper = document.createElement('div');

  var lb = lowerBound(showTokens, value);
  var ub = upperBound(showTokens, value);
  var matchingShows = {};

  // Ugh. Really wish I had better abstractions
  for (var i = lb; i < ub; i++) {
    var submatch = invertedIndex[showTokens[i]];
    for (var j = 0; j < submatch.length; j++) {
      matchingShows[submatch[j]] = 1;
    }
  }

  for (var k in matchingShows) {
    var dropdownEntry = document.createElement('div');
    dropdownEntry.className = 'dropdown-entry';
    dropdownEntry.appendChild(document.createTextNode(showIndex[k]));
    dropdownEntryWrapper.appendChild(dropdownEntry);
  }

  dropdown.appendChild(dropdownEntryWrapper);
});

searchForm.insertBefore(dropdown, searchForm.firstChild);
searchForm.insertBefore(newInput, searchForm.firstChild);
