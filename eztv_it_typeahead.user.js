// ==UserScript==
// @name eztv.it typeahead
// @description A typeahead for eztv.it search
// @namespace ffx
// @version 1
// @match http://eztv.it/*
// ==/UserScript==

var TypeaheadData = function(showData) {
  var self = this;

  this.showTokens = [];
  this.invertedIndex = {};
  this.showIndex = {};

  // TODO: Retain the word indices
  showData.forEach(function(show) {
    self.showIndex[show.id] = show;

    var terms = self.normalize(show.title).split(' ');
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

TypeaheadData.prototype.normalize = function(query) {
  query = query.toLowerCase();
  // Find equivalent terms
  query = query.replace('&', ' and ');
  // Remove characters we don't find meaningful
  query = query.replace(/[^a-z0-9 ]/g, '');
  return query.replace(/\s+/g, ' ').trim();
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

  var terms = this.normalize(query).split(' ');
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
  for (var itemId in matchingShows) {
    results.push(this.showIndex[itemId]);
  }

  results.sort(function(a, b) {
    return a.id - b.id;
  });

  return results;
}

function TypeaheadUI(selectElem) {
  this.selected = null;
  this.lastValue = null;
  this.numResults = null;
}

TypeaheadUI.prototype.getTypeahead = function() {
  var self = this;

  this.input = document.createElement('input');
  this.input.setAttribute('type', 'text');

  this.dropdown = document.createElement('div');
  this.dropdown.className = 'dropdown';

  this.input.addEventListener('click', function(e) {
    self.dropdown.style.display = 'block';
    e.stopPropagation();
  });

  this.dropdown.addEventListener('click', function(e) {
    e.preventDefault();

    var itemId = e.target.getAttribute('data-item-id');
    if (itemId !== null) {
      self.setSelected(itemId);
      self.confirmSelection();
    }
  });

  this.dropdown.addEventListener('mouseover', function(e) {
    var itemId = e.target.getAttribute('data-item-id');
    if (itemId) {
      self.setSelected(itemId);
    }
  });

  document.body.addEventListener('click', function(e) {
    self.hideDropdown();
  });

  this.input.addEventListener('keydown', function(e) {
    if (!/(38|40|13)/.test(e.keyCode)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (e.keyCode == 13) {
      if (self.selected != self.numResults) {
        self.confirmSelection();
      }

      self.hideDropdown();
      return;
    }

    var next = (e.keyCode == 38) ? self.selected - 1 : self.selected + 1;
    next = (next + (self.numResults + 1)) % (self.numResults + 1);

    self.setSelected(next);
  });

  this.input.addEventListener('keyup', function(e) {
    var query = typeaheadData.normalize(self.input.value);
    if (query == self.lastSearch) {
      return;
    }

    if (query == '') {
      self.clearResults();
      return;
    }

    var showResults = typeaheadData.search(query);
    self.displayResults(showResults);
    self.lastSearch = query;
  });

  var group = document.createElement('div');
  group.appendChild(this.input);
  group.appendChild(this.dropdown);

  return group;
}

TypeaheadUI.prototype.setSelected = function(itemId) {
  if (this.selected != this.numResults) {
    var previous = document.getElementById('dropdown-item-' + this.selected);
    previous.classList.remove('active');
  }
  if (itemId != this.numResults) {
    var active = document.getElementById('dropdown-item-' + itemId);
    active.classList.add('active');
  }
  this.selected = parseInt(itemId);
}

TypeaheadUI.prototype.confirmSelection = function() {
  searchSelect.selectedIndex = this.data[this.selected].id;
  this.input.value = this.data[this.selected].title;
}

TypeaheadUI.prototype.hideDropdown = function() {
  this.dropdown.style.display = 'none';
}

TypeaheadUI.prototype.clearResults = function() {
  if (this.dropdown.firstChild) {
    this.dropdown.removeChild(this.dropdown.firstChild);
  }
}

TypeaheadUI.prototype.displayResults = function(data) {
  this.data = data;
  this.numResults = data.length;
  this.selected = data.length; // Alias for no selection

  this.clearResults();

  var wrapper = document.createElement('div');

  var itemId = 0;
  data.forEach(function(entry) {
    var item  = document.createElement('div');
    item.className = 'dropdown-entry';
    item.setAttribute('id', 'dropdown-item-' + itemId);
    item.setAttribute('data-item-id', itemId);
    item.appendChild(document.createTextNode(entry.title));

    var linkItem = document.createElement('a');
    linkItem.setAttribute('href', '#');
    linkItem.appendChild(item);

    wrapper.appendChild(linkItem);
    itemId++;
  });

  this.dropdown.appendChild(wrapper);
}

do {

var searchForm = document.getElementById('search');
if (searchForm === null) {
  break;
}

// Add CSS for typeahead elements
var typeaheadCSS = (
'.eztv-typeahead {' +
'  float: left;' +
'}' +

'.eztv-typeahead input {' +
'  width: 400px;' +
'}' +

'.eztv-typeahead .dropdown {' +
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

'.eztv-typeahead .dropdown a {' +
'  font-weight: bold;' +
'  text-decoration: none;' +
'  display: block;' +
'}' +

'.eztv-typeahead .dropdown-entry {' +
'  padding: 2px 4px 2px 4px;' +
'  min-height: 20px;' +
'}' +

'.eztv-typeahead .dropdown-entry.active {' +
'  background: #d8eafc;' +
'}');

var typeaheadStyle = document.createElement('style');
typeaheadStyle.type = 'text/css';
typeaheadStyle.appendChild(document.createTextNode(typeaheadCSS));

document.head.appendChild(typeaheadStyle);
var searchSelect = searchForm.getElementsByTagName('select')[0];
var selectOptions = searchSelect.getElementsByTagName('option');

var showData = [];
for (var i = 1; i < selectOptions.length; i++) {
  var optionElement = selectOptions[i];
  showData.push({
    id: i,
    title: optionElement.text
  });
}

var typeaheadData = new TypeaheadData(showData);
var typeaheadUI = new TypeaheadUI();
var typeaheadElem = typeaheadUI.getTypeahead();
typeaheadElem.classList.add('eztv-typeahead');

var searchInput = searchForm.getElementsByTagName('div')[0];
searchInput.parentNode.removeChild(searchInput);
searchSelect.style.display = 'none';
searchForm.style.position = 'relative';

searchForm.insertBefore(typeaheadElem, searchForm.firstChild);

} while(0);
