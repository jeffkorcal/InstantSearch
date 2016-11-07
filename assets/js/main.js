$(function() {

/**************************************************
Initilization
***************************************************/
  // Replace with your own values
  var APPLICATION_ID = '32HX5HS0TH';
  var SEARCH_ONLY_API_KEY = '8acf54d342d00117c9ddbb907116d4d5';
  var INDEX_NAME = 'Place2Eat';
  var PARAMS = {
    hitsPerPage: 7,
    maxValuesPerFacet: 7,
    hierarchicalFacets: [{
        name: 'food_type',
        attributes: ['food_type'],
        sortBy: ['count:desc', 'name:asc']
      }]
  };
  var FACETS_ORDER_OF_DISPLAY = ['food_type'];
  var FACETS_LABELS = { food_type: 'Cusine / Food Type' };

  // Client + Helper initialization
  var algolia = algoliasearch(APPLICATION_ID, SEARCH_ONLY_API_KEY);
  var algoliaHelper = algoliasearchHelper(algolia, INDEX_NAME, PARAMS);

/**************************************************
DOM Binding
***************************************************/
  // jQuery Binding
  $searchInput = $('#search-input');
  $main = $('main');
  $hits = $('#hits');
  $stats = $('#stats');
  $facets = $('#facets');
  $pagination = $('#pagination');
  $stars = $('#stars-ranking');

  // Hogan templates binding
  var hitTemplate = Hogan.compile($('#hit-template').text());
  var statsTemplate = Hogan.compile($('#stats-template').text());
  var facetTemplate = Hogan.compile($('#facet-template').text());
  var paginationTemplate = Hogan.compile($('#pagination-template').text());
  var noResultsTemplate = Hogan.compile($('#no-results-template').text());

/**************************************************
Search Binding
***************************************************/
  // Input binding
  $searchInput.on('input propertychange', function(e) {
    var query = e.currentTarget.value;
    algoliaHelper.setQuery(query).search();
  })
  .focus();

  // Update URL
  algoliaHelper.on('change', function(state) {
    setURLParams();
  });

  // Error
  algoliaHelper.on('error', function(error) {
    console.log(error);
  });

  // Search results
  algoliaHelper.on('result', function(content, state) {
    renderStats(content);
    renderHits(content);
    renderFacets(content, state);
    renderStars();
    renderPagination(content);
    handleNoResults(content);
  });

  // Initial search
  initFromURLParams();
  algoliaHelper.search();

  // Initial render
  $('.rank').each(renderStar);

/**************************************************
Render Functions
***************************************************/
  function renderStats(content) {
    var stats = {
      nbHits: content.nbHits,
      nbHits_plural: content.nbHits !== 1,
      processingTimeS: (content.processingTimeMS/1000)%60
    };
    $stats.html(statsTemplate.render(stats));
  }

  function renderHits(content) {
    $hits.html(hitTemplate.render(content));
  }

  function renderFacets(content, state) {
    var facetsHtml = '';
    for (var facetIndex = 0; facetIndex < FACETS_ORDER_OF_DISPLAY.length; ++facetIndex) {
      var facetName = FACETS_ORDER_OF_DISPLAY[facetIndex];
      var facetResult = content.getFacetByName(facetName);
      var facetContent = {};
      if (facetResult) {
        facetContent = {
          facet: facetName,
          title: FACETS_LABELS[facetName],
          values: content.hierarchicalFacets[0].data
        };
        facetsHtml += facetTemplate.render(facetContent);
      }
    }  
    $facets.html(facetsHtml);
  }

  function renderPagination(content) {
    var pages = [];
    if (content.page > 3) {
      pages.push({current: false, number: 1});
      pages.push({current: false, number: '...', disabled: true});
    }
    for (var p = content.page - 3; p < content.page + 3; ++p) {
      if (p < 0 || p >= content.nbPages) continue;
      pages.push({current: content.page === p, number: p + 1});
    }
    if (content.page + 3 < content.nbPages) {
      pages.push({current: false, number: '...', disabled: true});
      pages.push({current: false, number: content.nbPages});
    }
    var pagination = {
      pages: pages,
      prev_page: content.page > 0 ? content.page : false,
      next_page: content.page + 1 < content.nbPages ? content.page + 2 : false
    };
    $pagination.html(paginationTemplate.render(pagination));
  }

  function renderStars() {
    $('.stars').each(renderStar);
  }

  function renderStar() {
    var val = parseFloat($(this).html());
    var size = Math.max(0, (Math.min(5, val))) * 20;
    var $span = $('<span />').addClass('star-full').width(size);
    $(this).html($span);
  }

/**************************************************
No Result Message
***************************************************/
  function handleNoResults(content) {
    if (content.nbHits > 0) {
      $main.removeClass('no-results');
      return;
    }
    $main.addClass('no-results');

    var filters = [];
    var i;
    var j;
    for (i in algoliaHelper.state.facetsRefinements) {
      filters.push({
        class: 'toggle-refine',
        facet: i, facet_value: algoliaHelper.state.facetsRefinements[i],
        label: FACETS_LABELS[i] + ': ',
        label_value: algoliaHelper.state.facetsRefinements[i]
      });
    }
    for (i in algoliaHelper.state.disjunctiveFacetsRefinements) {
      for (j in algoliaHelper.state.disjunctiveFacetsRefinements[i]) {
        filters.push({
          class: 'toggle-refine',
          facet: i,
          facet_value: algoliaHelper.state.disjunctiveFacetsRefinements[i][j],
          label: FACETS_LABELS[i] + ': ',
          label_value: algoliaHelper.state.disjunctiveFacetsRefinements[i][j]
        });
      }
    }
    for (i in algoliaHelper.state.numericRefinements) {
      for (j in algoliaHelper.state.numericRefinements[i]) {
        filters.push({
          class: 'remove-numeric-refine',
          facet: i,
          facet_value: j,
          label: FACETS_LABELS[i] + ' ',
          label_value: j + ' ' + algoliaHelper.state.numericRefinements[i][j]
        });
      }
    }
    $hits.html(noResultsTemplate.render({query: content.query, filters: filters}));
  }

/**************************************************
Event Binding
// ***************************************************/  
  $(document).on('click', '.toggle-refine', function(e) {
    e.preventDefault();
    algoliaHelper.toggleRefine($(this).data('facet'), $(this).data('value')).search();
  });

  $(document).on('click', '.rank', function(e) {
    e.preventDefault();
    var $refine = $(this);
    var refineVal = $refine.data('ranking');

    var $active = $stars.find('.rank-active');
    var activeVal = $active.data('ranking');

    $active.removeClass('rank-active');
    algoliaHelper.removeNumericRefinement('stars_count', '<=', activeVal).search();
    
    if (activeVal !== refineVal) {
      $refine.addClass('rank-active');
      algoliaHelper.addNumericRefinement('stars_count', '<=', refineVal).search(); 
    }
  });

  $(document).on('click', '.go-to-page', function(e) {
    e.preventDefault();
    $('html, body').animate({scrollTop: 0}, '500', 'swing');
    algoliaHelper.setCurrentPage(+$(this).data('page') - 1).search();
  });

  $(document).on('click', '.clear-all', function(e) {
    e.preventDefault();
    $searchInput.val('').focus();
    algoliaHelper.setQuery('').clearRefinements().search();
  });

/**************************************************
URL Binding
***************************************************/  
  function initFromURLParams() {
    var URLString = window.location.search.slice(1);
    var URLParams = algoliasearchHelper.url.getStateFromQueryString(URLString);
    if (URLParams.query) $searchInput.val(URLParams.query);
    if (URLParams.index) $sortBySelect.val(URLParams.index.replace(INDEX_NAME, ''));
    algoliaHelper.overrideStateWithoutTriggeringChangeEvent(algoliaHelper.state.setQueryParameters(URLParams));
  }

  var URLHistoryTimer = Date.now();
  var URLHistoryThreshold = 700;
  function setURLParams() {
    var trackedParameters = ['attribute:*'];
    if (algoliaHelper.state.query.trim() !== '') trackedParameters.push('query');
    if (algoliaHelper.state.page !== 0) trackedParameters.push('page');
    if (algoliaHelper.state.index !== INDEX_NAME) trackedParameters.push('index');

    var URLParams = window.location.search.slice(1);
    var nonAlgoliaURLParams = algoliasearchHelper.url.getUnrecognizedParametersInQueryString(URLParams);
    var nonAlgoliaURLHash = window.location.hash;
    var helperParams = algoliaHelper.getStateAsQueryString({filters: trackedParameters, moreAttributes: nonAlgoliaURLParams});
    if (URLParams === helperParams) return;

    var now = Date.now();
    if (URLHistoryTimer > now) {
      window.history.replaceState(null, '', '?' + helperParams + nonAlgoliaURLHash);
    } else {
      window.history.pushState(null, '', '?' + helperParams + nonAlgoliaURLHash);
    }
    URLHistoryTimer = now + URLHistoryThreshold;
  }

  window.addEventListener('popstate', function() {
    initFromURLParams();
    algoliaHelper.search();
  });

});