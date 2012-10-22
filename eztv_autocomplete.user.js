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

// Build search data-structures
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
// TODO: Probably want to namespace this stuff
var autocompleteCss = (
'.dropdown {' +
'  min-height: 20px;' +
'  width: 398px;' +
'  position: absolute;' +
'  background: white;' +
'  padding: 2px 0 2px 0;' +
'  border: 1px solid;' +
'  top: 24px;' +
'  left: 0;' +
'  display: none;' +
'}' +

'.dropdown a {' +
'  font-weight: bold;' +
'  text-decoration: none;' +
'  display: block;' +
'}' +

'.dropdown-entry {' +
'  padding: 2px 4px 2px 4px;' +
'  min-height: 20px;' +
'}' +

'.dropdown-entry.active {' +
'  background: #D8EAFC;' +
'}');

var autoStyle = document.createElement('style');
autoStyle.type = 'text/css';
autoStyle.appendChild(document.createTextNode(autocompleteCss));
document.head.appendChild(autoStyle);

// DOM stuff
// TODO: Less hacky
var searchInput = searchForm.getElementsByTagName('div')[0];
searchInput.parentNode.removeChild(searchInput);
searchSelect.style.display = 'none';

// Add new stuff
searchForm.style.position = 'relative';

var newInput = document.createElement('input');
newInput.setAttribute('type', 'text');
newInput.style.float = 'left';
newInput.style.width = '400px';

var dropdown = document.createElement('div');
dropdown.className = 'dropdown';

dropdown.addEventListener('click', function(e) {
  e.preventDefault();

  var data_show_id = e.target.getAttribute('data-show-id');
});

dropdown.addEventListener('mouseover', function(e) {
  var data_item_id = e.target.getAttribute('data-item-id');
  if (data_item_id) {
    if (selected) {
      var previous = document.getElementById('dropdown-item-' + selected);
      previous.classList.remove('active');
    }
    selected = e.target.getAttribute('data-item-id');
    var active = document.getElementById('dropdown-item-' + selected);
    active.classList.add('active');
  }
});

// TODO: arrow key navigation
var selected = null;
var dropdown_open = false;
var last_value = null;

newInput.addEventListener('focus', function() {
  dropdown.style.display = 'block';
});

newInput.addEventListener('blur', function(e) {
  console.log(e.target);
});

newInput.addEventListener('keydown', function(e) {
  if (e.keyCode == 38) {
    e.preventDefault();
  } else if (e.keyCode == 40) {
    e.preventDefault();
  }
});

// Major sites poll input repeatedly for better feel
newInput.addEventListener('keyup', function(e) {
  if (newInput.value == last_value) {
    return;
  }
  last_value = newInput.value;

  if (dropdown.firstChild) {
    dropdown.removeChild(dropdown.firstChild);
  }

  var value = canonicalTerms(newInput.value);
  if (!value) {
    return;
  }

  // This wrapper allows us to remove all entries at once
  var dropdownEntryWrapper = document.createElement('div');

  // figure out the weighting...
  var values = value.split(' ');

  // We're doing union, but should be doing intersection... or heuristic
  var matchingShows = {};

  values.forEach(function(val) {
    var lb = lowerBound(showTokens, value);
    var ub = upperBound(showTokens, value);

    // Ugh. Really wish I had better abstractions
    for (var i = lb; i < ub; i++) {
      var submatch = invertedIndex[showTokens[i]];
      for (var j = 0; j < submatch.length; j++) {
        matchingShows[submatch[j]] = 1;
      }
    }
  });

  var item_id = 0;
  for (var k in matchingShows) {
    var dropdownEntry = document.createElement('div');
    dropdownEntry.className = 'dropdown-entry';
    dropdownEntry.setAttribute('id', 'dropdown-item-' + item_id);
    dropdownEntry.setAttribute('data-show-id', k);
    dropdownEntry.setAttribute('data-item-id', item_id);
    dropdownEntry.appendChild(document.createTextNode(showIndex[k]));

    var dropdownLinkEntry = document.createElement('a');
    dropdownLinkEntry.setAttribute('href', '#');
    dropdownLinkEntry.appendChild(dropdownEntry);

    dropdownEntryWrapper.appendChild(dropdownLinkEntry);

    item_id++;
  }

  dropdown.appendChild(dropdownEntryWrapper);
});

searchForm.insertBefore(dropdown, searchForm.firstChild);
searchForm.insertBefore(newInput, searchForm.firstChild);
