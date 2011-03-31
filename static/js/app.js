$(document).ready(function(){

var DEBUG = true;

// Helper function to output debug statements
//
function debug(msg) {
  if (DEBUG && console) {
    console.log(msg);
  }
}

var z = {
  gr_api_base: window.location.href + 'reader/api/0/',

  gr_api: {},

  gr_api_default_params: 'output=json&client=zaffen',

  raw: {sub_data: {}},

  data: {sub: {}, categories: {}, prefs: {}},

  uncategorised_id: '__zaffen_uncategorised',

  _loading_current_sub: false,

  _current_sub_id: null,

  init: function() {
    if (z.loggedIn()) {
      z.initLoggedIn();
    } else {
      z.initNotLoggedIn();
    }
  },

  loggedIn: function() {
    if ($.cookie('user_id') && $.cookie('user_id') != 'None') {
      return true;
    } else {
      return false;
    }
  },

  initNotLoggedIn: function() {
    $("#not-logged-in-tmpl").tmpl().appendTo($("body"));
  },

  initLoggedIn: function() {
    z.initGrApi();
    z.initMainWindow();
    z.initEventHandlers();
  },

  initGrApi: function() {
    z.gr_api = {
      sub: 'subscription/list',
      labels: 'tag/list',
      unread: 'unread-count',
      starred: 'stream/contents/user/-/state/com.google/starred',
      contents: 'stream/contents/',
      feed: 'stream/contents/feed/',
      label: 'stream/contents/user/-/label/',
      prefs: 'preference/list',
      stream_prefs: 'preference/stream/list',

    };
  },

  initEventHandlers: function() {

    // Side nav label / feed click
    //
    $(".sn_label_anchor, .sn_sub_anchor").live('click', function(ev) {
        var sub_id = $(this).attr('href');
        z.setCurrentSubId(sub_id);
        //debug(sub_id);
        try {
          z.loadEntriesForSubscription(sub_id);
        } catch(err) {
          debug("error: " + err.name + " " +err.message);
        }
        $("#sidenav .selected").removeClass("selected");
        $(ev.target).addClass("selected");
        return false;
    });

    // DOMNodeInserted for body
    //
    $("body").bind("DOMNodeInserted",function(ev) {

      var ev_target = $(ev.target);

      //debug("DOMNodeInserted : ");
      //debug(ev_target);

      // #main oe #entries node being inserted, initiate scroll listeners for #entries
      //
      if ($.inArray(ev_target.attr('id'), ['main', 'entries']) > -1) {
        z.startListenerEntriesHeight();
        z.startListenerEntryScroll();
      }

      // #main node being inserted, initiate scroll listeners for #entries
      //
      if ($.inArray(ev_target.attr('id'), ['main']) > -1) {
        z.startListenerSidenavHeight();
      }
    });

    // Entry clicked
    //
    $(".entry-list-nav").live('click', function(ev) {
      z.toggleEntryOpen($(ev.target).closest(".entry"));
    });

    // Sidenav open label list
    //
    $(".sidenav-expand-open-icon").live("click", function(ev) {
      z.openSidenavLabel($(ev.target).closest(".sn_label_item"));
    });

    // Sidenav close label list
    //
    $(".sidenav-expand-close-icon").live("click", function(ev) {
      z.closeSidenavLabel($(ev.target).closest(".sn_label_item"));
    });

    // Any keydown event
    //
    $(document).keydown(function(ev){
      debug(ev);
      debug(ev.keyCode);

      // No control or shift key being pressed
      //
      if (ev.ctrlKey != true && ev.shiftKey != true) {
        switch(ev.keyCode) {
          // 'j'
          case 74:
            z.openNextEntry();
            break;

          // 'k'
          case 75:
            z.openPreviousEntry();
            break;

          // 'n'
          case 78:
            z.selectNextEntry();
            break;

          // 'o'
          case 79:
            z.toggleEntryOpen(z.getSelectedEntry());
            break;

          // 'p'
          case 80:
            z.selectPrevEntry();
            break;
        }
      }
    });
  },

  initMainWindow: function() {
    $.when(
        z.grAjax('prefs', z.prefsFetchSuccess),
        z.grAjax('sub', z.subListFetchSuccess), 
        z.grAjax('labels', z.labelListFetchSuccess), 
        z.grAjax('unread', z.unreadFetchSuccess)
        )
      .then(function() {
        debug('initMainWindow ajax success');
        $.when(z.fetchStartPage())
          .then(function(){
            debug("initMainWindow fetchStartPage success");
            z.initInterface();
          })
          .fail(function(jqXHR, textStatus, errorThrown) {
            debug('initMainWindow fetchStartPage failure');
          });
        }
      )
      .fail(function() {
        debug('initMainWindow ajax failure');
      });
  },

  initInterface: function() {
    z.initData();
    
    z.render();

  },

  render: function() {
    $("body").html('');
    $("#main-tmpl").tmpl(z.data).appendTo($("body"));

    //$.each(z.data.categories,function(category_id,category) {
      //$("#sidenav").append(ich.sidenav_label({category: category, category_subscriptions: category.subscriptions, sub: z.data.sub}));
    //});
  },

  initData: function() {
    
    $(z.raw.sub).each(function(idx,sub){
      // For each subscription, store it with it's label/s
      //
      $(sub.categories).each(function(cat_idx,category){
        z.addSubscriptionToCategory(category.id, sub.id);
      });

      if (sub.categories.length <= 0) {
        z.addSubscriptionToCategory(z.uncategorised_id, sub.id);
      }

      z.saveSubscription(sub);
    });

    z.updateUnreadData();

    z.updateCurrentSubData();

    debug("raw=");
    debug(z.raw);
    debug("data=");
    debug(z.data);
  },

  initDataForRender: function() {

  },

  updateUnreadData: function() {
    $(z.raw.unread).each(function(unread_key,unread){
      try {
        z.data.sub[unread.id].unread = unread.count;
      } catch(err) {
        try {
          z.data.categories[unread.id].unread = unread.count;
        } catch(err2) {
        }
      }
    });
  },

  saveSubscription: function(sub){
    z.data.sub[sub.id] = sub;
    z.data.sub[sub.id].articles = {};
  },

  addSubscriptionToCategory: function(category_id, subscription_id){
    if (z.undef(z.data.categories[category_id])) {
      var name = z.getCategoryName(category_id);
      z.data.categories[category_id] = {subscriptions: [], name: name};
    }
    z.data.categories[category_id].subscriptions.push(subscription_id);
  },

  getCategoryName: function(category_id) {
    try {
      var name = category_id.match(/.*\/(.*)/im)[1];
    } catch(err) {
      debug("Error : Cannot get category name. " + err.name + " : " + err.message + " for " + category_id);
      var name = category_id;
    }
    return name;
  },

  setCurrentSubId: function(sub_id) {
    z._current_sub_id = sub_id;
  },

  getCurrentSubId: function() {
    return z._current_sub_id;
  },

  fetchStartPage: function() {
    if (z.undef(z.data.prefs.start_page)) {
      return this;
    }
    z.setCurrentSubId(z.data.prefs.start_page);
    return z.fetchStreamContents(z.data.prefs.start_page, {n: 50});
  },

  fetchStreamContents: function(stream_id, extra_data) {
    if (z.undef(stream_id)) {
      return false;
    }
    if (z.undef(extra_data)) {
      extra_data = {};
    }

    if (stream_id[0] == '/') {
      stream_id = stream_id.substr(1);
    }

    var data = $.extend({stream: stream_id, n: 20, continuation: true}, extra_data);
    return z.grAjax('contents', z.contentsFetchSuccess, null, data);
  },

  loadEntriesForSubscription: function(sub_id, options) {
    if (z.isLoadingCurrentSub()) {
      return false;
    }
    if (z.undef(options)) {
      options = {};
    }

    z.loadingCurrentSub(true);

    $.when(z.fetchStreamContents(sub_id))
      .then(function(){
        z.updateCurrentSubData();
        z.renderCurrentSub(options);
      })
      .fail(function(){
      })
      .done(function(){
        z.loadingCurrentSub(false);
        z.loadMoreCurrentSubEntries();
      });
  },

  loadEntriesForCurrentSubscription: function(options) {
    debug("loadEntriesForCurrentSubscription");
    z.loadEntriesForSubscription(z.getCurrentSubId(), options);
  },

  renderCurrentSub: function(options) {
    if (z.def(options.render_type) && options.render_type == 'append') {
      $("#entries-tmpl").tmpl(z.data.current_sub).appendTo($("#entries"));
    } else {
      $("#content").html('');
      $("#entry-list-tmpl").tmpl(z.data.current_sub).appendTo($("#content"));
    }
  },

  loadingCurrentSub: function(bool) {
    z._loading_current_sub = bool;
  },

  isLoadingCurrentSub: function() {
    return z._loading_current_sub;
  },

  startListenerEntryScroll: function() {
    //debug("startListenerEntryScroll");
    z.stopListenerEntryScroll();

    // scroll does not seem to work with $.live(), so we are binding to #entries every time it is inserted
    // into the DOM.
    //
    //$("#entries").live('scroll.pageless resize.pageless', z.watchEntriesScroll); //.trigger('scroll');
    $("#entries").bind('scroll.pageless resize.pageless', z.watchEntriesScroll).trigger('scroll.pageless');
  },

  stopListenerEntryScroll: function() {
    $("#entries").unbind('.pageless');
  },

  startListenerEntriesHeight: function() {
    z.stopListenerEntriesHeight();
    $(window).bind('resize.entries_height', z.watchEntriesHeight).trigger('resize.entries_height');
  },

  stopListenerEntriesHeight: function() {
    $(window).unbind('.entries_height');
  },

  startListenerSidenavHeight: function() {
    z.stopListenerSidenavHeight();
    $(window).bind('resize.sidenav_height', z.watchSidenavHeight).trigger('resize.sidenav_height');
  },

  stopListenerSidenavHeight: function() {
    $(window).unbind('.sidenav_height');
  },

  watchEntriesScroll: function() {
    //debug('z.getEntriesDistanceToBottom() = ' + z.getEntriesDistanceToBottom());
    z.loadMoreCurrentSubEntries();
  },

  watchEntriesHeight: function() {
    var entries = $("#entries");
    entries.height($(window).height() - entries.attr('offsetTop'));
  },

  watchSidenavHeight: function() {
    var sidenav = $("#sidenav");
    sidenav.height($(window).height() - sidenav.attr('offsetTop') - z.getTopAndBottomSpace(sidenav));
  },

  getTopAndBottomSpace: function(el) {
    return parseInt(el.css('margin-top')) + parseInt(el.css('margin-bottom')) + parseInt(el.css('padding-top')) + parseInt(el.css('padding-bottom'));
  },

  loadMoreCurrentSubEntries: function() {
    if (z.isLoadingCurrentSub() == false) {
      if (z.getEntriesDistanceToBottom() < 300 || z.lastEntryBottom() < $(window).height()) {
        z.loadEntriesForCurrentSubscription({render_type: 'append'});
      }
    }
  },

  getEntriesDistanceToBottom: function() {
    var entries = $("#entries");
    if (entries.length <= 0) {
      return false;
    }
    return entries[0].scrollHeight - entries.scrollTop() - entries.height();
  },

  getEntriesBottom: function() {
    var entries = $("#entries");
    return entries.attr('offsetTop') + entries.attr('scrollTop') + entries.attr('offsetHeight')
  },

  lastEntryBottom: function() {
    var last_entry = $("#entries .entry:last");
    return last_entry.attr('offsetTop') + last_entry.height();
  },

  scrollToEntry: function(entry_el) {
    $("#entries").scrollTop(entry_el.attr('offsetTop') - $("#entries").attr('offsetTop'));
  },

  initPrefsData: function() {
    $.each(z.raw.prefs,function(idx,pref){
        var pref_id = pref.id.replace(/\-/g,'_');
      try {
        z.data.prefs[pref_id] = $.parseJSON(pref.value);
      } catch(err) {
        z.data.prefs[pref_id] = pref.value;
      }
    });
    return this;
  },

  subListFetchSuccess: function(data) {
    z.raw.sub = data.subscriptions;
  },

  labelListFetchSuccess: function(data) {
    z.raw.labels = data;
  },

  unreadFetchSuccess: function(data) {
    z.raw.unread = data.unreadcounts;
  },

  prefsFetchSuccess: function(data) {
    z.raw.prefs = data.prefs;
    z.initPrefsData();
  },

  contentsFetchSuccess: function(data, options) {

    // Grab the index of the previous last entry, to maintain a correct mapping in the DOM
    //
    var last_entry_index = -1;
    if (z.def(z.raw.sub_data[data.id]) && z.def(z.raw.sub_data[data.id].items)) {
      last_entry_index = z.raw.sub_data[data.id].items.length;
    }

    // Loop each feed entry to perform some processing of data
    //
    $.each(data.items, function(idx, item) {
      // Store the entry index relative to all entries
      //
      last_entry_index++;
      data.items[idx].index = last_entry_index;

      // Extract the hostname from the entry link and store it
      //
      data.items[idx].hostname = z.getEntryHostnameFromData(item);
    });

    z.data.current_sub = $.extend({}, data);

    if (z.def(options.continuation) && options.continuation) {
      if (z.def(z.raw.sub_data[data.id]) && z.def(z.raw.sub_data[data.id].items)) {
        data.items = $.merge($.merge([], z.raw.sub_data[data.id].items), data.items);

      }
    }

    z.raw.sub_data[data.id] = data;
  },

  getRawSubData: function(sub_id) {
    if (z.def(z.raw.sub_data[sub_id])) {
      return z.raw.sub_data[sub_id];
    }
    return false;
  },

  updateCurrentSubData: function() {
    if (z.undef(z.data.current_sub.id)) {
      return false;
    }
    var id = z.data.current_sub.id;

    if (z.def(z.data.categories[id])) {
      z.data.current_sub['name'] = z.data.categories[id].name;
    } else if (z.def(z.data.sub[id])) {
      z.data.current_sub['name'] = z.data.sub[id].title;
    }
  },

  getEntryDataFromElement: function(entry_el) {
    var sub = z.getRawSubData(z.data.current_sub.id);
    if (sub == false || z.undef(entry_el.data('index'))) {
      return false;
    }

    return sub.items[entry_el.data('index')];
  },

  toggleEntryOpen: function(entry_el) {
    debug("toggleEntryOpen");

    if (z.undef(entry_el) || entry_el.length <= 0) {
      return false;
    }

    var entry_el_clone = entry_el.clone();

    // Close all open entries
    //
    $("#entries .open").removeClass("open");
    $("#entries .entry-content").remove();

    // If our entry is closed, open it
    //
    if (entry_el_clone.hasClass("open") == false) {

      z.scrollToEntry(entry_el);
      z.selectEntry(entry_el);

      $("#entry-content-tmpl").tmpl(z.getEntryDataFromElement(entry_el)).appendTo(z.getEntryBody(entry_el));
      entry_el.addClass("open");
    }
  },

  selectEntry: function(entry_el) {
    z.deselectEntry($("#entries .selected"));
    entry_el.addClass("selected");
  },

  deselectEntry: function(entry_el) {
    entry_el.removeClass("selected");
  },

  getEntryBody: function(entry_el) {
    return entry_el.find('.entry-body');
  },

  getEntryHostnameFromData: function(entry_data) {
    try {
      return entry_data.alternate[0].href.match(/\/\/([^\/]*?)(?:\/|$)/)[1].replace(/^www./, '');
    } catch(err) {
      return '';
    }
  },

  getSelectedEntry: function() {
    return $("#entries .selected:first");
  },

  getOpenEntry: function() {
    return $("#entries .open:first");
  },

  getNextEntry: function(entry_el) {
    if (entry_el.length <= 0) {
      var next_entry = $(".entry:first");
    } else {
      var next_entry = $(".selected + .entry");
      if (next_entry.length <= 0) {
        next_entry = $(".entry:first");
      }
    }
    return next_entry;
  },

  getPrevEntry: function(entry_el) {
    var prev_entry = [];

    if (entry_el.length > 0) {
      prev_entry = z.getSelectedEntry().prev();
    }

    return prev_entry;
  },

  openNextEntry: function() {
    var selected_entry = z.getSelectedEntry();

    var next_entry = z.getNextEntry(selected_entry);

    if (next_entry.length > 0) {
      z.toggleEntryOpen(next_entry);
    }

  },

  openPreviousEntry: function() {
    var selected_entry = z.getSelectedEntry();

    var prev_entry = z.getPrevEntry(selected_entry);

    if (prev_entry.length > 0) {
      z.toggleEntryOpen(prev_entry);
    }
  },

  selectNextEntry: function() {
    var selected_entry = z.getSelectedEntry();

    var next_entry = z.getNextEntry(selected_entry);

    if (next_entry.length > 0) {
      z.selectEntry(next_entry);
    }
  },

  selectPrevEntry: function() {
    var selected_entry = z.getSelectedEntry();

    var prev_entry = z.getPrevEntry(selected_entry);

    if (prev_entry.length > 0) {
      z.selectEntry(prev_entry);
    }
  },

  closeSidenavLabel: function(label_el) {
    label_el.removeClass("open").find(".sidenav-expand-icon").replaceWith($("#sidenav-item-expand-icon-tmpl").tmpl({type:'open'}));
  },

  openSidenavLabel: function(label_el) {
    label_el.addClass("open").find(".sidenav-expand-icon").replaceWith($("#sidenav-item-expand-icon-tmpl").tmpl({type:'close'}));
  },

  getGrApiUrl: function(api_type, data) {
    if (z.undef(z.gr_api[api_type])) {
      return false;
    }
    var params = '';

    var url = z.gr_api_base + z.gr_api[api_type];

    switch(api_type) {
      case 'contents':
        // We need to double encode the url paramater to get around an apache bug with mod_rewrite:
        // http://fgiasson.com/blog/index.php/2006/07/19/hack_for_the_encoding_of_url_into_url_pr/
        //
        url += encodeURIComponent(encodeURIComponent(data.stream));

        if (data.continuation) {
          var raw_stream_data = z.getRawSubData(data.stream);
          if (raw_stream_data && z.def(raw_stream_data.continuation)) {
            params += '&c=' + raw_stream_data.continuation;
          }
        }
        break;

      case 'feed':
        url += data.feed_name;
        break;

      case 'label':
        url += data.label_name;
        break;
    }

    if (z.def(data['n'])) {
      params += '&n=' + data.n;
    }

    url += '?' + z.gr_api_default_params + '&ck=' + (new Date()).getTime() + (z.empty(params) ? '' : params);

    return url;

  },

  grAjax: function(api_type, success_callback, error_callback, options) {
    if (z.undef(z.gr_api[api_type])) {
      return false;
    }
    if (z.undef(options)) {
      options = {};
    }

    var url = z.getGrApiUrl(api_type, options);

    return $.ajax({
      url: url,
      type: 'get',
      dataType: 'json'
      })
      .error(function(xhr, error_code, err) {
        debug('Error: ' + error_code + ' for ' + url);
        if ($.isFunction(error_callback)) {
          error_callback.call(xhr, error_code, err);
        }
      })
      .success(function(data){
        debug(url);
        debug(data);
        //debug(options);
        if ($.isFunction(success_callback)) {
          success_callback(data, options);
        }
        //debug("ajax success for " + url);
      });
  },

  def: function(some_var) {
    return (typeof some_var != 'undefined');
  },

  undef: function(some_var) {
    return (typeof some_var == 'undefined');
  },

  empty: function(some_var) {
    return (z.undef(some_var) || some_var.length <= 0);
  },
};

z.init();

window['z'] = z;

});
