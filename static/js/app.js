$(function(){
var z = {
  gr_api_base: 'https://www.google.com/reader/api/0/',

  init: function() {
    z.initEventHandlers();
    z.initMainWindow();
  },

  initEventHandlers: function() {
  },

  initMainWindow: function() {
    var url = window.location.protocol + '//78.46.46.179:8080/reader/api/0/subscription/list?output=json';
    console.log(url);
    $.ajax({
      url: url,
      type: 'get',
      dataType: 'json',
      success: function(data){
        console.log(data);
      },
      error: function(xhr, error_code, err) {
        console.log(error_code);
      }
    });
  },
};

z.init();
});
