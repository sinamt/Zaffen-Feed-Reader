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
        return false;
    });

    // DOMNodeInserted for body
    //
    $("body").bind("DOMNodeInserted",function(ev) {

      var ev_target = $(ev.target);

      //debug("DOMNodeInserted : ");
      //debug(ev_target);

      // #main node being inserted, initiate scroll listeners for #entries
      //
      if ($.inArray(ev_target.attr('id'), ['main', 'entries']) > -1) {
        z.startListenerEntriesHeight();
        z.startListenerEntryScroll();
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

  startListenerSideavHeight: function() {
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
    sidenav.height($(window).height() - sidenav.attr('offsetTop'));
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
    var last_entry = $("#entries .entry-list-item:last");
    return last_entry.attr('offsetTop') + last_entry.height();
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
    z.data.current_sub = $.extend({}, data);
    if (z.def(options.continuation) && options.continuation) {
      if (z.def(z.raw.sub_data[data.id]) && z.def(z.raw.sub_data[data.id].items)) {
        data.items = $.merge($.merge([], z.raw.sub_data[data.id].items), data.items);
      }
    }
    //debug("contentsFetchSuccess data =");
    //debug(data);
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

  getGrApiUrl: function(api_type, data) {
    if (z.undef(z.gr_api[api_type])) {
      return false;
    }
    var params = '';

    var url = z.gr_api_base + z.gr_api[api_type];

    switch(api_type) {
      case 'contents':
        url += encodeURIComponent(data.stream);
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
