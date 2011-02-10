$(function(){
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

  raw: {},

  data: {sub: {}, categories: {}},

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
        z.grAjax('sub', z.subListFetchSuccess), 
        z.grAjax('labels', z.labelListFetchSuccess), 
        z.grAjax('unread', z.unreadFetchSuccess)
        )
      .then(function(){
        console.log('initMainWindow ajax success');
        z.initInterface();
      })
      .fail(function() {
        console.log('initMainWindow ajax failure');
      });
  },

  initInterface: function() {
    z.initData();
    
    z.render();
  },

  render: function() {
    $("#main").tmpl(z.data).appendTo($("body"));

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

    console.log(z.data);
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

  subListFetchSuccess: function(data) {
    z.raw.sub = data.subscriptions;
  },

  labelListFetchSuccess: function(data) {
    z.raw.labels = data;
  },

  unreadFetchSuccess: function(data) {
    z.raw.unread = data.unreadcounts;
  },

  grAjax: function(api_type, success_callback, error_callback, data) {
    if (z.undef(z.gr_api[api_type])) {
      return false;
    }

    var params = '';

    var url = z.gr_api_base + z.gr_api[api_type];

    switch(api_type) {
      case 'feed':
        url += data.feed_name;
        break;

      case 'label':
        url += data.label_name;
        break;
    }

    url += '?' + z.gr_api_default_params + '&ck=' + (new Date()).getTime() + (z.empty(params) ? '' : '&' + params);

    return $.ajax({
      url: url,
      type: 'get',
      dataType: 'json',
      success: function(data){
        //console.log(url);
        //console.log(data);
        if ($.isFunction(success_callback)) {
          success_callback(data);
        }
      },
      error: function(xhr, error_code, err) {
        console.log(error_code);
        if ($.isFunction(error_callback)) {
          error_callback.call(xhr, error_code, err);
        }
      }
    });
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
