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

  init: function() {
    z.initGrApi();
    z.initEventHandlers();
    z.initMainWindow();
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

  fetchStartPage: function() {
    if (z.undef(z.data.prefs.start_page)) {
      return this;
    }
    return z.grAjax('contents', z.contentsFetchSuccess, null, {stream: z.data.prefs.start_page, n: 50});
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

  contentsFetchSuccess: function(data) {
    z.raw.sub_data[data.id] = data;
    z.data.current_sub = data;

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

  grAjax: function(api_type, success_callback, error_callback, data) {
    if (z.undef(z.gr_api[api_type])) {
      return false;
    }
    if (z.undef(data)) {
      data = {};
    }

    var params = '';

    var url = z.gr_api_base + z.gr_api[api_type];

    switch(api_type) {
      case 'contents':
        url += data.stream;
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

    url += '?' + z.gr_api_default_params + '&ck=' + (new Date()).getTime() + (z.empty(params) ? '' : '&' + params);

    return $.ajax({
      url: url,
      type: 'get',
      dataType: 'json'
      })
      .error(function(xhr, error_code, err) {
        debug('Error: error_code for ' + url);
        if ($.isFunction(error_callback)) {
          error_callback.call(xhr, error_code, err);
        }
      })
      .success(function(data){
        debug(url);
        debug(data);
        if ($.isFunction(success_callback)) {
          success_callback(data);
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

});
