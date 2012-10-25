// ==UserScript==
// @name EZTV Autocomplete
// @description Replace EZTV's dropdown with a clever search autocomplete
// @namespace ffx
// @version 1
// @match http://eztv.it/
// ==/UserScript==

var TypeaheadData = function(showData) {
  var self = this;

  this.showTokens = [];
  this.invertedIndex = {};
  this.showIndex = {};

  // TODO: Retain the word indices
  showData.forEach(function(show) {
    self.showIndex[show.id] = show.title;

    var terms = self.canonize(show.title).split(' ');
    terms.forEach(function(term) {
      if (term in self.invertedIndex) {
        self.invertedIndex[term].push(show.id);
      } else {
        self.invertedIndex[term] = [ show.id ];
      }
    });
  });

  this.showTokens = Object.keys(self.invertedIndex);
  this.showTokens.sort();
}

TypeaheadData.prototype.canonize = function(query) {
  // TODO: Spend more time on this
  return query.toLowerCase().replace('&', 'and').replace(/[^a-z0-9 ]/g, '');
}

TypeaheadData.prototype.search = function(query) {
  var self = this;

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

  // TODO: We're doing union, but should be doing intersection... or heuristic
  var matchingShows = {};

  var terms = this.canonize(query).split(' ');
  terms.forEach(function(term) {
    var lb = lowerBound(self.showTokens, term);
    var ub = upperBound(self.showTokens, term);

    for (var i = lb; i < ub; i++) {
      var submatch = self.invertedIndex[self.showTokens[i]];
      for (var j = 0; j < submatch.length; j++) {
        matchingShows[submatch[j]] = 1;
      }
    }
  });

  var results = [];
  for (var showId in matchingShows) {
    results.push({
      id: showId,
      title: this.showIndex[showId]
    });
  }

  // TODO: Add a second index to pre-sort
  results.sort(function(a, b) {
    return (a.title < b.title) ? -1 : 1;
  });

  return results;
}

// TODO: arrow key navigation
var selected = null;
var dropdown_open = false;
var last_value = null;
var num_results = null;

var searchForm = document.getElementById('search');
var searchSelect = searchForm.getElementsByTagName('select')[0];
var selectOptions = searchSelect.getElementsByTagName('option');

var showData = [];
for (var i = 0; i < selectOptions.length; i++) {
  var optionElement = selectOptions[i];
  showData.push({
    id: optionElement.getAttribute('value'),
    title: optionElement.text
  });
}

var typeaheadData = new TypeaheadData(showData);

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

  var showId = e.target.getAttribute('data-show-id');
  var itemId = parseInt(e.target.getAttribute('data-item-id'));

  var selectedOption = searchSelect.querySelector('[value="' + showId + '"]');
  selectedOption.setAttribute('selected', true);

  newInput.value = e.target.textContent;
});

function makeActive(past, future) {
  if (past != num_results) {
    var previous = document.getElementById('dropdown-item-' + past);
    previous.classList.remove('active');
  }
  if (future != num_results) {
    var active = document.getElementById('dropdown-item-' + future);
    active.classList.add('active');
  }
}

dropdown.addEventListener('mouseover', function(e) {
  var data_item_id = e.target.getAttribute('data-item-id');
  if (data_item_id) {
    makeActive(selected, data_item_id);
    selected = parseInt(data_item_id);
  }
});

newInput.addEventListener('click', function(e) {
  dropdown.style.display = 'block';
  e.stopPropagation();
});

document.body.addEventListener('click', function(e) {
  dropdown.style.display = 'none';
});

newInput.addEventListener('keydown', function(e) {
  if (!/(38|40|27)/.test(e.keyCode)) {
    return;
  }

  e.preventDefault();

  if (e.keyCode == 27) {
    // TODO: Handle enter key
  }

  var newval = (e.keyCode == 38) ? selected - 1 : selected + 1;
  newval = (newval + (num_results + 1)) % (num_results + 1);

  makeActive(selected, newval);
  selected = newval;
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

  if (!newInput.value) {
    return;
  }

  var showResults = typeaheadData.search(newInput.value);
  num_results = showResults.length;
  selected = num_results;

  // This wrapper allows us to remove all entries at once
  var dropdownEntryWrapper = document.createElement('div');

  var item_id = 0;
  showResults.forEach(function(show) {
    var dropdownEntry = document.createElement('div');
    dropdownEntry.className = 'dropdown-entry';
    dropdownEntry.setAttribute('id', 'dropdown-item-' + item_id);
    dropdownEntry.setAttribute('data-show-id', show.id);
    dropdownEntry.setAttribute('data-item-id', item_id);
    dropdownEntry.appendChild(document.createTextNode(show.title));

    var dropdownLinkEntry = document.createElement('a');
    dropdownLinkEntry.setAttribute('href', '#');
    dropdownLinkEntry.appendChild(dropdownEntry);

    dropdownEntryWrapper.appendChild(dropdownLinkEntry);

    item_id++;
  });

  dropdown.appendChild(dropdownEntryWrapper);
});

searchForm.insertBefore(dropdown, searchForm.firstChild);
searchForm.insertBefore(newInput, searchForm.firstChild);
